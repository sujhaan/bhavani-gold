import { create } from 'zustand';
import { COMPONENT_MAP, defaultParams, buildComponent } from '../engine/components';
import { compatibleAnchors } from '../engine/assembly';
import { descendants, uid, ZERO_OFFSET, type Category, type Design, type DesignNode, type RefImage } from '../engine/schema';
import { emptyDesign, instantiate, type Template } from '../engine/templates';
import type { GemId, MetalId } from '../engine/materials';

export type Screen = 'entry' | 'category' | 'templates' | 'upload' | 'workspace' | 'summary' | 'submit' | 'saved';
export type Mode = 'beginner' | 'advanced';
export type Light = 'studio' | 'temple' | 'noir';
export type ViewName = 'perspective' | 'front' | 'back' | 'side' | 'top' | 'ring';

export interface SavedEntry { id: string; name: string; category: Category; updatedAt: string; design: Design; versions: { at: string; label: string; design: Design }[] }

const LS_KEY = 'bhavani.studio.designs.v1';
const LS_LAST = 'bhavani.studio.last.v1';

function loadSaved(): SavedEntry[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
function storeSaved(list: SavedEntry[]): boolean {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); return true; } catch { return false; }
}

interface State {
  screen: Screen;
  mode: Mode;
  category: Category;
  design: Design;
  selectedId: string | null;
  past: Design[];
  future: Design[];
  dirty: boolean;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'unsaved';
  lastSavedAt?: string;
  saved: SavedEntry[];
  // viewport
  light: Light;
  grid: boolean;
  dims: boolean;
  ortho: boolean;
  refVisible: boolean;
  refOpacity: number;
  view: { name: ViewName; nonce: number };
  toast: string | null;
  confirm: { text: string; ok: string; onOk: () => void } | null;
  pendingAdd: string | null; // component type waiting for a place to attach
  captures: Record<string, string>;

