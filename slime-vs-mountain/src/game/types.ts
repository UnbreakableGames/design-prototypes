export const WORLD = {
  width: 960,
  height: 540,
  groundY: 460,
  dropoffX: 110,
  dropoffWidth: 80,
  spitterX: 280,
  runnerHomeX: 80,
  runnerSpacing: 22,
  mountainX: 720,
  mountainWidth: 240,
  collectionPanelH: 64,
} as const;

export const SLOT_LIMITS = {
  // Players start with ONE spitter slot (filled by the starter green bee in
  // FTUE step 1) and ZERO runner slots. The first skill-tree purchase grants
  // a runner slot; subsequent perks add more spitter + runner capacity.
  spitter: 1,
  runner: 0,
} as const;

export type SlotType = 'spitter' | 'runner';

// === Rarity ===
// 19 tiers matching the Slime RNG-style ladder. The bottom 5 (common→legendary)
// are populated by the existing roster; higher tiers were added for the 50-
// variant expansion. RARITY_LUCK_DIVISOR controls how much each variant tier
// benefits from luck — smaller divisor = luck moves the needle harder.
export type Rarity =
  | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  | 'mythic' | 'divine' | 'prismatic' | 'transcendent' | 'ethereal'
  | 'secret' | 'celestial' | 'astral' | 'nova' | 'solar' | 'lunar'
  | 'galactic' | 'stellar';
export const RARITIES: Rarity[] = [
  'common', 'uncommon', 'rare', 'epic', 'legendary',
  'mythic', 'divine', 'prismatic', 'transcendent', 'ethereal',
  'secret', 'celestial', 'astral', 'nova', 'solar', 'lunar',
  'galactic', 'stellar',
];

export const RARITY_NAMES: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
  mythic: 'Mythic',
  divine: 'Divine',
  prismatic: 'Prismatic',
  transcendent: 'Transcendent',
  ethereal: 'Ethereal',
  secret: 'Secret',
  celestial: 'Celestial',
  astral: 'Astral',
  nova: 'Nova',
  solar: 'Solar',
  lunar: 'Lunar',
  galactic: 'Galactic',
  stellar: 'Stellar',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  common:       '#a8b0c0',
  uncommon:     '#5af04a',
  rare:         '#5aaaff',
  epic:         '#b070ff',
  legendary:    '#ffaa28',
  mythic:       '#ff4848',
  divine:       '#ffe080',
  prismatic:    '#80e8ff',
  transcendent: '#a0a0ff',
  ethereal:     '#e0a0ff',
  secret:       '#404060',
  celestial:    '#fff0a8',
  astral:       '#4080ff',
  nova:         '#ff7040',
  solar:        '#ffd028',
  lunar:        '#d0d0e8',
  galactic:     '#8040c0',
  stellar:      '#ffffff',
};

// Sol's-RNG-style luck. weight = (1 / variant.rollN) * (1 + luck / divisor).
// Smaller divisor = luck makes that tier MUCH more likely. Common is flat.
export const RARITY_LUCK_DIVISOR: Record<Rarity, number> = {
  common:       Infinity,
  uncommon:     200,
  rare:         100,
  epic:         50,
  legendary:    25,
  mythic:       15,
  divine:       10,
  prismatic:    7,
  transcendent: 5,
  ethereal:     4,
  secret:       3,
  celestial:    2.5,
  astral:       2,
  nova:         1.5,
  solar:        1.2,
  lunar:        1,
  galactic:     0.8,
  stellar:      0.6,
};

// Die face the dice settles on when the rolled rarity is X. Only 6 die faces,
// so anything above legendary clamps to face 6 (the "wow" face).
export const RARITY_FACE: Record<Rarity, number> = {
  common:       1,
  uncommon:     2,
  rare:         3,
  epic:         4,
  legendary:    5,
  mythic:       6,
  divine:       6,
  prismatic:    6,
  transcendent: 6,
  ethereal:     6,
  secret:       6,
  celestial:    6,
  astral:       6,
  nova:         6,
  solar:        6,
  lunar:        6,
  galactic:     6,
  stellar:      6,
};

// === Variants (42 slimes — common → lunar ladder, Slime RNG-style) ===
export type SlimeVariantId =
  // common (5) — kept the variants with distinct stats; plain ones cut
  | 'green' | 'sprout' | 'mudder' | 'twig' | 'mossy'
  // uncommon (4) — kept the ones with a projectile/ability or hauler role
  | 'purple' | 'amber' | 'mint' | 'cobalt'
  // rare (6)
  | 'frost' | 'magma' | 'storm' | 'sapphire' | 'emerald' | 'ruby'
  // epic (4)
  | 'onyx' | 'quartz' | 'phantom' | 'titanium'
  // legendary (2)
  | 'diamond' | 'void'
  // mythic (3)
  | 'lucky' | 'crafty' | 'pondy'
  // divine (3)
  | 'icy' | 'aegis' | 'wicked'
  // prismatic (3)
  | 'ninja' | 'geode' | 'stormy'
  // transcendent (2)
  | 'bucky' | 'unicorn'
  // ethereal (2)
  | 'wizzy' | 'halo'
  // secret (2)
  | 'ufo' | 'blackhole'
  // celestial (2)
  | 'sharky' | 'dino'
  // astral (1)
  | 'drakey'
  // nova (1)
  | 'galaxy'
  // solar (1)
  | 'meaty'
  // lunar (1)
  | 'zappy';

// === Projectile / damage / ability types ===
export type ProjectileKind =
  | 'bullet'      // basic arc shot (default)
  | 'spear'       // straight line, no gravity, pierces 2 cliff hits
  | 'cannonball'  // slow heavy, screen shake
  | 'lazer'       // instant beam to cliff
  | 'cluster'     // splits mid-flight into 3 bullets
  | 'mortar'      // high arc; fragments on impact
  | 'pinball'     // bounces between cliff and an air ceiling (up to 5 hits)
  | 'ricochet'    // hits, then jumps to a second cliff spot
  | 'driller'     // embeds in cliff, ticks damage
  | 'bouncer'     // rebounds off cliff several times
  | 'boomerang'   // arcs out, then returns to spitter
  | 'orbiter'     // parks in front of cliff, rapid contact damage
  | 'skip';       // skipping stone — ground bounces then cliff hit

export type DamageType = 'physical' | 'burn' | 'frost' | 'lightning' | 'void';

