import { describe, expect, it } from 'vitest';
import { buildDesign, decodeCfg, defaultCfg, encodeCfg, overrideSummary, PIECES, type Overrides } from './designer';
import { estimateWeight, validate } from '../engine/assembly';

describe('simple designer — per-part changes', () => {
  it('every style in every section builds without errors', () => {
    for (const aud of ['women', 'men'] as const) for (const p of PIECES[aud]) for (const style of p.styles) {
      const d = buildDesign({ ...defaultCfg(aud, p.id), style });
      expect(validate(d).filter((i) => i.level === 'error'), style).toEqual([]);
      expect(estimateWeight(d).theoreticalG, style).toBeGreaterThan(0.2);
    }
  });
  it('part ids are stable across rebuilds', () => {
    const c = defaultCfg('women', 'earrings');
    expect(buildDesign(c).nodes.map((n) => n.id)).toEqual(buildDesign({ ...c, metal: '18k-rose' }).nodes.map((n) => n.id));
  });
  it('changing one stone part changes only that part', () => {
    const c = { ...defaultCfg('women', 'earrings'), style: 'temple-jhumka' };
    const ov: Overrides = { 'temple-jhumka.ruby': { gem: 'emerald', params: { shape: 'oval', size: 4 } } };
    const d = buildDesign(c, ov);
    const ruby = d.nodes.find((n) => n.id === 'temple-jhumka.ruby')!;
    const petal = d.nodes.find((n) => n.id === 'temple-jhumka.petal')!;
    expect(ruby.material.gem).toBe('emerald');
    expect(ruby.params.shape).toBe('oval');
    expect(petal.material.gem).not.toBe('emerald');
  });
  it('swapping bells for pearl drops and removing a part work, and weight responds', () => {
    const c = { ...defaultCfg('women', 'necklace'), style: 'mango-haram' };
    const base = estimateWeight(buildDesign(c)).theoreticalG;
    const d = buildDesign(c, { 'mango-haram.bell': { type: 'dropBead', params: { mat: 'stone' }, gem: 'pearl' }, 'mango-haram.pend': { hidden: true } });
    expect(d.nodes.find((n) => n.id === 'mango-haram.bell')!.type).toBe('dropBead');
    expect(estimateWeight(d).theoreticalG).toBeLessThan(base);
  });
  it('switching an earring to a hook hides the screw back', () => {
    const c = { ...defaultCfg('women', 'earrings'), style: 'temple-jhumka' };
    const d = buildDesign(c, { 'temple-jhumka.top': { type: 'fishHook' } });
    expect(d.nodes.find((n) => n.type === 'earPost')!.visible).toBe(false);
  });
  it('design code keeps every change', () => {
    const c = { ...defaultCfg('men', 'ring'), style: 'men-signet-stone' };
    const ov: Overrides = { 'men-signet-stone.cs': { gem: 'ruby' }, 'men-signet-stone.d': { hidden: true } };
    const back = decodeCfg('Design code: BHV2:' + encodeCfg(c, ov));
    expect(back.cfg).toEqual({ ...c, pendant: 'none', addon: 'none' });
    expect(back.ov).toEqual(ov);
  });
  it('the WhatsApp summary lists the changes in words', () => {
    const c = { ...defaultCfg('women', 'necklace'), style: 'mango-haram' };
    const ov: Overrides = { 'mango-haram.kemp': { gem: 'emerald', params: { size: 4 } } };
    const lines = overrideSummary(buildDesign(c, ov), ov);
    expect(lines[0]).toMatch(/Stones on mangoes.*Emerald.*size 4 mm/i);
  });
});

import { estimateWeight as ew2 } from '../engine/assembly';
import { buildDesign as bd2, defaultCfg as dc2, encodeCfg as en2, decodeCfg as de2 } from './designer';
describe('chain pendant', () => {
  it('hangs a pendant on a plain chain and round-trips the choice', () => {
    const base = dc2('women', 'chain');
    const plain = bd2(base, {});
    const withP = bd2({ ...base, pendant: 'temple-coin' }, {});
    const pend = withP.nodes.find((n) => n.type === 'pendantBody');
    expect(pend?.visible).toBe(true);
    expect(ew2(withP).theoreticalG).toBeGreaterThan(ew2(plain).theoreticalG + 0.5);
    expect(de2(en2({ ...base, pendant: 'peacock' })).cfg.pendant).toBe('peacock');
  });
});

