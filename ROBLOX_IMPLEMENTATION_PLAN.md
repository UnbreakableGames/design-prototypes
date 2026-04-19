# Space Miner Idle — Roblox Implementation Plan

This plan covers building the full Space Miner Idle prototype in Roblox Studio, based on the working HTML5 prototype at `/Users/andrew/UnbreakableGames/spaceminer/index.html`. The prototype is playable at https://unbreakablegames.github.io/design-prototypes/

---

## Architecture Overview

### Client/Server Split

| Layer | Responsibility |
|-------|---------------|
| **Server** | Authoritative game state, DataStore saves, upgrade purchases, damage validation, economy, refiner ticking, drone logic, enemy spawning/AI |
| **Client** | Rendering, input handling, UI, particle effects, sound |

### Data Flow
```
Player Input → Client → RemoteEvent → Server validates → Updates state → RemoteEvent → Client renders
```

All economy actions (purchase, collect bars, deposit ore) MUST be server-authoritative to prevent exploits. Movement uses the standard Roblox character controller — no custom movement needed.

---

## Phase 1: World Setup & Core Structure

### 1.1 Workspace Layout

Create a 3D space environment:

- **Skybox**: Dark space skybox with stars
- **Asteroid Field**: Concentric rings of asteroid models around a central station
  - 7 rings at radii: 70, 115, 160, 210, 255, 295, 330 studs from center
  - Ring counts: 8, 8, 8, 6, 6, 5, 4 asteroids per ring
  - Rings 4-7 should have a red danger-zone visual (red tinted fog/particles)
- **Central Station**: The spaceport at world origin (0, 0, 0)
- **Ground Plane / Platform**: A large flat surface or transparent platform for the player character to walk/run on (or use zero-gravity flying — see Phase 4)
- **Player**: Standard Roblox avatar, controlled with default 3rd person camera and WASD/click movement

### 1.2 Folder Structure in Roblox

```
ServerScriptService/
  GameManager.server.lua        -- Main server loop, coordinates systems
  DataManager.server.lua        -- DataStore save/load, offline progress
  EconomyManager.server.lua     -- Upgrade purchases, bar collection, cost validation
  RefinerManager.server.lua     -- Refiner ticking, bar production
  DroneManager.server.lua       -- Drone mining logic
  EnemyManager.server.lua       -- Enemy spawn, AI, combat
  CombatManager.server.lua      -- Damage dealing, projectiles, death/respawn

ReplicatedStorage/
  Config/
    TierConfig.lua              -- All tier data (names, colors, hits, yields, intervals)
    UpgradeConfig.lua           -- All upgrade trees with costs and effects
    EnemyConfig.lua             -- Enemy stats per tier
    CosmeticConfig.lua          -- All cosmetic items and costs
  Remotes/
    (RemoteEvents and RemoteFunctions created here)
  Modules/
    StateManager.lua            -- Shared state shape definition
    CostHelper.lua              -- canAfford / deductCost utilities

StarterPlayerScripts/
  InputController.client.lua    -- Click handling, proximity prompts, interaction
  UIController.client.lua       -- All UI updates
  CombatRenderer.client.lua     -- Projectile visuals, enemy health bars, damage numbers
  PlayerEffects.client.lua      -- Carrying ore visuals, shield bubble, invuln blink

StarterGui/
  MainHUD/                      -- HP, shield, carrying, time
  SidePanel/                    -- Inventory, refiners, drone refiners, status, log
  UpgradePanel/                 -- Mining, Buildings columns + Combat/Cosmetics tabs
  StationView/                  -- Station diorama (optional: can be 3D in-world)
```

### 1.3 Camera & Character Setup

Use the **default Roblox 3rd person camera**. No custom camera script needed — the standard follow camera works well for this type of game. Players control their avatar with standard WASD + mouse look.

**Character configuration** (in StarterPlayer properties):
- Increase `CharacterWalkSpeed` based on speed upgrade (default 16, boosted by speed upgrade)
- Consider giving the character a space suit / astronaut appearance via StarterCharacterAppearance or avatar items
- Disable jumping if the field is flat (optional) or allow it for traversal feel

---

## Phase 2: Config Data (Do This First)

Port all balance data into ModuleScripts under `ReplicatedStorage/Config/`. This is the foundation everything builds on.

### 2.1 TierConfig.lua

