// Component library: every editable part, its parameters, where it may connect, and how it is built.
import * as THREE from 'three';
import type { Category, ParamValue } from './schema';
import {
  BANGLE_SIZES, band, chainAlong, clasp, dropBead, EllipseCurve3, earPost, earStud, fishHook, ghungroo, hoop, jhumkaBell,
  loopBase, loopStations, motif, necklaceCurve, pendantBody, ringInnerDiameter, setting, stone,
  type Anchor, type Built, type ChainStyle, type ClaspStyle, type LoopShape, type MotifShape, type PlaqueShape, type SettingKind, type StoneShape,
} from './shapes';
import { artPendant, P_DESIGNS, type PDesign } from '../site/pendantStudio';

export type Family = 'structure' | 'connection' | 'decorative' | 'hanging' | 'setting' | 'stone';
export const FAMILIES: { id: Family; label: string }[] = [
  { id: 'structure', label: 'Gold structures' },
  { id: 'decorative', label: 'Motifs' },
  { id: 'hanging', label: 'Hanging ornaments' },
  { id: 'setting', label: 'Stone settings' },
  { id: 'stone', label: 'Stones' },
  { id: 'connection', label: 'Hooks, posts & clasps' },
];

export type ParamDef =
  | { key: string; label: string; kind: 'number'; min: number; max: number; step: number; default: number; unit?: string; beginner?: boolean; help?: string }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[]; default: string; beginner?: boolean; help?: string }
  | { key: string; label: string; kind: 'bool'; default: boolean; beginner?: boolean; help?: string };

export interface ComponentDef {
  type: string;
  family: Family;
  label: string;
  blurb: string;
  /** Root structures list the categories they can start; children list the anchors they can sit on. */
  rootFor?: Category[];
  accepts: string[];
  hang?: boolean;
  /** Which material controls apply. */
  uses: { metal: boolean; gem: boolean };
  beginner: boolean;
  params: ParamDef[];
  build: (p: Record<string, ParamValue>) => Built & { hang?: boolean };
}

const num = (p: Record<string, ParamValue>, k: string) => Number(p[k]);
const str = (p: Record<string, ParamValue>, k: string) => String(p[k]);
const opts = (...pairs: [string, string][]) => pairs.map(([value, label]) => ({ value, label }));

const profileOpts = opts(['half-round', 'Half-round'], ['flat', 'Flat'], ['court', 'Court (comfort)'], ['knife', 'Knife edge']);
const patternOpts = opts(['plain', 'Plain'], ['twist', 'Twisted'], ['ribbed', 'Ribbed'], ['wave', 'Wave']);
const chainOpts = opts(['cable', 'Cable'], ['rope', 'Rope'], ['box', 'Box'], ['ball', 'Ball'], ['figaro', 'Figaro'], ['curb', 'Cuban / curb'], ['singapore', 'Singapore'], ['paperclip', 'Paperclip'], ['snake', 'Snake'], ['blackbeads', 'Black beads (mangalsutra)'], ['wire', 'Plain wire']);
const stoneShapeOpts = opts(['round', 'Round'], ['oval', 'Oval'], ['pear', 'Pear'], ['marquise', 'Marquise'], ['emerald', 'Emerald cut'], ['cabochon', 'Cabochon (kemp)'], ['polki', 'Polki (flat uncut)']);
const plaqueOpts = opts(['teardrop', 'Teardrop'], ['peacock', 'Peacock'], ['medallion', 'Medallion'], ['temple-coin', 'Temple coin'], ['floral', 'Floral'], ['heart', 'Heart'], ['leaf', 'Leaf'], ['lozenge', 'Lozenge'], ['crescent', 'Chandbali (crescent)'], ['tablet', 'Tablet']);
const SURFACE = ['top', 'station', 'socket', 'socket-ring', 'center'];
const HANG = ['drop', 'rim', 'station', 'center'];

