// Design data model. Independent of the renderer: a design can be rebuilt exactly from this JSON.
import type { FinishId, GemId, MetalId } from './materials';

export type Category = 'rings' | 'bangles' | 'earrings' | 'necklaces' | 'chains' | 'pendants' | 'bracelets' | 'custom';

export const CATEGORIES: { id: Category; label: string; blurb: string }[] = [
  { id: 'necklaces', label: 'Necklaces', blurb: 'Harams, chokers, kasu malas' },
  { id: 'earrings', label: 'Earrings', blurb: 'Studs, jhumkas, drops, hoops' },
  { id: 'bangles', label: 'Bangles', blurb: 'Kadas, twisted, stone-set' },
  { id: 'rings', label: 'Rings', blurb: 'Bands, solitaires, motif rings' },
  { id: 'pendants', label: 'Pendants', blurb: 'Peacock, temple, floral' },
  { id: 'chains', label: 'Chains', blurb: 'Cable, rope, box, ball' },
  { id: 'bracelets', label: 'Bracelets', blurb: 'Link and charm bracelets' },
  { id: 'custom', label: 'Custom', blurb: 'Start from any base' },
];

export type ParamValue = number | string | boolean;

export interface NodeMaterial { metal: MetalId; finish: FinishId; gem?: GemId; altGem?: GemId | 'none' }

export interface Attach {
  parent: string;
  /** Anchor name on the parent, e.g. "top", "station", "drop". */
  anchor: string;
  /** Place a copy at every anchor with this name (e.g. one stone per motif). */
  all: boolean;
  index?: number;
}

export interface Offset { pos: [number, number, number]; rot: [number, number, number]; scale: number }

export interface DesignNode {
  id: string;
  type: string;
  name: string;
  params: Record<string, ParamValue>;
  material: NodeMaterial;
  attach?: Attach;
  offset: Offset;
  visible: boolean;
  locked: boolean;
}

export type RefView = 'front' | 'side' | 'back' | 'detail';
export interface RefImage { id: string; view: RefView; name: string; dataUrl: string; w: number; h: number }

export interface Design {
  schema: 'bhavani.design/1';
  id: string;
  name: string;
  category: Category;
  templateId?: string;
  /** Earrings are made as a pair: geometry is counted twice for weight. */
  pair: boolean;
  nodes: DesignNode[];
  refs: RefImage[];
  notes: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const ZERO_OFFSET: Offset = { pos: [0, 0, 0], rot: [0, 0, 0], scale: 1 };

let counter = 0;
export function uid(prefix = 'n'): string {
  counter = (counter + 1) % 1296;
  return prefix + '_' + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6) + counter.toString(36);
}

export function designId(): string {
  const d = new Date();
  const ymd = String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `BH-${ymd}-${rnd}`;
}

export function childrenOf(d: Design, id: string): DesignNode[] {
  return d.nodes.filter((n) => n.attach?.parent === id);
}

export function descendants(d: Design, id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string) => { for (const c of childrenOf(d, pid)) { out.push(c.id); walk(c.id); } };
  walk(id);
  return out;
}

export function roots(d: Design): DesignNode[] {
  return d.nodes.filter((n) => !n.attach);
}
