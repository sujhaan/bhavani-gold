import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WebGLPathTracer, GradientEquirectTexture } from 'three-gpu-pathtracer';

/**
 * Turns the live 3D design into a photograph-like image with a GPU path tracer:
 * real reflections in the gold, refraction in stones, soft shadows on a velvet backdrop.
 */
export type PhotoJob = { canvas: HTMLCanvasElement; cancel: () => void; done: Promise<HTMLCanvasElement> };

/** Bake every mesh (and every instance of instanced meshes) into world space, merged per material/colour. */
function flatten(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { mat: THREE.Material; geos: THREE.BufferGeometry[] }>();
  const add = (geo: THREE.BufferGeometry, m: THREE.Matrix4, mat: THREE.Material, colour?: THREE.Color) => {
    const g = new THREE.BufferGeometry();
    const src = geo.index ? geo.toNonIndexed() : geo;
    g.setAttribute('position', src.attributes.position.clone());
    if (src.attributes.normal) g.setAttribute('normal', src.attributes.normal.clone()); else g.computeVertexNormals();
    g.applyMatrix4(m);
    const key = mat.uuid + (colour ? colour.getHexString() : '');
    let b = buckets.get(key);
    if (!b) {
      let mm = mat;
      if (colour && (mat as THREE.MeshPhysicalMaterial).color) { mm = mat.clone(); (mm as THREE.MeshPhysicalMaterial).color.copy(colour); }
      b = { mat: mm, geos: [] }; buckets.set(key, b);
    }
    b.geos.push(g);
  };
  root.traverse((o) => {
    if (!o.visible) return;
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry?.attributes?.position) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      const im = new THREE.Matrix4(), c = new THREE.Color();
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, im);
        const colour = inst.instanceColor ? (inst.getColorAt(i, c), c.clone()) : undefined;
        add(inst.geometry, new THREE.Matrix4().multiplyMatrices(inst.matrixWorld, im), mat, colour);
      }
    } else add(mesh.geometry, mesh.matrixWorld, mat);
  });
  const out = new THREE.Group();
  for (const { mat, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    if (merged) out.add(new THREE.Mesh(merged, mat));
  }
  return out;
}

export function startRealPhoto(source: THREE.Object3D, liveCamera: THREE.PerspectiveCamera, opts: { width: number; height: number; samples: number; onProgress?: (p: number) => void }): PhotoJob {
  const { width, height } = opts;
  const canvas = document.createElement('canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const piece = flatten(source);
  scene.add(piece);
  const box = new THREE.Box3().setFromObject(piece);
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const span = Math.max(size.x, size.y, size.z, 10);

  // velvet backdrop just behind the piece, so its soft shadow lands on the cloth
  const velvet = new THREE.MeshPhysicalMaterial({ color: '#3a281c', roughness: 0.95, sheen: 1, sheenColor: new THREE.Color('#8a6447'), sheenRoughness: 0.55 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(span * 12, span * 12), velvet);
  back.position.set(centre.x, centre.y, box.min.z - Math.max(2.5, span * 0.06));
  scene.add(back);

  // two softboxes for the long gold highlights a jewellery photographer uses
  const key = new THREE.RectAreaLight('#fff3e0', 9, span * 1.6, span * 0.9);
  key.position.set(centre.x - span * 0.9, centre.y + span * 1.1, centre.z + span * 1.6); key.lookAt(centre); scene.add(key);
  const fill = new THREE.RectAreaLight('#ffe7c4', 4, span * 1.2, span * 1.2);
  fill.position.set(centre.x + span * 1.3, centre.y + span * 0.2, centre.z + span * 1.2); fill.lookAt(centre); scene.add(fill);

  const env = new GradientEquirectTexture();
  env.topColor.set('#fff1dc'); env.bottomColor.set('#1a120c'); env.exponent = 2; env.update();
  scene.environment = env; scene.environmentIntensity = 0.9;
  scene.background = new THREE.Color('#1e150f');

  const cam = new THREE.PerspectiveCamera(liveCamera.fov, width / height, liveCamera.near, liveCamera.far);
  cam.position.copy(liveCamera.position); cam.quaternion.copy(liveCamera.quaternion); cam.updateProjectionMatrix();

  // a big warm-white reflector card behind the camera: flat gold faces mirror it, like a studio product shot.
  // a darker stripe across it gives the gold that rich light-to-dark sweep instead of a flat tone.
  const back2cam = cam.position.clone().sub(centre).normalize();
  const cardPos = cam.position.clone().add(back2cam.clone().multiplyScalar(span * 0.8)).add(new THREE.Vector3(0, span * 0.35, 0));
  const mkCard = (w: number, h: number, colour: string, intensity: number, dy: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#000000', emissive: colour, emissiveIntensity: intensity, side: THREE.DoubleSide }));
    m.position.copy(cardPos).add(new THREE.Vector3(0, dy, 0)); m.lookAt(centre); scene.add(m); return m;
  };
  mkCard(span * 4, span * 1.6, '#fff1dc', 1.6, span * 0.9);
  mkCard(span * 4, span * 0.9, '#3a2a1c', 1, -span * 0.35);
  mkCard(span * 4, span * 1.4, '#ffe6c2', 0.9, -span * 1.4);

  const pt = new WebGLPathTracer(renderer);
  pt.tiles.set(2, 2);
  pt.bounces = 8;
  pt.transmissiveBounces = 10;
  pt.filterGlossyFactor = 0.5;
  pt.minSamples = 1;
  pt.renderDelay = 0;
  pt.fadeDuration = 0;
  pt.setScene(scene, cam);

  let raf = 0, cancelled = false;
  const done = new Promise<HTMLCanvasElement>((resolve) => {
    const t0 = performance.now();
    const step = () => {
      if (cancelled) return;
      pt.renderSample();
      const p = Math.min(1, pt.samples / opts.samples);
      opts.onProgress?.(p);
      if (p >= 1 || performance.now() - t0 > 45000) { resolve(canvas); return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  });
  const cancel = () => {
    cancelled = true; cancelAnimationFrame(raf);
    pt.dispose(); renderer.dispose();
    piece.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  };
  return { canvas, cancel, done };
}