export type RunnerAbility = 'sprinter' | 'sorter' | 'magnet' | 'vacuum';

export interface SlimeVariant {
  id: SlimeVariantId;
  name: string;
  rarity: Rarity;
  /** "1-in-N" rarity denominator shown in tooltips and result reveals.
   *  Lower = more common. Combined with luck to bias the weighted roll. */
  rollN: number;
  body: string;
  highlight: string;
  size: number;
  // Spitter-role stats
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  // Runner-role stats
  moveSpeed: number;
  carryCapacity: number;
  pickupTime: number;
  dropoffTime: number;
  // Optional mechanic overrides (default: bullet / physical / no crit / no ability)
  projectile?: ProjectileKind;
  damageType?: DamageType;
  critChance?: number;          // 0..1 — chance to deal 2x damage
  runnerAbility?: RunnerAbility;
  /** Anti-goon "hunter" variants prioritize aiming at goons and deal 2× damage to them. */
  antiGoon?: boolean;
}

// Global pacing knobs — applied inside v() so per-variant numbers in the table
// below read as "design intent." Tweak these to make the whole roster feel
// faster or slower without rewriting every entry.
const FIRE_RATE_SCALE = 0.4;
const MOVE_SPEED_SCALE = 0.6;

// Compact constructor so the table below stays readable.
function v(
  id: SlimeVariantId,
  name: string,
  rarity: Rarity,
  rollN: number,
  body: string,
  highlight: string,
  size: number,
  dmg: number,
  rate: number,
  proj: number,
  speed: number,
  cap: number,
  pick: number,
  drop: number,
  extras: Partial<Pick<SlimeVariant, 'projectile' | 'damageType' | 'critChance' | 'runnerAbility' | 'antiGoon'>> = {}
): SlimeVariant {
  return {
    id, name, rarity, rollN, body, highlight, size,
    damage: dmg,
    fireRate: rate * FIRE_RATE_SCALE,
    projectileSpeed: proj,
    moveSpeed: speed * MOVE_SPEED_SCALE,
    carryCapacity: cap,
    pickupTime: pick, dropoffTime: drop,
    ...extras,
  };
}

