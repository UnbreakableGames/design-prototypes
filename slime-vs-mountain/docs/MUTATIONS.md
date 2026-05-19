# Slime Mutations — Archived Design Notes

Status: **archived 2026-05-18**. The mutation system was implemented end-to-end
(roll mechanic, UI, skill tree, visual treatments) and then stripped from the
active codebase so the prototype could focus on the base 30-variant roster.
This document captures the design + implementation so we can re-introduce it
cleanly later. To restore, walk the git history around this date and pull the
pieces back in.

---

## Concept

Slime RNG's secondary-axis rarity layer: every rolled slime is one of N mutation
tiers. Each tier is rarer and multiplies the slime's stats. A "Big Greenie" is
the same variant as a base Greenie but does 2.5× more damage and is 100× rarer
to roll. Mutations stack with our existing rarity ladder (common → legendary)
to create a 2D rarity grid: 30 variants × 5 mutation tiers = 150 distinct
collectibles.

## Tier table

| Mutation | Stat × | Rarity ÷ | Visual treatment |
|---|---|---|---|
| `none` (base) | 1.0 | 1 | unchanged |
| `big` | 2.5 | 1-in-100 | 1.25× scale, green aura + outline |
| `shiny` | 3.0 | 1-in-250 | 1.05× scale, golden aura + 3 white sparkle dots |
| `huge` | 6.0 | 1-in-1000 | 1.5× scale, purple aura + 5 purple sparkles |
| `inverted` | 5.0 | 1-in-2500 | 1.1× scale, color-inverted body + pink aura |

Stat × applies to both `variant.damage` (for spitters) and `variant.carryCapacity`
(for runners). Combined with level multiplier: `effective = base × levelMul × statMul`.

## Roll mechanic

```ts
export function rollMutation(allowed: Set<Mutation>): Mutation {
  if (allowed.has('inverted') && Math.random() < 1/2500) return 'inverted';
  if (allowed.has('huge')     && Math.random() < 1/1000) return 'huge';
  if (allowed.has('shiny')    && Math.random() < 1/250)  return 'shiny';
  if (allowed.has('big')      && Math.random() < 1/100)  return 'big';
  return 'none';
}
```

Each tier is rolled independently (rarest checked first). Rarer tiers mask
commoner ones — if Huge clears, you get Huge, not also Big.

Mutations are NOT affected by player luck — only the variant base rarity is.
(Could be revisited.)

## Skill tree integration

Two-column dice cluster south of `autoSpin` (q=-1 column unlocks, q=-2 column
consumable dice). Each mutation tier had:

- **Unlock perk** (permanent, gold + gems): `bigUnlock` / `shinyUnlock` / `hugeUnlock` / `invertedUnlock`. Gates the mutation from rolling naturally.
- **Dice consumable** (repeatable, rolls cost): `bigDice` (8 rolls) / `shinyDice` (25) / `hugeDice` (80) / `invertedDice` (200). Forces the next roll to that mutation.

Costs (gold + gems):
- `bigUnlock`: 500g / 50 gems
- `shinyUnlock`: 2000g / 200 gems
- `hugeUnlock`: 8000g / 800 gems
- `invertedUnlock`: 25000g / 2500 gems

The dice nodes used `requiresPerk: 'xxxUnlock'` to enforce the unlock prereq
(adjacency alone wasn't enough because shinyDice was also adjacent to bigUnlock
through hex neighbors).

Hex positions:
- `quickRoll` (-1, +2) — entry from `autoSpin`
- `bigUnlock` (-1, +3) / `bigDice` (-2, +3)
- `shinyUnlock` (-1, +4) / `shinyDice` (-2, +4)
- `hugeUnlock` (-1, +5) / `hugeDice` (-2, +5)
- `invertedUnlock` (-1, +6) / `invertedDice` (-2, +6)

## Data model

### `VariantState` additions

```ts
interface VariantState {
  variantId: SlimeVariantId;
  count: number;                            // total across all mutations
  mutations: Record<Mutation, number>;       // per-tier counts; sum = count
  timesRolled: number;
  slotted: number;
  slottedMutations: Record<Mutation, number>; // per-tier in slots; sum = slotted
  level: number;                            // shared across mutations
  xp: number;
}
```

Sharing `level` across mutations meant XP fed to one copy benefitted all
mutations of the same variant. A Lv 5 Big Greenie used the same level as the
player's Lv 5 base Greenie.

### Slot lists

Slot state was `SlimeVariantId[]` + parallel `Mutation[]` arrays (one per slot
type: `spitterMutations`, `runnerMutations`). `rebuildActiveSlimes()` compared
both variantId AND mutation to decide whether to preserve an existing Slime
entity or spawn a fresh one.

### Slime entity

```ts
class Slime {
  slimeId: number;
  variant: SlimeVariant;
  mutation: Mutation;       // NEW
  slotType: SlotType;
  slotIndex: number;
  // ...
}
```