  go: (s: Screen) => void;
  setMode: (m: Mode) => void;
  setCategory: (c: Category) => void;
  startTemplate: (t: Template) => void;
  startBlank: (c: Category) => void;
  loadDesign: (d: Design) => void;
  commit: (fn: (d: Design) => Design, opts?: { silent?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  select: (id: string | null) => void;
  updateNode: (id: string, patch: Partial<DesignNode>) => void;
  setParam: (id: string, key: string, value: number | string | boolean) => void;
  setMaterial: (id: string, patch: Partial<{ metal: MetalId; finish: 'polished' | 'matte' | 'antique'; gem: GemId; altGem: GemId | 'none' }>) => void;
  setAllMetal: (metal: MetalId) => void;
  addPart: (type: string, parentId?: string, anchor?: string, all?: boolean) => string | null;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  replaceNode: (id: string, type: string) => void;
  moveAttach: (id: string, parentId: string, anchor: string, all: boolean) => void;
  addRefs: (refs: RefImage[]) => void;
  removeRef: (id: string) => void;
  updateRef: (id: string, patch: Partial<RefImage>) => void;
  rename: (name: string) => void;
  setNotes: (notes: string) => void;
  save: (label?: string) => void;
  restoreVersion: (entryId: string, index: number) => void;
  deleteSaved: (entryId: string) => void;
  duplicateDesign: () => void;
  setView: (name: ViewName) => void;
  set: (p: Partial<State>) => void;
  showToast: (t: string) => void;
  ask: (text: string, ok: string, onOk: () => void) => void;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
let toastTimer: number | undefined;
let autosaveTimer: number | undefined;

export const useStudio = create<State>((set, get) => ({
  screen: 'entry',
  mode: 'beginner',
  category: 'necklaces',
  design: emptyDesign('necklaces'),
  selectedId: null,
  past: [],
  future: [],
  dirty: false,
  saveStatus: 'idle',
  saved: loadSaved(),
  light: 'studio',
  grid: false,
  dims: false,
  ortho: false,
  refVisible: true,
  refOpacity: 0.35,
  view: { name: 'perspective', nonce: 0 },
  toast: null,
  confirm: null,
  pendingAdd: null,
  captures: {},

  go: (screen) => set({ screen }),
  setMode: (mode) => set({ mode }),
  setCategory: (category) => set({ category }),
  set: (p) => set(p),
  showToast: (t) => { set({ toast: t }); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => set({ toast: null }), 2600); },
  ask: (text, ok, onOk) => set({ confirm: { text, ok, onOk } }),

  startTemplate: (t) => {
    const d = instantiate(t);
    d.refs = get().design.refs.length && get().design.nodes.length === 0 ? get().design.refs : [];
    set({ design: d, category: t.category, past: [], future: [], selectedId: null, screen: 'workspace', dirty: true, saveStatus: 'unsaved', view: { name: ['necklaces', 'chains', 'pendants', 'earrings'].includes(t.category) ? 'front' : 'perspective', nonce: Date.now() } });
    scheduleAutosave();
  },
  startBlank: (c) => {
    const refs = get().design.nodes.length === 0 ? get().design.refs : [];
    const d = emptyDesign(c); d.refs = refs;
    set({ design: d, category: c, past: [], future: [], selectedId: null, screen: 'workspace', dirty: true, saveStatus: 'unsaved' });
  },
  loadDesign: (d) => set({ design: clone(d), category: d.category, past: [], future: [], selectedId: null, screen: 'workspace', dirty: false, saveStatus: 'saved', view: { name: 'perspective', nonce: Date.now() } }),

  commit: (fn, opts) => {
    const before = get().design;
    const after = fn(clone(before));
    after.updatedAt = new Date().toISOString();
    set({ design: after, past: opts?.silent ? get().past : [...get().past.slice(-79), before], future: [], dirty: true, saveStatus: 'unsaved' });
    scheduleAutosave();
  },
  undo: () => {
    const { past, design, future } = get();
    if (!past.length) return;
    const prev = past[past.length - 1];
    set({ design: prev, past: past.slice(0, -1), future: [design, ...future], dirty: true, saveStatus: 'unsaved', selectedId: prev.nodes.some((n) => n.id === get().selectedId) ? get().selectedId : null });
    scheduleAutosave();
  },
  redo: () => {
    const { past, design, future } = get();
    if (!future.length) return;
    const next = future[0];
    set({ design: next, past: [...past, design], future: future.slice(1), dirty: true, saveStatus: 'unsaved' });
    scheduleAutosave();
  },
  select: (id) => set({ selectedId: id }),

  updateNode: (id, patch) => get().commit((d) => { const n = d.nodes.find((x) => x.id === id); if (n) Object.assign(n, patch); return d; }),
  setParam: (id, key, value) => get().commit((d) => {
    const n = d.nodes.find((x) => x.id === id); if (!n) return d;
    n.params[key] = value;
    // keep a stone matched to its setting when the setting changes size/shape
    if (n.type.startsWith('setting-') && (key === 'size' || key === 'shape' || key === 'ratio')) {
      for (const c of d.nodes) if (c.attach?.parent === id && c.type === 'stone') c.params[key] = value;
    }
    return d;
  }),
  setMaterial: (id, patch) => get().commit((d) => { const n = d.nodes.find((x) => x.id === id); if (n) n.material = { ...n.material, ...patch }; return d; }),
  setAllMetal: (metal) => get().commit((d) => { d.nodes.forEach((n) => { if (COMPONENT_MAP[n.type].uses.metal) n.material.metal = metal; }); return d; }),

  addPart: (type, parentId, anchor, all) => {
    const def = COMPONENT_MAP[type];
    const d = get().design;
    const id = uid();
    const metal = d.nodes.find((n) => COMPONENT_MAP[n.type]?.uses.metal)?.material.metal ?? '22k-yellow';
    const finish = d.nodes[0]?.material.finish ?? 'polished';
    let attach: DesignNode['attach'];
    if (parentId) {
      const parent = d.nodes.find((n) => n.id === parentId);
      if (!parent) return null;
      const a = anchor ?? compatibleAnchors(type, parent)[0];
      if (!a) { get().showToast(`${def.label} can't attach to ${parent.name}.`); return null; }
      const count = buildComponent(parent.type, parent.params).anchors.filter((x) => x.name === a).length;
      attach = { parent: parentId, anchor: a, all: all ?? count > 1 };
    } else if (!def.rootFor) {
      get().showToast(`Select a part first — ${def.label} needs something to sit on.`);
      return null;
    }
    const params = defaultParams(type);
    if (type === 'stone' && parentId) {
      const parent = d.nodes.find((n) => n.id === parentId)!;
      if (parent.type.startsWith('setting-')) { params.size = parent.params.size; params.shape = parent.params.shape; params.ratio = parent.params.ratio; }
    }
    const node: DesignNode = {
      id, type, name: def.label, params,
      material: { metal, finish, gem: def.uses.gem ? (type === 'dropBead' || params.beadMat === 'pearl' ? 'pearl' : 'ruby') : undefined, altGem: 'none' },
      attach, offset: clone(ZERO_OFFSET), visible: true, locked: false,
    };
    get().commit((x) => { x.nodes.push(node); return x; });
    set({ selectedId: id, pendingAdd: null });
    return id;
  },
  removeNode: (id) => {
    const d = get().design;
    const n = d.nodes.find((x) => x.id === id); if (!n) return;
    const kids = descendants(d, id);
    const doIt = () => { get().commit((x) => { const kill = new Set([id, ...kids]); x.nodes = x.nodes.filter((m) => !kill.has(m.id)); return x; }); set({ selectedId: n.attach?.parent ?? null }); get().showToast(`Removed ${n.name}${kids.length ? ` and ${kids.length} attached part${kids.length > 1 ? 's' : ''}` : ''}. Undo to bring back.`); };
    if (kids.length) get().ask(`Remove ${n.name}? ${kids.length} part${kids.length > 1 ? 's' : ''} attached to it will be removed too.`, 'Remove', doIt);
    else doIt();
  },
  duplicateNode: (id) => {
    const d = get().design;
    const src = d.nodes.find((x) => x.id === id); if (!src) return;
    const ids = [id, ...descendants(d, id)];
    const map = new Map(ids.map((i) => [i, uid()] as const));
    const copies = ids.map((i) => {
      const n = clone(d.nodes.find((x) => x.id === i)!);
      n.id = map.get(i)!;
      if (n.attach && map.has(n.attach.parent)) n.attach.parent = map.get(n.attach.parent)!;
      return n;
    });
    copies[0].name = src.name + ' copy';
    if (!src.attach) copies[0].offset.pos = [src.offset.pos[0] + 8, src.offset.pos[1], src.offset.pos[2]];
    else copies[0].offset.pos = [src.offset.pos[0] + 1.5, src.offset.pos[1], src.offset.pos[2]];
    get().commit((x) => { x.nodes.push(...copies); return x; });
    set({ selectedId: copies[0].id });
  },
  replaceNode: (id, type) => {
    const def = COMPONENT_MAP[type];
    get().commit((d) => {
      const n = d.nodes.find((x) => x.id === id); if (!n) return d;
      const keep: Record<string, number | string | boolean> = {};
      const params = defaultParams(type);
      for (const k of Object.keys(params)) if (k in n.params && typeof n.params[k] === typeof params[k]) keep[k] = n.params[k];
      n.type = type; n.name = def.label; n.params = { ...params, ...keep };
      if (def.uses.gem && !n.material.gem) n.material.gem = 'ruby';
      return d;
    });
  },
  moveAttach: (id, parentId, anchor, all) => get().commit((d) => { const n = d.nodes.find((x) => x.id === id); if (n) n.attach = { parent: parentId, anchor, all }; return d; }),

  addRefs: (refs) => get().commit((d) => { d.refs.push(...refs); return d; }, { silent: true }),
  removeRef: (id) => get().commit((d) => { d.refs = d.refs.filter((r) => r.id !== id); return d; }, { silent: true }),
  updateRef: (id, patch) => get().commit((d) => { const r = d.refs.find((x) => x.id === id); if (r) Object.assign(r, patch); return d; }, { silent: true }),
  rename: (name) => get().commit((d) => { d.name = name; return d; }, { silent: true }),
  setNotes: (notes) => get().commit((d) => { d.notes = notes; return d; }, { silent: true }),

  save: (label) => {
    const d = clone(get().design);
    set({ saveStatus: 'saving' });
    const list = loadSaved();
    let e = list.find((x) => x.id === d.id);
    const now = new Date().toISOString();
    if (!e) { e = { id: d.id, name: d.name, category: d.category, updatedAt: now, design: d, versions: [] }; list.unshift(e); }
    e.name = d.name; e.category = d.category; e.updatedAt = now; e.design = d;
    if (label) { e.versions.unshift({ at: now, label, design: d }); e.versions = e.versions.slice(0, 15); }
    // reference photos can be large: keep them only in the latest copy
    e.versions.forEach((v) => (v.design.refs = []));
    let ok = storeSaved(list);
    if (!ok) { e.design.refs = []; ok = storeSaved(list); if (ok) get().showToast('Saved without reference photos (browser storage is full).'); }
    try { localStorage.setItem(LS_LAST, d.id); } catch { /* ignore */ }
    set({ saved: list, saveStatus: ok ? 'saved' : 'error', dirty: !ok, lastSavedAt: now });
    if (label && ok) get().showToast(`Version saved: ${label}`);
    if (!ok) get().showToast('Could not save in this browser. Use "Copy design code" to keep it.');
  },
  restoreVersion: (entryId, index) => {
    const e = loadSaved().find((x) => x.id === entryId); if (!e) return;
    const v = index < 0 ? e.design : e.versions[index]?.design; if (!v) return;
    const current = get().design;
    get().loadDesign({ ...v, refs: v.refs.length ? v.refs : current.id === v.id ? current.refs : [] });
    set({ dirty: true, saveStatus: 'unsaved' });
    get().showToast(index < 0 ? 'Opened design' : 'Version restored — save to keep it');
  },
  deleteSaved: (entryId) => { const list = loadSaved().filter((x) => x.id !== entryId); storeSaved(list); set({ saved: list }); },
  duplicateDesign: () => {
    const d = clone(get().design);
    const ids = new Map(d.nodes.map((n) => [n.id, uid()] as const));
    d.nodes.forEach((n) => { n.id = ids.get(n.id)!; if (n.attach) n.attach.parent = ids.get(n.attach.parent) ?? n.attach.parent; });
    d.id = d.id.replace(/-[A-Z0-9]{4}$/, '-' + Math.random().toString(36).slice(2, 6).toUpperCase());
    d.name = d.name + ' (copy)';
    get().loadDesign(d);
    set({ dirty: true, saveStatus: 'unsaved' });
    get().showToast('Duplicated. You are now editing the copy.');
  },
  setView: (name) => set({ view: { name, nonce: Date.now() } }),
}));

function scheduleAutosave() {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    const s = useStudio.getState();
    if (s.design.nodes.length && s.screen !== 'entry') s.save();
  }, 1800);
}

export function lastDesignId(): string | null {
  try { return localStorage.getItem(LS_LAST); } catch { return null; }
}