export const SLIME_VARIANTS: Record<SlimeVariantId, SlimeVariant> = {
  // ============ COMMON (5) ============   (1-in-N: 10 → 17)
  green:   v('green',   'Greenie',  'common', 10, '#4ec97a', '#7fe39d', 28, 2, 1.2, 420, 100, 1, 0.55, 0.45),
  sprout:  v('sprout',  'Sprout',   'common', 12, '#a8d878', '#cef098', 28, 2, 1.0, 400, 90,  2, 0.60, 0.50),
  mudder:  v('mudder',  'Mudder',   'common', 14, '#8a6b3a', '#a88a5a', 30, 3, 0.8, 350, 80,  1, 0.60, 0.50),
  twig:    v('twig',    'Twig',     'common', 16, '#b89968', '#d8b988', 24, 1, 2.0, 460, 130, 1, 0.45, 0.35),
  mossy:   v('mossy',   'Mossy',    'common', 17, '#5a8a4a', '#7faa68', 29, 2, 1.0, 380, 85,  2, 0.55, 0.45),

  // ============ UNCOMMON (4) ============   (1-in-N: 100 → 200)
  purple:  v('purple',  'Heavy',    'uncommon', 100, '#b070ff', '#d3a8ff', 34, 7, 0.7, 360, 60,  1, 0.70, 0.55, { projectile: 'cannonball' }),
  amber:   v('amber',   'Hauler',   'uncommon', 100, '#ffb84a', '#ffd793', 30, 1, 0.6, 360, 170, 3, 0.40, 0.18),
  mint:    v('mint',    'Mint',     'uncommon', 130, '#8af0c0', '#b8f8d8', 28, 1, 0.8, 360, 200, 2, 0.42, 0.20, { runnerAbility: 'sprinter' }),
  cobalt:  v('cobalt',  'Cobalt',   'uncommon', 200, '#4080d0', '#70a8e0', 27, 3, 1.4, 480, 110, 1, 0.50, 0.40, { projectile: 'spear', antiGoon: true }),

  // ============ RARE ============   (1-in-N: 500 → 1500)
  frost:    v('frost',    'Frost',    'rare', 500,  '#b0e8ff', '#d8f0ff', 28, 4,  1.5, 540, 100, 1, 0.50, 0.40, { projectile: 'ricochet', damageType: 'frost' }),
  magma:    v('magma',    'Magma',    'rare', 600,  '#ff5028', '#ff8060', 34, 10, 0.6, 380, 60,  1, 0.70, 0.60, { projectile: 'mortar', damageType: 'burn' }),
  storm:    v('storm',    'Storm',    'rare', 700,  '#8a90ff', '#b0b8ff', 28, 4,  1.8, 500, 90,  1, 0.55, 0.45, { projectile: 'pinball', damageType: 'lightning' }),
  sapphire: v('sapphire', 'Sapphire', 'rare', 900,  '#4078ff', '#7098ff', 30, 6,  1.2, 480, 80,  1, 0.60, 0.50, { projectile: 'spear', critChance: 0.25, antiGoon: true }),
  emerald:  v('emerald',  'Emerald',  'rare', 1200, '#00d870', '#40e898', 30, 2,  0.8, 380, 200, 4, 0.35, 0.18, { runnerAbility: 'sorter' }),
  ruby:     v('ruby',     'Ruby',     'rare', 1500, '#ff2840', '#ff6878', 34, 12, 0.5, 360, 50,  1, 0.80, 0.70, { projectile: 'driller', antiGoon: true }),

  // ============ EPIC ============   (1-in-N: 3000 → 8000)
  onyx:     v('onyx',     'Onyx',     'epic', 3000, '#4a3a5a', '#7a6a8a', 36, 18, 0.5, 380, 60,  1, 0.75, 0.65, { projectile: 'bouncer', damageType: 'void' }),
  quartz:   v('quartz',   'Quartz',   'epic', 4500, '#c8d0e8', '#e0e8f8', 28, 8,  2.0, 540, 110, 1, 0.45, 0.35, { projectile: 'boomerang', critChance: 0.30, antiGoon: true }),
  phantom:  v('phantom',  'Phantom',  'epic', 6000, '#b070c8', '#d098e0', 30, 6,  1.3, 460, 180, 3, 0.40, 0.25, { projectile: 'orbiter', damageType: 'void', antiGoon: true }),
  titanium: v('titanium', 'Titanium', 'epic', 8000, '#a0a8b8', '#c0c8d8', 32, 3,  0.8, 380, 150, 6, 0.40, 0.20, { runnerAbility: 'magnet' }),

  // ============ LEGENDARY ============   (1-in-N: 25k, 50k)
  diamond: v('diamond', 'Diamond', 'legendary', 25000, '#80e8ff', '#c8f8ff', 30, 12, 2.0, 600, 200, 4, 0.30, 0.15, { projectile: 'skip', critChance: 0.40 }),
  void:    v('void',    'Void',    'legendary', 50000, '#6020a0', '#9050c8', 36, 25, 1.0, 500, 220, 5, 0.30, 0.15, { projectile: 'lazer', damageType: 'void', runnerAbility: 'vacuum' }),

  // ============ MYTHIC ============   (1-in-N: ~20k → ~60k)
  lucky:   v('lucky',   'Lucky',   'mythic', 21500, '#ffe060', '#fff0a0', 32, 40, 1.2, 540, 130, 2, 0.45, 0.30, { critChance: 0.30 }),
  crafty:  v('crafty',  'Crafty',  'mythic', 35000, '#80f0a0', '#b0ffc0', 32, 45, 1.0, 500, 240, 4, 0.40, 0.20, { runnerAbility: 'sorter' }),
  pondy:   v('pondy',   'Pondy',   'mythic', 55000, '#5090c0', '#80b0e0', 32, 50, 1.2, 460, 140, 2, 0.45, 0.30, { projectile: 'ricochet', damageType: 'frost' }),

  // ============ DIVINE ============   (1-in-N: ~85k → ~350k)
  icy:     v('icy',     'Icy',     'divine', 86000,  '#a0f0ff', '#d0faff', 34, 70, 1.4, 540, 150, 2, 0.45, 0.30, { projectile: 'ricochet', damageType: 'frost', antiGoon: true }),
  aegis:   v('aegis',   'Aegis',   'divine', 215000, '#c0c8d8', '#e0e8f8', 36, 100, 0.8, 420, 100, 2, 0.55, 0.40, { critChance: 0.25 }),
  wicked:  v('wicked',  'Wicked',  'divine', 326000, '#7a40c0', '#a070d8', 34, 110, 1.0, 480, 130, 2, 0.50, 0.35, { projectile: 'driller', damageType: 'void' }),

  // ============ PRISMATIC ============   (1-in-N: ~500k → ~3M)
  ninja:   v('ninja',   'Ninja',   'prismatic', 1260000, '#404050', '#707080', 34, 180, 1.6, 600, 160, 2, 0.40, 0.25, { projectile: 'spear', critChance: 0.40, antiGoon: true }),
  geode:   v('geode',   'Geode',   'prismatic', 2150000, '#a070ff', '#d0a8ff', 36, 200, 0.9, 460, 280, 4, 0.45, 0.20, { runnerAbility: 'magnet' }),
  stormy:  v('stormy',  'Stormy',  'prismatic', 3070000, '#80a0ff', '#b0c8ff', 34, 220, 1.4, 540, 150, 2, 0.50, 0.30, { projectile: 'pinball', damageType: 'lightning' }),

  // ============ TRANSCENDENT ============   (1-in-N: ~5M → ~20M)
  bucky:   v('bucky',   'Bucky',   'transcendent', 4780000,  '#e0c060', '#fff090', 38, 300, 1.0, 520, 200, 3, 0.45, 0.25, { projectile: 'boomerang', critChance: 0.30 }),
  unicorn: v('unicorn', 'Unicorn', 'transcendent', 17900000, '#ffb0e0', '#ffe0f0', 38, 350, 1.2, 580, 320, 5, 0.40, 0.20, { runnerAbility: 'vacuum', critChance: 0.20 }),

  // ============ ETHEREAL ============   (1-in-N: ~25M → ~200M)
  wizzy:   v('wizzy',   'Wizzy',   'ethereal', 26900000,  '#7048d0', '#a880ff', 38, 500, 1.0, 520, 200, 2, 0.40, 0.25, { projectile: 'orbiter', damageType: 'void', critChance: 0.35 }),
  halo:    v('halo',    'Halo',    'ethereal', 195000000, '#fff0a0', '#fff8d0', 38, 600, 1.4, 580, 220, 3, 0.40, 0.20, { projectile: 'lazer', critChance: 0.40, antiGoon: true }),

  // ============ SECRET ============   (1-in-N: ~300M → ~5B)
  ufo:       v('ufo',       'UFO',       'secret', 478000000,  '#80c0c0', '#b0f0f0', 40, 900,  1.6, 620, 260, 3, 0.35, 0.18, { projectile: 'orbiter', damageType: 'lightning', critChance: 0.35 }),
  blackhole: v('blackhole', 'Blackhole', 'secret', 1070000000, '#101020', '#404060', 42, 1200, 0.7, 460, 300, 4, 0.40, 0.20, { projectile: 'driller', damageType: 'void',      runnerAbility: 'vacuum' }),

  // ============ CELESTIAL ============   (1-in-N: ~6B → ~50B)
  sharky: v('sharky', 'Sharky', 'celestial', 6470000000,  '#406080', '#7090b0', 42, 1800, 1.0, 540, 280, 3, 0.40, 0.22, { projectile: 'driller', critChance: 0.40, antiGoon: true }),
  dino:   v('dino',   'Dino',   'celestial', 10100000000, '#60a060', '#90d090', 44, 2400, 0.8, 480, 360, 5, 0.40, 0.20, { projectile: 'cannonball', critChance: 0.35 }),

  // ============ ASTRAL ============   (1-in-N: ~75B)
  drakey: v('drakey', 'Drakey', 'astral', 74300000000, '#c04050', '#f08090', 44, 4000, 1.0, 560, 380, 4, 0.35, 0.18, { projectile: 'mortar', damageType: 'burn', critChance: 0.45 }),

  // ============ NOVA ============   (1-in-N: ~7T)
  galaxy: v('galaxy', 'Galaxy', 'nova', 6950000000000, '#4030a0', '#a070ff', 46, 7000, 1.2, 600, 480, 5, 0.30, 0.15, { projectile: 'lazer', damageType: 'void', critChance: 0.50, runnerAbility: 'vacuum', antiGoon: true }),

  // ============ SOLAR ============   (1-in-N: ~40T)
  meaty: v('meaty', 'Meaty', 'solar', 43000000000000, '#ff4040', '#ffa080', 48, 14000, 1.5, 640, 600, 6, 0.30, 0.15, { projectile: 'mortar', damageType: 'burn', critChance: 0.50, antiGoon: true }),

  // ============ LUNAR ============   (1-in-N: ~100T)
  zappy: v('zappy', 'Zappy', 'lunar', 100000000000000, '#fff060', '#ffffd0', 50, 24000, 2.0, 700, 800, 7, 0.25, 0.12, { projectile: 'pinball', damageType: 'lightning', critChance: 0.60, runnerAbility: 'magnet', antiGoon: true }),
};