```
7 tiers, each with:
  key: "iron", "copper", "cobalt", "emeralite", "aurium", "voidstone", "cosmium"
  name: "Iron", "Copper", etc.
  color: Color3 values matching the hex colors
  hitsToBreak: 10, 18, 30, 45, 65, 90, 120
  barInterval: 1, 4, 5, 8, 12, 15, 20 (seconds per bar produced)
  barYield: 5, 8, 6, 5, 4, 3, 2 (total bars per ore)
  ringRadius: 70, 115, 160, 210, 255, 295, 330
  ringCount: 8, 8, 8, 6, 6, 5, 4
  asteroidSize: 12, 13, 14, 15, 16, 17, 18
```

### 2.2 UpgradeConfig.lua

Port all upgrade trees exactly as defined in the prototype. Each upgrade is an array of levels with cost tables and effect values. See the HTML prototype for exact values. Key upgrades:

- **pick**: 7 levels (damage 1→18, unlocks tiers 1→7)
- **speed**: 7 levels (0%→100% boost to Humanoid.WalkSpeed)
- **capacity**: 5 levels (1→8 ore)
- **landingPad**: 4 levels (base → auto-sort)
- **refiners**: 6 total (start with 1)
- **refinerSpeed**: 5 levels (1.0x→2.0x)
- **droneBay**: 5 levels (0→5 drones, max tier 0→3)
- **autoCollector**: 3 levels (off, 30s, 15s)
- **armory**: binary (unlocks combat tab)
- **weaponDmg**: 6 levels (5→35 damage)
- **fireRate**: 5 levels (1.0→3.0 shots/sec)
- **health**: 6 levels (50→300 HP)
- **shield**: 6 levels (0→150 shield)
- **shieldRegen**: 4 levels (5s→2s delay)

### 2.3 EnemyConfig.lua

```
Tiers 4-7 only:
  T4 Raider:       hp=20,  damage=3,  speed=40, attackRange=18, attackRate=1.5s, salvageDrop=1
  T5 Hunter:       hp=35,  damage=5,  speed=50, attackRange=20, attackRate=1.2s, salvageDrop=2
  T6 Void Stalker: hp=60,  damage=8,  speed=55, attackRange=22, attackRate=1.0s, salvageDrop=3
  T7 Cosmic Horror: hp=100, damage=12, speed=60, attackRange=24, attackRate=0.8s, salvageDrop=5

Max 2 enemies per ring, spawn check every 4 seconds
Aggro range: 60 studs, extended to 120 when hit
Leash distance: 35 studs from home ring
```

**Salvage drops**: When an enemy dies, it drops a small glowing "Salvage" orb at its position. The player walks over it (or uses ProximityPrompt) to collect. Salvage goes directly into inventory — it doesn't need refining. See Phase 2.5 for resource definition and Phase 7.3 for upgrade cost integration.

### 2.4 Salvage Resource

**Salvage** is a combat-only resource dropped exclusively by defeated enemies. It gates progression past mid-game by requiring the player to engage with the combat system.

```
Resource key: "salvage"
Display name: "Salvage"
Color: #c0c0c0 (silver)
Icon: small gear/scrap visual
Source: only enemy drops
Storage: direct to inventory (no refining)
Used for: late-game pick upgrades, drone bay upgrades, all combat upgrades
```

**Progression loop:**
1. Player mines T1-T3 → buys Armory (ore cost only, no Salvage)
2. Player ventures into T4+ rings → fights Raiders for Salvage
3. Player uses Salvage to upgrade weapons/health/shield
4. Player tackles higher-tier enemies for more Salvage
5. Player needs Salvage to unlock Void Pick (T6) and Cosmic Pick (T7)

This prevents a "pure-mining" bypass of the combat system and makes enemies rewarding rather than just obstacles.

### 2.5 CosmeticConfig.lua

Port all 50 cosmetic items across 6 categories (flooring, walls, lighting, furniture, exterior, ambient). Each has name, description, and cost table. See prototype for exact values. High-end cosmetics (top tier of each category) should also include Salvage costs to sink late-game resources.

---

## Phase 3: Player State & Persistence

### 3.1 State Shape

Each player's saved state:

