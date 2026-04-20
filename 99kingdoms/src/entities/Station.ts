export type StationKind =
  | 'gather'
  | 'tower'
  | 'wall'
  | 'farm'
  | 'workshop'
  | 'barracks'
  | 'garrison'
  | 'blacksmith';

export interface StationStats {
  cost: number;
  workRange: number;
  workInterval: number;
  name: string;
  color: string;
  placementRadius: number;
  maxHp: number;
  capacity: number;
  hireCost: number;
  /** Base "output" per activation — arrow dmg, coins per chop, repair per tick, etc. */
  power: number;
}

export const STATION_STATS: Record<StationKind, StationStats> = {
  gather:   { cost: 5,  workRange: 9999, workInterval: 5.0,  name: 'Gather post', color: '#8a6236', placementRadius: 16, maxHp: 30, capacity: 1, hireCost: 2, power: 1 },
  tower:    { cost: 10, workRange: 160, workInterval: 1.6,  name: 'Watchtower',  color: '#aaa5b8', placementRadius: 18, maxHp: 40, capacity: 1, hireCost: 2, power: 2 },
  wall:     { cost: 2,  workRange: 0,   workInterval: 0,    name: 'Wall',        color: '#6b4a2b', placementRadius: 13, maxHp: 20, capacity: 0, hireCost: 0, power: 0 },
  farm:     { cost: 8,  workRange: 0,   workInterval: 8.0,  name: 'Farm',        color: '#6ed678', placementRadius: 16, maxHp: 25, capacity: 0, hireCost: 0, power: 1 },
  workshop: { cost: 8,  workRange: 320, workInterval: 1.5,  name: 'Workshop',    color: '#b06840', placementRadius: 17, maxHp: 35, capacity: 1, hireCost: 3, power: 2 },
  barracks: { cost: 12, workRange: 220, workInterval: 0.55, name: 'Barracks',    color: '#5a6e8a', placementRadius: 18, maxHp: 45, capacity: 1, hireCost: 4, power: 2 },
  garrison: { cost: 10, workRange: 0,   workInterval: 0.6,  name: 'Garrison',    color: '#6a7088', placementRadius: 18, maxHp: 40, capacity: 4, hireCost: 3, power: 2 },
  blacksmith: { cost: 10, workRange: 0, workInterval: 0,    name: 'Blacksmith',  color: '#c7a060', placementRadius: 17, maxHp: 40, capacity: 0, hireCost: 0, power: 0 },
};

/**
 * Tech tree: each building requires an active instance of its prerequisite
 * kind before the player can see / pay for it. Campfire (and gather post,
 * the root economy) are always available.
 */
export interface Prereq {
  station: StationKind | null;
  campfireLevel: number;
}

export const PREREQS: Record<StationKind, Prereq> = {
  gather:     { station: null,       campfireLevel: 1 },
  wall:       { station: null,       campfireLevel: 1 },
  tower:      { station: 'gather',   campfireLevel: 1 },
  workshop:   { station: 'tower',    campfireLevel: 1 },
  farm:       { station: 'tower',    campfireLevel: 1 },
  garrison:   { station: 'tower',    campfireLevel: 1 },
  barracks:   { station: 'garrison', campfireLevel: 2 },
  blacksmith: { station: 'tower',    campfireLevel: 1 },
};

export function prereqMet(
  kind: StationKind,
  stations: Station[],
  campfireLevel: number,
): boolean {
  const req = PREREQS[kind];
  if (req.campfireLevel > campfireLevel) return false;
  if (req.station && !stations.some((s) => s.kind === req.station && s.active)) return false;
  return true;
}

export interface StationLevelBonus {
  powerAdd: number;
  intervalMult: number;
  rangeAdd: number;
  maxHpMult: number;
  capacityAdd: number;
  upgradeCost: number;
}

export const STATION_LEVEL_BONUS: StationLevelBonus[] = [
  { powerAdd: 0, intervalMult: 1.0, rangeAdd: 0,  maxHpMult: 1.0, capacityAdd: 0, upgradeCost: 0 },
  { powerAdd: 1, intervalMult: 0.8, rangeAdd: 30, maxHpMult: 1.5, capacityAdd: 1, upgradeCost: 15 },
  { powerAdd: 2, intervalMult: 0.6, rangeAdd: 55, maxHpMult: 2.0, capacityAdd: 2, upgradeCost: 30 },
];

export const MAX_STATION_LEVEL = STATION_LEVEL_BONUS.length;

export interface Station {
  id: number;
  kind: StationKind;
  x: number;
  y: number;
  recruitIds: number[];
  buildRemaining: number;
  active: boolean;
  hp: number;
  maxHp: number;
  workTimer: number;
  hireProgress: number;
  paidSlots: number;
  level: number;
  upgradeProgress: number;
  /** Cooldown after activation / level-up before the station accepts new payments. */
  readyTimer: number;
  /** Short-lived "just spent 1c on a repair" feedback timer. */
  repairFx: number;
  /** Short-lived "tried to repair but the player has no coins" warning timer. */
  unpaidFx: number;
}

export const STATION_READY_DELAY = 0.9;

let nextId = 1;

export function createStation(kind: StationKind, x: number, y: number): Station {
  const stats = STATION_STATS[kind];
  return {
    id: nextId++,
    kind,
    x,
    y,
    recruitIds: [],
    buildRemaining: stats.cost,
    active: false,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    workTimer: 0,
    hireProgress: 0,
    paidSlots: 0,
    level: 1,
    upgradeProgress: 0,
    readyTimer: 0,
    repairFx: 0,
    unpaidFx: 0,
  };
}

