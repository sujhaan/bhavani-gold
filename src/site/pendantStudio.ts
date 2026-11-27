import * as THREE from 'three';
import type opentype from 'opentype.js';
import { METALS, type MetalId } from '../engine/materials';
import omFontUrl from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff?inline';
import { fontFromDataUrl, nameShapes, shapesArea } from './nameplate';
import { frame, torus } from '../engine/geo';

export type PDesign = 'heart' | 'infinity' | 'butterfly' | 'evil-eye' | 'moon-star' | 'flower' | 'leaf' | 'drop' | 'om' | 'star' | 'sunburst' | 'clover' | 'hamsa' | 'rub-star' | 'arabesque' | 'lira' | 'quatrefoil' | 'bar';
export type PStone = 'diamond' | 'ruby' | 'emerald' | 'sapphire' | 'none';
export const P_DESIGNS: { id: PDesign; label: string; hint: string; stones: boolean }[] = [
  { id: 'heart', label: 'Open heart', hint: 'Classic, light and daily', stones: true },
  { id: 'infinity', label: 'Infinity', hint: 'Forever loop', stones: false },
  { id: 'butterfly', label: 'Butterfly', hint: 'Cut-out wings', stones: true },
  { id: 'evil-eye', label: 'Evil eye', hint: 'Blue stone, gold frame', stones: false },
  { id: 'moon-star', label: 'Moon & star', hint: 'Crescent with a star', stones: true },
  { id: 'flower', label: 'Flower', hint: 'Five petals, centre stone', stones: true },
  { id: 'leaf', label: 'Leaf', hint: 'Veined gold leaf', stones: false },
  { id: 'drop', label: 'Solitaire drop', hint: 'One stone in a teardrop', stones: true },
  { id: 'om', label: 'Om', hint: 'Bold Om in gold', stones: true },
  { id: 'star', label: 'Star', hint: 'Five points, centre stone', stones: true },
  { id: 'sunburst', label: 'Sun coin', hint: 'Coin with sun rays', stones: true },
  { id: 'clover', label: 'Clover', hint: 'Four lucky petals', stones: true },
  { id: 'hamsa', label: 'Hamsa hand', hint: 'Middle-East protection hand', stones: true },
  { id: 'rub-star', label: 'Arabic star', hint: 'Eight-point star, Dubai style', stones: true },
  { id: 'arabesque', label: 'Dubai filigree drop', hint: 'Lace-like cut-out teardrop', stones: true },
  { id: 'lira', label: 'Lira coin', hint: 'Gulf gold coin with beaded rim', stones: false },
  { id: 'quatrefoil', label: 'Quatrefoil', hint: 'European four-lobe motif', stones: true },
  { id: 'bar', label: 'Minimal bar', hint: 'Korean-style slim bar', stones: true },
];
export const P_SIZES = [{ label: 'Small', mm: 13 }, { label: 'Medium', mm: 17 }, { label: 'Large', mm: 22 }];
export const P_THICK = [{ label: 'Light', mm: 0.8 }, { label: 'Regular', mm: 1.1 }, { label: 'Bold', mm: 1.5 }];
export const P_STONES: { id: PStone; label: string; colour: string }[] = [
  { id: 'diamond', label: 'Diamond (CZ)', colour: '#ffffff' }, { id: 'ruby', label: 'Ruby', colour: '#c4122f' },
  { id: 'emerald', label: 'Emerald', colour: '#0e8a4f' }, { id: 'sapphire', label: 'Sapphire', colour: '#1f45b5' }, { id: 'none', label: 'No stone', colour: '' },
];

export type PBuilt = { metal: THREE.BufferGeometry; gems: { pos: THREE.Vector3; r: number; colour?: string }[]; bail: THREE.Vector3; w: number; h: number; grams: number };

