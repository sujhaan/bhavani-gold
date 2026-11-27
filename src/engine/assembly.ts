// Turns a Design into world placements, validates connections and estimates material weights.
import * as THREE from 'three';
import { ANCHOR_LABELS, COMPONENT_MAP, buildComponent } from './components';
import { volume } from './geo';
import { DEFAULT_ALLOWANCE, GEMS, METALS, type MetalId } from './materials';
import type { Design, DesignNode, Offset } from './schema';

export function offsetMatrix(o: Offset): THREE.Matrix4 {
  const d = Math.PI / 180;
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rot[0] * d, o.rot[1] * d, o.rot[2] * d));
  return new THREE.Matrix4().compose(new THREE.Vector3(...o.pos), q, new THREE.Vector3(o.scale, o.scale, o.scale));
}

/** World matrices for every node (one per placed copy). Earring pairs are handled by the renderer. */
export function placements(d: Design): Map<string, THREE.Matrix4[]> {
  const out = new Map<string, THREE.Matrix4[]>();
  const byId = new Map(d.nodes.map((n) => [n.id, n] as const));
  const visiting = new Set<string>();
  const solve = (n: DesignNode): THREE.Matrix4[] => {
    const hit = out.get(n.id);
    if (hit) return hit;
    if (visiting.has(n.id)) return [];
    visiting.add(n.id);
    const def = COMPONENT_MAP[n.type];
    const local = offsetMatrix(n.offset);
    let res: THREE.Matrix4[] = [];
    if (!n.attach) res = [local];
    else {
      const parent = byId.get(n.attach.parent);
      if (parent) {
        const pm = solve(parent);
        const anchors = buildComponent(parent.type, parent.params).anchors.filter((a) => a.name === n.attach!.anchor);
        const chosen = n.attach.all ? anchors : anchors.slice(n.attach.index ?? 0, (n.attach.index ?? 0) + 1);
        for (const P of pm) for (const a of chosen) {
          let m = P.clone().multiply(a.matrix);
          if (def?.hang) {
            // gravity: keep position and scale, turn so the part hangs straight down and faces front
            const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
            m.decompose(pos, q, s);
            m = new THREE.Matrix4().compose(pos, new THREE.Quaternion(), s);
          }
          res.push(m.multiply(local));
        }
      }
    }
    visiting.delete(n.id);
    out.set(n.id, res);
    return res;
  };
  d.nodes.forEach(solve);
  return out;
}

// ---------------------------------------------------------------- validation
export type Issue = { nodeId: string; level: 'error' | 'warn'; text: string };

export function validate(d: Design): Issue[] {
  const issues: Issue[] = [];
  const byId = new Map(d.nodes.map((n) => [n.id, n] as const));
  const roots = d.nodes.filter((n) => !n.attach);
  if (roots.length === 0) issues.push({ nodeId: '', level: 'warn', text: 'Start by adding a base structure (band, bangle, necklace base…).' });
  for (const n of d.nodes) {
    const def = COMPONENT_MAP[n.type];
    if (!def) { issues.push({ nodeId: n.id, level: 'error', text: `Unknown component "${n.type}".` }); continue; }
    if (!n.attach) {
      if (!def.rootFor) issues.push({ nodeId: n.id, level: 'error', text: `${n.name} must be attached to another part (it can sit on: ${def.accepts.map((a) => ANCHOR_LABELS[a] ?? a).join(', ')}).` });
      continue;
    }
    const parent = byId.get(n.attach.parent);
    if (!parent) { issues.push({ nodeId: n.id, level: 'error', text: `${n.name} is attached to a part that no longer exists.` }); continue; }
    if (!def.accepts.includes(n.attach.anchor)) {
      issues.push({ nodeId: n.id, level: 'error', text: `${def.label} can't sit on "${ANCHOR_LABELS[n.attach.anchor] ?? n.attach.anchor}" of ${parent.name}.` });
    }
    const available = buildComponent(parent.type, parent.params).anchors.filter((a) => a.name === n.attach!.anchor).length;
    if (available === 0) issues.push({ nodeId: n.id, level: 'warn', text: `${parent.name} currently has no "${ANCHOR_LABELS[n.attach.anchor] ?? n.attach.anchor}" points, so ${n.name} is hidden. Increase the count on ${parent.name}.` });
    // stones should match the setting they sit in
    if (n.type === 'stone' && parent.type.startsWith('setting-')) {
      const sz = Number(n.params.size), ps = Number(parent.params.size);
      if (Math.abs(sz - ps) > 0.3) issues.push({ nodeId: n.id, level: 'warn', text: `Stone is ${sz} mm but its setting is made for ${ps} mm.` });
      if (n.params.shape !== parent.params.shape && !(n.params.shape === 'bead')) issues.push({ nodeId: n.id, level: 'warn', text: `Stone shape (${n.params.shape}) differs from the setting (${parent.params.shape}).` });
    }
    if (n.type.startsWith('setting-') && parent.type.startsWith('setting-')) issues.push({ nodeId: n.id, level: 'error', text: 'A setting cannot sit inside another setting.' });
  }
  return issues;
}