// Pool of variant ids per rarity, built at module init.
export const VARIANTS_BY_RARITY: Record<Rarity, SlimeVariantId[]> = {
  common: [], uncommon: [], rare: [], epic: [], legendary: [],
  mythic: [], divine: [], prismatic: [], transcendent: [], ethereal: [],
  secret: [], celestial: [], astral: [], nova: [], solar: [], lunar: [],
  galactic: [], stellar: [],
};
for (const k of Object.keys(SLIME_VARIANTS) as SlimeVariantId[]) {
  VARIANTS_BY_RARITY[SLIME_VARIANTS[k].rarity].push(k);
}

// All variants, used for slot-machine reel filler.
export const ALL_VARIANT_IDS: SlimeVariantId[] = Object.keys(SLIME_VARIANTS) as SlimeVariantId[];

/** One entry per variant the player has ever owned. Replaces the old
 *  per-copy OwnedSlime model — Slime RNG–style stack inventory. Each
 *  copy in `count` shares the same `level` / `xp`. */
export interface VariantState {
  variantId: SlimeVariantId;
  /** How many copies the player currently has. */
  count: number;
  /** Lifetime number of times this variant has been rolled. Drives the
   *  Index milestone reward system. Never decreases. */
  timesRolled: number;
  /** How many copies of this variant are currently sitting in slots. */
  slotted: number;
  /** Shared combat level across all copies of this variant. */
  level: number;
  /** XP accumulated toward the next level. Earned by feeding food drops. */
  xp: number;
}

/** XP needed to advance from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return level * 100;
}

// === Mutations — archived 2026-05-18 ===
// The Slime RNG-style Big / Shiny / Huge / Inverted tier system was built and
// then stripped from the active code to focus on base variants. Full design
// notes (data model, roll math, tree integration, visual treatments) live in
// docs/MUTATIONS.md and the system can be restored from git history.

/** Damage / move / carry multiplier from the variant's shared level. */
export function levelMul(level: number): number {
  return 1 + (level - 1) * 0.15;
}

// === Index milestones ===
export type MilestoneReward =
  | { kind: 'gold'; amount: number }
  | { kind: 'gems'; amount: number }
  | { kind: 'essence'; amount: number }
  | { kind: 'luck'; amount: number };

export interface Milestone {
  /** Distinct-variants threshold. */
  threshold: number;
  reward: MilestoneReward;
}

// === Food drops (XP feeders) ===
export type FoodKind = 'cheese' | 'egg' | 'drumstick' | 'pizza';

export interface FoodSpec {
  kind: FoodKind;
  name: string;
  /** XP granted to the selected variant when fed. */
  xp: number;
  /** 1-in-N roll on each mountain impact. Rarer = more XP. */
  rollN: number;
  color: string;
  outline: string;
  /** Hit-test radius and visual size in pixels. */
  size: number;
}

export const FOOD_SPECS: Record<FoodKind, FoodSpec> = {
  cheese:    { kind: 'cheese',    name: 'Cheese',    xp: 25,  rollN: 80,   color: '#ffd84a', outline: '#a07028', size: 12 },
  egg:       { kind: 'egg',       name: 'Egg',       xp: 50,  rollN: 200,  color: '#fff0d0', outline: '#a08858', size: 13 },
  drumstick: { kind: 'drumstick', name: 'Drumstick', xp: 150, rollN: 1000, color: '#c0823a', outline: '#5a3818', size: 15 },
  pizza:     { kind: 'pizza',     name: 'Pizza',     xp: 400, rollN: 5000, color: '#ff7a40', outline: '#783820', size: 17 },
};

export const ALL_FOOD_KINDS: FoodKind[] = ['cheese', 'egg', 'drumstick', 'pizza'];

/** Roll a food drop on a mountain impact. Each kind requires its matching
 *  Unlock perk to be owned — locked kinds simply don't roll. If several
 *  succeed the rarest one wins so the player gets the better feedback. */
export function pickFoodDrop(allowed: Set<FoodKind>): FoodSpec | null {
  let best: FoodSpec | null = null;
  for (const kind of ALL_FOOD_KINDS) {
    if (!allowed.has(kind)) continue;
    const spec = FOOD_SPECS[kind];
    if (Math.random() < 1 / spec.rollN) {
      if (!best || spec.rollN > best.rollN) best = spec;
    }
  }
  return best;
}

/** Generated, effectively-endless milestone ladder for the Bag O Bees.
 *  Each entry is the cumulative `bagProgress` the player needs to claim it.
 *  Progress is earned per roll: +10 for a brand-new variant, +1 for a
 *  duplicate. Thresholds grow ~1.6× per tier so each milestone takes
 *  meaningfully longer than the last; rewards cycle pollen → gems → luck →
 *  essence and scale with the tier.
 *
 *  100 entries is "effectively infinite" — the last threshold is in the
 *  billions of progress, which a player would never reach. Generated at
 *  module load so the rest of the code keeps treating this as a static
 *  ladder. */
const BAG_REWARD_TYPES: MilestoneReward['kind'][] = ['gold', 'gems', 'luck', 'essence'];
function buildBagMilestones(): Milestone[] {
  const out: Milestone[] = [];
  for (let i = 1; i <= 100; i++) {
    const threshold = Math.round(10 * Math.pow(1.6, i - 1));
    const kind = BAG_REWARD_TYPES[(i - 1) % BAG_REWARD_TYPES.length]!;
    const tier = Math.floor((i - 1) / BAG_REWARD_TYPES.length) + 1; // 1, 2, 3 …
    let amount: number;
    switch (kind) {
      case 'gold':    amount = 30 * tier * i;       break;
      case 'gems':    amount = 2 * tier * i;         break;
      case 'luck':    amount = 1 * tier * i;        break;
      case 'essence': amount = tier;                 break;
    }
    out.push({ threshold, reward: { kind, amount } as MilestoneReward });
  }
  return out;
}

