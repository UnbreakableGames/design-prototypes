// Run modifiers ("curses"). Pure-data. Each modifier contributes to a shared
// CombinedEffects object that the Game reads at specific hook points — no
// modifier reaches into Game internals directly, so adding a new modifier is a
// one-entry change in the MODIFIERS table below.

export type ModifierId =
  | 'brittle_walls'
  | 'cold_embers'
  | 'no_arrows'
  | 'tight_purse'
  | 'lean_ranks'
  | 'the_whispers'
  | 'forgotten_scribe';

export interface ModifierDef {
  id: ModifierId;
  label: string;
  description: string;
  scoreMultiplier: number;
  effects: Partial<CombinedEffects>;
}

/**
 * Everything the rest of the game needs to read at runtime. Multipliers
 * default to 1 (no-op), additive deltas default to 0, flags default to false.
 */
export interface CombinedEffects {
  wallHpMult: number;
  towerDamageMult: number;
  lightRadiusMult: number;
  costMult: number;
  startingRecruitDelta: number;
  portalDefendCooldownMult: number;
  disableDiaryAndShop: boolean;
}

export function emptyEffects(): CombinedEffects {
  return {
    wallHpMult: 1,
    towerDamageMult: 1,
    lightRadiusMult: 1,
    costMult: 1,
    startingRecruitDelta: 0,
    portalDefendCooldownMult: 1,
    disableDiaryAndShop: false,
  };
}

export const MODIFIERS: ModifierDef[] = [
  {
    id: 'brittle_walls',
    label: 'Brittle Walls',
    description: 'Walls have 50% HP.',
    scoreMultiplier: 1.2,
    effects: { wallHpMult: 0.5 },
  },
  {
    id: 'cold_embers',
    label: 'Cold Embers',
    description: 'Campfire light radius reduced by 25%.',
    scoreMultiplier: 1.15,
    effects: { lightRadiusMult: 0.75 },
  },
  {
    id: 'no_arrows',
    label: 'No Arrows',
    description: 'Watchtowers deal no damage.',
    scoreMultiplier: 1.4,
    effects: { towerDamageMult: 0 },
  },
  {
    id: 'tight_purse',
    label: 'Tight Purse',
    description: 'All build, hire, and upgrade costs +25%.',
    scoreMultiplier: 1.2,
    effects: { costMult: 1.25 },
  },
  {
    id: 'lean_ranks',
    label: 'Lean Ranks',
    description: 'Start with two fewer villagers.',
    scoreMultiplier: 1.15,
    effects: { startingRecruitDelta: -2 },
  },
  {
    id: 'the_whispers',
    label: 'The Whispers',
    description: 'Portals spawn defenders 50% more often.',
    scoreMultiplier: 1.25,
    effects: { portalDefendCooldownMult: 0.5 },
  },
  {
    id: 'forgotten_scribe',
    label: 'Forgotten Scribe',
    description: 'No dawn diary, no upgrade shop.',
    scoreMultiplier: 1.1,
    effects: { disableDiaryAndShop: true },
  },
];

const MODIFIERS_BY_ID = new Map(MODIFIERS.map((m) => [m.id, m] as const));

export function modifierById(id: ModifierId): ModifierDef | undefined {
  return MODIFIERS_BY_ID.get(id);
}

/**
 * Combine a list of picked modifiers into a single effects object. Order
 * doesn't matter — multipliers compose via product, deltas via sum, booleans
 * via OR.
 */
export function combineEffects(ids: ModifierId[]): CombinedEffects {
  const out = emptyEffects();
  for (const id of ids) {
    const def = modifierById(id);
    if (!def) continue;
    const e = def.effects;
    if (e.wallHpMult != null) out.wallHpMult *= e.wallHpMult;
    if (e.towerDamageMult != null) out.towerDamageMult *= e.towerDamageMult;
    if (e.lightRadiusMult != null) out.lightRadiusMult *= e.lightRadiusMult;
    if (e.costMult != null) out.costMult *= e.costMult;
    if (e.startingRecruitDelta != null) out.startingRecruitDelta += e.startingRecruitDelta;
    if (e.portalDefendCooldownMult != null) out.portalDefendCooldownMult *= e.portalDefendCooldownMult;
    if (e.disableDiaryAndShop) out.disableDiaryAndShop = true;
  }
  return out;
}

/** Product of every picked modifier's scoreMultiplier, 1.0 if none picked. */
export function combinedScoreMultiplier(ids: ModifierId[]): number {
  let m = 1;
  for (const id of ids) {
    const def = modifierById(id);
    if (def) m *= def.scoreMultiplier;
  }
  return m;
}
