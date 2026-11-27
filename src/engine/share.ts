// Design codes (so the shop can reopen a customer's exact design) and the WhatsApp hand-off message.
import { COMPONENT_MAP } from './components';
import type { WeightReport } from './assembly';
import { GEMS, METALS, FINISHES } from './materials';
import type { Design } from './schema';
import { CATEGORIES } from './schema';

export const SHOP = {
  name: 'Bhavani Gold',
  whatsapp: '917780431116',
  whatsappDisplay: '+91 77804 31116',
  address: 'Jenda Street, near Raj Silver Palace, Vijayawada, Andhra Pradesh',
};

const b64url = (bytes: Uint8Array) => {
  let s = ''; bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromB64url = (s: string) => {
  const t = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** Compact, URL-safe code for a design (reference photos are not included). */
export async function encodeDesign(d: Design): Promise<string> {
  const lean = { ...d, refs: [] };
  const raw = new TextEncoder().encode(JSON.stringify(lean));
  if (typeof CompressionStream !== 'undefined') return 'z' + b64url(await pipe(raw, new CompressionStream('deflate-raw')));
  return 'j' + b64url(raw);
}

export async function decodeDesign(code: string): Promise<Design> {
  const c = code.trim().replace(/^.*BHV:/, '').split(/\s/)[0];
  const body = fromB64url(c.slice(1));
  const raw = c[0] === 'z' ? await pipe(body, new DecompressionStream('deflate-raw')) : body;
  const d = JSON.parse(new TextDecoder().decode(raw)) as Design;
  if (d.schema !== 'bhavani.design/1' || !Array.isArray(d.nodes)) throw new Error('This is not a Bhavani design code.');
  for (const n of d.nodes) if (!COMPONENT_MAP[n.type]) throw new Error(`Unknown part in design: ${n.type}`);
  return d;
}

export function partsSummary(d: Design, w: WeightReport): string[] {
  return d.nodes.filter((n) => n.visible).map((n) => {
    const def = COMPONENT_MAP[n.type];
    const copies = w.nodes.find((x) => x.nodeId === n.id)?.copies ?? 0;
    const bits: string[] = [];
    if (def.uses.metal && (n.type !== 'stone')) bits.push(`${METALS[n.material.metal].label}, ${FINISHES[n.material.finish].label.toLowerCase()}`);
    if (def.uses.gem && n.material.gem) bits.push(GEMS[n.material.gem].label + (n.material.altGem && n.material.altGem !== 'none' ? ` / ${GEMS[n.material.altGem].label}` : ''));
    const keyParams = def.params.filter((p) => p.beginner).map((p) => `${p.label.toLowerCase()} ${n.params[p.key]}${'unit' in p && p.unit ? p.unit : ''}`).slice(0, 3);
    return `• ${n.name} ×${copies} — ${[...keyParams, ...bits].join(', ')}`;
  });
}

export interface SubmitInfo { name: string; requests: string[]; notes: string; code: string; dims?: string }

export function whatsappMessage(d: Design, w: WeightReport, info: SubmitInfo): string {
  const cat = CATEGORIES.find((c) => c.id === d.category)?.label ?? d.category;
  const lines = [
    `Hello ${SHOP.name}, I designed a piece in your 3D studio.`,
    ``,
    `Design ID: ${d.id}`,
    `Name: ${d.name}`,
    `Category: ${cat}${d.pair ? ' (pair)' : ''}`,
    info.name ? `Customer: ${info.name}` : '',
    info.dims ? `Size: ${info.dims}` : '',
    ``,
    `Parts:`,
    ...partsSummary(d, w),
    ``,
    `Preliminary gold estimate from 3D geometry: ~${w.theoreticalG.toFixed(2)} g (about ${w.estimatedG.toFixed(2)} g with ${(w.allowance * 100).toFixed(0)}% making allowance). Not a final weight.`,
    w.stoneCount ? `Stones: ${w.stoneCount} pcs, ~${w.stonesCt.toFixed(2)} ct (estimate)` : '',
    ``,
    info.requests.length ? `Please tell me: ${info.requests.join(', ')}.` : '',
    info.notes ? `My notes: ${info.notes}` : '',
    d.refs.length ? `I have ${d.refs.length} reference photo(s) and a summary image to send in this chat.` : 'I will send the summary image in this chat.',
    ``,
    `Design code (to open my exact design): BHV:${info.code}`,
  ];
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).filter((l) => l !== undefined).join('\n').replace(/\n{3,}/g, '\n\n');
}

export function waLink(text: string): string {
  return `https://wa.me/${SHOP.whatsapp}?text=${encodeURIComponent(text)}`;
}