export function takesWorker(kind: StationKind): boolean {
  return STATION_STATS[kind].capacity > 0;
}

export interface EffectiveStationStats {
  workRange: number;
  workInterval: number;
  maxHp: number;
  capacity: number;
  power: number;
  hireCost: number;
}

export function effectiveStats(s: Station): EffectiveStationStats {
  const base = STATION_STATS[s.kind];
  const bonus = STATION_LEVEL_BONUS[Math.min(s.level, STATION_LEVEL_BONUS.length) - 1];
  // Garrison gets a custom capacity curve: 4 / 6 / 8 so it always has enough
  // slots to staff every wall in the corresponding campfire tier (L1→4 walls,
  // L2→6 walls, L3→8 walls).
  const capacityAdd =
    s.kind === 'garrison' ? (s.level - 1) * 2 : bonus.capacityAdd;
  return {
    workRange: base.workRange + bonus.rangeAdd,
    workInterval: base.workInterval * bonus.intervalMult,
    maxHp: Math.floor(base.maxHp * bonus.maxHpMult),
    capacity: base.capacity + (base.capacity > 0 ? capacityAdd : 0),
    power: base.power + (base.power > 0 ? bonus.powerAdd : 0),
    hireCost: base.hireCost,
  };
}

export function nextUpgradeCost(s: Station, campfireLevel: number): number | null {
  if (s.level >= MAX_STATION_LEVEL) return null;
  const nextLevel = s.level + 1;
  // Station upgrades always gate on Campfire level — you can't reach L2 on a
  // station until the Campfire is L2, and same for L3.
  if (campfireLevel < nextLevel) return null;
  return STATION_LEVEL_BONUS[s.level].upgradeCost;
}

/** Returns the reason the next upgrade is blocked, or null when available. */
export function stationUpgradeBlockReason(
  s: Station,
  campfireLevel: number,
): string | null {
  if (s.level >= MAX_STATION_LEVEL) return null;
  const nextLevel = s.level + 1;
  if (campfireLevel < nextLevel) return `Needs Campfire L${nextLevel}`;
  return null;
}

function powerNoun(kind: StationKind): string {
  switch (kind) {
    case 'tower': return 'damage';
    case 'barracks':
    case 'garrison': return 'damage';
    case 'workshop': return 'repair';
    case 'gather':
    case 'farm': return 'coin';
    case 'wall': return 'power';
    case 'blacksmith': return 'power';
  }
}

/**
 * Returns a short comma-separated list of stat deltas for the next level.
 * e.g. "+1 damage · +30 range · 25% faster · +50% HP · +1 slot".
 */
export function describeNextUpgrade(s: Station): string {
  if (s.level >= MAX_STATION_LEVEL) return '';
  const base = STATION_STATS[s.kind];
  const now = STATION_LEVEL_BONUS[s.level - 1];
  const next = STATION_LEVEL_BONUS[s.level];
  const parts: string[] = [];

  const powerDelta = next.powerAdd - now.powerAdd;
  if (powerDelta > 0 && base.power > 0) {
    parts.push(`+${powerDelta} ${powerNoun(s.kind)}`);
  }

  if (base.workRange > 0) {
    const rangeDelta = next.rangeAdd - now.rangeAdd;
    if (rangeDelta > 0) parts.push(`+${rangeDelta}px range`);
  }

  if (base.workInterval > 0) {
    const speedPct = Math.round(((now.intervalMult - next.intervalMult) / now.intervalMult) * 100);
    if (speedPct > 0) parts.push(`${speedPct}% faster`);
  }

  const hpPct = Math.round(((next.maxHpMult - now.maxHpMult) / now.maxHpMult) * 100);
  if (hpPct > 0) parts.push(`+${hpPct}% HP`);

  if (base.capacity > 0) {
    const capDelta = next.capacityAdd - now.capacityAdd;
    if (capDelta > 0) parts.push(`+${capDelta} slot${capDelta > 1 ? 's' : ''}`);
  }

  return parts.join(' \u00B7 ');
}

export function applyStationLevelUp(s: Station) {
  if (s.level >= MAX_STATION_LEVEL) return;
  s.level += 1;
  s.upgradeProgress = 0;
  s.readyTimer = STATION_READY_DELAY;
  const eff = effectiveStats(s);
  s.maxHp = eff.maxHp;
  s.hp = s.maxHp;
}

export function hireAnchorOffset(kind: StationKind): { dx: number; dy: number } | null {
  switch (kind) {
    case 'tower': return { dx: 0, dy: 14 };
    case 'gather': return { dx: 0, dy: 14 };
    case 'workshop': return { dx: 0, dy: 16 };
    case 'barracks': return { dx: 0, dy: 16 };
    case 'garrison': return { dx: 0, dy: 16 };
    default: return null;
  }
}

export function upgradeAnchorOffset(kind: StationKind): { dx: number; dy: number } {
  switch (kind) {
    case 'tower': return { dx: 0, dy: -44 };
    case 'gather': return { dx: 0, dy: -28 };
    case 'workshop': return { dx: 0, dy: -38 };
    case 'barracks': return { dx: 0, dy: -34 };
    case 'garrison': return { dx: 0, dy: -34 };
    case 'wall': return { dx: 0, dy: -20 };
    case 'farm': return { dx: 0, dy: -24 };
    case 'blacksmith': return { dx: 0, dy: -38 };
  }
}
