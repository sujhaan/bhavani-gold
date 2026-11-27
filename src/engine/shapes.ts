// Parametric generators for jewellery parts. Convention: +Z faces the viewer/out of the surface,
// +Y is "up". Hanging parts have their attachment point at the origin and hang along -Y.
import * as THREE from 'three';
import {
  V, applyM, CircleCurve, cylinderZ, ellipseSection, ensureOutward, extrude, frame, latheZ, merge,
  prep, profileSection, sphere, sweep, torus,
} from './geo';

export type Anchor = { name: string; matrix: THREE.Matrix4 };
export type Built = { metal?: THREE.BufferGeometry; stone?: THREE.BufferGeometry; anchors: Anchor[] };

const A = (name: string, pos: THREE.Vector3, up: THREE.Vector3, out: THREE.Vector3): Anchor => ({ name, matrix: frame(pos, up, out) });
const UP = V(0, 1, 0), OUT = V(0, 0, 1);

// ---------------------------------------------------------------- rings & bangles
class ArcCurve extends THREE.Curve<THREE.Vector3> {
  r: number; a0: number; a1: number;
  constructor(r: number, a0: number, a1: number) { super(); this.r = r; this.a0 = a0; this.a1 = a1; }
  getPoint(t: number, v = new THREE.Vector3()) { const a = this.a0 + t * (this.a1 - this.a0); return v.set(Math.sin(a) * this.r, Math.cos(a) * this.r, 0); }
}
export const RING_SIZES = Array.from({ length: 30 }, (_, i) => i + 1);
export function ringInnerDiameter(indianSize: number): number { return 12.75 + 0.327 * indianSize; }
export const BANGLE_SIZES: Record<string, number> = { '2-2': 54.0, '2-4': 57.2, '2-6': 60.3, '2-8': 63.5, '2-10': 66.7, '2-12': 69.9 };

export function band(innerD: number, width: number, thick: number, profile: string, pattern: string, stations: number, arcDeg: number, full: boolean, openingDeg = 0): Built {
  const R = innerD / 2 + thick / 2;
  // Sweep frames on this circle: normal = axis (-Z), binormal = radial outward. Map (radialIn, width) -> (width, -radialIn).
  const turn = (pts: THREE.Vector2[]) => pts.map((q) => new THREE.Vector2(q.y, -q.x));
  const sec = turn(profileSection(profile, thick, width));
  const mod = pattern === 'twist' ? (t: number) => ({ rot: t * Math.PI * 2 * Math.round(innerD * 0.9) })
    : pattern === 'ribbed' ? (t: number) => ({ sy: 1 + 0.16 * Math.sin(t * Math.PI * 2 * Math.round(innerD * 1.4)) })
    : pattern === 'wave' ? (t: number) => ({ sx: 1 + 0.22 * Math.sin(t * Math.PI * 2 * 9) })
    : undefined;
  const segs = pattern === 'plain' ? Math.round(80 + innerD * 2) : Math.round(innerD * 14);
  const section = pattern === 'twist' && profile === 'half-round' ? turn(profileSection('flat', thick, width)) : sec;
  let metal: THREE.BufferGeometry;
  if (openingDeg > 0) {
    // open cuff: gap at the bottom, finished with round knobs
    const g = (openingDeg * Math.PI) / 180;
    const a0 = Math.PI + g / 2, a1 = 3 * Math.PI - g / 2;
    const arc = new ArcCurve(R, a0, a1);
    const body = sweep(arc, segs, false, section, mod);
    const knob = sphere(Math.max(thick, width * 0.45) * 0.75, 18, 14);
    metal = merge([body, applyM(knob, new THREE.Matrix4().setPosition(arc.getPoint(0))), applyM(knob, new THREE.Matrix4().setPosition(arc.getPoint(1)))])!;
  } else metal = sweep(new CircleCurve(R), segs, true, section, mod);
  const Ro = innerD / 2 + thick;
  const anchors: Anchor[] = [A('top', V(0, Ro, 0), V(0, 0, 1), V(0, 1, 0))];
  for (let i = 0; i < stations; i++) {
    const phi = full ? (i / stations) * Math.PI * 2 : (stations === 1 ? 0 : (-arcDeg / 2 + (arcDeg * i) / (stations - 1)) * (Math.PI / 180));
    const dir = V(Math.sin(phi), Math.cos(phi), 0);
    anchors.push(A('station', dir.clone().multiplyScalar(Ro), V(0, 0, 1), dir));
  }
  return { metal, anchors };
}

// ---------------------------------------------------------------- loops (necklaces, chains, bracelets)
export type LoopShape = 'choker' | 'round' | 'U' | 'V';

/**
 * Closed necklace path of the given length (mm), as worn: the back sits around the neck (behind, z < 0)
 * and the front hangs down. Back/clasp at u = 0, centre front at u = 0.5.
 */
export function necklaceCurve(lengthMm: number, shape: LoopShape): THREE.CatmullRomCurve3 {
  const Nw = 62, Nd = 52; // half-width and depth of the neck ring (mm)
  // x as a fraction of neck width at drop fractions 0 → 1 (shoulder → centre)
  const prof: Record<LoopShape, [number, number][]> = {
    U: [[1, 0], [0.97, 0.3], [0.86, 0.6], [0.6, 0.86], [0.3, 0.98]],
    V: [[1, 0], [0.8, 0.28], [0.56, 0.56], [0.3, 0.8], [0.1, 0.95]],
    round: [[1, 0], [0.93, 0.36], [0.74, 0.7], [0.42, 0.93], [0.16, 0.99]],
    choker: [[1, 0], [0.92, 0.42], [0.7, 0.78], [0.38, 0.95], [0.12, 1]],
  };
  const build = (D: number) => {
    const pts: THREE.Vector3[] = [V(0, 0.02 * D, -Nd)];
    const backN = 5;
    for (let i = 1; i <= backN; i++) { const a = (i / (backN + 1)) * (Math.PI / 2); pts.push(V(Nw * Math.sin(a), 0.02 * D, -Nd * Math.cos(a))); }
    const front = prof[shape].map(([fx, fy], i) => V(Nw * fx * (1 + 0.15 * Math.min(1, D / 200) * (shape === 'U' ? Math.sin(fy * Math.PI) : 0)), -D * fy, 6 + 10 * (i / 4)));
    pts.push(...front, V(0, -D, 18));
    const left = pts.slice(1, -1).reverse().map((p) => V(-p.x, p.y, p.z));
    return new THREE.CatmullRomCurve3([...pts, ...left], true, 'centripetal');
  };
  let lo = 4, hi = 900;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (build(mid).getLength() < lengthMm) lo = mid; else hi = mid; }
  const curve = build(lo);
  const len = curve.getLength();
  if (len > lengthMm * 1.01) {
    // shorter than the neck ring itself: shrink the whole loop
    const k = lengthMm / len;
    return new THREE.CatmullRomCurve3(curve.points.map((p) => p.clone().multiplyScalar(k)), true, 'centripetal');
  }
  return curve;
}