const V = (x: number, y: number) => new THREE.Vector2(x, y);
const circle = (r: number, cx = 0, cy = 0, n = 72) => Array.from({ length: n }, (_, i) => V(cx + r * Math.cos((i / n) * Math.PI * 2), cy + r * Math.sin((i / n) * Math.PI * 2)));
const ellipse = (rx: number, ry: number, cx = 0, cy = 0, rot = 0, n = 64) => Array.from({ length: n }, (_, i) => {
  const t = (i / n) * Math.PI * 2, x = rx * Math.cos(t), y = ry * Math.sin(t);
  return V(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot));
});
const ccw = (p: THREE.Vector2[]) => (THREE.ShapeUtils.isClockWise(p) ? p.slice().reverse() : p);
const cw = (p: THREE.Vector2[]) => (THREE.ShapeUtils.isClockWise(p) ? p : p.slice().reverse());
function shape(outer: THREE.Vector2[], holes: THREE.Vector2[][] = []) { const s = new THREE.Shape(ccw(outer)); s.holes = holes.map((h) => new THREE.Path(cw(h))); return s; }
function heart(width: number, cx = 0, cy = 0, rot = 0, n = 110) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2, x = (16 * Math.sin(t) ** 3) * width / 34, y = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2.5) * width / 34;
    return V(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot));
  });
}
function starPts(R: number, r: number, cx = 0, cy = 0, k = 5) { return Array.from({ length: k * 2 }, (_, i) => { const a = Math.PI / 2 + (i * Math.PI) / k, rr = i % 2 ? r : R; return V(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }); }

function capsule(cx: number, cy: number, w: number, h: number, n = 40): THREE.Vector2[] {
  const r = Math.min(w, h) / 2, pts: THREE.Vector2[] = [];
  const ax = w > h, hl = (ax ? w : h) / 2 - r;
  for (let i = 0; i <= n; i++) { const t = -Math.PI / 2 + (i / n) * Math.PI; pts.push(ax ? V(cx + hl + r * Math.cos(t), cy + r * Math.sin(t)) : V(cx + r * Math.sin(t) * -1, cy + hl + r * Math.cos(t) * 1)); }
  for (let i = 0; i <= n; i++) { const t = Math.PI / 2 + (i / n) * Math.PI; pts.push(ax ? V(cx - hl + r * Math.cos(t), cy + r * Math.sin(t)) : V(cx + r * Math.sin(t) * -1, cy - hl + r * Math.cos(t))); }
  return pts;
}
function inside(p: THREE.Vector2, poly: THREE.Vector2[]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}
/** Outline of overlapping circles, traced as one star-shaped curve around the origin. */
function circlesUnion(circles: { c: THREE.Vector2; r: number }[], scale = 1, n = 160): THREE.Vector2[] {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, u = V(Math.cos(a), Math.sin(a));
    let t = 0;
    for (const { c, r } of circles) { const uc = u.dot(c), d = r * r - (c.lengthSq() - uc * uc); if (d >= 0) t = Math.max(t, uc + Math.sqrt(d)); }
    return u.multiplyScalar(t * scale);
  });
}
function extrude(shapes: THREE.Shape[], depth: number) {
  const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -depth / 2); g.computeVertexNormals(); return g;
}
function merge(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3); let o = 0;
  for (const g of parts) { pos.set(g.attributes.position.array as Float32Array, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return m;
}
function topOf(shapes: THREE.Shape[]) { let y = -Infinity, x = 0; shapes.forEach((s) => s.getPoints(8).forEach((p) => { if (p.y > y) { y = p.y; x = p.x; } })); return { x, y }; }
function bounds(shapes: THREE.Shape[]) { const b = new THREE.Box2(); shapes.forEach((s) => s.getPoints(8).forEach((p) => b.expandByPoint(p))); return b.getSize(new THREE.Vector2()); }
const BAIL_MM3 = 2 * Math.PI * 1.6 * Math.PI * 0.45 * 0.45;

export function buildP(design: PDesign, sizeMm: number, depth: number, metal: MetalId, stone: PStone, om: opentype.Font): PBuilt {
  const S = sizeMm, gems: PBuilt['gems'] = [];
  const st = P_STONES.find((s) => s.id === stone)!;
  const addGem = (x: number, y: number, r: number, colour?: string) => { if (colour || stone !== 'none') gems.push({ pos: new THREE.Vector3(x, y, depth / 2 + r * 0.45), r, colour: colour ?? st.colour }); };
  let shapes: THREE.Shape[] = [], extra: THREE.BufferGeometry[] = [], extraMm3 = 0;
  switch (design) {
    case 'heart': { const band = Math.max(1.5, S * 0.1); shapes = [shape(heart(S), [heart(S - band * 2.1, 0, band * 0.3)])]; addGem(S * 0.226, S * 0.39, S * 0.07); break; }
    case 'infinity': {
      const a = S * 0.95, r = Math.max(0.65, depth * 0.62);
      const curve = new (class extends THREE.Curve<THREE.Vector3> { getPoint(t: number, v = new THREE.Vector3()) { const s = t * Math.PI * 2, d = 1 + Math.sin(s) ** 2; return v.set((a * Math.cos(s)) / d, (a * Math.sin(s) * Math.cos(s)) / d * 1.2, Math.sin(2 * s) * 0.55); } })();
      extra = [new THREE.TubeGeometry(curve, 240, r, 12, true)]; extraMm3 = Math.PI * r * r * curve.getLength();
      return { metal: merge(extra), gems, bail: new THREE.Vector3(0, a * 0.42 + 1.2, 0), w: a * 2, h: a * 0.75, grams: ((extraMm3 + BAIL_MM3) * METALS[metal].density) / 1000 };
    }
    case 'butterfly': {
      const w = S * 0.55;
      const wings = [[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sy]) => {
        const big = sy > 0, rx = big ? w * 0.52 : w * 0.36, ry = big ? w * 0.4 : w * 0.3, cx = sx * (big ? w * 0.5 : w * 0.38), cy = sy * (big ? w * 0.28 : w * 0.3), rot = sx * (big ? 0.5 : -0.4) * (sy > 0 ? 1 : -1);
        return shape(ellipse(rx, ry, cx, cy, rot), [ellipse(rx * 0.55, ry * 0.5, cx + sx * rx * 0.08, cy, rot)]);
      });
      shapes = [...wings, shape(ellipse(w * 0.09, w * 0.62, 0, 0))];
      addGem(0, w * 0.38, w * 0.1); addGem(0, 0, w * 0.1); break;
    }
    case 'evil-eye': {
      const w = S * 0.62, h = S * 0.36;
      const eye = (k: number) => Array.from({ length: 96 }, (_, i) => { const t = (i / 96) * Math.PI * 2; return V(w * k * Math.cos(t), h * k * Math.sin(t) * Math.abs(Math.sin(t)) ** 0.15); });
      shapes = [shape(eye(1), [eye(0.78)])];
      // the blue iris and dark pupil are stones set in the opening, held by a thin gold ring
      shapes.push(shape(circle(h * 0.62), [circle(h * 0.5)]));
      shapes.push(shape(ellipse(w * 0.78, h * 0.1, 0, 0)));
      gems.push({ pos: new THREE.Vector3(0, 0, depth * 0.3), r: h * 0.52, colour: '#1f6fd1' });
      break;
    }
    case 'moon-star': {
      // crescent = outer disc minus an offset disc, traced as one outline
      const R = S * 0.5, off = R * 0.42, r2 = R * 0.84;
      const xi = (R * R - r2 * r2 + off * off) / (2 * off), yi = Math.sqrt(Math.max(0, R * R - xi * xi));
      const th = Math.acos(xi / R), phu = Math.atan2(yi, xi - off);
      const pts: THREE.Vector2[] = [];
      for (let i = 0; i <= 90; i++) { const t = th + (i / 90) * (Math.PI * 2 - 2 * th); pts.push(V(R * Math.cos(t), R * Math.sin(t))); }
      for (let i = 0; i <= 70; i++) { const f = (Math.PI * 2 - phu) - (i / 70) * (Math.PI * 2 - 2 * phu); pts.push(V(off + r2 * Math.cos(f), r2 * Math.sin(f))); }
      shapes = [shape(pts)];
      // the star leans on the inside of the crescent so it is soldered, not floating
      shapes.push(shape(starPts(R * 0.34, R * 0.14, -R * 0.14, -R * 0.02)));
      addGem(-R * 0.14, -R * 0.02, R * 0.1); break;
    }
    case 'flower': {
      const r = S * 0.5;
      shapes = Array.from({ length: 5 }, (_, i) => { const a = Math.PI / 2 + (i * Math.PI * 2) / 5; return shape(ellipse(r * 0.34, r * 0.22, Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, a), [ellipse(r * 0.17, r * 0.08, Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, a)]); });
      shapes.push(shape(circle(r * 0.3)));
      addGem(0, 0, r * 0.2); break;
    }
    case 'leaf': {
      const L = S, wdt = S * 0.42;
      const outline = Array.from({ length: 100 }, (_, i) => { const t = (i / 100) * Math.PI * 2; return V(wdt / 2 * Math.sin(t) * (1 - 0.25 * Math.cos(t)), -L / 2 * Math.cos(t)); });
      const veins: THREE.Vector2[][] = [];
      for (let k = -2; k <= 2; k++) for (const sx of [-1, 1]) {
        const y = k * L * 0.15, len = wdt * 0.32 * (1 - Math.abs(k) * 0.18), ang = sx * 0.55;
        const cx = sx * (len / 2 + 0.6), cy = y + len * 0.25;
        veins.push(ellipse(len / 2, 0.32, cx, cy, ang, 24));
      }
      shapes = [shape(outline, veins)]; break;
    }
    case 'drop': {
      const H = S, Wd = S * 0.66;
      const drop = (k: number, dy = 0) => Array.from({ length: 100 }, (_, i) => { const t = (i / 100) * Math.PI * 2; return V(Wd / 2 * k * Math.sin(t) * (1 - Math.cos(t)) * 0.62, -H / 2 * k * Math.cos(t) + dy); });
      shapes = [shape(drop(1), [drop(0.62, -H * 0.06)])];
      addGem(0, -H * 0.06, Wd * 0.22, stone === 'none' ? '#ffffff' : undefined); break;
    }
    case 'om': {
      const r = nameShapes(om, 'ॐ', S * 1.05, S * 1.05);
      shapes = r.shapes; addGem(r.w * 0.22, r.h * 0.38, S * 0.06); break;
    }
    case 'star': { const R = S * 0.55; shapes = [shape(starPts(R, R * 0.45), [starPts(R * 0.62, R * 0.28)])]; shapes.push(shape(circle(R * 0.3))); addGem(0, 0, R * 0.2); break; }
    case 'sunburst': {
      const R = S * 0.5, rays: THREE.Vector2[][] = [];
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, b = a + Math.PI / 16; rays.push([V(R * 0.42 * Math.cos(a), R * 0.42 * Math.sin(a)), V(R * 0.82 * Math.cos((a + b) / 2), R * 0.82 * Math.sin((a + b) / 2)), V(R * 0.42 * Math.cos(b), R * 0.42 * Math.sin(b))]); }
      shapes = [shape(circle(R, 0, 0, 96), [...rays, circle(R * 0.3)])];
      shapes.push(shape(circle(R * 0.3), [circle(R * 0.2)]));
      addGem(0, 0, R * 0.21); break;
    }
    case 'hamsa': {
      const w = S * 0.62;
      const palm = shape(circlesUnion([{ c: V(0, -w * 0.08), r: w * 0.42 }, { c: V(0, -w * 0.32), r: w * 0.34 }]));
      const fingers = [[-w * 0.25, w * 0.36, w * 0.15, w * 0.6], [0, w * 0.44, w * 0.16, w * 0.7], [w * 0.25, w * 0.36, w * 0.15, w * 0.6]].map(([x, y, fw, fh]) => shape(capsule(x, y, fw, fh)));
      const thumbs = [-1, 1].map((sx) => shape(ellipse(w * 0.11, w * 0.26, sx * w * 0.47, -w * 0.12, sx * -0.55)));
      shapes = [palm, ...fingers, ...thumbs];
      // the eye in the palm: a blue stone in a gold ring, with a lace of small cut-outs around it
      shapes.push(shape(circle(w * 0.2, 0, -w * 0.12), [circle(w * 0.15, 0, -w * 0.12)]));
      gems.push({ pos: new THREE.Vector3(0, -w * 0.12, depth / 2 + w * 0.06), r: w * 0.15, colour: stone === 'none' ? '#1f6fd1' : st.colour });
      break;
    }
    case 'rub-star': {
      const R = S * 0.55;
      const outer = starPts(R, R * 0.77, 0, 0, 8);
      const holes: THREE.Vector2[][] = [circle(R * 0.42)];
      for (let i = 0; i < 8; i++) { const a = Math.PI / 2 + (i * Math.PI) / 4; holes.push(circle(R * 0.08, Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, 24)); }
      shapes = [shape(outer, holes)];
      // centre medallion held by eight spokes, like Arabic lattice work
      shapes.push(shape(circle(R * 0.24), [circle(R * 0.17)]));
      for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 + Math.PI / 8, c = V(Math.cos(a) * R * 0.33, Math.sin(a) * R * 0.33); shapes.push(shape(ellipse(R * 0.14, R * 0.035, c.x, c.y, a, 24))); }
      addGem(0, 0, R * 0.17); break;
    }
    case 'arabesque': {
      const H = S * 1.05, Wd = S * 0.7;
      const dropAt = (k: number, dy = 0) => Array.from({ length: 140 }, (_, i) => { const t = (i / 140) * Math.PI * 2; return V(Wd / 2 * k * Math.sin(t) * (1 - Math.cos(t)) * 0.62, -H / 2 * k * Math.cos(t) + dy); });
      const outer = dropAt(1), zone = dropAt(0.84, -H * 0.02), gemAt = V(0, H * 0.3), gr = S * 0.06;
      const holes: THREE.Vector2[][] = [];
      // fine honeycomb lace: many small cut-outs, kept clear of the stone and the rim
      const r = S * 0.03, step = r * 2.55, row = step * 0.87;
      for (let j = 0, y = -H / 2; y < H / 2; y += row, j++) for (let x = -Wd; x < Wd; x += step) {
        const c = V(x + (j % 2) * step / 2, y);
        if (c.distanceTo(gemAt) < gr * 1.9) continue;
        const ring = circle(r, c.x, c.y, 12);
        if (ring.every((q) => inside(q, zone))) holes.push(ring);
      }
      shapes = [shape(outer, holes)];
      // a raised gold frame around the stone
      shapes.push(shape(circle(gr * 1.45, gemAt.x, gemAt.y, 40), [circle(gr * 1.05, gemAt.x, gemAt.y, 40)]));
      addGem(gemAt.x, gemAt.y, gr); break;
    }
    case 'lira': {
      const R = S * 0.5, holes: THREE.Vector2[][] = [];
      for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2; holes.push(circle(R * 0.045, Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86, 12)); }
      shapes = [shape(circle(R, 0, 0, 120), holes)];
      // raised centre with a star relief, standing proud of the coin face
      const relief = extrude([shape(circle(R * 0.62, 0, 0, 96), [starPts(R * 0.36, R * 0.16, 0, 0, 8)]), shape(circle(R * 0.08))], depth * 0.45);
      relief.translate(0, 0, depth * 0.62);
      extra = [relief]; extraMm3 = Math.PI * R * R * 0.3 * depth * 0.45;
      break;
    }
    case 'quatrefoil': {
      const q = S * 0.25, rr = S * 0.27;
      const lobes = [V(q, 0), V(-q, 0), V(0, q), V(0, -q)].map((c) => ({ c, r: rr }));
      const holes = [V(q * 1.15, 0), V(-q * 1.15, 0), V(0, q * 1.15), V(0, -q * 1.15)].map((c) => circle(rr * 0.2, c.x, c.y, 24));
      shapes = [shape(circlesUnion(lobes), holes)];
      shapes.push(shape(circlesUnion(lobes, 0.86), [circlesUnion(lobes, 0.78)]));
      addGem(0, 0, S * 0.1); break;
    }
    case 'bar': {
      const H = S * 1.25, Wb = Math.max(2.6, S * 0.16);
      shapes = [shape(capsule(0, 0, Wb, H))];
      addGem(0, -H * 0.36, Wb * 0.32); break;
    }
    case 'clover': {
      // four hearts, tips meeting at the centre stone
      const w = S * 0.48;
      shapes = [0, 1, 2, 3].map((i) => { const a = (i * Math.PI) / 2, dx = -Math.sin(a), dy = Math.cos(a); return shape(heart(w, dx * w * 0.47, dy * w * 0.47, a), [heart(w * 0.5, dx * w * 0.55, dy * w * 0.55, a)]); });
      shapes.push(shape(circle(w * 0.2)));
      addGem(0, 0, w * 0.15); break;
    }
  }
  const top = topOf(shapes), size = bounds(shapes);
  const mm3 = shapesArea(shapes) * depth + extraMm3 + BAIL_MM3;
  return { metal: extra.length ? merge([extrude(shapes, depth), ...extra]) : extrude(shapes, depth), gems, bail: new THREE.Vector3(top.x, top.y + 1.3, 0), w: size.x, h: size.y, grams: (mm3 * METALS[metal].density) / 1000 };
}