export const INDEX_MILESTONES: Milestone[] = buildBagMilestones();

// === Status effects (applied by mountain goons to runners) ===
export type StatusKind = 'stun' | 'slow' | 'blind' | 'burn' | 'tangle' | 'drain' | 'drop';

// === Cliff effects (area DoT patches on the mountain) ===
export type CliffEffectKind = 'burn' | 'frost';

export interface CliffEffect {
  id: number;
  x: number;
  y: number;
  radius: number;
  kind: CliffEffectKind;
  intensity: number; // burn stacks (1..6); frost is just 1
  timeLeft: number;
  tickT: number;     // burn DoT tick timer
}

export interface GoonConfig {
  name: string;
  bodyColor: string;     // dark themed slime body
  attackColor: string;   // projectile / effect color
  status: StatusKind;
  statusDuration: number;
  statusValue: number;   // e.g. slow = 0.5 (50% speed), burn = 2 (pickup mul)
  attackInterval: number; // seconds between attacks
}

/** Per-theme art recipe for the tree on the right. The renderer reads this
 *  instead of hard-coding the green-cherry visual, so each theme can paint
 *  its own canopy, trunk, flowers, and accent decoration. */
export interface TreeArt {
  /** Canopy leaf cluster colors — back / mid / highlight, painted in that order. */
  canopyBack: string;
  canopyMid: string;
  canopyHi: string;
  /** Trunk body + vertical bark stripe. */
  trunkBody: string;
  trunkBark: string;
  /** Colors used for the decorative flowers/dots sprinkled on the canopy.
   *  Pass an empty array to draw none. */
  flowerPalette: string[];
  /** Color of the tiny pollen center on each flower (when flowerPalette is non-empty). */
  flowerCore: string;
  /** Light/glow color used when the tree takes a hit. */
  hitGlow: string;
  /** Extra theme-specific decoration painted on top of the canopy. */
  accent: 'none' | 'honeyDrips' | 'embers' | 'icicles' | 'resinDrips' | 'shadowGlints';
  /** Color of the accent decoration. */
  accentColor: string;
}

// === Mountain themes ===
// Each mountain level is themed. After beating a level the mountain visually
// shifts and gets harder. Loops after the last theme at escalated HP.
export interface MountainTheme {
  name: string;
  bodyGradLeft: string;
  bodyGradMid: string;
  bodyGradRight: string;
  crackColor: string;
  bgRidge: string;
  skyTop: string;
  skyBottom: string;
  gemChance: number;     // % chance a drop is a gem instead of gold
  hpMul: number;         // HP multiplier vs. baseline (cumulative on respawn)
  goon: GoonConfig;
  maxGoons: number;          // up to N goons can be alive at once
  goonSpawnInterval: number; // seconds between new-goon spawns
  /** Mines are passive — they don't attack runners. When destroyed they
   *  drop a guaranteed gem burst + big gold pieces. Use them as the steady
   *  gem-income lever. */
  maxMines: number;
  mineSpawnInterval: number;
  /** Visual recipe for the tree this theme paints. */
  treeArt: TreeArt;
}

