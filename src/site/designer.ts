// Simple designer: a handful of plain choices that build a full parametric design underneath.
import { instantiate, TEMPLATES } from '../engine/templates';
import { COMPONENT_MAP, defaultParams } from '../engine/components';
import { GEMS } from '../engine/materials';
import type { Design, DesignNode, ParamValue } from '../engine/schema';
import type { GemId, MetalId } from '../engine/materials';

export type Audience = 'women' | 'men';
export type Piece = 'necklace' | 'earrings' | 'bangle' | 'ring' | 'pendant' | 'chain' | 'bracelet';
export type StoneChoice = GemId | 'kemp' | 'none';
export type MetalChoice = '22k-yellow' | '18k-yellow' | '18k-rose' | '18k-white';

export interface Cfg { audience: Audience; piece: Piece; style: string; metal: MetalChoice; finish: 'polished' | 'antique'; stone: StoneChoice; size: number; thick: number; pendant?: string; addon?: string }

/** Pendants a customer can hang on a plain chain. */
export const CHAIN_PENDANTS: { id: string; label: string }[] = [
  { id: 'none', label: 'No pendant' }, { id: 'temple-coin', label: 'Lakshmi coin' }, { id: 'peacock', label: 'Peacock' }, { id: 'heart', label: 'Heart' },
  { id: 'teardrop', label: 'Drop' }, { id: 'medallion', label: 'Medallion' }, { id: 'floral', label: 'Flower' }, { id: 'leaf', label: 'Leaf' },
  { id: 'art:heart', label: 'Open heart' }, { id: 'art:butterfly', label: 'Butterfly' }, { id: 'art:evil-eye', label: 'Evil eye' }, { id: 'art:infinity', label: 'Infinity' },
  { id: 'art:moon-star', label: 'Moon & star' }, { id: 'art:hamsa', label: 'Hamsa' }, { id: 'art:rub-star', label: 'Arabic star' }, { id: 'art:lira', label: 'Lira coin' }, { id: 'art:bar', label: 'Minimal bar' }, { id: 'art:om', label: 'Om' }, { id: 'art:star', label: 'Star' }, { id: 'art:clover', label: 'Clover' },
];

type PieceDef = { id: Piece; label: string; styles: string[] };
export const PIECES: Record<Audience, PieceDef[]> = {
  women: [
    { id: 'necklace', label: 'Necklace', styles: ['mango-haram', 'kasu-mala', 'gundla-mala', 'pearl-mala', 'nallapusalu', 'dubai-lira-necklace', 'dubai-filigree-collar', 'station-necklace', 'pearl-haram', 'polki-choker', 'floral-choker', 'layered-set', 'mangalsutra'] },
    { id: 'earrings', label: 'Earrings', styles: ['temple-jhumka', 'chandbali', 'bead-hoops', 'pearl-drop-studs', 'dubai-chandelier', 'lira-earrings', 'evil-eye-earrings', 'polki-studs', 'solitaire-stud', 'huggies', 'drop-earring', 'floral-stud', 'hoop-bali'] },
    { id: 'bangle', label: 'Bangle', styles: ['peacock-kada', 'polki-kada', 'bead-bangle', 'dubai-coin-bangle', 'dubai-broad-kada', 'stone-bangle', 'open-cuff', 'twisted-bangle', 'plain-kada'] },
    { id: 'ring', label: 'Ring', styles: ['solitaire', 'halo-ring', 'navratna-ring', 'bead-ring', 'peacock-ring', 'half-eternity', 'stack-rings', 'plain-band'] },
    { id: 'pendant', label: 'Pendant', styles: ['art-heart', 'art-butterfly', 'art-evil-eye', 'art-hamsa', 'art-rub-star', 'art-arabesque', 'art-lira', 'art-quatrefoil', 'art-bar', 'art-infinity', 'art-moon-star', 'art-flower', 'art-om', 'art-drop', 'art-star', 'art-clover', 'art-leaf', 'art-sunburst', 'peacock-pendant', 'temple-pendant', 'halo-pendant', 'heart-pendant', 'solitaire-drop'] },
    { id: 'chain', label: 'Chain', styles: ['singapore-chain', 'rope-chain', 'box-chain', 'paperclip-chain', 'snake-chain', 'cable-chain', 'ball-chain', 'figaro-chain'] },
    { id: 'bracelet', label: 'Bracelet', styles: ['tennis-bracelet', 'snake-bracelet', 'bead-bracelet', 'evil-eye-bracelet', 'lira-bracelet', 'charm-bracelet', 'cable-bracelet'] },
  ],
  men: [
    { id: 'chain', label: 'Chain', styles: ['men-cuban', 'men-rope', 'men-box', 'men-figaro', 'men-snake'] },
    { id: 'ring', label: 'Ring', styles: ['men-signet', 'men-signet-stone', 'men-stone-ring', 'men-diamond-band', 'men-band'] },
    { id: 'bangle', label: 'Kada', styles: ['men-kada', 'men-kada-ribbed', 'men-kada-open', 'men-kada-twist'] },
    { id: 'bracelet', label: 'Bracelet', styles: ['men-curb-bracelet', 'snake-bracelet', 'men-bead-bracelet', 'men-box-bracelet', 'men-rope-bracelet'] },
    { id: 'pendant', label: 'Pendant', styles: ['men-tablet-pendant', 'men-stone-pendant', 'men-coin-pendant', 'art-lira', 'art-rub-star', 'art-om', 'art-star', 'art-sunburst', 'art-leaf', 'art-infinity'] },
    { id: 'earrings', label: 'Studs', styles: ['men-stud', 'men-square-stud'] },
  ],
};

