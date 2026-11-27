import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { ContactShadows, Grid, Html, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { buildComponent, COMPONENT_MAP } from '../engine/components';
import { designBounds, placements } from '../engine/assembly';
import { darkenHex, FINISHES, GEMS, METALS, NAVRATNA } from '../engine/materials';
import type { Design, DesignNode } from '../engine/schema';
import { useStudio, type Light, type ViewName } from './store';

// ------------------------------------------------------------ materials
const matCache = new Map<string, THREE.Material>();
export function metalMaterial(n: DesignNode, selected: boolean): THREE.Material {
  const key = `m|${n.material.metal}|${n.material.finish}|${selected}`;
  let m = matCache.get(key);
  if (!m) {
    const f = FINISHES[n.material.finish];
    const col = darkenHex(METALS[n.material.metal].colour, f.darken);
    m = new THREE.MeshPhysicalMaterial({
      color: col, metalness: 1, roughness: f.roughness, clearcoat: n.material.finish === 'polished' ? 0.35 : 0, clearcoatRoughness: 0.1,
      envMapIntensity: 1.25, emissive: selected ? new THREE.Color('#6b4a10') : new THREE.Color('#000000'), emissiveIntensity: selected ? 0.55 : 0,
    });
    matCache.set(key, m);
  }
  return m;
}

export function gemMaterial(n: DesignNode, selected: boolean, perInstance: boolean): THREE.Material {
  const g = GEMS[n.material.gem ?? 'onyx'];
  const key = `g|${g.id}|${selected}|${perInstance}`;
  let m = matCache.get(key);
  if (!m) {
    const color = perInstance ? '#ffffff' : g.colour;
    m = g.transparent
      ? new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: g.roughness, transmission: 0.92, ior: g.ior, thickness: 2.5, envMapIntensity: 2.2, specularIntensity: 1, attenuationColor: new THREE.Color(g.colour), attenuationDistance: g.id === 'diamond' ? 1000 : 3, flatShading: true, emissive: selected ? new THREE.Color('#5a3d0a') : new THREE.Color(0), emissiveIntensity: selected ? 0.5 : 0 })
      : new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: g.roughness, clearcoat: g.id === 'pearl' ? 0.6 : 0.8, clearcoatRoughness: 0.15, sheen: g.id === 'pearl' ? 1 : 0, sheenColor: new THREE.Color('#ffe9f0'), envMapIntensity: 1.2, emissive: selected ? new THREE.Color('#5a3d0a') : new THREE.Color(0), emissiveIntensity: selected ? 0.5 : 0 });
    matCache.set(key, m);
  }
  return m;
}

// ------------------------------------------------------------ meshes
function Instances({ geometry, material, matrices, colors, nodeId, onPick }: { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[]; colors?: THREE.Color[]; nodeId: string; onPick?: (id: string) => void }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current; if (!m) return;
    matrices.forEach((mat, i) => m.setMatrixAt(i, mat));
    m.instanceMatrix.needsUpdate = true;
    if (colors) { colors.forEach((c, i) => m.setColorAt(i, c)); if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    m.computeBoundingSphere(); m.computeBoundingBox();
  }, [matrices, colors, geometry]);
  if (!matrices.length) return null;
  return (
    <instancedMesh
      key={`${matrices.length}-${colors ? 1 : 0}-${geometry.uuid}`}
      ref={ref}
      args={[geometry, material, matrices.length]}
      castShadow
      userData={{ nodeId }}
      onClick={onPick ? (e: ThreeEvent<MouseEvent>) => { if (e.delta > 8) return; e.stopPropagation(); onPick(nodeId); } : undefined}
    />
  );
}