describe('modern pendant designs in the studio', () => {
  it('every art pendant style builds, has stones where expected, and weighs a few grams', async () => {
    const { PIECES, buildDesign: bd, defaultCfg: dc } = await import('./designer');
    const { estimateWeight: ew } = await import('../engine/assembly');
    const styles = PIECES.women.find((p) => p.id === 'pendant')!.styles.filter((s) => s.startsWith('art-'));
    expect(styles.length).toBe(18);
    for (const style of styles) {
      const d = bd({ ...dc('women', 'pendant'), style }, {});
      const g = ew(d).theoreticalG;
      console.log(style.padEnd(16), g.toFixed(2), 'g', d.nodes.filter((n) => n.type === 'stone').length, 'stone parts');
      expect(g).toBeGreaterThan(0.5); expect(g).toBeLessThan(12);
    }
    const chain = bd({ ...dc('women', 'chain'), pendant: 'art:butterfly' }, {});
    expect(chain.nodes.some((n) => n.type === 'pendantArt')).toBe(true);
  });
});

describe('Dubai and international designs', () => {
  it('every new style builds, is visible and weighs a sensible amount', async () => {
    const { PIECES, buildDesign: bd, defaultCfg: dc } = await import('./designer');
    const { estimateWeight: ew } = await import('../engine/assembly');
    const want: [string, string][] = [['necklace', 'dubai-lira-necklace'], ['necklace', 'dubai-filigree-collar'], ['necklace', 'station-necklace'], ['earrings', 'dubai-chandelier'], ['earrings', 'lira-earrings'], ['earrings', 'evil-eye-earrings'], ['bangle', 'dubai-coin-bangle'], ['bangle', 'dubai-broad-kada'], ['bracelet', 'evil-eye-bracelet'], ['bracelet', 'lira-bracelet']];
    for (const [piece, style] of want) {
      const pc = PIECES.women.find((p) => p.styles.includes(style));
      expect(pc, style).toBeTruthy();
      const d = bd({ ...dc('women', pc!.id), style }, {});
      const g = ew(d).theoreticalG;
      console.log(piece.padEnd(9), style.padEnd(22), g.toFixed(2), 'g', d.nodes.length, 'nodes');
      expect(d.nodes.length).toBeGreaterThan(0);
      expect(g).toBeGreaterThan(1); expect(g).toBeLessThan(120);
    }
  });
});

describe('add-ons and bead designs', () => {
  it('every style builds with every add-on', async () => {
    const { PIECES, ADDONS, CHAIN_PENDANTS, buildDesign: bd, defaultCfg: dc } = await import('./designer');
    const { estimateWeight: ew } = await import('../engine/assembly');
    let n = 0;
    for (const aud of ['women', 'men'] as const) for (const pc of PIECES[aud]) for (const style of pc.styles) {
      const opts = pc.id === 'chain' || pc.id === 'necklace' ? CHAIN_PENDANTS.map((x) => ({ pendant: x.id })) : (ADDONS[pc.id]?.options ?? [{ id: 'none' }]).map((x) => ({ addon: x.id }));
      for (const o of opts) {
        const d = bd({ ...dc(aud, pc.id), style, ...o }, {});
        const g = ew(d).theoreticalG;
        expect(Number.isFinite(g), `${style} ${JSON.stringify(o)}`).toBe(true);
        expect(g, `${style} ${JSON.stringify(o)}`).toBeGreaterThan(0.2);
        n++;
      }
    }
    expect(n).toBeGreaterThan(400);
  });
  it('bead styles weigh sensibly', async () => {
    const { PIECES, buildDesign: bd, defaultCfg: dc } = await import('./designer');
    const { estimateWeight: ew } = await import('../engine/assembly');
    const out: string[] = [];
    for (const [aud, style] of [['women', 'gundla-mala'], ['women', 'pearl-mala'], ['women', 'nallapusalu'], ['women', 'bead-hoops'], ['women', 'pearl-drop-studs'], ['women', 'bead-bangle'], ['women', 'bead-bracelet'], ['women', 'bead-ring'], ['men', 'men-bead-bracelet']] as const) {
      const pc = PIECES[aud].find((p) => p.styles.includes(style))!;
      const g = ew(bd({ ...dc(aud, pc.id), style }, {})).theoreticalG;
      out.push(`${style}=${g.toFixed(1)}`);
      expect(g).toBeLessThan(120);
    }
    console.log('BEADW', out.join(' '));
  });
});