export const MOUNTAIN_THEMES: MountainTheme[] = [
  // Each "mountain" is a flavored environment — kept abstract (Verdant, Amber,
  // Ember…) rather than naming a specific tree species, so the visuals can
  // shift later without renaming the world. The variety axis stays the same
  // (different status effect per theme) so we have hooks for the future
  // rock-paper-scissors mechanic between bee variants and environments.
  // bodyGrad*/crackColor/bgRidge are legacy fields the new tree renderer
  // doesn't use, but they're preserved for save/load compat + the sky
  // gradient still reads `skyTop` and `skyBottom`.
  {
    name: 'Verdant',
    bodyGradLeft: '#4a7350',
    bodyGradMid: '#5a8460',
    bodyGradRight: '#2a4530',
    crackColor: 'rgba(0,0,0,0.32)',
    bgRidge: '#1b2a20',
    skyTop: '#1c2a2a',
    skyBottom: '#2a3c34',
    gemChance: 0.13,
    // Normal Verdant HP / enemy values. The VERY FIRST tree (totalKills===0)
    // gets a one-time override to a much lower HP + zero goons in Game.ts so
    // the brand-new player rushes to the rebirth FTUE; subsequent Verdant
    // trees use these full values.
    hpMul: 0.25,
    goon: {
      name: 'Vine Bee',
      bodyColor: '#2a4a2a',
      attackColor: '#6fd060',
      status: 'slow',
      statusDuration: 1.5,
      statusValue: 0.5,
      attackInterval: 4,
    },
    maxGoons: 3,
    goonSpawnInterval: 6,
    maxMines: 1,
    mineSpawnInterval: 18,
    treeArt: {
      canopyBack: '#2d6428',
      canopyMid: '#3f8a36',
      canopyHi: '#5fb04c',
      trunkBody: '#5a3a20',
      trunkBark: '#3a2410',
      flowerPalette: ['#ffb0e8', '#ffe0a0', '#ffffff', '#ff8060', '#ffd24a', '#ff7aa0'],
      flowerCore: '#ffd24a',
      hitGlow: 'rgba(220, 255, 180, ALPHA)',
      accent: 'none',
      accentColor: '#ffffff',
    },
  },
  {
    name: 'Amber',
    bodyGradLeft: '#a07840',
    bodyGradMid: '#c89858',
    bodyGradRight: '#6a4828',
    crackColor: 'rgba(80,40,10,0.35)',
    bgRidge: '#3a2818',
    skyTop: '#2a2018',
    skyBottom: '#3a2c1c',
    gemChance: 0.12,
    hpMul: 0.4,
    goon: {
      // Sticky sap makes the bee drop a loot piece on hit.
      name: 'Sticky Bee',
      bodyColor: '#5a3a18',
      attackColor: '#ffcc60',
      status: 'drop',
      statusDuration: 0,
      statusValue: 1,
      attackInterval: 4.5,
    },
    maxGoons: 3,
    goonSpawnInterval: 5.5,
    maxMines: 1,
    mineSpawnInterval: 17,
    treeArt: {
      canopyBack: '#7a5418',
      canopyMid: '#b07a24',
      canopyHi: '#e8b048',
      trunkBody: '#4a2e10',
      trunkBark: '#2a1a08',
      flowerPalette: ['#ffd86a', '#ffb84a', '#ffe09a'],
      flowerCore: '#a07020',
      hitGlow: 'rgba(255, 220, 140, ALPHA)',
      accent: 'honeyDrips',
      accentColor: '#ffcc60',
    },
  },
  {
    name: 'Blossom',
    bodyGradLeft: '#d878a8',
    bodyGradMid: '#f098c0',
    bodyGradRight: '#a04878',
    crackColor: 'rgba(255,180,220,0.45)',
    bgRidge: '#5a3048',
    skyTop: '#3a2030',
    skyBottom: '#4a2c40',
    gemChance: 0.14,
    hpMul: 1.6,
    goon: {
      // Cherry petals in the eyes — bees can't see to aim.
      name: 'Petal Bee',
      bodyColor: '#a04878',
      attackColor: '#ffc0e0',
      status: 'blind',
      statusDuration: 2,
      statusValue: 0,
      attackInterval: 5,
    },
    maxGoons: 4,
    goonSpawnInterval: 5,
    maxMines: 1,
    mineSpawnInterval: 16,
    treeArt: {
      canopyBack: '#a04878',
      canopyMid: '#e088b8',
      canopyHi: '#ffc0e0',
      trunkBody: '#4e2c30',
      trunkBark: '#2c1620',
      flowerPalette: ['#ffd0e8', '#ffffff', '#ffb0d8', '#ffe0f0'],
      flowerCore: '#ffd24a',
      hitGlow: 'rgba(255, 220, 240, ALPHA)',
      accent: 'none',
      accentColor: '#ffd0e8',
    },
  },
  {
    name: 'Ember',
    bodyGradLeft: '#4a2818',
    bodyGradMid: '#6a3020',
    bodyGradRight: '#2a1208',
    crackColor: 'rgba(255,120,40,0.45)',
    bgRidge: '#2a1410',
    skyTop: '#3a1c1a',
    skyBottom: '#1a0c0a',
    gemChance: 0.18,
    hpMul: 1.8,
    goon: {
      name: 'Ember Bee',
      bodyColor: '#5a1810',
      attackColor: '#ff6040',
      status: 'burn',
      statusDuration: 4,
      statusValue: 2,
      attackInterval: 4,
    },
    maxGoons: 4,
    goonSpawnInterval: 4.5,
    maxMines: 2,
    mineSpawnInterval: 15,
    treeArt: {
      canopyBack: '#3a0e08',
      canopyMid: '#74201a',
      canopyHi: '#c84a28',
      trunkBody: '#2a1208',
      trunkBark: '#100604',
      flowerPalette: ['#ff8040', '#ffa050', '#ffd06a'],
      flowerCore: '#ffe080',
      hitGlow: 'rgba(255, 180, 100, ALPHA)',
      accent: 'embers',
      accentColor: '#ff8040',
    },
  },
  {
    name: 'Glacial',
    bodyGradLeft: '#5a7080',
    bodyGradMid: '#7a8ea0',
    bodyGradRight: '#3a4858',
    crackColor: 'rgba(180,220,255,0.45)',
    bgRidge: '#1a2638',
    skyTop: '#1c2640',
    skyBottom: '#384a64',
    gemChance: 0.22,
    hpMul: 2.0,
    goon: {
      name: 'Frost Bee',
      bodyColor: '#3a5070',
      attackColor: '#b0e8ff',
      status: 'stun',
      statusDuration: 1.5,
      statusValue: 0,
      attackInterval: 5,
    },
    maxGoons: 4,
    goonSpawnInterval: 4.5,
    maxMines: 2,
    mineSpawnInterval: 14,
    treeArt: {
      canopyBack: '#2a4258',
      canopyMid: '#5a7e98',
      canopyHi: '#b0d4ec',
      trunkBody: '#3a4a58',
      trunkBark: '#1c2630',
      flowerPalette: ['#e8f4ff', '#b8e0f4', '#ffffff'],
      flowerCore: '#a8d8ec',
      hitGlow: 'rgba(200, 240, 255, ALPHA)',
      accent: 'icicles',
      accentColor: '#cfe8ff',
    },
  },
  {
    name: 'Resin',
    bodyGradLeft: '#5a3a7a',
    bodyGradMid: '#7a4ea0',
    bodyGradRight: '#3a2458',
    crackColor: 'rgba(200,160,255,0.55)',
    bgRidge: '#2a1838',
    skyTop: '#221a3a',
    skyBottom: '#3a2854',
    gemChance: 0.28,
    hpMul: 2.2,
    goon: {
      // Tree-resin gobs that snare bees mid-flight.
      name: 'Resin Bee',
      bodyColor: '#3a2458',
      attackColor: '#c8a0ff',
      status: 'tangle',
      statusDuration: 4,
      statusValue: 0.5,
      attackInterval: 5,
    },
    maxGoons: 5,
    goonSpawnInterval: 4,
    maxMines: 2,
    mineSpawnInterval: 13,
    treeArt: {
      canopyBack: '#3a2458',
      canopyMid: '#6a4290',
      canopyHi: '#a878d0',
      trunkBody: '#3a2a48',
      trunkBark: '#1c1228',
      flowerPalette: ['#d8b0ff', '#ffffff', '#b888d8'],
      flowerCore: '#e0c0ff',
      hitGlow: 'rgba(220, 180, 255, ALPHA)',
      accent: 'resinDrips',
      accentColor: '#c8a0ff',
    },
  },
  {
    name: 'Shadow',
    bodyGradLeft: '#1a0a2a',
    bodyGradMid: '#2a1240',
    bodyGradRight: '#0a0418',
    crackColor: 'rgba(180,120,255,0.6)',
    bgRidge: '#0a0418',
    skyTop: '#0c081a',
    skyBottom: '#1a1030',
    gemChance: 0.36,
    hpMul: 2.5,
    goon: {
      // Cursed yew drains the bee's pollen reserves on hit.
      name: 'Shade Bee',
      bodyColor: '#0a0418',
      attackColor: '#a060ff',
      status: 'drain',
      statusDuration: 3,
      statusValue: 0.5,
      attackInterval: 4,
    },
    maxGoons: 6,
    goonSpawnInterval: 3.5,
    maxMines: 3,
    mineSpawnInterval: 12,
    treeArt: {
      canopyBack: '#0c0418',
      canopyMid: '#221038',
      canopyHi: '#3a1c5a',
      trunkBody: '#1a0e28',
      trunkBark: '#080410',
      flowerPalette: ['#a060ff', '#d0a0ff', '#7048a8'],
      flowerCore: '#ffe0a0',
      hitGlow: 'rgba(180, 120, 255, ALPHA)',
      accent: 'shadowGlints',
      accentColor: '#a060ff',
    },
  },
];