export const STYLE_NAMES: Record<string, string> = {
  'mango-haram': 'Mango haram', 'kasu-mala': 'Kasu mala', 'floral-choker': 'Flower choker', 'pearl-haram': 'Pearl haram', 'polki-choker': 'Polki choker', 'layered-set': 'Layered', mangalsutra: 'Mangalsutra',
  'temple-jhumka': 'Jhumka', chandbali: 'Chandbali', 'polki-studs': 'Polki studs', 'solitaire-stud': 'Solitaire studs', huggies: 'Huggies', 'floral-stud': 'Flower stud', 'drop-earring': 'Peacock drop', 'hoop-bali': 'Hoop bali',
  'peacock-kada': 'Peacock kada', 'polki-kada': 'Polki kada', 'stone-bangle': 'Stone bangle', 'open-cuff': 'Open cuff', 'twisted-bangle': 'Twisted', 'plain-kada': 'Plain kada',
  solitaire: 'Solitaire', 'halo-ring': 'Halo', 'navratna-ring': 'Navratna', 'peacock-ring': 'Peacock', 'half-eternity': 'Stone band', 'stack-rings': 'Stack of 3', 'plain-band': 'Plain band',
  'art-heart': 'Open heart', 'snake-bracelet': 'Snake', 'gundla-mala': 'Gold bead mala', 'pearl-mala': 'Pearl mala', 'nallapusalu': 'Black & gold beads', 'bead-hoops': 'Gold bead hoops', 'pearl-drop-studs': 'Pearl drops', 'bead-bangle': 'Gold beads', 'bead-bracelet': 'Gold beads', 'bead-ring': 'Gold beads', 'men-bead-bracelet': 'Gold beads', 'art-hamsa': 'Hamsa hand', 'art-rub-star': 'Arabic star', 'art-arabesque': 'Dubai filigree', 'art-lira': 'Lira coin', 'art-quatrefoil': 'Quatrefoil', 'art-bar': 'Minimal bar',
  'dubai-lira-necklace': 'Dubai lira coins', 'dubai-filigree-collar': 'Dubai filigree collar', 'station-necklace': 'Diamond station', 'dubai-chandelier': 'Dubai chandelier', 'lira-earrings': 'Lira coin drops', 'evil-eye-earrings': 'Evil eye drops', 'dubai-coin-bangle': 'Dubai lira charms', 'dubai-broad-kada': 'Dubai broad kada', 'evil-eye-bracelet': 'Evil eye', 'lira-bracelet': 'Lira coins', 'art-infinity': 'Infinity', 'art-butterfly': 'Butterfly', 'art-evil-eye': 'Evil eye', 'art-moon-star': 'Moon & star', 'art-flower': 'Flower', 'art-leaf': 'Leaf', 'art-drop': 'Solitaire drop', 'art-om': 'Om', 'art-star': 'Star', 'art-sunburst': 'Sun coin', 'art-clover': 'Clover',
  'peacock-pendant': 'Peacock', 'temple-pendant': 'Temple coin', 'halo-pendant': 'Halo', 'heart-pendant': 'Heart', 'solitaire-drop': 'Teardrop',
  'singapore-chain': 'Singapore', 'rope-chain': 'Rope', 'box-chain': 'Box', 'paperclip-chain': 'Paperclip', 'snake-chain': 'Snake', 'cable-chain': 'Cable', 'ball-chain': 'Ball', 'figaro-chain': 'Figaro',
  'tennis-bracelet': 'Tennis', 'charm-bracelet': 'Flower charms', 'cable-bracelet': 'Cable',
  'men-cuban': 'Cuban', 'men-rope': 'Rope', 'men-box': 'Box', 'men-figaro': 'Figaro', 'men-snake': 'Snake',
  'men-signet': 'Signet', 'men-signet-stone': 'Stone signet', 'men-stone-ring': 'Big stone', 'men-diamond-band': 'Diamond band', 'men-band': 'Plain band',
  'men-kada': 'Plain kada', 'men-kada-ribbed': 'Ribbed', 'men-kada-open': 'Open kada', 'men-kada-twist': 'Twisted',
  'men-curb-bracelet': 'Cuban', 'men-box-bracelet': 'Box', 'men-rope-bracelet': 'Rope',
  'men-tablet-pendant': 'Tablet', 'men-stone-pendant': 'Stone tablet', 'men-coin-pendant': 'Coin',
  'men-stud': 'Round stud', 'men-square-stud': 'Square stud',
};