```lua
{
  bars = { iron=0, copper=0, cobalt=0, emeralite=0, aurium=0, voidstone=0, cosmium=0 },
  salvage = 0,  -- dropped by enemies, used for combat upgrades and late-game picks
  upgrades = {
    pick=0, speed=0, capacity=0,
    landingPad=0, refinerCount=0, refinerSpeed=0,
    droneBay=0, autoCollector=0, armory=0,
    weaponDmg=0, fireRate=0, health=0, shield=0, shieldRegen=0,
  },
  cosmetics = {
    flooring = {true,false,false,false,false,false,false},
    walls = {true,false,false,false,false,false},
    lighting = {true,false,false,false,false,false},
    furniture = array of 14 booleans (all false),
    exterior = array of 10 booleans (all false),
    ambient = array of 7 booleans (all false),
  },
  refiners = { {ore=nil, progress=0, barsReady=0, barsProduced=0} },
  droneRefiners = {},
  carrying = {},
  hp = 50,
  currentShield = 0,
  timePlayed = 0,
  lastSaveTime = os.time(),
}
```

### 3.2 DataStore

- Use `DataStoreService` with key = `"player_" .. player.UserId`
- Save on: player leaving, every 30 seconds, manual save button
- Load on: player joining
- Handle offline progress on load (see Phase 9)
- Use `UpdateAsync` for safety, handle failures with retries

### 3.3 Transient State (Server, Not Saved)

Per player:
- playerDead, respawnTimer, invulnTimer
- fireTimer
- droneTimer, autoCollectTimer

Global:
- Asteroid states (alive, hitsLeft, hasOre, respawnTimer)
- Enemy list with positions, HP, AI state
- Active projectiles

---

## Phase 4: Player Movement & Interaction

### 4.1 Standard Roblox Character

The player uses their **standard Roblox avatar** with default 3rd person controls. No custom ship model or movement system needed.

- **WASD / arrow keys**: Move the character
- **Mouse**: Look around (standard 3rd person camera)
- **Movement Speed**: Default `WalkSpeed = 16`. The speed upgrade increases this: `WalkSpeed = 16 * (1 + speedBoost/100)`. Update via `Humanoid.WalkSpeed` on the server when the upgrade is purchased.

### 4.2 Interaction System

Players interact with objects by walking up to them and clicking or using **ProximityPrompts**. Two approaches (can mix both):

**ProximityPrompts (Recommended for most interactions)**:
- Attach ProximityPrompts to asteroids, ore drops, and the station
- Triggered when the player is within range and presses the prompt key (E)
- Server handles the action via ProximityPrompt.Triggered event
- Good for: depositing ore, collecting bars, mining asteroids

**Click-to-interact (Alternative for mining)**:
- Player clicks an asteroid while within range → fires RemoteEvent
- Server validates distance before processing the mine hit
- Feels faster for repetitive mining actions than ProximityPrompts
- Can use a Tool (pickaxe/mining laser) equipped by default that fires on click

**Recommended hybrid**: Use a **mining tool** (click to mine asteroids within range), ProximityPrompts for ore pickup and station deposit, and ScreenGui buttons for refiner collection and upgrades.

### 4.3 Mining Tool

Give the player a Tool (e.g., "Mining Laser" or "Pickaxe") in StarterPack:
- On `Tool.Activated`: raycast from camera through mouse position
- If ray hits an asteroid within range (~15 studs): fire `MineHit` RemoteEvent
- Server validates distance and processes the hit
- Tool shows a visual effect (beam/particle) on activation
- The speed upgrade affects WalkSpeed, NOT mining speed (mining speed is a separate upgrade)

### 4.4 Port Detection

Player is "at port" when their character's HumanoidRootPart is within 30 studs of world center. This gates:
- Collecting refined bars (manual)
- Purchasing upgrades
- Depositing ore (automatic on entering port zone, or via ProximityPrompt on station)
- Healing (full HP + shield restore on deposit)

Use a **Part with Touched/TouchEnded** events or check distance on the server tick to track whether each player is at port.

---

## Phase 5: Asteroid Mining

### 5.1 Asteroid Setup

On server start, generate all 45 asteroids:
- Position each on its ring at evenly-spaced angles with small random jitter
- Each asteroid has: tier, position, hitsLeft, maxHits, alive, hasOre, respawnTimer
- Create corresponding 3D models in workspace (rocky meshparts, colored by tier)
- Locked (greyed out) asteroids for tiers above the player's pick level

### 5.2 Mining Flow

