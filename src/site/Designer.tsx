import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { DesignMeshes, StudioEnvironment, TapPicker, pairBounds, placeCamera } from '../studio/Viewport';
import { estimateWeight } from '../engine/assembly';
import { designThumb } from '../studio/thumbs';
import { Icon } from '../studio/icons';
import { SITE } from './site';
import PartEditor from './PartEditor';
import UploadEditor from './UploadEditor';
import { startRealPhoto, type PhotoJob } from './realPhoto';
import { placements } from '../engine/assembly';
import {
  overrideSummary, partLabel, type Overrides, type PartOverride,
  buildDesign, cfgSummary, ADDONS, CHAIN_PENDANTS, defaultCfg, hasThickness, METAL_CHOICES, PIECES, sizeOptions, STONE_CHOICES, STYLE_NAMES, styleMetal, styleStone, THICKNESS,
  type Audience, type Cfg, type Piece,
} from './designer';

const PIECE_ICON: Record<Piece, string> = {
  necklace: 'M4 4c0 7 3.5 11 8 11s8-4 8-11M12 15v2.5M10 19.5a2 2 0 1 0 4 0 2 2 0 0 0-4 0',
  earrings: 'M8 3v4M16 3v4M5 12a3 3 0 0 1 6 0v2H5zM13 12a3 3 0 0 1 6 0v2h-6zM6 16l.5 2M8 16v2.5M10 16l-.5 2M14 16l.5 2M16 16v2.5M18 16l-.5 2',
  bangle: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10z',
  ring: 'M12 9a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM9 3h6l1.5 3L12 9 7.5 6z',
  pendant: 'M12 3v3M12 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3M12 9c-4 4-4 8 0 12 4-4 4-8 0-12z',
  chain: 'M7 4a3 3 0 0 0 0 6h2M15 10a3 3 0 0 1 0 6h-2M9 14a3 3 0 0 0 0 6M15 4a3 3 0 0 1 0 6',
  bracelet: 'M4 12a8 5 0 1 0 16 0 8 5 0 0 0-16 0M7 9.5l1.5 1.5M11 8.5v2M15 9l-1 1.6M17.5 11l-1.6.8',
};

/** Frames the piece only when the customer picks a different piece/style/size — never when they edit a single part,
 *  select something, or the panel changes height, so the view they turned to stays put. */
function Frame({ box, spin, view, fitKey }: { box: THREE.Box3; spin: boolean; view: 'front' | 'ring'; fitKey: string }) {
  const { camera, controls, size } = useThree();
  const ready = size.width > 0 && size.height > 0;
  // on phones the badge, tools and weight boxes cover the top and bottom of the view: fit the piece between them
  const small = size.width < 700;
  useEffect(() => { if (ready) placeCamera(camera, controls, box, view, size, small ? { top: 54, bottom: 76 } : { top: 60, bottom: 90 }); }, [fitKey, view, controls, ready, small]); // eslint-disable-line
  useEffect(() => { if (controls) (controls as any).autoRotate = spin; }, [spin, controls]);
  return null;
}

