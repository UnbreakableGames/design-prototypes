import {
  RARITIES,
  SLIME_VARIANTS,
  VARIANTS_BY_RARITY,
  type Rarity,
  type SlimeVariantId,
  type VariantState,
} from '../game/types';

/** How many bench dupes of a variant are required to fuse them into a single
 *  random variant of the NEXT rarity tier. Top tier (`stellar`) is unfusable.
 *
 *  The counts taper as rarities grow rarer so the player can still afford
 *  high-tier fusions even though dupes there are vanishingly rare. */
export const FUSION_INPUT_COUNT: Record<Rarity, number> = {
  common:       5,
  uncommon:     5,
  rare:         4,
  epic:         4,
  legendary:    3,
  mythic:       3,
  divine:       3,
  prismatic:    3,
  transcendent: 2,
  ethereal:     2,
  secret:       2,
  celestial:    2,
  astral:       2,
  nova:         2,
  solar:        2,
  lunar:        2,
  galactic:     2,
  stellar:      Infinity, // top of the ladder — no fusion target
};

/** Rarity one step up the ladder, or `null` for the top tier. */
export function nextRarity(rarity: Rarity): Rarity | null {
  const idx = RARITIES.indexOf(rarity);
  if (idx < 0 || idx >= RARITIES.length - 1) return null;
  return RARITIES[idx + 1]!;
}

/** True when the player has enough bench dupes of `variantId` to perform a
 *  fusion. Slotted copies don't count — fusion only consumes from the bench
 *  so the player never accidentally yanks a working spitter/runner. */
export function canFuse(state: VariantState | undefined, variantId: SlimeVariantId): boolean {
  if (!state) return false;
  const rarity = SLIME_VARIANTS[variantId].rarity;
  if (!nextRarity(rarity)) return false;
  const need = FUSION_INPUT_COUNT[rarity];
  if (!Number.isFinite(need)) return false;
  const bench = state.count - state.slotted;
  return bench >= need;
}

/** Pick a random variant id in the given rarity tier. Uniform pick — fusion
 *  is RNG within the target tier so the player can't snipe a specific bee. */
export function rollFusionOutput(targetRarity: Rarity): SlimeVariantId | null {
  const pool = VARIANTS_BY_RARITY[targetRarity];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
