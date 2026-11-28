/**
 * Finds the jewellery in a customer's photo and clears everything else
 * (hands, fingers, neck, face, hair, cloth, table). Runs fully in the browser.
 *
 * How: gold is picked up by colour and fine texture; the person's own skin is
 * learnt from the photo (helped by a small face and hand detector), then two
 * colour models (jewellery vs everything else) are refined a few times. Stones
 * set inside the gold are filled back in. The customer can then brush "keep" or
 * "remove" and the cut is recomputed with their marks as hard rules.
 */

export interface Hints { faces: Box[]; hands: Box[] }
export interface Box { x: number; y: number; w: number; h: number }
export interface CutState {
  w: number; h: number;
  rgb: Uint8ClampedArray; // work-size RGBA of the photo
  lab: Float32Array; // 3 per pixel
  tex: Float32Array;
  sat: Float32Array;
  prior: Uint8Array; // 0 unknown, 1 jewellery seed, 2 background seed (automatic)
  user: Uint8Array; // 0 none, 1 keep, 2 remove (customer's brush)
  mask: Float32Array; // 0..1 result
  sal: Float32Array | null; // 0..1 main-object map from the AI helper, if it ran
  product: boolean; // no person in the photo (jewellery on a stand, table or tray)
}

const WORK = 640;

// ---------- colour ----------
function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const f = (c: number) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = h(X), fy = h(Y), fz = h(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; if (h < 0) h += 360;
  return [h, mx ? d / mx : 0, mx / 255];
}

// ---------- image helpers ----------
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0; const row = y * w;
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / (2 * r + 1);
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}
function dilate(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const f = boxBlur(Float32Array.from(m), w, h, r), o = new Uint8Array(w * h);
  for (let i = 0; i < o.length; i++) o[i] = f[i] > 1e-4 ? 1 : 0;
  return o;
}
function erode(m: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const f = boxBlur(Float32Array.from(m), w, h, r), o = new Uint8Array(w * h);
  for (let i = 0; i < o.length; i++) o[i] = f[i] > 1 - 1e-4 ? 1 : 0;
  return o;
}
/** label 8-connected components; returns labels and sizes (index 0 unused) */
function components(m: Uint8Array, w: number, h: number): { lab: Int32Array; size: number[] } {
  const lab = new Int32Array(w * h), size = [0], stack: number[] = [];
  let n = 0;
  for (let i = 0; i < m.length; i++) {
    if (!m[i] || lab[i]) continue;
    n++; let s = 0; lab[i] = n; stack.push(i);
    while (stack.length) {
      const p = stack.pop()!, x = p % w, y = (p - x) / w; s++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy;
        if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const q = Y * w + X;
        if (m[q] && !lab[q]) { lab[q] = n; stack.push(q); }
      }
    }
    size.push(s);
  }
  return { lab, size };
}
/** fill enclosed holes smaller than maxArea (stones sitting inside gold) */
function fillHoles(m: Uint8Array, w: number, h: number, maxArea: number) {
  const inv = new Uint8Array(w * h);
  for (let i = 0; i < inv.length; i++) inv[i] = m[i] ? 0 : 1;
  const { lab, size } = components(inv, w, h);
  const touches = new Uint8Array(size.length);
  for (let x = 0; x < w; x++) { touches[lab[x]] = 1; touches[lab[(h - 1) * w + x]] = 1; }
  for (let y = 0; y < h; y++) { touches[lab[y * w]] = 1; touches[lab[y * w + w - 1]] = 1; }
  for (let i = 0; i < m.length; i++) { const l = lab[i]; if (l && !touches[l] && size[l] < maxArea) m[i] = 1; }
}