export class EllipseCurve3 extends THREE.Curve<THREE.Vector3> {
  a: number; b: number;
  constructor(a: number, b: number) { super(); this.a = a; this.b = b; }
  getPoint(t: number, target = new THREE.Vector3()) {
    const th = t * Math.PI * 2;
    return target.set(Math.sin(th) * this.a, Math.cos(th) * this.b, 0);
  }
}

export type ChainStyle = 'wire' | 'cable' | 'rope' | 'box' | 'ball' | 'figaro' | 'curb' | 'singapore' | 'paperclip' | 'snake' | 'blackbeads';

export function chainAlong(curve: THREE.Curve<THREE.Vector3>, style: ChainStyle, wire: number): { metal?: THREE.BufferGeometry; stone?: THREE.BufferGeometry } {
  const len = curve.getLength();
  if (style === 'wire') return { metal: sweep(curve, Math.max(120, Math.round(len / 1.2)), true, ellipseSection(wire, wire, 10)) };
  if (style === 'snake') {
    const n = Math.round(len / (wire * 0.9));
    return { metal: sweep(curve, Math.min(4000, Math.max(200, Math.round(len / (wire * 0.3)))), true, ellipseSection(wire * 1.5, wire * 1.5, 12), (t) => ({ sx: 1 + 0.06 * Math.sin(t * n * Math.PI * 2), sy: 1 + 0.06 * Math.sin(t * n * Math.PI * 2) })) };
  }
  const metal: THREE.BufferGeometry[] = [], stoneParts: THREE.BufferGeometry[] = [];
  const linkLen = wire * 4.2;
  const pitch = {
    rope: wire * 1.25, singapore: wire * 0.95, ball: wire * 2.9, blackbeads: wire * 2.3, curb: linkLen * 0.52,
    paperclip: linkLen * 2.6 - 2.1 * wire, cable: linkLen - 2.05 * wire, box: linkLen - 2.05 * wire, figaro: linkLen - 2.05 * wire,
  }[style as 'rope'] ?? linkLen - 2.05 * wire;
  const N = Math.max(8, Math.floor(len / pitch));
  const frames = curve.computeFrenetFrames(N, true);
  const R = linkLen / 2 - wire / 2;
  const cable = torus(R, wire / 2, 8, 18); cable.scale(1, 0.62, 1);
  const longLink = torus(R, wire / 2, 8, 22); longLink.scale(1.9, 0.62, 1);
  const clip = torus(R, wire / 2, 8, 26); clip.scale(2.6, 0.55, 1);
  const curb = torus(R, wire * 0.62, 8, 20); curb.scale(1.15, 0.7, 0.62);
  const sing = torus(R * 0.8, wire * 0.42, 6, 14); sing.scale(1, 0.55, 1);
  const boxLink = torus(R, wire / 2, 4, 4); boxLink.rotateZ(Math.PI / 4); boxLink.scale(1.15, 0.8, 1);
  const ball = sphere(wire * 1.05, 12, 9);
  const bead = sphere(wire * 0.95, 10, 8);
  const goldBead = sphere(wire * 1.15, 12, 9);
  const bar = cylinderZ(wire * 0.28, pitch); bar.rotateY(Math.PI / 2); bar.translate(-pitch / 2, 0, 0);
  const P = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const u = i / N;
    curve.getPointAt(u, P);
    const m = new THREE.Matrix4().makeBasis(frames.tangents[i], frames.normals[i], frames.binormals[i]).setPosition(P);
    const r = new THREE.Matrix4();
    if (style === 'cable' || style === 'box' || style === 'figaro' || style === 'paperclip') r.makeRotationX(i % 2 ? Math.PI / 2 : 0);
    else if (style === 'rope') r.makeRotationX((i * Math.PI) / 3).multiply(new THREE.Matrix4().makeRotationZ(0.55));
    else if (style === 'singapore') r.makeRotationX((i * Math.PI) / 4).multiply(new THREE.Matrix4().makeRotationZ(0.4));
    else if (style === 'curb') r.makeRotationX(Math.PI / 2 + (i % 2 ? 0.42 : -0.42));
    const mm = m.clone().multiply(r);
    if (style === 'ball') { metal.push(applyM(ball, m), applyM(bar, m)); }
    else if (style === 'blackbeads') { if (i % 9 === 0) metal.push(applyM(goldBead, m)); else stoneParts.push(applyM(bead, m)); }
    else if (style === 'box') metal.push(applyM(boxLink, mm));
    else if (style === 'figaro' && i % 4 === 3) metal.push(applyM(longLink, mm));
    else if (style === 'paperclip') metal.push(applyM(clip, mm));
    else if (style === 'curb') metal.push(applyM(curb, mm));
    else if (style === 'singapore') metal.push(applyM(sing, mm));
    else metal.push(applyM(cable, mm));
  }
  return { metal: merge(metal), stone: merge(stoneParts) };
}

