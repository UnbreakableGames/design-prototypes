// Pure-data scoring. Tweak the weights here; everything else (leaderboard,
// end-screen breakdown) reads from this file.

export interface RunContext {
  /** Nights the player fully survived (campfire still alive when the night
   *  ended). Endless runs keep counting past 10. */
  nightsSurvived: number;
  villagersRescued: number;
  coinsSpent: number;
  /** Count of achievements unlocked *during this run* (not lifetime). */
  achievementsEarnedThisRun: number;
  /** Product of picked modifier multipliers. 1.0 if no modifiers. */
  modifierMultiplier: number;
}

export interface ScoreBreakdown {
  night: number;        // nights × 100
  rescue: number;       // rescued × 25
  spend: number;        // coinsSpent × 1
  achievement: number;  // achievements × 50
  endless: number;      // (nights - 10) × 250 if > 10, else 0
  base: number;         // sum of the above
  multiplier: number;   // modifierMultiplier
  total: number;        // floor(base × multiplier)
}

const NIGHT_WEIGHT = 100;
const RESCUE_WEIGHT = 25;
const SPEND_WEIGHT = 1;
const ACHIEVEMENT_WEIGHT = 50;
const ENDLESS_THRESHOLD = 10;
const ENDLESS_NIGHT_BONUS = 250;

export function computeScore(ctx: RunContext): ScoreBreakdown {
  const nights = Math.max(0, ctx.nightsSurvived);
  const night = nights * NIGHT_WEIGHT;
  const rescue = Math.max(0, ctx.villagersRescued) * RESCUE_WEIGHT;
  const spend = Math.max(0, ctx.coinsSpent) * SPEND_WEIGHT;
  const achievement = Math.max(0, ctx.achievementsEarnedThisRun) * ACHIEVEMENT_WEIGHT;
  const endless = Math.max(0, nights - ENDLESS_THRESHOLD) * ENDLESS_NIGHT_BONUS;
  const base = night + rescue + spend + achievement + endless;
  const multiplier = Math.max(0, ctx.modifierMultiplier);
  const total = Math.floor(base * multiplier);
  return { night, rescue, spend, achievement, endless, base, multiplier, total };
}

/**
 * Returns a compact string like "Night 850 · Rescue 100 · Spend 63 · × 1.44".
 * Useful for debug overlays and the end screen's "how the score was built"
 * line without duplicating the weight constants.
 */
export function formatBreakdown(b: ScoreBreakdown): string {
  const parts: string[] = [];
  if (b.night) parts.push(`Night ${b.night}`);
  if (b.rescue) parts.push(`Rescue ${b.rescue}`);
  if (b.spend) parts.push(`Spend ${b.spend}`);
  if (b.achievement) parts.push(`Ach ${b.achievement}`);
  if (b.endless) parts.push(`Endless ${b.endless}`);
  if (b.multiplier !== 1) parts.push(`× ${b.multiplier.toFixed(2)}`);
  return parts.join(' · ');
}