export const COMPONENTS: ComponentDef[] = [
  // ------------------------------------------------ structures
  {
    type: 'ringBand', family: 'structure', label: 'Ring band', blurb: 'The ring shank. Size, width, profile and pattern.', rootFor: ['rings', 'custom'], accepts: [], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'size', label: 'Ring size (Indian)', kind: 'number', min: 1, max: 30, step: 1, default: 14, beginner: true },
      { key: 'width', label: 'Band width', kind: 'number', min: 1.5, max: 12, step: 0.1, default: 3, unit: 'mm', beginner: true },
      { key: 'thickness', label: 'Thickness', kind: 'number', min: 1, max: 3.5, step: 0.1, default: 1.7, unit: 'mm' },
      { key: 'profile', label: 'Profile', kind: 'select', options: profileOpts, default: 'half-round', beginner: true },
      { key: 'pattern', label: 'Pattern', kind: 'select', options: patternOpts, default: 'plain', beginner: true },
      { key: 'stations', label: 'Stone stations on band', kind: 'number', min: 0, max: 15, step: 1, default: 0, help: 'Places for stones or motifs along the top of the band.' },
      { key: 'arc', label: 'Station spread', kind: 'number', min: 20, max: 180, step: 5, default: 70, unit: '°' },
    ],
    build: (p) => band(ringInnerDiameter(num(p, 'size')), num(p, 'width'), num(p, 'thickness'), str(p, 'profile'), str(p, 'pattern'), num(p, 'stations'), num(p, 'arc'), false),
  },
  {
    type: 'bangle', family: 'structure', label: 'Bangle / kada body', blurb: 'Round bangle body. Choose size, profile and pattern.', rootFor: ['bangles', 'custom'], accepts: [], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'size', label: 'Bangle size', kind: 'select', options: Object.keys(BANGLE_SIZES).map((k) => ({ value: k, label: `${k}  (${BANGLE_SIZES[k]} mm)` })), default: '2-6', beginner: true },
      { key: 'width', label: 'Width', kind: 'number', min: 2, max: 20, step: 0.5, default: 6, unit: 'mm', beginner: true },
      { key: 'thickness', label: 'Thickness', kind: 'number', min: 1.2, max: 6, step: 0.1, default: 2.4, unit: 'mm' },
      { key: 'profile', label: 'Profile', kind: 'select', options: profileOpts, default: 'half-round', beginner: true },
      { key: 'pattern', label: 'Pattern', kind: 'select', options: patternOpts, default: 'plain', beginner: true },
      { key: 'stations', label: 'Stations around bangle', kind: 'number', min: 0, max: 36, step: 1, default: 0 },
      { key: 'opening', label: 'Open cuff gap', kind: 'number', min: 0, max: 90, step: 5, default: 0, unit: '°' },
    ],
    build: (p) => band(BANGLE_SIZES[str(p, 'size')] ?? 60.3, num(p, 'width'), num(p, 'thickness'), str(p, 'profile'), str(p, 'pattern'), num(p, 'stations'), 360, true, num(p, 'opening')),
  },
  {
    type: 'necklaceBase', family: 'structure', label: 'Necklace base', blurb: 'Haram / choker body. Length, drape and motif stations.', rootFor: ['necklaces', 'custom'], accepts: [], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'length', label: 'Length', kind: 'number', min: 13, max: 32, step: 0.5, default: 22, unit: 'in', beginner: true },
      { key: 'shape', label: 'Drape', kind: 'select', options: opts(['U', 'Long U (haram)'], ['V', 'V-shape'], ['round', 'Round'], ['choker', 'Choker']), default: 'U', beginner: true },
      { key: 'style', label: 'Base chain', kind: 'select', options: chainOpts, default: 'cable' },
      { key: 'wire', label: 'Chain wire', kind: 'number', min: 0.5, max: 2.5, step: 0.05, default: 0.9, unit: 'mm' },
      { key: 'stations', label: 'Motif stations', kind: 'number', min: 0, max: 160, step: 1, default: 30, beginner: true, help: 'How many motifs repeat along the front.' },
      { key: 'coverage', label: 'Front coverage', kind: 'number', min: 10, max: 85, step: 1, default: 58, unit: '%' },
      { key: 'gap', label: 'Centre gap (for pendant)', kind: 'number', min: 0, max: 20, step: 0.5, default: 4, unit: '%' },
    ],
    build: (p) => loopBase(necklaceCurve(num(p, 'length') * 25.4, str(p, 'shape') as LoopShape), str(p, 'style') as ChainStyle, num(p, 'wire'), num(p, 'stations'), num(p, 'coverage') / 100, num(p, 'gap') / 100),
  },
  {
    type: 'chainBase', family: 'structure', label: 'Chain', blurb: 'Plain chain. Length, link style and thickness.', rootFor: ['chains', 'custom'], accepts: [], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'length', label: 'Length', kind: 'number', min: 14, max: 30, step: 0.5, default: 20, unit: 'in', beginner: true },
      { key: 'style', label: 'Link style', kind: 'select', options: chainOpts.filter((o) => o.value !== 'wire'), default: 'cable', beginner: true },
      { key: 'wire', label: 'Wire thickness', kind: 'number', min: 0.4, max: 3, step: 0.05, default: 1, unit: 'mm', beginner: true },
    ],
    build: (p) => loopBase(necklaceCurve(num(p, 'length') * 25.4, 'round'), str(p, 'style') as ChainStyle, num(p, 'wire'), 0, 0, 0),
  },
  {
    type: 'braceletChain', family: 'structure', label: 'Bracelet', blurb: 'Link bracelet sized to the wrist, with charm stations.', rootFor: ['bracelets', 'custom'], accepts: [], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'wrist', label: 'Wrist length', kind: 'number', min: 14, max: 22, step: 0.5, default: 17.5, unit: 'cm', beginner: true },
      { key: 'style', label: 'Link style', kind: 'select', options: chainOpts.filter((o) => o.value !== 'wire'), default: 'cable', beginner: true },
      { key: 'wire', label: 'Wire thickness', kind: 'number', min: 0.5, max: 3, step: 0.05, default: 1.3, unit: 'mm', beginner: true },
      { key: 'stations', label: 'Charm stations', kind: 'number', min: 0, max: 20, step: 1, default: 0, beginner: true },
    ],
    build: (p) => {
      const L = num(p, 'wrist') * 10 + 12;
      const a = L / (2 * Math.PI) * 1.12, b = L / (2 * Math.PI) * 0.86;
      const curve = new EllipseCurve3(a, b);
      const { metal, stone } = chainAlong(curve, str(p, 'style') as ChainStyle, num(p, 'wire'));
      const anchors: Anchor[] = [{ name: 'clasp', matrix: new THREE.Matrix4().setPosition(0, b, 0) }];
      const n = num(p, 'stations');
      const st = loopStations(curve, n, 0.42, 0, num(p, 'wire') * 0.5);
      // bracelet "front" is the bottom half (u = 0.5)
      return { metal, stone, anchors: [...anchors, ...st] };
    },
  },
  {
    type: 'pendantBody', family: 'structure', label: 'Pendant', blurb: 'Pendant body with bail. Hangs from a necklace centre or an earring.', rootFor: ['pendants', 'custom'], accepts: ['center', 'drop'], hang: true, uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'shape', label: 'Shape', kind: 'select', options: plaqueOpts, default: 'teardrop', beginner: true },
      { key: 'height', label: 'Height', kind: 'number', min: 8, max: 70, step: 0.5, default: 26, unit: 'mm', beginner: true },
      { key: 'thickness', label: 'Thickness', kind: 'number', min: 0.8, max: 5, step: 0.1, default: 1.8, unit: 'mm' },
      { key: 'bail', label: 'Bail loop', kind: 'bool', default: true },
      { key: 'ring', label: 'Stone ring sockets', kind: 'number', min: 0, max: 12, step: 1, default: 0, help: 'Sockets arranged around the centre.' },
      { key: 'drops', label: 'Drop points (bottom)', kind: 'number', min: 0, max: 15, step: 1, default: 0, beginner: true },
      { key: 'openwork', label: 'Openwork (cut-out)', kind: 'bool', default: false },
    ],
    build: (p) => pendantBody(str(p, 'shape') as PlaqueShape, num(p, 'height'), num(p, 'thickness'), Boolean(p.bail), num(p, 'ring'), num(p, 'drops'), Boolean(p.openwork)),
  },
  {
    type: 'pendantArt', family: 'structure', label: 'Pendant', blurb: 'Modern and international pendant shapes: heart, evil eye, hamsa, Arabic star, lira coin and more.', rootFor: ['pendants', 'custom'], accepts: ['center', 'drop', 'station'], hang: true, uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'design', label: 'Design', kind: 'select', options: P_DESIGNS.map((d) => ({ value: d.id, label: d.label })), default: 'heart', beginner: true },
      { key: 'height', label: 'Size', kind: 'number', min: 10, max: 30, step: 0.5, default: 17, unit: 'mm', beginner: true },
      { key: 'thickness', label: 'Thickness', kind: 'number', min: 0.7, max: 2, step: 0.1, default: 1.1, unit: 'mm' },
    ],
    build: (p) => artPendant(str(p, 'design') as PDesign, num(p, 'height'), num(p, 'thickness')),
  },
  {
    type: 'earStud', family: 'structure', label: 'Earring top (stud)', blurb: 'Front piece of a stud or jhumka. Has a post at the back.', rootFor: ['earrings', 'custom'], accepts: [], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'shape', label: 'Shape', kind: 'select', options: plaqueOpts, default: 'floral', beginner: true },
      { key: 'size', label: 'Size', kind: 'number', min: 5, max: 30, step: 0.5, default: 11, unit: 'mm', beginner: true },
      { key: 'thickness', label: 'Thickness', kind: 'number', min: 0.8, max: 4, step: 0.1, default: 1.5, unit: 'mm' },
      { key: 'ring', label: 'Stone ring sockets', kind: 'number', min: 0, max: 12, step: 1, default: 0 },
    ],
    build: (p) => earStud(str(p, 'shape') as PlaqueShape, num(p, 'size'), num(p, 'thickness'), num(p, 'ring')),
  },
  {
    type: 'earHoop', family: 'structure', label: 'Hoop (bali)', blurb: 'Round hoop earring with drop points.', rootFor: ['earrings', 'custom'], accepts: [], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'diameter', label: 'Diameter', kind: 'number', min: 8, max: 60, step: 0.5, default: 22, unit: 'mm', beginner: true },
      { key: 'wire', label: 'Wire', kind: 'number', min: 0.6, max: 4, step: 0.1, default: 1.4, unit: 'mm', beginner: true },
      { key: 'rim', label: 'Drop points on rim', kind: 'number', min: 0, max: 15, step: 1, default: 0, beginner: true },
      { key: 'stations', label: 'Stone stations (front)', kind: 'number', min: 0, max: 15, step: 1, default: 0 },
    ],
    build: (p) => hoop(num(p, 'diameter'), num(p, 'wire'), num(p, 'rim'), num(p, 'stations')),
  },
  {
    type: 'fishHook', family: 'structure', label: 'Hook earring base', blurb: 'Fish-hook ear wire. Hang a pendant or jhumka below it.', rootFor: ['earrings', 'custom'], accepts: [], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'height', label: 'Hook height', kind: 'number', min: 10, max: 28, step: 0.5, default: 16, unit: 'mm' },
      { key: 'wire', label: 'Wire', kind: 'number', min: 0.5, max: 1.2, step: 0.05, default: 0.75, unit: 'mm' },
    ],
    build: (p) => fishHook(num(p, 'height'), num(p, 'wire')),
  },
  // ------------------------------------------------ motifs
  ...([
    ['mango', 'Mango (paisley)', 'Classic South Indian mango motif. Head socket for a stone.'],
    ['leaf', 'Leaf', 'Pointed leaf motif.'],
    ['floral', 'Flower', 'Petal flower with centre and petal sockets.'],
    ['kasu', 'Kasu coin', 'Temple coin that hangs (kasu mala).'],
    ['peacock', 'Peacock', 'Peacock with feather fan.'],
    ['lozenge', 'Lozenge', 'Geometric diamond-shape, optional cut-out.'],
    ['bead', 'Bead / pearl', 'Round bead in gold, pearl or coral.'],
    ['tablet', 'Tablet / plate', 'Square plate for signet rings and men’s pieces.'],
  ] as [MotifShape, string, string][]).map(([shape, label, blurb]): ComponentDef => ({
    type: `motif-${shape}`, family: 'decorative', label, blurb, accepts: SURFACE, hang: shape === 'kasu', uses: { metal: shape !== 'bead', gem: shape === 'bead' }, beginner: true,
    params: [
      { key: 'size', label: 'Size', kind: 'number', min: 2, max: 40, step: 0.25, default: shape === 'bead' ? 4 : shape === 'kasu' ? 12 : shape === 'peacock' ? 16 : shape === 'tablet' ? 12 : 9, unit: 'mm', beginner: true },
      ...(shape === 'bead' ? [{ key: 'beadMat', label: 'Material', kind: 'select', options: opts(['metal', 'Gold'], ['pearl', 'Pearl / stone']), default: 'metal', beginner: true } as ParamDef]
        : [{ key: 'thickness', label: 'Thickness', kind: 'number', min: 0.6, max: 4, step: 0.1, default: 1.4, unit: 'mm' } as ParamDef]),
      ...(shape === 'floral' ? [{ key: 'petals', label: 'Petals', kind: 'number', min: 4, max: 12, step: 1, default: 6, beginner: true } as ParamDef] : []),
      ...(shape === 'lozenge' ? [{ key: 'openwork', label: 'Cut-out centre', kind: 'bool', default: true } as ParamDef] : []),
    ],
    build: (p) => motif(shape, num(p, 'size'), Number(p.thickness ?? 1.4), Number(p.petals ?? 6), Boolean(p.openwork), String(p.beadMat ?? 'metal')),
  })),
  // ------------------------------------------------ hanging
  {
    type: 'ghungroo', family: 'hanging', label: 'Ghungroo bell', blurb: 'Small gold bell drop.', accepts: HANG, hang: true, uses: { metal: true, gem: false }, beginner: true,
    params: [{ key: 'size', label: 'Size', kind: 'number', min: 1.5, max: 8, step: 0.1, default: 2.6, unit: 'mm', beginner: true }],
    build: (p) => ghungroo(num(p, 'size')),
  },
  {
    type: 'dropBead', family: 'hanging', label: 'Drop (pear)', blurb: 'Pear-shaped drop in gold, pearl or stone.', accepts: HANG, hang: true, uses: { metal: true, gem: true }, beginner: true,
    params: [
      { key: 'size', label: 'Size', kind: 'number', min: 2, max: 14, step: 0.1, default: 4, unit: 'mm', beginner: true },
      { key: 'mat', label: 'Material', kind: 'select', options: opts(['metal', 'Gold'], ['stone', 'Pearl / stone']), default: 'stone', beginner: true },
    ],
    build: (p) => dropBead(num(p, 'size'), str(p, 'mat')),
  },
  {
    type: 'jhumkaBell', family: 'hanging', label: 'Jhumka bell', blurb: 'Dome bell that hangs under an earring top.', accepts: ['drop'], hang: true, uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'diameter', label: 'Diameter', kind: 'number', min: 6, max: 30, step: 0.5, default: 13, unit: 'mm', beginner: true },
      { key: 'height', label: 'Height', kind: 'number', min: 4, max: 24, step: 0.5, default: 10, unit: 'mm', beginner: true },
      { key: 'rim', label: 'Drop points on rim', kind: 'number', min: 0, max: 24, step: 1, default: 12, beginner: true },
    ],
    build: (p) => jhumkaBell(num(p, 'diameter'), num(p, 'height'), num(p, 'rim')),
  },
  // ------------------------------------------------ settings
  ...([
    ['bezel', 'Bezel setting', 'Metal wall around the stone. Secure and smooth.'],
    ['prong', 'Prong setting', 'Claws hold the stone up to the light.'],
    ['kundan', 'Kundan cup', 'Closed-back cup, traditional for kemp and kundan.'],
    ['halo', 'Halo setting', 'Centre stone ringed by small stones.'],
  ] as [SettingKind, string, string][]).map(([kind, label, blurb]): ComponentDef => ({
    type: `setting-${kind}`, family: 'setting', label, blurb, accepts: SURFACE, uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'shape', label: 'Stone shape', kind: 'select', options: stoneShapeOpts, default: kind === 'kundan' ? 'cabochon' : 'round', beginner: true },
      { key: 'size', label: 'Stone size', kind: 'number', min: 1, max: 20, step: 0.1, default: kind === 'prong' || kind === 'halo' ? 5 : 3, unit: 'mm', beginner: true },
      { key: 'ratio', label: 'Length : width', kind: 'number', min: 1, max: 2.5, step: 0.05, default: 1 },
      ...(kind === 'prong' ? [{ key: 'prongs', label: 'Prongs', kind: 'number', min: 3, max: 8, step: 1, default: 4 } as ParamDef] : []),
      { key: 'height', label: 'Setting height', kind: 'number', min: 0.6, max: 6, step: 0.1, default: kind === 'prong' || kind === 'halo' ? 2.4 : 1.2, unit: 'mm' },
    ],
    build: (p) => setting(kind, str(p, 'shape') as StoneShape, num(p, 'size'), num(p, 'ratio'), Number(p.prongs ?? 4), num(p, 'height')),
  })),
  // ------------------------------------------------ stones
  {
    type: 'stone', family: 'stone', label: 'Gemstone', blurb: 'Ruby, emerald, diamond/CZ, kemp, pearl. Sits in a setting or a motif socket.', accepts: ['stone', 'socket', 'socket-ring'], uses: { metal: false, gem: true }, beginner: true,
    params: [
      { key: 'shape', label: 'Shape', kind: 'select', options: [...stoneShapeOpts, { value: 'bead', label: 'Bead (pearl)' }], default: 'round', beginner: true },
      { key: 'size', label: 'Size', kind: 'number', min: 1, max: 20, step: 0.1, default: 3, unit: 'mm', beginner: true },
      { key: 'ratio', label: 'Length : width', kind: 'number', min: 1, max: 2.5, step: 0.05, default: 1 },
    ],
    build: (p) => ({ stone: stone(str(p, 'shape') as StoneShape, num(p, 'size'), num(p, 'ratio')), anchors: [] }),
  },
  // ------------------------------------------------ connections
  {
    type: 'earPost', family: 'connection', label: 'Ear post + screw back', blurb: 'Post and back for stud earrings.', accepts: ['post'], uses: { metal: true, gem: false }, beginner: true,
    params: [
      { key: 'length', label: 'Post length', kind: 'number', min: 6, max: 14, step: 0.5, default: 10, unit: 'mm' },
      { key: 'back', label: 'Screw back', kind: 'bool', default: true },
    ],
    build: (p) => earPost(num(p, 'length'), Boolean(p.back)),
  },
  {
    type: 'clasp', family: 'connection', label: 'Clasp', blurb: 'Closure for chains, necklaces and bracelets.', accepts: ['clasp'], hang: true, uses: { metal: true, gem: false }, beginner: false,
    params: [
      { key: 'style', label: 'Style', kind: 'select', options: opts(['lobster', 'Lobster'], ['s-hook', 'S-hook'], ['screw', 'Screw (thirugu)']), default: 'lobster' },
      { key: 'size', label: 'Size', kind: 'number', min: 4, max: 16, step: 0.5, default: 9, unit: 'mm' },
    ],
    build: (p) => clasp(str(p, 'style') as ClaspStyle, num(p, 'size')),
  },
];