/** Evenly spaced stations along the front of a necklace curve, with an optional centre gap. */
export function loopStations(curve: THREE.Curve<THREE.Vector3>, count: number, coverage: number, gap: number, liftZ: number): Anchor[] {
  const out: Anchor[] = [];
  if (count <= 0) return out;
  const us: number[] = [];
  if (gap <= 0.001) for (let i = 0; i < count; i++) us.push(0.5 - coverage / 2 + (coverage * (i + 0.5)) / count);
  else {
    const k = Math.max(1, Math.round(count / 2));
    for (let j = 0; j < k; j++) { const d = gap / 2 + ((coverage / 2 - gap / 2) * (j + 0.5)) / k; us.push(0.5 - d, 0.5 + d); }
  }
  const centre = curve.getPointAt(0.5).clone().multiplyScalar(0.45);
  const P = new THREE.Vector3(), T = new THREE.Vector3();
  for (const u of us) {
    curve.getPointAt(u, P); curve.getTangentAt(u, T);
    const y = P.clone().sub(centre); y.sub(T.clone().multiplyScalar(y.dot(T))).normalize();
    const z = new THREE.Vector3().crossVectors(T, y);
    if (z.z < 0) z.negate();
    out.push({ name: 'station', matrix: frame(P.clone().add(V(0, 0, liftZ)), y, z) });
  }
  return out;
}

export function loopBase(curve: THREE.Curve<THREE.Vector3>, style: ChainStyle, wire: number, stations: number, coverage: number, gap: number): Built {
  const { metal, stone } = chainAlong(curve, style, wire);
  const c = curve.getPointAt(0.5);
  const anchors: Anchor[] = [
    A('center', c.clone().add(V(0, 0, wire * 0.6)), UP, OUT),
    A('clasp', curve.getPointAt(0), UP, V(0, 0, -1)),
    ...loopStations(curve, stations, coverage, gap, wire * 0.5),
  ];
  return { metal, stone, anchors };
}

// ---------------------------------------------------------------- 2D outlines
export function pearOutline(W: number, H: number, n = 90): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector2(0.5 * W * Math.sin(t) * Math.pow((1 - Math.cos(t)) / 2, 0.6) * 1.18, -H * (1 - Math.cos(t)) / 2));
  }
  return pts;
}

export function shapeFrom(pts: THREE.Vector2[]): THREE.Shape {
  const s = new THREE.Shape(); pts.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y))); s.closePath(); return s;
}

function heartOutline(S: number, n = 100): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.pow(Math.sin(t), 3), y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push(new THREE.Vector2((x / 34) * S, (y / 34) * S - S * 0.33));
  }
  return pts;
}

function flowerOutline(R: number, petals: number, cx = 0, cy = 0, n = 160): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2; const r = R * (0.68 + 0.32 * Math.abs(Math.cos((petals * t) / 2)));
    pts.push(new THREE.Vector2(cx + Math.cos(t) * r, cy + Math.sin(t) * r));
  }
  return pts;
}

function circleOutline(R: number, cx = 0, cy = 0, n = 64): THREE.Vector2[] {
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return new THREE.Vector2(cx + Math.cos(t) * R, cy + Math.sin(t) * R); });
}

/** Points on an outline found by casting rays from a centre at the given angles (radians). */
function edgeAt(outline: THREE.Vector2[], cx: number, cy: number, angles: number[], inset = 0): THREE.Vector2[] {
  return angles.map((a) => {
    let best = outline[0], bd = Infinity;
    for (const p of outline) {
      const ang = Math.atan2(p.y - cy, p.x - cx);
      let d = Math.abs(ang - a); d = Math.min(d, Math.PI * 2 - d);
      if (d < bd) { bd = d; best = p; }
    }
    const dir = new THREE.Vector2(best.x - cx, best.y - cy);
    const L = dir.length();
    return new THREE.Vector2(cx, cy).add(dir.multiplyScalar(Math.max(0, L - inset) / L));
  });
}

function spread(n: number, from: number, to: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [(from + to) / 2];
  return Array.from({ length: n }, (_, i) => from + ((to - from) * i) / (n - 1));
}

// ---------------------------------------------------------------- pendants & plaques
export type PlaqueShape = 'teardrop' | 'medallion' | 'floral' | 'heart' | 'peacock' | 'temple-coin' | 'leaf' | 'lozenge' | 'crescent' | 'tablet';

function coinLathe(R: number, T: number): THREE.BufferGeometry {
  const prof = [V(0, -T / 2), V(R, -T / 2), V(R, T / 2), V(R * 0.86, T / 2), V(R * 0.82, T * 0.18), V(R * 0.45, T * 0.3), V(0, T * 0.62)].map((p) => new THREE.Vector2(p.x, p.y));
  return latheZ(prof, 56);
}

