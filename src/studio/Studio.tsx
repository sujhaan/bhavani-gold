import { useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORIES, uid, type Category, type RefImage, type RefView } from '../engine/schema';
import { TEMPLATES } from '../engine/templates';
import { estimateWeight, designBounds, validate } from '../engine/assembly';
import { decodeDesign, encodeDesign, partsSummary, SHOP, waLink, whatsappMessage } from '../engine/share';
import { lastDesignId, useStudio } from './store';
import { Hierarchy, Library, Properties, ViewportArea, WeightCard } from './Workspace';
import { viewportApi } from './Viewport';
import { designThumb } from './thumbs';
import { Icon } from './icons';

type Flow = 'template' | 'blank' | 'upload';

// ------------------------------------------------------------ utilities
async function fileToRef(file: File, view: RefView): Promise<RefImage> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: please use JPG, PNG or WEBP.`);
  if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: file is larger than 15 MB.`);
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`${file.name}: could not read this image.`)); i.src = url; });
    const k = Math.min(1, 1400 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { id: uid('r'), view, name: file.name, dataUrl: c.toDataURL('image/jpeg', 0.85), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}

function tryDownload(blob: Blob, name: string) {
  try {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch { /* the preview frame may block downloads */ }
}

async function copyText(t: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(t); return true; } catch { return false; }
}

// ------------------------------------------------------------ shared chrome
function Toast() {
  const t = useStudio((s) => s.toast);
  return t ? <div className="toast"><span className="gold">✦</span> {t}</div> : null;
}

function Confirm() {
  const c = useStudio((s) => s.confirm);
  const set = useStudio((s) => s.set);
  if (!c) return null;
  return (
    <div className="modal-back" onClick={() => set({ confirm: null })}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <p>{c.text}</p>
        <div className="row gap end">
          <button className="btn ghost" onClick={() => set({ confirm: null })}>Cancel</button>
          <button className="btn danger" onClick={() => { c.onOk(); set({ confirm: null }); }}>{c.ok}</button>
        </div>
      </div>
    </div>
  );
}

function StudioHeader({ children, back }: { children?: React.ReactNode; back?: () => void }) {
  const mode = useStudio((s) => s.mode);
  const setMode = useStudio((s) => s.setMode);
  return (
    <header className="studio-head">
      <div className="row gap">
        {back ? <button className="iconbtn big" onClick={back} title="Back"><Icon name="back" size={18} /></button> : <a className="iconbtn big" href="#home" title="Back to website"><Icon name="back" size={18} /></a>}
        <a href="#home" className="brand-sm">BHAVANI<small>3D Jewellery Studio</small></a>
      </div>
      <div className="row gap">{children}
        <div className="seg mini" title="Beginner shows simple controls; Advanced shows every measurement">
          <button className={mode === 'beginner' ? 'on' : ''} onClick={() => setMode('beginner')}>Beginner</button>
          <button className={mode === 'advanced' ? 'on' : ''} onClick={() => setMode('advanced')}>Advanced</button>
        </div>
      </div>
    </header>
  );
}

// ------------------------------------------------------------ entry
function Entry({ setFlow }: { setFlow: (f: Flow) => void }) {
  const s = useStudio();
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const last = lastDesignId();
  const lastEntry = s.saved.find((x) => x.id === last) ?? s.saved[0];
  const open = async () => {
    setErr('');
    try { s.loadDesign(await decodeDesign(code)); } catch (e) { setErr((e as Error).message || 'That code could not be read.'); }
  };
  return (
    <div className="studio-page">
      <StudioHeader />
      <div className="entry">
        <p className="eyebrow gold">Bhavani 3D Jewellery Studio</p>
        <h1 className="display">Your imagination.<br />Crafted in gold.</h1>
        <p className="lead">Design your own jewellery in real 3D: pick a base, add motifs, stones and drops, change every size, and send it to us on WhatsApp for a quotation.</p>
        <div className="entry-cards">
          <button className="entry-card" onClick={() => { setFlow('template'); s.go('category'); }}>
            <span className="num">01</span><h3>Explore ready-made designs</h3><p>Start from a haram, jhumka, kada or ring we have set up, then change anything.</p><span className="go">Browse designs <Icon name="arrow" /></span>
          </button>
          <button className="entry-card" onClick={() => { setFlow('upload'); s.go('upload'); }}>
            <span className="num">02</span><h3>Upload my inspiration</h3><p>Add photos of a piece you love. They sit behind your 3D model so you can match it.</p><span className="go">Add photos <Icon name="arrow" /></span>
          </button>
          <button className="entry-card" onClick={() => { setFlow('blank'); s.go('category'); }}>
            <span className="num">03</span><h3>Build from scratch</h3><p>Choose a base structure and build the piece part by part.</p><span className="go">Start empty <Icon name="arrow" /></span>
          </button>
        </div>
        <div className="entry-more">
          <div>
            <p className="section-label">Continue</p>
            {lastEntry ? (
              <button className="saved-row" onClick={() => s.restoreVersion(lastEntry.id, -1)}>
                <img src={designThumb(lastEntry.design, 96, 'saved:' + lastEntry.id + lastEntry.updatedAt)} alt="" />
                <span><b>{lastEntry.name}</b><small>{lastEntry.design.id} · saved {new Date(lastEntry.updatedAt).toLocaleString()}</small></span>
                <Icon name="arrow" />
              </button>
            ) : <p className="small muted">Designs you make are saved in this browser automatically.</p>}
            {s.saved.length > 1 && <button className="link" onClick={() => s.go('saved')}>All saved designs ({s.saved.length})</button>}
          </div>
          <div>
            <p className="section-label">Open a design code</p>
            <div className="row gap-s"><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Paste BHV:… code from WhatsApp" /><button className="btn" onClick={open} disabled={!code.trim()}>Open</button></div>
            {err && <p className="error small">{err}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ category
const CAT_ICON: Record<Category, string> = { necklaces: 'mango-haram', earrings: 'temple-jhumka', bangles: 'peacock-kada', rings: 'solitaire', pendants: 'peacock-pendant', chains: 'rope-chain', bracelets: 'charm-bracelet', custom: 'floral-stud' };

function CategoryScreen({ flow }: { flow: Flow }) {
  const s = useStudio();
  return (
    <div className="studio-page">
      <StudioHeader back={() => s.go(flow === 'upload' ? 'upload' : 'entry')} />
      <div className="wrap-page">
        <p className="eyebrow gold">Step 1</p>
        <h2 className="h2">What would you like to make?</h2>
        <div className="cat-grid">
          {CATEGORIES.map((c) => {
            const t = TEMPLATES.find((x) => x.id === CAT_ICON[c.id])!;
            return (
              <button key={c.id} className="cat-card" onClick={() => { s.setCategory(c.id); if (flow === 'blank') s.startBlank(c.id); else s.go('templates'); }}>
                <TemplateThumb id={t.id} />
                <h3>{c.label}</h3><p>{c.blurb}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TemplateThumb({ id }: { id: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    const t = TEMPLATES.find((x) => x.id === id)!;
    const h = window.setTimeout(async () => {
      const { instantiate } = await import('../engine/templates');
      if (alive) setSrc(designThumb(instantiate(t), 300, 'tpl:' + id));
    }, 30);
    return () => { alive = false; window.clearTimeout(h); };
  }, [id]);
  return <div className="thumb">{src ? <img src={src} alt="" /> : <span className="spinner" />}</div>;
}

function TemplatesScreen() {
  const s = useStudio();
  const list = TEMPLATES.filter((t) => s.category === 'custom' || t.category === s.category);
  const label = CATEGORIES.find((c) => c.id === s.category)?.label;
  return (
    <div className="studio-page">
      <StudioHeader back={() => s.go('category')} />
      <div className="wrap-page">
        <p className="eyebrow gold">Step 2 · {label}</p>
        <h2 className="h2">Choose a starting design</h2>
        <p className="lead">Every design is made of editable parts. Pick the closest one — you can change all of it.</p>
        <div className="tpl-grid">
          <button className="tpl-card blank" onClick={() => s.startBlank(s.category)}>
            <div className="thumb"><Icon name="plus" size={36} /></div><h3>Start from scratch</h3><p>Empty canvas with the {label?.toLowerCase()} parts library.</p>
          </button>
          {list.map((t) => (
            <button key={t.id} className="tpl-card" onClick={() => s.startTemplate(t)}>
              <TemplateThumb id={t.id} /><h3>{t.name}</h3><p>{t.blurb}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ upload
function UploadScreen({ flow, setFlow }: { flow: Flow; setFlow: (f: Flow) => void }) {
  const s = useStudio();
  const refs = s.design.refs;
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | null>(null);
  const take = async (files: FileList | File[]) => {
    setBusy(true); const e: string[] = []; const out: RefImage[] = [];
    const views: RefView[] = ['front', 'side', 'back', 'detail'];
    for (const f of Array.from(files).slice(0, 8)) {
      try { out.push(await fileToRef(f, views[Math.min(refs.length + out.length, 3)])); } catch (x) { e.push((x as Error).message); }
    }
    if (replaceId.current && out[0]) { const old = refs.find((r) => r.id === replaceId.current); if (old) { s.updateRef(old.id, { ...out[0], id: old.id, view: old.view }); out.shift(); } replaceId.current = null; }
    if (out.length) s.addRefs(out);
    setErrs(e); setBusy(false);
  };
  const inWorkspace = s.design.nodes.length > 0;
  return (
    <div className="studio-page">
      <StudioHeader back={() => s.go(inWorkspace ? 'workspace' : 'entry')} />
      <div className="wrap-page narrow">
        <p className="eyebrow gold">Reference photos</p>
        <h2 className="h2">Upload your inspiration</h2>
        <div className="note">
          <b>Good to know:</b> a photo is a <i>reference</i>, not a 3D model. The studio does not turn a photo into CAD automatically. You build the piece from editable 3D parts, and the photo sits behind the model so you can match shapes and proportions. Our goldsmith also sees your photos when you send the design.
        </div>
        <div className={'dropzone' + (busy ? ' busy' : '')} onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); take(e.dataTransfer.files); }}>
          <Icon name="upload" size={28} />
          <p className="serif">Drop photos here or tap to choose</p>
          <p className="small muted">JPG, PNG or WEBP · up to 15 MB each · front, side and back views help most</p>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => e.target.files && take(e.target.files)} />
        </div>
        {busy && <p className="small">Preparing photos…</p>}
        {errs.map((e, i) => <p key={i} className="error small">{e}</p>)}
        {refs.length > 0 && (
          <div className="ref-list">
            {refs.map((r) => (
              <div key={r.id} className="ref-item">
                <img src={r.dataUrl} alt={r.name} />
                <div className="grow">
                  <p className="small"><b>{r.name}</b></p>
                  <div className="seg mini">{(['front', 'side', 'back', 'detail'] as RefView[]).map((v) => <button key={v} className={r.view === v ? 'on' : ''} onClick={() => s.updateRef(r.id, { view: v })}>{v}</button>)}</div>
                  <div className="row gap-s"><button className="link" onClick={() => { replaceId.current = r.id; input.current?.click(); }}>Replace</button><button className="link danger" onClick={() => s.removeRef(r.id)}>Remove</button></div>
                </div>
              </div>
            ))}
          </div>
        )}
        <label className="field"><span className="flabel">Describe what you want (optional)</span>
          <textarea rows={3} value={s.design.notes} onChange={(e) => s.setNotes(e.target.value)} placeholder="e.g. Like this haram but with green stones only and 20 inches long" />
        </label>
        <div className="row gap end">
          {inWorkspace ? <button className="btn" onClick={() => s.go('workspace')}>Back to my design <Icon name="arrow" /></button>
            : <button className="btn" onClick={() => { setFlow(flow === 'upload' ? 'template' : flow); s.go('category'); }}>{refs.length ? 'Next: choose what to make' : 'Skip photos'} <Icon name="arrow" /></button>}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ workspace
const STEPS = ['Base', 'Motifs', 'Stones', 'Finish', 'Send'];
function guide(nodes: { type: string }[]): number {
  if (!nodes.length) return 0;
  if (!nodes.some((n) => n.type.startsWith('motif') || n.type === 'pendantBody' || n.type === 'jhumkaBell' || n.type === 'ghungroo')) return 1;
  if (!nodes.some((n) => n.type === 'stone')) return 2;
  return 3;
}
const GUIDE_TEXT = [
  'Pick a base structure from the library — a band, bangle, necklace base, earring top or chain.',
  'Add motifs: mangoes, flowers, kasu coins or a peacock. Select the base first, then tap a motif.',
  'Add stones: tap a motif or setting, then tap Gemstone. Choose ruby, emerald, kemp, CZ or pearl.',
  'Choose the metal and finish, adjust sizes, then press Continue to review and send.',
];

function Workspace() {
  const s = useStudio();
  const [tab, setTab] = useState<'library' | 'props' | 'layers' | null>(null);
  const [busy, setBusy] = useState(false);
  const step = guide(s.design.nodes);
  const issues = useMemo(() => validate(s.design), [s.design]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? s.redo() : s.undo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); s.redo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); s.save('Manual save'); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && s.selectedId) s.removeNode(s.selectedId);
      else if (e.key === 'Escape') s.select(null);
    };
    window.addEventListener('keydown', k);
    const leave = (e: BeforeUnloadEvent) => { if (useStudio.getState().saveStatus === 'unsaved') { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', leave);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('beforeunload', leave); };
  }, []); // eslint-disable-line
  useEffect(() => { if (s.selectedId && window.innerWidth < 900) setTab('props'); }, [s.selectedId]);
  useEffect(() => { if (s.pendingAdd === null && tab === 'library' && window.innerWidth < 900) { /* keep open */ } }, [s.design.nodes.length]); // eslint-disable-line

  const toSummary = async () => {
    if (!s.design.nodes.length) { s.showToast('Add at least one part first.'); return; }
    setBusy(true);
    try {
      const shots = (await viewportApi.capture?.(['perspective', 'front', 'side', 'back'])) ?? {};
      s.set({ captures: shots });
      s.save();
      s.go('summary');
    } finally { setBusy(false); }
  };
  const exportGlb = async () => {
    try { const b = await viewportApi.exportGLB!(); tryDownload(b, `${s.design.id}.glb`); s.showToast('3D model (.glb) download started. If nothing happens, the preview is blocking downloads.'); }
    catch { s.showToast('Could not export the model.'); }
  };
  const status = { idle: '', saving: 'Saving…', saved: 'Saved', error: 'Not saved', unsaved: 'Unsaved changes' }[s.saveStatus];
  return (
    <div className="studio-ws">
      <header className="ws-top">
        <div className="row gap">
          <button className="iconbtn big" title="Studio home" onClick={() => { s.save(); s.go('entry'); }}><Icon name="back" size={18} /></button>
          <span className="brand-sm hide-s">BHAVANI<small>3D Studio</small></span>
          <div className="ws-title">
            <input value={s.design.name} onChange={(e) => s.rename(e.target.value)} aria-label="Design name" />
            <span className="mono muted">{s.design.id} · <span className={s.saveStatus === 'unsaved' ? 'gold' : ''}>{status}</span></span>
          </div>
        </div>
        <div className="row gap-s">
          <button className="iconbtn" title="Undo (Ctrl+Z)" disabled={!s.past.length} onClick={s.undo}><Icon name="undo" /></button>
          <button className="iconbtn" title="Redo (Ctrl+Y)" disabled={!s.future.length} onClick={s.redo}><Icon name="redo" /></button>
          <button className="iconbtn hide-s" title="Save a version" onClick={() => s.save(`Version ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)}><Icon name="save" /></button>
          <div className="seg mini hide-s">
            <button className={s.mode === 'beginner' ? 'on' : ''} onClick={() => s.setMode('beginner')}>Beginner</button>
            <button className={s.mode === 'advanced' ? 'on' : ''} onClick={() => s.setMode('advanced')}>Advanced</button>
          </div>
          <details className="menu">
            <summary className="iconbtn" title="More"><Icon name="menu" /></summary>
            <div className="menu-list">
              <button onClick={() => s.go('upload')}><Icon name="image" /> Reference photos</button>
              <button onClick={() => s.duplicateDesign()}><Icon name="copy" /> Duplicate design</button>
              <button onClick={() => s.go('saved')}><Icon name="layers" /> Saved designs &amp; versions</button>
              <button onClick={exportGlb}><Icon name="download" /> Export 3D model (.glb)</button>
              <button onClick={async () => { const c = await encodeDesign(s.design); const ok = await copyText('BHV:' + c); s.showToast(ok ? 'Design code copied' : 'Copy blocked — see the summary page'); }}><Icon name="code" /> Copy design code</button>
              <button onClick={() => s.set({ confirm: { text: 'How to use the studio:\n1. Pick a base from the library.\n2. Select a part, then tap a library item to attach it.\n3. Change sizes, metal and stones on the right.\n4. Continue to review and send to Bhavani Gold on WhatsApp.', ok: 'Got it', onOk: () => undefined } })}><Icon name="help" /> Help</button>
            </div>
          </details>
          <button className="btn gold" onClick={toSummary} disabled={busy}><span className="lbl">{busy ? 'Preparing…' : 'Continue'}</span> <Icon name="arrow" /></button>
        </div>
      </header>
      {s.mode === 'beginner' && (
        <div className="guide">
          <ol>{STEPS.map((t, i) => <li key={t} className={i < step ? 'done' : i === step ? 'on' : ''}><span>{i < step ? '✓' : i + 1}</span>{t}</li>)}</ol>
          <p>{GUIDE_TEXT[step]}</p>
        </div>
      )}
      <div className={'ws-grid tab-' + (tab ?? 'none')}>
        <Library />
        <ViewportArea />
        <Properties />
        <Hierarchy />
      </div>
      <nav className="ws-tabs">
        {([['library', 'Library', 'plus'], ['props', 'Edit', 'sliders'], ['layers', 'Layers', 'layers']] as const).map(([k, l, ic]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(tab === k ? null : k)}><Icon name={ic} size={18} />{l}{k === 'layers' && issues.some((i) => i.level === 'error') && <i className="dot" />}</button>
        ))}
      </nav>
    </div>
  );
}

// ------------------------------------------------------------ summary
async function composeSummary(d: ReturnType<typeof useStudio.getState>['design'], shots: Record<string, string>): Promise<Blob | null> {
  const W = 1600, H = 1000;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#23221f'); grd.addColorStop(1, '#141312');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  const load = (src: string) => new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(i); i.src = src; });
  const main = shots.perspective ? await load(shots.perspective) : null;
  if (main?.width) { const k = Math.min(760 / main.width, 640 / main.height); g.drawImage(main, 40 + (760 - main.width * k) / 2, 140 + (640 - main.height * k) / 2, main.width * k, main.height * k); }
  const small = ['front', 'side', 'back'];
  for (let i = 0; i < 3; i++) {
    const im = shots[small[i]] ? await load(shots[small[i]]) : null;
    g.strokeStyle = '#45413a'; g.strokeRect(40 + i * 256, 800, 240, 160);
    if (im?.width) { const k = Math.min(240 / im.width, 160 / im.height); g.drawImage(im, 40 + i * 256 + (240 - im.width * k) / 2, 800 + (160 - im.height * k) / 2, im.width * k, im.height * k); }
    g.fillStyle = '#9e978a'; g.font = '600 13px Inter, sans-serif'; g.fillText(small[i].toUpperCase(), 50 + i * 256, 820);
  }
  g.fillStyle = '#e0bf7b'; g.font = '600 16px "Space Grotesk", sans-serif'; g.fillText('BHAVANI GOLD · 3D DESIGN SUMMARY', 40, 60);
  g.fillStyle = '#f2f1ec'; g.font = '500 44px "Playfair Display", serif'; g.fillText(d.name.slice(0, 40), 40, 112);
  const w = estimateWeight(d); const b = designBounds(d); const sz = b.getSize(b.min.clone());
  let y = 170; const x = 850;
  const line = (t: string, col = '#cfc7b9', font = '400 18px Inter, sans-serif') => { g.fillStyle = col; g.font = font; g.fillText(t, x, y); y += 30; };
  line('Design ID  ' + d.id, '#e0bf7b', '600 20px "Space Grotesk", sans-serif');
  line(`Size  ${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)} mm${d.pair ? '  (each, pair)' : ''}`);
  line(`Gold estimate  ~${w.theoreticalG.toFixed(2)} g  (≈${w.estimatedG.toFixed(2)} g with allowance)`, '#f2f1ec', '600 19px Inter, sans-serif');
  if (w.stoneCount) line(`Stones  ${w.stoneCount} pcs · ~${w.stonesCt.toFixed(2)} ct`);
  y += 10; line('Parts', '#9e978a', '600 14px "Space Grotesk", sans-serif');
  for (const p of partsSummary(d, w).slice(0, 14)) { line(p.slice(0, 70), '#cfc7b9', '400 16px Inter, sans-serif'); }
  y = Math.max(y, 860);
  g.fillStyle = '#9e978a'; g.font = '400 14px Inter, sans-serif';
  g.fillText('Preliminary estimate from 3D geometry. Final weight, rate, making & stone charges confirmed by Bhavani Gold.', x, 940);
  g.fillText(`WhatsApp ${SHOP.whatsappDisplay} · ${SHOP.address}`, x, 965);
  return new Promise((res) => c.toBlob((bb) => res(bb), 'image/png'));
}

function Summary() {
  const s = useStudio();
  const d = s.design;
  const w = useMemo(() => estimateWeight(d), [d]);
  const box = useMemo(() => designBounds(d), [d]);
  const sz = box.getSize(box.min.clone());
  const [img, setImg] = useState<string | null>(null);
  const [code, setCode] = useState('');
  useEffect(() => { encodeDesign(d).then(setCode); }, [d]);
  const shots = s.captures;
  const makeImage = async () => { const b = await composeSummary(d, shots); if (b) { setImg(URL.createObjectURL(b)); tryDownload(b, `${d.id}-summary.png`); } };
  return (
    <div className="studio-page">
      <StudioHeader back={() => s.go('workspace')} />
      <div className="wrap-page">
        <p className="eyebrow gold">Design summary · {d.id}</p>
        <h2 className="h2">{d.name}</h2>
        <div className="sum-grid">
          <div>
            <div className="sum-main">{shots.perspective ? <img src={shots.perspective} alt="3D perspective" /> : <p className="muted">Preview not captured</p>}<span className="tag">3D perspective</span></div>
            <div className="sum-views">{(['front', 'side', 'back'] as const).map((v) => <figure key={v}>{shots[v] && <img src={shots[v]} alt={v} />}<figcaption>{v}</figcaption></figure>)}</div>
            {d.refs.length > 0 && (<><p className="section-label">Your reference photos</p><div className="refgrid big">{d.refs.map((r) => <figure key={r.id}><img src={r.dataUrl} alt={r.name} /><figcaption>{r.view}</figcaption></figure>)}</div></>)}
          </div>
          <div>
            <WeightCard />
            <table className="spec">
              <tbody>
                <tr><th>Category</th><td>{CATEGORIES.find((c) => c.id === d.category)?.label}{d.pair ? ' · pair' : ''}</td></tr>
                <tr><th>Overall size</th><td>{box.isEmpty() ? '—' : `${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)} mm`}</td></tr>
                <tr><th>Parts</th><td>{d.nodes.length} types · {w.nodes.reduce((a, n) => a + n.copies, 0)} pieces</td></tr>
              </tbody>
            </table>
            <p className="section-label">Components &amp; materials</p>
            <ul className="parts">{partsSummary(d, w).map((p, i) => <li key={i}>{p.replace(/^• /, '')}</li>)}</ul>
            <label className="field"><span className="flabel">Notes for the goldsmith</span><textarea rows={3} value={d.notes} onChange={(e) => s.setNotes(e.target.value)} /></label>
            <div className="estimate-note"><b>This is not a quotation.</b> The weight is calculated from the 3D model's volume and metal density. Bhavani Gold will confirm the real gold requirement, today's rate, making and stone charges, and a delivery date on WhatsApp.</div>
            <div className="row gap wrap">
              <button className="btn gold big" onClick={() => s.go('submit')}><Icon name="wa" /> Send my design to Bhavani</button>
              <button className="btn outline" onClick={() => s.go('workspace')}>Keep editing</button>
            </div>
            <div className="row gap wrap mt">
              <button className="btn ghost small" onClick={makeImage}><Icon name="image" /> Save summary image</button>
              <button className="btn ghost small" onClick={() => s.save('Reviewed ' + new Date().toLocaleDateString())}><Icon name="save" /> Save version</button>
              <button className="btn ghost small" onClick={async () => s.showToast((await copyText('BHV:' + code)) ? 'Design code copied' : 'Select the code below and copy it')}><Icon name="code" /> Copy design code</button>
            </div>
            <details className="codebox"><summary className="small">Show design code</summary><textarea readOnly rows={3} value={'BHV:' + code} onFocus={(e) => e.target.select()} /></details>
          </div>
        </div>
      </div>
      {img && (
        <div className="modal-back" onClick={() => setImg(null)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <p className="small">Summary image. If it didn't download, long-press (phone) or right-click (computer) → <b>Save image</b>, then attach it in WhatsApp.</p>
            <img src={img} alt="Design summary" className="fullimg" />
            <button className="btn" onClick={() => setImg(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------ submit
const REQUESTS = ['Gold requirement', "Today's gold rate", 'Making charges', 'Stone charges', 'Total quotation', 'Delivery estimate'];
function Submit() {
  const s = useStudio();
  const d = s.design;
  const w = useMemo(() => estimateWeight(d), [d]);
  const box = useMemo(() => designBounds(d), [d]);
  const sz = box.getSize(box.min.clone());
  const [name, setName] = useState('');
  const [req, setReq] = useState<string[]>(REQUESTS);
  const [code, setCode] = useState('');
  useEffect(() => { encodeDesign(d).then(setCode); }, [d]);
  const msg = whatsappMessage(d, w, { name, requests: req, notes: d.notes, code, dims: box.isEmpty() ? '' : `${sz.x.toFixed(1)} × ${sz.y.toFixed(1)} × ${sz.z.toFixed(1)} mm` });
  return (
    <div className="studio-page">
      <StudioHeader back={() => s.go('summary')} />
      <div className="wrap-page narrow">
        <p className="eyebrow gold">Send to Bhavani Gold</p>
        <h2 className="h2">Send my design</h2>
        <div className="submit-head">
          {s.captures.perspective && <img src={s.captures.perspective} alt="" />}
          <div><p className="mono gold">{d.id}</p><p className="serif big">{d.name}</p><p className="small muted">~{w.theoreticalG.toFixed(2)} g preliminary · {w.stoneCount} stones</p></div>
        </div>
        <label className="field"><span className="flabel">Your name (optional)</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="So we know who is asking" /></label>
        <div className="field"><span className="flabel">Ask us for</span>
          <div className="checks">{REQUESTS.map((r) => <label key={r} className="check"><input type="checkbox" checked={req.includes(r)} onChange={(e) => setReq(e.target.checked ? [...req, r] : req.filter((x) => x !== r))} /> {r}</label>)}</div>
        </div>
        <label className="field"><span className="flabel">Notes</span><textarea rows={2} value={d.notes} onChange={(e) => s.setNotes(e.target.value)} /></label>
        <p className="section-label">Message preview</p>
        <pre className="msg">{msg}</pre>
        <div className="row gap wrap">
          <a className="btn gold big" href={waLink(msg)} target="_blank" rel="noreferrer"><Icon name="wa" /> Open WhatsApp</a>
          <button className="btn outline" onClick={async () => s.showToast((await copyText(msg)) ? 'Message copied' : 'Copy blocked — select the text above')}><Icon name="copy" /> Copy message</button>
        </div>
        <div className="note mt">
          <b>Photos aren't attached automatically.</b> WhatsApp only receives the text. After it opens: 1) send the message, 2) attach the summary image (from the previous page) and your reference photos. Our number: <b>{SHOP.whatsappDisplay}</b>.
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ saved designs
function Saved() {
  const s = useStudio();
  return (
    <div className="studio-page">
      <StudioHeader back={() => s.go(s.design.nodes.length ? 'workspace' : 'entry')} />
      <div className="wrap-page">
        <p className="eyebrow gold">Saved in this browser</p>
        <h2 className="h2">Saved designs</h2>
        {s.saved.length === 0 && <p className="muted">No saved designs yet. Designs save automatically while you work.</p>}
        <div className="saved-list">
          {s.saved.map((e) => (
            <div key={e.id} className="saved-card">
              <img src={designThumb(e.design, 160, 'saved:' + e.id + e.updatedAt)} alt="" />
              <div className="grow">
                <p className="serif">{e.name}</p>
                <p className="mono muted">{e.id} · {new Date(e.updatedAt).toLocaleString()}</p>
                <div className="row gap-s wrap">
                  <button className="btn small" onClick={() => s.restoreVersion(e.id, -1)}>Open</button>
                  <button className="btn danger small" onClick={() => s.ask(`Delete "${e.name}" from this browser? This cannot be undone.`, 'Delete', () => s.deleteSaved(e.id))}>Delete</button>
                </div>
                {e.versions.length > 0 && (
                  <details><summary className="small">Version history ({e.versions.length})</summary>
                    {e.versions.map((v, i) => <div key={i} className="row between small ver"><span>{v.label} · {new Date(v.at).toLocaleString()}</span><button className="link" onClick={() => s.restoreVersion(e.id, i)}>Restore</button></div>)}
                  </details>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ root
export default function Studio() {
  const screen = useStudio((s) => s.screen);
  const [flow, setFlow] = useState<Flow>('template');
  useEffect(() => { window.scrollTo(0, 0); }, [screen]);
  return (
    <div className="studio">
      {screen === 'entry' && <Entry setFlow={setFlow} />}
      {screen === 'category' && <CategoryScreen flow={flow} />}
      {screen === 'templates' && <TemplatesScreen />}
      {screen === 'upload' && <UploadScreen flow={flow} setFlow={setFlow} />}
      {screen === 'workspace' && <Workspace />}
      {screen === 'summary' && <Summary />}
      {screen === 'submit' && <Submit />}
      {screen === 'saved' && <Saved />}
      <Toast /><Confirm />
    </div>
  );
}