// ---------- diagonal Gaussian mixture in Lab ----------
type GMM = { mu: Float64Array; vr: Float64Array; lw: Float64Array; k: number };
function fitGMM(lab: Float32Array, idx: number[], k = 5, iters = 8): GMM | null {
  if (idx.length < 20) return null;
  let pick = idx;
  if (idx.length > 5000) { pick = []; const step = idx.length / 5000; for (let i = 0; i < 5000; i++) pick.push(idx[Math.floor(i * step)]); }
  const n = pick.length; k = Math.min(k, Math.max(1, Math.floor(n / 10)));
  const mu = new Float64Array(k * 3), vr = new Float64Array(k * 3).fill(200), w = new Float64Array(k).fill(1 / k);
  // init: spread over sorted lightness
  const byL = [...pick].sort((a, b) => lab[a * 3] - lab[b * 3]);
  for (let j = 0; j < k; j++) { const p = byL[Math.floor(((j + 0.5) / k) * n)]; for (let c = 0; c < 3; c++) mu[j * 3 + c] = lab[p * 3 + c]; }
  const r = new Float64Array(n * k);
  for (let it = 0; it < iters; it++) {
    for (let i = 0; i < n; i++) {
      const p = pick[i] * 3; let mx = -Infinity;
      for (let j = 0; j < k; j++) {
        let ll = Math.log(w[j]);
        for (let c = 0; c < 3; c++) { const d = lab[p + c] - mu[j * 3 + c]; ll -= 0.5 * (d * d / vr[j * 3 + c] + Math.log(vr[j * 3 + c])); }
        r[i * k + j] = ll; if (ll > mx) mx = ll;
      }
      let s = 0; for (let j = 0; j < k; j++) { const e = Math.exp(r[i * k + j] - mx); r[i * k + j] = e; s += e; }
      for (let j = 0; j < k; j++) r[i * k + j] /= s;
    }
    for (let j = 0; j < k; j++) {
      let nk = 1e-6; const m = [0, 0, 0], m2 = [0, 0, 0];
      for (let i = 0; i < n; i++) { const q = r[i * k + j], p = pick[i] * 3; nk += q; for (let c = 0; c < 3; c++) { m[c] += q * lab[p + c]; m2[c] += q * lab[p + c] * lab[p + c]; } }
      w[j] = nk / n;
      for (let c = 0; c < 3; c++) { mu[j * 3 + c] = m[c] / nk; vr[j * 3 + c] = Math.max(16, m2[c] / nk - (m[c] / nk) ** 2 + 9); }
    }
  }
  const lw = new Float64Array(k);
  for (let j = 0; j < k; j++) lw[j] = Math.log(Math.max(w[j], 1e-6)) - 0.5 * (Math.log(vr[j * 3]) + Math.log(vr[j * 3 + 1]) + Math.log(vr[j * 3 + 2]));
  return { mu, vr, lw, k };
}
function gmmLL(g: GMM, L: number, A: number, B: number) {
  let mx = -Infinity; const t: number[] = [];
  for (let j = 0; j < g.k; j++) {
    const dL = L - g.mu[j * 3], dA = A - g.mu[j * 3 + 1], dB = B - g.mu[j * 3 + 2];
    const ll = g.lw[j] - 0.5 * (dL * dL / g.vr[j * 3] + dA * dA / g.vr[j * 3 + 1] + dB * dB / g.vr[j * 3 + 2]);
    t.push(ll); if (ll > mx) mx = ll;
  }
  let s = 0; for (const v of t) s += Math.exp(v - mx);
  return mx + Math.log(s);
}

// ---------- AI helpers (optional; the cut still works without them) ----------
// Both small models ship inside the page, so their requests are answered from memory.
const BASE = 'https://local.models/';
const files: Record<string, () => Promise<Response>> = {};
let patched = false;
function serve(name: string, make: () => Promise<Response>) {
  files[name] = make;
  if (patched) return;
  patched = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (u.startsWith(BASE)) { const f = files[u.slice(BASE.length)]; if (f) return f(); }
    return realFetch(input, init);
  };
}
const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const json = (t: string) => new Response(t, { headers: { 'Content-Type': 'application/json' } });
const bin = (b: Uint8Array) => new Response(b as BodyInit, { headers: { 'Content-Type': 'application/octet-stream' } });

