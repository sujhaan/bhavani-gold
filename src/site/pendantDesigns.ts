import * as THREE from 'three';
import type opentype from 'opentype.js';
import { METALS, type MetalId } from '../engine/materials';
import { nameShapes, shapesArea } from './nameplate';

export type PendantDesign = 'nameplate' | 'heart' | 'disc' | 'bar' | 'initial' | 'infinity' | 'crown' | 'couple';
export const PENDANT_DESIGNS: { id: PendantDesign; label: string; hint: string }[] = [
  { id: 'nameplate', label: 'Nameplate', hint: 'Your name on a chain' },
  { id: 'heart', label: 'Heart frame', hint: 'Name inside an open heart' },
  { id: 'infinity', label: 'Infinity', hint: 'Name across an infinity loop' },
  { id: 'disc', label: 'Coin disc', hint: 'Name cut out of a round coin' },
  { id: 'bar', label: 'Bar', hint: 'Name cut out of a sleek bar' },
  { id: 'initial', label: 'Initial', hint: 'First letter with a stone' },
  { id: 'crown', label: 'Crown', hint: 'Name with a little crown' },
  { id: 'couple', label: 'Couple', hint: 'Two names joined by a heart' },
];
/** Cut-out designs need block letters: overlapping script outlines can't become clean holes. */
export const FORCE_CLASSIC: PendantDesign[] = ['disc', 'bar'];

export type Built = {
  metal: THREE.BufferGeometry; gem?: { pos: THREE.Vector3; r: number };
  rings: { pos: THREE.Vector3; up: boolean }[]; chain: 'sides' | 'top'; w: number; h: number; grams: number;
};

const sp = (pts: [number, number][]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
function move(shapes: THREE.Shape[], dx: number, dy: number, k = 1): THREE.Shape[] {
  const t = (v: THREE.Vector2) => new THREE.Vector2(v.x * k + dx, v.y * k + dy);
  return shapes.map((s) => { const o = new THREE.Shape(s.getPoints(10).map(t)); o.holes = s.holes.map((h) => new THREE.Path(h.getPoints(10).map(t))); return o; });
}
function bbox(shapes: THREE.Shape[]) { const b = new THREE.Box2(); shapes.forEach((s) => s.getPoints(6).forEach((p) => b.expandByPoint(p))); return b; }
function heartPts(width: number, n = 120, cx = 0, cy = 0): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(new THREE.Vector2(cx + (x * width) / 34, cy + ((y + 2.5) * width) / 34));
  }
  return pts;
}
function circlePts(r: number, n = 96, cx = 0, cy = 0) { return Array.from({ length: n }, (_, i) => new THREE.Vector2(cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2))); }
function roundRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
/** Letters as holes in a plate (stencil cut: letter counters drop out, as on a real sawn piece). */
function cutOut(plate: THREE.Shape, letters: THREE.Shape[]) {
  plate.holes.push(...letters.map((l) => { const p = l.getPoints(10); if (THREE.ShapeUtils.isClockWise(p)) p.reverse(); return new THREE.Path(p); }));
  return plate;
}
function extrude(shapes: THREE.Shape[], depth: number) {
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3);
  let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return m;
}
const grams = (mm3: number, metal: MetalId) => (mm3 * METALS[metal].density) / 1000;
const RING_MM3 = 2 * Math.PI * 1.6 * Math.PI * 0.45 * 0.45;

