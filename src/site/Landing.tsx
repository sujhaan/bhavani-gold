import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { BULLION, GALLERY, SITE, type GalleryCat } from './site';
import { POSTS, type Post } from './journal';
import { createPortal } from 'react-dom';
import { Icon } from '../studio/icons';

const Designer = lazy(() => import('./Designer'));
gsap.registerPlugin(ScrollTrigger);

const photo = (id: string) => `photos/${id}.jpg`;

type Rates = { gold24: number | null; gold22: number | null; silver: number | null; updatedAt: string };
/** Rates from the shop's published Google Sheet (if set), else the fixed values in site.ts. */
function useRates(): Rates {
  const [r, setR] = useState<Rates>(SITE.rates);
  useEffect(() => {
    if (!SITE.ratesSheetCsv) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 8000);
    fetch(SITE.ratesSheetCsv + (SITE.ratesSheetCsv.includes('?') ? '&' : '?') + 't=' + Date.now(), { signal: ctl.signal })
      .then((res) => (res.ok ? res.text() : Promise.reject()))
      .then((csv) => {
        const map: Record<string, string> = {};
        for (const line of csv.split(/\r?\n/)) {
          const [k, ...v] = line.split(',');
          if (k) map[k.trim().toLowerCase().replace(/"/g, '')] = v.join(',').trim().replace(/^"|"$/g, '');
        }
        const n = (k: string) => { const x = Number((map[k] ?? '').replace(/[^0-9.]/g, '')); return x > 0 ? x : null; };
        setR({ gold24: n('gold24'), gold22: n('gold22'), silver: n('silver'), updatedAt: map.updated ?? '' });
      })
      .catch(() => undefined)
      .finally(() => window.clearTimeout(t));
    return () => ctl.abort();
  }, []);
  return r;
}
const wa = (text: string) => `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(text)}`;
const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

// ------------------------------------------------------------ motion
function useMotion(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = root.current; if (!el) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.documentElement.classList.add('js');
    let lenis: Lenis | null = null;
    if (!reduce) {
      lenis = new Lenis({ lerp: 0.09 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis!.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
    // in-page links glide with Lenis
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const target = document.getElementById(a.hash.slice(1));
      if (!target) return;
      e.preventDefault();
      document.documentElement.classList.remove('menu-open');
      if (lenis) lenis.scrollTo(target, { duration: 1.4, offset: -10 }); else target.scrollIntoView({ behavior: 'smooth' });
    };
    document.addEventListener('click', onClick);

    // header: solid after the fold, hides on the way down, returns on the way up
    const hdr = el.querySelector('.hdr') as HTMLElement;
    let lastY = 0;
    const onScroll = () => {
      const y = window.scrollY;
      hdr.classList.toggle('solid', y > 40);
      // keep the header out of the way while the 3D designer is on screen (it pins to the top on phones)
      const dz = document.querySelector('.designer');
      const r = dz?.getBoundingClientRect();
      const inDesigner = !!r && r.top < 80 && r.bottom > window.innerHeight * 0.4;
      hdr.classList.toggle('hidden', inDesigner || (y > lastY && y > 520));
      lastY = y;
    };
    addEventListener('scroll', onScroll, { passive: true });

    const ctx = gsap.context(() => {
      if (reduce) { el.classList.add('opened'); return; }
      // intro doors, then the headline rises line by line
      gsap.set('.hero .line > span', { yPercent: 115 });
      gsap.set('.hero [data-in]', { autoAlpha: 0, y: 20 });
      const tl = gsap.timeline({ delay: 0.35 });
      tl.to('.intro-logo', { autoAlpha: 0, y: -10, duration: 0.5, ease: 'power2.in' }, 0.7)
        .to('.door-l', { xPercent: -101, duration: 1.4, ease: 'power4.inOut' }, 1)
        .to('.door-r', { xPercent: 101, duration: 1.4, ease: 'power4.inOut' }, 1)
        .add(() => el.classList.add('opened'), 2.2)
        .from('.hero-arch img', { scale: 1.25, duration: 2.6, ease: 'power2.out' }, 1.1)
        .to('.hero .line > span', { yPercent: 0, duration: 1.4, stagger: 0.12, ease: 'power4.out' }, 1.5)
        .to('.hero [data-in]', { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'power3.out' }, 2);

      // reveals
      ScrollTrigger.batch('[data-reveal]', {
        start: 'top 88%', once: true,
        onEnter: (els) => els.forEach((e, n) => gsap.delayedCall(n * 0.08, () => e.classList.add('in'))),
      });
      // parallax on framed photos
      gsap.utils.toArray<HTMLElement>('[data-parallax] img').forEach((img) => {
        gsap.fromTo(img, { yPercent: -7 }, { yPercent: 7, ease: 'none', scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
      });
      gsap.to('.hero-arch img', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero-glow', { yPercent: 30, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
      // big statement: words light up as you scroll
      gsap.utils.toArray<HTMLElement>('.statement .w').forEach((w, i, all) => {
        gsap.to(w, { color: '#fbf9f5', ease: 'none', scrollTrigger: { trigger: '.statement', start: `top+=${(i / all.length) * 60}% 75%`, end: `top+=${((i + 1) / all.length) * 60}% 75%`, scrub: true } });
      });
      // counters
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((c) => {
        const o = { v: 0 }; const to = Number(c.dataset.count);
        c.textContent = '0';
        gsap.to(o, { v: to, duration: 2, ease: 'power2.out', onUpdate: () => { c.textContent = String(Math.round(o.v)); }, scrollTrigger: { trigger: c, start: 'top 92%', once: true } });
      });
      // final CTA: the photo opens like a doorway
      gsap.fromTo('.cta-media', { clipPath: 'inset(16% 9% 16% 9% round 240px 240px 0 0)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px 0px 0 0)', ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top 85%', end: 'top 15%', scrub: true } });
      // marquee speeds up with scroll velocity
      const mq = gsap.to('.marquee-track', { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
      ScrollTrigger.create({ onUpdate: (s) => { const v = Math.min(4, 1 + Math.abs(s.getVelocity()) / 900); gsap.to(mq, { timeScale: v, duration: 0.3, overwrite: true }); gsap.to(mq, { timeScale: 1, duration: 1.2, delay: 0.3 }); } });
    }, el);

    // custom cursor (desktop only)
    const cur = el.querySelector('.cursor') as HTMLElement;
    let move: ((e: PointerEvent) => void) | null = null;
    if (cur && matchMedia('(pointer: fine)').matches && !reduce) {
      const xTo = gsap.quickTo(cur, 'x', { duration: 0.35, ease: 'power3' }), yTo = gsap.quickTo(cur, 'y', { duration: 0.35, ease: 'power3' });
      move = (e) => { xTo(e.clientX); yTo(e.clientY); const t = e.target as HTMLElement; cur.classList.toggle('big', !!t.closest('a,button')); cur.classList.toggle('view', !!t.closest('.gitem,.dz-stage')); };
      addEventListener('pointermove', move);
    }
    const refresh = () => ScrollTrigger.refresh();
    addEventListener('load', refresh);
    document.fonts?.ready.then(refresh);
    return () => {
      ctx.revert(); lenis?.destroy(); document.removeEventListener('click', onClick); removeEventListener('scroll', onScroll);
      if (move) removeEventListener('pointermove', move); removeEventListener('load', refresh);
    };
  }, [root]);
}

// ------------------------------------------------------------ sections
function Header() {
  const toggle = () => document.documentElement.classList.toggle('menu-open');
  return (
    <header className="hdr">
      <a href="#top" className="logo">BHAVANI<small>Gold · Vijayawada</small></a>
      <nav className="links">
        <a href="#design">Design in 3D</a><a href="#gold">24K gold</a><a href="#creations">Our work</a><a href="#styles">New styles</a><a href="#story">Our story</a><a href="#journal">Journal</a><a href="#visit">Visit</a>
      </nav>
      <a className="pill gold hide-s" href={wa('Hello Bhavani Gold!')} target="_blank" rel="noreferrer"><Icon name="wa" /> WhatsApp</a>
      <button className="menu-btn" onClick={toggle} aria-label="Menu"><span /><span /></button>
    </header>
  );
}

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-glow" />
      <div className="hero-copy">
        <p className="kicker" data-in>30 years in gold · Bullion · Custom jewellery</p>
        <h1 className="mega">
          <span className="line"><span>Pure gold.</span></span>
          <span className="line"><span><em>Designed</em></span></span>
          <span className="line"><span>by you.</span></span>
        </h1>
        <p className="hero-sub" data-in>Design your jewellery in 3D in under a minute, send it to us on WhatsApp, and our goldsmiths make it. Or buy 24K coins and biscuits at today’s rate.</p>
        <div className="hero-cta" data-in>
          <a className="pill gold big" href="#design">Design yours in 3D <Icon name="arrow" /></a>
          <a className="pill ghost big" href="#gold">Buy gold coins</a>
        </div>
      </div>
      <figure className="hero-arch" data-in>
        <img src={photo('hero-chandbali')} alt="Lakshmi chandbali earrings with ruby and emerald" />
        <figcaption><span className="dot" /> Jenda Street, Vijayawada</figcaption>
      </figure>
      <a href="#design" className="scroll-cue" data-in><span>Scroll</span><i /></a>
    </section>
  );
}

function Marquee() {
  const words = ['24K gold coins', 'Gold biscuits', 'Design in 3D', 'Harams', 'Chandbalis', 'Polki', 'Cuban chains', 'Signet rings', 'Kadas', 'Lab-grown diamonds', 'Mangalsutra', 'Navratna'];
  const row = [...words, ...words];
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">{row.map((w, i) => <span key={i}>{w}<b>✦</b></span>)}</div>
    </div>
  );
}

function Statement() {
  const text = 'Making, weighing and selling gold is our daily work. Today we sell 24K pure gold and still make jewellery to your design — and you talk to a real goldsmith, not a call centre.';
  return (
    <section className="statement">
      <p>{text.split(' ').map((w, i) => <span key={i} className="w">{w} </span>)}</p>
      <div className="stats">
        <div data-reveal><b><span data-count="30">30</span> yrs</b><span>making and selling gold</span></div>
        <div data-reveal><b><span data-count="999">999</span></b><span>24K pure gold biscuits</span></div>
        <div data-reveal><b><span data-count="90">90</span>+</b><span>designs to customise in 3D</span></div>
        <div data-reveal><b><span data-count="1">1</span> tap</b><span>to send your design</span></div>
      </div>
    </section>
  );
}

function DesignSection() {
  return (
    <section className="design" id="design">
      <div className="sec-head" data-reveal>
        <p className="kicker gold">01 — Design it yourself</p>
        <h2 className="h2">Make it yours.<br /><em>In five taps.</em></h2>
        <p className="lead">For women and men — harams, chandbalis, polki, Cuban chains, signet rings, kadas and more, with 20+ stones from kemp and polki to lab-grown diamonds. Turn it around in 3D, then send it to us. It’s a starting idea: our goldsmith refines the details and tells you the exact weight and price.</p>
      </div>
      <div data-reveal>
        <Suspense fallback={<div className="dz-loading"><span className="spinner" /> Loading 3D studio…</div>}><Designer /></Suspense>
      </div>
    </section>
  );
}

function ProductImage({ b }: { b: { kind: string; grams: number; purity: string; photo?: string } }) {
  if (b.photo) return <div className={'art photo whole' + (b.photo.startsWith('real') ? ' dark' : '')}><img src={photo(b.photo)} alt={`${b.grams} g gold ${b.kind.toLowerCase()} at Bhavani Gold`} loading="lazy" /></div>;
  return (
    <div className="art plain">
      <span className="w">{b.grams >= 1000 ? b.grams / 1000 : b.grams}<small>{b.grams >= 1000 ? 'kg' : 'g'}</small></span>
      <span className="mono">{b.purity}</span>
    </div>
  );
}

function Gold() {
  const [tab, setTab] = useState<'Biscuit' | 'Coin'>('Biscuit');
  const r = useRates();
  const list = BULLION.filter((b) => b.kind === tab);
  return (
    <section className="gold-sec" id="gold">
      <div className="sec-head row-head" data-reveal>
        <div><p className="kicker">02 — 24K gold bullion</p><h2 className="h2 dark">Pure 999 gold<br /><em>biscuits &amp; coins.</em></h2></div>
        <p className="lead dark">24K biscuits of 100 g and 50 g, and small coins, for families, goldsmiths and karigars. Tell us the weight — we confirm today’s rate on WhatsApp before you pay.</p>
      </div>
      <div className="rates" data-reveal>
        {[['24K · 999', r.gold24], ['22K · 916', r.gold22]].map(([l, v]) => (
          <div key={l as string}><span className="mono">{l as string}</span><b>{v ? inr(v as number) : 'Ask us'}</b><small>{v ? 'per gram today' : 'today’s rate on WhatsApp'}</small></div>
        ))}
        <a className="pill dark" href={wa('Hello Bhavani Gold, please share today’s 24K and 22K gold rate.')} target="_blank" rel="noreferrer"><Icon name="wa" /> Get today’s rate</a>
      </div>
      <div className="bull-media" data-reveal>
        <figure><img src={photo('bullion-banner')} alt="Gold biscuits and coins from 1 g to 100 g" loading="lazy" /></figure>
        <figure><img src={photo('real-bars')} alt="Al Etihad 100 g gold biscuits, 999.0 purity, at Bhavani Gold" loading="lazy" /><figcaption>From our counter · Al Etihad 100 g · 999.0</figcaption></figure>
      </div>
      {r.updatedAt && <p className="rates-note mono">Rates updated {r.updatedAt} · final rate confirmed when you order</p>}
      <div className="tabs" data-reveal>{(['Biscuit', 'Coin'] as const).map((k) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{k === 'Biscuit' ? 'Biscuits' : k + 's'}</button>)}</div>
      <div className="bgrid">
        {list.map((b) => {
          const rate = b.purity.startsWith('24') ? r.gold24 : r.gold22;
          return (
            <article key={b.id} className="bcard" data-reveal>
              <ProductImage b={b} />
              <p className="mono">{b.kind} · {b.purity}</p>
              <h3>{b.grams >= 1000 ? b.grams / 1000 + ' kg' : b.grams + ' g'}</h3>
              <p className="small">{rate ? `≈ ${inr(rate * b.grams)} before GST` : b.note ?? 'Price at today’s rate'}</p>
              <a className="pill outline" href={wa(`Hello Bhavani Gold, I want to buy a ${b.grams} g ${b.purity} gold ${b.kind.toLowerCase()}. Please share today’s price.`)} target="_blank" rel="noreferrer">Enquire <Icon name="arrow" /></a>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Creations() {
  const cats = useMemo(() => ['All', ...Array.from(new Set(GALLERY.map((g) => g.cat)))] as ('All' | GalleryCat)[], []);
  const [cat, setCat] = useState<'All' | GalleryCat>('All');
  const [open, setOpen] = useState<number | null>(null);
  const list = GALLERY.filter((g) => cat === 'All' || g.cat === cat);
  useEffect(() => { ScrollTrigger.refresh(); }, [cat]);
  useEffect(() => {
    if (open === null) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(null); if (e.key === 'ArrowRight') setOpen((o) => (o! + 1) % list.length); if (e.key === 'ArrowLeft') setOpen((o) => (o! - 1 + list.length) % list.length); };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [open, list.length]);
  const cur = open !== null ? list[open] : null;
  return (
    <section className="creations" id="creations">
      <div className="sec-head row-head" data-reveal>
        <div><p className="kicker gold">03 — Designs we make</p><h2 className="h2">Pick a look.<br /><em>We’ll make it.</em></h2></div>
        <p className="lead">Pieces from our counter and styles we can make for you. Tap one to see it bigger, or ask us to make one like it.</p>
      </div>
      <div className="chips" data-reveal>{cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
      <div className="gallery">
        {list.map((g, i) => (
          <button key={g.id} className="gitem in" onClick={() => setOpen(i)} data-parallax>
            <img src={photo(g.id)} alt={g.title} loading="lazy" />
            <span className="gcap"><span className="mono">{g.cat}</span>{g.title}</span>
          </button>
        ))}
      </div>
      {cur && (
        <div className="lightbox" onClick={() => setOpen(null)} data-lenis-prevent>
          <div className="lb" onClick={(e) => e.stopPropagation()}>
            <img src={photo(cur.id)} alt={cur.title} />
            <div className="lb-side">
              <p className="mono gold">{cur.cat}</p>
              <h3>{cur.title}</h3>
              <p className="small">Weight and price depend on the exact piece — ask us.</p>
              <a className="pill gold" href={wa(`Hello Bhavani Gold, I saw "${cur.title}" (${cur.id}) on your website. Can you make one like this? Please share weight and price.`)} target="_blank" rel="noreferrer"><Icon name="wa" /> Ask about this</a>
              <button className="pill ghost" onClick={() => { setOpen(null); editDesign(photo(cur.id), cur.title); }}>Change this design</button>
              <div className="lb-nav"><button onClick={() => setOpen((open! - 1 + list.length) % list.length)}><Icon name="back" /></button><button onClick={() => setOpen((open! + 1) % list.length)}><Icon name="arrow" /></button><button onClick={() => setOpen(null)}><Icon name="x" /></button></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type StyleTab = 'Rose gold' | 'Beads' | '22K' | '18K' | '24K';
const STYLES: { tab: StyleTab[]; name: string; karat: string; img: string; note: string }[] = [
  { tab: ['Rose gold', '18K'], name: 'Flower & pearl bracelet', karat: '18K rose gold', img: 'ds-rose-velvet', note: 'Small stone flowers and pearls along a woven gold band.' },
  { tab: ['Rose gold', '18K'], name: 'Pearl vine bangle', karat: '18K rose gold', img: 'ds-rose-pearl-vine', note: 'A stone flower in the centre, leaves and pearls on each side.' },
  { tab: ['Rose gold', '18K'], name: 'Pink blossom bangle', karat: '18K rose gold', img: 'ds-rose-pink-flower', note: 'Five pink petals with pearls and white stone leaves.' },
  { tab: ['Rose gold', '18K'], name: 'Pink vine bangle', karat: '18K rose gold', img: 'ds-rose-pink-vine', note: 'Curling vines lined with small stones, pink flower at the front.' },
  { tab: ['Rose gold', '18K'], name: 'Pearl wave bangle', karat: '18K rose gold', img: 'ds-rose-pearl-wave', note: 'A waved stone line with pearls; plain band at the back.' },
  { tab: ['Rose gold', '18K'], name: 'Single flower bangle', karat: '18K rose gold', img: 'ds-rose-flower-bangle', note: 'One stone flower and two pearls. Light and easy to wear daily.' },
  { tab: ['Rose gold', 'Beads', '18K'], name: 'Woven pearl bracelet', karat: '18K rose gold', img: 'ds-rose-pearl-weave', note: 'A flexible woven bracelet with pearls set all around.' },
  { tab: ['Rose gold', 'Beads', '18K'], name: 'Pearl drop bar necklace', karat: '18K rose gold', img: 'ds-rose-pearl-bar', note: 'A stone-set bar with five pearl drops on a fine chain.' },
  { tab: ['Beads', '22K'], name: 'Pearl strand with gold beads', karat: '22K gold & pearls', img: 'ds-pearl-strand', note: 'Round pearls with two filigree gold beads and a hook clasp.' },
  { tab: ['Beads', '18K'], name: 'Layered pearl necklace', karat: '18K gold & pearls', img: 'ds-layered-pearl', note: 'Three chains with pearls, gold beads and leaf charms.' },
  { tab: ['Beads', '22K'], name: 'Pearl bangles, pair', karat: '22K gold & pearls', img: 'ds-pearl-bangles', note: 'A row of pearls with small stone flowers.' },
  { tab: ['Beads', '22K'], name: 'Wave pearl bangles, pair', karat: '22K gold & pearls', img: 'ds-wave-bangles', note: 'Open gold waves holding pearls and stones.' },
  { tab: ['22K'], name: 'Pearl choker', karat: '22K gold & pearls', img: 'ds-choker-flower', note: 'Leaf work with a stone flower and a fringe of pearls.' },
  { tab: ['22K'], name: 'Leaf choker', karat: '22K gold & pearls', img: 'ds-choker-leaf', note: 'A slim leaf line with pearl drops and a centre pendant.' },
  { tab: ['22K'], name: 'Round maang tikka', karat: '22K gold & pearls', img: 'ds-tikka-round', note: 'Stone-set round tikka with a pearl drop.' },
  { tab: ['22K'], name: 'Drop maang tikka', karat: '22K gold & pearls', img: 'ds-tikka-drop', note: 'Teardrop tikka with a fringe of small pearls.' },
  { tab: ['Beads', '22K'], name: 'Pearl anklet', karat: '22K gold & pearls', img: 'ds-anklet-pearl', note: 'A fine chain with pearl drops all around.' },
  { tab: ['Beads', '22K'], name: 'Flower anklet', karat: '22K gold & pearls', img: 'ds-anklet-flower', note: 'Small stone flowers with a pearl under each one.' },
];
/** Opens a picture from the page in the photo editor of the 3D studio, ready to change. */
function editDesign(url: string, name: string, mask?: string) {
  const n = name.toLowerCase();
  const piece = /bangle/.test(n) ? 'Bangle' : /bracelet/.test(n) ? 'Bracelet' : /necklace|choker|strand|haram|mala/.test(n) ? 'Necklace' : /earring|jhumka|chandbali/.test(n) ? 'Earrings' : /pendant/.test(n) ? 'Pendant' : /ring/.test(n) ? 'Ring' : /chain/.test(n) ? 'Chain' : 'Other';
  document.getElementById('design')?.scrollIntoView({ behavior: 'smooth' });
  window.dispatchEvent(new CustomEvent('bhavani:edit', { detail: { url, name, piece, mask } }));
}

function Styles() {
  const [tab, setTab] = useState<StyleTab>('Rose gold');
  const list = STYLES.filter((x) => x.tab.includes(tab));
  return (
    <section className="styles-sec" id="styles">
      <div className="sec-head row-head" data-reveal>
        <div><p className="kicker gold">New styles</p><h2 className="h2">Rose gold, beads,<br /><em>18K · 22K · 24K.</em></h2></div>
        <p className="lead">New-age designs we can make for you. Like one? Ask the price, or open the 3D studio to change it and send it to us.</p>
      </div>
      <div className="tabs dark" data-reveal>{(['Rose gold', 'Beads', '22K', '18K', '24K'] as const).map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
      {tab === '24K' ? (
        <div className="style-24" data-reveal>
          <figure><img src={photo('real-bars')} alt="24K 999 gold biscuits" loading="lazy" /></figure>
          <div><h3>24K is pure gold: 99.9%.</h3><p>It is soft, so most families buy 24K as biscuits and coins and keep it as savings. We sell 24K 999 biscuits of 100 g and 50 g, and small coins. For jewellery, 22K and 18K are stronger for daily wear.</p>
            <a className="pill gold" href="#gold">See biscuits & coins <Icon name="arrow" /></a></div>
        </div>
      ) : (
        <div className="style-grid">
          {list.map((x) => (
            <article key={tab + x.img} className="style-card in">
              <div className="style-img"><img src={photo(x.img)} alt={`${x.name}, ${x.karat}`} loading="lazy" /></div>
              <p className="mono">{x.karat}</p>
              <h3>{x.name}</h3>
              <p>{x.note}</p>
              <div className="style-cta"><button className="ul" onClick={() => editDesign(photo(x.img), x.name, `photos/cut-${x.img}.png`)}>Change this design</button><a className="ul" href={wa(`Hello Bhavani Gold, I like the ${x.name} (${x.karat}) on your website. Please share weight and price.`)} target="_blank" rel="noreferrer">Ask price</a></div>
            </article>
          ))}
        </div>
      )}
      <p className="small fine-note">Design pictures, shown for ideas. Each piece is made to order by our goldsmiths; weight and price are confirmed before anything is made.</p>
    </section>
  );
}

function Story() {
  const chapters: [string, string, string][] = [
    ['The beginning', 'A jewellery workshop', 'Under one roof: we made jewellery, weighed it and sold it. DD balls, ready-made seelalu and pusalu, chain machines and more.'],
    ['Over the years', 'A name for every item', 'Rings, chains, necklaces, harams, bracelets and new-age designs. Whenever new technology came to the market, we tried it.'],
    ['The last 5 years', 'Into gold bullion', '24K pure 999 gold biscuits of 100 g and 50 g, and small coins, for customers, goldsmiths and karigars.'],
    ['Today', 'Bhavani Gold', 'Bullion at the counter, and jewellery still made to your own design, now with a 3D designer on this page.'],
  ];
  return (
    <section className="story" id="story">
      <div className="sec-head row-head" data-reveal>
        <div><p className="kicker gold">04 — Our story</p><h2 className="h2">A lifetime<br /><em>in gold.</em></h2></div>
        <p className="lead">Thirty years of making, weighing and selling gold. The tools changed; the work didn’t.</p>
      </div>
      <ol className="timeline">
        {chapters.map(([when, title, text]) => (
          <li key={title} data-reveal><span className="mono">{when}</span><h3>{title}</h3><p>{text}</p></li>
        ))}
      </ol>
      <a className="pill ghost" href="#journal-our-story">Read the full story <Icon name="arrow" /></a>
    </section>
  );
}

function PostBody({ p }: { p: Post }) {
  const out: React.ReactNode[] = []; let list: string[] = [];
  const flush = (k: number) => { if (list.length) { out.push(<ul key={'l' + k}>{list.map((x) => <li key={x}>{x}</li>)}</ul>); list = []; } };
  p.body.forEach((para, k) => {
    if (para.startsWith('- ')) { list.push(para.slice(2)); return; }
    flush(k);
    out.push(para.startsWith('## ') ? <h4 key={k}>{para.slice(3)}</h4> : <p key={k}>{para}</p>);
  });
  flush(p.body.length);
  return <>{out}</>;
}

function Journal() {
  const [open, setOpen] = useState<Post | null>(null);
  useEffect(() => {
    const fromHash = () => { const m = location.hash.match(/^#journal-(.+)$/); setOpen(m ? POSTS.find((p) => p.slug === m[1]) ?? null : null); };
    fromHash(); addEventListener('hashchange', fromHash);
    // links to #journal-… open the post instead of scrolling
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#journal-"]') as HTMLAnchorElement | null;
      if (!a) return; e.preventDefault(); e.stopImmediatePropagation();
      const p = POSTS.find((x) => '#journal-' + x.slug === a.hash); if (p) { setOpen(p); try { history.replaceState(null, '', a.hash); } catch { /* sandboxed */ } }
    };
    document.addEventListener('click', onClick, true);
    return () => { removeEventListener('hashchange', fromHash); document.removeEventListener('click', onClick, true); };
  }, []);
  const close = () => { setOpen(null); try { history.replaceState(null, '', '#journal'); } catch { /* sandboxed */ } };
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === 'Escape' && close(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [open]);
  return (
    <section className="journal" id="journal">
      <div className="sec-head row-head" data-reveal>
        <div><p className="kicker">06 — Journal</p><h2 className="h2 dark">Notes from<br /><em>the counter.</em></h2></div>
        <p className="lead dark">Our story, and plain guides to buying pure gold and getting jewellery made.</p>
      </div>
      <div className="posts">
        {POSTS.map((p) => (
          <a key={p.slug} className="post" href={'#journal-' + p.slug} data-reveal>
            <div className="post-img"><img src={photo(p.photo)} alt="" loading="lazy" /></div>
            <p className="mono">{p.kicker} · {p.minutes} min read</p>
            <h3>{p.title}</h3>
            <p>{p.summary}</p>
            <span className="ul">Read →</span>
          </a>
        ))}
      </div>
      {open && createPortal(
        <div className="lightbox reader-wrap" onClick={close} data-lenis-prevent>
          <article className="reader" onClick={(e) => e.stopPropagation()}>
            <button className="pill-icon reader-x" aria-label="Close" onClick={close}><Icon name="x" /></button>
            <img src={photo(open.photo)} alt="" />
            <p className="mono gold">{open.kicker} · {open.minutes} min read</p>
            <h2>{open.title}</h2>
            <PostBody p={open} />
            <div className="reader-cta">
              <a className="pill gold" href={wa(`Hello Bhavani Gold, I read "${open.title}" on your website.`)} target="_blank" rel="noreferrer"><Icon name="wa" /> Ask us on WhatsApp</a>
              <div className="reader-more">{POSTS.filter((x) => x.slug !== open.slug).map((x) => <a key={x.slug} href={'#journal-' + x.slug}>{x.title}</a>)}</div>
            </div>
          </article>
        </div>, document.body)}
    </section>
  );
}

function Why() {
  const items: [string, string, string][] = [
    ['30 years in gold', 'We began as a jewellery workshop. Making, weighing and selling gold has been our daily work ever since.', 'real-bars'],
    ['Your design, your way', 'Show us a photo, a family piece or a 3D design. We make what you actually want.', 'p124'],
    ['Price before we start', 'You see the weight estimate first. We confirm rate, making and stone charges before anything is made.', 'p109'],
    ['Traditional craft', 'Mango harams, kasu malas, jhumkas and temple work by experienced goldsmiths.', 'p100'],
    ['A real person replies', 'Every message goes to us directly on WhatsApp.', 'p105'],
  ];
  const [i, setI] = useState(0);
  return (
    <section className="why" id="why">
      <div className="why-grid">
        <div>
          <p className="kicker" data-reveal>05 — Why Bhavani</p>
          <ul className="reasons">
            {items.map(([t, d], k) => (
              <li key={t} className={k === i ? 'on' : ''} onPointerEnter={() => setI(k)} onClick={() => setI(k)} data-reveal>
                <span className="num">0{k + 1}</span><div><h3>{t}</h3><p>{d}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="why-frame" data-reveal>
          {items.map(([t, , img], k) => <img key={t} src={photo(img)} alt="" className={k === i ? 'on' : ''} loading="lazy" />)}
        </div>
      </div>
    </section>
  );
}

function Process() {
  const steps: [string, string][] = [
    ['Design or choose', 'Design in 3D above, share a photo, or pick from our work.'],
    ['Send on WhatsApp', 'One tap sends your design and notes to us.'],
    ['Get the exact price', 'We reply with weight, today’s rate, making and stone charges.'],
    ['We make it', 'Confirm, and our goldsmiths start. Collect it on Jenda Street.'],
  ];
  return (
    <section className="process">
      <div className="sec-head" data-reveal><p className="kicker gold">How it works</p><h2 className="h2">From idea<br /><em>to gold.</em></h2></div>
      <ol className="steps">{steps.map(([t, d], k) => <li key={t} data-reveal><span>{String(k + 1).padStart(2, '0')}</span><h3>{t}</h3><p>{d}</p></li>)}</ol>
    </section>
  );
}

function Cta() {
  return (
    <section className="cta">
      <div className="cta-media"><img src={photo('p124')} alt="" /></div>
      <div className="cta-copy">
        <p className="kicker gold">Your design. Our goldsmiths.</p>
        <h2 className="h2">Let’s make<br /><em>something golden.</em></h2>
        <div className="hero-cta">
          <a className="pill gold big" href={wa('Hello Bhavani Gold, I would like to order jewellery.')} target="_blank" rel="noreferrer"><Icon name="wa" /> Chat on WhatsApp</a>
          <a className="pill ghost big" href="#design">Design in 3D</a>
        </div>
      </div>
    </section>
  );
}

function Visit() {
  return (
    <footer className="foot" id="visit">
      <div className="foot-grid">
        <div><a href="#top" className="logo big">BHAVANI<small>Gold · Vijayawada</small></a><p>24K gold bullion &amp; custom jewellery.</p></div>
        <div><p className="mono">Visit</p><p>{SITE.address}<br /><span className="small">{SITE.landmark}</span></p><a className="ul" href={SITE.mapsUrl} target="_blank" rel="noreferrer">Open in Google Maps ↗</a></div>
        <div><p className="mono">Talk to us</p><p>WhatsApp / call<br /><a className="gold" href={wa('Hello Bhavani Gold!')} target="_blank" rel="noreferrer"><b>{SITE.whatsappDisplay}</b></a></p>
          <p>Email<br /><a className="ul" href={`mailto:${SITE.email}`}>{SITE.email}</a></p>
          {SITE.instagram && <p>Instagram<br /><a className="ul" href={`https://instagram.com/${SITE.instagram}`} target="_blank" rel="noreferrer">@{SITE.instagram}</a></p>}
          {SITE.hours && <p className="small">Hours: {SITE.hours}</p>}</div>
      </div>
      <p className="fine">3D weights are estimates from the model; the final weight and price are confirmed by us before any order. Rates appear here only when we publish them. © {new Date().getFullYear()} {SITE.shopName}.</p>
    </footer>
  );
}

export default function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useMotion(root);
  // hide the floating WhatsApp button while the 3D studio fills the phone screen
  useEffect(() => {
    const el = document.getElementById('design'); if (!el) return;
    const io = new IntersectionObserver(([e]) => document.body.classList.toggle('in-studio', e.isIntersecting), { rootMargin: '-20% 0px -20% 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="site" ref={root}>
      <div className="intro" aria-hidden><div className="door-l" /><div className="door-r" /><div className="intro-logo">BHAVANI<small>Gold · Vijayawada</small></div></div>
      <div className="cursor" aria-hidden />
      <div className="mobile-menu" onClick={() => document.documentElement.classList.remove('menu-open')}>
        <a href="#design">Design in 3D</a><a href="#gold">24K gold</a><a href="#creations">Our work</a><a href="#styles">New styles</a><a href="#story">Our story</a><a href="#journal">Journal</a><a href="#visit">Visit</a>
        <a className="pill gold big" href={wa('Hello Bhavani Gold!')} target="_blank" rel="noreferrer"><Icon name="wa" /> WhatsApp us</a>
      </div>
      <Header />
      <Hero />
      <Marquee />
      <Statement />
      <DesignSection />
      <Gold />
      <Creations />
      <Styles />
      <Story />
      <Why />
      <Process />
      <Journal />
      <Cta />
      <Visit />
      <a className="wa-float" id="wa-float" href={wa('Hello Bhavani Gold!')} target="_blank" rel="noreferrer" aria-label="WhatsApp"><Icon name="wa" size={26} /></a>
    </div>
  );
}