type HumanT = { detect: (i: HTMLCanvasElement) => Promise<{ face: { box: number[]; score: number }[] }>; tf: any }; // eslint-disable-line @typescript-eslint/no-explicit-any
let humanP: Promise<HumanT> | null = null;
function getHuman(): Promise<HumanT> {
  if (!humanP) humanP = (async () => {
    const [{ Human }, binTxt, jsonText] = await Promise.all([
      import('@vladmandic/human'),
      import('./models/blazefaceBin').then((m) => m.default),
      import('./models/blazeface.json?raw').then((m) => m.default as string),
    ]);
    serve('blazeface.json', async () => json(jsonText));
    serve('blazeface.bin', async () => bin(b64(binTxt)));
    const h = new Human({
      backend: 'webgl', modelBasePath: BASE, warmup: 'none', debug: false, cacheSensitivity: 0,
      face: { enabled: true, detector: { modelPath: 'blazeface.json', rotation: false, maxDetected: 4, minConfidence: 0.5 }, mesh: { enabled: false }, iris: { enabled: false }, description: { enabled: false }, emotion: { enabled: false }, antispoof: { enabled: false }, liveness: { enabled: false } },
      hand: { enabled: false },
      body: { enabled: false }, object: { enabled: false }, gesture: { enabled: false }, segmentation: { enabled: false }, filter: { enabled: false },
    } as never);
    await h.load();
    return h as unknown as HumanT;
  })();
  return humanP;
}

export async function detectHints(img: HTMLCanvasElement): Promise<Hints> {
  try {
    const human = await getHuman();
    const res = await Promise.race([human.detect(img), new Promise<null>((r) => setTimeout(() => r(null), 12000))]);
    if (!res) return { faces: [], hands: [] };
    const toBox = (b: number[]) => ({ x: b[0], y: b[1], w: b[2], h: b[3] });
    return { faces: res.face.filter((f) => f.score >= 0.5).map((f) => toBox(f.box)), hands: [] };
  } catch (e) {
    console.warn('Face helper not available, using colour only.', e);
    return { faces: [], hands: [] };
  }
}

// The "main object" model (u2netp): tells the subject of the photo apart from the
// background, table, flowers and props. It cannot tell jewellery from the person
// wearing it; the colour and skin models below do that part.
let salModelP: Promise<any> | null = null; // eslint-disable-line @typescript-eslint/no-explicit-any
export async function saliency(img: HTMLCanvasElement): Promise<Float32Array | null> {
  try {
    const human = await getHuman();
    const tf = human.tf;
    if (!salModelP) salModelP = (async () => {
      const [binTxt, jsonText] = await Promise.all([
        import('./models/u2netpBin').then((m) => m.default),
        import('./models/u2netp.json?raw').then((m) => m.default as string),
      ]);
      serve('u2netp.json', async () => json(jsonText));
      serve('group1-shard1of1.bin', async () => bin(b64(binTxt)));
      return tf.loadGraphModel(BASE + 'u2netp.json');
    })();
    const model = await salModelP;
    const w = img.width, h = img.height;
    const out: Float32Array = tf.tidy(() => {
      const x = tf.div(tf.cast(tf.browser.fromPixels(img), 'float32'), 255);
      const r = tf.image.resizeBilinear(x, [320, 320]);
      const n = tf.expandDims(tf.div(tf.sub(r, tf.tensor1d([0.485, 0.456, 0.406])), tf.tensor1d([0.229, 0.224, 0.225])), 0);
      const y = model.execute(n, 'Identity:0');
      const mn = tf.min(y), mx = tf.max(y);
      const s = tf.div(tf.sub(y, mn), tf.add(tf.sub(mx, mn), 1e-6));
      return tf.reshape(tf.image.resizeBilinear(s, [h, w]), [h * w]).dataSync() as Float32Array;
    });
    return Float32Array.from(out);
  } catch (e) {
    console.warn('Main-object helper not available, using colour only.', e);
    return null;
  }
}

