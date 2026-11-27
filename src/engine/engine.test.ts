import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { signedVolume, sphere, torus, sweep, CircleCurve, ellipseSection } from './geo';
import { buildComponent, COMPONENTS, defaultParams } from './components';
import { estimateWeight, placements, validate, compatibleAnchors, designBounds } from './assembly';
import { TEMPLATES, instantiate, emptyDesign } from './templates';
import { ringInnerDiameter } from './shapes';
import { encodeDesign, decodeDesign, whatsappMessage } from './share';

describe('geometry volumes', () => {
  it('sphere volume matches 4/3πr³ within 2%', () => {
    const v = signedVolume(sphere(5, 64, 48));
    expect(v).toBeGreaterThan(0);
    expect(Math.abs(v - (4 / 3) * Math.PI * 125) / ((4 / 3) * Math.PI * 125)).toBeLessThan(0.02);
  });
  it('torus volume matches 2π²Rr² within 2%', () => {
    const v = signedVolume(torus(10, 2, 48, 96));
    const exact = 2 * Math.PI * Math.PI * 10 * 4;
    expect(Math.abs(v - exact) / exact).toBeLessThan(0.02);
  });
  it('a swept circle around a circle is a closed outward solid (≈ torus)', () => {
    const v = signedVolume(sweep(new CircleCurve(10), 128, true, ellipseSection(4, 4, 48)));
    const exact = 2 * Math.PI * Math.PI * 10 * 4;
    expect(v).toBeGreaterThan(0);
    expect(Math.abs(v - exact) / exact).toBeLessThan(0.03);
  });
});

describe('component library', () => {
  it('every component builds with default parameters and produces positive volume', () => {
    for (const c of COMPONENTS) {
      const b = buildComponent(c.type, defaultParams(c.type));
      const g = b.metal ?? b.stone;
      expect(g, c.type).toBeTruthy();
      expect(Math.abs(signedVolume(g!)), c.type).toBeGreaterThan(0);
      for (const a of b.anchors) expect(Number.isFinite(a.matrix.elements[12]), `${c.type}:${a.name}`).toBe(true);
    }
  });
  it('ring band inner diameter follows the size table', () => {
    expect(ringInnerDiameter(12)).toBeCloseTo(16.67, 1);
    const box = new THREE.Box3().setFromBufferAttribute(buildComponent('ringBand', { ...defaultParams('ringBand'), size: 12, thickness: 2 }).metal!.getAttribute('position') as THREE.BufferAttribute);
    expect(box.max.y * 2).toBeCloseTo(ringInnerDiameter(12) + 4, 0);
  });
  it('changing a parameter changes the geometry', () => {
    const a = signedVolume(buildComponent('ringBand', { ...defaultParams('ringBand'), width: 2 }).metal!);
    const b = signedVolume(buildComponent('ringBand', { ...defaultParams('ringBand'), width: 4 }).metal!);
    expect(b).toBeGreaterThan(a * 1.6);
  });
  it('necklace station count controls the number of station anchors', () => {
    const b = buildComponent('necklaceBase', { ...defaultParams('necklaceBase'), stations: 20, gap: 0 });
    expect(b.anchors.filter((x) => x.name === 'station').length).toBe(20);
  });
});