export const METAL_CHOICES: { id: MetalChoice; label: string; sub: string; colour: string }[] = [
  { id: '22k-yellow', label: 'Yellow gold', sub: '22K', colour: '#e5b456' },
  { id: '18k-yellow', label: 'Yellow gold', sub: '18K', colour: '#dcb468' },
  { id: '18k-rose', label: 'Rose gold', sub: '18K', colour: '#d9a086' },
  { id: '18k-white', label: 'White gold', sub: '18K', colour: '#dedcd6' },
];

/** Stones in the order customers usually ask for them; the first 7 are always shown. */
export const STONE_CHOICES: { id: StoneChoice; label: string; colour: string }[] = [
  { id: 'kemp', label: 'Kemp red + green', colour: 'linear-gradient(135deg,#9c1027 50%,#0f6a3c 50%)' },
  { id: 'diamond', label: 'Diamond / CZ', colour: 'radial-gradient(circle at 35% 30%,#fff,#cfd6dc)' },
  { id: 'ruby', label: 'Ruby', colour: '#c0122f' },
  { id: 'emerald', label: 'Emerald', colour: '#11834a' },
  { id: 'polki', label: 'Polki (uncut)', colour: 'radial-gradient(circle at 40% 35%,#fbfbf7,#cfd2c9)' },
  { id: 'sapphire', label: 'Blue sapphire', colour: '#2147b8' },
  { id: 'none', label: 'No stones', colour: 'repeating-linear-gradient(45deg,#3a372f 0 4px,#24221e 4px 8px)' },
  { id: 'lab-diamond', label: 'Lab-grown diamond', colour: 'radial-gradient(circle at 35% 30%,#fff,#d8e4ef)' },
  { id: 'moissanite', label: 'Moissanite', colour: 'radial-gradient(circle at 35% 30%,#fff,#e4e9ff)' },
  { id: 'champagne', label: 'Champagne diamond', colour: '#e8c58e' },
  { id: 'navratna', label: 'Navratna (9 stones)', colour: 'conic-gradient(#c0122f,#f4ede1,#e2603f,#11834a,#f0b52e,#fff,#2147b8,#b5651d,#c8b56a,#c0122f)' },
  { id: 'pink-sapphire', label: 'Pink sapphire', colour: '#e3528f' },
  { id: 'topaz', label: 'Yellow sapphire', colour: '#f0b52e' },
  { id: 'amethyst', label: 'Amethyst', colour: '#8e4fbf' },
  { id: 'blue-topaz', label: 'Blue topaz', colour: '#5fb7e6' },
  { id: 'morganite', label: 'Morganite', colour: '#f2b4a8' },
  { id: 'tanzanite', label: 'Tanzanite', colour: '#4b4fcf' },
  { id: 'peridot', label: 'Peridot', colour: '#9acd32' },
  { id: 'garnet', label: 'Garnet', colour: '#7b1424' },
  { id: 'onyx', label: 'Black onyx', colour: '#121212' },
  { id: 'turquoise', label: 'Turquoise', colour: '#2fb5aa' },
  { id: 'opal', label: 'Opal', colour: 'linear-gradient(135deg,#e6ecf4,#f6e0f0,#d9f2ea)' },
  { id: 'coral', label: 'Coral', colour: '#e2603f' },
];