/** Scale the photo to work size and draw it onto a canvas. */
export function workCanvas(img: CanvasImageSource & { width: number; height: number }): HTMLCanvasElement {
  const k = Math.min(1, WORK / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const inBox = (b: Box, x: number, y: number, s = 1) => { const cx = b.x + b.w / 2, cy = b.y + b.h / 2; return Math.abs(x - cx) < (b.w * s) / 2 && Math.abs(y - cy) < (b.h * s) / 2; };
const inFace = (b: Box, x: number, y: number, s = 1) => { const cx = b.x + b.w / 2, cy = b.y + b.h * 0.36, rx = (b.w * 0.34 * s), ry = (b.h * 0.38 * s); return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1; };

/** First, automatic cut. */
export function autoCut(work: HTMLCanvasElement, hints: Hints, sal: Float32Array | null = null): CutState {
  const w = work.width, h = work.height, N = w * h;
  const rgb = work.getContext('2d')!.getImageData(0, 0, w, h).data;
  const lab = new Float32Array(N * 3), lum = new Float32Array(N), H = new Float32Array(N), S = new Float32Array(N), V = new Float32Array(N);
  const skinC = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const r = rgb[i * 4], g = rgb[i * 4 + 1], b = rgb[i * 4 + 2];
    const [L, A, B] = srgbToLab(r, g, b); lab[i * 3] = L; lab[i * 3 + 1] = A; lab[i * 3 + 2] = B;
    const [hh, ss, vv] = rgbToHsv(r, g, b); H[i] = hh; S[i] = ss; V[i] = vv;
    lum[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const Cr = 128 + 0.5 * r - 0.4187 * g - 0.0813 * b, Cb = 128 - 0.1687 * r - 0.3313 * g + 0.5 * b;
    skinC[i] = Cr > 135 && Cr < 178 && Cb > 80 && Cb < 130 && !(ss > 0.55 && hh >= 30) ? 1 : 0;
  }
  const m1 = boxBlur(lum, w, h, 2), m2 = boxBlur(lum.map((v) => v * v), w, h, 2), tex = new Float32Array(N);
  for (let i = 0; i < N; i++) tex[i] = Math.sqrt(Math.max(0, m2[i] - m1[i] * m1[i]));

  const gold = new Uint8Array(N);
  let gN = 0;
  // with the AI helper, metal only counts on the photo's main object (not the table, flowers or wall)
  const onObj = (i: number, t = 0.35) => !sal || sal[i] > t;
  for (let i = 0; i < N; i++) { gold[i] = H[i] >= 22 && H[i] <= 58 && S[i] > 0.38 && V[i] > 0.35 && tex[i] > 0.035 && onObj(i) ? 1 : 0; gN += gold[i]; }
  if (gN < 0.003 * N) { gN = 0; for (let i = 0; i < N; i++) { gold[i] = ((H[i] >= 20 && H[i] <= 60) || (sal && (H[i] <= 20 || H[i] >= 345))) && S[i] > 0.24 && V[i] > 0.3 && tex[i] > 0.025 && onObj(i, 0.5) ? 1 : 0; gN += gold[i]; } }
  // no face and hardly any skin: a product photo, where rose gold and pearls can be taken safely
  // (judged on the main object only: a beige pedestal or backdrop is skin-coloured too)
  let objN = 0, objSkin = 0;
  if (sal) for (let i = 0; i < N; i++) if (sal[i] > 0.5) { objN++; if (skinC[i] && tex[i] < 0.03) objSkin++; }
  const product = !!sal && hints.faces.length === 0 && objN > 0 && objSkin < 0.35 * objN;
  if (sal && product) {
    // the AI found the main object: also take rose gold, and pearls or stones beside the metal
    for (let i = 0; i < N; i++) if (!gold[i] && (H[i] <= 22 || H[i] >= 345) && S[i] > 0.3 && V[i] > 0.4 && tex[i] > 0.03 && sal[i] > 0.45) { gold[i] = 1; gN++; }
    const nearG = dilate(gold, w, h, 6);
    for (let i = 0; i < N; i++) if (!gold[i] && nearG[i] && V[i] > 0.72 && tex[i] > 0.045 && sal[i] > 0.55) { gold[i] = 1; gN++; }
  }
  if (sal) {
    // the outline of the main object (a bust's edge, a shoulder) is lit and textured but is not metal
    const sb = boxBlur(sal, w, h, 4);
    for (let i = 0; i < N; i++) if (gold[i] && Math.abs(sal[i] - sb[i]) > 0.06 && S[i] < 0.5) { gold[i] = 0; gN--; }
  }
  // shiny white highlights on the gold belong to it too
  { const ring = dilate(gold, w, h, 3); for (let i = 0; i < N; i++) if (ring[i] && !gold[i] && V[i] > 0.78 && S[i] < 0.3 && !skinC[i]) gold[i] = 1; }
  // skin learnt from this photo: smooth skin-coloured areas, plus skin inside detected faces and hands
  const skinSeed = new Uint8Array(N);
  for (let i = 0; i < N; i++) skinSeed[i] = skinC[i] && tex[i] < 0.03 ? 1 : 0;
  { const { lab: cl, size } = components(skinSeed, w, h); for (let i = 0; i < N; i++) if (skinSeed[i] && size[cl[i]] < 0.01 * N) skinSeed[i] = 0; }
  // a real face is mostly skin; a detector hit on a gold medallion is not
  hints = { ...hints, faces: hints.faces.filter((f) => {
    let n = 0, sk = 0;
    for (let y = Math.max(0, Math.floor(f.y)); y < Math.min(h, f.y + f.h); y += 2) for (let x = Math.max(0, Math.floor(f.x)); x < Math.min(w, f.x + f.w); x += 2) {
      if (!inFace(f, x, y)) continue; n++; if (skinC[y * w + x]) sk++;
    }
    return n > 20 && sk / n > 0.45;
  }) };
  const faceCore = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    for (const f of hints.faces) { if (inFace(f, x, y)) faceCore[i] = 1; if (inFace(f, x, y, 0.8) && skinC[i] && tex[i] < 0.06) skinSeed[i] = 1; }
    for (const hb of hints.hands) if (inBox(hb, x, y, 0.85) && skinC[i] && tex[i] < 0.05 && !gold[i]) skinSeed[i] = 1;
  }
  const skinIdx: number[] = [], goldIdx: number[] = [];
  for (let i = 0; i < N; i++) { if (skinSeed[i]) skinIdx.push(i); if (gold[i]) goldIdx.push(i); }
  const skinLike = new Uint8Array(N);
  const gs = fitGMM(lab, skinIdx, 4), gg = fitGMM(lab, goldIdx, 4);
  if (gs && gg) for (let i = 0; i < N; i++) if (gmmLL(gs, lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]) - gmmLL(gg, lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]) > 1) skinLike[i] = 1;

  const prior = new Uint8Array(N);
  const bw = Math.max(3, Math.round(0.03 * Math.max(w, h)));
  let fgN = 0;
  for (let i = 0; i < N; i++) {
    // inside a face only clearly non-skin metal stays (a nose stud, a tikka)
    if (gold[i] && !skinLike[i] && (!faceCore[i] || S[i] > 0.5)) { prior[i] = 1; fgN++; }
  }
  // large plain surfaces (a display bust, a pedestal, a wall) are never the piece, even if they are the main object
  let plain = new Uint8Array(N);
  if (sal) { for (let i = 0; i < N; i++) plain[i] = tex[i] < 0.016 ? 1 : 0; plain = dilate(erode(plain, w, h, 4), w, h, 2); }
  if (sal) for (let i = 0; i < N; i++) if (plain[i] && prior[i] === 1) { prior[i] = 0; fgN--; }
  const fgOpen = dilate(erode(prior.map((v) => (v === 1 ? 1 : 0)), w, h, 1), w, h, 1);
  const near = dilate(fgOpen, w, h, 7);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (prior[i] === 1 && !fgOpen[i]) prior[i] = 0;
    if (prior[i] === 1) continue;
    const border = x < bw || y < bw || x >= w - bw || y >= h - bw;
    if ((sal && (sal[i] < 0.25 || plain[i])) || border || ((skinC[i] || skinLike[i]) && tex[i] < 0.06) || skinLike[i] || (!near[i] && tex[i] < 0.02) || (faceCore[i] && !(S[i] > 0.5 && gold[i]))) prior[i] = 2;
  }
  const st: CutState = { w, h, rgb, lab, tex, sat: S, prior, user: new Uint8Array(N), mask: new Float32Array(N), sal, product };
  if (fgN < 30) {
    // nothing gold-like found (silver, white stones): start from the centre of the photo
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; if ((sal ? sal[i] > 0.7 && tex[i] > 0.03 : Math.abs(x - w / 2) < w * 0.12 && Math.abs(y - h / 2) < h * 0.12) && !skinLike[i]) prior[i] = 1; }
  }
  refine(st);
  return st;
}