1. Player walks to an asteroid and clicks it with their mining tool (or presses ProximityPrompt)
2. Server validates player is within range (~15 studs), then fires `mineHit`:
   - Check tier <= player's maxTier (from pick upgrade), reject if locked
   - Subtract pick damage from hitsLeft
   - Flash the asteroid white briefly (client visual)
   - Spawn colored particles
   - Show floating damage number
3. When hitsLeft <= 0:
   - Asteroid dies: hide the rock model, show an ore drop (glowing orb) at that position
   - Set respawnTimer = 6-10 seconds (random)
   - Landing Pad L4: auto-sort ore directly to an empty refiner
4. Respawn: after timer, asteroid reappears with full HP

### 5.3 Ore Pickup

1. Player walks near ore drop → ProximityPrompt appears (or auto-pickup on touch)
2. Server checks carrying capacity
3. If room: remove ore from field, add to `carrying` array
4. If full: show "Inventory full!" floating text
5. Visual: small colored orbs orbit near the player character while carrying ore (using Attachments + ParticleEmitters or small Parts welded with offset animations)

---

## Phase 6: Refiner System

### 6.1 Refiner State

Each player has `refiners` (player-owned) and `droneRefiners` (drone-owned) arrays.

Each refiner: `{ ore, progress, barsReady, barsProduced }`

### 6.2 Server Tick (runs every frame or on Heartbeat)

For every active refiner:
```
if ore is set and barsProduced < totalYield:
    interval = tierBarInterval / refinerSpeedMult
    progress += dt
    while progress >= interval and barsProduced < totalYield:
        progress -= interval
        barsReady += 1
        barsProduced += 1
    if barsProduced >= totalYield: progress = 0
```

### 6.3 Depositing Ore

When player enters port zone (or presses deposit ProximityPrompt on station):
- For each ore in `carrying`, find an empty refiner
- Load ore into refiner: set ore type, reset progress/bars
- Remove from carrying
- Heal player to full HP + shield
- If no empty refiner: show "refiners full" message

### 6.4 Collecting Bars

- Player must be at port (within 30 studs of center)
- Click "Collect" on a refiner that has barsReady > 0
- Add barsReady count to player's bar inventory
- If ore fully depleted (barsProduced >= yield): clear the refiner
- Auto-collector bypasses the port requirement, runs on its timer

### 6.5 Refiner UI

Show each refiner in the side panel:
- Name (Refiner 1, Refiner 2, etc.)
- Ore type + progress (e.g. "Iron 3/5")
- Progress bar showing current bar progress
- "Collect X" button (disabled when not at port)
- Drone refiners shown separately with robot icon

---

## Phase 7: Upgrade System

### 7.1 Purchase Flow (Server)

1. Client sends: `PurchaseUpgrade(category, level, subIdx)`
2. Server validates:
   - Player is at port
   - Player can afford the cost (bars AND salvage)
   - Upgrade is not already maxed
   - Special: combat upgrades require armory built
3. Deduct bars AND salvage from inventory
4. Increment upgrade level
5. Apply immediate effects (heal on HP upgrade, restore shield on shield upgrade)
6. Replicate updated state to client

Cost tables now have two optional keys: ore types (e.g. `iron`, `copper`, etc.) AND `salvage`. The cost-check helper must validate both.

### 7.3 Salvage Cost Integration

When porting the upgrade costs from the prototype, ADD Salvage costs to the following upgrades (these are NEW additions, not in the HTML prototype):

**Combat upgrades (primary Salvage sinks — Salvage REQUIRED):**
| Upgrade | Level → Cost |
|---------|--------------|
| Armory unlock | 0 Salvage (ore only — gateway purchase) |
| Weapon Damage | L1: 3, L2: 8, L3: 18, L4: 35, L5: 65 |
| Fire Rate | L1: 5, L2: 12, L3: 25, L4: 50 |
| Health | L1: 2, L2: 6, L3: 14, L4: 30, L5: 60 |
| Shield | L1: 5, L2: 12, L3: 25, L4: 50, L5: 100 |
| Shield Regen | L1: 8, L2: 20, L3: 45 |

**Late-game Pick (forces combat engagement to progress past T5):**
| Pick | Additional Cost |
|------|----------------|
| Void Pick (T6 unlock) | + 15 Salvage |
| Cosmic Pick (T7 unlock) | + 40 Salvage |

