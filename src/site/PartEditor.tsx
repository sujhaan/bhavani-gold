import { COMPONENT_MAP, type ParamDef } from '../engine/components';
import { GEMS, type GemId } from '../engine/materials';
import type { Design, DesignNode, ParamValue } from '../engine/schema';
import { partLabel, type PartOverride } from './designer';
import { Icon } from '../studio/icons';

type Swap = { label: string; type: string; params?: Record<string, ParamValue>; gem?: GemId };

const SETTINGS: Swap[] = [
  { label: 'Bezel (rim)', type: 'setting-bezel' }, { label: 'Prongs (claws)', type: 'setting-prong' },
  { label: 'Kundan cup', type: 'setting-kundan' }, { label: 'Halo', type: 'setting-halo' },
];
const MOTIFS: Swap[] = [
  { label: 'Mango', type: 'motif-mango' }, { label: 'Flower', type: 'motif-floral' }, { label: 'Leaf', type: 'motif-leaf' },
  { label: 'Kasu coin', type: 'motif-kasu' }, { label: 'Peacock', type: 'motif-peacock' }, { label: 'Lozenge', type: 'motif-lozenge' },
  { label: 'Gold bead', type: 'motif-bead', params: { beadMat: 'metal' } }, { label: 'Pearl', type: 'motif-bead', params: { beadMat: 'pearl' }, gem: 'pearl' },
  { label: 'Plate', type: 'motif-tablet' },
];
const DROPS: Swap[] = [
  { label: 'Gold bell', type: 'ghungroo' }, { label: 'Pearl drop', type: 'dropBead', params: { mat: 'stone' }, gem: 'pearl' },
  { label: 'Gold drop', type: 'dropBead', params: { mat: 'metal' } }, { label: 'Ruby drop', type: 'dropBead', params: { mat: 'stone' }, gem: 'ruby' },
  { label: 'Emerald drop', type: 'dropBead', params: { mat: 'stone' }, gem: 'emerald' }, { label: 'Coral drop', type: 'dropBead', params: { mat: 'stone' }, gem: 'coral' },
];
const EAR_BASES: Swap[] = [{ label: 'Stud', type: 'earStud' }, { label: 'Hook', type: 'fishHook' }, { label: 'Hoop', type: 'earHoop' }];

function swapsFor(n: DesignNode): { title: string; list: Swap[] } | null {
  if (n.type.startsWith('setting-')) return { title: 'How the stone is held', list: SETTINGS };
  if (n.type.startsWith('motif-')) return { title: 'Motif', list: MOTIFS };
  if (n.type === 'ghungroo' || n.type === 'dropBead') return { title: 'Hanging piece', list: DROPS };
  if (!n.attach && (n.type === 'earStud' || n.type === 'fishHook' || n.type === 'earHoop')) return { title: 'Earring type', list: EAR_BASES };
  return null;
}

const isOn = (n: DesignNode, s: Swap) => n.type === s.type && Object.entries(s.params ?? {}).every(([k, v]) => n.params[k] === v) && (!s.gem || n.material.gem === s.gem);

/** Parameters worth showing for a part (root size/length is already a main control). */
function editableParams(n: DesignNode): ParamDef[] {
  const def = COMPONENT_MAP[n.type];
  const skip = new Set(['ratio', 'arc', 'coverage', 'gap', 'beadMat', 'mat', 'stations', 'ring', 'drops', 'rim']);
  if (n.type.startsWith('setting-')) skip.add('height');
  if (!n.attach) ['size', 'length', 'wrist'].forEach((k) => skip.add(k));
  return def.params.filter((p) => !skip.has(p.key) && (p.kind !== 'number' || p.beginner || p.key === 'thickness' || p.key === 'wire'));
}

/** Counts customers understand: "how many" controls for repeating parts. */
function countParams(n: DesignNode): ParamDef[] {
  const def = COMPONENT_MAP[n.type];
  const want: Record<string, string> = { stations: 'How many', ring: 'Stones around', drops: 'Drops at the bottom', rim: 'Drops around the rim' };
  return def.params.filter((p) => p.key in want && p.kind === 'number').map((p) => ({ ...p, label: want[p.key] } as ParamDef));
}