/** Recompute the cut from automatic seeds plus the customer's keep/remove marks. */
export function refine(st: CutState) {
  const { w, h, lab, prior, user } = st, N = w * h;
  const bw = Math.max(3, Math.round(0.03 * Math.max(w, h)));
  let fg = new Uint8Array(N), bg = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const u = user[i];
    fg[i] = !u && prior[i] === 1 ? 1 : 0;
    bg[i] = u === 2 || (!u && prior[i] === 2) ? 1 : 0;
  }
  let p = new Float32Array(N);
  for (let it = 0; it < 3; it++) {
    const fi: number[] = [], bi: number[] = [];
    for (let i = 0; i < N; i++) { if (fg[i]) fi.push(i); else if (bg[i]) bi.push(i); }
    const mf = fitGMM(lab, fi), mb = fitGMM(lab, bi);
    if (!mf || !mb) { st.mask.fill(0); return; }
    for (let i = 0; i < N; i++) {
      const d = gmmLL(mf, lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]) - gmmLL(mb, lab[i * 3], lab[i * 3 + 1], lab[i * 3 + 2]);
      p[i] = 1 / (1 + Math.exp(-Math.max(-30, Math.min(30, d))));
    }
    p = boxBlur(p, w, h, 1);
    const nf = new Uint8Array(N), nb = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const x = i % w, y = (i - x) / w, border = x < bw || y < bw || x >= w - bw || y >= h - bw;
      if (user[i] === 2) nb[i] = 1; else if (user[i] === 1) { /* kept, but not taught to the colour model */ }
      else { nf[i] = p[i] > 0.8 && !border && prior[i] !== 2 ? 1 : 0; nb[i] = p[i] < 0.2 || border || prior[i] === 2 ? 1 : 0; }
    }
    fg = nf; bg = nb;
  }
  let m = new Uint8Array(N);
  for (let i = 0; i < N; i++) m[i] = user[i] === 1 ? 1 : user[i] === 2 ? 0 : p[i] > 0.5 && prior[i] !== 2 ? 1 : 0;
  if (st.sal) {
    // with the AI map, stay close to the metal that was actually found
    const seeds = new Uint8Array(N); for (let i = 0; i < N; i++) seeds[i] = prior[i] === 1 ? 1 : 0;
    const near = dilate(seeds, w, h, Math.max(3, Math.round(0.006 * Math.max(w, h))));
    for (let i = 0; i < N; i++) if (!user[i]) m[i] = (m[i] && near[i]) || seeds[i] ? 1 : 0;
  }
  // keep the pieces that contain jewellery seeds (or the customer's keep marks)
  const { lab: cl, size } = components(m, w, h);
  const seeded = new Uint8Array(size.length);
  for (let i = 0; i < N; i++) if (cl[i] && (prior[i] === 1 || user[i] === 1)) seeded[cl[i]] = 1;
  let big = 0; for (let l = 1; l < size.length; l++) if (seeded[l] && size[l] > big) big = size[l];
  // with the AI map, a piece must be well covered by metal seeds (a patch of bust or cloth is not)
  const seedN = new Int32Array(size.length);
  if (st.sal) for (let i = 0; i < N; i++) if (cl[i] && prior[i] === 1) seedN[cl[i]]++;
  for (let i = 0; i < N; i++) { const l = cl[i]; m[i] = l && seeded[l] && (size[l] > Math.max(12, 0.07 * big) || user[i] === 1) && (!st.sal || seedN[l] > 0.04 * size[l] || size[l] === big) ? 1 : 0; }
  // around the customer's keep marks, take in nearby pixels that look like the piece
  { const keep = new Uint8Array(N); let any = 0; for (let i = 0; i < N; i++) if (user[i] === 1) { keep[i] = 1; any = 1; }
    if (any) { const near = dilate(keep, w, h, 4); for (let i = 0; i < N; i++) if (keep[i] || (near[i] && p[i] > 0.3 && user[i] !== 2)) m[i] = 1; } }
  // grow into stones that touch the gold: coloured, sparkly, not skin or plain background
  for (let it = 0; it < 8; it++) {
    const ring = dilate(m, w, h, 1); let added = 0;
    for (let i = 0; i < N; i++) if (ring[i] && !m[i] && user[i] !== 2 && prior[i] !== 2 && p[i] > 0.25 && st.tex[i] > 0.045 && st.sat[i] > 0.28) { m[i] = 1; added++; }
    if (!added) break;
  }
  // pearls and white stones set on the piece: small bright blobs touching it, on the main object
  const extra = new Uint8Array(N);
  if (st.sal && st.product) {
    const sal = st.sal, V = new Float32Array(N);
    for (let i = 0; i < N; i++) V[i] = Math.max(st.rgb[i * 4], st.rgb[i * 4 + 1], st.rgb[i * 4 + 2]) / 255;
    const loc = boxBlur(V, w, h, 8), cand = new Uint8Array(N);
    for (let i = 0; i < N; i++) cand[i] = !m[i] && user[i] !== 2 && sal[i] > 0.45 && st.sat[i] < 0.35 && V[i] > 0.6 && (V[i] - loc[i] > 0.03 || st.tex[i] > 0.04) ? 1 : 0;
    const { lab: pl, size: ps } = components(cand, w, h);
    // a pearl or stone is a small round blob; a lit edge of a bust or a shoulder is long and thin
    const bx0 = new Int32Array(ps.length).fill(1e9), by0 = new Int32Array(ps.length).fill(1e9), bx1 = new Int32Array(ps.length).fill(-1), by1 = new Int32Array(ps.length).fill(-1);
    for (let i = 0; i < N; i++) { const l = pl[i]; if (!l) continue; const x = i % w, y = (i - x) / w; if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y; }
    const round = new Uint8Array(ps.length);
    for (let l = 1; l < ps.length; l++) { const bw2 = bx1[l] - bx0[l] + 1, bh2 = by1[l] - by0[l] + 1; round[l] = ps[l] >= 4 && ps[l] < 0.002 * N && ps[l] / (bw2 * bh2) > 0.4 && Math.max(bw2, bh2) / Math.min(bw2, bh2) < 2.5 ? 1 : 0; }
    for (let pass = 0; pass < 6; pass++) {
      const touch = new Uint8Array(ps.length), ring = dilate(m, w, h, 2); let added = 0;
      for (let i = 0; i < N; i++) if (pl[i] && ring[i] && !m[i]) touch[pl[i]] = 1;
      for (let i = 0; i < N; i++) { const l = pl[i]; if (l && touch[l] && round[l] && !m[i]) { m[i] = 1; extra[i] = 1; added++; } }
      if (!added) break;
    }
  }
  // close tiny gaps, then fill stones enclosed by gold
  const r = Math.max(1, Math.round(0.006 * Math.max(w, h)));
  m = erode(dilate(m, w, h, r), w, h, r);
  fillHoles(m, w, h, 0.004 * N);
  if (st.sal) {
    // keep to the metal that was found (plus the pearls beside it); drop plain cloth that got filled in
    const seeds = new Uint8Array(N); for (let i = 0; i < N; i++) seeds[i] = prior[i] === 1 ? 1 : 0;
    const near = dilate(seeds, w, h, r), nearX = dilate(extra, w, h, r + 1);
    for (let i = 0; i < N; i++) if (m[i] && (st.sal[i] < 0.2 || !(near[i] || nearX[i]) || (st.tex[i] < 0.015 && st.sat[i] < 0.2 && !seeds[i] && !extra[i]))) m[i] = 0;
  }
  for (let i = 0; i < N; i++) if (user[i] === 2) m[i] = 0; else if (user[i] === 1) m[i] = 1;
  const soft = boxBlur(Float32Array.from(m), w, h, 1);
  st.mask.set(soft);
}