export function buildPendant(design: PendantDesign, font: opentype.Font, scriptFont: opentype.Font, text: string, text2: string, widthMm: number, depth: number, metal: MetalId): Built {
  const name = text.trim() || 'Name';
  if (design === 'nameplate' || design === 'crown') {
    const { shapes, w, h, base } = nameShapes(font, name, widthMm);
    const isScript = font === scriptFont;
    const all = [...shapes];
    if (!isScript) { const b = new THREE.Shape(); const y0 = base - 1.3 * 0.75; b.moveTo(-w / 2, y0); b.lineTo(w / 2, y0); b.lineTo(w / 2, y0 + 1.3); b.lineTo(-w / 2, y0 + 1.3); b.closePath(); all.push(b); }
    let top = h / 2;
    if (design === 'crown') {
      // a five-point crown sitting on the first letter
      const cw = Math.min(9, w * 0.32), ch = cw * 0.62, x0 = -w / 2 + cw * 0.55, y0 = h / 2 - ch * 0.35;
      const c = sp([[-cw / 2, 0], [cw / 2, 0], [cw / 2, ch * 0.55], [cw * 0.32, ch * 0.3], [cw * 0.16, ch], [0, ch * 0.42], [-cw * 0.16, ch], [-cw * 0.32, ch * 0.3], [-cw / 2, ch * 0.55]]);
      all.push(...move([c], x0, y0));
      for (const fx of [-0.5, -0.16, 0.16, 0.5]) all.push(new THREE.Shape(circlePts(cw * 0.06, 20, x0 + fx * cw, y0 + (Math.abs(fx) > 0.3 ? ch * 0.6 : ch * 1.04))));
      top = y0 + ch * 1.1;
    }
    const ry = isScript ? h * 0.12 : base - 1.3 * 0.75 + 0.65;
    return { metal: extrude(all, depth), rings: [{ pos: new THREE.Vector3(-w / 2 - 1.2, ry, 0), up: false }, { pos: new THREE.Vector3(w / 2 + 1.2, ry, 0), up: false }], chain: 'sides', w, h: top + h / 2, grams: grams(shapesArea(all) * depth + 2 * RING_MM3, metal) };
  }
  if (design === 'couple') {
    const a = nameShapes(scriptFont, name, 200, 12), b = nameShapes(scriptFont, (text2.trim() || 'Love'), 200, 12);
    const hw = 7; const gap = 0.6;
    const heart = new THREE.Shape(heartPts(hw));
    let all = [...move(a.shapes, -a.w / 2 - hw / 2 + gap, 0), heart, ...move(b.shapes, b.w / 2 + hw / 2 - gap, 0)];
    const bb = bbox(all), k = widthMm / (bb.max.x - bb.min.x), cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
    all = move(all, -cx * k, -cy * k, k);
    const W = widthMm, H = (bb.max.y - bb.min.y) * k;
    return { metal: extrude(all, depth), rings: [{ pos: new THREE.Vector3(-W / 2 - 1.2, H * 0.1, 0), up: false }, { pos: new THREE.Vector3(W / 2 + 1.2, H * 0.1, 0), up: false }], chain: 'sides', w: W, h: H, grams: grams(shapesArea(all) * depth + 2 * RING_MM3, metal) };
  }
  if (design === 'heart') {
    const W = Math.min(widthMm, 30), band = Math.max(1.6, W * 0.07);
    const outer = heartPts(W), inner = heartPts(W - band * 2.2, 120, 0, band * 0.35).reverse();
    const frame = new THREE.Shape(outer); frame.holes.push(new THREE.Path(inner));
    // the name spans the heart's widest inner line so both ends weld into the frame
    const inW = W * 0.86;
    const nm = nameShapes(scriptFont, name, inW, W * 0.34);
    const letters = move(nm.shapes, 0, W * 0.08);
    const all = [frame, ...letters];
    const top = (13 + 2.5) * W / 34 * 0.95;
    return { metal: extrude(all, depth), rings: [{ pos: new THREE.Vector3(0, top + 1.2, 0), up: true }], chain: 'top', w: W, h: W * 0.95, grams: grams(shapesArea(all) * depth + RING_MM3, metal) };
  }
  if (design === 'infinity') {
    const W = widthMm, a = W / 2;
    const curve = new (class extends THREE.Curve<THREE.Vector3> {
      getPoint(t: number, v = new THREE.Vector3()) { const s = t * Math.PI * 2, d = 1 + Math.sin(s) ** 2; return v.set((a * Math.cos(s)) / d, (a * Math.sin(s) * Math.cos(s)) / d * 1.25, Math.sin(2 * s) * 0.55); }
    })();
    const r = Math.max(0.55, depth * 0.62);
    const tube = new THREE.TubeGeometry(curve, 260, r, 10, true);
    const nm = nameShapes(scriptFont, name, W * 0.84, W * 0.32);
    const plate = extrude(nm.shapes, depth); plate.translate(0, -nm.h * 0.05, r * 0.9);
    const mm3 = shapesArea(nm.shapes) * depth + Math.PI * r * r * curve.getLength() + 2 * RING_MM3;
    return { metal: merge([tube, plate]), rings: [{ pos: new THREE.Vector3(-a - 1.1, 0, 0), up: false }, { pos: new THREE.Vector3(a + 1.1, 0, 0), up: false }], chain: 'sides', w: W, h: W * 0.36, grams: grams(mm3, metal) };
  }
  if (design === 'disc') {
    const D = Math.min(widthMm * 0.7, 26), plate = new THREE.Shape(circlePts(D / 2));
    const nm = nameShapes(font, name.toUpperCase(), D * 0.74, D * 0.26);
    const all = [cutOut(plate, nm.shapes)];
    return { metal: extrude(all, depth), rings: [{ pos: new THREE.Vector3(0, D / 2 + 1.2, 0), up: true }], chain: 'top', w: D, h: D, grams: grams(shapesArea(all) * depth + RING_MM3, metal) };
  }
  if (design === 'bar') {
    const W = widthMm, H = Math.max(6, W * 0.2), plate = roundRect(W, H, H * 0.22);
    const nm = nameShapes(font, name.toUpperCase(), W * 0.84, H * 0.56);
    const all = [cutOut(plate, nm.shapes)];
    return { metal: extrude(all, depth), rings: [{ pos: new THREE.Vector3(-W / 2 - 1.2, 0, 0), up: false }, { pos: new THREE.Vector3(W / 2 + 1.2, 0, 0), up: false }], chain: 'sides', w: W, h: H, grams: grams(shapesArea(all) * depth + 2 * RING_MM3, metal) };
  }
  // initial: one big letter with a small stone where the bail meets it
  const ch = name.charAt(0).toUpperCase() || 'B';
  const Hh = Math.min(22, widthMm * 0.55);
  const nm = nameShapes(font, ch, Hh, Hh);
  const top = nm.h / 2;
  return { metal: extrude(nm.shapes, Math.max(depth, 1.2)), gem: { pos: new THREE.Vector3(0, top - 0.4, Math.max(depth, 1.2) / 2 + 0.6), r: 1.25 }, rings: [{ pos: new THREE.Vector3(0, top + 1.4, 0), up: true }], chain: 'top', w: nm.w, h: nm.h, grams: grams(shapesArea(nm.shapes) * Math.max(depth, 1.2) + RING_MM3, metal) };
}
