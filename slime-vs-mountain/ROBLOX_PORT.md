# Bee Battles RNG — Roblox Port Design

This document specifies the design and mechanics of **Bee Battles RNG** (working title; internal code name *slime-vs-mountain*) so another developer / Claude Code instance can rebuild it in Roblox as a **3D third-person experience** (not a side-scroller).

The TypeScript prototype at `slime-vs-mountain/src/` is the source of truth for tuned numbers, balance curves, and edge-case behavior. When in doubt, cross-reference that code. This doc is opinionated about *what to keep* vs *what to reshape for 3D*.

---

## 1. High-Level Pitch

The player owns a hive. They roll a gacha "Bee Dice" to discover new bee variants (a *Sol's RNG*–style rarity ladder). Bees are slotted into one of two roles:

- **Spitters** stand near the tree and continuously fire projectiles at it.
- **Runners** fly between the tree and the hive carrying dropped loot (pollen + gems).

The tree drops loot when damaged. Loot pays for **skill-tree upgrades** (a hex-grid perk web with six branches) and feeds the **bag-of-bees milestone meter**. Killing a tree progresses through themed trees (Verdant → Amber → Blossom → Ember → Glacial → Resin → Shadow), each with its own boss, elemental weakness, and visual style. The player can **Rebirth** to convert run progress into permanent **Essence** spent on a separate honeycomb-shaped Essence tree.

The player avatar walks around (in 3D), shoots the tree, has a damage-type cycle (Physical / Burn / Frost / Storm), and emits a **Bee Aura** that buffs nearby spitters.

**Core fantasy**: A relaxing-but-numbers-go-up gacha-incremental. Watch your swarm chip away at the tree. Roll for legendary bees. Spec into the perk tree. Rebirth for power. Pick your next tree from a strip of unlocked types.

---

## 2. From Side-Scroller to 3D

The prototype is a 1280×600 canvas with the tree on the right edge and the player + hive on the left. The Roblox version replaces this with an arena and freer movement:

### Recommended arena layout

A roughly **80×80 stud** open arena with:

- **The Tree** in the center (or slightly off-center to leave room for the hive). Tall, takes up vertical space, with multiple hanging **honeycomb dens** (mines) and **goons** orbiting it.
- **The Hive** along one edge — the dropoff point. Visually a wooden box / honeycomb wall. Runners fly loot here; the player walks loot here. Acts as the "deposit pad."
- **Roll Dice Pedestal** near the hive — interact to spend the spin cooldown and reveal a new bee.
- **Skill Tree Stand**, **Essence Tree Stand**, **Settings Stand** — interactable objects that open the corresponding fullscreen GUIs.
- **Bag of Bees Display** — a giant honeycomb counter on a wall showing milestone progress (see §11).

Camera: **classic third-person**, free orbit, slight zoom-out so the whole tree is visible. Do not force top-down.

### Where bees live in 3D

- **Spitter slots**: a horizontal ring of small platforms ~12 studs in front of the tree, evenly spaced. Each slot is a fixed spawn point where a Slime model hovers (~3 studs above ground) and fires at the tree.
- **Runner slots**: bees fly in a free-form path between the tree's loot-drop zone and the hive. They have a flight altitude band of ~2-6 studs and a max horizontal speed.
- **Player walk speed**: scales with the `playerSpeed1/2/3` perks (see §13).

### Mouse/touch interactions

- **Click / tap the tree** → player shoots (same as the side-scroller's mountain-click). Hit point is the impact location on the tree's hitbox.
- **Click / tap a goon** → if `shootUnlock` and the goon is in range, target it directly.
- **Click / tap a roll pedestal** → trigger spin.
- **WASD / virtual joystick** → standard movement.

---

## 3. Tech Stack & Service Layout

```
ReplicatedStorage/
  Shared/                        -- modules used by both client + server
    Data/
      BeeVariants.lua            -- all 50+ variants, rarities, stats
      MountainThemes.lua         -- 7 themes (Verdant…Shadow) with TreeArt
      SkillTree.lua              -- hex-coord perk graph
      EssenceTree.lua            -- honeycomb-coord essence graph
      Milestones.lua             -- 100 bag thresholds (10 * 1.6^i)
      Bosses.lua                 -- BossConfig per theme
      Shop.lua                   -- robux/gem shop items
      Constants.lua              -- BASE_HP, BOSS_WEAKNESS_MUL, etc.
    Lib/
      RarityRoller.lua           -- luck-weighted RNG
      HexGrid.lua                -- axial coord math for skill/essence trees
      DamageMath.lua             -- crit, antiGoon, aura, weakness multipliers
  Remotes/
    SpinRollRemote               -- RemoteEvent
    UnlockPerkRemote             -- RemoteFunction (returns success/err)
    UnlockEssenceRemote          -- RemoteFunction
    SetSlotRemote                -- RemoteEvent (place bee in slot)
    CycleDmgTypeRemote           -- RemoteEvent
    ChooseNextThemeRemote        -- RemoteEvent
    BuyShopItemRemote            -- RemoteFunction
    RebirthRemote                -- RemoteFunction

ServerScriptService/
  PlayerProfile.lua              -- ProfileService-style locking + load/save
  HiveServer.lua                 -- per-player hive state, ticks the run
  CombatServer.lua               -- damage application, loot rolls
  MountainServer.lua             -- tree HP, theme advance, boss spawns
  RollServer.lua                 -- authoritative gacha
  PerkServer.lua                 -- skill tree validation + spend
  ShopServer.lua                 -- robux/gems → benefits

StarterPlayer/StarterPlayerScripts/
  CameraController.lua
  HUDController.lua              -- inventory + dmg-type chip + theme picker
  RollOverlay.lua
  SkillTreeOverlay.lua
  EssenceTreeOverlay.lua
  IndexOverlay.lua               -- bag-of-bees collection grid + milestones
  DiscoveryRevealController.lua  -- new-bee reveal animation
  FtueController.lua             -- guided onboarding
  AutoplayController.lua         -- 'A' to autoplay (debug-style sim)

StarterGui/                      -- prebuilt UI roots, scripts disabled
  HUD/...
  Overlays/...
```

**Server is authoritative** for: gacha rolls, currency spend, perk unlocks, damage application, theme advance, rebirth, save state. Client never trusts its own inventory.

**Networking**:
- Replicate currency, perks, slot loadouts, mountain HP, active bees, and loot via `Folder`/`Attribute` or a state replicator like `Reflex` / `Knit`.
- Per-player hive state lives in a server-side table keyed by `UserId`.

---

## 4. Per-Player State Shape

Mirror the prototype's `Game.save()` output. Save via `DataStoreService` with `ProfileService`-style session locking.

```lua
-- ProfileTemplate
{
  v = 4,                                   -- SAVE_VERSION (see §16)
  inv = { gold = 0, gems = 0, luck = 5, rolls = 0, essence = 0 },

  collection = {                           -- list of VariantState
    [1] = { variantId = "green", count = 3, timesRolled = 7, level = 2, xp = 45 },
    ...
  },
  spitterSlots = { "green", "yellow" },    -- ordered list of variantIds occupying slots
  runnerSlots = { "yellow" },

  unlockedPerks = { "foundation" = true, "shootUnlock" = true, ... },   -- set
  essenceUnlocked = { "honeyDrop" = true, ... },
  claimedMilestones = { 10, 50, 200 },
  pendingMilestones = { 1000 },            -- earned but not yet claimed
  bagProgress = 234,                       -- INDEX_MILESTONES progress counter

  ownedShopItems = { "starterPack" = true },
  boosts = { serverLuck = 0, serverCoins = 0, luckySpinsLeft = 0 },

  rebirthBoostCharges = 0,
  quickRollChargesLeft = 0,
  pendingEssence = 0,

  ftue = { step = 0, goldAtStepStart = 0, rollsAtStepStart = 0 },
  ftueRebirthStep = 0,

  runGoldEarned = 0,
  runMountainsKilled = 0,
  totalMountainsKilled = 0,
  totalRebirths = 0,
  lifetimeSpins = 0,

  themesUnlocked = 1,                      -- 1..7 — purchased with run gold
  chosenNextTheme = nil,                   -- optional theme index override
  mountainLevel = 0,                       -- monotonically increasing
  mountainCycle = 0,                       -- floor(level / 7)
  mountainHp = 600,

  playerDmgTypeIdx = 0,                    -- cycles Physical/Burn/Frost/Storm
  autoRoll = false,
}
```

**Save cadence**: server-side, debounced ~10s, plus on rebirth / shop purchase / overlay close, plus `PlayerRemoving`. Use `UpdateAsync` not `SetAsync`.

---

## 5. Bee Variants (Gacha Roster)

Source: `slime-vs-mountain/src/game/types.ts` → `SLIME_VARIANTS` (≈50 entries spanning Common → Lunar).

### VariantSpec shape

```lua
{
  id            = "green",      -- string key
  name          = "Green",
  rarity        = "common",     -- common/uncommon/rare/epic/legendary/mythic/divine/prismatic/secret/astral/solar/lunar
  rollN         = 1,            -- 1-in-N base odds at luck=0
  body          = "#3f9038",    -- main body Color3 (parse from hex)
  belly         = "#2a6024",
  size          = 22,           -- base scale (visually applied to model)
  damage        = 1,            -- per shot, pre-multipliers
  fireRate      = 1.0,          -- shots per second
  projectileSpeed = 360,
  xpValue       = 60,           -- XP fed to a slime of this variant when fed food
  rollMul       = 1,            -- runner carry multiplier when in runner role
  dropoffTime   = 0.55,
  walkSpeed     = 0.45,         -- runner movement speed
  projectile    = "bullet",     -- bullet | spear | ricochet | mortar | pinball | lazer | orbiter | driller
  damageType    = "physical",   -- physical/burn/frost/lightning/void
  antiGoon      = false,        -- 2× damage vs goons/mines/bosses
  critChance    = 0,            -- 0..1
  runnerAbility = nil,          -- "magnet" | "sorter" | nil
}
```

The exact roster is large — bring it over wholesale from `types.ts` and store it as a `ModuleScript` returning a table keyed by id.

### Projectile kinds

Each projectile kind has its own arc / behavior. Reproduce these in 3D — they all aim at a point on the tree's hitbox.

| Kind        | Behavior                                                                       |
|-------------|--------------------------------------------------------------------------------|
| `bullet`    | Parabolic arc (gravity ~240 studs/s²), single hit.                             |
| `spear`     | Straight-line, single hit, faster.                                             |
| `lazer`     | Straight-line beam, instant or near-instant.                                   |
| `ricochet`  | Bounces between tree → goon → tree. Up to 2 bounces.                           |
| `mortar`    | High arc, slow, splash on impact (radius ~6 studs).                            |
| `pinball`   | Bounces between goons multiple times, then expires.                            |
| `orbiter`   | Circles the bee briefly, then fires.                                           |
| `driller`   | Pierces — keeps going after a hit, dealing reduced damage to next target.      |

### Rarity → Roll odds

Luck-weighted: a variant with `rollN = 500` lands at base 1-in-500. Player luck (perks + Essence Fortune + milestones) lowers `rollN` effectively (see `RarityRoller.lua` translation of `effectiveLuck()`). Higher rarities use larger `rollN`. Cap divides for prismatic/secret tiers.

Always apply rarity floors (`luxurySpin` = ≥Uncommon floor, `royalSpin` = ≥Rare floor).

---

## 6. The Tree (Mountain) System

In the prototype, the "mountain" is actually a 2D tree. The Roblox port should be an explicit 3D tree model. Use Mesh + Decals or a procedural part stack.

### Per-theme art recipe

Each theme defines a `TreeArt` table — keep these from `types.ts` → `MOUNTAIN_THEMES[i].treeArt`:

```lua
TreeArt = {
  canopyBack   = Color3,    -- deepest leaf cluster
  canopyMid    = Color3,
  canopyHi     = Color3,    -- highlight pop
  trunkBody    = Color3,
  trunkBark    = Color3,
  flowerPalette = { Color3, ... },   -- decorative dots
  flowerCore   = Color3,
  hitGlow      = Color3,
  accent       = "none" | "honeyDrips" | "embers" | "icicles" | "resinDrips" | "shadowGlints",
  accentColor  = Color3,
}
```

In 3D, the canopy is a set of overlapping spheres or a single mesh tinted with these colors. The accent is small attached MeshParts or `ParticleEmitter` instances:

- **honeyDrips / resinDrips** — `Beam`s or stretched-pill MeshParts under the canopy.
- **embers** — `ParticleEmitter` looping warm-color particles.
- **icicles** — small cone MeshParts hanging from the canopy underside.
- **shadowGlints** — small `PointLight` flickers tinted with `accentColor`.

### Theme list (in order)

1. **Verdant** — `hpMul = 0.25`, maxGoons 3. *Tutorial-friendly.*
2. **Amber** — `hpMul = 0.4`, golden honey, drips accent, weak to Frost shots.
3. **Blossom** — `hpMul = 1.6`, pink canopy, no accent.
4. **Ember** — `hpMul = 1.8`, red, ember particles, weak to Frost.
5. **Glacial** — `hpMul = 2.0`, blue, icicle accent, weak to Burn.
6. **Resin** — `hpMul = 2.2`, purple, resin drips, no elemental weak.
7. **Shadow** — `hpMul = 2.5`, near-black, violet glints, weak to Storm/Lightning.

Effective HP per spawn = `BASE_HP * theme.hpMul * 2^cycle` (`BASE_HP = 2400`).

### First-tree override

The **very first tree** (`totalMountainsKilled == 0`) is hard-capped: HP forced low and `maxGoons = 0`. This is critical so the brand-new player blows through the tutorial. The Verdant theme stays normal for subsequent runs.

### Death sequence

When `hp <= 0`:
1. Tree enters `falling` phase — sinks into the ground over ~1.4s with an ease-in tween.
2. Brief delay, then `rising` phase — new tree (next theme) emerges over ~1.0s with ease-out.
3. While in `falling`/`rising`, **no goons spawn**, **no projectiles can hit**, **HP bar hidden**.

In Roblox use `TweenService` on the tree model's `CFrame.Y` offset. Don't despawn the tree — just translate it.

### Theme advance logic

```
function tryAdvanceMountain():
  -- Honor the player's Next-Tree chip pick if any.
  if chosenNextTheme ~= nil and chosenNextTheme < themesUnlocked:
    cycleBump = (chosenNextTheme <= curThemeIdx) ? 1 : 0
    mountain.cycle += cycleBump
    mountain.level = chosenNextTheme + mountain.cycle * 7
    mountain.maxHp = 2400 * theme.hpMul * 2^cycle
    chosenNextTheme = nil
    return

  -- Otherwise: natural sequential progression, gated on themesUnlocked.
  nextLevel = mountain.level + 1
  if (nextLevel % 7) >= themesUnlocked:
    -- Next theme is locked — respawn current.
    mountain.hp = mountain.maxHp
  else:
    mountain.level += 1
    mountain.cycle = floor(mountain.level / 7)
    mountain.maxHp = BASE_HP * theme.hpMul * 2^cycle
```

### Theme unlock costs (per run, reset on rebirth)

`COSTS = { 150, 750, 3000, 12000, 45000, 180000 }` gold to unlock theme #1..#6 (Verdant is free at run start).

### Next-Tree picker chip strip

Above the HP bar in the world UI (BillboardGui or screen-anchored HUD), show one **Auto** chip + one chip per unlocked theme, colored with that theme's `canopyMid`. The currently-active selection has a gold outline. Clicking sets `chosenNextTheme` (`nil` for Auto).

---

## 7. Goons, Mines & Bosses

### Goon

Per-theme enemies that hang on the tree. Re-spawn periodically up to `maxGoons`. They attack runners (apply status effects). Killing one is gated behind any projectile/player-shot reaching their hitbox. They drop loot on death.

```lua
GoonConfig = {
  name = "Vine Bee",
  bodyColor = Color3,
  attackColor = Color3,         -- projectile / status color
  status = "slow",              -- stun/slow/blind/burn/tangle/drain/drop
  statusDuration = 1.5,
  statusValue = 0.5,            -- magnitude (e.g. slow factor)
  attackInterval = 4,           -- seconds between attacks
}
```

In 3D: spawn the goon model on the tree at a random hex-side. Animate small flight loops or hovering.

### Mine

Passive variant — does not attack runners. Drops a guaranteed gem burst on death. Use them as a steady gem-income lever.

### Boss (mini-boss)

Every few trees, spawn a boss instead of a regular goon wave. Limited time (90s). Must kill before timer expires; no penalty for failing (boss just flees). On kill: gem burst + free roll.

```lua
BossConfig = {
  id, name,
  weaknessLabel,                -- flavor text shown on the banner
  weakVariants = { "green", "sprout", ... },  -- ×3 damage from these bees
  weakDamageTypes = { "frost" },              -- ×3 damage from player shots of these types
  hpMul = 6,                    -- multiplier on base goon HP
  timeLimit = 90,
  bodyColor, accentColor,
}
BOSS_WEAKNESS_MUL = 3
```

When a boss is alive, all damage application checks both `weakVariants` (for bee projectiles) and `weakDamageTypes` (for player shots) and multiplies by `BOSS_WEAKNESS_MUL = 3`.

In 3D: oversized model, larger hitbox, a `Banner` BillboardGui appears showing name + weakness icon + countdown.

### Goon damage chain

When ANY damage hits a goon hitbox, the goon takes that damage **instead of** the tree. They are physical shields. `antiGoon` bees get a 2× multiplier against them. Player shots always take the damage type through to the impact pipeline.

---

## 8. Loot Pipeline

### Drop chance per impact

Reuse the prototype formula. Each damage point has a chance to drop, with `dropChance1..5` perks layering additively:

```
chance_per_point = 0.02 + 0.08 (drop1) + 0.12 (drop2) + 0.18 (drop3) + 0.25 (drop4) + 0.35 (drop5)
```

Roll once per damage point, plus heavy-drop chance to double (50% with `heavyDrops1`, 100% with `heavyDrops2`).

Every impact **guarantees** at least one `SMALL_GOLD` piece — players need to feel that every hit produces *something*.

### Loot shapes

- **gold** — round coin (small/medium/large/bar tiers depending on context).
- **gem** — diamond/square shape (pink/green/yellow/purple/ruby/orange/blue colored, each with a value).

In 3D: spawn as small `Part`s with a `BillboardGui` icon, or as physical mesh tokens. Auto-magnet to the player when within `PICKUP_RADIUS = 46 studs` (scale appropriately for Roblox stud sizes — ~4-6 studs is more natural). Auto-magnet to nearby runner bees as well.

### Carry pile + dropoff

Loot can be carried by:
- **The player avatar** (cap = `BASE_CARRY_CAP=5` + perks; carried loot floats stacked above the avatar's head).
- **Runner bees** (cap per variant; runners pick up nearest piece, fly to hive, deposit).

Walking onto the hive's dropoff zone causes the player to **toss** carried loot in a small arc. Each toss completes ~0.45-0.6s later and credits inventory.

### Reclaim

Loot sitting on the ground untouched for too long gets "reclaimed" by the tree (it slides back up and dissolves). Reclaim interval is slowed by `reclaimReduce1/2` perks. In 3D: use `TweenService` to animate the loot rising into the tree, then `Destroy()`.

### Food drops (special)

Cheese / Egg / Drumstick / Pizza drops — gated behind `cheeseUnlock`, `eggUnlock`, etc. perks. These don't go to inventory — they get carried to the **hive food slot** where a slime auto-eats it to gain XP. Drop rates: 1-in-80, 1-in-200, 1-in-1000, 1-in-5000.

---

## 9. The Bee Dice (Gacha Roll)

### Flow

1. Player clicks Roll Dice pedestal (or auto-roll if `autoSpin` perk).
2. Spend `SPIN_BASE_COOLDOWN = 8s` (reduced by `cheaperSpin1..6` to floor of 5s).
3. Server rolls a variant using luck-weighted RNG.
4. Reel animation on client (spinning roulette of variant icons).
5. **Discovery reveal** if this is a NEW variant (first time rolled): zoom-in dramatic banner with the bee model, rarity label, and ability badges.
6. Otherwise: small toast.
7. Variant added to collection. `bagProgress += wasNew ? 10 : 1`. Check milestones.

### Multi-roll perks

- `rollMul2` → 2 bees per roll
- `rollMul4` → 4 bees per roll
- `rollMul8` → 8 bees per roll

These stack additively — `×8` means each click spawns 8 rolls in parallel.

### Bonus reel

5% base chance any roll triggers a "bonus reel" — a second special spin from a curated table of gem/luck rewards. Boosted by `bonusChance1/2/3` (+50%/+100%/+200%).

### Auto-roll

If `autoSpin` perk owned and the toggle is on, the pedestal auto-fires every cooldown. Show a clear UI indicator (the spin reel has an "AUTO" badge).

### Quick Roll

Repeatable consumable perk (`quickRoll`, 5 rolls cost). Buying it grants 10 charges of half-cooldown. Charges decrement on each roll.

---

## 10. Skill Tree (Perk Web)

A flat-topped **hex grid** with 6 radial branches. Each branch is a colored axis emanating from the central `foundation` node.

### Branches & colors

```
slime / BEE      (east,  +1,0)   #ff8c5a   -- spitter+runner slots, dmg, carry
player / PLAYER  (west,  -1,0)   #5af0ff   -- avatar carry, shoot, speed, dmg types, aura
speed            (north,  0,-1)  #a0ff5a   -- pickup, runner speed, reclaim, floor cap
riches           (south,  0,+1)  #ffd24a   -- drop chance, coin/gem value, food unlocks
luck             (NE,    +1,-1)  #5af04a   -- luck flat + luck multipliers
economy          (SW,    -1,+1)  #b070ff   -- auto-roll, faster spin, ×N roll
```

### Layout rules

- Each branch's spine is `(dq*i, dr*i)` for `i = 1..N`.
- Offshoots live at `(spine_q, spine_r ± 1)` — perpendicular to the branch direction.
- A node is **visible** if it or any neighbor is unlocked.
- A node is **mystery (?)** if it's one hop beyond visible.
- A node is **unlockable** if any neighbor is unlocked AND any explicit `requiresPerk` is satisfied AND the player can afford the cost.

Bring over `SKILL_TREE` from `slime-vs-mountain/src/skills/tree.ts` wholesale. There are ~80 nodes total.

### PLAYER branch in detail

The PLAYER spine (west of root, q from -1 to -11):
```
-1  shootUnlock      Click on the tree to fire
-2  playerCarry1     +2 pockets (5 → 7)
-3  shootDmg1        +50% shot damage
-4  playerCarry2     +3 pockets (→ 10)
-5  playerSpeed1     +25% move speed
-6  shootDmg2        +75% (stacks → +125% total)
-7  playerCarry3     +5 pockets (→ 15)
-8  playerSpeed2     +40% (stacks → +65% total)
-9  shootDmg3        +150% (stacks → +275% total)
-10 playerCarry4     +8 pockets (→ 23)
-11 playerSpeed3     +60% (stacks → +125% total)
```

PLAYER offshoots:

**South (r=+1) — Elemental shots**, each adds a damage type to the cycle (default order Physical → Burn → Frost → Storm):
```
q=-3, r=+1   shootBurn       Adds Burn (DoT, 3× vs Glacial boss)
q=-5, r=+1   shootFrost      Adds Frost (slows respawn, 3× vs Amber/Ember bosses)
q=-7, r=+1   shootLightning  Adds Storm (chains, 3× vs Shadow boss)
```

**North (r=-1) — Bee Aura**, buffs all bees within radius of the player:
```
q=-3, r=-1   auraUnlock      Bees within 140px deal +15% damage
q=-5, r=-1   auraDmg1        Stacks → +40% damage
q=-7, r=-1   auraSpeed       Aura also boosts fire rate by 25%
q=-9, r=-1   auraRadius      Radius +60% (140 → 224 px)
```

### Cost ramp note

Late-game costs (slot 7+, dmg 3+, carry 4+, lucky 5/6, rollMul8/luxury/royal) are **3-5× steeper** than mid-game. Bring the exact numbers from `tree.ts`. Players accumulate enormous post-rebirth currency, so the curve is intentionally aggressive at the back end.

### Hex coord math

Pointy-top axial coordinates, hex size = 32 px (scale for screen):
```
x = sqrt(3) * size * (q + r/2)
y = 1.5 * size * r
```

For Roblox 2D ScreenGui rendering, use UIGridLayout-free positioning — set each Frame's `AnchorPoint = (0.5, 0.5)` and compute Position from `(q, r)`.

---

## 11. Bag of Bees (Collection Index)

A separate fullscreen overlay with:
- A grid of every variant (locked = silhouette, unlocked = sprite + count + level).
- A **bag progress meter** showing `bagProgress` toward the next milestone threshold.
- A scrollable list of past milestone rewards.

### Endless milestone generator

```lua
function buildBagMilestones(): list  -- 100 entries
  for i = 1..100:
    threshold = floor(10 * 1.6 ^ (i-1))
    reward = pickReward(i)
    list[i] = { threshold = threshold, reward = reward }
```

Reward cycles through: gold / gems / luck / essence at tier amounts scaled by `(tier * i)`.

**bagProgress** increments by:
- `+10` when a NEW variant is rolled (first time seeing it)
- `+1` when a duplicate of an existing variant is rolled

When `bagProgress` crosses a threshold, the matching milestone is added to `pendingMilestones`. The player opens the Bag of Bees overlay and clicks to **claim** rewards — claiming drains `pendingMilestones`, adds to `claimedMilestones`, applies the reward to inventory.

The HUD shows a notification dot on the Bag of Bees button when `pendingMilestones` is non-empty.

---

## 12. Rebirth & Essence Tree

### Rebirth gate

Available once `totalMountainsKilled >= 1` (lifetime, never resets). Shows a Rebirth button on the HUD.

### Rebirth flow

1. Show confirm modal with payout preview.
2. On confirm:
   - Compute essence payout: a function of `runGoldEarned` (typically `floor(sqrt(runGoldEarned / 100))` + bonuses; bring from prototype).
   - `inventory.essence += payout + pendingEssence`.
   - `pendingEssence = 0`.
   - `totalRebirths += 1`.
   - Reset run state: gold, gems, luck (back to 5 + milestone bonus), rolls, perks (only `foundation` kept), themesUnlocked = 1, mountainLevel = 0, mountainCycle = 0, runMountainsKilled = 0, runGoldEarned = 0.
   - **DO NOT** reset: collection, claimedMilestones, totalMountainsKilled, totalRebirths, ownedShopItems, essenceUnlocked, bagProgress.
   - Re-equip best bees in slots (respecting new slot caps).
   - Open Essence Tree overlay immediately.

### Essence Tree

A **honeycomb-pointy-top hex layout**, separate from the skill tree. Centered on the `honeyDrop` root (cost 1 essence). Each direction is a branch:

```
W      wealth         (gold mul tier)
E      power          (spitter dmg mul tier)
NW     fortune        (flat luck tier)
SE     haul           (carry / dropoff speed)
NE     quickstart     (extra starter runner)
SW     echo           (XP gain mul)
SW(2)  craft1         (unlocks Craft button)
```

Costs scale exponentially. All purchases persist across rebirths.

Bring `ESSENCE_TREE` from `slime-vs-mountain/src/skills/essence.ts` wholesale.

### Rebirth Boost shop item

Each rebirth boost charge consumed on next rebirth grants a 5× essence payout multiplier. Stockpiled charges show on the HUD.

---

## 13. Player Avatar Stats & Behavior

### Base stats

```
SPEED              = 16 studs/s  -- Roblox-natural ≈ 220 px/s in prototype
PICKUP_RADIUS      = 5 studs     -- scale from 46 px
BASE_CARRY_CAP     = 5
SHOOT_COOLDOWN     = 0.6 s
```

### Speed perks

```
playerSpeed1: ×1.25 (additive over base)
playerSpeed2: ×1.65 (with 1)
playerSpeed3: ×2.25 (with 1+2)
```

Server-side, apply `Humanoid.WalkSpeed = SPEED * speedMul`.

### Carry perks

```
playerCarry1: +2  (cap 7)
playerCarry2: +3  (cap 10)
playerCarry3: +5  (cap 15)
playerCarry4: +8  (cap 23)
```

### Shoot mechanics

- Click on the tree → `tryShoot(targetX, targetY, targetZ)`.
- Server validates cooldown, applies damage via the impact pipeline with the player's currently-selected damage type.
- Tracer: client renders a short bright line from the avatar's right hand to the impact point, fading over 0.15s.

### Damage-type cycle

```
default options:  ["physical"]
+ shootBurn:      ["physical","burn"]
+ shootFrost:     ["physical","burn","frost"]
+ shootLightning: ["physical","burn","frost","lightning"]
```

Player presses **Q** (PC) or taps the HUD chip (mobile/PC) to cycle `playerDmgTypeIdx`. Server validates that the requested index is in range of unlocked options. Toast: `"Shot: Frost"`.

Lightning shots only trigger their chain effect (`allowChain = true`) when `type == "lightning"`.

### Bee Aura

```lua
function playerAura(unlockedPerks):
  if not has("auraUnlock") then return nil end
  dmgMul = has("auraDmg1") and 1.40 or 1.15
  fireRateMul = has("auraSpeed") and 1.25 or 1
  radius = has("auraRadius") and 224 or 140   -- scale: ÷ ~14 for studs
  return { radius = radius, dmgMul = dmgMul, fireRateMul = fireRateMul }
```

Each tick, for each spitter bee, check distance to player. If `<= radius`, multiply its outgoing damage by `dmgMul` and tick its fire cooldown faster by `fireRateMul`.

**Render the aura ring** as a translucent `Decal` on the floor, or a `Beam` arc, or a flattened transparent sphere `Part` parented to the player. Color: `#5af0ff` matching the PLAYER branch.

### Player projectile through impact pipeline

```
applyImpact(x, y, z, dmg, type, source=nil, allowChain):
  -- Goon shield check
  for g in goons:
    if g.alive and g.hitbox:Contains(point):
      mul = source and source.vsGoonMul or 1
      if g.isBoss:
        if source and g.boss.weakVariants:Has(source.variantId):
          mul *= BOSS_WEAKNESS_MUL          -- 3×
        if not source and g.boss.weakDamageTypes:Has(type):
          mul *= BOSS_WEAKNESS_MUL          -- player elemental match
      g:takeDamage(dmg * mul)
      drop one SMALL_GOLD
      return
  -- Otherwise tree takes the hit
  mountain:takeDamage(dmg)
  if type == "burn":  mountain:applyBurnAt(point, 1)
  if type == "frost": mountain:applyFrostAt(point, 3)
  if type == "lightning" and allowChain:
    chainTo = randomMountainPoint()
    applyImpact(chainTo, dmg * 0.5, "physical", source, false)
  rollLoot(dmg)
  spawnGuaranteedSmallGold()
```

---

## 14. AI Autoplay

Toggle with the `A` key or the Settings overlay. When on:

- Avatar walks to the nearest floor loot, picks it up, deposits at the hive.
- Avatar shoots the tree every `SHOOT_COOLDOWN` if `shootUnlock` is owned. Priority: **boss > tree**.
- Skill tree is auto-unlocked by spending available currency on the cheapest unlocked-adjacent node.
- Roll is auto-fired when available.
- Rebirth is triggered when `rebirthUnlocked()` AND `runMountainsKilled >= 1` (per-run kill needed so projectiles don't get wiped mid-flight).
- Sub-steps = 4× normal tick speed.

Used as a soak-test for balance, and as an accessibility feature. Implement as a separate server-side ticker per player when toggled on.

---

## 15. Themed Shop (Robux + Gems)

Bring `SHOP_ITEMS` from `slime-vs-mountain/src/game/types.ts`. Examples:

```
starterPack       → +1000 gold + 50 gems + 5 essence  (oneTime)
serverLuck        → +10 min of ×2 luck boost
serverCoins       → +10 min of ×2 coins boost
megaCoins         → permanent gold multiplier         (oneTime)
gemPackSmall      → +500 gems
gemPackLarge      → +2500 gems
slotExpansion     → +1 spitter slot, +1 runner slot   (oneTime)
autoRollGamepass  → permanently unlocks autoSpin perk (oneTime)
luckySpins        → +5 lucky spins
rebirthBoost      → +1 rebirth-boost charge
```

In Roblox, wire these to **DeveloperProduct** or **Gamepass** purchases via `MarketplaceService.ProcessReceipt`. The Robux receipt callback applies the effect server-side and saves.

---

## 16. SAVE_VERSION & Migrations

The prototype uses a single integer `v` in localStorage. In Roblox, embed `v` in the profile schema. On load:

```lua
if save.v ~= SAVE_VERSION then
  -- Forced reset: this game is in prototype churn; we wipe rather than migrate.
  return defaultProfile()
end
```

For a real production game you would build migration steps. For prototype-stage Roblox, the forced-wipe approach mirrors the prototype's design intent: rapid iteration trumps backwards compat.

Current version: `SAVE_VERSION = 4`.

---

## 17. FTUE (First-Time User Experience)

The prototype has a guided onboarding state machine (`ftue.step = 0..N`) with on-screen arrows pointing at the next action:
1. Walk to the loot pile.
2. Carry it to the hive.
3. Click the Roll Dice.
4. Place a bee in a slot.
5. Watch them fire at the tree.
6. Kill the first tree.
7. Click Rebirth → walks through Essence Tree's first node.

Each step captures a snapshot of relevant counters (gold, rolls) and watches for the player to cross a threshold (e.g. `inventory.gold > goldAtStepStart` after a deposit).

In Roblox, render the arrows as `BillboardGui` on the target object, or as a `SurfaceGui` with a beam.

A separate `ftueRebirthStep` chain handles post-rebirth guidance.

---

## 18. HUD Inventory

Currency widgets along the top of the screen:

```
✦ pollen (gold)    💎 gems    🍀 luck    🎲 rolls    🍯 essence
```

`pendingEssence` (post-rebirth pre-spend) is shown as a glowing addition to the essence counter, since the player will rebirth-collect it.

Buttons / pedestals (one per overlay):
- Roll Dice (pedestal in world OR HUD button)
- Skill Tree
- Essence Tree (only visible after first rebirth)
- Craft (only visible after `craft1` essence node)
- Settings (autoplay, cheats, reset save)
- Shop
- Bag of Bees (with pending-milestone dot)
- Rebirth (only visible when `rebirthUnlocked`)

Plus floating world-space UI:
- Tree HP bar above the tree (BillboardGui).
- Boss banner above the tree when a boss is alive.
- Next-Tree picker chips above the HP bar (visible once `themesUnlocked >= 2`).
- Unlock-Next-Theme button (cost in pollen).
- Damage-type chip on the bottom-left (visible once any elemental shot perk is owned).
- Toast popup mid-bottom.

---

## 19. Cheat Codes / Debug

The prototype's Settings overlay exposes:

- **AI Autoplay** toggle
- **Grant Loot Cheat** — adds 100k gold, 5k gems, 50 essence, fills luck. Add `pendingEssence += 50` so it shows on the HUD.
- **Reset Save** — wipes the profile and reloads.

For Roblox, gate these behind a server-side `if player:GetRankInGroup(...) >= ADMIN_RANK` check, or a creator-only Place check.

---

## 20. Phased Implementation Plan

Build in this order — each phase is independently playable:

### Phase 1 — Foundation (2-3 days)
- Per-player profile + DataStore + ProfileTemplate.
- Currency model (gold, gems, luck, essence, rolls).
- Bee variant table loaded from `Shared/Data/BeeVariants.lua`.
- Single tree in the arena with hardcoded HP and no theme variation.
- One slime model that hovers and fires a `bullet` projectile.
- Basic HP bar BillboardGui.
- Manual cheat to grant currency.

### Phase 2 — Gacha + Slots (2-3 days)
- Roll Dice pedestal → `SpinRollRemote` → server picks variant from luck-weighted RNG.
- Discovery reveal sequence on first-time variant pull.
- Slot ring: ~2 spitter + 0 runner initially. UI to drag variants into slots.
- Equip-best button.
- All 50+ variants imported and renderable as simple sphere/mesh placeholders.

### Phase 3 — Loot pipeline + Player walk (2 days)
- Tree damage drops loot (gold + gem). Loot magnets to player at `PICKUP_RADIUS`.
- Carry stack rendered above avatar's head.
- Deposit at hive zone triggers toss animation + currency credit.
- Runners auto-fly between loot and hive.
- Tree death state machine (falling/rising) — visual fade for now.

### Phase 4 — Skill tree (3 days)
- Hex-coord renderer in ScreenGui (pointy-top, size 32).
- Bring SKILL_TREE wholesale from prototype.
- Visible / mystery / unlockable gating.
- Click-to-unlock with cost validation.
- Drag-to-pan, scroll-to-zoom.
- Each node renders with its branch color, cost icon, and description tooltip.

### Phase 5 — Themes & advance (1-2 days)
- Bring MOUNTAIN_THEMES table.
- TreeArt rendered per theme (Color3 swatches on canopy parts, accent particles).
- `tryAdvanceMountain` logic + theme unlock costs.
- Next-Tree picker chip strip in world UI.
- Sky color tween per theme transition.

### Phase 6 — Goons + Bosses (2 days)
- Goon spawn loop per theme (max + interval from theme config).
- Mine spawn loop.
- Boss spawn at predefined intervals; banner UI.
- Goon-as-shield damage redirect.
- Boss weakness multipliers (variant + damage type).

### Phase 7 — Player shooting + Aura (2 days)
- `shootUnlock` perk + `tryShoot` with cooldown.
- Tracer effect from hand to impact.
- Damage-type cycle: `Q` key + HUD chip + `CycleDmgTypeRemote`.
- Boss `weakDamageTypes` honored in damage pipeline.
- Bee Aura — translucent ring, per-bee distance check, dmgMul + fireRateMul application.

### Phase 8 — Bag of Bees + Milestones (1-2 days)
- Collection grid overlay.
- 100-entry milestone generator.
- `bagProgress` increment on new/duplicate rolls.
- Pending-milestone dot on HUD button.
- Claim flow with reward toasts.

### Phase 9 — Rebirth + Essence Tree (2-3 days)
- Rebirth modal + payout formula.
- Run-scoped vs lifetime state correctly reset.
- Honeycomb essence tree overlay.
- Open immediately after rebirth confirm.
- All branches wired to existing effective* helpers.

### Phase 10 — Polish (open-ended)
- FTUE arrows + step progression.
- Discovery reveal animation with ability badges.
- Toast queue with stacking.
- AI autoplay.
- Shop overlay + Robux integration.
- Settings overlay.

---

## 21. Balance Reference Constants

```lua
-- combat
BASE_HP                    = 2400
BOSS_WEAKNESS_MUL          = 3
SHOOT_COOLDOWN             = 0.6     -- seconds (player)
FIRE_RATE_SCALE            = 0.3     -- multiplier on every spitter's variant.fireRate

-- player
BASE_WALK_SPEED            = 16      -- studs/s in Roblox
BASE_CARRY_CAP             = 5
PICKUP_RADIUS              = 5       -- studs

-- gacha
SPIN_BASE_COOLDOWN         = 8       -- seconds
BONUS_REEL_BASE_CHANCE     = 0.05

-- bag of bees
MILESTONE_COUNT            = 100
MILESTONE_BASE             = 10
MILESTONE_GROWTH           = 1.6     -- threshold[i] = floor(10 * 1.6^(i-1))

-- bag progress per acquire
PROGRESS_NEW_VARIANT       = 10
PROGRESS_DUPLICATE         = 1

-- slot caps
SLOT_LIMITS = { spitter = 1, runner = 0 }   -- starting; perks raise
```

---

## 22. Coordinate Translations: Prototype Pixels → Studs

The prototype uses an 1280×600 px world. Suggested conversion for sense-of-scale:

```
1 stud ≈ 14 px

PICKUP_RADIUS  46 px  → ~3.3 studs (round to 4-5 studs feels better in 3D)
Aura radius   140 px  → ~10 studs
Aura wide     224 px  → ~16 studs
SPEED         220 px/s → ~16 studs/s (matches Roblox default Humanoid)
```

Don't slavishly convert — Roblox spatial sensibility is different. Tune to feel.

---

## 23. Open Design Questions (Decide Early)

1. **Single-player or multi-player arenas?**
   - **Recommended: per-player private arena.** Each player has their own tree + hive instance (use unique `Workspace` folders per UserId or per-server slot). Prevents grief, makes economy authoritative, mirrors prototype.
   - If you want global play, deal with anti-cheat, ranked leaderboards, shared rolls — much heavier.

2. **Mobile-first input?**
   - Yes. Roblox skews mobile. Make sure every UI has tap targets and works without a keyboard. Map `Q` cycle to a HUD chip tap.

3. **Bee model fidelity?**
   - Prototype uses 2D circle blobs. For Roblox, use a SHARED bee mesh skinned with per-variant Color3 (body / belly) + minimal accent particles. Don't model 50 unique meshes — that's a content treadmill.

4. **Tree model — procedural or hand-built?**
   - Hand-build ONE tree mesh; recolor + swap accent decorations per theme. The prototype literally just paints different colors over the same canopy.

5. **Camera follow?**
   - Roblox default ClassicCharacterController + 3rd-person camera works. Lock zoom-in to keep the tree visible, OR allow it but add a HUD "tree HP" mini-bar in the corner.

---

## 24. What NOT to Bring Over

- **Side-scroller-specific UI layout** (everything anchored to canvas X/Y). Re-do all UI for Roblox screen-space.
- **HTML5 image loading** for icons — Roblox uses asset IDs.
- **localStorage** — replaced by DataStoreService.
- **2D pixel-perfect projectile collision** — use Raycast or BasePart Touched events in 3D.
- **Mouse-only input assumptions** — Roblox needs gamepad + touch parity.
- **Tab-key debug commands** — guard behind admin checks.

---

## 25. Reference Files in the Prototype

When porting, these files are the authoritative source for each subsystem:

```
src/game/Game.ts                  -- main game class, save/load, FTUE, autoplay
src/game/types.ts                 -- SLIME_VARIANTS, MOUNTAIN_THEMES, BOSSES, SHOP_ITEMS, INDEX_MILESTONES
src/entities/Mountain.ts          -- tree HP, theme art, death sequence
src/entities/MountainGoon.ts      -- goons / mines / bosses
src/entities/Slime.ts             -- spitter / runner update loops
src/entities/Projectile.ts        -- projectile kinds + trajectories
src/entities/Player.ts            -- avatar walk, carry, toss
src/entities/Loot.ts              -- loot drop logic
src/entities/FoodDrop.ts          -- cheese / egg / drumstick / pizza
src/skills/tree.ts                -- skill tree perk graph
src/skills/essence.ts             -- essence tree honeycomb
src/ui/HUD.ts                     -- currency widgets, dice, rebirth button
src/ui/SkillTreeView.ts           -- skill tree rendering
src/ui/EssenceTreeView.ts         -- essence tree rendering
src/ui/IndexView.ts               -- bag of bees collection
src/ui/DiscoveryReveal.ts         -- new-bee reveal animation
src/ui/Settings.ts                -- settings + cheat overlay
```

---

## 26. Final Notes

- **Keep the gacha pacing slow.** Roll cooldown of 8s sounds long, but it's tuned with the dopamine of reveals. Don't shorten it to "feel snappy" — players will burn through the rarity table in 10 minutes.
- **The first tree must die fast.** First-tree HP override is critical for FTUE flow.
- **Late-game costs are 3-5× steeper than mid-game** by design. Players hit a wall after rebirth 1-2 and the meta progression takes over.
- **Server is authoritative for everything that costs currency.** No exceptions. The client only renders.
- **Make rebirthing FEEL good** — instant Essence Tree open, particles, fanfare. It's the long-term retention loop.

Build Phase 1-3 first and playtest the loop before adding cosmetic polish. Most porting failures come from front-loading visual fidelity before the loop is fun.

Good luck. The numbers in the prototype are tuned — when in doubt, copy them verbatim and adjust *after* playtesting.
