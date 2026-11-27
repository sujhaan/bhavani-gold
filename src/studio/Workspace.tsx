import { useMemo, useState } from 'react';
import { ANCHOR_LABELS, COMPONENTS, COMPONENT_MAP, FAMILIES, buildComponent, type Family, type ParamDef } from '../engine/components';
import { compatibleAnchors, estimateWeight, validate, designBounds } from '../engine/assembly';
import { FINISHES, GEMS, METALS, type GemId, type MetalId } from '../engine/materials';
import { roots, type DesignNode } from '../engine/schema';
import { useStudio } from './store';
import Viewport, { viewportApi } from './Viewport';
import { partThumb } from './thumbs';
import { Icon } from './icons';

// ============================================================ library (left)
export function Library() {
  const mode = useStudio((s) => s.mode);
  const design = useStudio((s) => s.design);
  const selectedId = useStudio((s) => s.selectedId);
  const addPart = useStudio((s) => s.addPart);
  const showToast = useStudio((s) => s.showToast);
  const [fam, setFam] = useState<Family | 'all'>('all');
  const [q, setQ] = useState('');
  const [chooser, setChooser] = useState<{ type: string; anchors: string[] } | null>(null);
  const selected = design.nodes.find((n) => n.id === selectedId) ?? null;
  const hasRoot = roots(design).length > 0;

  const list = COMPONENTS.filter((c) => (mode === 'advanced' || c.beginner))
    .filter((c) => fam === 'all' || c.family === fam)
    .filter((c) => !q || (c.label + ' ' + c.blurb).toLowerCase().includes(q.toLowerCase()))
    .filter((c) => !c.rootFor || c.rootFor.includes(design.category) || design.category === 'custom' || c.accepts.length);

  const fit = (type: string): { ok: boolean; why: string; anchors: string[]; parent?: DesignNode } => {
    const def = COMPONENT_MAP[type];
    if (selected) {
      const a = compatibleAnchors(type, selected);
      if (a.length) return { ok: true, why: `Adds to ${selected.name}`, anchors: a, parent: selected };
    }
    if (def.rootFor && !hasRoot) return { ok: true, why: 'Starts your design', anchors: [] };
    if (def.rootFor && !def.accepts.length) return { ok: true, why: 'Adds a separate base', anchors: [] };
    // find any part it can go on
    const target = design.nodes.find((n) => compatibleAnchors(type, n).length);
    if (target) return { ok: true, why: `Adds to ${target.name}`, anchors: compatibleAnchors(type, target), parent: target };
    return { ok: false, why: selected ? `Doesn't fit on ${selected.name}` : 'Needs a part to sit on', anchors: [] };
  };

  const add = (type: string) => {
    const f = fit(type);
    if (!f.ok) { showToast(`${COMPONENT_MAP[type].label}: ${f.why.toLowerCase()}. Select a compatible part first.`); return; }
    if (f.parent && f.anchors.length > 1 && mode === 'advanced') { setChooser({ type, anchors: f.anchors }); return; }
    addPart(type, f.parent?.id, f.anchors[0]);
  };

  return (
    <aside className="panel library">
      <div className="panel-head"><span className="eyebrow">Component library</span><span className="mono">{COMPONENTS.length} parts</span></div>
      <label className="search"><Icon name="search" /><input placeholder="Search mango, kasu, ruby, hook…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <div className="chips">
        <button className={fam === 'all' ? 'on' : ''} onClick={() => setFam('all')}>All</button>
        {FAMILIES.map((f) => <button key={f.id} className={fam === f.id ? 'on' : ''} onClick={() => setFam(f.id)}>{f.label}</button>)}
      </div>
      {selected && <p className="hint">Adding to: <b>{selected.name}</b> <button className="link" onClick={() => useStudio.getState().select(null)}>clear</button></p>}
      <div className="cards">
        {list.map((c) => {
          const f = fit(c.type);
          return (
            <button key={c.type} className={'part-card' + (f.ok ? '' : ' dim')} onClick={() => add(c.type)} title={c.blurb}>
              <img src={partThumb(c.type)} alt="" loading="lazy" />
              <span className="pc-name">{c.label}</span>
              <span className="pc-why">{f.why}</span>
            </button>
          );
        })}
      </div>
      {chooser && (
        <div className="modal-back" onClick={() => setChooser(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Where should the {COMPONENT_MAP[chooser.type].label.toLowerCase()} go?</h3>
            {chooser.anchors.map((a) => {
              const n = buildComponent(selected!.type, selected!.params).anchors.filter((x) => x.name === a).length;
              return (
                <div key={a} className="row gap">
                  <button className="btn" onClick={() => { addPart(chooser.type, selected!.id, a, true); setChooser(null); }}>{ANCHOR_LABELS[a] ?? a}{n > 1 ? ` — all ${n}` : ''}</button>
                  {n > 1 && <button className="btn outline" onClick={() => { addPart(chooser.type, selected!.id, a, false); setChooser(null); }}>Just one</button>}
                </div>
              );
            })}
            <button className="btn ghost" onClick={() => setChooser(null)}>Cancel</button>
          </div>
        </div>
      )}
    </aside>
  );
}

// ============================================================ properties (right)
function ParamControl({ p, value, onChange, advanced }: { p: ParamDef; value: number | string | boolean; onChange: (v: number | string | boolean) => void; advanced: boolean }) {
  if (p.kind === 'select') {
    if (!advanced && p.options.length <= 6) return (
      <div className="field"><span className="flabel">{p.label}</span>
        <div className="seg wrap">{p.options.map((o) => <button key={o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>{o.label}</button>)}</div>
      </div>
    );
    return <label className="field"><span className="flabel">{p.label}</span><select value={String(value)} onChange={(e) => onChange(e.target.value)}>{p.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>;
  }
  if (p.kind === 'bool') return <label className="field check"><input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} /><span>{p.label}</span></label>;
  const v = Number(value);
  return (
    <div className="field">
      <div className="flabel row between"><span>{p.label}</span>
        {advanced ? <input className="num" type="number" min={p.min} max={p.max} step={p.step} value={v} onChange={(e) => { const x = Number(e.target.value); if (Number.isFinite(x)) onChange(Math.min(p.max, Math.max(p.min, x))); }} />
          : <span className="mono gold">{v}{p.unit ? ` ${p.unit}` : ''}</span>}
      </div>
      <div className="row gap-s">
        {!advanced && <button className="step" aria-label="less" onClick={() => onChange(Math.max(p.min, +(v - p.step).toFixed(3)))}>−</button>}
        <input type="range" min={p.min} max={p.max} step={p.step} value={v} onChange={(e) => onChange(Number(e.target.value))} />
        {!advanced && <button className="step" aria-label="more" onClick={() => onChange(Math.min(p.max, +(v + p.step).toFixed(3)))}>+</button>}
      </div>
      {p.help && <p className="help">{p.help}</p>}
    </div>
  );
}

function Swatches<T extends string>({ items, value, onChange, colour, label }: { items: T[]; value?: T; onChange: (v: T) => void; colour: (v: T) => string; label: (v: T) => string }) {
  return (
    <div className="swatches">
      {items.map((it) => (
        <button key={it} className={'sw' + (it === value ? ' on' : '')} onClick={() => onChange(it)} title={label(it)}>
          <i style={{ background: colour(it) }} /><span>{label(it)}</span>
        </button>
      ))}
    </div>
  );
}

export function Properties() {
  const s = useStudio();
  const n = s.design.nodes.find((x) => x.id === s.selectedId);
  const adv = s.mode === 'advanced';
  if (!n) return <DesignPanel />;
  const def = COMPONENT_MAP[n.type];
  const params = def.params.filter((p) => adv || p.beginner);
  const parent = n.attach ? s.design.nodes.find((x) => x.id === n.attach!.parent) : undefined;
  const replaceable = COMPONENTS.filter((c) => c.family === def.family && c.type !== n.type && (parent ? compatibleAnchors(c.type, parent).includes(n.attach!.anchor) : !!c.rootFor));
  return (
    <aside className="panel props">
      <div className="panel-head"><span className="eyebrow">Selected part</span><button className="iconbtn" title="Close" onClick={() => s.select(null)}><Icon name="x" /></button></div>
      <input className="title-input" value={n.name} onChange={(e) => s.updateNode(n.id, { name: e.target.value })} />
      <p className="muted small">{def.blurb}</p>

      <div className="section-label">Shape &amp; size</div>
      {params.map((p) => <ParamControl key={p.key} p={p} value={n.params[p.key]} advanced={adv} onChange={(v) => s.setParam(n.id, p.key, v)} />)}

      {(def.uses.metal && (n.type !== 'motif-bead' || n.params.beadMat === 'metal') && (n.type !== 'dropBead' || true)) && (<>
        <div className="section-label">Metal</div>
        <Swatches items={Object.keys(METALS) as MetalId[]} value={n.material.metal} onChange={(v) => s.setMaterial(n.id, { metal: v })} colour={(v) => METALS[v].colour} label={(v) => METALS[v].label} />
        <div className="seg">{(Object.keys(FINISHES) as (keyof typeof FINISHES)[]).map((f) => <button key={f} className={n.material.finish === f ? 'on' : ''} onClick={() => s.setMaterial(n.id, { finish: f })}>{FINISHES[f].label}</button>)}</div>
      </>)}
      {def.uses.gem && (<>
        <div className="section-label">Stone</div>
        <Swatches items={Object.keys(GEMS) as GemId[]} value={n.material.gem} onChange={(v) => s.setMaterial(n.id, { gem: v })} colour={(v) => GEMS[v].colour} label={(v) => GEMS[v].label} />
        {n.attach?.all && (
          <label className="field"><span className="flabel">Alternate every other stone with</span>
            <select value={n.material.altGem ?? 'none'} onChange={(e) => s.setMaterial(n.id, { altGem: e.target.value as GemId | 'none' })}>
              <option value="none">No — all the same</option>
              {(Object.keys(GEMS) as GemId[]).map((g) => <option key={g} value={g}>{GEMS[g].label}</option>)}
            </select>
          </label>
        )}
      </>)}

      {parent && (<>
        <div className="section-label">Connection</div>
        <p className="small">Sits on <b>{parent.name}</b> → {ANCHOR_LABELS[n.attach!.anchor] ?? n.attach!.anchor}{n.attach!.all ? ' (every point)' : ''}</p>
        {adv && (
          <div className="row gap-s wrap">
            <select value={n.attach!.anchor} onChange={(e) => s.moveAttach(n.id, parent.id, e.target.value, n.attach!.all)}>
              {compatibleAnchors(n.type, parent).map((a) => <option key={a} value={a}>{ANCHOR_LABELS[a] ?? a}</option>)}
            </select>
            <label className="check small"><input type="checkbox" checked={n.attach!.all} onChange={(e) => s.moveAttach(n.id, parent.id, n.attach!.anchor, e.target.checked)} /> repeat on every point</label>
          </div>
        )}
      </>)}

      {adv && (<>
        <div className="section-label">Position (mm) · rotation (°) · scale</div>
        {(['pos', 'rot'] as const).map((k) => (
          <div className="xyz" key={k}>
            {[0, 1, 2].map((i) => (
              <label key={i}><span>{k === 'pos' ? 'XYZ'[i] : 'XYZ'[i] + '°'}</span>
                <input type="number" step={k === 'pos' ? 0.1 : 5} value={n.offset[k][i]} onChange={(e) => { const o = structuredClone(n.offset); o[k][i] = Number(e.target.value) || 0; s.updateNode(n.id, { offset: o }); }} />
              </label>
            ))}
          </div>
        ))}
        <ParamControl p={{ key: 'scale', label: 'Scale', kind: 'number', min: 0.3, max: 3, step: 0.05, default: 1 }} value={n.offset.scale} advanced onChange={(v) => s.updateNode(n.id, { offset: { ...n.offset, scale: Number(v) } })} />
      </>)}

      <div className="section-label">Actions</div>
      <div className="row gap-s wrap">
        <button className="btn outline small" onClick={() => s.duplicateNode(n.id)}><Icon name="copy" /> Duplicate</button>
        <button className="btn outline small" onClick={() => s.updateNode(n.id, { visible: !n.visible })}><Icon name={n.visible ? 'eye' : 'eyeoff'} /> {n.visible ? 'Hide' : 'Show'}</button>
        <button className="btn danger small" onClick={() => s.removeNode(n.id)}><Icon name="trash" /> Remove</button>
      </div>
      {replaceable.length > 0 && (
        <label className="field"><span className="flabel">Replace with</span>
          <select value="" onChange={(e) => e.target.value && s.replaceNode(n.id, e.target.value)}>
            <option value="">Choose a part…</option>
            {replaceable.map((c) => <option key={c.type} value={c.type}>{c.label}</option>)}
          </select>
        </label>
      )}
    </aside>
  );
}

export function WeightCard({ compact }: { compact?: boolean }) {
  const design = useStudio((s) => s.design);
  const w = useMemo(() => estimateWeight(design), [design]);
  const box = useMemo(() => designBounds(design), [design]);
  const sz = box.isEmpty() ? null : box.getSize(box.min.clone());
  return (
    <div className={'weight' + (compact ? ' compact' : '')}>
      <div className="row between"><span className="eyebrow gold">Preliminary estimate</span><span className="mono">from 3D geometry</span></div>
      <div className="big">{w.theoreticalG.toFixed(2)}<small> g</small></div>
      <p className="small muted">Metal in the model{design.pair ? ' (pair)' : ''}. With {(w.allowance * 100).toFixed(0)}% making allowance ≈ <b>{w.estimatedG.toFixed(2)} g</b>.</p>
      {!compact && w.byMetal.map((m) => <div key={m.metal} className="row between small"><span>{m.label}</span><span className="mono">{m.theoreticalG.toFixed(2)} g</span></div>)}
      {w.stoneCount > 0 && <div className="row between small"><span>Stones</span><span className="mono">{w.stoneCount} pcs · ~{w.stonesCt.toFixed(2)} ct</span></div>}
      {sz && <div className="row between small"><span>Size</span><span className="mono">{sz.x.toFixed(1)} × {sz.y.toFixed(1)} × {sz.z.toFixed(1)} mm</span></div>}
      <p className="fine">Assumes solid metal. Hollow or sheet work weighs less. Final weight, gold rate, making and stone charges are confirmed by Bhavani Gold on WhatsApp.</p>
    </div>
  );
}

function DesignPanel() {
  const s = useStudio();
  const d = s.design;
  return (
    <aside className="panel props">
      <div className="panel-head"><span className="eyebrow">Design</span><span className="mono">{d.id}</span></div>
      <input className="title-input" value={d.name} onChange={(e) => s.rename(e.target.value)} />
      <p className="muted small">Tap any part in the 3D view or the layers list to edit it. Nothing selected = settings for the whole design.</p>
      <WeightCard />
      <div className="section-label">Metal for the whole piece</div>
      <Swatches items={Object.keys(METALS) as MetalId[]} value={d.nodes.find((n) => COMPONENT_MAP[n.type].uses.metal)?.material.metal} onChange={(v) => s.setAllMetal(v)} colour={(v) => METALS[v].colour} label={(v) => METALS[v].label} />
      {(d.category === 'earrings' || d.pair) && <label className="check field"><input type="checkbox" checked={d.pair} onChange={(e) => s.commit((x) => { x.pair = e.target.checked; return x; })} /> Make as a pair</label>}
      <div className="section-label">Your notes for the goldsmith</div>
      <textarea rows={3} placeholder="e.g. Same as my mother's haram but lighter, screw clasp, ready before Sankranti" value={d.notes} onChange={(e) => s.setNotes(e.target.value)} />
      <RefsMini />
    </aside>
  );
}

function RefsMini() {
  const s = useStudio();
  const refs = s.design.refs;
  return (<>
    <div className="section-label row between"><span>Reference photos</span><button className="link" onClick={() => s.go('upload')}>{refs.length ? 'Manage' : 'Add'}</button></div>
    {refs.length === 0 ? <p className="small muted">Add a photo of the piece you want. It shows behind the model so you can compare.</p> : (
      <div className="refgrid">{refs.map((r) => <figure key={r.id}><img src={r.dataUrl} alt={r.name} /><figcaption>{r.view}</figcaption></figure>)}</div>
    )}
    {refs.length > 0 && (<>
      <label className="check small"><input type="checkbox" checked={s.refVisible} onChange={(e) => s.set({ refVisible: e.target.checked })} /> Show behind the 3D model</label>
      <input type="range" min={0.05} max={1} step={0.05} value={s.refOpacity} onChange={(e) => s.set({ refOpacity: Number(e.target.value) })} />
    </>)}
  </>);
}

// ============================================================ hierarchy (bottom)
export function Hierarchy() {
  const s = useStudio();
  const d = s.design;
  const issues = useMemo(() => validate(d), [d]);
  const kids = (id?: string) => d.nodes.filter((n) => (id ? n.attach?.parent === id : !n.attach));
  const counts = useMemo(() => estimateWeight(d).nodes, [d]);
  const row = (n: DesignNode, depth: number): React.ReactNode => {
    const iss = issues.filter((i) => i.nodeId === n.id);
    const c = counts.find((x) => x.nodeId === n.id)?.copies ?? 0;
    return (
      <div key={n.id}>
        <div className={'layer' + (s.selectedId === n.id ? ' on' : '') + (n.visible ? '' : ' hidden')} style={{ paddingLeft: 10 + depth * 16 }} onClick={() => s.select(n.id)}>
          <span className="tree">{depth ? '└' : '◆'}</span>
          <span className="lname">{n.name}</span>
          <span className="mono muted">×{c}</span>
          {iss.length > 0 && <span className={'badge ' + (iss.some((i) => i.level === 'error') ? 'err' : 'warn')} title={iss.map((i) => i.text).join('\n')}>!</span>}
          <button className="iconbtn" title={n.visible ? 'Hide' : 'Show'} onClick={(e) => { e.stopPropagation(); s.updateNode(n.id, { visible: !n.visible }); }}><Icon name={n.visible ? 'eye' : 'eyeoff'} /></button>
        </div>
        {kids(n.id).map((k) => row(k, depth + 1))}
      </div>
    );
  };
  return (
    <section className="hierarchy">
      <div className="panel-head"><span className="eyebrow">Layers</span><span className="mono">{d.nodes.length} parts</span></div>
      <div className="layers">{kids().map((n) => row(n, 0))}{d.nodes.length === 0 && <p className="small muted pad">No parts yet. Pick a base structure from the library.</p>}</div>
      {issues.length > 0 && (
        <div className="issues">
          {issues.slice(0, 4).map((i, k) => <p key={k} className={'issue ' + i.level} onClick={() => i.nodeId && s.select(i.nodeId)}>{i.level === 'error' ? '✕' : '!'} {i.text}</p>)}
        </div>
      )}
    </section>
  );
}

// ============================================================ viewport chrome
export function ViewportArea() {
  const s = useStudio();
  return (
    <div className="viewport">
      <Viewport />
      <div className="vp-top">
        {(['perspective', 'front', 'side', 'back', 'top'] as const).map((v) => <button key={v} className={'chip' + (s.view.name === v ? ' on' : '')} onClick={() => s.setView(v)}>{v === 'perspective' ? '3D' : v}</button>)}
      </div>
      <div className="vp-right">
        <button className="round" title="Reset camera" onClick={() => s.setView('perspective')}><Icon name="reset" /></button>
        <button className={'round' + (s.grid ? ' on' : '')} title="Grid (1 mm / 10 mm)" onClick={() => s.set({ grid: !s.grid })}><Icon name="grid" /></button>
        <button className={'round' + (s.dims ? ' on' : '')} title="Dimensions" onClick={() => s.set({ dims: !s.dims })}><Icon name="ruler" /></button>
        <button className={'round' + (s.ortho ? ' on' : '')} title="Orthographic view" onClick={() => s.set({ ortho: !s.ortho })}><Icon name="cube" /></button>
        {s.design.refs.length > 0 && <button className={'round' + (s.refVisible ? ' on' : '')} title="Reference photo" onClick={() => s.set({ refVisible: !s.refVisible })}><Icon name="image" /></button>}
        <button className="round" title="Full screen" onClick={() => viewportApi.fullscreen?.()}><Icon name="full" /></button>
      </div>
      <div className="vp-bottom">
        <span className="mono muted">Light</span>
        {([['studio', 'Studio daylight'], ['temple', 'Warm temple'], ['noir', 'Evening']] as const).map(([k, l]) => <button key={k} className={'chip' + (s.light === k ? ' on' : '')} onClick={() => s.set({ light: k })}>{l}</button>)}
      </div>
      {s.design.nodes.length === 0 && <div className="vp-empty"><p>Your 3D model appears here.</p><p className="muted">Pick a <b>base structure</b> from the library to begin.</p></div>}
      <p className="vp-help mono">Drag to rotate · pinch/scroll to zoom · tap a part</p>
    </div>
  );
}