let omFont: opentype.Font | null = null;
const getOm = () => (omFont ??= fontFromDataUrl(omFontUrl));

/** Engine component build: metal with bail, origin at the bail top so it hangs like pendantBody; stones become sockets. */
export function artPendant(design: PDesign, height: number, thickness: number): { metal: THREE.BufferGeometry; anchors: { name: string; matrix: THREE.Matrix4 }[] } {
  const b = buildP(design, height, thickness, '22k-yellow', 'diamond', getOm());
  const br = Math.max(1.6, height * 0.08), bw = Math.max(0.6, thickness * 0.42);
  const bail = torus(br, bw / 2, 10, 26); bail.rotateY(Math.PI / 2); bail.translate(b.bail.x, b.bail.y - 1.3 + br * 0.9, 0);
  const metal = merge([b.metal, bail]);
  const shift = b.bail.y - 1.3 + br * 1.9;
  metal.translate(-b.bail.x, -shift, 0);
  const UP = new THREE.Vector3(0, 1, 0), OUT = new THREE.Vector3(0, 0, 1);
  const anchors = b.gems.map((g, i) => ({ name: i === 0 ? 'socket' : 'socket-ring', matrix: frame(new THREE.Vector3(g.pos.x - b.bail.x, g.pos.y - shift, thickness / 2), UP, OUT) }));
  return { metal, anchors };
}
/** Stone sizes (mm) the templates use for each design: [main, others]. */
export function artStoneSizes(design: PDesign, height: number): number[] {
  const b = buildP(design, height, 1.1, '22k-yellow', 'diamond', getOm());
  return b.gems.map((g) => Math.round(g.r * 2 * 10) / 10);
}
