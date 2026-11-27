// Low-level geometry helpers. All units are millimetres.
import * as THREE from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Signed volume (mm³) of a closed triangle mesh via the divergence theorem. */
export function signedVolume(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const idx = g.getIndex();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let v = 0;
  const tri = (i: number, j: number, k: number) => {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, j); c.fromBufferAttribute(pos, k);
    v += a.dot(b.clone().cross(c)) / 6;
  };
  if (idx) for (let i = 0; i < idx.count; i += 3) tri(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  else for (let i = 0; i < pos.count; i += 3) tri(i, i + 1, i + 2);
  return v;
}

export function volume(g?: THREE.BufferGeometry | null): number {
  return g ? Math.abs(signedVolume(g)) : 0;
}

/** Flip triangle winding so normals face outward (positive volume). */
export function ensureOutward(g: THREE.BufferGeometry): THREE.BufferGeometry {
  if (signedVolume(g) >= 0) return g;
  const idx = g.getIndex();
  if (idx) {
    const arr = idx.array as Uint32Array | Uint16Array;
    for (let i = 0; i < arr.length; i += 3) { const t = arr[i + 1]; arr[i + 1] = arr[i + 2]; arr[i + 2] = t; }
    idx.needsUpdate = true;
  } else {
    const swap = (attr: THREE.BufferAttribute) => {
      for (let i = 0; i < attr.count; i += 3) {
        const x = attr.getX(i + 1), y = attr.getY(i + 1), z = attr.getZ(i + 1);
        attr.setXYZ(i + 1, attr.getX(i + 2), attr.getY(i + 2), attr.getZ(i + 2));
        attr.setXYZ(i + 2, x, y, z);
      }
      attr.needsUpdate = true;
    };
    swap(g.getAttribute('position') as THREE.BufferAttribute);
    g.deleteAttribute('normal');
    // smooth shading with sharp creases kept (rims, edges)
    return toCreasedNormals(g, Math.PI / 5);
  }
  g.computeVertexNormals();
  return g;
}

/** Normalise a geometry to non-indexed position+normal so it can be merged with others. */
export function prep(g: THREE.BufferGeometry, flat = false): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(out.attributes)) if (k !== 'position' && k !== 'normal') out.deleteAttribute(k);
  if (flat || !out.getAttribute('normal')) out.computeVertexNormals();
  return out;
}

export function merge(parts: (THREE.BufferGeometry | null | undefined)[], flat = false): THREE.BufferGeometry | undefined {
  const list = parts.filter(Boolean).map((g) => prep(g as THREE.BufferGeometry, flat));
  if (!list.length) return undefined;
  if (list.length === 1) return list[0];
  return mergeGeometries(list, false) ?? undefined;
}

/** Build a transform matrix from an origin and the desired local Y (up) and Z (out/front) axes. */
export function frame(pos: THREE.Vector3, up: THREE.Vector3, out: THREE.Vector3): THREE.Matrix4 {
  const z = out.clone().normalize();
  const y = up.clone().sub(z.clone().multiplyScalar(up.dot(z)));
  if (y.lengthSq() < 1e-9) y.set(0, 1, 0).sub(z.clone().multiplyScalar(z.y));
  y.normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos);
}

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- cross sections (closed convex polygons, CCW) ----------
export function ellipseSection(w: number, h: number, n = 14): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) { const t = (i / n) * Math.PI * 2; pts.push(new THREE.Vector2((Math.cos(t) * w) / 2, (Math.sin(t) * h) / 2)); }
  return pts;
}

/** Superellipse: e=2 ellipse, larger e = squarer. */
export function superSection(w: number, h: number, e: number, n = 20): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2; const c = Math.cos(t), s = Math.sin(t);
    pts.push(new THREE.Vector2(Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * w / 2, Math.sign(s) * Math.pow(Math.abs(s), 2 / e) * h / 2));
  }
  return pts;
}

/** Band profile. x = radial (positive = inward towards finger), y = width. */
export function profileSection(profile: string, thick: number, width: number): THREE.Vector2[] {
  switch (profile) {
    case 'flat': return superSection(thick, width, 7, 24);
    case 'court': return superSection(thick, width, 2.6, 24);
    case 'knife': {
      return [new THREE.Vector2(thick / 2, -width / 2), new THREE.Vector2(thick / 2, width / 2), new THREE.Vector2(-thick * 0.1, width * 0.18), new THREE.Vector2(-thick / 2, 0), new THREE.Vector2(-thick * 0.1, -width * 0.18)];
    }
    case 'half-round': default: {
      // D shape: flat inside (x = +thick/2), round outside.
      const pts: THREE.Vector2[] = [];
      const n = 14;
      pts.push(new THREE.Vector2(thick / 2, -width / 2));
      pts.push(new THREE.Vector2(thick / 2, width / 2));
      for (let i = 1; i < n; i++) {
        const t = Math.PI / 2 + (i / n) * Math.PI;
        pts.push(new THREE.Vector2(thick / 2 + Math.cos(t) * thick, (Math.sin(t) * width) / 2));
      }
      return pts;
    }
  }
}