/** A flat ornament (pendant body, earring top, motif). Returns geometry in a box centred at (0, cy). */
export function plaque(shape: PlaqueShape, H: number, T: number, opts: { ringCount: number; dropCount: number; openwork: boolean }) {
  const W = H * 0.72;
  let outline: THREE.Vector2[] = [];
  let metal: THREE.BufferGeometry | undefined;
  let cy = -H / 2;
  const sockets: THREE.Vector2[] = [];
  let ring: THREE.Vector2[] = [];
  const extras: THREE.BufferGeometry[] = [];
  switch (shape) {
    case 'teardrop': {
      outline = pearOutline(W, H); cy = -H * 0.66;
      const s = shapeFrom(outline);
      if (opts.openwork) s.holes.push(shapeFrom(pearOutline(W * 0.5, H * 0.5).map((p) => new THREE.Vector2(p.x, p.y - H * 0.38)).reverse()));
      metal = extrude(s, T, T * 0.3);
      sockets.push(new THREE.Vector2(0, cy));
      ring = edgeAt(outline, 0, cy, spread(opts.ringCount, -Math.PI * 0.9, Math.PI * 1.9 / 2 + Math.PI * 0.05).map((a) => a), H * 0.12);
      break;
    }
    case 'heart': {
      outline = heartOutline(H); cy = -H * 0.42;
      metal = extrude(shapeFrom(outline.map((p) => new THREE.Vector2(p.x, p.y - H * 0.08))), T, T * 0.3);
      outline = outline.map((p) => new THREE.Vector2(p.x, p.y - H * 0.08));
      sockets.push(new THREE.Vector2(0, cy));
      ring = edgeAt(outline, 0, cy, spread(opts.ringCount, 0, Math.PI * 2 * (1 - 1 / Math.max(1, opts.ringCount))), H * 0.13);
      break;
    }
    case 'floral': {
      const R = H / 2; const petals = 8;
      outline = flowerOutline(R, petals, 0, -R);
      const s = shapeFrom(outline);
      metal = merge([extrude(s, T, T * 0.3), applyM(sphere(R * 0.22, 16, 10), new THREE.Matrix4().makeScale(1, 1, 0.55).setPosition(0, -R, T * 0.45))]);
      sockets.push(new THREE.Vector2(0, -R));
      ring = Array.from({ length: opts.ringCount }, (_, i) => { const t = (i / Math.max(1, opts.ringCount)) * Math.PI * 2 + Math.PI / 2; return new THREE.Vector2(Math.cos(t) * R * 0.62, -R + Math.sin(t) * R * 0.62); });
      break;
    }
    case 'medallion':
    case 'temple-coin': {
      const R = H / 2;
      outline = circleOutline(R, 0, -R);
      const coin = coinLathe(R, T); coin.translate(0, -R, 0);
      const parts = [coin];
      if (shape === 'temple-coin') {
        const bead = sphere(T * 0.32, 10, 8);
        const n = Math.max(12, Math.round((Math.PI * 2 * R) / (T * 0.9)));
        for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; parts.push(applyM(bead, new THREE.Matrix4().setPosition(Math.cos(t) * R * 0.93, -R + Math.sin(t) * R * 0.93, T * 0.5))); }
      }
      metal = merge(parts);
      sockets.push(new THREE.Vector2(0, -R));
      ring = Array.from({ length: opts.ringCount }, (_, i) => { const t = (i / Math.max(1, opts.ringCount)) * Math.PI * 2 + Math.PI / 2; return new THREE.Vector2(Math.cos(t) * R * 0.66, -R + Math.sin(t) * R * 0.66); });
      break;
    }
    case 'leaf': {
      const n = 80; outline = [];
      for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; const x = Math.cos(t) * (W * 0.45); const y = Math.sin(t) * (H / 2) ; outline.push(new THREE.Vector2(x * Math.pow(Math.abs(Math.sin(t)), 0.15) * (Math.sin(t) > 0 ? 1 : 1), y - H / 2)); }
      outline = []; // lens/vesica shape, point at top and bottom
      for (let i = 0; i <= n; i++) { const y = -H * (i / n); const k = 1 - Math.pow((2 * (i / n) - 1), 2); outline.push(new THREE.Vector2((W / 2) * Math.pow(k, 0.85), y)); }
      for (let i = n - 1; i > 0; i--) { const y = -H * (i / n); const k = 1 - Math.pow((2 * (i / n) - 1), 2); outline.push(new THREE.Vector2((-W / 2) * Math.pow(k, 0.85), y)); }
      metal = extrude(shapeFrom(outline), T, T * 0.3);
      sockets.push(new THREE.Vector2(0, -H / 2));
      ring = spread(opts.ringCount, -H * 0.2, -H * 0.8).map((y) => new THREE.Vector2(0, y));
      break;
    }
    case 'crescent': {
      const R = H / 2, cy0 = -R;
      const t1 = (20 * Math.PI) / 180;
      const sh = new THREE.Shape();
      sh.moveTo(Math.cos(t1) * R, cy0 + Math.sin(t1) * R);
      sh.absarc(0, cy0, R, t1, Math.PI - t1, true);
      sh.quadraticCurveTo(0, cy0 - R * 0.42, Math.cos(t1) * R, cy0 + Math.sin(t1) * R);
      const top = cy0 + Math.sin(t1) * R;
      outline = sh.getPoints(60).map((q) => new THREE.Vector2(q.x, q.y - top));
      const s2 = shapeFrom(outline);
      if (opts.openwork) s2.holes.push(shapeFrom(circleOutline(R * 0.16, 0, cy0 - R * 0.62 - top, 24).reverse()));
      metal = extrude(s2, T, T * 0.3);
      cy = cy0 - top;
      sockets.push(new THREE.Vector2(0, cy - R * 0.68));
      ring = spread(opts.ringCount, Math.PI * 1.12, Math.PI * 1.88).map((a) => new THREE.Vector2(Math.cos(a) * R * 0.82, cy + Math.sin(a) * R * 0.82));
      break;
    }
    case 'tablet': {
      const w = W * 0.95, h = H, r = w * 0.16;
      const sh = new THREE.Shape();
      sh.moveTo(-w / 2 + r, 0); sh.lineTo(w / 2 - r, 0); sh.quadraticCurveTo(w / 2, 0, w / 2, -r);
      sh.lineTo(w / 2, -h + r); sh.quadraticCurveTo(w / 2, -h, w / 2 - r, -h); sh.lineTo(-w / 2 + r, -h);
      sh.quadraticCurveTo(-w / 2, -h, -w / 2, -h + r); sh.lineTo(-w / 2, -r); sh.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
      outline = sh.getPoints(12);
      const border = extrude(shapeFrom(outline), T, T * 0.25);
      const inset = applyM(extrude(shapeFrom(outline.map((q) => new THREE.Vector2(q.x * 0.8, (q.y + h / 2) * 0.86 - h / 2))), T * 0.5, T * 0.15), new THREE.Matrix4().setPosition(0, 0, T * 0.45));
      metal = merge([border, inset]);
      sockets.push(new THREE.Vector2(0, -h / 2));
      ring = [new THREE.Vector2(-w * 0.32, -h * 0.12), new THREE.Vector2(w * 0.32, -h * 0.12), new THREE.Vector2(w * 0.32, -h * 0.88), new THREE.Vector2(-w * 0.32, -h * 0.88)].slice(0, opts.ringCount);
      break;
    }
    case 'lozenge': {
      outline = [new THREE.Vector2(0, 0), new THREE.Vector2(W / 2, -H / 2), new THREE.Vector2(0, -H), new THREE.Vector2(-W / 2, -H / 2)];
      const s = shapeFrom(outline);
      if (opts.openwork) s.holes.push(shapeFrom([new THREE.Vector2(0, -H * 0.22), new THREE.Vector2(-W * 0.26, -H / 2), new THREE.Vector2(0, -H * 0.78), new THREE.Vector2(W * 0.26, -H / 2)]));
      metal = extrude(s, T, T * 0.25);
      sockets.push(new THREE.Vector2(0, -H / 2));
      ring = [new THREE.Vector2(0, -H * 0.16), new THREE.Vector2(W * 0.32, -H / 2), new THREE.Vector2(0, -H * 0.84), new THREE.Vector2(-W * 0.32, -H / 2)].slice(0, opts.ringCount);
      break;
    }
    case 'peacock': {
      // Body (teardrop) with a fan of feathers above it.
      const body = pearOutline(W * 0.42, H * 0.46).map((p) => new THREE.Vector2(p.x, p.y - H * 0.5));
      const bodyGeo = extrude(shapeFrom(body), T, T * 0.3);
      const head = applyM(sphere(H * 0.07, 14, 10), new THREE.Matrix4().makeScale(1, 1, 0.7).setPosition(0, -H * 0.46, T * 0.2));
      const fanN = 7; const fanParts: THREE.BufferGeometry[] = [];
      const fcx = 0, fcy = -H * 0.62;
      for (let i = 0; i < fanN; i++) {
        const a = Math.PI * 0.12 + (Math.PI * 0.76 * i) / (fanN - 1);
        const len = H * 0.5, fw = H * 0.17;
        const f = pearOutline(fw, len).map((p) => new THREE.Vector2(p.x, p.y));
        const geo = extrude(shapeFrom(f), T * 0.8, T * 0.25);
        // point the feather tip towards the centre, rounded end outward
        const rot = new THREE.Matrix4().makeRotationZ(a - Math.PI / 2 + Math.PI);
        const m = new THREE.Matrix4().setPosition(fcx + Math.cos(a) * H * 0.08, fcy + Math.sin(a) * H * 0.08, -T * 0.15).multiply(rot);
        fanParts.push(applyM(geo, m));
        const eye = V(fcx + Math.cos(a) * H * 0.43, fcy + Math.sin(a) * H * 0.43);
        ring.push(new THREE.Vector2(eye.x, eye.y));
      }
      metal = merge([bodyGeo, head, ...fanParts]);
      outline = [...body];
      for (let i = 0; i < 40; i++) { const a = Math.PI * 0.05 + (Math.PI * 0.9 * i) / 39; outline.push(new THREE.Vector2(fcx + Math.cos(a) * H * 0.6, fcy + Math.sin(a) * H * 0.6)); }
      sockets.push(new THREE.Vector2(0, -H * 0.72));
      cy = -H * 0.62;
      ring = ring.slice(0, Math.max(0, Math.min(fanN, opts.ringCount || fanN)));
      // shift so top of fan is at y = 0
      const top = fcy + H * 0.6;
      metal!.translate(0, -top, 0);
      outline = outline.map((p) => new THREE.Vector2(p.x, p.y - top));
      ring = ring.map((p) => new THREE.Vector2(p.x, p.y - top));
      sockets[0].y -= top; cy -= top;
      break;
    }
  }
  // drops along the bottom edge
  const bottomY = Math.min(...outline.map((p) => p.y));
  const drops = edgeAt(outline, 0, cy, spread(opts.dropCount, -Math.PI * 0.85, -Math.PI * 0.15), 0).map((p) => new THREE.Vector2(p.x, Math.max(p.y, bottomY)));
  if (opts.dropCount === 1) drops[0] = new THREE.Vector2(0, bottomY);
  return { metal: merge([metal, ...extras]) ?? metal!, outline, sockets, ring, drops, T, top: Math.max(...outline.map((p) => p.y)), cy };
}

