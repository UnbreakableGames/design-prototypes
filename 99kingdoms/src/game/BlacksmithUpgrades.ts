// The forge's three persistent troop-upgrade tracks. Each track has 3
// tiers; tiers compound (Tier II includes Tier I, Tier III includes both).
// Effects are read at attack-time by the relevant station handler:
//   archer  → updateArcher  (towers)
//   soldier → updateKnight  (barracks — yes, the function is misnamed)
//   knight  → updateGuard   (garrison wall guards)
//
// Tiers are now earned by claiming themed POIs in the world. There is no
// more coin payment at the blacksmith for these — see `claimPOI` in
// `Game.ts` for the unlock flow.

export type ForgeTrack = 'archer' | 'soldier' | 'knight';

export type ForgeTier = 0 | 1 | 2 | 3;

export interface ForgeTierSpec {
  /** Tier index, 1..3. */
  tier: 1 | 2 | 3;
  /** Display name shown in the unlock card. */
  name: string;
  /** Short blurb shown beneath. */
  blurb: string;
}

export interface ForgeTrackSpec {
  id: ForgeTrack;
  /** "Archers" / "Soldiers" / "Knights" — what the track upgrades. */
  label: string;
  /** Inline noun used in flavor text ("the bowstrings", "the blades",
   *  "the plates"). */
  noun: string;
  tiers: [ForgeTierSpec, ForgeTierSpec, ForgeTierSpec];
}

export const FORGE_TRACKS: Record<ForgeTrack, ForgeTrackSpec> = {
  archer: {
    id: 'archer',
    label: 'Archers',
    noun: 'the bowstrings',
    tiers: [
      { tier: 1, name: 'Hardened arrowheads',  blurb: '+1 arrow damage' },
      { tier: 2, name: 'Drilled volleys',      blurb: '+1 more dmg · 20% faster fire' },
      { tier: 3, name: 'Pierce-tipped shafts', blurb: 'Arrows pierce one enemy' },
    ],
  },
  // The 'soldier' internal track id now upgrades the chasing
  // patrol troops (Knights — barracks-kind workers). The label,
  // noun, and tier names were all flipped during the station rename
  // pass to match. The internal id stays for save-state compatibility.
  soldier: {
    id: 'soldier',
    label: 'Knights',
    noun: 'the lances',
    tiers: [
      { tier: 1, name: 'Sharpened lances',  blurb: '+1 melee damage' },
      { tier: 2, name: 'Charging reach',    blurb: '+1 more dmg · +25% range' },
      { tier: 3, name: 'Whirlwind charge',  blurb: 'Cleave: hits 2 enemies per swing' },
    ],
  },
  // The 'knight' internal track id now upgrades the wall-defending
  // formation troops (Soldiers — garrison-kind workers). Flowed
  // labels through the same rename. Tier mechanics unchanged.
  knight: {
    id: 'knight',
    label: 'Soldiers',
    noun: 'the shields',
    tiers: [
      { tier: 1, name: 'Locked shields',  blurb: 'Defended walls take 33% less damage' },
      { tier: 2, name: 'Wall vigil',      blurb: 'Defended walls regenerate 1 HP/s' },
      { tier: 3, name: 'Pike formation',  blurb: 'Defended walls absorb 1 dmg per hit' },
    ],
  },
};

/** Per-run forge state. Each tier is 0..3; 0 means "not yet earned". */
export interface ForgeState {
  archerTier: ForgeTier;
  soldierTier: ForgeTier;
  knightTier: ForgeTier;
}

export function createForgeState(): ForgeState {
  return { archerTier: 0, soldierTier: 0, knightTier: 0 };
}

export function tierOf(state: ForgeState, track: ForgeTrack): ForgeTier {
  if (track === 'archer') return state.archerTier;
  if (track === 'soldier') return state.soldierTier;
  return state.knightTier;
}

/** Advance the given track by exactly one tier. Returns the new tier
 *  (1, 2, or 3) on success, or null if the track is already maxed. */
export function advanceTrackOneTier(
  state: ForgeState,
  track: ForgeTrack,
): 1 | 2 | 3 | null {
  const current = tierOf(state, track);
  if (current >= 3) return null;
  const next = (current + 1) as 1 | 2 | 3;
  if (track === 'archer') state.archerTier = next;
  else if (track === 'soldier') state.soldierTier = next;
  else state.knightTier = next;
  return next;
}

/** Whether the player has unlocked any tier on any track. Used by the
 *  blacksmith UI to decide whether to render the chevron status (we
 *  hide it until first unlock so it doesn't tip off the mechanic). */
export function anyTierUnlocked(state: ForgeState): boolean {
  return state.archerTier > 0 || state.soldierTier > 0 || state.knightTier > 0;
}

// ── Track effects, read at attack-time ─────────────────────────────────

export function archerDamageBonus(t: ForgeTier): number {
  return t >= 2 ? 2 : t >= 1 ? 1 : 0;
}
export function archerFireRateMult(t: ForgeTier): number {
  return t >= 2 ? 0.8 : 1.0;
}
export function archerArrowsPierce(t: ForgeTier): boolean {
  return t >= 3;
}

export function soldierDamageBonus(t: ForgeTier): number {
  return t >= 2 ? 2 : t >= 1 ? 1 : 0;
}
export function soldierRangeMult(t: ForgeTier): number {
  return t >= 2 ? 1.25 : 1.0;
}
export function soldierCleaves(t: ForgeTier): boolean {
  return t >= 3;
}

export function knightRegenPerSec(t: ForgeTier): number {
  return t >= 2 ? 1.0 : 0;
}
export function knightArmor(t: ForgeTier): number {
  return t >= 3 ? 1 : 0;
}