// === Boss bees ===
// Limited-time mini-bosses that perch on certain trees. The player gets one
// shot per boss: kill it before the timer expires for a gem burst + free
// roll, otherwise it flees with no penalty (but no reward either). Each boss
// has a hand-picked set of "weak" variants — slotting one of them deals
// BOSS_WEAKNESS_MUL damage, which is usually the difference between winning
// in time and not. The weakness families are flavor-themed (frost beats
// ember, ember beats glacial, light beats shadow, etc.) so the player can
// reason about which bees to swap to.
export interface BossConfig {
  id: string;
  /** Display name in the banner. */
  name: string;
  /** Short flavor of what the weakness *theme* is, e.g. "Frost bees". */
  weaknessLabel: string;
  /** Variant ids that deal BOSS_WEAKNESS_MUL damage to this boss. */
  weakVariants: SlimeVariantId[];
  /** Player-shot damage types that also count as a weakness — once the player
   *  unlocks elemental shots, cycling to the matching type triggers the same
   *  BOSS_WEAKNESS_MUL bonus. Bosses without an elemental weakness leave this
   *  empty. */
  weakDamageTypes?: DamageType[];
  /** Multiplier on TOP of the per-mountain-level goon HP baseline. Bosses
   *  should take ~30–60s to kill with a weakness slotted, and longer than
   *  the time limit without one — so this is tuned to ~5–8×. */
  hpMul: number;
  /** Seconds the boss stays before fleeing. Player must finish it in time. */
  timeLimit: number;
  /** Dark body color for the oversized boss rig. */
  bodyColor: string;
  /** Accent / stripe / glow color (also used for the banner ring). */
  accentColor: string;
}

/** Damage multiplier when a projectile from a `weakVariants` bee hits the boss.
 *  This is the single knob that decides how strongly the player is incentivized
 *  to swap bees — bigger = swap-or-die, smaller = "nice to have." */
export const BOSS_WEAKNESS_MUL = 3;

/** Boss config per mountain theme name. One boss flavor per theme. */
export const BOSS_BY_THEME: Record<string, BossConfig> = {
  Verdant: {
    id: 'verdant_boss',
    name: 'Thornqueen',
    weaknessLabel: 'Green / leaf bees',
    weakVariants: ['green', 'sprout', 'mossy', 'mint', 'emerald', 'crafty'],
    hpMul: 6,
    timeLimit: 90,
    bodyColor: '#1a2818',
    accentColor: '#6fd060',
  },
  Amber: {
    id: 'amber_boss',
    name: 'Sapdrinker',
    weaknessLabel: 'Frost / cold bees',
    weakVariants: ['frost', 'icy', 'pondy', 'diamond'],
    weakDamageTypes: ['frost'],
    hpMul: 6,
    timeLimit: 90,
    bodyColor: '#3a1e0a',
    accentColor: '#ffcc60',
  },
  Blossom: {
    id: 'blossom_boss',
    name: 'Petal Tyrant',
    weaknessLabel: 'Bladed bees (spear / sharp)',
    weakVariants: ['cobalt', 'sapphire', 'ninja', 'quartz', 'halo'],
    hpMul: 6.5,
    timeLimit: 90,
    bodyColor: '#3a1828',
    accentColor: '#ffc0e0',
  },
  Ember: {
    id: 'ember_boss',
    name: 'Cinderhive',
    weaknessLabel: 'Frost / cold bees',
    weakVariants: ['frost', 'icy', 'pondy', 'diamond', 'sapphire'],
    weakDamageTypes: ['frost'],
    hpMul: 7,
    timeLimit: 90,
    bodyColor: '#2a0a04',
    accentColor: '#ff6040',
  },
  Glacial: {
    id: 'glacial_boss',
    name: 'Hoarfrost Drone',
    weaknessLabel: 'Burn / lava bees',
    weakVariants: ['magma', 'ruby', 'drakey', 'meaty'],
    weakDamageTypes: ['burn'],
    hpMul: 7,
    timeLimit: 90,
    bodyColor: '#1a2438',
    accentColor: '#b0e8ff',
  },
  Resin: {
    id: 'resin_boss',
    name: 'Sap Warden',
    weaknessLabel: 'Piercing bees (spear / driller)',
    weakVariants: ['cobalt', 'sapphire', 'ruby', 'ninja', 'wicked', 'sharky'],
    hpMul: 7.5,
    timeLimit: 90,
    bodyColor: '#1a0a28',
    accentColor: '#c8a0ff',
  },
  Shadow: {
    id: 'shadow_boss',
    name: 'Voidstinger',
    weaknessLabel: 'Light / holy bees',
    weakVariants: ['halo', 'diamond', 'lucky', 'aegis', 'unicorn'],
    weakDamageTypes: ['lightning'],
    hpMul: 8,
    timeLimit: 90,
    bodyColor: '#0a0410',
    accentColor: '#a060ff',
  },
};

/** Mountains-killed cadence for boss spawns. Boss appears on the player's
 *  Nth, 2Nth, 3Nth … kill (counted by `totalMountainsKilled`). Tutorial
 *  tree is skipped — boss spawns only on totalMountainsKilled >= BOSS_SPAWN_EVERY. */
export const BOSS_SPAWN_EVERY = 3;

export type LootKind = 'gold' | 'gem';
export type LootShape = 'coin' | 'gem';

/** A specific loot variant. `kind` decides which currency it converts to on
 *  delivery; `shape` is purely visual. Most "colored gems" are visually gem-
 *  shaped but functionally gold (the player sees variety but they all add up
 *  to one gold pool). Only the blue GEM_CURRENCY is a true gem (upgrade
 *  currency). */
