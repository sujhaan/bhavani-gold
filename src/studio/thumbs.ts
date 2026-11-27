// One shared off-screen renderer that draws real 3D thumbnails of designs and parts.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildComponent, defaultParams, COMPONENT_MAP } from '../engine/components';
import { designBounds, placements } from '../engine/assembly';
import { uid, ZERO_OFFSET, type Design } from '../engine/schema';
import { gemMaterial, metalMaterial } from './Viewport';
import { GEMS, NAVRATNA } from '../engine/materials';

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
const cache = new Map<string, string>();

function setup(size: number) {
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    const d = new THREE.DirectionalLight('#ffffff', 1.6); d.position.set(50, 90, 70); scene.add(d);
    const d2 = new THREE.DirectionalLight('#ffd9a0', 0.5); d2.position.set(-60, 30, -50); scene.add(d2);
  }
  renderer.setSize(size, size, false);
  return { renderer, scene: scene! };
}

export function designThumb(design: Design, size = 256, key?: string): string {
  const k = (key ?? JSON.stringify(design.nodes)) + size;
  const hit = cache.get(k);
  if (hit) return hit;
  try {
    const { renderer: r, scene: s } = setup(size);
    const group = new THREE.Group();
    const pl = placements(design);
    for (const n of design.nodes) {
      if (!n.visible) continue;
      const b = buildComponent(n.type, n.params);
      const mats = pl.get(n.id) ?? [];
      if (!mats.length) continue;
      const add = (g: THREE.BufferGeometry, m: THREE.Material, colors?: THREE.Color[]) => {
        const im = new THREE.InstancedMesh(g, m, mats.length);
        mats.forEach((mm, i) => im.setMatrixAt(i, mm));
        if (colors) colors.forEach((c, i) => im.setColorAt(i, c));
        group.add(im);
      };
      const alt = n.material.altGem && n.material.altGem !== 'none' ? n.material.altGem : null;
      const nav = n.material.gem === 'navratna';
      if (b.metal) add(b.metal, metalMaterial(n, false));
      if (b.stone) add(b.stone, gemMaterial(n, false, !!alt || nav), nav ? mats.map((_, i) => new THREE.Color(NAVRATNA[(i + 1) % 9])) : alt ? mats.map((_, i) => new THREE.Color(GEMS[(i % 2 ? alt : n.material.gem) ?? 'ruby'].colour)) : undefined);
    }
    s.add(group);
    const box = designBounds(design);
    const c = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3());
    const sz = box.isEmpty() ? 10 : Math.max(...box.getSize(new THREE.Vector3()).toArray());
    const cam = new THREE.PerspectiveCamera(30, 1, sz / 50, sz * 20);
    const isRing = design.nodes.some((n) => !n.attach && (n.type === 'ringBand' || n.type === 'bangle'));
    cam.position.copy(c).add((isRing ? new THREE.Vector3(0.3, 0.95, 1) : new THREE.Vector3(0.45, 0.35, 1)).normalize().multiplyScalar(sz * 2.3));
    cam.lookAt(c);
    r.render(s, cam);
    const url = r.domElement.toDataURL('image/png');
    s.remove(group);
    cache.set(k, url);
    return url;
  } catch {
    return '';
  }
}

/** Thumbnail of a single library part (with a sensible stone/metal look). */
export function partThumb(type: string): string {
  const def = COMPONENT_MAP[type];
  const d: Design = {
    schema: 'bhavani.design/1', id: 'thumb', name: '', category: 'custom', pair: false, refs: [], notes: '', createdAt: '', updatedAt: '', version: 1,
    nodes: [{ id: uid(), type, name: def.label, params: defaultParams(type), material: { metal: '22k-yellow', finish: 'polished', gem: type === 'dropBead' || type === 'motif-bead' ? 'pearl' : type === 'stone' ? 'ruby' : undefined, altGem: 'none' }, offset: { ...ZERO_OFFSET }, visible: true, locked: false }],
  };
  return designThumb(d, 160, 'part:' + type);
}
