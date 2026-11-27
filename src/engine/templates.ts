// Ready-made starting designs. Every template is an ordinary, fully editable component tree.
import { COMPONENT_MAP, defaultParams } from './components';
import type { GemId, MetalId } from './materials';
import { designId, uid, ZERO_OFFSET, type Category, type Design, type DesignNode, type ParamValue } from './schema';

type Spec = { key: string; type: string; params?: Record<string, ParamValue>; parent?: string; anchor?: string; all?: boolean; gem?: GemId; altGem?: GemId; metal?: MetalId; finish?: 'polished' | 'matte' | 'antique'; name?: string; pos?: [number, number, number]; rot?: [number, number, number] };

export interface Template { id: string; category: Category; name: string; blurb: string; pair?: boolean; metal: MetalId; finish?: 'polished' | 'matte' | 'antique'; parts: Spec[] }

export const TEMPLATES: Template[] = [
  // ---------------- necklaces
  {
    id: 'mango-haram', category: 'necklaces', name: 'Mango haram with peacock pendant', blurb: 'Long haram of mango motifs with alternating ruby/emerald kemps, ghungroo drops and a peacock pendant.', metal: '22k-yellow', finish: 'polished',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 26, shape: 'U', stations: 34, coverage: 62, gap: 5, wire: 0.9 } },
      { key: 'mango', type: 'motif-mango', parent: 'base', anchor: 'station', all: true, params: { size: 11, thickness: 1.4 } },
      { key: 'kemp', type: 'stone', parent: 'mango', anchor: 'socket', all: true, params: { shape: 'cabochon', size: 3.2, ratio: 1.25 }, gem: 'kemp-red', altGem: 'kemp-green' },
      { key: 'bell', type: 'ghungroo', parent: 'mango', anchor: 'drop', all: true, params: { size: 2.4 } },
      { key: 'pend', type: 'pendantBody', parent: 'base', anchor: 'center', params: { shape: 'peacock', height: 46, thickness: 2, ring: 7, drops: 9, bail: true } },
      { key: 'pstone', type: 'stone', parent: 'pend', anchor: 'socket', params: { shape: 'cabochon', size: 5, ratio: 1.3 }, gem: 'kemp-green' },
      { key: 'eyes', type: 'stone', parent: 'pend', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 2.6 }, gem: 'kemp-red' },
      { key: 'pbell', type: 'ghungroo', parent: 'pend', anchor: 'drop', all: true, params: { size: 3 } },
      { key: 'clasp', type: 'clasp', parent: 'base', anchor: 'clasp', params: { style: 'screw', size: 8 } },
    ],
  },
  {
    id: 'kasu-mala', category: 'necklaces', name: 'Kasu mala', blurb: 'Temple coin necklace with antique finish and a central temple coin pendant.', metal: '22k-yellow', finish: 'antique',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 24, shape: 'U', stations: 40, coverage: 66, gap: 4, style: 'rope', wire: 0.8 } },
      { key: 'coin', type: 'motif-kasu', parent: 'base', anchor: 'station', all: true, params: { size: 11, thickness: 1.1 } },
      { key: 'pend', type: 'pendantBody', parent: 'base', anchor: 'center', params: { shape: 'temple-coin', height: 30, thickness: 2, drops: 5 } },
      { key: 'ruby', type: 'stone', parent: 'pend', anchor: 'socket', params: { shape: 'cabochon', size: 6 }, gem: 'kemp-red' },
      { key: 'pearl', type: 'dropBead', parent: 'pend', anchor: 'drop', all: true, params: { size: 3.6, mat: 'stone' }, gem: 'pearl' },
    ],
  },
  {
    id: 'floral-choker', category: 'necklaces', name: 'Floral choker', blurb: 'Short choker of flowers with emerald centres and pearl drops.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 15, shape: 'choker', stations: 15, coverage: 60, gap: 0, style: 'box', wire: 1 } },
      { key: 'flower', type: 'motif-floral', parent: 'base', anchor: 'station', all: true, params: { size: 13, petals: 6, thickness: 1.5 } },
      { key: 'cup', type: 'setting-kundan', parent: 'flower', anchor: 'socket', all: true, params: { shape: 'round', size: 3.6, height: 1.2 } },
      { key: 'em', type: 'stone', parent: 'cup', anchor: 'stone', all: true, params: { shape: 'round', size: 3.6 }, gem: 'emerald' },
      { key: 'pearl', type: 'dropBead', parent: 'flower', anchor: 'drop', all: true, params: { size: 3.4, mat: 'stone' }, gem: 'pearl' },
    ],
  },
  // ---------------- earrings
  {
    id: 'temple-jhumka', category: 'earrings', name: 'Temple jhumka', blurb: 'Floral stud top, dome bell, pearl and ghungroo drops.', pair: true, metal: '22k-yellow', finish: 'polished',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'floral', size: 12, thickness: 1.6, ring: 6 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'ruby', type: 'stone', parent: 'top', anchor: 'socket', params: { shape: 'cabochon', size: 3.4 }, gem: 'kemp-red' },
      { key: 'petal', type: 'stone', parent: 'top', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 1.8 }, gem: 'kemp-green' },
      { key: 'bell', type: 'jhumkaBell', parent: 'top', anchor: 'drop', params: { diameter: 14, height: 11, rim: 14 } },
      { key: 'pearls', type: 'dropBead', parent: 'bell', anchor: 'rim', all: true, params: { size: 2.6, mat: 'stone' }, gem: 'pearl' },
      { key: 'clap', type: 'ghungroo', parent: 'bell', anchor: 'drop', params: { size: 3 } },
    ],
  },
  {
    id: 'floral-stud', category: 'earrings', name: 'Floral stud', blurb: 'Simple flower stud with a CZ centre in prongs.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'floral', size: 9, thickness: 1.3 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'prong', type: 'setting-prong', parent: 'top', anchor: 'socket', params: { shape: 'round', size: 3.5, height: 1.8 } },
      { key: 'cz', type: 'stone', parent: 'prong', anchor: 'stone', params: { shape: 'round', size: 3.5 }, gem: 'diamond' },
    ],
  },
  {
    id: 'drop-earring', category: 'earrings', name: 'Peacock drop earring', blurb: 'Hook earring with a small peacock pendant and ruby eyes.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'hook', type: 'fishHook', params: { height: 15 } },
      { key: 'pend', type: 'pendantBody', parent: 'hook', anchor: 'drop', params: { shape: 'peacock', height: 20, thickness: 1.4, ring: 5, drops: 5, bail: true } },
      { key: 'eye', type: 'stone', parent: 'pend', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 1.6 }, gem: 'ruby' },
      { key: 'belly', type: 'stone', parent: 'pend', anchor: 'socket', params: { shape: 'pear', size: 3, ratio: 1.4 }, gem: 'emerald' },
      { key: 'bells', type: 'ghungroo', parent: 'pend', anchor: 'drop', all: true, params: { size: 1.8 } },
    ],
  },
  {
    id: 'hoop-bali', category: 'earrings', name: 'Hoop bali with drops', blurb: 'Gold hoop with ghungroo drops on the lower rim.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'hoop', type: 'earHoop', params: { diameter: 24, wire: 1.6, rim: 9 } },
      { key: 'bells', type: 'ghungroo', parent: 'hoop', anchor: 'rim', all: true, params: { size: 2.2 } },
    ],
  },
  // ---------------- rings
  {
    id: 'solitaire', category: 'rings', name: 'Solitaire ring', blurb: 'Comfort band with a 4-prong round stone.', metal: '18k-yellow',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 14, width: 2.4, thickness: 1.6, profile: 'court' } },
      { key: 'prong', type: 'setting-prong', parent: 'band', anchor: 'top', params: { shape: 'round', size: 6, height: 3, prongs: 4 } },
      { key: 'gem', type: 'stone', parent: 'prong', anchor: 'stone', params: { shape: 'round', size: 6 }, gem: 'diamond' },
    ],
  },
  {
    id: 'peacock-ring', category: 'rings', name: 'Peacock motif ring', blurb: 'Wide band topped with a peacock and ruby eyes.', metal: '22k-yellow',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 14, width: 3.2, thickness: 1.8, profile: 'half-round' } },
      { key: 'peacock', type: 'motif-peacock', parent: 'band', anchor: 'top', params: { size: 15, thickness: 1.5 } },
      { key: 'eyes', type: 'stone', parent: 'peacock', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 1.6 }, gem: 'ruby' },
      { key: 'body', type: 'stone', parent: 'peacock', anchor: 'socket', params: { shape: 'pear', size: 3, ratio: 1.4 }, gem: 'emerald' },
    ],
  },
  {
    id: 'half-eternity', category: 'rings', name: 'Half-eternity band', blurb: 'Flat band with nine bezel-set stones across the top.', metal: '18k-white',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 14, width: 3, thickness: 1.8, profile: 'flat', stations: 9, arc: 80 } },
      { key: 'bezel', type: 'setting-bezel', parent: 'band', anchor: 'station', all: true, params: { shape: 'round', size: 2.2, height: 1 } },
      { key: 'gem', type: 'stone', parent: 'bezel', anchor: 'stone', all: true, params: { shape: 'round', size: 2.2 }, gem: 'diamond' },
    ],
  },
  {
    id: 'plain-band', category: 'rings', name: 'Plain band', blurb: 'Simple twisted band. Change the pattern or profile.', metal: '22k-yellow',
    parts: [{ key: 'band', type: 'ringBand', params: { size: 16, width: 4, thickness: 1.8, profile: 'flat', pattern: 'twist' } }],
  },
  // ---------------- bangles
  {
    id: 'plain-kada', category: 'bangles', name: 'Plain kada', blurb: 'Solid half-round kada.', metal: '22k-yellow',
    parts: [{ key: 'b', type: 'bangle', params: { size: '2-6', width: 7, thickness: 3, profile: 'half-round' } }],
  },
  {
    id: 'twisted-bangle', category: 'bangles', name: 'Twisted bangle', blurb: 'Rope-twist bangle.', metal: '22k-yellow',
    parts: [{ key: 'b', type: 'bangle', params: { size: '2-6', width: 4, thickness: 2.8, profile: 'flat', pattern: 'twist' } }],
  },
  {
    id: 'peacock-kada', category: 'bangles', name: 'Peacock kada', blurb: 'Kada with a peacock face and ruby/emerald stones.', metal: '22k-yellow', finish: 'polished',
    parts: [
      { key: 'b', type: 'bangle', params: { size: '2-6', width: 6, thickness: 2.6, profile: 'court', stations: 10 } },
      { key: 'peacock', type: 'motif-peacock', parent: 'b', anchor: 'top', params: { size: 24, thickness: 2 } },
      { key: 'eyes', type: 'stone', parent: 'peacock', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 2.2 }, gem: 'ruby' },
      { key: 'belly', type: 'stone', parent: 'peacock', anchor: 'socket', params: { shape: 'pear', size: 5, ratio: 1.4 }, gem: 'emerald' },
      { key: 'flowers', type: 'motif-floral', parent: 'b', anchor: 'station', all: true, params: { size: 6, petals: 5, thickness: 1 } },
    ],
  },
  {
    id: 'stone-bangle', category: 'bangles', name: 'Stone-set bangle', blurb: 'Slim bangle with bezel-set stones all round.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'bangle', params: { size: '2-6', width: 4, thickness: 2.2, profile: 'court', stations: 24 } },
      { key: 'bz', type: 'setting-bezel', parent: 'b', anchor: 'station', all: true, params: { shape: 'round', size: 2.8, height: 1.2 } },
      { key: 'st', type: 'stone', parent: 'bz', anchor: 'stone', all: true, params: { shape: 'round', size: 2.8 }, gem: 'ruby', altGem: 'diamond' },
    ],
  },
  // ---------------- pendants
  {
    id: 'peacock-pendant', category: 'pendants', name: 'Peacock pendant', blurb: 'Peacock with kemp eyes and ghungroo drops.', metal: '22k-yellow',
    parts: [
      { key: 'p', type: 'pendantBody', params: { shape: 'peacock', height: 36, thickness: 2, ring: 7, drops: 7 } },
      { key: 'eyes', type: 'stone', parent: 'p', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 2.4 }, gem: 'kemp-red' },
      { key: 'body', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'pear', size: 5, ratio: 1.4 }, gem: 'emerald' },
      { key: 'bells', type: 'ghungroo', parent: 'p', anchor: 'drop', all: true, params: { size: 2.6 } },
    ],
  },
  {
    id: 'temple-pendant', category: 'pendants', name: 'Temple coin pendant', blurb: 'Coin with beaded rim, ruby centre, pearl drops.', metal: '22k-yellow', finish: 'antique',
    parts: [
      { key: 'p', type: 'pendantBody', params: { shape: 'temple-coin', height: 28, thickness: 2, drops: 5 } },
      { key: 'r', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'cabochon', size: 6 }, gem: 'kemp-red' },
      { key: 'pr', type: 'dropBead', parent: 'p', anchor: 'drop', all: true, params: { size: 3.2, mat: 'stone' }, gem: 'pearl' },
    ],
  },
  {
    id: 'solitaire-drop', category: 'pendants', name: 'Teardrop solitaire', blurb: 'Openwork teardrop with a prong-set pear stone.', metal: '18k-rose',
    parts: [
      { key: 'p', type: 'pendantBody', params: { shape: 'teardrop', height: 20, thickness: 1.4, openwork: false } },
      { key: 's', type: 'setting-prong', parent: 'p', anchor: 'socket', params: { shape: 'pear', size: 6, ratio: 1.4, height: 2, prongs: 3 } },
      { key: 'g', type: 'stone', parent: 's', anchor: 'stone', params: { shape: 'pear', size: 6, ratio: 1.4 }, gem: 'diamond' },
    ],
  },
  // ---------------- chains & bracelets
  { id: 'cable-chain', category: 'chains', name: 'Cable chain', blurb: '20" cable chain with lobster clasp.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 20, style: 'cable', wire: 1 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp' }] },
  { id: 'rope-chain', category: 'chains', name: 'Rope chain', blurb: 'Dense rope chain.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 22, style: 'rope', wire: 1.1 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp', params: { style: 'screw' } }] },
  { id: 'ball-chain', category: 'chains', name: 'Ball chain with pendant point', blurb: 'Ball chain ready for a pendant.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 18, style: 'ball', wire: 1 } }] },
  { id: 'figaro-chain', category: 'chains', name: 'Figaro chain', blurb: 'Three short links, one long.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 20, style: 'figaro', wire: 1 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp' }] },
  { id: 'cable-bracelet', category: 'bracelets', name: 'Cable bracelet', blurb: 'Cable links with lobster clasp.', metal: '22k-yellow', parts: [{ key: 'b', type: 'braceletChain', params: { wrist: 17.5, style: 'cable', wire: 1.4 } }, { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp' }] },
  {
    id: 'charm-bracelet', category: 'bracelets', name: 'Flower charm bracelet', blurb: 'Box-link bracelet with hanging flower charms.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'braceletChain', params: { wrist: 17.5, style: 'box', wire: 1.3, stations: 7 } },
      { key: 'f', type: 'motif-floral', parent: 'b', anchor: 'station', all: true, params: { size: 8, petals: 5, thickness: 1.2 } },
      { key: 's', type: 'stone', parent: 'f', anchor: 'socket', all: true, params: { shape: 'cabochon', size: 2.4 }, gem: 'ruby' },
      { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp' },
    ],
  },

  // ================= more women's designs
  {
    id: 'pearl-haram', category: 'necklaces', name: 'Pearl haram', blurb: 'Long string of pearls with a ruby medallion and pearl drops.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 24, shape: 'U', stations: 46, coverage: 70, gap: 4, style: 'singapore', wire: 0.7 } },
      { key: 'pearl', type: 'motif-bead', parent: 'base', anchor: 'station', all: true, params: { size: 4.2, beadMat: 'pearl' }, gem: 'pearl' },
      { key: 'pend', type: 'pendantBody', parent: 'base', anchor: 'center', params: { shape: 'medallion', height: 22, thickness: 2, drops: 5, ring: 8 } },
      { key: 'r', type: 'stone', parent: 'pend', anchor: 'socket', params: { shape: 'cabochon', size: 6 }, gem: 'ruby' },
      { key: 'rs', type: 'stone', parent: 'pend', anchor: 'socket-ring', all: true, params: { shape: 'round', size: 1.8 }, gem: 'diamond' },
      { key: 'pd', type: 'dropBead', parent: 'pend', anchor: 'drop', all: true, params: { size: 3.4, mat: 'stone' }, gem: 'pearl' },
    ],
  },
  {
    id: 'layered-set', category: 'necklaces', name: 'Layered chains', blurb: 'Two layers: a short rope chain and a longer flower necklace.', metal: '22k-yellow',
    parts: [
      { key: 'c1', type: 'chainBase', params: { length: 16, style: 'rope', wire: 1 } },
      { key: 'base', type: 'necklaceBase', params: { length: 20, shape: 'round', stations: 9, coverage: 34, gap: 0, style: 'cable', wire: 0.8 } },
      { key: 'f', type: 'motif-floral', parent: 'base', anchor: 'station', all: true, params: { size: 7, petals: 5, thickness: 1.1 } },
      { key: 's', type: 'stone', parent: 'f', anchor: 'socket', all: true, params: { shape: 'round', size: 2.2 }, gem: 'diamond' },
    ],
  },
  {
    id: 'mangalsutra', category: 'necklaces', name: 'Mangalsutra', blurb: 'Black-bead chain with gold beads and a diamond pendant.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 24, shape: 'V', stations: 0, coverage: 10, gap: 0, style: 'blackbeads', wire: 1.1 } },
      { key: 'pend', type: 'pendantBody', parent: 'base', anchor: 'center', params: { shape: 'teardrop', height: 18, thickness: 1.5, ring: 6 } },
      { key: 'c', type: 'setting-prong', parent: 'pend', anchor: 'socket', params: { shape: 'pear', size: 5, ratio: 1.4, height: 1.8, prongs: 3 } },
      { key: 'g', type: 'stone', parent: 'c', anchor: 'stone', params: { shape: 'pear', size: 5, ratio: 1.4 }, gem: 'diamond' },
      { key: 'rs', type: 'stone', parent: 'pend', anchor: 'socket-ring', all: true, params: { shape: 'round', size: 1.3 }, gem: 'diamond' },
    ],
  },
  {
    id: 'polki-choker', category: 'necklaces', name: 'Polki choker', blurb: 'Choker of flowers set with flat polki diamonds and pearl drops.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 14.5, shape: 'choker', stations: 13, coverage: 58, gap: 0, style: 'box', wire: 1.1 } },
      { key: 'f', type: 'motif-floral', parent: 'base', anchor: 'station', all: true, params: { size: 14, petals: 8, thickness: 1.6 } },
      { key: 'k', type: 'setting-kundan', parent: 'f', anchor: 'socket', all: true, params: { shape: 'polki', size: 5, height: 1.2 } },
      { key: 'p', type: 'stone', parent: 'k', anchor: 'stone', all: true, params: { shape: 'polki', size: 5 }, gem: 'polki' },
      { key: 'd', type: 'dropBead', parent: 'f', anchor: 'drop', all: true, params: { size: 3.2, mat: 'stone' }, gem: 'pearl' },
    ],
  },
  {
    id: 'chandbali', category: 'earrings', name: 'Chandbali', blurb: 'Crescent-moon earrings with kemp stones and pearl drops.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'floral', size: 8, thickness: 1.4 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'ts', type: 'stone', parent: 'top', anchor: 'socket', params: { shape: 'cabochon', size: 2.6 }, gem: 'kemp-red' },
      { key: 'moon', type: 'pendantBody', parent: 'top', anchor: 'drop', params: { shape: 'crescent', height: 30, thickness: 1.6, ring: 7, drops: 9, bail: true } },
      { key: 'ms', type: 'stone', parent: 'moon', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 2 }, gem: 'kemp-red', altGem: 'kemp-green' },
      { key: 'mc', type: 'stone', parent: 'moon', anchor: 'socket', params: { shape: 'cabochon', size: 3.2 }, gem: 'kemp-green' },
      { key: 'pd', type: 'dropBead', parent: 'moon', anchor: 'drop', all: true, params: { size: 2.4, mat: 'stone' }, gem: 'pearl' },
    ],
  },
  {
    id: 'solitaire-stud', category: 'earrings', name: 'Solitaire studs', blurb: 'A single round stone in four prongs.', pair: true, metal: '18k-yellow',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'medallion', size: 4, thickness: 1 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'pr', type: 'setting-prong', parent: 'top', anchor: 'socket', params: { shape: 'round', size: 5, height: 2.2, prongs: 4 } },
      { key: 'g', type: 'stone', parent: 'pr', anchor: 'stone', params: { shape: 'round', size: 5 }, gem: 'diamond' },
    ],
  },
  {
    id: 'huggies', category: 'earrings', name: 'Diamond huggies', blurb: 'Small hoops with stones across the front.', pair: true, metal: '18k-yellow',
    parts: [
      { key: 'h', type: 'earHoop', params: { diameter: 12, wire: 2, stations: 7 } },
      { key: 'b', type: 'setting-bezel', parent: 'h', anchor: 'station', all: true, params: { shape: 'round', size: 1.6, height: 0.8 } },
      { key: 'g', type: 'stone', parent: 'b', anchor: 'stone', all: true, params: { shape: 'round', size: 1.6 }, gem: 'diamond' },
    ],
  },
  {
    id: 'polki-studs', category: 'earrings', name: 'Polki flower studs', blurb: 'Flower studs with a flat polki centre.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'floral', size: 12, thickness: 1.5, ring: 8 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'k', type: 'setting-kundan', parent: 'top', anchor: 'socket', params: { shape: 'polki', size: 5, height: 1.2 } },
      { key: 'p', type: 'stone', parent: 'k', anchor: 'stone', params: { shape: 'polki', size: 5 }, gem: 'polki' },
      { key: 'r', type: 'stone', parent: 'top', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 1.6 }, gem: 'ruby' },
    ],
  },
  {
    id: 'open-cuff', category: 'bangles', name: 'Open cuff', blurb: 'Open kada with round ends — easy to wear.', metal: '22k-yellow',
    parts: [{ key: 'b', type: 'bangle', params: { size: '2-6', width: 6, thickness: 2.8, profile: 'court', opening: 40 } }],
  },
  {
    id: 'polki-kada', category: 'bangles', name: 'Polki kada', blurb: 'Broad kada set with polki stones all round.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'bangle', params: { size: '2-6', width: 9, thickness: 2.6, profile: 'flat', stations: 18 } },
      { key: 'k', type: 'setting-kundan', parent: 'b', anchor: 'station', all: true, params: { shape: 'polki', size: 5, height: 1.2 } },
      { key: 'p', type: 'stone', parent: 'k', anchor: 'stone', all: true, params: { shape: 'polki', size: 5 }, gem: 'polki' },
    ],
  },
  {
    id: 'halo-ring', category: 'rings', name: 'Halo ring', blurb: 'Oval centre stone ringed by small diamonds.', metal: '18k-rose',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 14, width: 2.2, thickness: 1.6, profile: 'court' } },
      { key: 'h', type: 'setting-halo', parent: 'band', anchor: 'top', params: { shape: 'oval', size: 8, ratio: 1.3, height: 2.6 } },
      { key: 'c', type: 'stone', parent: 'h', anchor: 'stone', params: { shape: 'oval', size: 8, ratio: 1.3 }, gem: 'morganite' },
      { key: 'hs', type: 'stone', parent: 'h', anchor: 'socket-ring', all: true, params: { shape: 'round', size: 1.4 }, gem: 'diamond' },
    ],
  },
  {
    id: 'navratna-ring', category: 'rings', name: 'Navratna ring', blurb: 'Flower of nine traditional stones.', metal: '22k-yellow',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 14, width: 3, thickness: 1.8, profile: 'half-round' } },
      { key: 'f', type: 'motif-floral', parent: 'band', anchor: 'top', params: { size: 14, petals: 8, thickness: 1.6 } },
      { key: 'c', type: 'stone', parent: 'f', anchor: 'socket', params: { shape: 'cabochon', size: 3.6 }, gem: 'ruby' },
      { key: 'p', type: 'stone', parent: 'f', anchor: 'socket-ring', all: true, params: { shape: 'cabochon', size: 2.4 }, gem: 'navratna' },
    ],
  },
  {
    id: 'stack-rings', category: 'rings', name: 'Stack of three', blurb: 'Three thin bands to wear together: twisted, plain and stone-set.', metal: '22k-yellow',
    parts: [
      { key: 'a', type: 'ringBand', params: { size: 14, width: 1.6, thickness: 1.4, profile: 'flat', pattern: 'twist' }, pos: [0, 0, -2.2] },
      { key: 'b', type: 'ringBand', params: { size: 14, width: 1.6, thickness: 1.4, profile: 'half-round' } },
      { key: 'c', type: 'ringBand', params: { size: 14, width: 1.8, thickness: 1.4, profile: 'flat', stations: 7, arc: 60 }, pos: [0, 0, 2.2] },
      { key: 'cb', type: 'setting-bezel', parent: 'c', anchor: 'station', all: true, params: { shape: 'round', size: 1.4, height: 0.7 } },
      { key: 'cs', type: 'stone', parent: 'cb', anchor: 'stone', all: true, params: { shape: 'round', size: 1.4 }, gem: 'diamond' },
    ],
  },
  {
    id: 'heart-pendant', category: 'pendants', name: 'Heart pendant', blurb: 'Heart with a ruby centre and small diamonds.', metal: '18k-rose',
    parts: [
      { key: 'p', type: 'pendantBody', params: { shape: 'heart', height: 16, thickness: 1.5, ring: 8 } },
      { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 4 }, gem: 'ruby' },
      { key: 'r', type: 'stone', parent: 'p', anchor: 'socket-ring', all: true, params: { shape: 'round', size: 1.4 }, gem: 'diamond' },
    ],
  },
  {
    id: 'halo-pendant', category: 'pendants', name: 'Halo pendant', blurb: 'Round stone with a halo of diamonds.', metal: '18k-white',
    parts: [
      { key: 'p', type: 'pendantBody', params: { shape: 'medallion', height: 9, thickness: 1.2 } },
      { key: 'h', type: 'setting-halo', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 6, height: 2.4 } },
      { key: 'c', type: 'stone', parent: 'h', anchor: 'stone', params: { shape: 'round', size: 6 }, gem: 'tanzanite' },
      { key: 'hs', type: 'stone', parent: 'h', anchor: 'socket-ring', all: true, params: { shape: 'round', size: 1.3 }, gem: 'diamond' },
    ],
  },
  { id: 'singapore-chain', category: 'chains', name: 'Singapore chain', blurb: 'Fine twisted chain that sparkles.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 18, style: 'singapore', wire: 0.9 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp' }] },
  { id: 'box-chain', category: 'chains', name: 'Box chain', blurb: 'Square links, strong for pendants.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 18, style: 'box', wire: 0.9 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp' }] },
  { id: 'paperclip-chain', category: 'chains', name: 'Paperclip chain', blurb: 'Long modern links.', metal: '18k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 18, style: 'paperclip', wire: 0.9 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp' }] },
  { id: 'snake-chain', category: 'chains', name: 'Snake chain', blurb: 'Smooth, flexible and sleek.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 18, style: 'snake', wire: 1 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp' }] },
  {
    id: 'tennis-bracelet', category: 'bracelets', name: 'Tennis bracelet', blurb: 'A line of stones around the wrist.', metal: '18k-white',
    parts: [
      { key: 'b', type: 'braceletChain', params: { wrist: 17, style: 'box', wire: 1.1, stations: 20 } },
      { key: 'bz', type: 'setting-bezel', parent: 'b', anchor: 'station', all: true, params: { shape: 'round', size: 2.8, height: 1.1 } },
      { key: 'g', type: 'stone', parent: 'bz', anchor: 'stone', all: true, params: { shape: 'round', size: 2.8 }, gem: 'diamond' },
      { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp' },
    ],
  },
  // ================= beads
  {
    id: 'gundla-mala', category: 'necklaces', name: 'Gold bead mala (gundla mala)', blurb: 'Rows of round gold beads, the classic gundla mala.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 22, shape: 'U', stations: 112, coverage: 97, gap: 0, style: 'wire', wire: 0.5 } },
      { key: 'bead', type: 'motif-bead', parent: 'base', anchor: 'station', all: true, params: { size: 3.8, beadMat: 'metal' } },
    ],
  },
  {
    id: 'pearl-mala', category: 'necklaces', name: 'Pearl mala with gold pendant', blurb: 'A string of pearls with a gold peacock pendant.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 22, shape: 'U', stations: 104, coverage: 95, gap: 0, style: 'wire', wire: 0.5 } },
      { key: 'bead', type: 'motif-bead', parent: 'base', anchor: 'station', all: true, params: { size: 4.2, beadMat: 'pearl' }, gem: 'pearl' },
      { key: 'pend', type: 'pendantBody', parent: 'base', anchor: 'center', params: { shape: 'peacock', height: 26, thickness: 1.6, drops: 3 } },
      { key: 'ps', type: 'stone', parent: 'pend', anchor: 'socket', params: { shape: 'cabochon', size: 4 }, gem: 'ruby' },
      { key: 'pd', type: 'dropBead', parent: 'pend', anchor: 'drop', all: true, params: { size: 3.4, mat: 'stone' }, gem: 'pearl' },
    ],
  },
  {
    id: 'nallapusalu', category: 'necklaces', name: 'Black beads with gold beads', blurb: 'Nallapusalu chain with gold bead stations and a small pendant.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 24, shape: 'V', stations: 9, coverage: 46, gap: 6, style: 'blackbeads', wire: 1.1 } },
      { key: 'bead', type: 'motif-bead', parent: 'base', anchor: 'station', all: true, params: { size: 5.5, beadMat: 'metal' } },
      { key: 'pend', type: 'pendantBody', parent: 'base', anchor: 'center', params: { shape: 'medallion', height: 18, thickness: 1.4, drops: 0 } },
      { key: 'ps', type: 'stone', parent: 'pend', anchor: 'socket', params: { shape: 'round', size: 3 }, gem: 'diamond' },
    ],
  },
  {
    id: 'bead-hoops', category: 'earrings', name: 'Gold bead hoops', blurb: 'Round hoops with gold beads hanging all along the rim.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'hoop', type: 'earHoop', params: { diameter: 22, wire: 1.4, rim: 9 } },
      { key: 'bead', type: 'dropBead', parent: 'hoop', anchor: 'rim', all: true, params: { size: 3.2, mat: 'metal' } },
    ],
  },
  {
    id: 'pearl-drop-studs', category: 'earrings', name: 'Pearl drop studs', blurb: 'Flower studs with one big pearl drop.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'floral', size: 9, thickness: 1.4 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'ts', type: 'stone', parent: 'top', anchor: 'socket', params: { shape: 'round', size: 2.6 }, gem: 'ruby' },
      { key: 'drop', type: 'dropBead', parent: 'top', anchor: 'drop', params: { size: 8, mat: 'stone' }, gem: 'pearl' },
    ],
  },
  {
    id: 'bead-bangle', category: 'bangles', name: 'Gold bead bangle', blurb: 'Slim bangle lined with round gold beads.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'bangle', params: { size: '2-6', width: 3, thickness: 1.8, profile: 'half-round', stations: 32 } },
      { key: 'bead', type: 'motif-bead', parent: 'b', anchor: 'station', all: true, params: { size: 3.6, beadMat: 'metal' } },
    ],
  },
  {
    id: 'bead-bracelet', category: 'bracelets', name: 'Gold bead bracelet', blurb: 'Fine chain strung with gold beads.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'braceletChain', params: { wrist: 17, style: 'cable', wire: 0.8, stations: 20 } },
      { key: 'bead', type: 'motif-bead', parent: 'b', anchor: 'station', all: true, params: { size: 4.2, beadMat: 'metal' } },
      { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp' },
    ],
  },
  {
    id: 'bead-ring', category: 'rings', name: 'Gold bead ring', blurb: 'Band with a row of small gold beads on top.', metal: '22k-yellow',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 14, width: 2.2, thickness: 1.5, stations: 9 } },
      { key: 'bead', type: 'motif-bead', parent: 'band', anchor: 'station', all: true, params: { size: 2.4, beadMat: 'metal' } },
    ],
  },
  {
    id: 'men-bead-bracelet', category: 'bracelets', name: 'Men’s gold bead bracelet', blurb: 'Bold gold beads on a strong chain.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'braceletChain', params: { wrist: 20, style: 'curb', wire: 1.1, stations: 15 } },
      { key: 'bead', type: 'motif-bead', parent: 'b', anchor: 'station', all: true, params: { size: 6, beadMat: 'metal' } },
      { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp' },
    ],
  },
  // ================= Dubai, Middle East and international
  { id: 'art-hamsa', category: 'pendants', name: 'Hamsa hand pendant', blurb: 'Middle-East protection hand with a blue stone eye.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'hamsa', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'cabochon', size: 3.2 }, gem: 'sapphire' }] },
  { id: 'art-rub-star', category: 'pendants', name: 'Arabic star pendant', blurb: 'Eight-point star with lattice spokes, Dubai style.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'rub-star', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 3.2 }, gem: 'emerald' }] },
  { id: 'art-arabesque', category: 'pendants', name: 'Dubai filigree drop', blurb: 'Lace-like cut-out teardrop in the Gulf style.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'arabesque', height: 20, thickness: 1.0 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 2.2 }, gem: 'ruby' }] },
  { id: 'art-lira', category: 'pendants', name: 'Lira coin pendant', blurb: 'Gulf gold coin with a beaded rim and raised star.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'lira', height: 18, thickness: 0.8 } }] },
  { id: 'art-quatrefoil', category: 'pendants', name: 'Quatrefoil pendant', blurb: 'European four-lobe motif with an inner border.', metal: '18k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'quatrefoil', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 3.4 }, gem: 'diamond' }] },
  { id: 'art-bar', category: 'pendants', name: 'Minimal bar pendant', blurb: 'Korean-style slim vertical bar with one tiny stone.', metal: '18k-rose', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'bar', height: 17, thickness: 1.2 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 1.7 }, gem: 'diamond' }] },
  {
    id: 'dubai-lira-necklace', category: 'necklaces', name: 'Dubai lira coin necklace', blurb: 'Choker with a fringe of Gulf lira coins and a big centre coin.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 16, shape: 'choker', stations: 11, coverage: 64, gap: 1, style: 'cable', wire: 0.8 } },
      { key: 'coins', parent: 'base', anchor: 'station', all: true, type: 'pendantArt', params: { design: 'lira', height: 9, thickness: 0.7 } },
      { key: 'pend', parent: 'base', anchor: 'center', type: 'pendantArt', params: { design: 'lira', height: 18, thickness: 0.8 } },
    ],
  },
  {
    id: 'dubai-filigree-collar', category: 'necklaces', name: 'Dubai filigree collar', blurb: 'Gulf-style collar of lace teardrops with a ruby centrepiece.', metal: '22k-yellow',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 16, shape: 'choker', stations: 13, coverage: 66, gap: 1, style: 'box', wire: 1 } },
      { key: 'lace', parent: 'base', anchor: 'station', all: true, type: 'pendantArt', params: { design: 'arabesque', height: 15, thickness: 0.6 } },
      { key: 'pend', parent: 'base', anchor: 'center', type: 'pendantArt', params: { design: 'arabesque', height: 28, thickness: 1.1 } },
      { key: 'ps', type: 'stone', parent: 'pend', anchor: 'socket', params: { shape: 'round', size: 3 }, gem: 'ruby' },
    ],
  },
  {
    id: 'station-necklace', category: 'necklaces', name: 'Diamond station necklace', blurb: 'American-style fine chain with stones spaced along it.', metal: '18k-white',
    parts: [
      { key: 'base', type: 'necklaceBase', params: { length: 18, shape: 'round', stations: 7, coverage: 48, gap: 0, style: 'cable', wire: 0.6 } },
      { key: 'bz', type: 'setting-bezel', parent: 'base', anchor: 'station', all: true, params: { shape: 'round', size: 3, height: 1.2 } },
      { key: 'g', type: 'stone', parent: 'bz', anchor: 'stone', all: true, params: { shape: 'round', size: 3 }, gem: 'diamond' },
    ],
  },
  {
    id: 'dubai-chandelier', category: 'earrings', name: 'Dubai filigree chandelier', blurb: 'Flower top with a long lace teardrop, Gulf bridal style.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'floral', size: 9, thickness: 1.4 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'ts', type: 'stone', parent: 'top', anchor: 'socket', params: { shape: 'round', size: 2.6 }, gem: 'ruby' },
      { key: 'drop', parent: 'top', anchor: 'drop', type: 'pendantArt', params: { design: 'arabesque', height: 26, thickness: 1.0 } },
      { key: 'ds', type: 'stone', parent: 'drop', anchor: 'socket', params: { shape: 'round', size: 2.4 }, gem: 'ruby' },
    ],
  },
  {
    id: 'lira-earrings', category: 'earrings', name: 'Lira coin earrings', blurb: 'Gulf lira coins hanging from small medallion tops.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'medallion', size: 7, thickness: 1.3 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'coin', parent: 'top', anchor: 'drop', type: 'pendantArt', params: { design: 'lira', height: 15, thickness: 0.9 } },
    ],
  },
  {
    id: 'evil-eye-earrings', category: 'earrings', name: 'Evil eye drops', blurb: 'Turkish-style blue evil eyes hanging from studs.', pair: true, metal: '22k-yellow',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'medallion', size: 5, thickness: 1.2 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'eye', parent: 'top', anchor: 'drop', type: 'pendantArt', params: { design: 'evil-eye', height: 13, thickness: 1.0 } },
      { key: 'es', type: 'stone', parent: 'eye', anchor: 'socket', params: { shape: 'cabochon', size: 3.6 }, gem: 'sapphire' },
    ],
  },
  {
    id: 'dubai-coin-bangle', category: 'bangles', name: 'Dubai lira charm bangle', blurb: 'Slim bangle with little lira coins dangling all round.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'bangle', params: { size: '2-6', width: 4, thickness: 2.2, profile: 'half-round', stations: 9 } },
      { key: 'coins', parent: 'b', anchor: 'station', all: true, type: 'pendantArt', params: { design: 'lira', height: 9, thickness: 0.7 } },
    ],
  },
  { id: 'dubai-broad-kada', category: 'bangles', name: 'Dubai broad kada', blurb: 'Wide ribbed Gulf-style kada.', metal: '22k-yellow', parts: [{ key: 'b', type: 'bangle', params: { size: '2-6', width: 12, thickness: 1.3, profile: 'flat', pattern: 'ribbed' } }] },
  {
    id: 'evil-eye-bracelet', category: 'bracelets', name: 'Evil eye bracelet', blurb: 'Turkish-style cable bracelet with blue evil-eye charms.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'braceletChain', params: { wrist: 17, style: 'cable', wire: 1, stations: 5 } },
      { key: 'eye', parent: 'b', anchor: 'station', all: true, type: 'pendantArt', params: { design: 'evil-eye', height: 9, thickness: 0.9 } },
      { key: 'es', type: 'stone', parent: 'eye', anchor: 'socket', all: true, params: { shape: 'cabochon', size: 2.6 }, gem: 'sapphire' },
      { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp' },
    ],
  },
  {
    id: 'lira-bracelet', category: 'bracelets', name: 'Lira coin bracelet', blurb: 'Box-link bracelet with Gulf lira coin charms.', metal: '22k-yellow',
    parts: [
      { key: 'b', type: 'braceletChain', params: { wrist: 17.5, style: 'box', wire: 1.2, stations: 5 } },
      { key: 'coins', parent: 'b', anchor: 'station', all: true, type: 'pendantArt', params: { design: 'lira', height: 10, thickness: 0.8 } },
      { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp' },
    ],
  },
  // ================= men
  { id: 'men-cuban', category: 'chains', name: 'Cuban chain', blurb: 'Heavy flat curb links — the classic men’s chain.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 22, style: 'curb', wire: 1.8 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp', params: { size: 12 } }] },
  { id: 'men-rope', category: 'chains', name: 'Heavy rope chain', blurb: 'Thick twisted rope.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 22, style: 'rope', wire: 1.7 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp', params: { size: 11 } }] },
  { id: 'men-box', category: 'chains', name: 'Heavy box chain', blurb: 'Bold square links.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 22, style: 'box', wire: 1.6 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp', params: { size: 11 } }] },
  { id: 'men-figaro', category: 'chains', name: 'Heavy figaro chain', blurb: 'Three short, one long.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 22, style: 'figaro', wire: 1.6 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp', params: { size: 11 } }] },
  { id: 'men-snake', category: 'chains', name: 'Snake chain', blurb: 'Smooth and minimal.', metal: '22k-yellow', parts: [{ key: 'c', type: 'chainBase', params: { length: 22, style: 'snake', wire: 1.6 } }, { key: 'cl', type: 'clasp', parent: 'c', anchor: 'clasp', params: { size: 11 } }] },
  {
    id: 'men-signet', category: 'rings', name: 'Signet ring', blurb: 'Wide band with a flat square face.', metal: '22k-yellow',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 20, width: 5, thickness: 2.4, profile: 'flat' } },
      { key: 't', type: 'motif-tablet', parent: 'band', anchor: 'top', params: { size: 13, thickness: 2.2 } },
    ],
  },
  {
    id: 'men-signet-stone', category: 'rings', name: 'Stone signet', blurb: 'Square face with a centre stone and four corner diamonds.', metal: '22k-yellow',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 20, width: 5, thickness: 2.4, profile: 'flat' } },
      { key: 't', type: 'motif-tablet', parent: 'band', anchor: 'top', params: { size: 14, thickness: 2.2 } },
      { key: 'c', type: 'setting-bezel', parent: 't', anchor: 'socket', params: { shape: 'emerald', size: 7, ratio: 1.2, height: 1.4 } },
      { key: 'cs', type: 'stone', parent: 'c', anchor: 'stone', params: { shape: 'emerald', size: 7, ratio: 1.2 }, gem: 'onyx' },
      { key: 'd', type: 'stone', parent: 't', anchor: 'socket-ring', all: true, params: { shape: 'round', size: 1.6 }, gem: 'diamond' },
    ],
  },
  { id: 'men-band', category: 'rings', name: 'Men’s band', blurb: 'Wide flat comfort band.', metal: '22k-yellow', parts: [{ key: 'band', type: 'ringBand', params: { size: 20, width: 6, thickness: 2, profile: 'court' } }] },
  {
    id: 'men-diamond-band', category: 'rings', name: 'Diamond band', blurb: 'Flat band with five set diamonds.', metal: '18k-white',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 20, width: 5, thickness: 2.2, profile: 'flat', stations: 5, arc: 46 } },
      { key: 'b', type: 'setting-bezel', parent: 'band', anchor: 'station', all: true, params: { shape: 'round', size: 2.6, height: 0.9 } },
      { key: 'g', type: 'stone', parent: 'b', anchor: 'stone', all: true, params: { shape: 'round', size: 2.6 }, gem: 'diamond' },
    ],
  },
  {
    id: 'men-stone-ring', category: 'rings', name: 'Big stone ring', blurb: 'Bold oval stone in a bezel — navaratna or birthstone.', metal: '22k-yellow',
    parts: [
      { key: 'band', type: 'ringBand', params: { size: 20, width: 4.5, thickness: 2.2, profile: 'court' } },
      { key: 'b', type: 'setting-bezel', parent: 'band', anchor: 'top', params: { shape: 'oval', size: 11, ratio: 1.3, height: 1.8 } },
      { key: 'g', type: 'stone', parent: 'b', anchor: 'stone', params: { shape: 'cabochon', size: 11, ratio: 1.3 }, gem: 'sapphire' },
    ],
  },
  { id: 'men-kada', category: 'bangles', name: 'Men’s kada', blurb: 'Heavy half-round kada.', metal: '22k-yellow', parts: [{ key: 'b', type: 'bangle', params: { size: '2-10', width: 9, thickness: 4, profile: 'half-round' } }] },
  { id: 'men-kada-ribbed', category: 'bangles', name: 'Ribbed kada', blurb: 'Kada with deep ribs.', metal: '22k-yellow', parts: [{ key: 'b', type: 'bangle', params: { size: '2-10', width: 8, thickness: 4, profile: 'court', pattern: 'ribbed' } }] },
  { id: 'men-kada-open', category: 'bangles', name: 'Open kada', blurb: 'Open kada with heavy round ends.', metal: '22k-yellow', parts: [{ key: 'b', type: 'bangle', params: { size: '2-10', width: 8, thickness: 4, profile: 'court', opening: 32 } }] },
  { id: 'men-kada-twist', category: 'bangles', name: 'Twisted kada', blurb: 'Thick rope-twist kada.', metal: '22k-yellow', parts: [{ key: 'b', type: 'bangle', params: { size: '2-10', width: 6, thickness: 4, profile: 'flat', pattern: 'twist' } }] },
  { id: 'men-curb-bracelet', category: 'bracelets', name: 'Cuban bracelet', blurb: 'Chunky curb links.', metal: '22k-yellow', parts: [{ key: 'b', type: 'braceletChain', params: { wrist: 20, style: 'curb', wire: 2 } }, { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp', params: { size: 12 } }] },
  { id: 'men-box-bracelet', category: 'bracelets', name: 'Box bracelet', blurb: 'Bold square links.', metal: '22k-yellow', parts: [{ key: 'b', type: 'braceletChain', params: { wrist: 20, style: 'box', wire: 1.8 } }, { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp', params: { size: 11 } }] },
  { id: 'men-rope-bracelet', category: 'bracelets', name: 'Rope bracelet', blurb: 'Thick twisted rope.', metal: '22k-yellow', parts: [{ key: 'b', type: 'braceletChain', params: { wrist: 20, style: 'rope', wire: 1.8 } }, { key: 'cl', type: 'clasp', parent: 'b', anchor: 'clasp', params: { size: 11 } }] },
  { id: 'art-heart', category: 'pendants', name: 'Open heart pendant', blurb: 'Open heart with a small diamond.', metal: '18k-rose', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'heart', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 2.4 }, gem: 'diamond' }] },
  { id: 'art-infinity', category: 'pendants', name: 'Infinity pendant', blurb: 'Forever loop in polished gold.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'infinity', height: 17, thickness: 1.1 } }] },
  { id: 'art-butterfly', category: 'pendants', name: 'Butterfly pendant', blurb: 'Cut-out wings with two stones.', metal: '18k-rose', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'butterfly', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 1.9 }, gem: 'diamond' }, { key: 'r', type: 'stone', parent: 'p', anchor: 'socket-ring', all: true, params: { shape: 'round', size: 1.9 }, gem: 'diamond' }] },
  { id: 'art-evil-eye', category: 'pendants', name: 'Evil eye pendant', blurb: 'Blue stone in a gold eye frame.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'evil-eye', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'cabochon', size: 6.4 }, gem: 'sapphire' }] },
  { id: 'art-moon-star', category: 'pendants', name: 'Moon and star pendant', blurb: 'Crescent moon with a star.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'moon-star', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 1.7 }, gem: 'diamond' }] },
  { id: 'art-flower', category: 'pendants', name: 'Flower pendant', blurb: 'Five petals with a ruby centre.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'flower', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 3.4 }, gem: 'ruby' }] },
  { id: 'art-leaf', category: 'pendants', name: 'Leaf pendant', blurb: 'Veined gold leaf.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'leaf', height: 17, thickness: 1.1 } }] },
  { id: 'art-drop', category: 'pendants', name: 'Solitaire drop pendant', blurb: 'One stone in a teardrop frame.', metal: '18k-white', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'drop', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'pear', size: 4.9 }, gem: 'diamond' }] },
  { id: 'art-om', category: 'pendants', name: 'Om pendant', blurb: 'Bold Om in gold with a stone.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'om', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 2.0 }, gem: 'diamond' }] },
  { id: 'art-star', category: 'pendants', name: 'Star pendant', blurb: 'Five-point star, centre stone.', metal: '18k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'star', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 3.7 }, gem: 'diamond' }] },
  { id: 'art-sunburst', category: 'pendants', name: 'Sun coin pendant', blurb: 'Coin with sun rays, centre stone.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'sunburst', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 3.6 }, gem: 'diamond' }] },
  { id: 'art-clover', category: 'pendants', name: 'Clover pendant', blurb: 'Four lucky petals, emerald centre.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantArt', params: { design: 'clover', height: 17, thickness: 1.1 } }, { key: 'c', type: 'stone', parent: 'p', anchor: 'socket', params: { shape: 'round', size: 2.4 }, gem: 'emerald' }] },
  { id: 'men-tablet-pendant', category: 'pendants', name: 'Tablet pendant', blurb: 'Clean square plate.', metal: '22k-yellow', parts: [{ key: 'p', type: 'pendantBody', params: { shape: 'tablet', height: 26, thickness: 2.4 } }] },
  {
    id: 'men-stone-pendant', category: 'pendants', name: 'Stone tablet pendant', blurb: 'Square plate with a centre stone and corner diamonds.', metal: '22k-yellow',
    parts: [
      { key: 'p', type: 'pendantBody', params: { shape: 'tablet', height: 26, thickness: 2.4, ring: 4 } },
      { key: 'b', type: 'setting-bezel', parent: 'p', anchor: 'socket', params: { shape: 'emerald', size: 9, ratio: 1.3, height: 1.4 } },
      { key: 'g', type: 'stone', parent: 'b', anchor: 'stone', params: { shape: 'emerald', size: 9, ratio: 1.3 }, gem: 'onyx' },
      { key: 'd', type: 'stone', parent: 'p', anchor: 'socket-ring', all: true, params: { shape: 'round', size: 2 }, gem: 'diamond' },
    ],
  },
  { id: 'men-coin-pendant', category: 'pendants', name: 'Coin pendant', blurb: 'Round gold coin with a beaded rim.', metal: '22k-yellow', finish: 'antique', parts: [{ key: 'p', type: 'pendantBody', params: { shape: 'temple-coin', height: 26, thickness: 2.4 } }] },
  {
    id: 'men-stud', category: 'earrings', name: 'Men’s stud', blurb: 'Single stone in a bezel.', pair: true, metal: '18k-white',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'medallion', size: 5, thickness: 1.2 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'b', type: 'setting-bezel', parent: 'top', anchor: 'socket', params: { shape: 'round', size: 4, height: 1.2 } },
      { key: 'g', type: 'stone', parent: 'b', anchor: 'stone', params: { shape: 'round', size: 4 }, gem: 'diamond' },
    ],
  },
  {
    id: 'men-square-stud', category: 'earrings', name: 'Square stud', blurb: 'Square-cut stone in prongs.', pair: true, metal: '18k-white',
    parts: [
      { key: 'top', type: 'earStud', params: { shape: 'tablet', size: 5, thickness: 1.2 } },
      { key: 'post', type: 'earPost', parent: 'top', anchor: 'post' },
      { key: 'pr', type: 'setting-prong', parent: 'top', anchor: 'socket', params: { shape: 'emerald', size: 4.5, ratio: 1, height: 1.8, prongs: 4 } },
      { key: 'g', type: 'stone', parent: 'pr', anchor: 'stone', params: { shape: 'emerald', size: 4.5, ratio: 1 }, gem: 'onyx' },
    ],
  },
];