/** Paint the customer's keep (1) / remove (2) / clear (0) marks at work-size coordinates. */
export function paint(st: CutState, x: number, y: number, radius: number, v: 0 | 1 | 2) {
  const { w, h } = st, r2 = radius * radius;
  for (let yy = Math.max(0, Math.floor(y - radius)); yy <= Math.min(h - 1, Math.ceil(y + radius)); yy++)
    for (let xx = Math.max(0, Math.floor(x - radius)); xx <= Math.min(w - 1, Math.ceil(x + radius)); xx++)
      if ((xx - x) ** 2 + (yy - y) ** 2 <= r2) st.user[yy * w + xx] = v;
}

/** The jewellery alone, at up to `max` px, transparent everywhere else; trimmed to the item. */
export function cutoutCanvas(src: CanvasImageSource & { width: number; height: number }, st: CutState, max = 1400): { canvas: HTMLCanvasElement; empty: boolean; x0: number; y0: number } {
  const k = Math.min(1, max / Math.max(src.width, src.height));
  const W = Math.round(src.width * k), Hh = Math.round(src.height * k);
  const c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const g = c.getContext('2d')!; g.drawImage(src, 0, 0, W, Hh);
  const id = g.getImageData(0, 0, W, Hh), d = id.data;
  const { w, h, mask } = st;
  let x0 = W, y0 = Hh, x1 = -1, y1 = -1;
  for (let y = 0; y < Hh; y++) {
    const fy = Math.min(h - 1.001, (y / Hh) * h), iy = Math.floor(fy), ty = fy - iy;
    for (let x = 0; x < W; x++) {
      const fx = Math.min(w - 1.001, (x / W) * w), ix = Math.floor(fx), tx = fx - ix, i = iy * w + ix;
      const a = (mask[i] * (1 - tx) + mask[i + 1] * tx) * (1 - ty) + (mask[i + w] * (1 - tx) + mask[i + w + 1] * tx) * ty;
      const A = Math.max(0, Math.min(1, (a - 0.35) / 0.25));
      d[(y * W + x) * 4 + 3] = Math.round(A * 255);
      if (A > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
  }
  g.putImageData(id, 0, 0);
  if (x1 < 0) return { canvas: c, empty: true, x0: 0, y0: 0 };
  const pad = Math.round(0.04 * Math.max(x1 - x0, y1 - y0)) + 4;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(Hh - 1, y1 + pad);
  const t = document.createElement('canvas'); t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
  t.getContext('2d')!.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
  return { canvas: t, empty: false, x0, y0 };
}