export function sizeOptions(piece: Piece, audience: Audience): { label: string; values: (string | number)[]; display: (v: string | number) => string; def: number } {
  const men = audience === 'men';
  switch (piece) {
    case 'ring': return men ? { label: 'Ring size', values: [16, 18, 20, 22, 24, 26], display: (v) => `Size ${v}`, def: 2 } : { label: 'Ring size', values: [8, 10, 12, 14, 16, 18, 20, 22], display: (v) => `Size ${v}`, def: 3 };
    case 'bangle': return men ? { label: 'Kada size', values: ['2-8', '2-10', '2-12'], display: (v) => String(v), def: 1 } : { label: 'Bangle size', values: ['2-2', '2-4', '2-6', '2-8', '2-10'], display: (v) => String(v), def: 2 };
    case 'necklace': return { label: 'Length', values: [16, 18, 20, 24, 28], display: (v) => `${v}"`, def: 3 };
    case 'chain': return men ? { label: 'Length', values: [20, 22, 24, 26], display: (v) => `${v}"`, def: 1 } : { label: 'Length', values: [16, 18, 20, 22, 24], display: (v) => `${v}"`, def: 1 };
    case 'bracelet': return men ? { label: 'Wrist', values: [18, 19, 20, 21, 22], display: (v) => `${v} cm`, def: 2 } : { label: 'Wrist', values: [15, 16, 17, 18, 19], display: (v) => `${v} cm`, def: 2 };
    default: return { label: 'Size', values: [0.85, 1, 1.2], display: (v) => ({ 0.85: 'Small', 1: 'Medium', 1.2: 'Large' } as Record<string, string>)[String(v)], def: 1 };
  }
}

export const THICKNESS = [{ label: 'Thin', k: 0.75 }, { label: 'Medium', k: 1 }, { label: 'Heavy', k: 1.35 }];
export const hasThickness = (p: Piece) => p === 'chain' || p === 'bracelet';

/** The stone a style is designed around (used when the customer picks that style). */
export function styleStone(style: string): StoneChoice {
  const t = TEMPLATES.find((x) => x.id === style);
  const stones = t?.parts.filter((q) => q.type === 'stone') ?? [];
  if (!stones.length) return 'none';
  if (stones.some((q) => q.gem === 'navratna')) return 'navratna';
  const first = stones[0];
  if (first.gem === 'kemp-red' || first.gem === 'kemp-green') return 'kemp';
  return (stones.find((q) => q.params?.shape !== 'bead')?.gem ?? first.gem ?? 'diamond') as StoneChoice;
}

/** The gold colour a style is designed in (24k and silver show as 22k yellow). */
export function styleMetal(style: string): MetalChoice {
  const t = TEMPLATES.find((x) => x.id === style);
  return (!t || t.metal === '24k-yellow' || t.metal === 'silver-925' ? '22k-yellow' : t.metal) as MetalChoice;
}
export function defaultCfg(audience: Audience = 'women', piece?: Piece): Cfg {
  const p = PIECES[audience].find((x) => x.id === piece) ?? PIECES[audience][0];
  const style = p.styles[0];
  const t = TEMPLATES.find((x) => x.id === style)!;
  return { audience, piece: p.id, style, metal: (t.metal === '24k-yellow' || t.metal === 'silver-925' ? '22k-yellow' : t.metal) as MetalChoice, finish: t.finish === 'antique' ? 'antique' : 'polished', stone: styleStone(style), size: sizeOptions(p.id, audience).def, thick: 1 };
}

/** A customer's change to one part (keyed by stable node id). */
export interface PartOverride { type?: string; params?: Record<string, ParamValue>; gem?: GemId; hidden?: boolean }
export type Overrides = Record<string, PartOverride>;

export function buildDesign(cfg: Cfg, ov: Overrides = {}): Design {
  const d = baseDesign(cfg);
  applyOverrides(d, ov);
  return d;
}

export function applyOverrides(d: Design, ov: Overrides) {
  for (const [id, o] of Object.entries(ov)) {
    const n = d.nodes.find((x) => x.id === id);
    if (!n) continue;
    if (o.type && o.type !== n.type && COMPONENT_MAP[o.type]) {
      const keep: Record<string, ParamValue> = {};
      const defs = defaultParams(o.type);
      for (const k of Object.keys(defs)) if (k in n.params && typeof n.params[k] === typeof defs[k]) keep[k] = n.params[k];
      n.type = o.type; n.name = COMPONENT_MAP[o.type].label; n.params = { ...defs, ...keep };
    }
    if (o.params) for (const [k, v] of Object.entries(o.params)) if (k in n.params) n.params[k] = v;
    if (o.gem) { n.material.gem = o.gem; n.material.altGem = 'none'; }
    if (o.hidden) n.visible = false;
  }
  // a stud's screw-back only makes sense on a stud top
  const root = d.nodes.find((n) => !n.attach);
  if (root && root.type !== 'earStud') for (const n of d.nodes) if (n.type === 'earPost') n.visible = false;
}