describe('templates and assembly', () => {
  it('all templates instantiate, validate without errors and weigh something', () => {
    for (const t of TEMPLATES) {
      const d = instantiate(t);
      const errors = validate(d).filter((i) => i.level === 'error');
      expect(errors, t.id + JSON.stringify(errors)).toEqual([]);
      const w = estimateWeight(d);
      expect(w.theoreticalG, t.id).toBeGreaterThan(0.2);
      expect(w.estimatedG).toBeGreaterThan(w.theoreticalG);
      expect(designBounds(d).isEmpty()).toBe(false);
    }
  });
  it('"all" attachment places one copy per anchor', () => {
    const d = instantiate(TEMPLATES.find((t) => t.id === 'mango-haram')!);
    const pl = placements(d);
    const base = d.nodes.find((n) => n.type === 'necklaceBase')!;
    const mango = d.nodes.find((n) => n.type === 'motif-mango')!;
    const bells = d.nodes.find((n) => n.type === 'ghungroo' && n.attach?.parent === mango.id)!;
    expect(pl.get(mango.id)!.length).toBe(Number(base.params.stations));
    expect(pl.get(bells.id)!.length).toBe(pl.get(mango.id)!.length);
  });
  it('earring pairs double the weight', () => {
    const d = instantiate(TEMPLATES.find((t) => t.id === 'floral-stud')!);
    const pairW = estimateWeight(d).theoreticalG;
    const single = estimateWeight({ ...d, pair: false }).theoreticalG;
    expect(pairW).toBeCloseTo(single * 2, 5);
  });
  it('22K plain kada weight is in a realistic range', () => {
    const w = estimateWeight(instantiate(TEMPLATES.find((t) => t.id === 'plain-kada')!)).theoreticalG;
    expect(w).toBeGreaterThan(15);
    expect(w).toBeLessThan(60);
  });
  it('density drives weight: 24K weighs more than 18K for the same geometry', () => {
    const d = instantiate(TEMPLATES.find((t) => t.id === 'plain-band')!);
    const w24 = estimateWeight({ ...d, nodes: d.nodes.map((n) => ({ ...n, material: { ...n.material, metal: '24k-yellow' as const } })) }).theoreticalG;
    const w18 = estimateWeight({ ...d, nodes: d.nodes.map((n) => ({ ...n, material: { ...n.material, metal: '18k-yellow' as const } })) }).theoreticalG;
    expect(w24 / w18).toBeCloseTo(19.32 / 15.5, 3);
  });
  it('rejects invalid connections with a readable message', () => {
    const d = instantiate(TEMPLATES.find((t) => t.id === 'solitaire')!);
    const band = d.nodes.find((n) => n.type === 'ringBand')!;
    d.nodes.push({ ...d.nodes[0], id: 'bad', type: 'earPost', name: 'Ear post', attach: { parent: band.id, anchor: 'top', all: false } });
    const errs = validate(d).filter((i) => i.nodeId === 'bad');
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[0].text).toMatch(/can't sit on/);
  });
  it('lists compatible anchors for a part', () => {
    const d = instantiate(TEMPLATES.find((t) => t.id === 'mango-haram')!);
    const base = d.nodes.find((n) => n.type === 'necklaceBase')!;
    expect(compatibleAnchors('pendantBody', base)).toContain('center');
    expect(compatibleAnchors('stone', base)).toEqual([]);
  });
  it('flags a stone that does not fit its setting', () => {
    const d = instantiate(TEMPLATES.find((t) => t.id === 'solitaire')!);
    const st = d.nodes.find((n) => n.type === 'stone')!;
    st.params.size = 8;
    expect(validate(d).some((i) => i.nodeId === st.id && /setting is made for/.test(i.text))).toBe(true);
  });
  it('an empty design asks for a base', () => {
    expect(validate(emptyDesign('rings'))[0].text).toMatch(/base structure/);
  });
});

describe('sharing', () => {
  it('a design survives encode → decode exactly', async () => {
    const d = instantiate(TEMPLATES[0]);
    const code = await encodeDesign(d);
    const back = await decodeDesign(code);
    expect(back.nodes).toEqual(d.nodes);
    expect(back.id).toBe(d.id);
    expect(estimateWeight(back).theoreticalG).toBeCloseTo(estimateWeight(d).theoreticalG, 6);
  });
  it('builds a WhatsApp message with the design ID and the asked-for items, without prices', () => {
    const d = instantiate(TEMPLATES[0]);
    const msg = whatsappMessage(d, estimateWeight(d), { name: 'Ravi', requests: ['Making charges', 'Delivery estimate'], notes: 'Lighter if possible', code: 'XYZ' });
    expect(msg).toContain(d.id);
    expect(msg).toContain('Making charges');
    expect(msg).toContain('XYZ');
    expect(msg).not.toMatch(/₹/);
  });
});