**Late-game buildings:**
| Upgrade | Additional Cost |
|---------|----------------|
| Drone Bay L4 | + 20 Salvage |
| Drone Bay L5 | + 50 Salvage |
| Auto-Collector L2 (15s) | + 25 Salvage |

**Design rationale**: Armory purchase requires NO Salvage (you need to buy it before you can fight). All subsequent combat upgrades are Salvage-gated to reward combat engagement. Late picks (T6/T7) require Salvage to ensure players can't mine-only their way to endgame. Total economy: a dedicated player maxing all combat + late picks needs roughly 500-600 Salvage across the full progression.

### 7.2 Upgrade UI Layout

Two columns side by side:
- **Mining**: Pick, Movement Speed, Ore Capacity
- **Buildings**: Landing Pad, Refiners, Refiner Speed, Drone Bay, Auto-Collector, Armory

Below columns, two tabs:
- **Combat**: Weapon Damage, Fire Rate, Health, Shield, Shield Regen (locked until Armory built)
- **Cosmetics**: All 6 cosmetic categories

Each upgrade card shows: current level, current effect, next effect, cost, Buy button.
Buy button shows "Dock to buy" and is disabled when player is not at port.

---

## Phase 8: Drone System

### 8.1 Drone Refiners

Each drone gets its own dedicated refiner (separate from player refiners). The number of drone refiners matches `getDroneCount()`.

### 8.2 Drone Mining Tick (Server, every 5 seconds)

```
for each drone (0 to droneCount-1):
    refiner = droneRefiners[drone]
    if refiner.ore is not nil: continue (busy)
    tier = min(maxDroneTier, 3) - 1  (0-indexed)
    refiner.ore = tierKeys[tier]
    refiner.progress = 0
    refiner.barsReady = 0
    refiner.barsProduced = 0
    log "Drone X mined TierName ore"
```

### 8.3 Auto-Collector Tick (Server)

```
if autoCollectorInterval > 0:
    autoCollectTimer += dt
    if autoCollectTimer >= interval:
        autoCollectTimer -= interval
        for each refiner (player + drone):
            if refiner has barsReady > 0:
                add bars to inventory
                if depleted: clear refiner
```

The auto-collector bypasses the "at port" requirement — that's the whole point of upgrading it.

---

## Phase 9: Enemy & Combat System

### 9.1 Enemy Spawning (Server)

- Check every 4 seconds
- For tiers 4-7: if current enemy count < 2 for that tier, spawn one
- Spawn at random angle on the ring with small jitter
- Each enemy: `{ position, tier, hp, maxHp, angle, attackTimer, patrolAngle, patrolDir, aggro }`

### 9.2 Enemy AI (Server, every Heartbeat)

