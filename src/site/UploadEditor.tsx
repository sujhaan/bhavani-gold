import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../studio/icons';
import { SITE } from './site';
import { autoCut, cutoutCanvas, detectHints, saliency, paint, refine, workCanvas, type CutState } from './cutout';
import { METAL_TONES, pickStone, renderEdits, STONE_TONES, stoneName, type Edits, type MetalTone, type StoneTone } from './itemEdit';
import type { Pose } from './Relief3D';

const Relief3D = lazy(() => import('./Relief3D'));

const PIECE_TYPES = ['Necklace', 'Earrings', 'Ring', 'Bangle', 'Pendant', 'Chain', 'Bracelet', 'Other'];
const WEIGHTS = ['Under 5 g', '5–10 g', '10–20 g', '20–40 g', '40 g+', 'Not sure'];
const CHANGES = ['Make it lighter', 'Make it heavier', 'Simpler design', 'More detailed', 'Add more stones', 'No stones'];
type Tool = 'stone' | 'keep' | 'remove';
type View = '3d' | 'clean';

/** A customer's own photo: the jewellery is cut out by itself, made editable and shown in 3D, then sent to the shop. */
export default function UploadEditor({ onClose }: { onClose: () => void }) {
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState('');
  const [cutV, setCutV] = useState(0); // bumps when the cut changes
  const [markV, setMarkV] = useState(0);
  const [view, setView] = useState<View>('3d');
  const [tool, setTool] = useState<Tool>('stone');
  const [brush, setBrush] = useState(14);
  const [edits, setEdits] = useState<Edits>({ metal: 'photo', swaps: [], shine: 0 });
  const [picked, setPicked] = useState<{ L: number; a: number; b: number; colour: string } | null>(null);
  const [tip, setTip] = useState('');
  const [pose, setPose] = useState<Pose>({ scale: 1, turn: 0, flip: false, depth: 1 });
  const [type, setType] = useState('');
  const [weight, setWeight] = useState(WEIGHTS[5]);
  const [changes, setChanges] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cut = useRef<CutState | null>(null);
  const work = useRef<HTMLCanvasElement | null>(null);
  const cleanCv = useRef<HTMLCanvasElement>(null);
  const glCv = useRef<HTMLCanvasElement | null>(null);
  const history = useRef<Uint8Array[]>([]);
  const painting = useRef(false);

  const load = (f?: File) => {
    setErr('');
    if (!f) return;
    if (f.type && !f.type.startsWith('image/')) { setErr('Choose a photo (JPG or PNG).'); return; }
    const im = new Image();
    im.onload = async () => {
      setPhoto(im); setStatus('Finding the jewellery in your photo…');
      setEdits({ metal: 'photo', swaps: [], shine: 0 }); setPicked(null); setPose({ scale: 1, turn: 0, flip: false, depth: 1 }); history.current = [];
      await new Promise((r) => setTimeout(r, 30));
      const wc = workCanvas(im); work.current = wc;
      const hints = await detectHints(wc);
      const sal = await saliency(wc);
      setStatus('Clearing hands, face and background…');
      await new Promise((r) => setTimeout(r, 30));
      cut.current = autoCut(wc, hints, sal); (window as unknown as { __cut?: CutState }).__cut = cut.current;
      setStatus(''); setView('3d'); setCutV((v) => v + 1);
    };
    im.onerror = () => setErr('That photo could not be opened. Try another one.');
    im.src = URL.createObjectURL(f);
  };

  // the jewellery alone (cropped, transparent), and with the customer's colour edits
  const base = useMemo(() => {
    if (!photo || !cut.current) return null;
    const { canvas, empty, x0, y0 } = cutoutCanvas(photo, cut.current);
    if (empty) return null;
    return { canvas, x0, y0, data: canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height) };
  }, [photo, cutV]); // eslint-disable-line react-hooks/exhaustive-deps
  const edited = useMemo(() => {
    if (!base) return null;
    const c = document.createElement('canvas'); c.width = base.canvas.width; c.height = base.canvas.height;
    c.getContext('2d')!.putImageData(renderEdits(base.data, edits), 0, 0);
    return c;
  }, [base, edits]);
  const editV = useMemo(() => Math.random(), [edited]); // eslint-disable-line react-hooks/exhaustive-deps

  // clean-up view: whole photo dimmed, jewellery bright, customer's marks on top
  useEffect(() => {
    const c = cleanCv.current, st = cut.current, wc = work.current;
    if (view !== 'clean' || !c || !st || !wc) return;
    c.width = st.w; c.height = st.h;
    const g = c.getContext('2d')!;
    const id = wc.getContext('2d')!.getImageData(0, 0, st.w, st.h), d = id.data;
    for (let i = 0; i < st.w * st.h; i++) {
      const m = st.mask[i], u = st.user[i];
      const k = 0.22 + 0.78 * m;
      d[i * 4] *= k; d[i * 4 + 1] *= k; d[i * 4 + 2] *= k;
      if (u === 1) { d[i * 4 + 1] = Math.min(255, d[i * 4 + 1] + 70); }
      if (u === 2) { d[i * 4] = Math.min(255, d[i * 4] + 90); }
    }
    g.putImageData(id, 0, 0);
  }, [view, cutV, markV]);

  const cleanAt = (e: React.PointerEvent) => { const c = cleanCv.current!, r = c.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]; };
  const cleanDown = (e: React.PointerEvent) => {
    const st = cut.current; if (!st) return;
    const [x, y] = cleanAt(e);
    if (tool === 'stone') {
      // map the tap from the photo to the cut-out
      if (!base || !photo) return;
      stoneTap(x / st.w, y / st.h, true);
      return;
    }
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    history.current.push(st.user.slice()); if (history.current.length > 20) history.current.shift();
    painting.current = true; paint(st, x, y, brush * (st.w / 640), tool === 'keep' ? 1 : 2); redrawMarks();
  };
  const cleanMove = (e: React.PointerEvent) => { const st = cut.current; if (!painting.current || !st) return; const [x, y] = cleanAt(e); paint(st, x, y, brush * (st.w / 640), tool === 'keep' ? 1 : 2); redrawMarks(); };
  const cleanUp = () => { if (!painting.current) return; painting.current = false; recut(); };
  const redrawMarks = () => setMarkV((v) => v + 1);
  const recut = () => { const st = cut.current; if (!st) return; setStatus('Updating the cut…'); setTimeout(() => { refine(st); setStatus(''); setCutV((v) => v + 1); }, 20); };
  const undo = () => { const st = cut.current, h = history.current.pop(); if (!st || !h) return; st.user.set(h); recut(); };

  /** fx, fy: 0..1 position on the full photo (clean view) or on the cut-out (3D view → cutout coords) */
  const stoneTap = (fx: number, fy: number, onPhoto: boolean) => {
    if (!base || !photo || !cut.current) return;
    let x: number, y: number;
    if (onPhoto) {
      // find the same point in the cropped cut-out: re-run the crop maths
      const k = Math.min(1, 1400 / Math.max(photo.width, photo.height));
      const W = Math.round(photo.width * k), H = Math.round(photo.height * k);
      const off = { x: base.x0, y: base.y0 };
      x = Math.round(fx * W - off.x); y = Math.round(fy * H - off.y);
    } else { x = Math.round(fx * base.data.width); y = Math.round(fy * base.data.height); }
    const p = pickStone(base.data, x, y);
    if (p === 'gold') { setTip('That is gold. Tap on a stone to change its colour, or pick a gold colour on the right.'); setPicked(null); return; }
    if (!p) { setTip('Tap on the jewellery itself.'); setPicked(null); return; }
    setTip(''); setPicked(p);
  };
  const swapTo = (to: StoneTone) => {
    if (!picked) return;
    const name = stoneName(picked.L, picked.a, picked.b);
    setEdits((e) => ({ ...e, swaps: [...e.swaps.filter((s) => Math.hypot(s.L - picked.L, s.a - picked.a, s.b - picked.b) > 10), { L: picked.L, a: picked.a, b: picked.b, to, name }] }));
  };
  const flatTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    stoneTap((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, false);
  };

  const metalLabel = METAL_TONES.find((m) => m.id === edits.metal)!.label;
  const summary = [
    'Hello Bhavani Gold! I uploaded a design on your website and edited it.',
    type && `Piece: ${type}`,
    `Gold colour: ${metalLabel}`,
    ...edits.swaps.map((s) => `Change ${s.name} to ${STONE_TONES.find((t) => t.id === s.to)!.label}`),
    pose.scale !== 1 ? `Size: ${pose.scale > 1 ? 'bigger' : 'smaller'} by about ${Math.round(Math.abs(pose.scale - 1) * 100)}%` : '',
    `Weight I want: ${weight}`,
    changes.length ? `Changes: ${changes.join(', ')}` : '',
    notes.trim() && `Notes: ${notes.trim()}`,
    'Please tell me if you can make it, with weight and price.',
  ].filter(Boolean).join('\n');
  const wa = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(summary)}`;

  /** the edited piece alone (from the 3D view when it is open), with the order details below */
  const picture = async (): Promise<Blob | null> => {
    let src: CanvasImageSource | null = null, sw = 0, sh = 0;
    // the sharp cut-out with the customer's colour edits (the 3D frame has a lot of empty space around the piece)
    if (edited) {
      const c = document.createElement('canvas'), m = Math.max(edited.width, edited.height) * 1.15;
      c.width = c.height = Math.round(m);
      const g = c.getContext('2d')!; g.translate(m / 2, m / 2); g.rotate((pose.turn * Math.PI) / 180); g.scale(pose.flip ? -1 : 1, 1);
      g.drawImage(edited, -edited.width / 2, -edited.height / 2); src = c; sw = sh = c.width;
    }
    if (!src) return null;
    const W = 1080, pad = 40, side = W - pad * 2, k = Math.min(side / sw, 900 / sh), iw = sw * k, ih = sh * k;
    // wrap long lines (notes) instead of cutting them off
    const meas = document.createElement('canvas').getContext('2d')!; meas.font = '500 28px Manrope, system-ui, sans-serif';
    const lines: string[] = [];
    for (const l of summary.split('\n').slice(1, -1)) {
      let cur = '';
      for (const w of l.split(' ')) { const t = cur ? cur + ' ' + w : w; if (meas.measureText(t).width > W - pad * 2 && cur) { lines.push(cur); cur = '   ' + w; } else cur = t; }
      if (cur) lines.push(cur);
    }
    const H = Math.round(ih + pad * 2 + 90 + lines.length * 40 + 40);
    const o = document.createElement('canvas'); o.width = W; o.height = H;
    const g = o.getContext('2d')!;
    const gr = g.createRadialGradient(W / 2, pad + ih / 2, 40, W / 2, pad + ih / 2, W * 0.75); gr.addColorStop(0, '#5c442e'); gr.addColorStop(1, '#1e150f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.drawImage(src, (W - iw) / 2, pad, iw, ih);
    let y = ih + pad + 64;
    g.fillStyle = '#d9b77a'; g.font = '600 26px Manrope, system-ui, sans-serif'; g.fillText('BHAVANI GOLD · CUSTOMER DESIGN', pad, y); y += 50;
    g.fillStyle = '#f3ede3'; g.font = '500 28px Manrope, system-ui, sans-serif';
    for (const l of lines) { g.fillText(l, pad, y); y += 40; }
    return new Promise((r) => o.toBlob((b) => r(b), 'image/jpeg', 0.9));
  };
  const send = async () => {
    if (!base) { setErr('Upload a photo of the jewellery first.'); return; }
    setBusy(true);
    try {
      const blob = await picture();
      if (!blob) { window.open(wa, '_blank'); return; }
      const file = new File([blob], 'bhavani-my-design.jpg', { type: 'image/jpeg' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        try { await nav.share({ files: [file], text: summary }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
      }
      setShot(URL.createObjectURL(blob));
    } finally { setBusy(false); }
  };
  const chip = (list: string[], val: string, setV: (s: string) => void) => <div className="nm-seg">{list.map((x) => <button key={x} className={val === x ? 'on' : ''} onClick={() => setV(x)}>{x}</button>)}</div>;

  const flatRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = flatRef.current; if (!c || !edited) return;
    c.width = edited.width; c.height = edited.height; c.getContext('2d')!.drawImage(edited, 0, 0);
  }, [edited, view]);

  return createPortal(
    <div className="lightbox up-wrap" onClick={onClose} data-lenis-prevent>
      <div className="up" onClick={(e) => e.stopPropagation()}>
        <div className="up-head"><h3>Your own design</h3><button className="pill-icon" aria-label="Close" onClick={onClose}><Icon name="x" /></button></div>
        <div className="up-body">
          <div className="up-left">
            {!photo ? (
              <button className="up-drop" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files[0]); }}>
                <Icon name="image" size={34} /><b>Upload a photo</b><span>Any photo of jewellery, even worn on a hand or neck. We clear the person and background and keep only the piece, so you can change it in 3D.</span>
              </button>
            ) : (
              <>
                <div className="up-views">
                  <button className={view === '3d' ? 'on' : ''} onClick={() => setView('3d')}>3D view</button>
                  <button className={view === 'clean' ? 'on' : ''} onClick={() => setView('clean')}>Fix the cut</button>
                  <button className="btn-ghost sm" onClick={() => fileRef.current?.click()}>Change photo</button>
                </div>
                <div className="up-stage">
                  {status && <div className="up-status"><span className="spin" />{status}</div>}
                  {!status && !base && <div className="up-status">We could not find the jewellery. Open <b>Fix the cut</b> and brush over the piece with <b>Keep</b>.</div>}
                  {view === '3d' && edited && (
                    <div className="up-3d">
                      <Suspense fallback={<div className="up-status"><span className="spin" />Loading 3D…</div>}>
                        <Relief3D img={edited} pose={pose} version={editV} onGl={(c) => (glCv.current = c)} onTap={(u, v) => stoneTap(u, v, false)} />
                      </Suspense>
                      <span className="up-hint">Drag to turn · tap a stone to change it · pinch or scroll to zoom</span>
                    </div>
                  )}
                  {view === 'clean' && (
                    <canvas ref={cleanCv} className="up-canvas" onPointerDown={cleanDown} onPointerMove={cleanMove} onPointerUp={cleanUp} onPointerCancel={cleanUp} />
                  )}
                </div>
                {view === 'clean' && (
                  <div className="up-tools">
                    <div className="nm-seg">
                      <button className={tool === 'keep' ? 'on' : ''} onClick={() => setTool('keep')}>＋ Keep</button>
                      <button className={tool === 'remove' ? 'on' : ''} onClick={() => setTool('remove')}>− Remove</button>
                      <button className={tool === 'stone' ? 'on' : ''} onClick={() => setTool('stone')}>Tap a stone</button>
                    </div>
                    <label className="up-range">Brush <input type="range" min={4} max={40} value={brush} onChange={(e) => setBrush(+e.target.value)} /></label>
                    <button className="btn-ghost sm" onClick={undo} disabled={!history.current.length}>Undo</button>
                    <p className="up-note">Bright = kept. Brush green over any part of the jewellery that was missed, red over anything left over (finger, skin, cloth).</p>
                  </div>
                )}
                {view === '3d' && edited && (
                  <div className="up-flat">
                    <canvas ref={flatRef} onClick={flatTap} title="Tap a stone to change its colour" />
                    <p className="up-note">Tap a stone on the piece (here or in 3D) to change its colour.</p>
                  </div>
                )}
              </>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ''; }} />
            {err && <p className="error small">{err}</p>}
          </div>
          <div className="up-right">
            {base && (
              <>
                <div className="nm-row"><span>Gold colour</span>
                  <div className="up-sws">{METAL_TONES.map((m) => <button key={m.id} className={'up-sw' + (edits.metal === m.id ? ' on' : '')} onClick={() => setEdits((e) => ({ ...e, metal: m.id as MetalTone }))}><i style={{ background: m.sw }} />{m.label}</button>)}</div>
                </div>
                <div className="nm-row"><span>Stones</span>
                  {picked ? (
                    <div className="up-picked"><i style={{ background: picked.colour }} /> Change {stoneName(picked.L, picked.a, picked.b)} to:</div>
                  ) : <p className="up-note">{tip || 'Tap a stone on the piece to pick it.'}</p>}
                  {picked && <div className="up-sws">{STONE_TONES.map((s) => <button key={s.id} className="up-sw" onClick={() => swapTo(s.id)}><i style={{ background: s.sw }} />{s.label}</button>)}</div>}
                  {edits.swaps.length > 0 && <button className="dz-link" onClick={() => setEdits((e) => ({ ...e, swaps: [] }))}>Undo stone changes</button>}
                </div>
                <div className="up-sliders">
                  <label>Size <b>{Math.round(pose.scale * 100)}%</b><input type="range" min={60} max={140} value={Math.round(pose.scale * 100)} onChange={(e) => setPose((p) => ({ ...p, scale: +e.target.value / 100 }))} /></label>
                  <label>Turn <b>{pose.turn}°</b><input type="range" min={-180} max={180} value={pose.turn} onChange={(e) => setPose((p) => ({ ...p, turn: +e.target.value }))} /></label>
                  <label>Thickness <b>{Math.round(pose.depth * 100)}%</b><input type="range" min={30} max={200} value={Math.round(pose.depth * 100)} onChange={(e) => setPose((p) => ({ ...p, depth: +e.target.value / 100 }))} /></label>
                  <label>Shine <b>{edits.shine > 0 ? '+' : ''}{Math.round(edits.shine * 100)}</b><input type="range" min={-40} max={60} value={Math.round(edits.shine * 100)} onChange={(e) => setEdits((x) => ({ ...x, shine: +e.target.value / 100 }))} /></label>
                  <button className="btn-ghost sm" onClick={() => setPose((p) => ({ ...p, flip: !p.flip }))}>Mirror</button>
                </div>
              </>
            )}
            <div className="nm-row"><span>What is it?</span>{chip(PIECE_TYPES, type, setType)}</div>
            <div className="nm-row"><span>Weight you want</span>{chip(WEIGHTS, weight, setWeight)}</div>
            <div className="nm-row"><span>Changes</span><div className="nm-seg">{CHANGES.map((x) => <button key={x} className={changes.includes(x) ? 'on' : ''} onClick={() => setChanges((c) => (c.includes(x) ? c.filter((y) => y !== x) : [...c, x]))}>{x}</button>)}</div></div>
            <div className="nm-row"><span>Anything else?</span><textarea className="up-notes" rows={3} maxLength={400} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Example: same design but with Lakshmi in the centre, for my daughter's wedding in March" /></div>
            <button className="btn-wa" onClick={send} disabled={busy}><Icon name="wa" size={20} /> {busy ? 'Preparing…' : 'Send to Bhavani on WhatsApp'}</button>
            <p className="nm-fine">Only the jewellery is sent, never the person in the photo. The 3D view is made from your photo, so the real piece can differ; we confirm the design, weight and price on WhatsApp.</p>
          </div>
        </div>
        {shot && (
          <div className="up-shot">
            <img src={shot} alt="Your design with notes" />
            <p><b>1.</b> Save this picture: <a className="dz-link" href={shot} download="bhavani-my-design.jpg">Download</a> (or long-press it).<br /><b>2.</b> Open our chat and attach it.</p>
            <a className="btn-wa" href={wa} target="_blank" rel="noreferrer"><Icon name="wa" size={20} /> Open WhatsApp chat</a>
            <button className="btn-ghost" onClick={() => setShot(null)}>Back</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}