export default function Designer() {
  const [cfg, setCfg] = useState<Cfg>(defaultCfg('women', 'necklace'));
  const [allStones, setAllStones] = useState(false);
  const [ov, setOv] = useState<Overrides>({});
  const [sel, setSel] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [spin, setSpin] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [hint, setHint] = useState(true);
  // the tip goes away by itself a few seconds after the studio comes into view
  useEffect(() => {
    const el = stageRef.current; if (!el || !hint) return;
    let t = 0;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !t) t = window.setTimeout(() => setHint(false), 6000); }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [hint]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const three = useRef<{ scene: THREE.Scene; camera: THREE.Camera } | null>(null);
  const [upload, setUpload] = useState(false);
  const [photo, setPhoto] = useState<{ key: string; progress: number; url: string | null } | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const jobRef = useRef<PhotoJob | null>(null);
  const liveRef = useRef<HTMLDivElement | null>(null);
  const design = useMemo(() => buildDesign(cfg, ov), [cfg, ov]);
  const copies = useMemo(() => { const pl = placements(design); return Object.fromEntries(design.nodes.map((n) => [n.id, (pl.get(n.id)?.length ?? 0) * (design.pair ? 2 : 1)])); }, [design]);
  const selNode = design.nodes.find((n) => n.id === sel && n.visible) ?? null;
  const parts = design.nodes.filter((n) => n.visible && (copies[n.id] ?? 0) > 0);
  const box = useMemo(() => pairBounds(design), [design]);
  const w = useMemo(() => estimateWeight(design), [design]);
  const sz = sizeOptions(cfg.piece, cfg.audience);
  const piece = PIECES[cfg.audience].find((p) => p.id === cfg.piece) ?? PIECES[cfg.audience][0];
  const dims = box.isEmpty() ? null : box.getSize(new THREE.Vector3());

  const set = (patch: Partial<Cfg>) => setCfg((c) => ({ ...c, ...patch }));
  const fresh = () => { setOv({}); setSel(null); };
  const pickPiece = (p: Piece) => { fresh(); setCfg((c) => ({ ...defaultCfg(c.audience, p) })); };
  const pickAudience = (a: Audience) => { if (a === cfg.audience) return; fresh(); setCfg((c) => defaultCfg(a, PIECES[a].some((p) => p.id === c.piece) ? c.piece : undefined)); };
  const pickStyle = (style: string) => { fresh(); setCfg((c) => ({ ...c, style, stone: styleStone(style), metal: styleMetal(style) })); };
  // a global stone choice clears per-part stone overrides so it visibly applies everywhere
  const pickStone = (stone: Cfg['stone']) => { setOv((o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { ...v, gem: undefined }]))); set({ stone }); };

  const changePart = (id: string, o: PartOverride) => {
    setOv((prev) => {
      const cur = prev[id] ?? {};
      const next: Overrides = { ...prev, [id]: { ...cur, ...o, params: { ...(o.type && o.type !== cur.type ? {} : cur.params), ...(o.params ?? {}) } } };
      // keep stones matched to the setting that holds them
      const n = design.nodes.find((x) => x.id === id);
      if (n?.type.startsWith('setting-') && o.params && ('size' in o.params || 'shape' in o.params)) {
        for (const c of design.nodes) if (c.attach?.parent === id && c.type === 'stone') {
          const cc = next[c.id] ?? {};
          next[c.id] = { ...cc, params: { ...cc.params, ...('size' in o.params ? { size: o.params.size } : {}), ...('shape' in o.params ? { shape: o.params.shape } : {}) } };
        }
      }
      return next;
    });
    if (o.hidden) setSel(null);
  };
  const resetPart = (id: string) => setOv((prev) => { const n = { ...prev }; delete n[id]; return n; });

  const pick = (id: string) => {
    // the editor opens next to the piece (desktop) or as a sheet at the bottom (phone): the page never scrolls
    setSel(id); setSpin(false); setHint(false);
  };
  const customLines = overrideSummary(design, ov);
  const stones = allStones ? STONE_CHOICES : STONE_CHOICES.slice(0, 7).concat(STONE_CHOICES.slice(7).filter((x) => x.id === cfg.stone));

  const message = [
    `Hello ${SITE.shopName}, I designed this on your website:`,
    '',
    ...cfgSummary(cfg).map((l) => '• ' + l),
    ...(customLines.length ? ['', 'My changes:', ...customLines.map((l) => '• ' + l)] : []),
    '',
    `Estimated gold: about ${w.theoreticalG.toFixed(1)} g (3D estimate — the real piece can differ by 1–5 g).`,
    w.stoneCount ? `Stones: ${w.stoneCount} pcs` : '',
    '',
    'Please tell me the exact weight, today’s rate, making charges and delivery time.',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
  const wa = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;

  const designKey = JSON.stringify([cfg, ov]);
  const photoReady = photo && photo.key === designKey && photo.url ? photo.url : null;
  const loadImg = (url: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  /** Render a photo-like version of the current design (path traced), showing it develop live. */
  const makePhoto = () => {
    setSpin(false); setSel(null); setPhotoOpen(true);
    if (photoReady) return;
    jobRef.current?.cancel();
    // wait two frames so the selection glow is gone before the scene is captured
    requestAnimationFrame(() => requestAnimationFrame(() => startPhoto()));
  };
  const startPhoto = () => {
    const t = three.current; const grp = t?.scene.getObjectByName('design');
    if (!t || !grp) return;
    const mobile = window.innerWidth < 900;
    const stage = stageRef.current!.getBoundingClientRect();
    const Wd = mobile ? 720 : 1000, Ht = Math.round(Wd * Math.min(1.25, Math.max(0.75, stage.height / stage.width)));
    const key = designKey;
    setPhoto({ key, progress: 0, url: null });
    const job = startRealPhoto(grp, t.camera as THREE.PerspectiveCamera, { width: Wd, height: Ht, samples: mobile ? 110 : 240, onProgress: (p) => setPhoto((ph) => (ph && ph.key === key ? { ...ph, progress: p } : ph)) });
    jobRef.current = job;
    requestAnimationFrame(() => { if (liveRef.current) { liveRef.current.innerHTML = ''; liveRef.current.appendChild(job.canvas); } });
    job.done.then((c) => {
      const url = c.toDataURL('image/jpeg', 0.92);
      setPhoto((ph) => (ph && ph.key === key ? { ...ph, progress: 1, url } : ph));
      job.cancel(); if (jobRef.current === job) jobRef.current = null;
    });
  };
  useEffect(() => () => jobRef.current?.cancel(), []);

  /** A shareable picture of the design: the real photo if one was made, else the 3D view, with the key details underneath. */
  const designPicture = async (): Promise<Blob | null> => {
    const src: HTMLCanvasElement | HTMLImageElement | null = photoReady ? await loadImg(photoReady) : canvasRef.current; if (!src) return null;
    const W = 1080, H = 1350, out = document.createElement('canvas'); out.width = W; out.height = H;
    const g = out.getContext('2d'); if (!g) return null;
    const bg = g.createRadialGradient(W / 2, H * 0.36, 40, W / 2, H * 0.4, W * 0.85);
    bg.addColorStop(0, '#5c442e'); bg.addColorStop(0.6, '#2a1e16'); bg.addColorStop(1, '#1e150f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const area = { x: 60, y: 60, w: W - 120, h: 930 };
    const k = Math.min(area.w / src.width, area.h / src.height);
    g.drawImage(src, area.x + (area.w - src.width * k) / 2, area.y + (area.h - src.height * k) / 2, src.width * k, src.height * k);
    g.fillStyle = '#d9b77a'; g.font = '600 26px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText('BHAVANI GOLD · JENDA STREET, VIJAYAWADA', 60, 1060);
    g.fillStyle = '#fbf9f5'; g.font = '400 54px "Playfair Display", Georgia, serif'; g.fillText(design.name.replace(/^./, (c) => c.toUpperCase()), 60, 1130);
    g.fillStyle = '#e0d4c3'; g.font = '500 30px "Plus Jakarta Sans", system-ui, sans-serif';
    const lines = [`About ${w.theoreticalG.toFixed(1)} g gold (3D estimate, ±1–5 g)${w.stoneCount ? ` · ${w.stoneCount} stones` : ''}`, cfgSummary(cfg).slice(2, 4).join(' · ')];
    lines.forEach((l, i) => g.fillText(l.length > 64 ? l.slice(0, 62) + '…' : l, 60, 1190 + i * 44));
    g.fillStyle = '#A8957F'; g.font = '500 24px "Plus Jakarta Sans", system-ui, sans-serif'; g.fillText(`WhatsApp ${SITE.whatsappDisplay}`, 60, 1300);
    return new Promise((res) => out.toBlob((b) => res(b), 'image/jpeg', 0.92));
  };
  const takeShot = async () => { const b = await designPicture(); setShot(b ? URL.createObjectURL(b) : null); };
  /** Send the picture itself: the phone's share sheet attaches it in WhatsApp; otherwise show it to save and attach. */
  const sendDesign = async () => {
    setSending(true); setSpin(false);
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const blob = await designPicture();
      if (blob) {
        const file = new File([blob], 'bhavani-design.jpg', { type: 'image/jpeg' });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (nav.canShare?.({ files: [file] })) {
          try { await nav.share({ files: [file], text: message }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
        }
        setShot(URL.createObjectURL(blob));
      } else window.open(wa, '_blank');
    } finally { setSending(false); }
  };

  return (
    <div className="designer">
      <div className="dz-stage" data-lenis-prevent ref={stageRef}>
        <Canvas
          dpr={[1, 2]}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
          onCreated={({ gl, scene, camera }) => { canvasRef.current = gl.domElement; three.current = { scene, camera }; }}
        >
          <PerspectiveCamera makeDefault fov={32} />
          <Grab into={three} />
          <OrbitControls makeDefault enableZoom={false} enablePan={false} enableDamping autoRotate={spin} autoRotateSpeed={1.2} onStart={() => setSpin(false)} />
          <StudioEnvironment intensity={1} />
          <directionalLight position={[50, 90, 70]} intensity={1.6} />
          <directionalLight position={[-60, 40, -40]} intensity={0.5} color="#ffd9a0" />
          <group name="design"><DesignMeshes design={design} selectedId={sel} /></group>
          <TapPicker onPick={pick} onMiss={() => setSel(null)} />
          {!box.isEmpty() && <ContactShadows position={[0, box.min.y - 0.4, 0]} scale={Math.max(...box.getSize(new THREE.Vector3()).toArray()) * 2.2} blur={2.6} opacity={0.5} far={60} color="#000" />}
          <Frame box={box} spin={spin} view={cfg.piece === 'ring' || cfg.piece === 'bangle' ? 'ring' : 'front'} fitKey={JSON.stringify(cfg)} />
        </Canvas>
        <div className="dz-badge"><span className="pulse" />{selNode ? `Editing: ${partLabel(design, selNode)}` : 'Tap any part to change it'}</div>
        {hint && !selNode && <button className="dz-hint" onClick={() => { setHint(false); const first = parts.find((n) => n.type === 'stone' || n.type === 'pendantBody' || n.type.startsWith('motif-') || n.type === 'fishHook') ?? parts[0]; if (first) pick(first.id); }}>Tap the hook, a stone or the pendant on the piece to change just that part. <b>Show me</b></button>}
        <div className="dz-tools">
          <button className="pill-icon" title={spin ? 'Stop turning' : 'Turn'} onClick={() => setSpin(!spin)}><Icon name={spin ? 'eyeoff' : 'reset'} /></button>
          <button className="pill-icon" title="Save picture" onClick={takeShot}><Icon name="image" /></button>
        </div>
        {selNode && (
          <div className="dz-editor" ref={editorRef} data-lenis-prevent>
            <PartEditor design={design} node={selNode} copies={copies[selNode.id] ?? 1} changed={!!ov[selNode.id]}
              onChange={(o) => changePart(selNode.id, o)} onReset={() => resetPart(selNode.id)} onClose={() => setSel(null)} />
          </div>
        )}
        <div className="dz-readout">
          <div><span className="mono">Estimated gold</span><b>{w.theoreticalG.toFixed(1)}<small> g</small></b><span className="dz-pm">±1–5 g</span></div>
          {dims && <div><span className="mono">Size</span><b className="sm">{dims.x.toFixed(0)} × {dims.y.toFixed(0)} mm</b></div>}
          {w.stoneCount > 0 && <div><span className="mono">Stones</span><b className="sm">{w.stoneCount}</b></div>}
        </div>
      </div>

      <div className="dz-panel">
        <div className="dz-step">
          <div className="dz-aud">
            <button className={cfg.audience === 'women' ? 'on' : ''} onClick={() => pickAudience('women')}>Women</button>
            <button className={cfg.audience === 'men' ? 'on' : ''} onClick={() => pickAudience('men')}>Men</button>
          </div>
          <p className="dz-label"><span>01</span> What do you want?</p>
          <div className="dz-pieces">
            {PIECES[cfg.audience].map((p) => (
              <button key={p.id} className={'dz-piece' + (cfg.piece === p.id ? ' on' : '')} onClick={() => pickPiece(p.id)}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d={PIECE_ICON[p.id]} /></svg>
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dz-step">
          <p className="dz-label"><span>02</span> Pick a style <em>{piece.styles.length} designs</em></p>
          <div className="dz-styles" data-lenis-prevent>
            {piece.styles.map((st) => <StyleCard key={st} cfg={cfg} style={st} on={cfg.style === st} onClick={() => pickStyle(st)} />)}
          </div>
        </div>

        <div className="dz-row">
          <div className="dz-step">
            <p className="dz-label"><span>03</span> Gold colour</p>
            <div className="dz-swatches">
              {METAL_CHOICES.map((m) => (
                <button key={m.id} className={'dz-sw' + (cfg.metal === m.id ? ' on' : '')} onClick={() => set({ metal: m.id })}>
                  <i style={{ background: `radial-gradient(circle at 35% 30%, #fff8, ${m.colour} 55%)` }} /><span>{m.label}<small>{m.sub}</small></span>
                </button>
              ))}
            </div>
            <div className="dz-toggle">
              <button className={cfg.finish === 'polished' ? 'on' : ''} onClick={() => set({ finish: 'polished' })}>Shiny</button>
              <button className={cfg.finish === 'antique' ? 'on' : ''} onClick={() => set({ finish: 'antique' })}>Temple antique</button>
            </div>
          </div>
          <div className="dz-step">
            <p className="dz-label"><span>04</span> Stones</p>
            <div className="dz-stones">
              {stones.map((s) => (
                <button key={s.id} className={'dz-stone' + (cfg.stone === s.id ? ' on' : '')} onClick={() => pickStone(s.id)} title={s.label}>
                  <i style={{ background: s.colour }} /><span>{s.label}</span>
                </button>
              ))}
            </div>
            <button className="dz-link" onClick={() => setAllStones(!allStones)}>{allStones ? 'Fewer stones' : `More stones (${STONE_CHOICES.length - 7}) — lab diamond, moissanite, navratna…`}</button>
          </div>
        </div>

        <div className="dz-step">
          <p className="dz-label"><span>05</span> {sz.label}</p>
          <div className="dz-sizes">
            {sz.values.map((v, i) => <button key={String(v)} className={cfg.size === i ? 'on' : ''} onClick={() => set({ size: i })}>{sz.display(v)}</button>)}
          </div>
          {hasThickness(cfg.piece) && (
            <div className="dz-sizes mt8">
              {THICKNESS.map((t, i) => <button key={t.label} className={cfg.thick === i ? 'on' : ''} onClick={() => set({ thick: i })}>{t.label}</button>)}
            </div>
          )}
        </div>

        {(cfg.piece === 'chain' || cfg.piece === 'necklace') && (
          <div className="dz-step dz-addon">
            <p className="dz-label"><span>+</span> {cfg.piece === 'chain' ? 'Add a pendant' : 'Add or change the centre pendant'} <em>it hangs at the centre</em></p>
            <div className="dz-sizes">
              {CHAIN_PENDANTS.map((pd) => <button key={pd.id} className={(cfg.pendant ?? 'none') === pd.id ? 'on' : ''} onClick={() => { setOv((o) => { const n = { ...o }; for (const k of Object.keys(n)) if (k.endsWith('.pend')) delete n[k]; return n; }); set({ pendant: pd.id }); }}>{pd.id === 'none' ? (cfg.piece === 'chain' ? 'No pendant' : 'As designed') : pd.label}</button>)}
            </div>
            {cfg.pendant && cfg.pendant !== 'none' && <p className="dz-fine mt8">Tap the pendant to change its size, stones or drops.</p>}
          </div>
        )}
        {ADDONS[cfg.piece] && (
          <div className="dz-step dz-addon">
            <p className="dz-label"><span>+</span> {ADDONS[cfg.piece]!.title} <em>{ADDONS[cfg.piece]!.hint}</em></p>
            <div className="dz-sizes">
              {ADDONS[cfg.piece]!.options.map((ad) => <button key={ad.id} className={(cfg.addon ?? 'none') === ad.id ? 'on' : ''} onClick={() => { setOv((o) => { const n = { ...o }; for (const k of Object.keys(n)) if (/\.(addon|addon_s|neck)$/.test(k)) delete n[k]; return n; }); set({ addon: ad.id }); }}>{ad.label}</button>)}
            </div>
          </div>
        )}

        <div className="dz-step">
          <p className="dz-label"><span>06</span> Change any part <em>tap in 3D or here</em></p>
          <div className="dz-parts">
            {parts.map((n) => (
              <button key={n.id} className={(sel === n.id ? 'on ' : '') + (ov[n.id] ? 'changed' : '')} onClick={() => pick(n.id)}>
                {partLabel(design, n)}{(copies[n.id] ?? 0) > 1 ? <small>×{copies[n.id]}</small> : null}
              </button>
            ))}
          </div>
          {Object.keys(ov).length > 0 && <button className="dz-link" onClick={fresh}>Undo all part changes</button>}
        </div>

 <div className="dz-step">
          <p className="dz-label"><span>07</span> Have your own design? <em>upload a photo</em></p>
          <button className="dz-upload" onClick={() => setUpload(true)}><Icon name="image" size={18} /> Upload a photo: we cut out the piece so you can change it in 3D</button>
        </div>

        <div className="dz-send">
          <button className="btn-real" onClick={makePhoto}>✦ {photoReady ? 'View the real photo' : 'See it as a real photo'}</button>
          <button className="btn-wa" onClick={sendDesign} disabled={sending}><Icon name="wa" size={20} /> {sending ? 'Preparing picture…' : 'Send this design on WhatsApp'}</button>
          <p className="dz-fine">Sends a picture of your design with its details. Choose WhatsApp, then Bhavani Gold ({SITE.whatsappDisplay}). The gold weight is a 3D estimate; the real piece can differ by 1–5 g. We reply with the exact weight, today’s rate and making charges.</p>
        </div>
      </div>

      {upload && <UploadEditor onClose={() => setUpload(false)} />}
      {photoOpen && photo && (
        <div className="lightbox" onClick={() => setPhotoOpen(false)} data-lenis-prevent>
          <div className="shot-modal rp" onClick={(e) => e.stopPropagation()}>
            {photo.url ? <img src={photo.url} alt="Your design as a real photo" /> : <div className="rp-live" ref={liveRef} />}
            {!photo.url && <div className="rp-bar"><i style={{ width: `${Math.round(photo.progress * 100)}%` }} /><span>Developing your photo… {Math.round(photo.progress * 100)}%</span></div>}
            {photo.url && <>
              <p>This is how your piece will look in real gold. Send this photo to us, or go back and change anything.</p>
              <button className="btn-wa" onClick={() => { setPhotoOpen(false); sendDesign(); }}><Icon name="wa" size={20} /> Send this photo on WhatsApp</button>
              <div style={{ display: 'flex', gap: 10 }}><a className="btn-ghost" href={photo.url} download="bhavani-design-photo.jpg">Download photo</a><button className="btn-ghost" onClick={() => setPhotoOpen(false)}>Back to 3D</button></div>
            </>}
          </div>
        </div>
      )}
      {shot && (
        <div className="lightbox" onClick={() => setShot(null)}>
          <div className="shot-modal" onClick={(e) => e.stopPropagation()}>
            <img src={shot} alt="Your design" />
            <p><b>1.</b> Save this picture: <a className="dz-link" href={shot} download="bhavani-design.jpg">Download</a> (or long-press it on a phone).<br /><b>2.</b> Open our chat and attach the picture.</p>
            <a className="btn-wa" href={wa} target="_blank" rel="noreferrer"><Icon name="wa" size={20} /> Open WhatsApp chat</a>
            <button className="btn-ghost" onClick={() => setShot(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Hands the R3F scene and camera to the page, for the real-photo renderer. */
function Grab({ into }: { into: React.MutableRefObject<{ scene: THREE.Scene; camera: THREE.Camera } | null> }) {
  const { scene, camera } = useThree();
  useEffect(() => { into.current = { scene, camera }; }, [scene, camera, into]);
  return null;
}

function StyleCard({ cfg, style, on, onClick }: { cfg: Cfg; style: string; on: boolean; onClick: () => void }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    const h = window.setTimeout(() => {
      if (!alive) return;
      const c = { ...defaultCfg(cfg.audience, cfg.piece), style, stone: styleStone(style), metal: styleMetal(style) };
      setSrc(designThumb(buildDesign(c), 220, 'dz:' + cfg.audience + style));
    }, 40);
    return () => { alive = false; window.clearTimeout(h); };
  }, [cfg.audience, cfg.piece, style]);
  return (
    <button className={'dz-style' + (on ? ' on' : '')} onClick={onClick}>
      <span className="dz-thumb">{src ? <img src={src} alt="" /> : <span className="spinner" />}</span>
      <span>{STYLE_NAMES[style]}</span>
    </button>
  );
}