const SHORT: Record<string, string> = {
  ringBand: 'ring', bangle: 'bangle', necklaceBase: 'necklace', chainBase: 'chain', braceletChain: 'bracelet', pendantBody: 'pendant', pendantArt: 'pendant',
  earStud: 'earring top', earHoop: 'hoop', fishHook: 'hook', jhumkaBell: 'jhumka', 'motif-mango': 'mangoes', 'motif-leaf': 'leaves',
  'motif-floral': 'flowers', 'motif-kasu': 'coins', 'motif-peacock': 'peacock', 'motif-lozenge': 'lozenges', 'motif-bead': 'beads', 'motif-tablet': 'plate',
  'setting-bezel': 'setting', 'setting-prong': 'prongs', 'setting-kundan': 'kundan cups', 'setting-halo': 'halo',
};
const NAME: Record<string, string> = {
  ringBand: 'Ring band', bangle: 'Bangle body', necklaceBase: 'Necklace chain', chainBase: 'Chain', braceletChain: 'Bracelet chain', pendantBody: 'Pendant', pendantArt: 'Pendant',
  earStud: 'Earring top', earHoop: 'Hoop', fishHook: 'Ear hook', earPost: 'Screw back', jhumkaBell: 'Jhumka bell', ghungroo: 'Gold bells', dropBead: 'Drops',
  clasp: 'Clasp', 'motif-mango': 'Mango motifs', 'motif-leaf': 'Leaf motifs', 'motif-floral': 'Flowers', 'motif-kasu': 'Kasu coins', 'motif-peacock': 'Peacock',
  'motif-lozenge': 'Lozenges', 'motif-bead': 'Beads', 'motif-tablet': 'Face plate', 'setting-bezel': 'Stone setting', 'setting-prong': 'Prongs',
  'setting-kundan': 'Kundan cups', 'setting-halo': 'Halo setting',
};

/** Plain-language name for a part, e.g. "Stones on the mangoes". */
export function partLabel(d: Design, n: DesignNode, typeOverride?: string): string {
  const type = typeOverride ?? n.type;
  const parent = n.attach ? d.nodes.find((x) => x.id === n.attach!.parent) : undefined;
  let base = type === 'stone' ? (n.attach?.all ? 'Stones' : 'Stone') : NAME[type] ?? COMPONENT_MAP[type].label;
  if (n.attach?.all === false && (type === 'ghungroo' || type === 'dropBead')) base = base === 'Gold bells' ? 'Gold bell' : 'Drop';
  if (!parent || ['earPost', 'clasp', 'pendantBody', 'pendantArt', 'jhumkaBell'].includes(type) || (type.startsWith('motif-') && !parent.type.startsWith('motif-'))) return base;
  return `${base} on ${SHORT[parent.type] ?? COMPONENT_MAP[parent.type].label.toLowerCase()}`;
}

/** The part type a template originally used (so a swapped part is still named by what it was). */
function originalType(id: string): string | undefined {
  const [tpl, key] = id.split('.');
  return TEMPLATES.find((t) => t.id === tpl)?.parts.find((p) => p.key === key)?.type;
}

export function overrideSummary(d: Design, ov: Overrides): string[] {
  const out: string[] = [];
  for (const [id, o] of Object.entries(ov)) {
    const n = d.nodes.find((x) => x.id === id);
    if (!n) continue;
    const bits: string[] = [];
    if (o.hidden) bits.push('removed');
    if (o.type) bits.push(`changed to ${COMPONENT_MAP[o.type]?.label ?? o.type}`);
    if (o.gem) bits.push(GEMS[o.gem]?.label ?? o.gem);
    for (const [k, v] of Object.entries(o.params ?? {})) {
      const pd = COMPONENT_MAP[n.type]?.params.find((p) => p.key === k);
      if (!pd) continue;
      const val = pd.kind === 'select' ? pd.options.find((x) => x.value === v)?.label ?? v : pd.kind === 'bool' ? (v ? 'yes' : 'no') : `${v}${'unit' in pd && pd.unit ? ' ' + pd.unit : ''}`;
      bits.push(`${pd.label.toLowerCase()} ${val}`);
    }
    if (bits.length) out.push(`${partLabel(d, n, o.type ? originalType(id) : undefined)}: ${bits.join(', ')}`);
  }
  return out;
}

