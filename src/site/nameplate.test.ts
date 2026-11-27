import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import opentype from 'opentype.js';
import { nameShapes, shapesArea, nameWeight, cleanName } from './nameplate';
const load = (p: string) => { const b = readFileSync(p); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
describe('name pendant', () => {
  it('turns a name into solid shapes with holes and a sane weight', () => {
    for (const f of ['node_modules/@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff', 'node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff']) {
      const font = load(f);
      const r = nameShapes(font, 'Sujan', 34);
      expect(r.shapes.length).toBeGreaterThan(0);
      expect(r.w).toBeLessThanOrEqual(34.01);
      const a = shapesArea(r.shapes);
      const g = nameWeight(a, 1.0, '22k-yellow');
      console.log(f.split('/').pop(), 'shapes', r.shapes.length, 'holes', r.shapes.reduce((n, s) => n + s.holes.length, 0), 'w', r.w.toFixed(1), 'h', r.h.toFixed(1), 'area', a.toFixed(0), 'g', g.toFixed(2));
      expect(g).toBeGreaterThan(0.8); expect(g).toBeLessThan(12);
    }
    expect(cleanName('  Su@jan123  Kumar!!')).toBe('Sujan Kumar');
  });
});

import { buildPendant, PENDANT_DESIGNS } from './pendantDesigns';
describe('pendant designs', () => {
  it('builds every design with a sane weight and no broken geometry', () => {
    const script = load('node_modules/@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff');
    const classic = load('node_modules/@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff');
    for (const d of PENDANT_DESIGNS) {
      const font = d.id === 'disc' || d.id === 'bar' ? classic : script;
      const b = buildPendant(d.id, font, script, 'Sujan', 'Sita', 34, 1.0, '22k-yellow');
      const pos = b.metal.attributes.position.array as Float32Array;
      expect(pos.length).toBeGreaterThan(300);
      expect(Array.from(pos).every(Number.isFinite)).toBe(true);
      console.log(d.id.padEnd(10), 'g', b.grams.toFixed(2), 'size', b.w.toFixed(0), 'x', b.h.toFixed(0));
      expect(b.grams).toBeGreaterThan(0.4); expect(b.grams).toBeLessThan(15);
    }
  });
});
