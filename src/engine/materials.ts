// Metal and gemstone presets. Visual colour and purity are kept as separate, explicit fields.
export type MetalId = '24k-yellow' | '22k-yellow' | '18k-yellow' | '18k-rose' | '18k-white' | 'silver-925';
export type FinishId = 'polished' | 'matte' | 'antique';
export type GemId = 'ruby' | 'emerald' | 'sapphire' | 'diamond' | 'kemp-red' | 'kemp-green' | 'pearl' | 'coral' | 'topaz'
  | 'lab-diamond' | 'moissanite' | 'polki' | 'champagne' | 'pink-sapphire' | 'amethyst' | 'blue-topaz' | 'morganite' | 'tanzanite'
  | 'peridot' | 'garnet' | 'onyx' | 'turquoise' | 'opal' | 'navratna';

export interface MetalDef { id: MetalId; label: string; purity: string; colourName: string; colour: string; density: number }
export const METALS: Record<MetalId, MetalDef> = {
  '24k-yellow': { id: '24k-yellow', label: '24K Gold', purity: '24K (999)', colourName: 'Yellow', colour: '#f2c14e', density: 19.32 },
  '22k-yellow': { id: '22k-yellow', label: '22K Gold', purity: '22K (916)', colourName: 'Yellow', colour: '#e5b456', density: 17.8 },
  '18k-yellow': { id: '18k-yellow', label: '18K Yellow Gold', purity: '18K (750)', colourName: 'Yellow', colour: '#dcb468', density: 15.5 },
  '18k-rose': { id: '18k-rose', label: '18K Rose Gold', purity: '18K (750)', colourName: 'Rose', colour: '#d9a086', density: 15.1 },
  '18k-white': { id: '18k-white', label: '18K White Gold', purity: '18K (750)', colourName: 'White', colour: '#dedcd6', density: 15.6 },
  'silver-925': { id: 'silver-925', label: 'Silver 925', purity: 'Sterling (925)', colourName: 'Silver', colour: '#d3d6d9', density: 10.4 },
};

export const FINISHES: Record<FinishId, { label: string; roughness: number; darken: number }> = {
  polished: { label: 'Polished', roughness: 0.16, darken: 0 },
  matte: { label: 'Matte', roughness: 0.5, darken: 0.04 },
  antique: { label: 'Antique (temple)', roughness: 0.38, darken: 0.28 },
};

export interface GemDef { id: GemId; label: string; colour: string; density: number; transparent: boolean; ior: number; roughness: number }
export const GEMS: Record<GemId, GemDef> = {
  ruby: { id: 'ruby', label: 'Ruby', colour: '#c0122f', density: 4.0, transparent: true, ior: 1.76, roughness: 0.02 },
  emerald: { id: 'emerald', label: 'Emerald', colour: '#11834a', density: 2.72, transparent: true, ior: 1.58, roughness: 0.03 },
  sapphire: { id: 'sapphire', label: 'Blue sapphire', colour: '#2147b8', density: 4.0, transparent: true, ior: 1.77, roughness: 0.02 },
  diamond: { id: 'diamond', label: 'Diamond / CZ', colour: '#ffffff', density: 3.52, transparent: true, ior: 2.42, roughness: 0 },
  'kemp-red': { id: 'kemp-red', label: 'Kemp (red)', colour: '#9c1027', density: 3.9, transparent: false, ior: 1.6, roughness: 0.12 },
  'kemp-green': { id: 'kemp-green', label: 'Kemp (green)', colour: '#0f6a3c', density: 3.9, transparent: false, ior: 1.6, roughness: 0.12 },
  pearl: { id: 'pearl', label: 'Pearl', colour: '#f4ede1', density: 2.7, transparent: false, ior: 1.53, roughness: 0.32 },
  coral: { id: 'coral', label: 'Coral', colour: '#e2603f', density: 2.65, transparent: false, ior: 1.49, roughness: 0.35 },
  topaz: { id: 'topaz', label: 'Yellow sapphire / topaz', colour: '#f0b52e', density: 3.53, transparent: true, ior: 1.62, roughness: 0.02 },
  'lab-diamond': { id: 'lab-diamond', label: 'Lab-grown diamond', colour: '#ffffff', density: 3.52, transparent: true, ior: 2.42, roughness: 0 },
  moissanite: { id: 'moissanite', label: 'Moissanite', colour: '#fbfdff', density: 3.21, transparent: true, ior: 2.65, roughness: 0 },
  polki: { id: 'polki', label: 'Polki (uncut diamond)', colour: '#eef0ec', density: 3.52, transparent: true, ior: 1.9, roughness: 0.22 },
  champagne: { id: 'champagne', label: 'Champagne diamond', colour: '#e8c58e', density: 3.52, transparent: true, ior: 2.42, roughness: 0 },
  'pink-sapphire': { id: 'pink-sapphire', label: 'Pink sapphire', colour: '#e3528f', density: 4.0, transparent: true, ior: 1.77, roughness: 0.02 },
  amethyst: { id: 'amethyst', label: 'Amethyst', colour: '#8e4fbf', density: 2.65, transparent: true, ior: 1.54, roughness: 0.02 },
  'blue-topaz': { id: 'blue-topaz', label: 'Blue topaz', colour: '#5fb7e6', density: 3.53, transparent: true, ior: 1.62, roughness: 0.02 },
  morganite: { id: 'morganite', label: 'Morganite', colour: '#f2b4a8', density: 2.8, transparent: true, ior: 1.58, roughness: 0.02 },
  tanzanite: { id: 'tanzanite', label: 'Tanzanite', colour: '#4b4fcf', density: 3.35, transparent: true, ior: 1.69, roughness: 0.02 },
  peridot: { id: 'peridot', label: 'Peridot', colour: '#9acd32', density: 3.34, transparent: true, ior: 1.67, roughness: 0.02 },
  garnet: { id: 'garnet', label: 'Garnet', colour: '#7b1424', density: 3.9, transparent: true, ior: 1.79, roughness: 0.02 },
  onyx: { id: 'onyx', label: 'Black onyx / black beads', colour: '#121212', density: 2.65, transparent: false, ior: 1.54, roughness: 0.1 },
  turquoise: { id: 'turquoise', label: 'Turquoise', colour: '#2fb5aa', density: 2.7, transparent: false, ior: 1.61, roughness: 0.35 },
  opal: { id: 'opal', label: 'Opal', colour: '#e6ecf4', density: 2.1, transparent: false, ior: 1.45, roughness: 0.15 },
  navratna: { id: 'navratna', label: 'Navratna (9 stones)', colour: '#ffffff', density: 3.6, transparent: true, ior: 1.7, roughness: 0.02 },
};

/** Navratna: ruby, pearl, coral, emerald, yellow sapphire, diamond, blue sapphire, hessonite, cat's eye. */
export const NAVRATNA = ['#c0122f', '#f4ede1', '#e2603f', '#11834a', '#f0b52e', '#ffffff', '#2147b8', '#b5651d', '#c8b56a'];

/** Default manufacturing allowance on top of the theoretical geometry weight (casting, sprues, finishing loss). */
export const DEFAULT_ALLOWANCE = 0.06;

export function darkenHex(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.round(v * (1 - amt));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