export default function PartEditor({ design, node, copies, onChange, onReset, onClose, changed }: {
  design: Design; node: DesignNode; copies: number; changed: boolean;
  onChange: (o: PartOverride) => void; onReset: () => void; onClose: () => void;
}) {
  const def = COMPONENT_MAP[node.type];
  const sw = swapsFor(node);
  const params = editableParams(node);
  const counts = countParams(node);
  const isStone = node.type === 'stone' || (def.uses.gem && !def.uses.metal) || (node.type === 'dropBead' && node.params.mat === 'stone') || (node.type === 'motif-bead' && node.params.beadMat === 'pearl');
  const gems = (Object.keys(GEMS) as GemId[]).filter((g) => g !== 'navratna' || node.attach?.all);
  const set = (k: string, v: ParamValue) => onChange({ params: { [k]: v } });

  return (
    <div className="pe">
      <div className="pe-head">
        <div>
          <p className="mono">Editing part</p>
          <h4>{partLabel(design, node)}</h4>
          {copies > 1 && <p className="pe-sub">Changes apply to all {copies} pieces</p>}
        </div>
        <button className="pill-icon" onClick={onClose} title="Done"><Icon name="check" /></button>
      </div>

      {sw && (
        <div className="pe-block">
          <p className="pe-label">{sw.title}</p>
          <div className="pe-chips">
            {sw.list.map((s) => (
              <button key={s.label} className={isOn(node, s) ? 'on' : ''} onClick={() => onChange({ type: s.type, params: s.params, gem: s.gem })}>{s.label}</button>
            ))}
          </div>
          {!node.attach && sw.list === EAR_BASES && <p className="pe-sub">Changing the earring type can remove parts that only fit the old type.</p>}
        </div>
      )}

      {isStone && (
        <div className="pe-block">
          <p className="pe-label">Stone</p>
          <div className="pe-gems">
            {gems.map((g) => (
              <button key={g} className={node.material.gem === g ? 'on' : ''} onClick={() => onChange({ gem: g })} title={GEMS[g].label}>
                <i style={{ background: g === 'navratna' ? 'conic-gradient(#c0122f,#f4ede1,#e2603f,#11834a,#f0b52e,#fff,#2147b8,#b5651d,#c8b56a,#c0122f)' : `radial-gradient(circle at 35% 30%, #fff9, ${GEMS[g].colour} 60%)` }} />
                <span>{GEMS[g].label.replace(/ \((red|green)\)/, ' $1').replace(/ \(.*\)/, '').replace(' / topaz', '')}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {params.map((p) => (
        <div className="pe-block" key={p.key}>
          {p.kind === 'select' && (<>
            <p className="pe-label">{p.label}</p>
            <div className="pe-chips">{p.options.map((o) => <button key={o.value} className={node.params[p.key] === o.value ? 'on' : ''} onClick={() => set(p.key, o.value)}>{o.label}</button>)}</div>
          </>)}
          {p.kind === 'bool' && (
            <label className="pe-toggle"><input type="checkbox" checked={Boolean(node.params[p.key])} onChange={(e) => set(p.key, e.target.checked)} /> {p.label}</label>
          )}
          {p.kind === 'number' && <Stepper p={p} value={Number(node.params[p.key])} onChange={(v) => set(p.key, v)} />}
        </div>
      ))}

      {counts.map((p) => p.kind === 'number' && (
        <div className="pe-block" key={p.key}><Stepper p={{ ...p, step: 1 }} value={Number(node.params[p.key])} onChange={(v) => set(p.key, v)} /></div>
      ))}

      <div className="pe-actions">
        {node.attach && <button className="pe-remove" onClick={() => onChange({ hidden: true })}><Icon name="trash" /> Remove this part</button>}
        {changed && <button className="pe-reset" onClick={onReset}><Icon name="reset" /> Reset part</button>}
      </div>
    </div>
  );
}

function Stepper({ p, value, onChange }: { p: Extract<ParamDef, { kind: 'number' }>; value: number; onChange: (v: number) => void }) {
  const clamp = (v: number) => Math.min(p.max, Math.max(p.min, +v.toFixed(3)));
  const step = p.step < 0.2 ? Math.max(p.step, (p.max - p.min) / 40) : p.step;
  return (
    <div className="pe-stepper">
      <p className="pe-label">{p.label}</p>
      <div className="pe-row">
        <button onClick={() => onChange(clamp(value - step))} aria-label="less">−</button>
        <input type="range" min={p.min} max={p.max} step={p.step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        <button onClick={() => onChange(clamp(value + step))} aria-label="more">+</button>
        <span className="pe-val">{+value.toFixed(2)}{p.unit ? ` ${p.unit}` : ''}</span>
      </div>
    </div>
  );
}