Slot picking (`assignToSlot`) auto-promoted to the rarest available unslotted
mutation via `bestAvailableMutation(variantId)` so the player didn't manage
individual copies — system always slotted their strongest.

## Visual treatment (Slime.ts render)

```ts
const mut = MUTATIONS[this.mutation];
const mutScale = mutationScale(this.mutation);
const w = v.size * mutScale * (1 + sq * 0.4);
const bodyColor = this.mutation === 'inverted' ? invertHex(v.body) : v.body;

// Aura under body
if (this.mutation !== 'none') {
  const aura = ctx.createRadialGradient(cx, baseY - h/2, 0, cx, baseY - h/2, w + 14);
  aura.addColorStop(0, hexWithAlpha(mut.color, 0.55));
  aura.addColorStop(1, hexWithAlpha(mut.color, 0));
  // ...
}

// Body outline in tier color
if (this.mutation !== 'none') {
  ctx.strokeStyle = mut.color;
  ctx.lineWidth = 2;
  // (re-draw body path + stroke)
}

// Sparkle dots for shiny/huge
if (this.mutation === 'shiny' || this.mutation === 'huge') {
  const dots = this.mutation === 'huge' ? 5 : 3;
  // rotating dots around the body
}
```

Helpers:
- `mutationScale(m)`: `{none: 1, big: 1.25, shiny: 1.05, huge: 1.5, inverted: 1.1}`
- `invertHex(hex)`: returns `rgb(255-r, 255-g, 255-b)` for inverted-color bodies
- `hexWithAlpha(hex, a)`: combines a `#rrggbb` color with alpha for gradients

## UI integration

### Detail card (HUD)

- Mutation pills row below stats: `BIG ×2`, `SHN ×1`, `HUGE ×1` colored to tier
- Displayed `dmg` / `cap` used the player's BEST owned mutation × level so the
  tooltip reflected their strongest copy: `damage × levelMul × bestMutMul`

### Collection cells (HUD)

- Colored dots in the upper-middle, one per non-base mutation owned (color =
  tier color). At-a-glance signal that "this variant has mutated copies".

### Index overlay (IndexView)

- 5-tab strip across the top: BASE / BIG / SHINY / HUGE / INVERTED
- Each tab filtered the grid to show only variants the player owned at that tier
- Per-tab discovery count (`12 / 30`) and milestones tied to BASE only
- Mutation tabs showed `1-in-N natural odds · ×M stats` subtitle

### Toast

- `acquireSlime(id, mutation)` fired a toast like `Huge Greenie rolled!` when
  mutation !== 'none' so the player got celebration feedback on rare drops.

## `equipBest` integration

Picks now flattened into `(variantId, mutation)` pairs, scored by
`damage × levelMul × mutationStatMul`. So a Huge Greenie outranked a base
Greenie of the same level for slot priority.

## Save format

```ts
{
  v: 2,
  collection: VariantState[],          // includes mutations + slottedMutations maps
  spitterSlots: SlimeVariantId[],
  spitterMutations: Mutation[],         // parallel array
  runnerSlots: SlimeVariantId[],
  runnerMutations: Mutation[],
  forcedMutation: Mutation | null,      // armed by dice consumable
  // ...
}
```

Back-compat: pre-mutation saves loaded by defaulting `mutations.none = count`
and `spitterMutations = spitterSlots.map(() => 'none')`.

## Re-introduction checklist

When bringing this back, in order:

1. Re-add the type + helpers to `types.ts` (`Mutation`, `MUTATIONS`, `MUTATION_ORDER`, `rollMutation`)
2. Extend `VariantState` with `mutations` + `slottedMutations` maps + bump save version
3. Add `mutation` field to Slime entity + update constructor + visual treatments
4. Wire `Game.spin` to call `rollMutation(allowedMutations())` per slime + thread mutations through `PendingSpawn`
5. Add parallel `spitterMutations` / `runnerMutations` arrays + update `assignToSlot` / `removeFromSlot` / `rebuildActiveSlimes` / `equipBest`
6. Multiply combat stats by `MUTATIONS[s.mutation].statMul` in the tick loop
7. Re-add the dice tree cluster + Unlock perks (use `requiresPerk` to gate dice on unlocks)
8. Restore HUD mutation pills + collection-cell dots
9. Re-add Index per-mutation tabs with `indexTabAt()` hit-test
10. Save/load: serialize `mutations` / `slottedMutations` / `spitterMutations` / `runnerMutations` / `forcedMutation`

## Open design questions worth revisiting

- Should mutations be affected by luck? Currently independent.
- Should mutation level be tracked separately, so a Lv 1 Big Greenie isn't auto-promoted to Lv 10 because its base copy was fed XP?
- Should the in-world slime show the rarest OWNED mutation, or specifically the SLOTTED copy's mutation? (We did slotted's, which felt right.)
- Should the player be able to manually choose which mutation to slot, or always auto-best? (We auto-bested.)
- Stellar/Galactic tiers in the rarity ladder were reserved for future mutation tiers but not populated.