export function plaqueAnchors(p: ReturnType<typeof plaque>, front: number): Anchor[] {
  const anchors: Anchor[] = [];
  for (const s of p.sockets) anchors.push(A('socket', V(s.x, s.y, front), UP, OUT));
  for (const s of p.ring) anchors.push(A('socket-ring', V(s.x, s.y, front * 0.8), UP, OUT));
  for (const d of p.drops) anchors.push(A('drop', V(d.x, d.y - p.T * 0.2, 0), UP, OUT));
  return anchors;
}

export function pendantBody(shape: PlaqueShape, H: number, T: number, bail: boolean, ringCount: number, dropCount: number, openwork: boolean): Built {
  const p = plaque(shape, H, T, { ringCount, dropCount, openwork });
  const parts: THREE.BufferGeometry[] = [p.metal];
  let shift = 0;
  if (bail) {
    const br = Math.max(1.6, H * 0.08), bw = Math.max(0.6, T * 0.42);
    const b = torus(br, bw / 2, 10, 26); b.rotateY(Math.PI / 2); b.translate(0, p.top + br * 0.9, 0);
    parts.push(b);
    shift = p.top + br * 1.9;
  } else shift = p.top;
  const metal = merge(parts)!; metal.translate(0, -shift, 0);
  const anchors = plaqueAnchors(p, T * 0.5).map((a) => ({ name: a.name, matrix: new THREE.Matrix4().makeTranslation(0, -shift, 0).multiply(a.matrix) }));
  return { metal, anchors };
}

// ---------------------------------------------------------------- motifs (decorative stations)
export type MotifShape = 'mango' | 'leaf' | 'floral' | 'kasu' | 'peacock' | 'lozenge' | 'bead' | 'tablet';

