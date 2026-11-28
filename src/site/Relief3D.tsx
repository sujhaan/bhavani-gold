import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface Pose { scale: number; turn: number; flip: boolean; depth: number }

/**
 * Turns the cut-out photo into a raised metal piece: the outline gets a rounded
 * thickness, fine detail in the photo is pressed into the surface, and real
 * reflections move across it as you turn it.
 */
function buildRelief(img: HTMLCanvasElement, depth: number) {
  const W = img.width, H = img.height;
  const gx = Math.max(16, Math.min(260, W)), gy = Math.max(16, Math.round((gx * H) / W));
  const s = document.createElement('canvas'); s.width = gx; s.height = gy;
  const g = s.getContext('2d')!; g.drawImage(img, 0, 0, gx, gy);
  const d = g.getImageData(0, 0, gx, gy).data, N = gx * gy;
  const inside = new Uint8Array(N), lum = new Float32Array(N);
  for (let i = 0; i < N; i++) { inside[i] = d[i * 4 + 3] > 110 ? 1 : 0; lum[i] = (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255; }
  // distance from the outline (two-pass chamfer)
  const dist = new Float32Array(N); const BIG = 1e6;
  for (let i = 0; i < N; i++) dist[i] = inside[i] ? BIG : 0;
  for (let y = 0; y < gy; y++) for (let x = 0; x < gx; x++) {
    const i = y * gx + x; if (!dist[i]) continue;
    let v = dist[i];
    if (x > 0) v = Math.min(v, dist[i - 1] + 1); else v = Math.min(v, 1);
    if (y > 0) v = Math.min(v, dist[i - gx] + 1); else v = Math.min(v, 1);
    if (x > 0 && y > 0) v = Math.min(v, dist[i - gx - 1] + 1.414);
    if (x < gx - 1 && y > 0) v = Math.min(v, dist[i - gx + 1] + 1.414);
    dist[i] = v;
  }
  for (let y = gy - 1; y >= 0; y--) for (let x = gx - 1; x >= 0; x--) {
    const i = y * gx + x; if (!dist[i]) continue;
    let v = dist[i];
    if (x < gx - 1) v = Math.min(v, dist[i + 1] + 1); else v = Math.min(v, 1);
    if (y < gy - 1) v = Math.min(v, dist[i + gx] + 1); else v = Math.min(v, 1);
    if (x < gx - 1 && y < gy - 1) v = Math.min(v, dist[i + gx + 1] + 1.414);
    if (x > 0 && y < gy - 1) v = Math.min(v, dist[i + gx - 1] + 1.414);
    dist[i] = v;
  }
  // local average of brightness: bright detail stands up, dark grooves sink
  const avg = new Float32Array(N), r = 3;
  for (let y = 0; y < gy; y++) for (let x = 0; x < gx; x++) {
    let a = 0, n = 0;
    for (let yy = Math.max(0, y - r); yy <= Math.min(gy - 1, y + r); yy++) for (let xx = Math.max(0, x - r); xx <= Math.min(gx - 1, x + r); xx++) { a += lum[yy * gx + xx]; n++; }
    avg[y * gx + x] = a / n;
  }
  const aspect = H / W, width = 2, height = 2 * aspect;
  const geo = new THREE.PlaneGeometry(width, height, gx - 1, gy - 1);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const R = Math.max(2, 0.07 * Math.max(gx, gy)), unit = width / gx;
  const thick = depth * unit * R * 0.9;
  for (let i = 0; i < N; i++) {
    if (!inside[i]) { pos.setZ(i, 0); continue; }
    const t = Math.min(1, dist[i] / R), dome = Math.sqrt(t * (2 - t));
    const detail = (lum[i] - avg[i]) * 0.9;
    pos.setZ(i, Math.max(0.0005, thick * (dome + detail * Math.min(1, t * 2))));
  }
  geo.computeVertexNormals();
  return { geo, width, height };
}

function Env() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    return () => { env.dispose(); pm.dispose(); };
  }, [gl, scene]);
  return null;
}

function Piece({ img, pose, version, onTap }: { img: HTMLCanvasElement; pose: Pose; version: number; onTap?: (u: number, v: number) => void }) {
  const grp = useRef<THREE.Group>(null);
  const idle = useRef(0);
  const { geo, width, height } = useMemo(() => buildRelief(img, pose.depth), [img, pose.depth, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const tex = useMemo(() => { const t = new THREE.CanvasTexture(img); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }, [img, version]); // eslint-disable-line react-hooks/exhaustive-deps
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ map: tex, metalness: 0.15, roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.25, alphaTest: 0.5, envMapIntensity: 0.4, side: THREE.FrontSide }), [tex]);
  useEffect(() => () => { geo.dispose(); }, [geo]);
  useEffect(() => () => { tex.dispose(); mat.dispose(); }, [tex, mat]);
  useFrame((_, dt) => {
    idle.current += dt;
    if (grp.current) grp.current.rotation.y = Math.sin(idle.current * 0.6) * 0.28;
  });
  const fit = 2.2 / Math.max(width, height);
  return (
    <group ref={grp}>
      <group scale={[fit * pose.scale * (pose.flip ? -1 : 1), fit * pose.scale, fit * pose.scale]} rotation={[0, 0, (-pose.turn * Math.PI) / 180]}>
        <mesh geometry={geo} material={mat} castShadow onClick={(e) => { if (e.delta > 6 || !e.uv) return; e.stopPropagation(); onTap?.(e.uv.x, 1 - e.uv.y); }} />
        <mesh geometry={geo} material={mat} scale={[1, 1, -1]} />
      </group>
    </group>
  );
}

/** Moves the camera back far enough that the whole piece fits, on narrow phone screens too. */
function Fit({ aspect }: { aspect: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const vHalf = (38 / 2) * (Math.PI / 180), view = size.width / Math.max(1, size.height);
    const needW = 1.15 / (Math.tan(vHalf) * view), needH = (aspect * 1.15) / Math.tan(vHalf);
    camera.position.set(0, 0, Math.max(3.4, needW, needH));
    camera.lookAt(0, 0, 0);
  }, [camera, size.width, size.height, aspect]);
  return null;
}

export default function Relief3D({ img, pose, version, onGl, onTap }: { img: HTMLCanvasElement; pose: Pose; version: number; onGl?: (c: HTMLCanvasElement) => void; onTap?: (u: number, v: number) => void }) {
  return (
    <Canvas dpr={[1, 1.5]} gl={{ preserveDrawingBuffer: true, antialias: true, toneMapping: THREE.NoToneMapping }} camera={{ position: [0, 0, 3.4], fov: 38 }}
      onCreated={({ gl }) => onGl?.(gl.domElement)}>
      <Env />
      <ambientLight intensity={0.55} />
      <directionalLight position={[2.5, 3, 4]} intensity={1.05} />
      <directionalLight position={[-3, -1, 2]} intensity={0.3} color="#ffe2b8" />
      <Fit aspect={img.height / Math.max(1, img.width)} />
      <Piece img={img} pose={pose} version={version} onTap={onTap} />
      <ContactShadows position={[0, -1.35, 0]} opacity={0.45} scale={4} blur={2.6} far={2} />
      <OrbitControls makeDefault enablePan={false} enableDamping minDistance={1.8} maxDistance={9} minPolarAngle={0.6} maxPolarAngle={2.4} minAzimuthAngle={-1.2} maxAzimuthAngle={1.2} />
    </Canvas>
  );
}