type TPart = (typeof TEMPLATES)[number]['parts'][number];
/** Add-ons a customer can put on each kind of piece (chains and necklaces use CHAIN_PENDANTS). */
export const ADDONS: Partial<Record<Piece, { title: string; hint: string; options: { id: string; label: string }[] }>> = {
  earrings: { title: 'Add drops', hint: 'they hang below the earring', options: [
    { id: 'none', label: 'As designed' }, { id: 'gold-drop', label: 'Gold drop' }, { id: 'pearl-drop', label: 'Pearl drop' }, { id: 'bells', label: 'Ghungroo bells' }, { id: 'jhumka', label: 'Jhumka bell' }, { id: 'evil-eye', label: 'Evil eye' }, { id: 'lira', label: 'Lira coin' } ] },
  bangle: { title: 'Add charms or beads', hint: 'all around the bangle', options: [
    { id: 'none', label: 'As designed' }, { id: 'beads', label: 'Gold beads' }, { id: 'pearls', label: 'Pearls' }, { id: 'flowers', label: 'Flowers' }, { id: 'lira', label: 'Lira coins' }, { id: 'evil-eye', label: 'Evil eyes' }, { id: 'hearts', label: 'Hearts' } ] },
  bracelet: { title: 'Add charms', hint: 'they hang from the bracelet', options: [
    { id: 'none', label: 'As designed' }, { id: 'beads', label: 'Gold beads' }, { id: 'pearls', label: 'Pearls' }, { id: 'hearts', label: 'Hearts' }, { id: 'evil-eye', label: 'Evil eyes' }, { id: 'lira', label: 'Lira coins' }, { id: 'flowers', label: 'Flowers' }, { id: 'bells', label: 'Bells' } ] },
  ring: { title: 'Add beads on the band', hint: 'small beads along the top', options: [
    { id: 'none', label: 'As designed' }, { id: 'beads', label: 'Gold beads' }, { id: 'pearls', label: 'Pearls' } ] },
  pendant: { title: 'Hang it on a chain', hint: 'see the pendant on a chain', options: [
    { id: 'none', label: 'Pendant only' }, { id: 'chain:cable', label: 'Cable chain' }, { id: 'chain:rope', label: 'Rope chain' }, { id: 'chain:box', label: 'Box chain' }, { id: 'chain:ball', label: 'Ball chain' }, { id: 'chain:singapore', label: 'Singapore chain' }, { id: 'chain:blackbeads', label: 'Black beads' } ] },
};