For each enemy:
1. Calculate distance to player and distance from own ring center
2. **Leash check**: if more than 35 studs from home ring, force return to patrol
3. **Aggro check**: chase if (distance < 60 studs OR (aggro and distance < 120)) AND not leashed
4. **If chasing**:
   - Face player
   - Move toward player at full speed (but don't leave leash zone)
   - If within attackRange (18-24 studs): deal damage at attackRate interval
5. **If patrolling**:
   - Orbit the ring slowly (0.5x speed)
   - Clear aggro flag
   - Return to ring if strayed

### 9.3 Player Combat (Server)

- Requires armory upgrade to shoot
- Auto-targets nearest enemy within 80 studs (or player can click enemies with a weapon tool)
- Fire rate: 1/fireRate seconds between shots
- Spawn projectile at player character position aimed at target
- Projectile moves at 300 studs/sec, lifetime 0.8s
- Hit detection: distance < (enemy.size + 3)
- On hit: subtract weaponDmg from enemy HP, set enemy.aggro = true
- On enemy death: particles, floating text, **drop Salvage at death position**, remove enemy (will respawn later)

### 9.4 Salvage Drops

When an enemy dies:
1. Spawn a glowing silver orb (Part with PointLight + ParticleEmitter) at the enemy's death position
2. Orb tracks: `{ amount, position, spawnTime, lifetime=60s }`
3. Show a "+X Salvage" floating text briefly
4. On player collision (via Touched) OR ProximityPrompt trigger:
   - Add `amount` to player's `salvage` inventory
   - Remove the orb
   - Log "+X Salvage collected" to the game log
5. If not collected within 60 seconds: orb despawns (prevents clutter)

**Visual**: Salvage orbs should look distinct from ore drops — smaller, silver/gray, with sparkle particles rather than the colored glow of ore drops. Consider a slight bobbing animation.

**Multiplayer note**: In shared-field mode, Salvage drops are per-player (each player who damaged the enemy gets their own drop) OR first-come-first-served (single drop). Recommend per-player for fairness.

### 9.5 Player Damage & Death

**Taking damage**:
1. If dead or invulnerable: ignore
2. Shield absorbs first
3. Remaining hits HP
4. If HP <= 0: trigger death

**Death**:
1. Set playerDead = true, respawnTimer = 2 seconds
2. Drop all carried ore (lost permanently)
3. Uncollected Salvage orbs on the field are NOT lost (they persist on field for their normal lifetime). Player's banked Salvage in inventory is safe.
4. Big explosion particles at death location
5. Show "DESTROYED!" floating text
6. Freeze character movement (set WalkSpeed to 0, or use ForceField approach)

**Respawn**:
1. After 2 seconds: teleport character to port center
2. Full heal (HP + shield to max)
3. 2 seconds of invulnerability (character blinks / ForceField visual)
4. Restore WalkSpeed

### 9.6 Shield Regeneration

- Shield regens at 10/sec after delay (5s→2s based on shieldRegen upgrade)
- Timer resets whenever player takes damage
- Only regens when not dead

---

## Phase 10: Station Diorama

### 10.1 Approach

Two options — pick one:

**Option A (Recommended): 3D In-World Station**
Build a 3D station model at the center of the field. As upgrades are purchased, new building models appear or existing ones change. The player can see their station grow as they walk around it. This is more immersive in Roblox.

**Option B: 2D UI Canvas**
Replicate the HTML prototype's 2D canvas as a SurfaceGui or ScreenGui with drawing. Less work but less immersive.

### 10.2 Station Buildings (Option A)

Place 3D models that appear/upgrade as the player progresses:

- **Landing Pad**: Central platform. Grows with level, adds markings, glow ring at L3+
- **Refiners**: Small furnace buildings on one side (1-6). Active ones glow/emit particles
- **Drone Bay**: Hangar building with drone models parked inside
- **Auto-Collector**: Conveyor belt model with moving parts
- **Armory**: Turret platform with rotating barrel
- **Cosmetics**: Actually change the station floor material, wall models, lighting color, place furniture models, add exterior decorations, toggle ambient particle effects

---

## Phase 11: Offline Progress

When a player loads their save:

1. Calculate `offlineSeconds = os.time() - lastSaveTime`
2. **Refiner progress**: Simulate refiner ticking for offlineSeconds. For each refiner with ore, calculate how many bars would have been produced and either add them as barsReady or auto-collect them.
3. **Drone production**: If drones > 0 and offlineSeconds > 5: calculate cycles = floor(offlineSeconds / 5). For each cycle, each drone produces one full ore worth of bars (simplified: add yield directly to bar inventory). Cap at 100 cycles.
4. Show "Welcome back! (Xs offline)" message with summary of offline gains.

---

## Phase 12: UI Implementation

### 12.1 HUD (Top Bar)

- Game title
- Time played (MM:SS)
- Carrying: X/Y
- HP bar + text
- Shield bar + text (hidden if max shield = 0)
- Save / Reset buttons

### 12.2 Side Panel (Left)

- **Bar Inventory**: 7 rows, each with colored dot + name + count
- **Salvage**: Dedicated row below bars with silver icon + count (only shown if armory built OR salvage > 0)
- **Refiners**: List of player refiners with progress bars + collect buttons
- **Drone Refiners**: Separate section (hidden if no drones), same format
- **Status**: Drone count/tier, auto-collect interval
- **Log**: Last 8 game events with colored text

### 12.3 Upgrade Panel (Below Field)

- Two-column grid: Mining | Buildings
- Below: Combat / Cosmetics tabs
- Each upgrade card: name, level, current effect, next effect, cost, buy button
- Buy button disabled + shows "Dock to buy" when not at port

### 12.4 Floating Text & Particles

- Damage numbers float up and fade
- Mining hit numbers
- Ore pickup notifications
- Death/respawn text
- All rendered as BillboardGuis or particle emitters

---

## Phase 13: RemoteEvents & RemoteFunctions

### Events (Client → Server)

| Name | Purpose | Params |
|------|---------|--------|
| `MineHit` | Player used mining tool on asteroid | asteroidId |
| `PickupOre` | Player triggered ore pickup prompt | oreDropId |
| `PickupSalvage` | Player collected a salvage drop | salvageDropId |
| `PurchaseUpgrade` | Buy an upgrade | category, level, subIdx |
| `CollectBar` | Collect from refiner | refinerIndex, isDrone |
| `DepositOre` | Deposit carried ore | (none) |
| `SaveGame` | Manual save | (none) |
| `ResetGame` | Reset progress | (none) |

Note: Mining and ore pickup can also be handled via ProximityPrompt.Triggered (server event) instead of RemoteEvents, which provides built-in range validation.

### Events (Server → Client)

| Name | Purpose | Data |
|------|---------|------|
| `StateUpdate` | Full or partial state sync | state table |
| `FloatingText` | Show damage/pickup text | position, text, color |
| `ParticleEffect` | Spawn particles | position, color, count |
| `AsteroidUpdate` | Asteroid state change | asteroidId, alive, hasOre, hitsLeft |
| `EnemySync` | Enemy positions/HP | enemy list snapshot |
| `SalvageDrop` | Spawn a salvage orb | dropId, position, amount |
| `SalvageCollected` | Orb picked up | dropId |
| `LogMessage` | Add to game log | text, color |

---

## Implementation Order (Suggested)

Build and test each phase before moving on:

1. **Config data** — All ModuleScripts with game constants
2. **World setup** — Station, asteroid placement, ground plane, skybox
3. **Player state + DataStore** — Save/load framework
4. **Player setup** — Mining tool, speed upgrade integration, port zone detection
5. **Asteroid mining** — Click/interact, damage, destroy, ore drops
6. **Ore pickup + deposit** — Carrying, ProximityPrompts, port auto-deposit
7. **Refiner system** — Drip-feed bars, collect buttons
8. **UI: HUD + side panel** — HP, inventory, refiners, log
9. **Upgrade system** — Purchase flow, all upgrade trees
10. **UI: Upgrade panel** — Mining/Buildings columns, tabs
11. **Drone system** — Drone refiners, auto-mine
12. **Auto-collector** — Timer-based collection
13. **Enemy system** — Spawn, patrol, aggro, attack
14. **Combat system** — Player weapons, projectiles, damage
15. **Salvage drops** — Spawn orb on enemy death, pickup, inventory tracking
16. **Death/respawn** — Explosion, teleport to port, invulnerability blink
17. **Station visuals** — 3D station that grows with upgrades
18. **Cosmetics** — Visual changes to station
19. **Offline progress** — Calculate gains on load
20. **Polish** — Sound effects, music, particle tuning, UI animations

---

## Key Differences from HTML Prototype

| Aspect | HTML Prototype | Roblox Version |
|--------|---------------|----------------|
| View | 2D top-down canvas | 3D third-person camera (standard Roblox) |
| Player | Triangle ship sprite | Roblox avatar (standard character) |
| Movement | Click-to-move, custom interpolation | WASD + mouse look (default Roblox controls) |
| Mining | Click asteroid anywhere on canvas | Walk to asteroid + click with mining tool |
| Asteroids | 2D shapes | 3D rock meshes |
| Enemies | 2D diamonds | 3D enemy models |
| Station | 2D diorama canvas | 3D in-world buildings |
| Save | LocalStorage | Roblox DataStore |
| Multiplayer | Single player | Can support multiplayer (each player has own asteroid instances or shared field) |
| Input | Mouse click on canvas | WASD movement + click/ProximityPrompt interactions |
| UI | DOM/HTML | Roblox ScreenGui |

---

## Multiplayer Considerations

The prototype is single-player but Roblox is inherently multiplayer. Options:

1. **Shared field, private economy**: All players see the same asteroids and can mine them (first-come-first-served for ore drops). Each player has their own station, refiners, upgrades, and bars. Enemies attack whoever is nearest.

2. **Instanced fields**: Each player gets their own asteroid field instance (using teleport service or zoning). Fully independent gameplay. Simpler to implement.

3. **Cooperative**: Players share a station and collaborate on upgrades. More complex.

**Recommendation for prototype**: Option 1 (shared field, private economy). It's the simplest and most natural for Roblox. Asteroid respawns are per-server, ore drops are per-player (each player gets their own drop when they destroy an asteroid).