export function motif(shape: MotifShape, size: number, T: number, petals: number, openwork: boolean, beadMat: string): Built & { hang: boolean } {
  if (shape === 'kasu') {
    const R = size / 2;
    const coin = coinLathe(R, T);
    const lp = torus(R * 0.16, T * 0.22, 8, 18); lp.rotateY(Math.PI / 2); lp.translate(0, R + R * 0.12, 0);
    const metal = merge([coin, lp])!; metal.translate(0, -(R + R * 0.28), 0);
    return { metal, hang: true, anchors: [A('socket', V(0, -(R + R * 0.28), T * 0.5), UP, OUT), A('drop', V(0, -(2 * R + R * 0.28), 0), UP, OUT)] };
  }
  if (shape === 'bead') {
    const g = sphere(size / 2, 20, 14);
    const isStone = beadMat !== 'metal';
    return { metal: isStone ? undefined : g, stone: isStone ? g : undefined, hang: false, anchors: [A('drop', V(0, -size / 2, 0), UP, OUT)] };
  }
  if (shape === 'mango') {
    // paisley: rounded head at +X, curled tail at -X
    const L = size, W = size * 0.55;
    const pts = pearOutline(W, L).map((p) => {
      const X = -(p.y + L / 2), Y = p.x;
      const k = Math.max(0, (L / 2 - X) / L);
      return new THREE.Vector2(X, Y + 0.32 * W * Math.pow(1 - k, 3) - 0.1 * W);
    });
    const s = shapeFrom(pts);
    const metal = extrude(s, T, T * 0.32);
    const head = V(L * 0.2, 0, T * 0.5);
    return { metal, hang: false, anchors: [A('socket', head, UP, OUT), A('drop', V(L * 0.18, -W * 0.52, 0), UP, OUT), A('socket-ring', V(-L * 0.18, W * 0.02, T * 0.45), UP, OUT)] };
  }
  if (shape === 'floral') {
    const R = size / 2;
    const metal = merge([extrude(shapeFrom(flowerOutline(R, Math.max(4, petals))), T, T * 0.3), applyM(sphere(R * 0.24, 14, 10), new THREE.Matrix4().makeScale(1, 1, 0.5).setPosition(0, 0, T * 0.45))])!;
    const anchors: Anchor[] = [A('socket', V(0, 0, T * 0.55), UP, OUT), A('drop', V(0, -R * 0.98, 0), UP, OUT)];
    for (let i = 0; i < petals; i++) { const t = (i / petals) * Math.PI * 2 + Math.PI / 2; anchors.push(A('socket-ring', V(Math.cos(t) * R * 0.66, Math.sin(t) * R * 0.66, T * 0.45), UP, OUT)); }
    return { metal, hang: false, anchors };
  }
  const shp: PlaqueShape = shape === 'peacock' ? 'peacock' : shape === 'lozenge' ? 'lozenge' : shape === 'tablet' ? 'tablet' : 'leaf';
  const p = plaque(shp, size, T, { ringCount: shape === 'peacock' ? 5 : shape === 'tablet' ? 4 : 0, dropCount: 1, openwork });
  // Plaques are built top-down from y = 0; centre them, and lay leaves along X (the chain direction).
  const midY = (p.top + Math.min(...p.outline.map((q) => q.y))) / 2;
  const m = new THREE.Matrix4().makeTranslation(0, -midY, 0);
  if (shape === 'leaf') m.premultiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2));
  const metal = p.metal.clone().applyMatrix4(m);
  const anchors = plaqueAnchors(p, T * 0.5).map((a) => ({ name: a.name, matrix: m.clone().multiply(a.matrix) }));
  if (shape === 'leaf') {
    // leaf drop hangs from the outer edge (local -Y)
    for (const a of anchors) if (a.name === 'drop') a.matrix = frame(V(0, -size * 0.32, 0), UP, OUT);
  }
  return { metal, hang: false, anchors };
}

// ---------------------------------------------------------------- hanging ornaments
export function ghungroo(d: number): Built {
  const ball = sphere(d / 2, 16, 12); ball.translate(0, -d * 0.62, 0);
  const lp = torus(d * 0.16, d * 0.07, 6, 14); lp.rotateY(Math.PI / 2); lp.translate(0, -d * 0.04, 0);
  return { metal: merge([ball, lp]), anchors: [A('drop', V(0, -d * 1.12, 0), UP, OUT)] };
}

export function dropBead(d: number, mat: string): Built {
  const pear = latheZ(pearOutline(d, d * 1.5, 40).filter((p) => p.x >= 0).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y)).concat([new THREE.Vector2(0, -d * 1.5)]), 28);
  // latheZ faces +Z; we want the pear hanging along -Y, so undo the rotation.
  pear.rotateX(-Math.PI / 2);
  pear.translate(0, -d * 0.18, 0);
  const cap = torus(d * 0.14, d * 0.06, 6, 14); cap.rotateY(Math.PI / 2);
  const isStone = mat !== 'metal';
  return { metal: isStone ? cap : merge([pear, cap]), stone: isStone ? ensureOutward(prep(pear)) : undefined, anchors: [A('drop', V(0, -d * 1.7, 0), UP, OUT)] };
}

export function jhumkaBell(D: number, H: number, rimDrops: number): Built {
  const t = Math.max(0.5, D * 0.05);
  const outer: THREE.Vector2[] = [], inner: THREE.Vector2[] = [];
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const s = i / n; const y = -H * s;
    const r = (D / 2) * Math.pow(Math.sin((Math.PI / 2) * Math.min(1, s * 1.08)), 0.75) + D * 0.04;
    outer.push(new THREE.Vector2(r, y)); inner.push(new THREE.Vector2(Math.max(0.01, r - t), y + (i === n ? 0 : 0)));
  }
  const prof = [new THREE.Vector2(0, 0), ...outer.slice(1), ...inner.slice(1).reverse(), new THREE.Vector2(0, -t * 1.2)];
  const bell = new THREE.LatheGeometry(prof, 48);
  const lp = torus(D * 0.08, D * 0.03, 6, 14); lp.rotateY(Math.PI / 2); lp.translate(0, D * 0.06, 0);
  const metal = merge([ensureOutward(prep(bell)), lp])!; metal.translate(0, -D * 0.14, 0);
  const anchors: Anchor[] = [A('drop', V(0, -H * 0.82, 0), UP, OUT)];
  for (let i = 0; i < rimDrops; i++) {
    const a = (i / rimDrops) * Math.PI * 2;
    const r = (D / 2) * 1.02;
    anchors.push(A('rim', V(Math.sin(a) * r, -H - D * 0.14, Math.cos(a) * r), UP, OUT));
  }
  return { metal, anchors };
}

