import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import omFontUrl from '@fontsource/noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff?inline';
import { METALS, type MetalId } from '../engine/materials';
import { StudioEnvironment } from '../studio/Viewport';
import { Icon } from '../studio/icons';
import { SITE } from './site';
import { fontFromDataUrl } from './nameplate';
import { buildP, P_DESIGNS, P_SIZES, P_STONES, P_THICK, type PDesign, type PStone } from './pendantStudio';

let omFont: ReturnType<typeof fontFromDataUrl> | null = null;
const getOm = () => (omFont ??= fontFromDataUrl(omFontUrl));
const METAL_IDS: MetalId[] = ['22k-yellow', '18k-rose', '18k-white'];
const METAL_LABEL: Record<string, string> = { '22k-yellow': '22K yellow', '18k-rose': '18K rose', '18k-white': '18K white' };
type Cfg = { design: PDesign; metal: MetalId; size: number; thick: number; stone: PStone };

function Piece({ cfg, onInfo }: { cfg: Cfg; onInfo: (i: { w: number; h: number; g: number }) => void }) {
  const group = useRef<THREE.Group>(null);
  const t0 = useRef(performance.now());
  const built = useMemo(() => {
    const b = buildP(cfg.design, P_SIZES[cfg.size].mm, P_THICK[cfg.thick].mm, cfg.metal, cfg.stone, getOm());
    const links: THREE.Matrix4[] = [];
    const start = b.bail.clone().add(new THREE.Vector3(0, 1.5, 0));
    for (const dir of [-1, 1]) {
      const curve = new THREE.QuadraticBezierCurve3(start, start.clone().add(new THREE.Vector3(dir * 4, 10, 0)), start.clone().add(new THREE.Vector3(dir * 16, 30, -2)));
      const n = Math.round(curve.getLength() / 1.35);
      for (let i = 0; i <= n; i++) {
        const p = curve.getPointAt(i / n), tg = curve.getTangentAt(i / n);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tg);
        if (i % 2) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
        links.push(new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)));
      }
    }
    return { ...b, links };
  }, [cfg.design, cfg.metal, cfg.size, cfg.thick, cfg.stone]);
  useEffect(() => { onInfo({ w: built.w, h: built.h, g: built.grams }); }, [built, onInfo]);
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: METALS[cfg.metal].colour, metalness: 1, roughness: 0.17, clearcoat: 0.35, clearcoatRoughness: 0.1, envMapIntensity: 1.3 }), [cfg.metal]);
  const gemMats = useMemo(() => {
    const m = new Map<string, THREE.Material>();
    for (const g of built.gems) if (g.colour && !m.has(g.colour)) {
      const clear = g.colour === '#ffffff';
      m.set(g.colour, clear
        ? new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0, roughness: 0.02, transmission: 0.95, ior: 2.4, thickness: 1.5, envMapIntensity: 2.4, flatShading: true })
        : new THREE.MeshPhysicalMaterial({ color: g.colour, metalness: 0, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6, flatShading: true }));
    }
    return m;
  }, [built]);
  const linkGeo = useMemo(() => new THREE.TorusGeometry(0.62, 0.17, 8, 18).scale(1.35, 1, 1), []);
  const inst = useRef<THREE.InstancedMesh>(null);
  useEffect(() => { const m = inst.current; if (!m) return; built.links.forEach((x, i) => m.setMatrixAt(i, x)); m.count = built.links.length; m.instanceMatrix.needsUpdate = true; }, [built]);
  useEffect(() => () => { built.metal.dispose(); }, [built]);
  useFrame(() => { if (group.current) group.current.rotation.y = Math.sin((performance.now() - t0.current) / 1600) * 0.45; });
  return (
    <group ref={group} name="pendant">
      <mesh geometry={built.metal} material={mat} />
      <mesh position={built.bail} rotation={[0, Math.PI / 2, 0]} material={mat}><torusGeometry args={[1.6, 0.45, 12, 32]} /></mesh>
      {built.gems.map((g, i) => g.colour && <mesh key={i} position={g.pos} material={gemMats.get(g.colour)}><icosahedronGeometry args={[g.r, 1]} /></mesh>)}
      <instancedMesh ref={inst} args={[linkGeo, mat, 90]} />
    </group>
  );
}

function Fit({ w, h }: { w: number; h: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const tan = Math.tan((cam.fov * Math.PI) / 360);
    const byW = Math.max(w + 24, 38) / 2 / tan / Math.max(cam.aspect, 0.6);
    const byH = (h + 30) / 2 / tan;
    const cy = 3 + h * 0.06;
    cam.position.set(0, cy, Math.max(byW, byH, 52)); cam.lookAt(0, cy, 0); cam.updateProjectionMatrix();
  }, [w, h, camera, size.width, size.height]);
  return null;
}