/** stable = node ids are `<template>.<part key>`, so per-part customisations survive rebuilds. */
export function instantiate(t: Template, stable = false): Design {
  const keyToId = new Map<string, string>();
  const nodes: DesignNode[] = t.parts.map((s) => {
    const id = stable ? `${t.id}.${s.key}` : uid();
    keyToId.set(s.key, id);
    const def = COMPONENT_MAP[s.type];
    return {
      id, type: s.type, name: s.name ?? def.label,
      params: { ...defaultParams(s.type), ...(s.params ?? {}) },
      material: { metal: s.metal ?? t.metal, finish: s.finish ?? t.finish ?? 'polished', gem: s.gem ?? (def.uses.gem ? 'ruby' : undefined), altGem: s.altGem ?? 'none' },
      attach: undefined, offset: { ...ZERO_OFFSET, pos: s.pos ?? [0, 0, 0], rot: s.rot ?? [0, 0, 0] }, visible: true, locked: false,
    };
  });
  t.parts.forEach((s, i) => { if (s.parent) nodes[i].attach = { parent: keyToId.get(s.parent)!, anchor: s.anchor!, all: !!s.all }; });
  const now = new Date().toISOString();
  return { schema: 'bhavani.design/1', id: designId(), name: t.name, category: t.category, templateId: t.id, pair: !!t.pair, nodes, refs: [], notes: '', createdAt: now, updatedAt: now, version: 1 };
}

export function emptyDesign(category: Category): Design {
  const now = new Date().toISOString();
  return { schema: 'bhavani.design/1', id: designId(), name: 'Untitled design', category, pair: category === 'earrings', nodes: [], refs: [], notes: '', createdAt: now, updatedAt: now, version: 1 };
}