// ---------------------------------------------------------------- earring structures
export function earStud(shape: PlaqueShape, size: number, T: number, ringCount: number): Built {
  const p = plaque(shape, size, T, { ringCount, dropCount: 1, openwork: false });
  const midY = (p.top + Math.min(...p.outline.map((q) => q.y))) / 2;
  const m = new THREE.Matrix4().makeTranslation(0, -midY, 0);
  const metal = p.metal.clone().applyMatrix4(m);
  const anchors = plaqueAnchors(p, T * 0.5).map((a) => ({ name: a.name, matrix: m.clone().multiply(a.matrix) }));
  anchors.push(A('post', V(0, 0, -T * 0.5), UP, V(0, 0, -1)));
  return { metal, anchors };
}

export function earPost(len: number, back: boolean): Built {
  const post = cylinderZ(0.42, len, 12);
  const parts = [post];
  if (back) { const disc = latheZ([new THREE.Vector2(0, -0.5), new THREE.Vector2(3.2, -0.5), new THREE.Vector2(3.2, 0.2), new THREE.Vector2(1.2, 0.9), new THREE.Vector2(0, 0.9)], 28); disc.translate(0, 0, len * 0.7); parts.push(disc); }
  return { metal: merge(parts), anchors: [] };
}

export function hoop(D: number, wire: number, rimCount: number, stations = 0): Built {
  const R = D / 2;
  const g = torus(R, wire / 2, 10, 64); g.translate(0, -R, 0);
  const anchors: Anchor[] = [A('drop', V(0, -2 * R - wire / 2, 0), UP, OUT)];
  for (let i = 0; i < rimCount; i++) {
    const a = -Math.PI * 0.85 + (Math.PI * 0.7 * (i + 0.5)) / rimCount;
    anchors.push(A('rim', V(Math.cos(a) * (R + wire / 2), -R + Math.sin(a) * (R + wire / 2), 0), UP, OUT));
  }
  for (let i = 0; i < stations; i++) {
    // stones across the front face of the lower hoop
    const a = -Math.PI * 0.95 + (Math.PI * 0.9 * (i + 0.5)) / stations;
    const p = V(Math.cos(a) * R, -R + Math.sin(a) * R, wire / 2);
    anchors.push(A('station', p, V(-Math.sin(a), Math.cos(a), 0), OUT));
  }
  return { metal: g, anchors };
}

export function fishHook(H: number, wire: number): Built {
  const pts = [V(0, -H, 0), V(0, -H * 0.4, 0.4), V(0, 0, 1.2), V(0, H * 0.25, -H * 0.18), V(0, -H * 0.05, -H * 0.42), V(0, -H * 0.55, -H * 0.5)];
  const c = new THREE.CatmullRomCurve3(pts);
  const wireGeo = sweep(c, 80, false, ellipseSection(wire, wire, 10));
  const lp = torus(wire * 1.6, wire / 2, 8, 18); lp.rotateY(Math.PI / 2); lp.translate(0, -H - wire * 1.6, 0);
  return { metal: merge([wireGeo, lp]), anchors: [A('drop', V(0, -H - wire * 3.2, 0), UP, OUT)] };
}

// ---------------------------------------------------------------- stones & settings
export type StoneShape = 'round' | 'oval' | 'pear' | 'marquise' | 'emerald' | 'cabochon' | 'bead' | 'polki';

/** Deform a round, Z-facing geometry of radius R into the requested outline. Length runs along Y. */
export function deformOutline(g: THREE.BufferGeometry, shape: StoneShape, ratio: number, R: number): THREE.BufferGeometry {
  if (shape === 'round' || shape === 'cabochon' || shape === 'bead' || shape === 'polki') {
    if (shape === 'cabochon' && ratio !== 1) g.scale(1, ratio, 1);
    return g;
  }
  const p = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i);
    const v = THREE.MathUtils.clamp(y / R, -1, 1);
    if (shape === 'pear') x *= 1 - 0.78 * Math.pow(THREE.MathUtils.smoothstep(v, -0.25, 1), 1.3);
    if (shape === 'marquise') x *= 1 - 0.82 * Math.pow(Math.abs(v), 1.7);
    y *= ratio;
    p.setXY(i, x, y);
  }
  p.needsUpdate = true; g.computeVertexNormals();
  return g;
}

export function stone(shape: StoneShape, size: number, ratio: number): THREE.BufferGeometry {
  const R = size / 2 / (shape === 'round' || shape === 'bead' || shape === 'polki' ? 1 : Math.max(1, ratio));
  let g: THREE.BufferGeometry;
  if (shape === 'cabochon') {
    const prof: THREE.Vector2[] = [new THREE.Vector2(0, -R * 0.08), new THREE.Vector2(R, -R * 0.08)];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * (Math.PI / 2); prof.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R * 0.62)); }
    prof.push(new THREE.Vector2(0, R * 0.62));
    g = latheZ(prof, 32);
  } else if (shape === 'bead') {
    g = sphere(R, 22, 16);
  } else if (shape === 'polki') {
    // flat, uncut look: low dome with a few broad facets
    const prof = [new THREE.Vector2(0, -R * 0.12), new THREE.Vector2(R, -R * 0.06), new THREE.Vector2(R * 0.98, R * 0.06), new THREE.Vector2(R * 0.66, R * 0.17), new THREE.Vector2(0, R * 0.2)];
    const lg = new THREE.LatheGeometry(prof, 11);
    lg.rotateX(Math.PI / 2);
    g = ensureOutward(prep(lg, true));
  } else {
    const seg = shape === 'emerald' ? 8 : 16;
    const prof = [new THREE.Vector2(0, -R * 0.86), new THREE.Vector2(R, -R * 0.04), new THREE.Vector2(R, R * 0.04), new THREE.Vector2(R * 0.58, R * 0.32), new THREE.Vector2(0, R * 0.32)];
    const lg = new THREE.LatheGeometry(prof, seg);
    if (shape === 'emerald') lg.rotateY(Math.PI / 8);
    lg.rotateX(Math.PI / 2);
    g = ensureOutward(prep(lg, true));
  }
  g = deformOutline(g, shape, shape === 'round' || shape === 'bead' ? 1 : ratio, R);
  return ensureOutward(prep(g, shape !== 'cabochon' && shape !== 'bead'));
}