export function DesignMeshes({ design, selectedId, onPick }: { design: Design; selectedId?: string | null; onPick?: (id: string) => void }) {
  const data = useMemo(() => {
    const pl = placements(design);
    let pairShift: THREE.Matrix4 | null = null;
    if (design.pair) {
      const b = designBounds(design);
      const w = b.isEmpty() ? 20 : b.max.x - b.min.x;
      pairShift = new THREE.Matrix4().makeTranslation(w + 10, 0, 0);
    }
    return design.nodes.filter((n) => n.visible && COMPONENT_MAP[n.type]).map((n) => {
      const built = buildComponent(n.type, n.params);
      let mats = pl.get(n.id) ?? [];
      if (pairShift) {
        const half = (pairShift.elements[12]) / 2;
        const left = new THREE.Matrix4().makeTranslation(-half, 0, 0);
        mats = [...mats.map((m) => left.clone().multiply(m)), ...mats.map((m) => left.clone().multiply(pairShift!).multiply(m))];
      }
      const alt = n.material.altGem && n.material.altGem !== 'none' ? n.material.altGem : null;
      const colors = n.material.gem === 'navratna' && built.stone ? mats.map((_, i) => new THREE.Color(NAVRATNA[(i + 1) % 9]))
        : alt && built.stone ? mats.map((_, i) => new THREE.Color(GEMS[(i % 2 ? alt : n.material.gem) ?? 'ruby'].colour)) : undefined;
      return { n, built, mats, colors };
    });
  }, [design]);
  return (
    <group>
      {data.map(({ n, built, mats, colors }) => (
        <group key={n.id}>
          {built.metal && <Instances geometry={built.metal} material={metalMaterial(n, n.id === selectedId)} matrices={mats} nodeId={n.id} onPick={onPick} />}
          {built.stone && <Instances geometry={built.stone} material={gemMaterial(n, n.id === selectedId, !!colors)} matrices={mats} colors={colors} nodeId={n.id} onPick={onPick} />}
        </group>
      ))}
    </group>
  );
}

/**
 * Tap-to-select that works alongside OrbitControls: a press + release that moves less than a few pixels
 * is a tap. We raycast it ourselves; if the exact point misses, we try a small ring around the finger
 * so thin wires, bands and tiny stones are still easy to pick.
 */
