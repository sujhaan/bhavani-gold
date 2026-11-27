import * as THREE from 'three';
import opentype from 'opentype.js';
import { METALS, type MetalId } from '../engine/materials';

export type NameStyle = 'script' | 'classic';
export type NameCfg = { text: string; style: NameStyle; metal: MetalId; thick: number; width: number };

export const NAME_METALS: MetalId[] = ['22k-yellow', '18k-rose', '18k-white'];
export const NAME_THICK = [{ label: 'Light', mm: 0.7 }, { label: 'Regular', mm: 1.0 }, { label: 'Bold', mm: 1.4 }];
export const NAME_WIDTH = [{ label: 'Petite', mm: 26 }, { label: 'Classic', mm: 34 }, { label: 'Statement', mm: 44 }];

/** Keep names to what a goldsmith can saw cleanly: letters, space, hyphen, apostrophe, up to 12 characters. */
export function cleanName(s: string): string {
  return s.replace(/[^A-Za-z '\-]/g, '').replace(/\s+/g, ' ').replace(/^\s+/, '').slice(0, 12);
}

/** Decode a base64 data URL (fonts are inlined in the bundle, so no network fetch is needed). */
export function fontFromDataUrl(url: string): opentype.Font {
  const b64 = url.slice(url.indexOf(',') + 1);
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return opentype.parse(buf.buffer);
}

/** Glyph outlines → THREE shapes in millimetres, scaled so the whole name spans `widthMm` (height capped). */
export function nameShapes(font: opentype.Font, text: string, widthMm: number, maxHeightMm = 14): { shapes: THREE.Shape[]; w: number; h: number; base: number } {
  // lay glyphs out ourselves: opentype's shaper trips on some GSUB tables in these fonts
  const scale = 100 / font.unitsPerEm;
  const path = { commands: [] as any[] };
  let x = 0, prev: opentype.Glyph | null = null;
  for (const ch of (text || ' ')) {
    const g = font.charToGlyph(ch);
    if (prev) x += font.getKerningValue(prev, g) * scale;
    path.commands.push(...g.getPath(x, 0, 100).commands);
    x += (g.advanceWidth ?? 0) * scale; prev = g;
  }
  const sp = new THREE.ShapePath();
  for (const c of path.commands as any[]) {
    if (c.type === 'M') sp.moveTo(c.x, -c.y);
    else if (c.type === 'L') sp.lineTo(c.x, -c.y);
    else if (c.type === 'Q') sp.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
    else if (c.type === 'C') sp.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
  }
  // opentype outlines are clockwise in screen space; after flipping y the outer contours run counter-clockwise
  let shapes = sp.toShapes(true);
  if (!shapes.length) return { shapes: [], w: 0, h: 0, base: 0 };
  const box = new THREE.Box2();
  shapes.forEach((s) => s.getPoints(6).forEach((p) => box.expandByPoint(p)));
  const size = box.getSize(new THREE.Vector2());
  const k = Math.min(widthMm / size.x, maxHeightMm / size.y);
  const cx = (box.min.x + box.max.x) / 2, cy = (box.min.y + box.max.y) / 2;
  const m = new THREE.Matrix3().set(k, 0, -cx * k, 0, k, -cy * k, 0, 0, 1);
  const tx = (v: THREE.Vector2) => v.applyMatrix3(m);
  shapes = shapes.map((s) => {
    const o = new THREE.Shape(s.getPoints(10).map((p) => tx(p.clone())));
    o.holes = s.holes.map((hp) => new THREE.Path(hp.getPoints(10).map((p) => tx(p.clone()))));
    return o;
  });
  return { shapes, w: size.x * k, h: size.y * k, base: -cy * k };
}

/** Net area of shapes in mm² (outer minus holes). */
export function shapesArea(shapes: THREE.Shape[]): number {
  let a = 0;
  for (const s of shapes) {
    a += Math.abs(THREE.ShapeUtils.area(s.getPoints()));
    for (const h of s.holes) a -= Math.abs(THREE.ShapeUtils.area(h.getPoints()));
  }
  return Math.max(0, a);
}

/** Estimated gold weight in grams: plate + the two jump rings (chain not included). */
export function nameWeight(areaMm2: number, thickMm: number, metal: MetalId): number {
  const ringMm3 = 2 * (2 * Math.PI * 1.6) * (Math.PI * 0.45 * 0.45);
  return ((areaMm2 * thickMm) + ringMm3) * METALS[metal].density / 1000;
}
