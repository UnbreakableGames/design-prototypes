import type { Inventory } from '../game/types';

export type EssenceId =
  | 'honeyDrop'
  | 'wealth1' | 'wealth2' | 'wealth3'
  | 'fortune1' | 'fortune2' | 'fortune3'
  | 'power1' | 'power2' | 'power3'
  | 'haul1' | 'haul2' | 'haul3'
  | 'quickstart' | 'echo'
  | 'craft1';

export interface EssenceNode {
  id: EssenceId;
  /** Pixel position in the essence overlay (centered). Keeps the tree simple
   *  rather than reusing the axial-hex layout of the main skill tree. */
  x: number;
  y: number;
  /** Optional prerequisite — node must be unlocked first. */
  prereq?: EssenceId;
  name: string;
  desc: string;
  cost: number;
  /** Branch color for the node ring. */
  color: string;
}

// Layout: HONEYCOMB. honeyDrop sits at the center; each branch radiates from
// it in one of the six axial hex directions. Pointy-top hex spacing — adjacent
// nodes are hex-neighbors visually + topologically.
//
// Axial → pixel for pointy-top hex (size 32):
//   x = √3 · size · (q + r/2)  ≈  55 · (q + r/2)
//   y =      1.5 · size · r     =  48 · r
export const ESSENCE_TREE: EssenceNode[] = [
  // Center hex — always-affordable starter (costs 1 essence).
  { id: 'honeyDrop', x:    0, y:    0, name: 'Honey Drop', desc: '+25 starting pollen each run', cost: 1, color: '#ffd24a' },

  // Wealth branch — radiates WEST (axial -1, 0)
  { id: 'wealth1', x:  -55, y:    0,                       name: 'Wealth I',  desc: '+25% pollen income',           cost: 5,  color: '#ffd24a' },
  { id: 'wealth2', x: -110, y:    0, prereq: 'wealth1',    name: 'Wealth II', desc: '+50% pollen income (stacks)',  cost: 15, color: '#ffd24a' },
  { id: 'wealth3', x: -166, y:    0, prereq: 'wealth2',    name: 'Wealth III',desc: '+100% pollen income (stacks)', cost: 40, color: '#ffd24a' },

  // Power branch — radiates EAST (+1, 0)
  { id: 'power1',  x:   55, y:    0,                       name: 'Power I',   desc: '+25% spitter damage',           cost: 8,  color: '#ff8c5a' },
  { id: 'power2',  x:  110, y:    0, prereq: 'power1',     name: 'Power II',  desc: '+50% spitter damage (stacks)',  cost: 20, color: '#ff8c5a' },
  { id: 'power3',  x:  166, y:    0, prereq: 'power2',     name: 'Power III', desc: '+100% spitter damage (stacks)', cost: 60, color: '#ff8c5a' },

  // Fortune branch — radiates NW (0, -1)
  { id: 'fortune1', x:  -28, y:  -48,                      name: 'Fortune I',   desc: '+50 starting luck',           cost: 5,  color: '#5af04a' },
  { id: 'fortune2', x:  -55, y:  -96, prereq: 'fortune1',  name: 'Fortune II',  desc: '+150 starting luck (stacks)', cost: 15, color: '#5af04a' },
  { id: 'fortune3', x:  -83, y: -144, prereq: 'fortune2',  name: 'Fortune III', desc: '+400 starting luck (stacks)', cost: 40, color: '#5af04a' },

  // Haul branch — radiates SE (0, +1)
  { id: 'haul1',   x:   28, y:   48,                       name: 'Haul I',   desc: '+25% loot value',            cost: 8,  color: '#5af0ff' },
  { id: 'haul2',   x:   55, y:   96, prereq: 'haul1',      name: 'Haul II',  desc: '+50% loot value (stacks)',   cost: 20, color: '#5af0ff' },
  { id: 'haul3',   x:   83, y:  144, prereq: 'haul2',      name: 'Haul III', desc: '+100% loot value (stacks)',  cost: 60, color: '#5af0ff' },

  // Meta nodes — fill the remaining two ring-1 hexes (NE + SW).
  { id: 'quickstart', x:   28, y:  -48, name: 'Quick Start', desc: '+1 spitter & +1 runner starting slot', cost: 30, color: '#b070ff' },
  { id: 'echo',       x:  -28, y:   48, name: 'Echo',        desc: '+25% Essence from future rebirths',    cost: 50, color: '#b070ff' },

  // Capstone branch — SW of Echo. Crafting starts here; recipe-based crafting
  // is reserved for future tiers down this same axis (craft2 / craft3).
  { id: 'craft1', x: -55, y: 96, prereq: 'echo', name: 'Crafting', desc: 'Fuse duplicate bees into a random next-rarity bee', cost: 80, color: '#c170ff' },
];

export function essenceNodeById(id: EssenceId): EssenceNode | undefined {
  return ESSENCE_TREE.find((n) => n.id === id);
}

export function essenceUnlockable(node: EssenceNode, unlocked: Set<EssenceId>, inv: Inventory): boolean {
  if (unlocked.has(node.id)) return false;
  if (node.prereq && !unlocked.has(node.prereq)) return false;
  return inv.essence >= node.cost;
}

export function essenceVisible(node: EssenceNode, unlocked: Set<EssenceId>): boolean {
  if (unlocked.has(node.id)) return true;
  if (!node.prereq) return true;
  return unlocked.has(node.prereq);
}

/** Compute the Essence payout the player would get if they rebirthed *now*.
 *  Square-root on gold keeps the curve from running away; mountains add a flat
 *  bonus so deep runs feel meaningfully rewarded. */
export function essencePayout(runGoldEarned: number, runMountainsKilled: number, echoBonus: number): number {
  const base = Math.floor(Math.sqrt(runGoldEarned / 500) + runMountainsKilled);
  return Math.max(0, Math.floor(base * (1 + echoBonus)));
}