/** charm/bead part for an add-on id, hung from `parent` at `anchor` */
function charm(id: string, parent: string, anchor: string, all: boolean, small = 1): TPart[] {
  const base = { key: 'addon', parent, anchor, all } as const;
  switch (id) {
    case 'beads': return [{ ...base, type: 'motif-bead', params: { size: 4 * small, beadMat: 'metal' } }];
    case 'pearls': return [{ ...base, type: 'motif-bead', params: { size: 4 * small, beadMat: 'pearl' }, gem: 'pearl' }];
    case 'flowers': return [{ ...base, type: 'motif-floral', params: { size: 7 * small, petals: 5, thickness: 1.1 } }];
    case 'gold-drop': return [{ ...base, type: 'dropBead', params: { size: 6 * small, mat: 'metal' } }];
    case 'pearl-drop': return [{ ...base, type: 'dropBead', params: { size: 6 * small, mat: 'stone' }, gem: 'pearl' }];
    case 'bells': return [{ ...base, type: 'ghungroo', params: { size: 2.6 * small } }];
    case 'jhumka': return [{ ...base, type: 'jhumkaBell', params: {} }];
    case 'hearts': return [{ ...base, type: 'pendantArt', params: { design: 'heart', height: 8 * small, thickness: 0.8 } }];
    case 'lira': return [{ ...base, type: 'pendantArt', params: { design: 'lira', height: 9 * small, thickness: 0.7 } }];
    case 'evil-eye': return [
      { ...base, type: 'pendantArt', params: { design: 'evil-eye', height: 9 * small, thickness: 0.8 } },
      { key: 'addon_s', type: 'stone', parent: 'addon', anchor: 'socket', all: true, params: { shape: 'cabochon', size: 2.6 * small }, gem: 'sapphire' } as TPart];
    default: return [];
  }
}
/** remove the parts hanging at one anchor of a part, and everything below them */
function dropAt(parts: TPart[], parent: string, anchor: string): TPart[] {
  const gone = new Set(parts.filter((q) => q.parent === parent && q.anchor === anchor).map((q) => q.key));
  let grew = true;
  while (grew) { grew = false; for (const q of parts) if (q.parent && gone.has(q.parent) && !gone.has(q.key)) { gone.add(q.key); grew = true; } }
  return parts.filter((q) => !gone.has(q.key));
}
function pendantPart(id: string, parent: string, men: boolean): TPart {
  return id.startsWith('art:')
    ? { key: 'pend', type: 'pendantArt', parent, anchor: 'center', params: { design: id.slice(4), height: men ? 22 : 17, thickness: 1.2 } }
    : { key: 'pend', type: 'pendantBody', parent, anchor: 'center', params: { shape: id, height: men ? 30 : 24, thickness: 1.6, drops: 0, bail: true } };
}
/** The chosen style with the customer's add-ons put on it. */
export function withAddons(cfg: Cfg, t0: (typeof TEMPLATES)[number]): { t: (typeof TEMPLATES)[number]; pendantKey?: string } {
  let parts: TPart[] = t0.parts.map((q) => ({ ...q, params: { ...(q.params ?? {}) } }));
  const root = parts[0], men = cfg.audience === 'men';
  const pend = cfg.pendant && cfg.pendant !== 'none' ? cfg.pendant : '';
  const add = cfg.addon && cfg.addon !== 'none' ? cfg.addon : '';
  if ((cfg.piece === 'chain' || cfg.piece === 'necklace') && pend && (root.type === 'chainBase' || root.type === 'necklaceBase')) {
    parts = dropAt(parts, root.key, 'center');
    parts.push(pendantPart(pend, root.key, men));
  }
  if (add && cfg.piece === 'earrings') {
    if (root.type === 'earHoop') { root.params!.rim = Number(root.params!.rim) || 7; parts = dropAt(parts, root.key, 'rim'); parts.push(...charm(add, root.key, 'rim', true, 0.7)); }
    else if (root.type === 'earStud') {
      // hang the add-on from whatever already hangs below the top (a chandbali moon, a jhumka bell), or from the top itself
      const occ = parts.find((q) => q.parent === root.key && q.anchor === 'drop');
      if (add !== 'jhumka' && occ && occ.type === 'pendantBody') { occ.params!.drops = Math.max(5, Number(occ.params!.drops) || 0); parts = dropAt(parts, occ.key, 'drop'); parts.push(...charm(add, occ.key, 'drop', true, 0.6)); }
      else if (add !== 'jhumka' && occ && occ.type === 'jhumkaBell') { occ.params!.rim = Math.max(10, Number(occ.params!.rim) || 0); parts = dropAt(parts, occ.key, 'rim'); parts.push(...charm(add, occ.key, 'rim', true, 0.6)); }
      else { parts = dropAt(parts, root.key, 'drop'); parts.push(...charm(add, root.key, 'drop', false, add === 'bells' ? 1.6 : 1.4)); }
    }
    else if (root.type === 'fishHook') { const top = parts.find((q) => q.parent === root.key); const host = top && top.type === 'earStud' ? top.key : root.key; const anc = host === root.key ? (root as TPart).anchor ?? 'drop' : 'drop'; parts = dropAt(parts, host, anc); parts.push(...charm(add, host, anc, false, 1.4)); }
  }
  if (add && (cfg.piece === 'bangle' || cfg.piece === 'bracelet' || cfg.piece === 'ring') && ['bangle', 'braceletChain', 'ringBand'].includes(root.type)) {
    const n = root.type === 'bangle' ? 18 : root.type === 'braceletChain' ? 7 : 7;
    root.params!.stations = Number(root.params!.stations) || n;
    parts = dropAt(parts, root.key, 'station');
    parts.push(...charm(add, root.key, 'station', true, root.type === 'ringBand' ? 0.55 : root.type === 'bangle' ? 0.8 : 1));
  }
  let pendantKey: string | undefined;
  if (add.startsWith('chain:') && cfg.piece === 'pendant') {
    // the pendant hangs from a new chain
    const style = add.slice(6);
    parts = [{ key: 'neck', type: 'chainBase', params: { length: 18, style, wire: style === 'blackbeads' ? 1.1 : 0.9 } }, { ...root, parent: 'neck', anchor: 'center' }, ...parts.slice(1)];
    pendantKey = root.key;
  }
  return { t: { ...t0, parts } as (typeof TEMPLATES)[number], pendantKey };
}