export function TapPicker({ onPick, onMiss }: { onPick: (id: string) => void; onMiss?: () => void }) {
  const { gl, camera, scene } = useThree();
  const cb = useRef({ onPick, onMiss }); cb.current = { onPick, onMiss };
  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; t: number } | null = null;
    const ray = new THREE.Raycaster();
    const offsets: [number, number][] = [[0, 0]];
    for (const r of [5, 9, 14]) for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; offsets.push([Math.cos(a) * r, Math.sin(a) * r]); }
    const onDown = (e: PointerEvent) => { if (e.isPrimary) down = { x: e.clientX, y: e.clientY, t: performance.now() }; };
    const onUp = (e: PointerEvent) => {
      if (!down || !e.isPrimary) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const long = performance.now() - down.t > 700;
      down = null;
      if (moved > 8 || long) return;
      const r = el.getBoundingClientRect();
      const root = scene.getObjectByName('design') ?? scene;
      for (const [dx, dy] of offsets) {
        const ndc = new THREE.Vector2(((e.clientX + dx - r.left) / r.width) * 2 - 1, -((e.clientY + dy - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObject(root, true).find((h) => h.object.userData?.nodeId && h.object.visible);
        if (hit) { cb.current.onPick(hit.object.userData.nodeId); return; }
      }
      cb.current.onMiss?.();
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    return () => { el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerup', onUp); };
  }, [gl, camera, scene]);
  return null;
}

// ------------------------------------------------------------ environment & lights
export function StudioEnvironment({ intensity = 1 }: { intensity?: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environment = env;
    scene.environmentIntensity = intensity;
    return () => { env.dispose(); pmrem.dispose(); };
  }, [gl, scene, intensity]);
  return null;
}

function Lights({ light }: { light: Light }) {
  if (light === 'temple') return (<>
    <StudioEnvironment intensity={0.75} />
    <directionalLight position={[40, 80, 60]} intensity={2.4} color="#ffcf8a" castShadow />
    <pointLight position={[-60, 20, 40]} intensity={1800} color="#ff9b4a" />
    <ambientLight intensity={0.15} color="#ffdcae" />
  </>);
  if (light === 'noir') return (<>
    <StudioEnvironment intensity={0.35} />
    <spotLight position={[0, 120, 80]} angle={0.5} penumbra={0.8} intensity={9000} color="#fff4e2" castShadow />
    <directionalLight position={[-80, 30, -60]} intensity={1.6} color="#9fb6ff" />
  </>);
  return (<>
    <StudioEnvironment intensity={1} />
    <directionalLight position={[50, 90, 70]} intensity={1.6} castShadow />
    <directionalLight position={[-60, 40, -40]} intensity={0.6} />
    <ambientLight intensity={0.25} />
  </>);
}

// ------------------------------------------------------------ camera framing & capture
export const viewportApi: { capture?: (views: ViewName[]) => Promise<Record<string, string>>; exportGLB?: () => Promise<Blob>; fullscreen?: () => void } = {};

export function placeCamera(cam: THREE.Camera, controls: any, box: THREE.Box3, view: ViewName, size: { width: number; height: number }) {
  const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
  const s = box.isEmpty() ? new THREE.Vector3(20, 20, 20) : box.getSize(new THREE.Vector3());
  const r = Math.max(s.x, s.y, s.z, 8);
  // keep the whole piece in frame on narrow (portrait) screens too
  const aspect = Math.max(0.3, size.width / Math.max(1, size.height));
  const vHalf = (32 / 2) * (Math.PI / 180);
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  const wide = view === 'side' ? s.z : s.x;
  const d = Math.max(r * 2.55, (wide / 2) / Math.tan(hHalf) * 1.3 + r * 0.5);
  const dir = { perspective: new THREE.Vector3(0.55, 0.4, 1), ring: new THREE.Vector3(0.3, 0.95, 1), front: new THREE.Vector3(0, 0, 1), back: new THREE.Vector3(0, 0, -1), side: new THREE.Vector3(1, 0, 0), top: new THREE.Vector3(0, 1, 0.0001) }[view].normalize();
  cam.position.copy(c).addScaledVector(dir, d);
  cam.up.set(0, 1, 0);
  cam.lookAt(c);
  if ((cam as THREE.OrthographicCamera).isOrthographicCamera) {
    const oc = cam as THREE.OrthographicCamera;
    oc.zoom = Math.min(size.width / (Math.max(s.x, s.z) * 1.3), size.height / (r * 1.9));
    oc.near = -5000; oc.far = 5000;
    oc.updateProjectionMatrix();
  } else {
    const pc = cam as THREE.PerspectiveCamera;
    pc.near = Math.max(0.1, d / 100); pc.far = d * 20; pc.updateProjectionMatrix();
  }
  if (controls) { controls.target.copy(c); controls.update(); }
}

function CameraRig({ box }: { box: THREE.Box3 }) {
  const { camera, controls, size, gl, scene } = useThree();
  const view = useStudio((s) => s.view);
  const ortho = useStudio((s) => s.ortho);
  const rootKey = useStudio((s) => s.design.id + '|' + s.design.nodes.filter((n) => !n.attach).map((n) => n.type).join(','));
  const boxRef = useRef(box); boxRef.current = box;
  useEffect(() => { placeCamera(camera, controls, boxRef.current, view.name, size); }, [view.nonce, ortho, rootKey, controls, camera]); // eslint-disable-line
  useEffect(() => {
    viewportApi.capture = async (views) => {
      const out: Record<string, string> = {};
      const helpers = scene.getObjectByName('helpers');
      const wasVisible = helpers?.visible;
      if (helpers) helpers.visible = false;
      const savedPos = camera.position.clone();
      const savedTarget = (controls as any)?.target?.clone();
      for (const v of views) {
        placeCamera(camera, controls, boxRef.current, v, size);
        gl.render(scene, camera);
        out[v] = gl.domElement.toDataURL('image/png');
      }
      camera.position.copy(savedPos);
      if (savedTarget && controls) { (controls as any).target.copy(savedTarget); (controls as any).update(); }
      if (helpers) helpers.visible = wasVisible ?? true;
      gl.render(scene, camera);
      return out;
    };
    viewportApi.exportGLB = () => new Promise((resolve, reject) => {
      const root = scene.getObjectByName('design');
      if (!root) return reject(new Error('Nothing to export'));
      new GLTFExporter().parse(root, (res) => resolve(new Blob([res as ArrayBuffer], { type: 'model/gltf-binary' })), (e) => reject(e), { binary: true });
    });
    viewportApi.fullscreen = () => { const el = gl.domElement.parentElement?.parentElement; el?.requestFullscreen?.().catch(() => undefined); };
  }, [camera, controls, gl, scene, size]);
  return null;
}

// ------------------------------------------------------------ helpers: dimensions & reference plane
function Dimensions({ box }: { box: THREE.Box3 }) {
  if (box.isEmpty()) return null;
  const s = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(s.x, s.y, s.z));
  const lbl = (t: string, p: THREE.Vector3) => (
    <Html position={p} center style={{ pointerEvents: 'none' }}><div className="dimlabel">{t}</div></Html>
  );
  return (
    <group>
      <lineSegments geometry={geo} position={c}><lineBasicMaterial color="#c5a059" transparent opacity={0.6} /></lineSegments>
      {lbl(`W ${s.x.toFixed(1)} mm`, new THREE.Vector3(c.x, box.min.y - s.y * 0.06 - 1, box.max.z))}
      {lbl(`H ${s.y.toFixed(1)} mm`, new THREE.Vector3(box.max.x + s.x * 0.05 + 1, c.y, box.max.z))}
      {lbl(`D ${s.z.toFixed(1)} mm`, new THREE.Vector3(box.max.x, box.min.y, c.z))}
    </group>
  );
}