export const COMPONENT_MAP: Record<string, ComponentDef> = Object.fromEntries(COMPONENTS.map((c) => [c.type, c]));

export function defaultParams(type: string): Record<string, ParamValue> {
  const def = COMPONENT_MAP[type];
  return Object.fromEntries(def.params.map((p) => [p.key, p.default]));
}

// ---------------------------------------------------------------- build cache
const cache = new Map<string, Built & { hang?: boolean }>();
export function buildComponent(type: string, params: Record<string, ParamValue>): Built & { hang?: boolean } {
  const key = type + JSON.stringify(params, Object.keys(params).sort());
  const hit = cache.get(key);
  if (hit) return hit;
  const def = COMPONENT_MAP[type];
  if (!def) throw new Error(`Unknown component: ${type}`);
  const built = def.build({ ...defaultParams(type), ...params });
  if (cache.size > 300) { const first = cache.keys().next().value; if (first) cache.delete(first); }
  cache.set(key, built);
  return built;
}

export function anchorNames(type: string, params: Record<string, ParamValue>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of buildComponent(type, params).anchors) out[a.name] = (out[a.name] ?? 0) + 1;
  return out;
}

export const ANCHOR_LABELS: Record<string, string> = {
  top: 'Top / head', station: 'Stations (repeat)', socket: 'Centre socket', 'socket-ring': 'Ring of sockets', center: 'Centre front',
  drop: 'Drop points', rim: 'Rim drops', post: 'Back post', clasp: 'Clasp point', stone: 'Stone seat',
};