export interface LootSpec {
  kind: LootKind;
  shape: LootShape;
  size: number;
  color: string;
  outline: string;
  value: number;
}

// Gold coins (various sizes). SMALL_GOLD is also exported as the "guaranteed"
// drop that every mountain impact gives at minimum.
export const SMALL_GOLD: LootSpec = { kind: 'gold', shape: 'coin', size: 4, color: '#ffd24a', outline: '#a87a10', value: 1 };
const MEDIUM_GOLD: LootSpec = { kind: 'gold', shape: 'coin', size: 5, color: '#ffe070', outline: '#9a6a10', value: 2 };
const LARGE_GOLD:  LootSpec = { kind: 'gold', shape: 'coin', size: 6, color: '#fff0a0', outline: '#806010', value: 5 };
const GOLD_BAR:    LootSpec = { kind: 'gold', shape: 'coin', size: 7, color: '#fff8c0', outline: '#605020', value: 12 };

// Colored gems — visually shiny but functionally gold currency (variety reward)
const PINK_GEM:    LootSpec = { kind: 'gold', shape: 'gem', size: 5, color: '#ff80a8', outline: '#a04060', value: 3 };
const GREEN_GEM:   LootSpec = { kind: 'gold', shape: 'gem', size: 5, color: '#80ff90', outline: '#308040', value: 4 };
const YELLOW_GEM:  LootSpec = { kind: 'gold', shape: 'gem', size: 5, color: '#fff060', outline: '#a08010', value: 4 };
const PURPLE_GEM:  LootSpec = { kind: 'gold', shape: 'gem', size: 5, color: '#c080ff', outline: '#604080', value: 6 };
const RUBY_GEM:    LootSpec = { kind: 'gold', shape: 'gem', size: 6, color: '#ff4040', outline: '#802020', value: 10 };
const ORANGE_GEM:  LootSpec = { kind: 'gold', shape: 'gem', size: 5, color: '#ff9040', outline: '#a05020', value: 5 };

// The ONE true gem currency (used by the skill tree's gem-priced perks)
export const GEM_CURRENCY: LootSpec = {
  kind: 'gem', shape: 'gem', size: 7, color: '#5af0ff', outline: '#208090', value: 1,
};

// Drop tables — relative weights within each pool
const MOUNTAIN_DROP_TABLE: Array<{ spec: LootSpec; weight: number }> = [
  { spec: SMALL_GOLD,  weight: 50 },
  { spec: MEDIUM_GOLD, weight: 25 },
  { spec: LARGE_GOLD,  weight: 8 },
  { spec: GOLD_BAR,    weight: 2 },
  { spec: PINK_GEM,    weight: 6 },
  { spec: GREEN_GEM,   weight: 6 },
  { spec: YELLOW_GEM,  weight: 4 },
  { spec: PURPLE_GEM,  weight: 3 },
  { spec: ORANGE_GEM,  weight: 3 },
  { spec: RUBY_GEM,    weight: 1 },
];

// Goon death — richer table (bigger gold, more colored gems)
const GOON_DROP_TABLE: Array<{ spec: LootSpec; weight: number }> = [
  { spec: MEDIUM_GOLD, weight: 25 },
  { spec: LARGE_GOLD,  weight: 20 },
  { spec: GOLD_BAR,    weight: 8 },
  { spec: PINK_GEM,    weight: 10 },
  { spec: GREEN_GEM,   weight: 10 },
  { spec: YELLOW_GEM,  weight: 8 },
  { spec: PURPLE_GEM,  weight: 7 },
  { spec: ORANGE_GEM,  weight: 7 },
  { spec: RUBY_GEM,    weight: 5 },
];

function weightedPick<T>(items: Array<{ spec: T; weight: number }>): T {
  let total = 0;
  for (const i of items) total += i.weight;
  let r = Math.random() * total;
  for (const i of items) {
    if (r < i.weight) return i.spec;
    r -= i.weight;
  }
  return items[items.length - 1]!.spec;
}

/** Roll a single loot drop from a mountain projectile hit. `gemChance` is the
 *  theme-defined chance that a drop is overridden to the true gem currency. */
export function pickMountainDrop(gemChance: number): LootSpec {
  if (Math.random() < gemChance) return GEM_CURRENCY;
  return weightedPick(MOUNTAIN_DROP_TABLE);
}

/** Roll a single loot drop from a goon death. Higher value, more colored
 *  variety, double the gem currency chance vs. mountain hits. */
export function pickGoonDrop(gemChance: number): LootSpec {
  if (Math.random() < Math.min(0.5, gemChance * 2.5)) return GEM_CURRENCY;
  return weightedPick(GOON_DROP_TABLE);
}

// Mine drop pool — only the chunkier stuff. Mines are the gem-income lever,
// so the caller always spawns N guaranteed gem currencies in addition to a
// burst from this table.
const MINE_DROP_TABLE: Array<{ spec: LootSpec; weight: number }> = [
  { spec: LARGE_GOLD, weight: 25 },
  { spec: GOLD_BAR,   weight: 20 },
  { spec: PURPLE_GEM, weight: 15 },
  { spec: RUBY_GEM,   weight: 12 },
  { spec: ORANGE_GEM, weight: 13 },
  { spec: GREEN_GEM,  weight: 15 },
];

export function pickMineDrop(): LootSpec {
  return weightedPick(MINE_DROP_TABLE);
}

// When the unclaimed floor pile exceeds this, the mountain starts reclaiming
// the loot pieces closest to it. Reclaim throughput is the main pressure valve
// on entity-count perf: keep these tight so a backed-up runner queue doesn't
// pile thousands of loot items on the ground.
export const MAX_FLOOR_LOOT = 100;
export const RECLAIM_INTERVAL = 0.25;
export const RECLAIM_DURATION = 0.7;

export interface Inventory {
  gold: number;
  gems: number;
  luck: number;
  /** Prestige currency. Drops on each mountain kill + paid out in bulk on
   *  rebirth. Persists across rebirths and spent on the Essence Tree. */
  essence: number;
  /** Earned +1 per manual dice roll. Spent on the repeatable skill-tree
   *  consumables (Quick Roll, Big Dice) — turns the "flood the dice" loop
   *  into a power-up engine without consuming dupes. */
  rolls: number;
}
