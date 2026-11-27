/** Colour edits on a cut-out jewellery photo: gold colour, stone colour, shine. */
import { rgbToHsv } from './cutout';

export type MetalTone = 'photo' | 'yellow' | 'rose' | 'white';
export const METAL_TONES: { id: MetalTone; label: string; sw: string }[] = [
  { id: 'photo', label: 'Same as photo', sw: 'linear-gradient(135deg,#8a6a3c,#e8c27a)' },
  { id: 'yellow', label: '22K yellow', sw: 'linear-gradient(135deg,#a8791f,#f5cf6b)' },
  { id: 'rose', label: '18K rose', sw: 'linear-gradient(135deg,#9a5a48,#f0b39c)' },
  { id: 'white', label: 'White gold', sw: 'linear-gradient(135deg,#8c9096,#f1f2f4)' },
];
export type StoneTone = 'ruby' | 'emerald' | 'sapphire' | 'pink' | 'kemp' | 'diamond' | 'pearl' | 'gold';
export const STONE_TONES: { id: StoneTone; label: string; sw: string }[] = [
  { id: 'ruby', label: 'Ruby', sw: '#c0153a' }, { id: 'emerald', label: 'Emerald', sw: '#0f8a4f' }, { id: 'sapphire', label: 'Sapphire', sw: '#1f4fbf' },
  { id: 'pink', label: 'Pink', sw: '#e0629a' }, { id: 'kemp', label: 'Kemp', sw: '#8e1020' }, { id: 'diamond', label: 'Diamond / CZ', sw: '#eef3f8' },
  { id: 'pearl', label: 'Pearl', sw: '#efe6d6' }, { id: 'gold', label: 'Plain gold', sw: '#d9b062' },
];
export interface StoneSwap { L: number; a: number; b: number; to: StoneTone; name: string }
export interface Edits { metal: MetalTone; swaps: StoneSwap[]; shine: number }

function lab(r: number, g: number, b: number) {
  const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const isMetal = (h: number, s: number, v: number) => (h >= 14 && h <= 66 && s > 0.16) || (s < 0.16 && v > 0.82);

/** What did the customer tap? Returns a stone swap seed, or null when they tapped gold or empty space. */
export function pickStone(base: ImageData, x: number, y: number): { L: number; a: number; b: number; colour: string } | 'gold' | null {
  const { width: W, height: H, data: d } = base;
  // average a small patch so one sparkle pixel does not decide
  let n = 0, R = 0, G = 0, B = 0, metal = 0;
  for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(W - 1, x + 2); xx++) {
    const i = (yy * W + xx) * 4; if (d[i + 3] < 128) continue;
    const [h, s, v] = rgbToHsv(d[i], d[i + 1], d[i + 2]);
    n++;
    if (isMetal(h, s, v)) { metal++; continue; }
    R += d[i]; G += d[i + 1]; B += d[i + 2];
  }
  if (!n) return null;
  if (metal > n * 0.6) return 'gold';
  const k = n - metal; R /= k; G /= k; B /= k;
  const [L, a, b] = lab(R, G, B);
  return { L, a, b, colour: `rgb(${R | 0},${G | 0},${B | 0})` };
}

export function stoneName(L: number, a: number, b: number) {
  const hue = (Math.atan2(b, a) * 180) / Math.PI, chroma = Math.hypot(a, b);
  if (chroma < 12) return L > 70 ? 'white stones' : 'dark stones';
  if (hue > -30 && hue < 35) return 'red stones';
  if (hue >= 35 && hue < 100) return 'yellow stones';
  if (hue >= 100 || hue < -150) return 'green stones';
  if (hue >= -150 && hue < -60) return 'blue stones';
  return 'pink stones';
}

/** Apply the edits to the cut-out. */
export function renderEdits(base: ImageData, e: Edits): ImageData {
  const out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height), d = out.data;
  const swaps = e.swaps;
  const k = 1 + e.shine * 0.35;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    let r = d[i], g = d[i + 1], b = d[i + 2];
    const [h, s, v] = rgbToHsv(r, g, b);
    let done = false;
    if (swaps.length && !isMetal(h, s, v)) {
      const [L, A, B] = lab(r, g, b);
      for (const sw of swaps) {
        const dE = Math.hypot((L - sw.L) * 0.5, A - sw.a, B - sw.b);
        if (dE < 24) {
          const vv = Math.min(1, v * 1.05);
          [r, g, b] = sw.to === 'ruby' ? hsvToRgb(350, 0.85, vv) : sw.to === 'emerald' ? hsvToRgb(148, 0.78, vv * 0.85) : sw.to === 'sapphire' ? hsvToRgb(222, 0.85, vv * 0.9)
            : sw.to === 'pink' ? hsvToRgb(332, 0.55, Math.min(1, vv * 1.1)) : sw.to === 'kemp' ? hsvToRgb(355, 0.85, vv * 0.7)
            : sw.to === 'diamond' ? hsvToRgb(210, 0.04, Math.min(1, 0.35 + Math.pow(vv, 0.7) * 0.75)) : sw.to === 'pearl' ? hsvToRgb(38, 0.1, 0.62 + vv * 0.36)
            : hsvToRgb(42, 0.62, Math.min(1, 0.3 + vv * 0.7));
          done = true; break;
        }
      }
    }
    if (!done && e.metal !== 'photo' && isMetal(h, s, v)) {
      if (e.metal === 'yellow') [r, g, b] = hsvToRgb(43, Math.min(1, s * 1.08), v);
      else if (e.metal === 'rose') [r, g, b] = hsvToRgb(16, Math.min(1, s * 0.62), Math.min(1, v * 1.02));
      else { const [rr, gg, bb] = hsvToRgb(215, Math.min(0.06, s * 0.1), Math.min(1, 0.08 + v * 0.98)); r = rr; g = gg; b = bb; }
    }
    if (k !== 1) { r = Math.min(255, r * k); g = Math.min(255, g * k); b = Math.min(255, b * k); }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  return out;
}

