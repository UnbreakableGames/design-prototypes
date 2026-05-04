// Achievements — one-off goals that persist across runs. The `check` callback
// on each entry is a pure function of an AchievementContext snapshot, so the
// evaluator never reaches into Game internals directly. Game builds the
// context and calls `evaluateAchievements` at milestone events and at run end.

import type { LifetimeStats } from './Persistence';

export interface AchievementDef {
  id: string;
  title: string;
  description: string;
  /** "run" achievements need `run.*` context; "lifetime" need `lifetime.*`. */
  scope: 'run' | 'lifetime';
  /** Displayed on the codex / achievements modal as the unlock hint when
   *  the achievement is still locked. Kept intentionally short. */
  hint: string;
  check: (ctx: AchievementContext) => boolean;
}

export interface RunSnapshot {
  night: number;                // current / final night number
  rescued: number;
  stationsBuilt: number;
  coinsSpent: number;
  coinsCollected: number;
  kills: number;
  won: boolean;                 // survived the win condition (10-night victory)
  lost: boolean;                // campfire died
  anyWallEverDied: boolean;
  diaryEntriesReadThisRun: number;
  poisDiscoveredThisRun: number;
  maxCoinAtAnyPoint: number;
  maxWorkersAtAnyPoint: number;
  maxCampfireLevel: number;
}

export interface AchievementContext {
  run: RunSnapshot;
  lifetime: LifetimeStats;
  /** codex id → unlocked timestamp map, used by the "Mystery Reader" check. */
  codex: Record<string, number>;
  /** Total codex entries that exist, so Mystery Reader can compare. */
  codexTotal: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  // --- run-scope ---
  {
    id: 'first_light',
    title: 'First Light',
    description: 'Survive one night.',
    scope: 'run',
    hint: 'Survive your first night.',
    check: (c) => c.run.night >= 2,
  },
  {
    id: 'eternal_flame',
    title: 'Eternal Flame',
    description: 'Win a ten-night run.',
    scope: 'run',
    hint: 'Win a ten-night run.',
    check: (c) => c.run.won,
  },
  {
    id: 'tidy_camp',
    title: 'Tidy Camp',
    description: 'Win without any wall ever being destroyed.',
    scope: 'run',
    hint: 'Win without losing a wall.',
    check: (c) => c.run.won && !c.run.anyWallEverDied,
  },
  {
    id: 'full_house',
    title: 'Full House',
    description: 'Have eight or more workers active at once.',
    scope: 'run',
    hint: 'Staff eight stations in one run.',
    check: (c) => c.run.maxWorkersAtAnyPoint >= 8,
  },
  {
    id: 'scholar',
    title: 'Scholar',
    description: 'Read every Scribe diary entry in one run.',
    scope: 'run',
    hint: 'Read every diary page in one run.',
    check: (c) => c.run.diaryEntriesReadThisRun >= 10,
  },
  {
    id: 'cartographer',
    title: 'Cartographer',
    description: 'Discover every point of interest in one run.',
    scope: 'run',
    hint: 'Discover every POI in one run.',
    // 8 POIs in the current world-gen layout (see entities/POI).
    check: (c) => c.run.poisDiscoveredThisRun >= 8,
  },
  {
    id: 'pauper',
    title: 'Pauper',
    description: 'Win a run having spent thirty coins or fewer.',
    scope: 'run',
    hint: 'Win while spending ≤30 coins.',
    check: (c) => c.run.won && c.run.coinsSpent <= 30,
  },
  {
    id: 'hoarder',
    title: 'Hoarder',
    description: 'End a run with 100 or more coins banked.',
    scope: 'run',
    hint: 'Finish a run holding ≥100 coins.',
    check: (c) => c.run.maxCoinAtAnyPoint >= 100,
  },
  {
    id: 'guardian',
    title: 'Guardian',
    description: 'Rescue five lost villagers in one run.',
    scope: 'run',
    hint: 'Rescue five villagers in one run.',
    check: (c) => c.run.rescued >= 5,
  },
  {
    id: 'elder',
    title: 'Elder',
    description: 'Reach night twenty in endless mode.',
    scope: 'run',
    hint: 'Reach night 20 in endless mode.',
    check: (c) => c.run.night >= 20,
  },

  // --- lifetime-scope ---
  {
    id: 'swordmaster',
    title: 'Swordmaster',
    description: 'Personally cut down fifty enemies across every run.',
    scope: 'lifetime',
    hint: 'Accumulate 50 hero kills across runs.',
    check: (c) => c.lifetime.totalKills >= 50,
  },
  {
    id: 'architect',
    title: 'Architect',
    description: 'Raise the campfire to Level 3.',
    scope: 'run',
    hint: 'Reach Campfire L3 in any run.',
    check: (c) => c.run.maxCampfireLevel >= 3,
  },
  {
    id: 'veteran',
    title: 'Veteran',
    description: 'Finish ten runs, however they end.',
    scope: 'lifetime',
    hint: 'Finish 10 runs.',
    check: (c) => c.lifetime.totalRunsPlayed >= 10,
  },
  {
    id: 'conqueror',
    title: 'Conqueror',
    description: 'Win three ten-night runs.',
    scope: 'lifetime',
    hint: 'Win 3 ten-night runs.',
    check: (c) => c.lifetime.totalRunsWon >= 3,
  },
  {
    id: 'mystery_reader',
    title: 'Mystery Reader',
    description: 'Unlock every entry in the Codex.',
    scope: 'lifetime',
    hint: 'Unlock every Codex entry.',
    check: (c) =>
      c.codexTotal > 0 && Object.keys(c.codex).length >= c.codexTotal,
  },
];

const ACHIEVEMENTS_BY_ID = new Map(
  ACHIEVEMENTS.map((a) => [a.id, a] as const),
);

export function achievementById(id: string): AchievementDef | undefined {
  return ACHIEVEMENTS_BY_ID.get(id);
}

/**
 * Walk every definition and return the ids that currently satisfy their
 * predicate AND are not already unlocked. Caller is responsible for
 * persisting the unlocks and surfacing parchment cards.
 */
export function evaluateAchievements(
  ctx: AchievementContext,
  alreadyUnlocked: Record<string, number>,
): string[] {
  const out: string[] = [];
  for (const def of ACHIEVEMENTS) {
    if (alreadyUnlocked[def.id]) continue;
    if (def.check(ctx)) out.push(def.id);
  }
  return out;
}