export default function PendantStudio() {
  const [cfg, setCfg] = useState<Cfg>({ design: 'heart', metal: '22k-yellow', size: 1, thick: 1, stone: 'diamond' });
  const [info, setInfo] = useState({ w: 0, h: 0, g: 0 });
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const set = (p: Partial<Cfg>) => setCfg((c) => ({ ...c, ...p }));
  const d = P_DESIGNS.find((x) => x.id === cfg.design)!;
  const stoneLabel = d.stones ? P_STONES.find((s) => s.id === cfg.stone)!.label : cfg.design === 'evil-eye' ? 'Blue evil-eye stone' : 'None';
  const rate = cfg.metal === '22k-yellow' ? SITE.rates.gold22 : null;
  const msg = [
    'Hello Bhavani Gold! I designed a pendant on your website.',
    `Design: ${d.label}`, `Gold: ${METAL_LABEL[cfg.metal]}`, `Stone: ${stoneLabel}`,
    `Size: ${P_SIZES[cfg.size].label} (about ${info.w.toFixed(0)} × ${info.h.toFixed(0)} mm), ${P_THICK[cfg.thick].label.toLowerCase()} thickness`,
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
    g.fillStyle = '#d9b77a'; g.font = '600 26px Manrope, system-ui, sans-serif'; g.fillText('BHAVANI GOLD · PENDANT', 60, 1050);
    g.fillStyle = '#fbf9f5'; g.font = '400 64px "Playfair Display", Georgia, serif'; g.fillText(d.label, 60, 1130);
    g.fillStyle = '#e0d4c3'; g.font = '500 30px Manrope, system-ui, sans-serif';
    g.fillText(`${METAL_LABEL[cfg.metal]} gold · ${stoneLabel} · about ${info.g.toFixed(1)} g`, 60, 1190);
    g.fillStyle = '#a8957f'; g.font = '500 24px Manrope, system-ui, sans-serif'; g.fillText(`WhatsApp ${SITE.whatsappDisplay}`, 60, 1290);
    return new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.92));
  };
  const send = async () => {
    setBusy(true);
    try {
      const blob = await picture();
      if (blob) {
        const file = new File([blob], `bhavani-${cfg.design}.jpg`, { type: 'image/jpeg' });
        const nav = navigator as Navigator & { canShare?: (x: ShareData) => boolean };
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
        <Canvas dpr={[1, 2]} camera={{ fov: 30, near: 1, far: 2000, position: [0, 3, 80] }} gl={{ preserveDrawingBuffer: true, antialias: true, alpha: true }}
          onCreated={({ gl }) => { canvasRef.current = gl.domElement; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.1; }}>
          <StudioEnvironment intensity={1.1} />
          <ambientLight intensity={0.25} />
          <directionalLight position={[30, 40, 60]} intensity={1.4} />
          <directionalLight position={[-40, 10, 30]} intensity={0.6} color="#ffe6c0" />
          <Piece cfg={cfg} onInfo={setInfo} />
          <Fit w={info.w} h={info.h} />
          <OrbitControls enableZoom={false} enablePan={false} minPolarAngle={Math.PI * 0.3} maxPolarAngle={Math.PI * 0.7} />
        </Canvas>
        <div className="nm-read">
          <div><span>Gold</span><b>{info.g.toFixed(1)}<small> g</small></b><em>{rate ? `≈ ₹${Math.round(rate * info.g).toLocaleString('en-IN')} + making` : 'without chain'}</em></div>
          <div><span>Size</span><b className="sm">{info.w.toFixed(0)} × {info.h.toFixed(0)} mm</b></div>
        </div>
      </div>
      <div className="nm-panel">
        <div className="nm-row"><span>Pick a design</span>
          <div className="nm-designs">{P_DESIGNS.map((x) => <button key={x.id} className={cfg.design === x.id ? 'on' : ''} onClick={() => set({ design: x.id })}><b>{x.label}</b><small>{x.hint}</small></button>)}</div>
        </div>
        <div className="nm-row"><span>Gold</span><div className="nm-seg">{METAL_IDS.map((m) => <button key={m} className={cfg.metal === m ? 'on' : ''} onClick={() => set({ metal: m })}><i style={{ background: METALS[m].colour }} />{METAL_LABEL[m]}</button>)}</div></div>
        {d.stones && <div className="nm-row"><span>Stone</span><div className="nm-seg">{P_STONES.map((s) => <button key={s.id} className={cfg.stone === s.id ? 'on' : ''} onClick={() => set({ stone: s.id })}>{s.colour && <i style={{ background: s.colour }} />}{s.label}</button>)}</div></div>}
        <div className="nm-row"><span>Size</span><div className="nm-seg">{P_SIZES.map((x, i) => <button key={x.label} className={cfg.size === i ? 'on' : ''} onClick={() => set({ size: i })}>{x.label}</button>)}</div></div>
        <div className="nm-row"><span>Thickness</span><div className="nm-seg">{P_THICK.map((x, i) => <button key={x.label} className={cfg.thick === i ? 'on' : ''} onClick={() => set({ thick: i })}>{x.label}</button>)}</div></div>
        <button className="btn-wa" onClick={send} disabled={busy}><Icon name="wa" size={20} /> {busy ? 'Preparing picture…' : `Send this ${d.label.toLowerCase()} on WhatsApp`}</button>
        <p className="nm-fine">Gold weight is a 3D estimate (the real piece can differ by about 0.3–1 g). Chain is priced separately. We confirm exact weight and price on WhatsApp.</p>
      </div>
      {shot && (
        <div className="lightbox" onClick={() => setShot(null)}>
          <div className="shot-modal" onClick={(e) => e.stopPropagation()}>
            <img src={shot} alt={`Pendant: ${d.label}`} />
            <p><b>1.</b> Save this picture: <a className="dz-link" href={shot} download={`bhavani-${cfg.design}.jpg`}>Download</a> (or long-press it).<br /><b>2.</b> Open our chat and attach it.</p>
            <a className="btn-wa" href={wa} target="_blank" rel="noreferrer"><Icon name="wa" size={20} /> Open WhatsApp chat</a>
            <button className="btn-ghost" onClick={() => setShot(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