function baseDesign(cfg: Cfg): Design {
  const t0 = TEMPLATES.find((x) => x.id === cfg.style) ?? TEMPLATES[0];
  const { t, pendantKey } = withAddons(cfg, t0);
  const d = instantiate(t as typeof t0, true);
  const sz = sizeOptions(cfg.piece, cfg.audience);
  const sizeVal = sz.values[cfg.size] ?? sz.values[sz.def];
  for (const n of d.nodes) {
    n.material.metal = cfg.metal as MetalId;
    n.material.finish = cfg.finish;
    if (n.id.endsWith('.addon_s')) continue; // add-on stones keep their own colour (evil-eye blue)
    if (n.type === 'stone' || n.type.startsWith('setting-')) {
      if (cfg.stone === 'none') { n.visible = false; continue; }
    }
    if (n.type === 'stone') {
      if (cfg.stone === 'kemp') {
        n.material.gem = 'kemp-red';
        n.material.altGem = n.attach?.all ? 'kemp-green' : 'none';
        if (n.params.shape !== 'bead') n.params.shape = 'cabochon';
      } else if (cfg.stone === 'navratna') {
        // nine colours across repeated stones; a single centre stone stays ruby (the sun stone)
        n.material.gem = n.attach?.all ? 'navratna' : 'ruby';
        n.material.altGem = 'none';
      } else {
        n.material.gem = cfg.stone as GemId;
        n.material.altGem = 'none';
        if (cfg.stone === 'polki' && n.params.shape === 'round') n.params.shape = 'polki';
      }
    }
  }
  const roots = d.nodes.filter((n) => !n.attach);
  if (pendantKey) { const pn = d.nodes.find((n) => n.id === `${t.id}.${pendantKey}`); if (pn) pn.offset.scale = Number(sizeVal); }
  for (const root of roots) {
    if (pendantKey && root.type === 'chainBase') continue;
    if (root.type === 'ringBand') root.params.size = Number(sizeVal);
    else if (root.type === 'bangle') root.params.size = String(sizeVal);
    else if (root.type === 'necklaceBase' || root.type === 'chainBase') {
      if (cfg.piece === 'necklace' && root.type === 'necklaceBase') {
        const base = Number(t.parts.find((q) => q.type === 'necklaceBase')?.params?.length ?? 22);
        root.params.stations = Math.max(0, Math.round(Number(root.params.stations) * Number(sizeVal) / base));
        root.params.length = Number(sizeVal);
      } else if (cfg.piece === 'necklace') {
        // layered sets: keep the inner chain shorter than the outer necklace
        root.params.length = Math.max(14, Number(sizeVal) - 4);
      } else root.params.length = Number(sizeVal);
    } else if (root.type === 'braceletChain') root.params.wrist = Number(sizeVal);
    else root.offset.scale = Number(sizeVal);
    if (hasThickness(cfg.piece) && (root.type === 'chainBase' || root.type === 'braceletChain')) {
      root.params.wire = +(Number(root.params.wire) * (THICKNESS[cfg.thick] ?? THICKNESS[1]).k).toFixed(2);
    }
  }
  const pieceLabel = PIECES[cfg.audience].find((p) => p.id === cfg.piece)?.label ?? '';
  d.name = `${STYLE_NAMES[cfg.style] ?? t.name} ${pieceLabel.toLowerCase()}`;
  return d;
}

export function cfgSummary(cfg: Cfg): string[] {
  const sz = sizeOptions(cfg.piece, cfg.audience);
  const metal = METAL_CHOICES.find((m) => m.id === cfg.metal)!;
  const piece = PIECES[cfg.audience].find((p) => p.id === cfg.piece)!;
  return [
    `For: ${cfg.audience === 'men' ? 'Men' : 'Women'}`,
    `${piece.label}: ${STYLE_NAMES[cfg.style]}`,
    `${sz.label}: ${sz.display(sz.values[cfg.size])}${hasThickness(cfg.piece) ? `, ${THICKNESS[cfg.thick].label.toLowerCase()} thickness` : ''}`,
    `Metal: ${metal.label} (${metal.sub}), ${cfg.finish === 'antique' ? 'temple antique finish' : 'shiny finish'}`,
    `Stones: ${STONE_CHOICES.find((s) => s.id === cfg.stone)?.label ?? cfg.stone}`,
    ...((cfg.piece === 'chain' || cfg.piece === 'necklace') && cfg.pendant && cfg.pendant !== 'none' ? [`Pendant: ${CHAIN_PENDANTS.find((x) => x.id === cfg.pendant)?.label ?? cfg.pendant}`] : []),
    ...(cfg.addon && cfg.addon !== 'none' && ADDONS[cfg.piece] ? [`Add-on: ${ADDONS[cfg.piece]!.options.find((x) => x.id === cfg.addon)?.label ?? cfg.addon}`] : []),
  ];
}

export const encodeCfg = (c: Cfg, ov: Overrides = {}) => btoa(unescape(encodeURIComponent(JSON.stringify([c.audience, c.piece, c.style, c.metal, c.finish, c.stone, c.size, c.thick, ov, c.pendant ?? 'none', c.addon ?? 'none'])))).replace(/=+$/, '');
export function decodeCfg(code: string): { cfg: Cfg; ov: Overrides } {
  const raw = code.trim().replace(/^.*BHV2:/, '').split(/\s/)[0];
  const [audience, piece, style, metal, finish, stone, size, thick, ov, pendant, addon] = JSON.parse(decodeURIComponent(escape(atob(raw + '==='.slice((raw.length + 3) % 4)))));
  if (!PIECES[audience as Audience]?.some((p) => p.id === piece && p.styles.includes(style))) throw new Error('This code is not a Bhavani design.');
  return { cfg: { audience, piece, style, metal, finish, stone, size, thick: thick ?? 1, pendant: pendant ?? 'none', addon: addon ?? 'none' }, ov: ov ?? {} };
}