// ---------- sweep ----------
export type SweepMod = (t: number) => { sx?: number; sy?: number; rot?: number };

/** Sweep a closed convex section along a curve. Closed curves give a torus-like solid, open ones get end caps. */
export function sweep(curve: THREE.Curve<THREE.Vector3>, segments: number, closed: boolean, section: THREE.Vector2[], mod?: SweepMod): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(segments, closed);
  const ring = section.length;
  const rows = closed ? segments : segments + 1;
  const pos: number[] = [];
  const P = new THREE.Vector3();
  for (let i = 0; i < rows; i++) {
    const t = i / segments;
    curve.getPointAt(Math.min(t, 1), P);
    const N = frames.normals[i], B = frames.binormals[i];
    const m = mod ? mod(t) : {};
    const sx = m.sx ?? 1, sy = m.sy ?? 1, r = m.rot ?? 0;
    const cr = Math.cos(r), sr = Math.sin(r);
    for (let j = 0; j < ring; j++) {
      const px = section[j].x * sx, py = section[j].y * sy;
      const x = px * cr - py * sr, y = px * sr + py * cr;
      pos.push(P.x + N.x * x + B.x * y, P.y + N.y * x + B.y * y, P.z + N.z * x + B.z * y);
    }
  }
  const idx: number[] = [];
  const last = closed ? rows : rows - 1;
  for (let i = 0; i < last; i++) {
    const i2 = (i + 1) % rows;
    for (let j = 0; j < ring; j++) {
      const j2 = (j + 1) % ring;
      const a = i * ring + j, b = i2 * ring + j, c = i2 * ring + j2, d = i * ring + j2;
      idx.push(a, b, d, b, c, d);
    }
  }
  if (!closed) {
    const s0 = pos.length / 3; curve.getPointAt(0, P); pos.push(P.x, P.y, P.z);
    const s1 = pos.length / 3; curve.getPointAt(1, P); pos.push(P.x, P.y, P.z);
    const lastRow = (rows - 1) * ring;
    for (let j = 0; j < ring; j++) {
      const j2 = (j + 1) % ring;
      idx.push(s0, j2, j);
      idx.push(s1, lastRow + j, lastRow + j2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return ensureOutward(g);
}

/** Circle curve in the XY plane (axis Z). */
export class CircleCurve extends THREE.Curve<THREE.Vector3> {
  r: number;
  constructor(r: number) { super(); this.r = r; }
  getPoint(t: number, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    return target.set(Math.sin(a) * this.r, Math.cos(a) * this.r, 0);
  }
}

/** Extrude a 2D shape centred on z = 0, facing +Z. */
export function extrude(shape: THREE.Shape, depth: number, bevel = 0.25, curveSegments = 24): THREE.BufferGeometry {
  const b = Math.min(bevel, depth * 0.45);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(depth - 2 * b, 0.05), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b * 0.8, bevelSegments: 3, curveSegments,
  });
  g.translate(0, 0, -depth / 2 + b);
  const o = ensureOutward(g);
  for (const k of Object.keys(o.attributes)) if (k !== 'position') o.deleteAttribute(k);
  return toCreasedNormals(o.index ? o.toNonIndexed() : o, Math.PI / 4.5);
}

/** Revolve a closed profile (x = radius, y = height) around Y, then turn it to face +Z. */
export function latheZ(profile: THREE.Vector2[], segments = 48): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile, segments);
  g.rotateX(Math.PI / 2);
  return ensureOutward(prep(g));
}

export function torus(R: number, r: number, radial = 10, tubular = 28): THREE.BufferGeometry {
  return ensureOutward(new THREE.TorusGeometry(R, r, radial, tubular));
}

export function sphere(r: number, w = 16, h = 12): THREE.BufferGeometry {
  return ensureOutward(new THREE.SphereGeometry(r, w, h));
}

export function cylinderZ(r: number, len: number, seg = 16): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(0, 0, len / 2);
  return ensureOutward(g);
}

export function applyM(g: THREE.BufferGeometry, m: THREE.Matrix4): THREE.BufferGeometry {
  const c = g.clone(); c.applyMatrix4(m); return c;
}

export function polarShape(fn: (t: number) => number, n = 120): THREE.Shape {
  const s = new THREE.Shape();
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * Math.PI * 2; const r = fn(t);
    const x = Math.cos(t) * r, y = Math.sin(t) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  return s;
}
