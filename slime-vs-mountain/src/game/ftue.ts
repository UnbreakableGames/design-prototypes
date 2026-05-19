// First-Time User Experience — six-step onboarding that points a bouncing
// arrow at whichever UI element the player needs to interact with next.
//
// Step semantics (1-indexed; 0 = complete, -1 = disabled/skipped):
//   1  ASSIGN_SPITTER  — bench has a starter bee, lone spitter slot is empty.
//                        Advances when spitterSlots.length >= 1.
//   2  PICKUP_GOLD     — wait for the avatar to magnet-in a piece of loot.
//                        Advances when player.carried.length > 0.
//   3  RETURN_GOLD     — wait for the dropoff deposit (gold goes up).
//                        Advances when inventory.gold > snapshot AND
//                        player.carried.length === 0.
//   4  OPEN_TREE       — wait for the player to buy `runnerUnlock`.
//                        Advances when that perk is in unlockedPerks.
//   5  ROLL            — wait for the player to complete one roll.
//                        Advances when totalTimesRolled() rises.
//   6  ASSIGN_RUNNER   — wait for the newly-rolled bee to be slotted as
//                        a runner. Advances to 0 (done) when
//                        runnerSlots.length >= 1.
//
// Detection is snapshot-based: when a step starts we record the relevant
// counter (gold/rolls) so the *next* state diff is unambiguous.

export type FtueStep = number; // 1..6 active, 0 done, -1 skipped

export interface FtueSnapshot {
  step: FtueStep;
  /** Inventory.gold at the moment the current step started — used by step 3
   *  to detect a dropoff deposit. */
  goldAtStepStart: number;
  /** Total times rolled (sum of variant.timesRolled) at step start — step 5
   *  advances when this rises. */
  rollsAtStepStart: number;
}

export function newFtue(): FtueSnapshot {
  return { step: 1, goldAtStepStart: 0, rollsAtStepStart: 0 };
}