/** Anchors on a parent that a given component type can use. */
export function compatibleAnchors(type: string, parent: DesignNode): string[] {
  const def = COMPONENT_MAP[type];
  if (!def) return [];
  const names = new Set(buildComponent(parent.type, parent.params).anchors.map((a) => a.name));
  return def.accepts.filter((a) => names.has(a));
}

// ---------------------------------------------------------------- weight
export interface NodeWeight { nodeId: string; name: string; copies: number; metalMm3: number; metalG: number; metal?: MetalId; stoneMm3: number; stoneCt: number; gem?: string }
export interface WeightReport {
  nodes: NodeWeight[];
  byMetal: { metal: MetalId; label: string; theoreticalG: number; estimatedG: number }[];
  theoreticalG: number;
  estimatedG: number;
  stonesCt: number;
  stoneCount: number;
  allowance: number;
}

export function estimateWeight(d: Design, allowance = DEFAULT_ALLOWANCE): WeightReport {
  const pl = placements(d);
  const nodes: NodeWeight[] = [];
  const pairMul = d.pair ? 2 : 1;
  for (const n of d.nodes) {
    if (!n.visible) continue;
    const built = buildComponent(n.type, n.params);
    const mats = pl.get(n.id) ?? [];
    const copies = mats.length * pairMul;
    // each copy's volume scales with the determinant of its world matrix (handles scaled parents too)
    const detSum = mats.reduce((t, m) => t + Math.abs(m.determinant()), 0) * pairMul;
    const per = copies ? detSum / copies : 1;
    const mv = volume(built.metal) * per, sv = volume(built.stone) * per;
    const metal = METALS[n.material.metal];
    const gem = n.material.gem ? GEMS[n.material.gem] : undefined;
    nodes.push({
      nodeId: n.id, name: n.name, copies, metal: built.metal ? n.material.metal : undefined,
      metalMm3: mv * copies, metalG: (mv * copies * metal.density) / 1000,
      stoneMm3: sv * copies, stoneCt: gem ? ((sv * copies * gem.density) / 1000) / 0.2 : 0, gem: gem?.label,
    });
  }
  const map = new Map<MetalId, number>();
  for (const w of nodes) if (w.metal && w.metalG > 0) map.set(w.metal, (map.get(w.metal) ?? 0) + w.metalG);
  const byMetal = [...map.entries()].map(([metal, g]) => ({ metal, label: METALS[metal].label, theoreticalG: g, estimatedG: g * (1 + allowance) }));
  const theoreticalG = byMetal.reduce((s, m) => s + m.theoreticalG, 0);
  return {
    nodes, byMetal, theoreticalG, estimatedG: theoreticalG * (1 + allowance),
    stonesCt: nodes.reduce((s, n) => s + n.stoneCt, 0),
    stoneCount: nodes.filter((n) => n.stoneMm3 > 0).reduce((s, n) => s + n.copies, 0),
    allowance,
  };
}

/** Overall bounding box (mm) of the assembled design. */
export function designBounds(d: Design): THREE.Box3 {
  const box = new THREE.Box3();
  const pl = placements(d);
  for (const n of d.nodes) {
    if (!n.visible) continue;
    const built = buildComponent(n.type, n.params);
    for (const g of [built.metal, built.stone]) {
      if (!g) continue;
      if (!g.boundingBox) g.computeBoundingBox();
      for (const m of pl.get(n.id) ?? []) box.union(g.boundingBox!.clone().applyMatrix4(m));
    }
  }
  return box;
}
