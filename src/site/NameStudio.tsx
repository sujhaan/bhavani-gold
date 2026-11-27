import '@fontsource/great-vibes/400.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import scriptFontUrl from '@fontsource/great-vibes/files/great-vibes-latin-400-normal.woff?inline';
import classicFontUrl from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff?inline';
import { METALS } from '../engine/materials';
import { StudioEnvironment } from '../studio/Viewport';
import { Icon } from '../studio/icons';
import { SITE } from './site';
import { NAME_METALS, NAME_THICK, NAME_WIDTH, cleanName, fontFromDataUrl, type NameCfg, type NameStyle } from './nameplate';
import { buildPendant, FORCE_CLASSIC, PENDANT_DESIGNS, type PendantDesign } from './pendantDesigns';

const fonts: Partial<Record<NameStyle, ReturnType<typeof fontFromDataUrl>>> = {};
const fontFor = (s: NameStyle) => (fonts[s] ??= fontFromDataUrl(s === 'script' ? scriptFontUrl : classicFontUrl));
const METAL_LABEL: Record<string, string> = { '22k-yellow': '22K yellow', '18k-rose': '18K rose', '18k-white': '18K white' };

function goldMaterial(metal: NameCfg['metal']) {
  return new THREE.MeshPhysicalMaterial({ color: METALS[metal].colour, metalness: 1, roughness: 0.17, clearcoat: 0.35, clearcoatRoughness: 0.1, envMapIntensity: 1.3 });
}

/** The pendant, its jump ring(s) and a short run of cable chain leading out of frame. */
function Pendant({ cfg, design, text2, onInfo }: { cfg: NameCfg; design: PendantDesign; text2: string; onInfo: (i: { w: number; h: number; g: number }) => void }) {
  const group = useRef<THREE.Group>(null);
  const t0 = useRef(performance.now());
  const built = useMemo(() => {
    const style: NameStyle = FORCE_CLASSIC.includes(design) ? 'classic' : cfg.style;
    const b = buildPendant(design, fontFor(style), fontFor('script'), cfg.text || 'Name', text2, NAME_WIDTH[cfg.width].mm, NAME_THICK[cfg.thick].mm, cfg.metal);
    const links: THREE.Matrix4[] = [];
    const runs: [THREE.Vector3, number][] = b.chain === 'sides'
      ? b.rings.map((r, i) => [r.pos.clone().add(new THREE.Vector3(i ? 1.4 : -1.4, 0.4, 0)), i ? 1 : -1])
      : [[b.rings[0].pos.clone().add(new THREE.Vector3(0, 1.5, 0)), -1], [b.rings[0].pos.clone().add(new THREE.Vector3(0, 1.5, 0)), 1]];
    for (const [start, dir] of runs) {
      const curve = b.chain === 'sides'
        ? new THREE.QuadraticBezierCurve3(start, start.clone().add(new THREE.Vector3(dir * 8, 7, 0)), start.clone().add(new THREE.Vector3(dir * 13, 26, -2)))
        : new THREE.QuadraticBezierCurve3(start, start.clone().add(new THREE.Vector3(dir * 4, 10, 0)), start.clone().add(new THREE.Vector3(dir * 16, 30, -2)));
      const n = Math.round(curve.getLength() / 1.35);
      for (let i = 0; i <= n; i++) {
        const p = curve.getPointAt(i / n), tg = curve.getTangentAt(i / n);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tg);
        if (i % 2) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
        links.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
      }
    }
    return { ...b, links };
  }, [cfg.text, cfg.style, cfg.thick, cfg.width, cfg.metal, design, text2]);
  useEffect(() => { onInfo({ w: built.w, h: built.h, g: built.grams }); }, [built, onInfo]);
  const mat = useMemo(() => goldMaterial(cfg.metal), [cfg.metal]);
  const gemMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 0.95, ior: 2.4, thickness: 1.5, envMapIntensity: 2.4, flatShading: true }), []);
  const linkGeo = useMemo(() => new THREE.TorusGeometry(0.62, 0.17, 8, 18).scale(1.35, 1, 1), []);
  const inst = useRef<THREE.InstancedMesh>(null);
  useEffect(() => { const m = inst.current; if (!m) return; built.links.forEach((x, i) => m.setMatrixAt(i, x)); m.count = built.links.length; m.instanceMatrix.needsUpdate = true; }, [built]);
  useEffect(() => () => { built.metal.dispose(); }, [built]);
  useFrame(() => { if (group.current) group.current.rotation.y = Math.sin((performance.now() - t0.current) / 1600) * 0.42; });
  return (
    <group ref={group} name="nameplate">
      <mesh geometry={built.metal} material={mat} />
      {built.rings.map((r, i) => <mesh key={i} position={r.pos} rotation={[0, r.up ? Math.PI / 2 : 0, 0]} material={mat}><torusGeometry args={[1.6, 0.45, 12, 32]} /></mesh>)}
      {built.gem && <mesh position={built.gem.pos} material={gemMat}><octahedronGeometry args={[built.gem.r, 1]} /></mesh>}
      <instancedMesh ref={inst} args={[linkGeo, mat, 90]} />
    </group>
  );
}