export type SettingKind = 'bezel' | 'prong' | 'kundan' | 'halo';

export function setting(kind: SettingKind, shape: StoneShape, size: number, ratio: number, prongs: number, height: number): Built {
  const R = size / 2 / (shape === 'round' ? 1 : Math.max(1, ratio));
  const wall = Math.max(0.35, size * 0.07);
  const ri = R * 0.9, ro = R + wall;
  const hb = height * 0.55, ht = height * 0.45;
  let g: THREE.BufferGeometry;
  if (kind === 'halo') {
    // centre prongs + a ring of small stones around it
    const hs = Math.max(0.45, R * 0.24);
    const ringR = R + wall + hs * 1.15;
    const plate = latheZ([new THREE.Vector2(R * 0.55, -hb), new THREE.Vector2(ringR + hs * 1.15, -hb * 0.6), new THREE.Vector2(ringR + hs * 1.15, ht * 0.1), new THREE.Vector2(ringR - hs * 1.2, ht * 0.25), new THREE.Vector2(R * 0.55, -hb + wall)], 48);
    const pr = Math.max(0.3, size * 0.06);
    const parts = [plate];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const bottom = V(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, -hb * 0.5), topP = V(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, ht + R * 0.2);
      parts.push(sweep(new THREE.LineCurve3(bottom, topP), 2, false, ellipseSection(pr * 2, pr * 2, 8)), applyM(sphere(pr * 1.15, 8, 6), new THREE.Matrix4().setPosition(topP)));
    }
    let gg = merge(parts)!;
    gg = deformOutline(gg, shape, shape === 'round' ? 1 : ratio, R);
    const n = Math.max(8, Math.round((Math.PI * 2 * ringR) / (hs * 2.25)));
    const anchors: Anchor[] = [A('stone', V(0, 0, ht * 0.75), UP, OUT)];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const p = new THREE.Vector3(Math.cos(a) * ringR, Math.sin(a) * ringR, ht * 0.25);
      if (shape !== 'round') { p.y *= ratio; if (shape === 'marquise' || shape === 'pear') p.x *= 1 - 0.5 * Math.pow(Math.abs(Math.sin(a)), 2); }
      anchors.push(A('socket-ring', p, UP, OUT));
    }
    return { metal: ensureOutward(prep(gg)), anchors };
  }
  if (kind === 'kundan') {
    g = latheZ([new THREE.Vector2(0, -hb), new THREE.Vector2(ro, -hb), new THREE.Vector2(ro, ht), new THREE.Vector2(ri, ht), new THREE.Vector2(ri, -hb + 0.4), new THREE.Vector2(0, -hb + 0.4)], 40);
  } else if (kind === 'bezel') {
    g = latheZ([new THREE.Vector2(ri, -hb), new THREE.Vector2(ro, -hb), new THREE.Vector2(ro, ht), new THREE.Vector2(ri, ht), new THREE.Vector2(ri, -hb)], 40);
  } else {
    const base = latheZ([new THREE.Vector2(R * 0.55, -hb), new THREE.Vector2(R * 0.55 + wall, -hb), new THREE.Vector2(R * 0.55 + wall, -hb + wall * 1.4), new THREE.Vector2(R * 0.55, -hb + wall * 1.4), new THREE.Vector2(R * 0.55, -hb)], 32);
    const parts = [base];
    const pr = Math.max(0.3, size * 0.06);
    for (let i = 0; i < prongs; i++) {
      const a = (i / prongs) * Math.PI * 2 + Math.PI / prongs;
      const bottom = V(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, -hb);
      const topP = V(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98, ht + R * 0.18);
      const c = new THREE.LineCurve3(bottom, topP);
      parts.push(sweep(c, 2, false, ellipseSection(pr * 2, pr * 2, 8)));
      parts.push(applyM(sphere(pr * 1.15, 8, 6), new THREE.Matrix4().setPosition(topP)));
    }
    g = merge(parts)!;
  }
  g = deformOutline(g, shape, shape === 'round' ? 1 : ratio, R);
  return { metal: ensureOutward(prep(g)), anchors: [A('stone', V(0, 0, kind === 'prong' ? ht * 0.7 : ht * 0.25), UP, OUT)] };
}

export type ClaspStyle = 'lobster' | 's-hook' | 'screw';
export function clasp(style: ClaspStyle, size: number): Built {
  let metal: THREE.BufferGeometry | undefined;
  if (style === 'lobster') {
    const body = sphere(size / 2, 16, 12); body.scale(0.55, 1, 0.42); body.translate(0, -size * 0.6, 0);
    const ring = torus(size * 0.2, size * 0.06, 8, 18); ring.rotateY(Math.PI / 2);
    metal = merge([body, ring]);
  } else if (style === 's-hook') {
    const pts = [V(0, 0.2 * size), V(0.35 * size, 0), V(0, -0.35 * size), V(-0.35 * size, -0.7 * size), V(0, -1.05 * size), V(0.3 * size, -0.9 * size)];
    metal = sweep(new THREE.CatmullRomCurve3(pts), 60, false, ellipseSection(size * 0.14, size * 0.14, 10));
  } else {
    const a = new THREE.CylinderGeometry(size * 0.18, size * 0.18, size * 0.6, 16); a.translate(0, -size * 0.3, 0);
    const b = new THREE.CylinderGeometry(size * 0.15, size * 0.15, size * 0.5, 16); b.translate(0, -size * 0.8, 0);
    metal = merge([ensureOutward(a), ensureOutward(b)]);
  }
  return { metal, anchors: [] };
}