function RefPlane({ box }: { box: THREE.Box3 }) {
  const refs = useStudio((s) => s.design.refs);
  const visible = useStudio((s) => s.refVisible);
  const opacity = useStudio((s) => s.refOpacity);
  const ref = refs.find((r) => r.view === 'front') ?? refs[0];
  const tex = useMemo(() => {
    if (!ref) return null;
    const t = new THREE.TextureLoader().load(ref.dataUrl); t.colorSpace = THREE.SRGBColorSpace; return t;
  }, [ref?.dataUrl]); // eslint-disable-line
  if (!ref || !visible || !tex || box.isEmpty()) return null;
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const h = Math.max(s.y, s.x / (ref.w / ref.h)) * 1.15;
  const w = h * (ref.w / ref.h);
  return (
    <mesh position={[c.x, c.y, box.min.z - Math.max(2, s.z * 0.2)]} renderOrder={-1}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/** Bounds including the second earring when the design is a pair. */
export function pairBounds(design: Design): THREE.Box3 {
  const b = designBounds(design);
  if (!design.pair || b.isEmpty()) return b;
  const w = b.max.x - b.min.x;
  return b.expandByVector(new THREE.Vector3((w + 10) / 2, 0, 0));
}

// ------------------------------------------------------------ viewport
export default function Viewport() {
  const design = useStudio((s) => s.design);
  const selectedId = useStudio((s) => s.selectedId);
  const select = useStudio((s) => s.select);
  const light = useStudio((s) => s.light);
  const grid = useStudio((s) => s.grid);
  const dims = useStudio((s) => s.dims);
  const ortho = useStudio((s) => s.ortho);
  const box = useMemo(() => pairBounds(design), [design]);
  const size = box.isEmpty() ? 20 : Math.max(...box.getSize(new THREE.Vector3()).toArray());
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: light === 'noir' ? 0.95 : 1.1 }}
      onPointerMissed={(e) => { if (e.type === 'click') select(null); }}
    >
      {ortho ? <OrthographicCamera makeDefault position={[0, 0, 100]} /> : <PerspectiveCamera makeDefault fov={32} position={[30, 25, 60]} />}
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} />
      <Lights light={light} />
      <group name="design"><DesignMeshes design={design} selectedId={selectedId} onPick={select} /></group>
      <group name="helpers">
        {grid && !box.isEmpty() && <Grid position={[0, box.min.y - 0.5, 0]} args={[size * 6, size * 6]} cellSize={1} sectionSize={10} cellColor="#3a362f" sectionColor="#6b5a36" fadeDistance={size * 5} infiniteGrid cellThickness={0.6} sectionThickness={1} />}
        {dims && <Dimensions box={box} />}
        <RefPlane box={box} />
        {!box.isEmpty() && <ContactShadows position={[box.getCenter(new THREE.Vector3()).x, box.min.y - 0.3, box.getCenter(new THREE.Vector3()).z]} scale={size * 2.4} blur={2.6} opacity={0.45} far={size} resolution={512} color="#000000" />}
      </group>
      <CameraRig box={box} />
    </Canvas>
  );
}

// ------------------------------------------------------------ small auto-rotating preview (landing page, cards)
function AutoFrame({ box }: { box: THREE.Box3 }) {
  const { camera, controls, size } = useThree();
  useEffect(() => { placeCamera(camera, controls, box, 'perspective', size); }, [box, controls]); // eslint-disable-line
  return null;
}

export function PreviewCanvas({ design, autoRotate = true, interactive = true, exposure = 1.1 }: { design: Design; autoRotate?: boolean; interactive?: boolean; exposure?: number }) {
  const box = useMemo(() => pairBounds(design), [design]);
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure }}>
      <PerspectiveCamera makeDefault fov={30} />
      <OrbitControls makeDefault autoRotate={autoRotate} autoRotateSpeed={1.4} enableZoom={false} enablePan={false} enabled={interactive} />
      <StudioEnvironment intensity={1} />
      <directionalLight position={[50, 90, 70]} intensity={1.5} />
      <directionalLight position={[-60, 30, -50]} intensity={0.5} color="#ffd9a0" />
      <DesignMeshes design={design} />
      <AutoFrame box={box} />
    </Canvas>
  );
}