function Fit({ w, h }: { w: number; h: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const tan = Math.tan((cam.fov * Math.PI) / 360);
    const byW = Math.max(w + 22, 40) / 2 / tan / Math.max(cam.aspect, 0.6);
    const byH = (h + 26) / 2 / tan;
    const cy = 2 + h * 0.08;
    cam.position.set(0, cy, Math.max(byW, byH, 55)); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
  }, [w, h, camera, size.width, size.height]);
  return null;
}

export default function NameStudio() {
  const [cfg, setCfg] = useState<NameCfg>({ text: 'Bhavani', style: 'script', metal: '22k-yellow', thick: 1, width: 1 });
  const [info, setInfo] = useState({ w: 0, h: 0, g: 0 });
  const [design, setDesign] = useState<PendantDesign>('nameplate');
  const [text2, setText2] = useState('Sita');
  const dLabel = PENDANT_DESIGNS.find((d) => d.id === design)!.label;
  const lockedStyle = FORCE_CLASSIC.includes(design) ? 'classic' : (['heart', 'infinity', 'couple'].includes(design) ? 'script' : null);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const set = (p: Partial<NameCfg>) => setCfg((c) => ({ ...c, ...p }));
  const rate = cfg.metal === '22k-yellow' ? SITE.rates.gold22 : null;
  const text = cfg.text.trim() || 'Name';
  const msg = [
    'Hello Bhavani Gold! I designed a name pendant on your website.',
    `Design: ${dLabel}`,
    `Name: ${design === 'couple' ? `${text} & ${text2.trim() || 'Love'}` : design === 'initial' ? `${text.charAt(0).toUpperCase()} (initial)` : text}`, `Style: ${(lockedStyle ?? cfg.style) === 'script' ? 'Script' : 'Classic'} lettering · ${METAL_LABEL[cfg.metal]} gold`,
    `Size: about ${info.w.toFixed(0)} × ${info.h.toFixed(0)} mm, ${NAME_THICK[cfg.thick].label.toLowerCase()} thickness`,
    `Estimated gold: about ${info.g.toFixed(1)} g without chain (3D estimate).`,
    'Please share the exact weight, price and making time.',
  ].join('\n');
  const wa = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(msg)}`;

  const picture = async (): Promise<Blob | null> => {
    const src = canvasRef.current; if (!src) return null;
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); if (!g) return null;
    const bg = g.createRadialGradient(W / 2, H * 0.38, 40, W / 2, H * 0.4, W * 0.85);
    bg.addColorStop(0, '#5c442e'); bg.addColorStop(0.6, '#2a1e16'); bg.addColorStop(1, '#1e150f');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const k = Math.min((W - 80) / src.width, 900 / src.height);
    g.drawImage(src, (W - src.width * k) / 2, 60 + (900 - src.height * k) / 2, src.width * k, src.height * k);
    g.fillStyle = '#d9b77a'; g.font = '600 26px Manrope, system-ui, sans-serif'; g.fillText(`BHAVANI GOLD · ${dLabel.toUpperCase()} PENDANT`, 60, 1050);
    g.fillStyle = '#fbf9f5'; g.font = '400 64px "Playfair Display", Georgia, serif'; g.fillText(design === 'couple' ? `${text} & ${text2.trim() || 'Love'}` : text, 60, 1130);
    g.fillStyle = '#e0d4c3'; g.font = '500 30px Manrope, system-ui, sans-serif';
    g.fillText(`${METAL_LABEL[cfg.metal]} gold · about ${info.g.toFixed(1)} g (3D estimate)`, 60, 1190);
    g.fillStyle = '#a8957f'; g.font = '500 24px Manrope, system-ui, sans-serif'; g.fillText(`WhatsApp ${SITE.whatsappDisplay}`, 60, 1290);
    return new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.92));
  };
  const send = async () => {
    setBusy(true);
    try {
      const blob = await picture();
      if (blob) {
        const file = new File([blob], `bhavani-${text.toLowerCase().replace(/\s+/g, '-')}.jpg`, { type: 'image/jpeg' });
        const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
        if (nav.canShare?.({ files: [file] })) {
          try { await nav.share({ files: [file], text: msg }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
        }
        setShot(URL.createObjectURL(blob));
      } else window.open(wa, '_blank');
    } finally { setBusy(false); }
  };

  return (
    <div className="nm">
      <div className="nm-stage" data-lenis-prevent>
        <Canvas dpr={[1, 2]} camera={{ fov: 30, near: 1, far: 2000, position: [0, 2, 80] }} gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
          onCreated={({ gl }) => { canvasRef.current = gl.domElement; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }}>
          <StudioEnvironment intensity={1.1} />
          <ambientLight intensity={0.25} />
          <directionalLight position={[30, 40, 60]} intensity={1.4} />
          <directionalLight position={[-40, 10, 30]} intensity={0.6} color="#ffe6c0" />
          <Pendant cfg={cfg} design={design} text2={text2} onInfo={setInfo} />
          <Fit w={info.w} h={info.h} />
          <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.7} />
        </Canvas>
        <div className="nm-read">
          <div><span>Gold</span><b>{info.g.toFixed(1)}<small> g</small></b><em>{rate ? `≈ ₹${Math.round(rate * info.g).toLocaleString('en-IN')} + making` : 'without chain'}</em></div>
          <div><span>Size</span><b className="sm">{info.w.toFixed(0)} × {info.h.toFixed(0)} mm</b></div>
        </div>
      </div>
      <div className="nm-panel">
        <div className="nm-row"><span>Design</span>
          <div className="nm-designs">{PENDANT_DESIGNS.map((d) => <button key={d.id} className={design === d.id ? 'on' : ''} onClick={() => setDesign(d.id)}><b>{d.label}</b><small>{d.hint}</small></button>)}</div>
        </div>
        <label className="nm-label" htmlFor="nm-in">{design === 'couple' ? 'First name' : design === 'initial' ? 'Your name (we use the first letter)' : 'Type a name'}</label>
        <input id="nm-in" className={'nm-input ' + cfg.style} value={cfg.text} maxLength={12} placeholder="Your name" autoComplete="off"
          onChange={(e) => set({ text: cleanName(e.target.value) })} />
        {design === 'couple' && <input className="nm-input script" value={text2} maxLength={12} placeholder="Second name" autoComplete="off" aria-label="Second name" onChange={(e) => setText2(cleanName(e.target.value))} />}
        <p className="nm-hint">Up to 12 letters. Try your name, your child’s, or someone you love.</p>
        {lockedStyle ? <p className="nm-hint">This design uses {lockedStyle === 'script' ? 'script' : 'block'} lettering so the piece holds together.</p> : <div className="nm-row"><span>Lettering</span><div className="nm-seg">{(['script', 'classic'] as const).map((s) => <button key={s} className={(cfg.style === s ? 'on ' : '') + s} onClick={() => set({ style: s })}>{s === 'script' ? 'Script' : 'Classic'}</button>)}</div></div>}
        <div className="nm-row"><span>Gold</span><div className="nm-seg">{NAME_METALS.map((m) => <button key={m} className={cfg.metal === m ? 'on' : ''} onClick={() => set({ metal: m })}><i style={{ background: METALS[m].colour }} />{METAL_LABEL[m]}</button>)}</div></div>
        <div className="nm-row"><span>Width</span><div className="nm-seg">{NAME_WIDTH.map((x, i) => <button key={x.label} className={cfg.width === i ? 'on' : ''} onClick={() => set({ width: i })}>{x.label}</button>)}</div></div>
        <div className="nm-row"><span>Thickness</span><div className="nm-seg">{NAME_THICK.map((x, i) => <button key={x.label} className={cfg.thick === i ? 'on' : ''} onClick={() => set({ thick: i })}>{x.label}</button>)}</div></div>
        <button className="btn-wa" onClick={send} disabled={busy}><Icon name="wa" size={20} /> {busy ? 'Preparing picture…' : `Send this ${dLabel.toLowerCase()} on WhatsApp`}</button>
        <p className="nm-fine">Gold weight is a 3D estimate (the real piece can differ by about 0.3–1 g). Chain is priced separately. We confirm exact weight and price on WhatsApp.</p>
      </div>
      {shot && (
        <div className="lightbox" onClick={() => setShot(null)}>
          <div className="shot-modal" onClick={(e) => e.stopPropagation()}>
            <img src={shot} alt={`Name pendant: ${text}`} />
            <p><b>1.</b> Save this picture: <a className="dz-link" href={shot} download={`bhavani-${text}.jpg`}>Download</a> (or long-press it).<br /><b>2.</b> Open our chat and attach it.</p>
            <a className="btn-wa" href={wa} target="_blank" rel="noreferrer"><Icon name="wa" size={20} /> Open WhatsApp chat</a>
            <button className="btn-ghost" onClick={() => setShot(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
