import {
  Hero,
  HERO_SWING_RANGE,
  HERO_SWING_ARC,
  HERO_SWING_DAMAGE,
} from '../entities/Hero';
import { Campfire } from '../entities/Campfire';
import { Input } from '../systems/Input';
import { WorldMap } from '../world/Map';
import {
  drawWorld,
  drawHero,
  drawCampfire,
  drawEnemies,
  drawAttackFlash,
  drawRecruits,
  drawStations,
  drawFocusPanel,
  drawCampfireUpgradeHint,
  drawLanternHook,
  drawLanternHalo,
  drawHeroLantern,
  drawRelicHints,
  drawNightPoiBeacons,
  drawWhetstoneOverlay,
  drawForgeOverlay,
  drawProjectiles,
  drawCoins,
  drawFlyingCoins,
  drawDownedMarker,
  drawNightBanner,
  drawDawnBanner,
  drawNoteCard,
  noteCardRevealDuration,
  drawWandererSlots,
  drawPortals,
  drawWarlights,
  drawPOIs,
  applyLighting,
  drawEndScreen,
  drawMenuScreen,
  MenuScreenRects,
} from '../systems/Render';
import { drawHUD, drawQuestPanel, drawActionBar } from '../ui/HUD';
import {
  drawModifierPicker,
  hitTestModifierPicker,
  ModifierPickerLayout,
} from '../ui/ModifierPicker';
import {
  drawLeaderboardModal,
  hitTestLeaderboard,
  LeaderboardLayout,
  LeaderboardState,
  LeaderboardTab,
} from '../ui/LeaderboardModal';
import {
  drawCodexModal,
  hitTestCodex,
  CodexLayout,
  CodexState,
} from '../ui/CodexModal';
import {
  drawAchievementsModal,
  hitTestAchievements,
  AchievementsLayout,
  AchievementsState,
} from '../ui/AchievementsModal';
import {
  drawHandlePrompt,
  hitTestHandlePrompt,
  HandlePromptLayout,
  HandlePromptState,
  END_OF_RUN_COPY,
} from '../ui/HandlePrompt';
import { drawEndlessChoiceOverlay } from '../ui/MenuUI';
import { topScores, PostScoreInput } from './Leaderboard';
import { setHandle } from './Persistence';
import { ResourceNode, nextResourceNodeId } from '../entities/ResourceNode';
import { Clock, Phase } from './Clock';
import { Enemy, ENEMY_STATS, createEnemy, EnemyKind, armoredDamage } from '../entities/Enemy';
import { WaveEntry, scheduleFor } from './Waves';
import {
  Recruit,
  createWanderer,
  moveTowards,
  RECRUIT_CARRY_CAP,
  RECRUIT_PICKUP_RADIUS,
  RESCUE_COST,
} from '../entities/Recruit';
import {
  Station,
  STATION_STATS,
  createStation,
  takesWorker,
  effectiveStats,
  nextUpgradeCost,
  applyStationLevelUp,
  hireAnchorOffset,
  upgradeAnchorOffset,
  prereqMet,
  STATION_READY_DELAY,
} from '../entities/Station';
import type { StationKind, EffectiveStationStats } from '../entities/Station';
import { Projectile, createArrow } from '../entities/Projectile';
import {
  Coin,
  createCoin,
  COIN_MAGNET_RADIUS,
  COIN_PICKUP_RADIUS,
  COIN_MAGNET_SPEED,
  COIN_DRAG,
  COIN_POP_TIME,
} from '../entities/Coin';
import {
  FlyingCoin,
  createFlyingCoin,
  updateFlyingCoin,
} from '../entities/FlyingCoin';
import { FogOfWar } from '../systems/Fog';
import {
  Portal,
  createPortal,
  PORTAL_RADIUS,
  PORTAL_DEFEND_COOLDOWN,
  WILD_PORTAL_PACK_CAP,
  WILD_PORTAL_PACK_INTERVAL,
  Warlight,
  createWarlight,
} from '../entities/Portal';
import { Autoplay } from '../systems/Autoplay';
import {
  ForgeState,
  ForgeTrack,
  FORGE_TRACKS,
  createForgeState,
  advanceTrackOneTier,
  archerDamageBonus,
  archerFireRateMult,
  archerArrowsPierce,
  soldierDamageBonus,
  soldierRangeMult,
  soldierCleaves,
  knightRegenPerSec,
  knightArmor,
} from './BlacksmithUpgrades';
import {
  NoteCard,
  diaryFor,
  LOST_CHILD_IDS,
  CODEX_ENTRIES,
} from './Narrative';
import {
  ModifierId,
  CombinedEffects,
  combineEffects,
  combinedScoreMultiplier,
  emptyEffects,
} from './Modifiers';
import {
  PlayerState,
  loadPlayer,
  savePlayer,
  unlockAchievement,
  unlockCodex,
  mergeLifetime,
} from './Persistence';
import {
  evaluateAchievements,
  achievementById,
  RunSnapshot,
  ACHIEVEMENTS,
} from './Achievements';
import { computeScore, ScoreBreakdown } from './Score';
import { postScore } from './Leaderboard';
import { POI, createPOI, POI_INTERACT_RANGE, POI_INTERACT_DURATION } from '../entities/POI';
import { poiInstance, instancesOfCategory, POI_SCATTER_RECIPE } from './POIInstances';
import { Rng, mulberry32, resolveSeed } from '../systems/Rng';
import { QUESTS } from './Quests';

export interface Resources {
  coin: number;
}

export interface Upgrades {
  campfireLight: number;
  heroDamage: number;
  heroRange: number;
  towerRate: number;
}

export interface RunStats {
  kills: number;
  rescued: number;
  stationsBuilt: number;
  coinsCollected: number;
  coinsSpent: number;
}

export const WIN_NIGHT = 10;
const NIGHT_BANNER_DURATION = 3.4;
const DAWN_BANNER_DURATION = 3.4;
const VILLAGER_DROP_RANGE = 34;
const STARTING_COIN = 10;
/** The hero can carry up to this many coins at L1 campfire. The cap
 *  scales with campfire level: 50 / 75 / 100 across L1 / L2 / L3.
 *  Coins picked up while capped scatter back into the world — they're
 *  not lost, but the player has to come back for them or upgrade the
 *  fire to make room. */
const COIN_CAP_BASE = 20;
const COIN_CAP_PER_CAMPFIRE_LEVEL = 20;
/** Cost in coins to light (or refresh) the lantern at the campfire.
 *  Each refresh resets `lanternTimeLeft` to `LANTERN_DURATION`. */
const LANTERN_COST = 8;
const LANTERN_DURATION = 60;
/** Radius around the carrier (the hero) within which enemies take
 *  the lantern's damage-amp. Stacks with the campfire aura, so a
 *  player who walks the kill zone with the lantern lit deals ~2.25x
 *  damage there. */
const LANTERN_RADIUS = 80;
const LANTERN_VULN_MULT = 1.5;
/** How close to the *campfire centre* the hero must be to pay for the
 *  lantern. Deliberately wider than `BUILD_PAY_RANGE` so the player
 *  can engage the lantern from any side of the fire — the mental
 *  model is "stand by the fire, light the lantern." Wins priority
 *  over wall ghosts and other stations whose anchors might happen to
 *  be in range too. */
const LANTERN_PAY_RANGE = 60;

/** Single one-time purchase at the blacksmith: the hero's swing damage
 *  permanently goes up by `WHETSTONE_DAMAGE_BONUS` for this run. */
const WHETSTONE_COST = 30;
const WHETSTONE_DAMAGE_BONUS = 2;
const BUILD_PAY_RANGE = 44;
const BUILD_PAY_INTERVAL = 0.16;
const WALL_PERIMETER_RADIUS = 210;
/** How many wild portals the world tries to keep alive each night. Reset
 *  to this count at every night-start by spawning fresh ones at random
 *  positions — destroyed portals stay dead until the next night. */
const WILD_PORTAL_TARGET_COUNT = 3;
/** Seconds before night during which warlight markers pulse to telegraph
 *  where siege portals are about to open. */
const DUSK_TELEGRAPH_LEAD = 5;
/** Siege portals open on a ring around the campfire — close enough that
 *  the night feels like an assault on the base (slow brutes can actually
 *  reach the fire within a wave window), but well outside the wall
 *  perimeter (`WALL_PERIMETER_RADIUS = 210`) so the player has time to
 *  react and towers can't trivially nuke the spawn point. Tune freely;
 *  these are the canonical numbers the game balances against. */
const SIEGE_PORTAL_RING_MIN = 360;
const SIEGE_PORTAL_RING_MAX = 520;
/** Minimum angular separation (radians) between two siege portals on the
 *  same night, so two warlights don't bloom into a stacked pair on the
 *  same flank. ~60° gives a clean spread of 2–3 portals across the ring. */
const SIEGE_PORTAL_MIN_SEPARATION = Math.PI / 3;
/** Aggro radius for wild-pack enemies — once any hero/villager enters,
 *  the pack switches from patrol to chase. */
const WILD_AGGRO_RADIUS = 140;
/** When chasing, how far the target can drift from the home portal
 *  before the pack gives up and returns to its orbit. */
const WILD_LEASH_RADIUS = 280;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function rectHit(
  r: { x: number; y: number; w: number; h: number },
  x: number,
  y: number,
): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function stationVision(kind: StationKind): number {
  switch (kind) {
    case 'tower': return 180;
    case 'barracks': return 140;
    case 'garrison': return 130;
    case 'workshop': return 100;
    case 'gather': return 95;
    case 'farm': return 85;
    case 'wall': return 65;
    case 'blacksmith': return 100;
  }
}

/** Pure preview text for a night POI's kiss/curse pair. Used by the
 *  pre-claim confirmation card AND mirrored by `applyNightKissCurse`
 *  so the description on the confirmation card and the description on
 *  the post-claim explainer card stay in lockstep. Add a new bargain
 *  in BOTH places — here for the text, and in the apply* method for
 *  the side-effects. */
function nightKissCurseDescription(
  id: string,
): { title: string; body: string } | null {
  switch (id) {
    case 'restless_bowyer':
      return {
        title: 'A bargain · Restless bowyer',
        body:
          "Your blade hums when you draw it (+2 damage for 60 seconds). Yellow eyes follow you home — a runner will spawn at your feet every 8 seconds while the kiss holds.",
      };
    case 'pyre_villager':
      return {
        title: 'A bargain · The pyre',
        body:
          "She follows you home (+1 villager, no rescue cost). At dawn she goes back into the smoke. The sign on her palm has already chosen her.",
      };
    case 'leaky_purse':
      return {
        title: 'A bargain · The merchant',
        body:
          "Twenty-five coins for the purse. For the next 50 seconds you will leak one coin every 5 seconds — wherever you stand, a coin will fall behind you. He is collecting his interest.",
      };
    case 'singing_well':
      return {
        title: 'A bargain · The well',
        body:
          "Healed to full. A piece of you stays in the water — your maximum HP will be one less for the rest of the run. The well sings on, smaller and brighter.",
      };
    case 'drill_pit':
      return {
        title: 'A bargain · The drilling pit',
        body:
          "Your villagers will attack 30% faster for 90 seconds. When the cadence ends the dead want their fee paid in firelight — the campfire will take 15 damage.",
      };
    case 'mask_in_grass':
      return {
        title: 'A bargain · The mask',
        body:
          "The lantern will burn longer than it should — three full turns of the hourglass. For the next 60 seconds the world presses inward; you will see half as much of it as you did.",
      };
    default:
      return null;
  }
}

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  readonly worldW: number;
  readonly worldH: number;
  readonly seed: number;
  readonly seedLabel: string;
  readonly input: Input;
  readonly map: WorldMap;
  readonly hero: Hero;
  readonly campfire: Campfire;
  readonly clock = new Clock();
  readonly fog: FogOfWar;
  private worldRng: Rng;
  cameraX = 0;
  cameraY = 0;
  readonly resources: Resources = { coin: STARTING_COIN };
  readonly upgrades: Upgrades = {
    campfireLight: 1.0,
    heroDamage: 0,
    heroRange: 0,
    towerRate: 1.0,
  };
  enemies: Enemy[] = [];
  recruits: Recruit[] = [];
  stations: Station[] = [];
  projectiles: Projectile[] = [];
  coins: Coin[] = [];
  flyingCoins: FlyingCoin[] = [];
  portals: Portal[] = [];
  pois: POI[] = [];
  /** Dusk telegraph markers. Spawned in the last few seconds of day; at
   *  night-start each warlight blooms into a real siege portal at the
   *  same position. */
  warlights: Warlight[] = [];
  /** True from dusk-start until the warlights bloom at night-start. Used
   *  by Render to light up the markers. */
  duskTelegraphActive = false;
  /** True between night-start and dawn — siege portals are alive and
   *  receiving wave spawns. */
  siegeActive = false;
  readonly stats: RunStats = { kills: 0, rescued: 0, stationsBuilt: 0, coinsCollected: 0, coinsSpent: 0 };
  questIndex = 0;
  questCompleteFlashTime = 0;
  nightBannerTime = 0;
  dawnBannerTime = 0;
  /** When set, the renderer shows a parchment card and gameplay is paused
   *  until the player dismisses it (Space / click). Used for POI notes and
   *  the nightly Scribe's diary. */
  activeNote: NoteCard | null = null;
  /** Seconds since the current `activeNote` started displaying. Drives
   *  the typewriter-style per-char reveal animation in `drawNoteCard`.
   *  Reset to 0 whenever `activeNote` changes (queue advance), and
   *  bumped past the reveal duration when the player fast-forwards. */
  noteRevealTime = 0;
  /** Tracks the last note we observed so we can detect a transition
   *  (queue advance OR brand-new card) and reset `noteRevealTime`. */
  private lastSeenNote: NoteCard | null = null;
  /** FIFO queue so multiple unlocks (achievement + codex + diary) don't
   *  clobber one another when they all fire on the same frame. Dismissing
   *  the active card pops the next. */
  private noteQueue: NoteCard[] = [];
  /** The forge's persistent troop-upgrade tracks (archers / soldiers /
   *  knights). Modified by hero standing near an active blacksmith,
   *  selecting a track via 1/2/3, and holding Space to drip coins in. */
  forge: ForgeState = createForgeState();
  /** Set of wall station ids that currently have a knight (garrison
   *  guard or barracks-knight) standing post. Refreshed each frame in
   *  `tickKnightWallSupport`. Read at damage time + by the regen tick. */
  private guardedWallIds: Set<number> = new Set();
  /** Fires once per run, the first time the hero leaves the campfire's
   *  effective light radius during day. The chronicle has just told the
   *  player NOT to leave the light; this is the moment of acknowledgment
   *  ("you did what you had to do — so did I"). */
  private hasLeftLightCallbackFired = false;
  /** Fires once per run, the first enemy kill after the player is past
   *  Night 5 AND has logged at least 25 kills. The card recontextualises
   *  every prior kill — the things they've been fighting are the missing
   *  children, running TOWARD the fire, not at it. The bind is that the
   *  player can't stop (the campfire dies if enemies reach it). */
  private childRevealFired = false;
  /** Seconds the hero has been standing still (no WASD input). Used to
   *  gate building coin-pip overlays so they only appear once the player
   *  has stopped, not as they walk past. Resets to 0 each frame the
   *  hero moves. */
  private heroStoppedTime = 0;
  /** Seconds remaining on the lantern. While > 0 the hero carries the
   *  lantern and enemies within `LANTERN_RADIUS` take 1.5x damage.
   *  The hero refreshes this by spending `LANTERN_COST` at the
   *  campfire's lantern hook (anchor: `lanternAnchor()`). */
  lanternTimeLeft = 0;
  /** Coins paid toward the next lantern refresh. Resets to 0 on
   *  refresh complete. */
  private lanternProgress = 0;
  /** Set to true once the player has bought the blacksmith's whetstone
   *  upgrade (single one-time purchase, +2 hero swing damage). */
  whetstoneBought = false;
  /** Coins dripped toward the whetstone purchase (0..WHETSTONE_COST). */
  private whetstoneProgress = 0;
  /** Active kiss/curse effects from claimed night POIs. Each entry has
   *  its own timer + per-effect bookkeeping. Reset on game over. */
  activeKisses: {
    restlessBowyer?: { timeLeft: number; nextSpawnIn: number };
    leakyPurse?: { timeLeft: number; nextDropIn: number };
    drillPit?: { timeLeft: number };
    maskInGrass?: { timeLeft: number };
  } = {};
  /** Set when a night POI is awaiting the player's accept/decline on its
   *  bargain confirmation card. The POI is held in this slot — NOT yet
   *  marked claimed — so cancelling leaves it on the map for retry. */
  private pendingNightBargainPoi: POI | null = null;
  /** Relic-found flags. Each campfire upgrade is gated by an exploration
   *  relic in addition to its existing building prereq — Campfire L2
   *  needs `relicsFound.l2`, Campfire L3 needs `relicsFound.l3`. Set when
   *  the corresponding relic POI is claimed. */
  relicsFound: {
    l2: boolean;
    l3: boolean;
    workshop: boolean;
    blacksmith: boolean;
    stables: boolean;
  } = { l2: false, l3: false, workshop: false, blacksmith: false, stables: false };
  private waveSchedule: WaveEntry[] = [];
  private lastPhase: Phase = 'day';
  private wandererTimer = 10;
  private payTimer = 0;
  private payTargetId: number | null = null;
  gameOver = false;
  victory = false;
  wantsRestart = false;
  /** Options to pass to the next Game instance. main.ts reads this when
   *  rebuilding on wantsRestart. Lets the modifier picker apply curses by
   *  constructing a fresh Game rather than hot-patching an existing one. */
  pendingRestartOptions: { modifiers?: ModifierId[]; skipMenu?: boolean } | null = null;
  /** Main menu gates game start — player presses Space/click to dismiss and
   *  begin the run. Also shown between runs (return-to-menu flow). */
  showMenu = true;
  /** Sub-screen within the menu flow. 'main' = title + 4 buttons.
   *  'modifiers' = pre-run curse picker. The other four are read-only modals. */
  menuScreen: 'main' | 'modifiers' | 'leaderboard' | 'codex' | 'achievements' | 'handle' = 'main';
  /** Modifier picker selection. Replaced with the new Game's modifierIds on
   *  "Begin the night". */
  pickedModifiers: Set<ModifierId> = new Set();
  /** Leaderboard modal state — tab + fetched rows. Rows are undefined until
   *  the async fetch resolves, which is what renders the "Reading…" state. */
  leaderboardState: LeaderboardState = {
    tab: 'today',
    rows: { today: undefined, all: undefined, clean: undefined },
    ownIds: new Set<number>(),
    seedLabel: '',
    enabled: false,
  };
  /** True while any Supabase fetch for this tab is in-flight. Prevents
   *  re-fetching on every mouse-move. */
  private leaderboardFetching: Record<LeaderboardTab, boolean> = {
    today: false,
    all: false,
    clean: false,
  };
  codexState: CodexState = { category: 'diary', unlocked: {}, scroll: 0 };
  achievementsState: AchievementsState = { unlocked: {}, scroll: 0 };
  handlePromptState: HandlePromptState = { value: '', blinkOn: true };
  private handleBlinkT = 0;
  /** Layouts captured on the last render so click handling can hit-test
   *  against exactly what the player sees. */
  private menuScreenRects: MenuScreenRects | null = null;
  private modifierPickerLayout: ModifierPickerLayout | null = null;
  private leaderboardLayout: LeaderboardLayout | null = null;
  private codexLayout: CodexLayout | null = null;
  private achievementsLayout: AchievementsLayout | null = null;
  private handlePromptLayout: HandlePromptLayout | null = null;
  /** Printable keystrokes captured this frame while the handle prompt is
   *  open. Populated from a keydown listener attached at construction time
   *  (Input class only exposes key codes, not characters). */
  private textInputBuffer: string[] = [];
  /** Hit-boxes for the N10 victory "Return / Press into the dark" choice. */
  private endlessChoiceLayout: {
    returnBtn: { x: number; y: number; w: number; h: number };
    continueBtn: { x: number; y: number; w: number; h: number };
  } | null = null;

  // ── Replay systems ──────────────────────────────────────────────────────
  /** Modifier ids picked at run start (empty = vanilla run). */
  readonly modifierIds: ModifierId[];
  /** Pre-computed combined effects for the whole run. Referenced by cost
   *  multipliers, tower damage, wall HP, etc. */
  readonly modifierEffects: CombinedEffects;
  /** Product of every picked modifier's score multiplier. */
  readonly modifierScoreMultiplier: number;
  /** True when the player opted into endless after a N10 victory. */
  endlessMode = false;
  /** After N10 victory we pause to show a Return / Press-into-the-dark
   *  choice before auto-ending the run. */
  endlessChoicePending = false;
  /** Local player profile loaded from localStorage at construction. Survives
   *  between runs via savePlayer. */
  readonly player: PlayerState;
  /** Per-run context used by the achievement evaluator. Rebuilt per Game. */
  private runCtx = {
    anyWallEverDied: false,
    diaryEntriesReadThisRun: 0,
    poisDiscoveredThisRun: 0,
    maxCoinAtAnyPoint: STARTING_COIN,
    maxWorkersAtAnyPoint: 0,
    maxCampfireLevel: 1,
    achievementsEarnedThisRun: 0,
  };
  /** Set at end-of-run for the end screen and leaderboard. */
  finalScore: ScoreBreakdown | null = null;
  /** Prevent evaluateAchievements from running twice on the same frame. */
  private runFinalized = false;

  readonly autoplay = new Autoplay();

  constructor(
    canvas: HTMLCanvasElement,
    options?: { modifiers?: ModifierId[]; endless?: boolean; skipMenu?: boolean },
  ) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    // World size doubled (was 1600×1200). Tree/bush/rock counts already
    // scale by area in WorldMap.scatter, so the wilds get correspondingly
    // denser. Camera follow + fog texture both scale automatically.
    this.worldW = 3200;
    this.worldH = 2400;
    const { seed, label } = resolveSeed();
    this.seed = seed;
    this.seedLabel = label;
    this.modifierIds = options?.modifiers ?? [];
    this.modifierEffects = this.modifierIds.length
      ? combineEffects(this.modifierIds)
      : emptyEffects();
    this.modifierScoreMultiplier = this.modifierIds.length
      ? combinedScoreMultiplier(this.modifierIds)
      : 1;
    this.endlessMode = !!options?.endless;
    this.player = loadPlayer();
    // Hydrate modal state from the persistent profile.
    this.codexState.unlocked = this.player.codex;
    this.achievementsState.unlocked = this.player.achievements;
    this.leaderboardState.ownIds = new Set(this.player.postedScoreIds);
    this.leaderboardState.seedLabel = label;
    // `VITE_SUPABASE_URL` presence decides whether the leaderboard tabs render
    // data or a "leaderboard offline" message. We don't touch this again —
    // Leaderboard.ts is authoritative.
    // (Value is set by the imported module, so import it lazily here.)
    // Use truthy URL env var as a cheap proxy without a top-level import.
    this.leaderboardState.enabled =
      !!import.meta.env.VITE_SUPABASE_URL && !!import.meta.env.VITE_SUPABASE_ANON_KEY;
    // Skip the title screen when the player has already committed to a run
    // (i.e. they just clicked "Begin the night" on the modifier picker).
    if (options?.skipMenu) this.showMenu = false;

    // Capture printable keystrokes when the handle prompt is open. Input.ts
    // only publishes key codes, not characters, so we listen once here and
    // append into a buffer the menu controller drains each frame.
    window.addEventListener('keydown', this.onDocumentKeyDown);
    window.addEventListener('wheel', this.onDocumentWheel, { passive: true });
    // One RNG instance derived from the seed powers all world-layout placement
    // (map scatter, portals, POIs). Runtime randomness (enemy drift, coin pop
    // velocity, etc.) still uses Math.random so each play differs slightly.
    this.worldRng = mulberry32(seed);
    this.input = new Input(canvas);
    this.map = new WorldMap(this.worldW, this.worldH, mulberry32(seed ^ 0x9e3779b9));
    this.campfire = new Campfire(this.worldW / 2, this.worldH / 2);
    this.hero = new Hero(this.worldW / 2 - 40, this.worldH / 2);
    this.fog = new FogOfWar(this.worldW, this.worldH);
    this.initializeStartingBase();
    this.initializePortals();
    this.initializePOIs();
    this.initializeWildPacks();
    this.updateCamera();
    this.updateFog();

    // Cold-open: every run begins with the Scribe's chronicle pinned to
    // the first frame. The instruction is impossible — the entire
    // economy of the run forces the hero out of the campfire's light —
    // and that's the point. The player meets the rule, then breaks it,
    // and the second card (`maybeFireLeftLightCallback`) catches them
    // mid-betrayal.
    this.enqueueNote({
      title: "A note found at the campfire",
      body:
        "Stay in the light. Whatever you do. Whatever you must. Stay in the light. — E.",
      accent: 'ember',
      // The two recurring instruction words shake forever after they
      // land — the chronicle is shouting them at the player.
      shake: ['stay', 'light'],
    });
  }

  /** Unhook the document-level listeners so we don't leak one per run. main.ts
   *  calls this just before replacing the Game instance on a restart. */
  destroy() {
    window.removeEventListener('keydown', this.onDocumentKeyDown);
    window.removeEventListener('wheel', this.onDocumentWheel);
  }

  /** Arrow-bound so `removeEventListener` sees the same function reference. */
  private onDocumentKeyDown = (e: KeyboardEvent) => {
    // Only care about printable characters + editing keys while a handle-
    // input surface is active. The end-of-run prompt reuses the same text
    // buffer as the (now removed) main-menu version.
    const capturing =
      this.menuScreen === 'handle' || this.endOfRunNamePromptVisible;
    if (!capturing) return;
    if (e.key === 'Backspace') {
      this.textInputBuffer.push('\b');
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' || e.key === 'Escape' || e.key === 'Tab') return;
    if (e.key.length === 1) {
      this.textInputBuffer.push(e.key);
      e.preventDefault();
    }
  };

  // ── Menu flow ─────────────────────────────────────────────────────────

  /** Drives the main-menu state machine: title / picker / 4 modals. */
  private updateMenu(_dt: number) {
    this.handleBlinkT += _dt;
    if (this.handleBlinkT > 0.5) {
      this.handleBlinkT = 0;
      this.handlePromptState.blinkOn = !this.handlePromptState.blinkOn;
    }

    const mouse = { x: this.input.mouseX, y: this.input.mouseY };
    const click = this.input.mouseJustDown;

    // Escape always walks one layer up in the menu stack.
    const esc = this.input.pressed('Escape');

    switch (this.menuScreen) {
      case 'main': {
        // Space / Enter / click the "Begin" button → go to modifier picker.
        const r = this.menuScreenRects;
        if (click && r) {
          if (rectHit(r.startBtn, mouse.x, mouse.y)) {
            this.enterModifierPicker();
            break;
          }
          if (rectHit(r.leaderboardBtn, mouse.x, mouse.y)) {
            this.enterLeaderboard();
            break;
          }
          if (rectHit(r.codexBtn, mouse.x, mouse.y)) {
            this.menuScreen = 'codex';
            break;
          }
          if (rectHit(r.achievementsBtn, mouse.x, mouse.y)) {
            this.menuScreen = 'achievements';
            break;
          }
        }
        if (this.input.pressed('Space') || this.input.pressed('Enter')) {
          this.enterModifierPicker();
        }
        break;
      }
      case 'modifiers': {
        // Drain text buffer (ignored here — but clear so it doesn't leak to
        // the handle screen if opened next).
        this.textInputBuffer.length = 0;
        if (esc) {
          this.menuScreen = 'main';
          break;
        }
        if (this.input.pressed('Space') || this.input.pressed('Enter')) {
          this.commitModifierPicker();
          break;
        }
        if (click && this.modifierPickerLayout) {
          const action = hitTestModifierPicker(
            this.modifierPickerLayout,
            mouse.x,
            mouse.y,
          );
          if (action?.kind === 'cancel') this.menuScreen = 'main';
          else if (action?.kind === 'toggle' && action.modifierId) {
            if (this.pickedModifiers.has(action.modifierId)) {
              this.pickedModifiers.delete(action.modifierId);
            } else {
              this.pickedModifiers.add(action.modifierId);
            }
          } else if (action?.kind === 'start') {
            this.commitModifierPicker();
          }
        }
        break;
      }
      case 'leaderboard': {
        if (esc || this.input.pressed('Space') || this.input.pressed('Enter')) {
          this.menuScreen = 'main';
          break;
        }
        if (click && this.leaderboardLayout) {
          const a = hitTestLeaderboard(this.leaderboardLayout, mouse.x, mouse.y);
          if (a?.kind === 'close') this.menuScreen = 'main';
          else if (a?.kind === 'switchTab' && a.tab) this.setLeaderboardTab(a.tab);
        }
        break;
      }
      case 'codex': {
        if (esc || this.input.pressed('Space') || this.input.pressed('Enter')) {
          this.menuScreen = 'main';
          break;
        }
        if (this.input.pressed('ArrowDown')) {
          this.codexState.scroll = Math.max(0, this.codexState.scroll + 1);
        }
        if (this.input.pressed('ArrowUp')) {
          this.codexState.scroll = Math.max(0, this.codexState.scroll - 1);
        }
        if (click && this.codexLayout) {
          const a = hitTestCodex(this.codexLayout, mouse.x, mouse.y);
          if (a?.kind === 'close') this.menuScreen = 'main';
          else if (a?.kind === 'switchCategory' && a.category) {
            this.codexState.category = a.category;
            this.codexState.scroll = 0;
          } else if (a?.kind === 'scroll' && a.scrollDelta != null) {
            this.codexState.scroll = Math.max(
              0,
              this.codexState.scroll + a.scrollDelta,
            );
          }
        }
        break;
      }
      case 'achievements': {
        if (esc || this.input.pressed('Space') || this.input.pressed('Enter')) {
          this.menuScreen = 'main';
          break;
        }
        if (this.input.pressed('ArrowDown')) {
          this.achievementsState.scroll = Math.max(0, this.achievementsState.scroll + 1);
        }
        if (this.input.pressed('ArrowUp')) {
          this.achievementsState.scroll = Math.max(0, this.achievementsState.scroll - 1);
        }
        if (click && this.achievementsLayout) {
          const a = hitTestAchievements(this.achievementsLayout, mouse.x, mouse.y);
          if (a?.kind === 'close') this.menuScreen = 'main';
          else if (a?.kind === 'scroll' && a.scrollDelta != null) {
            this.achievementsState.scroll = Math.max(
              0,
              this.achievementsState.scroll + a.scrollDelta,
            );
          }
        }
        break;
      }
      case 'handle': {
        if (esc) {
          this.menuScreen = 'main';
          this.textInputBuffer.length = 0;
          break;
        }
        if (this.input.pressed('Enter')) {
          this.commitHandlePrompt();
          break;
        }
        // Drain the buffered keystrokes into the draft.
        for (const ch of this.textInputBuffer) {
          if (ch === '\b') {
            this.handlePromptState.value = this.handlePromptState.value.slice(0, -1);
          } else if (this.handlePromptState.value.length < 12) {
            this.handlePromptState.value += ch;
          }
        }
        this.textInputBuffer.length = 0;

        if (click && this.handlePromptLayout) {
          const a = hitTestHandlePrompt(this.handlePromptLayout, mouse.x, mouse.y);
          if (a?.kind === 'cancel') {
            this.menuScreen = 'main';
          } else if (a?.kind === 'save') {
            this.commitHandlePrompt();
          }
          // 'focusField' is a no-op — the hidden capture is already global.
        }
        break;
      }
    }
  }

  private enterModifierPicker() {
    this.menuScreen = 'modifiers';
    // Preserve any prior selection so the picker remembers between opens.
  }

  private commitModifierPicker() {
    // Freeze the selection and restart the Game so the constructor can fold
    // the chosen effects into starting stats, costs, wall HP, etc.
    const picked = [...this.pickedModifiers];
    this.pendingRestartOptions = { modifiers: picked, skipMenu: true };
    this.wantsRestart = true;
  }

  private enterLeaderboard() {
    this.menuScreen = 'leaderboard';
    // Kick off fetches for whichever tab is currently selected. The modal
    // shows "Reading the chronicles…" until data arrives.
    this.fetchLeaderboardTab(this.leaderboardState.tab);
  }

  private setLeaderboardTab(tab: LeaderboardTab) {
    this.leaderboardState.tab = tab;
    this.fetchLeaderboardTab(tab);
  }

  private fetchLeaderboardTab(tab: LeaderboardTab) {
    if (!this.leaderboardState.enabled) return;
    if (this.leaderboardFetching[tab]) return;
    if (this.leaderboardState.rows[tab] !== undefined) return; // already cached
    this.leaderboardFetching[tab] = true;
    const query =
      tab === 'all'
        ? { scope: 'all' as const, limit: 20 }
        : tab === 'clean'
          ? {
              scope: 'seed' as const,
              seed: this.seedLabel,
              limit: 20,
              modifierFreeOnly: true,
            }
          : { scope: 'seed' as const, seed: this.seedLabel, limit: 20 };
    topScores(query)
      .then((rows) => {
        this.leaderboardState.rows[tab] = rows;
      })
      .catch(() => {
        this.leaderboardState.rows[tab] = [];
      })
      .finally(() => {
        this.leaderboardFetching[tab] = false;
      });
  }

  /** Drive the end-of-run "sign the chronicles" prompt. Same keystroke
   *  capture as the menu version, different commit paths — Save posts
   *  with the new name, Cancel posts as 'anon'. Either way the end
   *  screen becomes interactive afterward. */
  private updateEndOfRunPrompt(dt: number) {
    this.handleBlinkT += dt;
    if (this.handleBlinkT > 0.5) {
      this.handleBlinkT = 0;
      this.handlePromptState.blinkOn = !this.handlePromptState.blinkOn;
    }

    // Drain keystroke buffer.
    for (const ch of this.textInputBuffer) {
      if (ch === '\b') {
        this.handlePromptState.value = this.handlePromptState.value.slice(0, -1);
      } else if (this.handlePromptState.value.length < 12) {
        this.handlePromptState.value += ch;
      }
    }
    this.textInputBuffer.length = 0;

    if (this.input.pressed('Escape')) {
      this.cancelEndOfRunPrompt();
      return;
    }
    if (this.input.pressed('Enter')) {
      this.commitEndOfRunPrompt();
      return;
    }

    if (this.input.mouseJustDown && this.handlePromptLayout) {
      const a = hitTestHandlePrompt(
        this.handlePromptLayout,
        this.input.mouseX,
        this.input.mouseY,
      );
      if (a?.kind === 'cancel') {
        this.cancelEndOfRunPrompt();
      } else if (a?.kind === 'save') {
        this.commitEndOfRunPrompt();
      }
    }
  }

  private commitHandlePrompt() {
    const draft = this.handlePromptState.value.trim();
    if (draft.length >= 3 && draft.length <= 12) {
      setHandle(this.player, draft);
      savePlayer(this.player);
    } else if (draft.length === 0) {
      // Blank = keep default. Nothing to save.
    } else {
      // Too short/long: treat as cancel. Return to menu without saving.
    }
    this.menuScreen = 'main';
  }

  private updateEndlessChoice() {
    const mouse = { x: this.input.mouseX, y: this.input.mouseY };
    const layout = this.endlessChoiceLayout;
    const click = this.input.mouseJustDown;
    // Space / Enter default to "Return to menu" — the least disruptive path
    // if the player doesn't want to read the prompt.
    if (this.input.pressed('Escape') || this.input.pressed('Space') || this.input.pressed('Enter')) {
      this.endlessChoicePending = false;
      this.victory = true;
      this.gameOver = true;
      return;
    }
    if (this.input.pressed('KeyE')) {
      this.enterEndless();
      return;
    }
    if (click && layout) {
      if (rectHit(layout.returnBtn, mouse.x, mouse.y)) {
        this.endlessChoicePending = false;
        this.victory = true;
        this.gameOver = true;
        return;
      }
      if (rectHit(layout.continueBtn, mouse.x, mouse.y)) {
        this.enterEndless();
      }
    }
  }

  private enterEndless() {
    this.endlessMode = true;
    this.endlessChoicePending = false;
    // We let the clock keep advancing. The N10 gate re-checks against
    // endlessMode so the run simply continues past WIN_NIGHT.
  }

  /** Render the whole menu layer: title screen, modifier picker, or one of
   *  the read-only modals. Captures layouts into fields so the update hook
   *  can hit-test against exactly what the player saw. */
  private renderMenu(ctx: CanvasRenderingContext2D) {
    const mouseX = this.input.mouseX;
    const mouseY = this.input.mouseY;

    const totalCodex = CODEX_ENTRIES.length;
    const codexUnlocked = Object.keys(this.player.codex).length;
    const achievementsUnlocked = Object.keys(this.player.achievements).length;

    // The title screen always renders as a backdrop — modals overlay on top.
    this.menuScreenRects = drawMenuScreen(
      ctx,
      this.width,
      this.height,
      this.seedLabel,
      {
        codexUnlocked,
        codexTotal: totalCodex,
        achievementsUnlocked,
        achievementsTotal: ACHIEVEMENTS.length,
      },
      this.menuScreen === 'main' ? mouseX : -1,
      this.menuScreen === 'main' ? mouseY : -1,
    );

    if (this.menuScreen === 'modifiers') {
      this.modifierPickerLayout = drawModifierPicker(
        ctx,
        this.width,
        this.height,
        this.pickedModifiers,
        mouseX,
        mouseY,
      );
    } else if (this.menuScreen === 'leaderboard') {
      this.leaderboardLayout = drawLeaderboardModal(
        ctx,
        this.width,
        this.height,
        this.leaderboardState,
        mouseX,
        mouseY,
      );
    } else if (this.menuScreen === 'codex') {
      this.codexLayout = drawCodexModal(
        ctx,
        this.width,
        this.height,
        this.codexState,
        mouseX,
        mouseY,
      );
    } else if (this.menuScreen === 'achievements') {
      this.achievementsLayout = drawAchievementsModal(
        ctx,
        this.width,
        this.height,
        this.achievementsState,
        mouseX,
        mouseY,
      );
    } else if (this.menuScreen === 'handle') {
      this.handlePromptLayout = drawHandlePrompt(
        ctx,
        this.width,
        this.height,
        this.handlePromptState,
        mouseX,
        mouseY,
      );
    }
  }

  /** Mouse-wheel scroll in menu modals that support it. */
  private onDocumentWheel = (e: WheelEvent) => {
    if (!this.showMenu) return;
    const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0;
    if (dir === 0) return;
    if (this.menuScreen === 'codex') {
      this.codexState.scroll = Math.max(0, this.codexState.scroll + dir);
    } else if (this.menuScreen === 'achievements') {
      this.achievementsState.scroll = Math.max(0, this.achievementsState.scroll + dir);
    } else if (this.menuScreen === 'leaderboard') {
      // Cycle tabs with wheel so players can flip between boards fast.
      const tabs: LeaderboardTab[] = ['today', 'all', 'clean'];
      const i = tabs.indexOf(this.leaderboardState.tab);
      const next = (i + dir + tabs.length) % tabs.length;
      this.setLeaderboardTab(tabs[next]);
    }
  };

  private initializePortals() {
    const count = 3;
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    const ringR = Math.min(cx, cy) * 0.8;
    const rng = this.worldRng;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng() * 0.6 - 0.3;
      const r = ringR * (0.85 + rng() * 0.15);
      const x = clamp(cx + Math.cos(angle) * r, 60, this.worldW - 60);
      const y = clamp(cy + Math.sin(angle) * r, 60, this.worldH - 60);
      // World-gen seeds the 3 always-on wild portals. Siege portals are
      // not pre-spawned; they bloom at night-start from dusk warlights.
      this.portals.push(createPortal('wild', x, y));
    }
  }

  /** Seed wandering wild packs across the map at run start. Each pack
   *  is a cluster of enemies anchored at a static patrol point — they
   *  use the same wild-AI as portal packs (orbit when calm, aggro
   *  when the hero or a villager strays into range), but their home
   *  is a fixed coordinate instead of a portal id.
   *
   *  Pack composition scales with distance from the campfire so the
   *  wilds get genuinely tougher the further you push out:
   *
   *    Band 1 (250–500):  2 runners — light skirmish
   *    Band 2 (500–800):  2 runners + 1 brute
   *    Band 3 (800–1100): 2 runners + 2 brutes
   *    Band 4 (1100+):    1 brute + 1 flyer + 3 runners
   *
   *  Picks 3 packs per band by default for a total of 12 packs across
   *  the doubled-map arena. Packs avoid overlapping with portals,
   *  POIs, and each other. */
  private initializeWildPacks() {
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    const rng = this.worldRng;
    const bands: Array<{
      ringMin: number;
      ringMax: number;
      packs: number;
      composition: EnemyKind[];
    }> = [
      { ringMin: 250, ringMax: 500,  packs: 3, composition: ['runner', 'runner'] },
      { ringMin: 500, ringMax: 800,  packs: 3, composition: ['runner', 'runner', 'brute'] },
      { ringMin: 800, ringMax: 1100, packs: 3, composition: ['runner', 'runner', 'brute', 'brute'] },
      { ringMin: 1100, ringMax: Math.min(cx, cy) * 0.95, packs: 3, composition: ['runner', 'runner', 'runner', 'brute', 'flyer'] },
    ];
    const minSpacing = 180;
    // Track centers we've placed so packs don't crowd one another.
    const placed: Array<{ x: number; y: number }> = [];
    for (const band of bands) {
      let placedInBand = 0;
      for (let attempt = 0; attempt < band.packs * 12 && placedInBand < band.packs; attempt++) {
        const angle = rng() * Math.PI * 2;
        const dist = band.ringMin + rng() * (band.ringMax - band.ringMin);
        const x = clamp(cx + Math.cos(angle) * dist, 80, this.worldW - 80);
        const y = clamp(cy + Math.sin(angle) * dist, 80, this.worldH - 80);
        // Avoid overlapping with portals (they have their own packs)
        // and other pack centers.
        const tooClose =
          this.portals.some((p) => Math.hypot(p.x - x, p.y - y) < 200) ||
          placed.some((p) => Math.hypot(p.x - x, p.y - y) < minSpacing);
        if (tooClose) continue;
        placed.push({ x, y });
        placedInBand++;
        // Spawn each enemy in the composition with a small offset so
        // they don't sit on top of each other at the anchor.
        for (let i = 0; i < band.composition.length; i++) {
          const kind = band.composition[i];
          const offAng = (i / band.composition.length) * Math.PI * 2;
          const offR = 14 + rng() * 10;
          const ex = x + Math.cos(offAng) * offR;
          const ey = y + Math.sin(offAng) * offR;
          this.enemies.push(
            createEnemy(kind, ex, ey, 'wild', undefined, x, y),
          );
        }
      }
    }
  }

  private initializePOIs() {
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    const minDist = 360;
    const maxDist = Math.min(cx, cy) * 0.95;
    const rng = this.worldRng;

    // Pick which authored instances populate each category slot. Relics
    // are always both placed (only one of each exists). Settlement and
    // lore pools get shuffled and the first N taken so a different daily
    // seed surfaces a different set of named landmarks.
    const shuffle = <T>(arr: T[]): T[] => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };

    // Build the chosen list. When a slot count exceeds the pool size
    // (e.g. 11 settlements requested from a pool of 6), cycle through
    // the shuffled pool — every variant appears once before any repeats.
    // The pool is reshuffled each lap so the order varies across cycles.
    const chosen: string[] = [];
    for (const slot of POI_SCATTER_RECIPE) {
      if (slot.category === 'upgrade') {
        // Stratify by track so the player has a fair chance of finding
        // tiers across all three tracks rather than getting unlucky and
        // seeing only e.g. archer POIs. Split `slot.count` evenly,
        // distributing the remainder across the first few tracks.
        const tracks: Array<'archer' | 'soldier' | 'knight'> = [
          'archer', 'soldier', 'knight',
        ];
        const base = Math.floor(slot.count / tracks.length);
        const remainder = slot.count - base * tracks.length;
        for (let ti = 0; ti < tracks.length; ti++) {
          const trackId = tracks[ti];
          let trackPool = shuffle(
            instancesOfCategory('upgrade').filter(
              (i) => i.upgradeTrack === trackId,
            ),
          );
          if (trackPool.length === 0) continue;
          const n = base + (ti < remainder ? 1 : 0);
          for (let i = 0; i < n; i++) {
            if (i > 0 && i % trackPool.length === 0) trackPool = shuffle(trackPool);
            chosen.push(trackPool[i % trackPool.length].id);
          }
        }
        continue;
      }
      // Night-only POIs are spawned dynamically at night-start, not via
      // the scatter — skip if a night slot is somehow on the recipe.
      if (slot.category === 'night') continue;
      let pool = shuffle(instancesOfCategory(slot.category));
      if (pool.length === 0) continue;
      for (let i = 0; i < slot.count; i++) {
        if (i > 0 && i % pool.length === 0) pool = shuffle(pool);
        chosen.push(pool[i % pool.length].id);
      }
    }

    // Inter-POI spacing scales with map area so 24 POIs in a 3200×2400
    // arena don't bunch up. Empirically 200 px between centres reads as
    // "different landmark" without leaving big empty zones.
    const interPoiMinDist = 200;
    const placeInstance = (instanceId: string) => {
      const inst = poiInstance(instanceId);
      if (!inst) return;
      // Per-instance ring overrides the default scatter range. Used to
      // tier progression: relic L2 spawns near the base, relic L3 spawns
      // deep in the wilds.
      const ringMin = inst.ringMin ?? minDist;
      const ringMax = inst.ringMax ?? maxDist;
      for (let attempt = 0; attempt < 60; attempt++) {
        const angle = rng() * Math.PI * 2;
        const dist = ringMin + rng() * (ringMax - ringMin);
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const tooClose =
          this.portals.some((p) => Math.hypot(p.x - x, p.y - y) < 120) ||
          this.pois.some((p) => Math.hypot(p.x - x, p.y - y) < interPoiMinDist);
        if (!tooClose) {
          this.pois.push(createPOI(inst.id, inst.sprite, x, y));
          return;
        }
      }
    };

    // Place ringed instances first (relics) so they get priority on
    // their narrow distance bands; the rest fill in around them with
    // the loose default ring.
    const sorted = [...chosen].sort((a, b) => {
      const ai = poiInstance(a);
      const bi = poiInstance(b);
      const aHasRing = ai && (ai.ringMin != null || ai.ringMax != null);
      const bHasRing = bi && (bi.ringMin != null || bi.ringMax != null);
      if (aHasRing && !bHasRing) return -1;
      if (!aHasRing && bHasRing) return 1;
      return 0;
    });
    for (const id of sorted) placeInstance(id);
  }

  /** Push a parchment card onto the queue. If nothing is currently shown it
   *  becomes the active card immediately. Used by achievement + codex unlocks
   *  and by the POI / diary systems. */
  enqueueNote(n: NoteCard): void {
    if (!this.activeNote) this.activeNote = n;
    else this.noteQueue.push(n);
  }

  /** One-shot run finalisation. Computes the score, walks every achievement
   *  definition, stamps newly-satisfied ids into the Player, reveals the next
   *  lost-child codex entry, rolls the lifetime totals forward, and writes
   *  the whole Player state to localStorage. Guards against re-entry. */
  private finalizeRun(): void {
    if (this.runFinalized) return;
    this.runFinalized = true;

    // Nights fully survived = (night number at end) - 1 for a loss, or WIN_NIGHT
    // (plus any endless extras) for a win. Endless runs keep counting via
    // clock.night past WIN_NIGHT.
    const nightsSurvived = this.victory
      ? Math.max(this.clock.night - 1, WIN_NIGHT)
      : Math.max(0, this.clock.night - 1);

    const snapshot: RunSnapshot = {
      night: nightsSurvived,
      rescued: this.stats.rescued,
      stationsBuilt: this.stats.stationsBuilt,
      coinsSpent: this.stats.coinsSpent,
      coinsCollected: this.stats.coinsCollected,
      kills: this.stats.kills,
      won: this.victory,
      lost: !this.victory,
      anyWallEverDied: this.runCtx.anyWallEverDied,
      diaryEntriesReadThisRun: this.runCtx.diaryEntriesReadThisRun,
      poisDiscoveredThisRun: this.runCtx.poisDiscoveredThisRun,
      maxCoinAtAnyPoint: this.runCtx.maxCoinAtAnyPoint,
      maxWorkersAtAnyPoint: this.runCtx.maxWorkersAtAnyPoint,
      maxCampfireLevel: this.runCtx.maxCampfireLevel,
    };

    // Lifetime totals roll forward BEFORE we evaluate, so lifetime-scope
    // achievements that depend on "totalRunsPlayed" include this run.
    mergeLifetime(this.player, {
      totalKills: this.stats.kills,
      totalNights: nightsSurvived,
      totalRescued: this.stats.rescued,
      totalRunsWon: this.victory ? 1 : 0,
      totalRunsPlayed: 1,
      totalCoinsSpent: this.stats.coinsSpent,
      totalCoinsCollected: this.stats.coinsCollected,
    });

    // Next lost-child reveal — one per completed run, in authored order.
    const runsCompleted = this.player.lifetime.totalRunsPlayed;
    const nextChildIdx = runsCompleted - 1; // this run = run #runsCompleted
    if (nextChildIdx >= 0 && nextChildIdx < LOST_CHILD_IDS.length) {
      if (unlockCodex(this.player, LOST_CHILD_IDS[nextChildIdx])) {
        const entry = CODEX_ENTRIES.find((e) => e.id === LOST_CHILD_IDS[nextChildIdx]);
        if (entry) {
          this.enqueueNote({
            title: `A name, recovered · ${entry.title}`,
            body: entry.body,
          });
        }
      }
    }

    // Walk achievements once; surface each unlock as a parchment card.
    const unlocks = evaluateAchievements(
      {
        run: snapshot,
        lifetime: this.player.lifetime,
        codex: this.player.codex,
        codexTotal: CODEX_ENTRIES.length,
      },
      this.player.achievements,
    );
    for (const id of unlocks) {
      unlockAchievement(this.player, id);
      this.runCtx.achievementsEarnedThisRun += 1;
      const def = achievementById(id);
      if (def) {
        this.enqueueNote({
          title: `Achievement · ${def.title}`,
          body: def.description,
        });
      }
    }

    // Final score includes the achievementsEarnedThisRun we just bumped.
    this.finalScore = computeScore({
      nightsSurvived,
      villagersRescued: this.stats.rescued,
      coinsSpent: this.stats.coinsSpent,
      achievementsEarnedThisRun: this.runCtx.achievementsEarnedThisRun,
      modifierMultiplier: this.modifierScoreMultiplier,
    });

    savePlayer(this.player);

    // Build the leaderboard submission. We don't post it immediately —
    // first we check whether this score is going to make today's top 20,
    // and if so, offer the player a chance to sign it with a real name.
    const endlessNights = Math.max(0, nightsSurvived - WIN_NIGHT);
    const submission: PostScoreInput = {
      seed: this.seedLabel,
      score: this.finalScore.total,
      nights: nightsSurvived,
      rescued: this.stats.rescued,
      coinsSpent: this.stats.coinsSpent,
      modifiers: this.modifierIds,
      endlessNights,
      name: this.player.handle,
    };

    // Only prompt the very first time the player finishes a run. After
    // that their handle — whether they chose one or kept "anon" — is
    // what every future run posts under. No nagging, no qualify-gating.
    // We still skip the prompt when the leaderboard is off (there's
    // nothing to sign) or the run was empty (nights 0, score 0).
    const shouldPrompt =
      this.leaderboardState.enabled &&
      !this.player.nameAsked &&
      nightsSurvived > 0 &&
      this.finalScore.total > 0;

    if (!shouldPrompt) {
      this.postFinalScore(submission);
      return;
    }

    // Queue the submission and open the prompt over the end screen.
    this.pendingSubmission = submission;
    this.handlePromptState.value = '';
    this.handlePromptState.blinkOn = true;
    this.textInputBuffer.length = 0;
    this.endOfRunNamePromptVisible = true;
  }

  /** Tracks a submission that's waiting on the player's choice of name.
   *  `null` once the submission has been posted (or decided to be skipped). */
  private pendingSubmission: PostScoreInput | null = null;
  /** True when the end screen should show the "sign the chronicles" prompt. */
  endOfRunNamePromptVisible = false;

  /** Commit path from the end-of-run prompt. Saves the new handle if
   *  valid, then posts the cached submission. Called on Enter/Save.
   *  Always marks `nameAsked` so we never pop the prompt again. */
  commitEndOfRunPrompt(): void {
    if (!this.pendingSubmission) {
      this.endOfRunNamePromptVisible = false;
      this.player.nameAsked = true;
      savePlayer(this.player);
      return;
    }
    const draft = this.handlePromptState.value.trim();
    if (draft.length >= 3 && draft.length <= 12) {
      setHandle(this.player, draft);
      this.pendingSubmission.name = this.player.handle;
    }
    // Blank → post as 'anon'. Too-short / too-long → we treat as if they
    // cancelled, so the handle stays at its current value.
    this.player.nameAsked = true;
    savePlayer(this.player);
    const sub = this.pendingSubmission;
    this.pendingSubmission = null;
    this.endOfRunNamePromptVisible = false;
    this.postFinalScore(sub);
  }

  /** Cancel path — player chose "Keep anon". Posts the submission
   *  unchanged with the existing handle and marks `nameAsked` so they
   *  aren't re-prompted next run. */
  cancelEndOfRunPrompt(): void {
    this.player.nameAsked = true;
    savePlayer(this.player);
    if (!this.pendingSubmission) {
      this.endOfRunNamePromptVisible = false;
      return;
    }
    const sub = this.pendingSubmission;
    this.pendingSubmission = null;
    this.endOfRunNamePromptVisible = false;
    this.postFinalScore(sub);
  }

  /** Actual network write. Fire-and-forget; records the returned row id
   *  for future "highlight as mine" on the leaderboard modal. */
  private postFinalScore(submission: PostScoreInput): void {
    postScore(submission)
      .then((id) => {
        if (id != null) {
          this.player.postedScoreIds.push(id);
          savePlayer(this.player);
          this.leaderboardState.ownIds.add(id);
        }
      })
      .catch(() => {
        // swallow: leaderboard is best-effort.
      });
  }

  private tickReadyTimers(dt: number) {
    if (this.lanternTimeLeft > 0) {
      this.lanternTimeLeft = Math.max(0, this.lanternTimeLeft - dt);
    }
    for (const s of this.stations) {
      if (s.readyTimer > 0) s.readyTimer = Math.max(0, s.readyTimer - dt);
      if (s.repairFx > 0) s.repairFx = Math.max(0, s.repairFx - dt);
      if (s.unpaidFx > 0) s.unpaidFx = Math.max(0, s.unpaidFx - dt);
    }
    if (this.campfire.readyTimer > 0) {
      this.campfire.readyTimer = Math.max(0, this.campfire.readyTimer - dt);
    }
  }

  private updateQuests(dt: number) {
    if (this.questCompleteFlashTime > 0) {
      this.questCompleteFlashTime -= dt;
    }
    if (this.nightBannerTime > 0) {
      this.nightBannerTime = Math.max(0, this.nightBannerTime - dt);
    }
    if (this.dawnBannerTime > 0) {
      this.dawnBannerTime = Math.max(0, this.dawnBannerTime - dt);
    }
    if (this.questIndex >= QUESTS.length) return;
    const current = QUESTS[this.questIndex];
    if (current.isComplete(this)) {
      this.questIndex += 1;
      this.questCompleteFlashTime = 2.5;
    }
  }

  private updateFog() {
    const heroR = 130;
    this.fog.reveal(this.hero.x, this.hero.y, heroR);
    this.discoverAround(this.hero.x, this.hero.y, heroR);
    for (const s of this.stations) {
      const r = stationVision(s.kind);
      this.fog.reveal(s.x, s.y, r);
      this.discoverAround(s.x, s.y, r);
    }
    for (const r of this.recruits) {
      if (r.status === 'wandering') continue;
      this.fog.reveal(r.x, r.y, 58);
      this.discoverAround(r.x, r.y, 58);
    }
  }

  private discoverAround(x: number, y: number, radius: number) {
    const r2 = radius * radius;
    for (const p of this.portals) {
      if (p.discovered) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < r2) {
        p.discovered = true;
        // Seed two standing guards at the portal the moment a player reveals
        // it — so it doesn't feel like a free-for-the-taking piñata.
        this.spawnPortalDefenders(p);
        p.defendCooldown = PORTAL_DEFEND_COOLDOWN * this.modifierEffects.portalDefendCooldownMult;
      }
    }
    for (const poi of this.pois) {
      if (poi.discovered) continue;
      const dx = poi.x - x;
      const dy = poi.y - y;
      if (dx * dx + dy * dy < r2) {
        poi.discovered = true;
        this.runCtx.poisDiscoveredThisRun += 1;
      }
    }
  }


  private updateCamera() {
    // While the hero is waiting to respawn, follow the campfire so the player
    // can see the countdown and their base rather than an empty last-death spot.
    const focusX = this.hero.respawnTimer > 0 ? this.campfire.x : this.hero.x;
    const focusY = this.hero.respawnTimer > 0 ? this.campfire.y : this.hero.y;
    const targetX = focusX - this.width / 2;
    const targetY = focusY - this.height / 2;
    const maxX = Math.max(0, this.worldW - this.width);
    const maxY = Math.max(0, this.worldH - this.height);
    this.cameraX = Math.max(0, Math.min(maxX, targetX));
    this.cameraY = Math.max(0, Math.min(maxY, targetY));
  }

  private ensureBaseStructuresForLevel(delayFreshGhosts = true) {
    const level = this.campfire.level;
    const cx = this.campfire.x;
    const cy = this.campfire.y;
    const costMult = this.modifierEffects?.costMult ?? 1;
    const addGhost = (kind: StationKind, x: number, y: number) => {
      const s = createStation(kind, x, y);
      if (delayFreshGhosts) s.readyTimer = STATION_READY_DELAY;
      // Brittle-Walls-style modifier shrinks wall HP at the moment of ghost
      // creation so respawned walls carry the curse too, not just the
      // initial ring.
      if (kind === 'wall' && this.modifierEffects?.wallHpMult !== 1) {
        const m = this.modifierEffects?.wallHpMult ?? 1;
        s.maxHp = Math.max(1, Math.floor(s.maxHp * m));
        s.hp = s.maxHp;
      }
      // Tight-Purse-style modifier: the ghost shows up already marked up.
      if (costMult !== 1) {
        s.buildRemaining = Math.max(1, Math.floor(s.buildRemaining * costMult));
      }
      this.stations.push(s);
    };

    // Respawn any core building slot that was destroyed overnight. The new
    // ghost has to be paid for again — but at least the option comes back.
    for (const slot of this.coreBaseSlots) {
      const exists = this.stations.some(
        (s) =>
          s.kind === slot.kind &&
          Math.abs(s.x - slot.x) < 2 &&
          Math.abs(s.y - slot.y) < 2,
      );
      if (!exists) addGhost(slot.kind, slot.x, slot.y);
    }

    // Walls: a 8-slot ring, filling in from cardinals to diagonals as the
    // campfire grows. L1 = N/E/S/W, L2 adds NE/SW, L3 adds SE/NW.
    const wallIndicesByLevel: number[][] = [
      [0, 2, 4, 6],
      [0, 1, 2, 4, 5, 6],
      [0, 1, 2, 3, 4, 5, 6, 7],
    ];
    const ringSize = 8;
    const wantedWallIndices = wallIndicesByLevel[level - 1] ?? [];
    for (const idx of wantedWallIndices) {
      const angle = (idx / ringSize) * Math.PI * 2 - Math.PI / 2;
      const wx = cx + Math.cos(angle) * WALL_PERIMETER_RADIUS;
      const wy = cy + Math.sin(angle) * WALL_PERIMETER_RADIUS;
      const exists = this.stations.some(
        (s) => s.kind === 'wall' && Math.abs(s.x - wx) < 2 && Math.abs(s.y - wy) < 2,
      );
      if (!exists) addGhost('wall', wx, wy);
    }

    // Towers: N first, then SW, then SE — one per campfire level.
    const towerPositions: Array<[number, number]> = [
      [cx, cy - 85],
      [cx - 80, cy + 50],
      [cx + 80, cy + 50],
    ];
    const wantedTowers = level;
    for (let i = 0; i < wantedTowers; i++) {
      const [tx, ty] = towerPositions[i];
      const exists = this.stations.some(
        (s) => s.kind === 'tower' && Math.abs(s.x - tx) < 2 && Math.abs(s.y - ty) < 2,
      );
      if (!exists) addGhost('tower', tx, ty);
    }

    // Outer expansion gather post appears once the campfire hits L2 — a clear
    // reward for investing in the upgrade path, and a reason to push outward.
    if (level >= 2) {
      const ox = cx - 280;
      const oy = cy + 5;
      const exists = this.stations.some(
        (s) =>
          s.kind === 'gather' &&
          Math.abs(s.x - ox) < 2 &&
          Math.abs(s.y - oy) < 2,
      );
      if (!exists) addGhost('gather', ox, oy);
    }
  }

  /** Registry of core-building positions so day-start can respawn any that
   *  got destroyed overnight. Populated in `initializeStartingBase`. */
  private coreBaseSlots: Array<{ kind: StationKind; x: number; y: number }> = [];

  private initializeStartingBase() {
    const cx = this.campfire.x;
    const cy = this.campfire.y;

    this.coreBaseSlots = [
      { kind: 'gather', x: cx + 25, y: cy + 65 },
      { kind: 'workshop', x: cx - 70, y: cy - 35 },
      { kind: 'barracks', x: cx + 70, y: cy - 35 },
      { kind: 'garrison', x: cx - 30, y: cy + 130 },
      { kind: 'farm', x: cx + 140, y: cy + 85 },
      { kind: 'blacksmith', x: cx + 130, y: cy - 70 },
    ];
    for (const slot of this.coreBaseSlots) {
      this.stations.push(createStation(slot.kind, slot.x, slot.y));
    }

    // Walls, towers, and the outer expansion gather grow with campfire level
    // — see ensureBaseStructuresForLevel. Initial setup: no delay so the
    // player can start paying for the opening base immediately.
    this.ensureBaseStructuresForLevel(false);

    const spawns: Array<{ x: number; y: number }> = [
      { x: cx - 28, y: cy - 20 },
      { x: cx + 28, y: cy - 20 },
      { x: cx - 28, y: cy + 22 },
      { x: cx + 28, y: cy + 22 },
    ];
    // "Lean Ranks" modifier drops starting villagers. Clamp to 0 so stacking
    // extra deltas in the future can't go negative.
    const startCount = Math.max(
      0,
      spawns.length + (this.modifierEffects?.startingRecruitDelta ?? 0),
    );
    for (let i = 0; i < startCount; i++) {
      const p = spawns[i % spawns.length];
      const r = createWanderer(p.x, p.y, p.x, p.y);
      r.status = 'idle';
      r.orbitAngle = Math.random() * Math.PI * 2;
      this.recruits.push(r);
    }
  }

  get effectiveSwingRange(): number {
    return HERO_SWING_RANGE + this.upgrades.heroRange;
  }

  update(dt: number) {
    if (this.showMenu) {
      this.updateMenu(dt);
      this.input.endFrame();
      return;
    }
    if (this.endlessChoicePending) {
      // N10 victory prompt — player picks Return or Press into the dark.
      this.updateEndlessChoice();
      this.input.endFrame();
      return;
    }
    if (this.gameOver) {
      if (this.endOfRunNamePromptVisible) {
        this.updateEndOfRunPrompt(dt);
        this.input.endFrame();
        return;
      }
      // After a run ends, any "next" input throws us back to the main menu.
      if (
        this.input.pressed('KeyR') ||
        this.input.pressed('Space') ||
        this.input.pressed('Enter') ||
        this.input.mouseJustDown
      ) {
        this.wantsRestart = true;
        // No pending options — go back to the plain title screen.
        this.pendingRestartOptions = null;
      }
      this.input.endFrame();
      return;
    }
    if (this.activeNote) {
      // Detect a fresh card and reset the reveal timeline so the
      // typewriter animation starts from t=0.
      if (this.activeNote !== this.lastSeenNote) {
        this.noteRevealTime = 0;
        this.lastSeenNote = this.activeNote;
      }
      this.noteRevealTime += dt;

      const hasPrompt = !!this.activeNote.prompt;
      const confirmInput =
        this.input.pressed('Space') ||
        this.input.pressed('Enter') ||
        this.input.mouseJustDown;
      const cancelInput = this.input.pressed('Escape');
      const advance = hasPrompt ? confirmInput || cancelInput : confirmInput;

      if (advance) {
        const revealDur = noteCardRevealDuration(this.activeNote);
        if (this.noteRevealTime < revealDur && !cancelInput) {
          // Mid-reveal Space/Enter/click snaps the typewriter to fully-
          // revealed instead of advancing — same two-press dismissal
          // pattern as before. Esc skips straight to cancel even mid-
          // reveal so a player can decline an irreversible choice fast.
          this.noteRevealTime = revealDur + 1;
        } else {
          // Run the prompt's accept/decline side-effect (claim or skip
          // the pending night POI bargain) BEFORE clearing the card so
          // the action lands while we still know which choice was made.
          if (hasPrompt) {
            if (cancelInput) this.cancelPendingNightBargain();
            else this.acceptPendingNightBargain();
          }
          this.activeNote = this.noteQueue.shift() ?? null;
          this.noteRevealTime = 0;
          this.lastSeenNote = this.activeNote;
        }
      }
      this.input.endFrame();
      return;
    }
    // Gate night→dawn on a clear board. Dawn can only arrive once every
    // enemy spawned by the wave schedule (plus anything that crawled out
    // of a portal, a graveyard POI, etc.) has been dealt with. Practically
    // this means "no pending spawns AND no live enemies."
    this.clock.update(dt, (from) => {
      if (from !== 'night') return true;
      return this.nightEnemiesCleared();
    });
    if (this.clock.phase !== this.lastPhase) {
      this.onPhaseEnter(this.clock.phase);
      this.lastPhase = this.clock.phase;
    }

    this.autoplay.update(this, dt);

    this.campfire.update(dt);
    // Track how long the hero has been standing still — coin pips on
    // buildings only render once this exceeds a small grace threshold,
    // so they don't flicker on as the player walks past.
    if (this.hero.isMoving) this.heroStoppedTime = 0;
    else this.heroStoppedTime += dt;

    this.handleVillagerDrop();

    this.updateStationPayment(dt);
    const poiInProgress = this.pois.some(
      (p) => !p.claimed && p.interactProgress > 0,
    );
    const chopBlocked = this.payTargetId !== null || poiInProgress;
    this.hero.update(
      dt,
      this.input,
      this.map,
      (node) => this.onNodeHit(node),
      chopBlocked,
    );

    if (this.clock.phase === 'day') {
      this.wandererSpawnTick(dt);
      // Dusk telegraph — when the day is almost over, place warlight
      // markers at random map edges showing where siege portals will
      // open at night-start.
      const dayRemaining = this.clock.remaining();
      if (dayRemaining <= DUSK_TELEGRAPH_LEAD && !this.duskTelegraphActive) {
        this.duskTelegraphActive = true;
        const count = this.clock.night >= 7 ? 3 : 2;
        const points = this.pickSiegeRingPoints(count);
        for (const [x, y] of points) {
          this.warlights.push(createWarlight(x, y));
        }
      }
    }
    if (this.clock.phase === 'night') this.processSpawnQueue();

    this.tickKnightWallSupport(dt);
    this.tickKissCurses(dt);
    this.maybeFireLeftLightCallback();
    this.updateEnemies(dt);
    this.applyCampfireAura();
    this.updateFarms(dt);
    this.updateRecruits(dt);
    this.flushPaidSlots();
    this.updateProjectiles(dt);
    this.updateCoins(dt);
    this.updateFlyingCoins(dt);
    this.resolveHeroAttack();
    this.updatePortals(dt);
    this.updatePOIs(dt);
    this.updateCamera();
    this.updateFog();
    this.tickReadyTimers(dt);
    this.updateQuests(dt);

    if (this.hero.hp <= 0 && this.hero.respawnTimer <= 0) {
      this.hero.respawnAt(this.campfire.x, this.campfire.y);
    }
    if (this.campfire.hp <= 0) this.gameOver = true;

    // Lightweight per-frame run-context tracking. Only mutates numeric maxes,
    // so the cost is negligible even at late-game station counts.
    if (this.resources.coin > this.runCtx.maxCoinAtAnyPoint) {
      this.runCtx.maxCoinAtAnyPoint = this.resources.coin;
    }
    if (this.campfire.level > this.runCtx.maxCampfireLevel) {
      this.runCtx.maxCampfireLevel = this.campfire.level;
    }
    // "Workers" means villagers currently assigned to a station and actually
    // doing (or travelling to) a job — i.e. status 'working' or 'moving'.
    let workers = 0;
    for (const r of this.recruits) {
      if (r.status === 'working' || r.status === 'moving') workers++;
    }
    if (workers > this.runCtx.maxWorkersAtAnyPoint) {
      this.runCtx.maxWorkersAtAnyPoint = workers;
    }

    // Evaluate achievements + lost-child codex unlocks exactly once when the
    // run ends (win or loss). finalizeRun guards against re-entry.
    if (this.gameOver && !this.runFinalized) this.finalizeRun();

    this.input.endFrame();
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.showMenu) {
      this.renderMenu(ctx);
      return;
    }
    ctx.save();
    ctx.translate(-this.cameraX, -this.cameraY);

    drawWorld(ctx, this.map, this.hero);
    const heroIsSettled = this.heroStoppedTime > 0.15;
    drawStations(ctx, this.stations, this.payTargetId, this.hero, this.campfire.level, this.clock.phase === 'night', heroIsSettled, this.relicsFound);
    drawPortals(ctx, this.portals);
    if (this.warlights.length > 0) {
      drawWarlights(ctx, this.warlights);
    }
    drawPOIs(ctx, this.pois);
    drawCampfire(ctx, this.campfire);
    drawCampfireUpgradeHint(ctx, this.campfire, this.hero, this.stations, this.clock.phase === 'night', this.relicsFound, heroIsSettled);
    drawLanternHook(
      ctx,
      this.campfire,
      this.hero,
      this.resources.coin,
      LANTERN_COST,
      LANTERN_DURATION,
      this.lanternTimeLeft,
      this.lanternProgress,
      heroIsSettled,
      LANTERN_PAY_RANGE,
    );
    drawLanternHalo(ctx, this.hero, this.lanternTimeLeft, LANTERN_DURATION, LANTERN_RADIUS);
    // The forge overlay rides above any active blacksmith — three rows
    // of chevrons + in-progress pips on the currently-selected track.
    for (const s of this.stations) {
      if (s.kind === 'blacksmith' && s.active) {
        drawForgeOverlay(ctx, s, this.forge, this.hero, heroIsSettled);
        drawWhetstoneOverlay(
          ctx,
          s,
          this.hero,
          WHETSTONE_COST,
          this.whetstoneProgressValue(),
          this.whetstoneBought,
          heroIsSettled,
        );
      }
    }
    drawCoins(ctx, this.coins);
    drawRecruits(ctx, this.recruits, this.stations);
    drawWandererSlots(ctx, this.recruits, this.hero, heroIsSettled);
    drawFlyingCoins(ctx, this.flyingCoins);
    if (this.hero.respawnTimer > 0) {
      drawDownedMarker(ctx, this.campfire.x, this.campfire.y, this.hero.respawnTimer);
    }
    drawEnemies(ctx, this.enemies);
    if (this.hero.respawnTimer <= 0) {
      drawHero(ctx, this.hero);
      drawHeroLantern(ctx, this.hero, this.lanternTimeLeft, LANTERN_DURATION);
    }
    drawProjectiles(ctx, this.projectiles);
    drawAttackFlash(ctx, this.hero, this.effectiveSwingRange);

    ctx.restore();

    // Fog of war obscures unexplored areas on top of the world rendering.
    this.fog.draw(ctx, this.cameraX, this.cameraY, this.width, this.height);

    // Relic discovery hint: a faint warm pulse rendered through the fog
    // for any undiscovered relic within sense range of the hero. Lets
    // the player aim toward a relic from far away without needing to
    // clear the whole map.
    drawRelicHints(ctx, this.pois, this.hero, this.cameraX, this.cameraY, this.width, this.height);

    applyLighting(
      ctx,
      this.clock,
      this.campfire,
      this.hero,
      this.stations,
      this.recruits,
      this.width,
      this.height,
      this.upgrades.campfireLight * this.modifierEffects.lightRadiusMult * this.visibilityMultFromKiss(),
      this.cameraX,
      this.cameraY,
    );

    // Night POI beacons — yellow/blood halos that punch through the
    // night darkness so the player can see the bargains the dark is
    // offering from a distance.
    drawNightPoiBeacons(ctx, this.pois, this.cameraX, this.cameraY, this.width, this.height);

    drawFocusPanel(
      ctx,
      this.stations,
      this.map.nodes,
      this.recruits,
      this.pois,
      this.portals,
      this.campfire,
      this.hero,
      this.resources.coin,
      this.width,
      this.height,
      this.clock,
      this.relicsFound,
      this.forge,
    );
    drawHUD(ctx, this.resources, this.clock, this.campfire, this.recruits, this.hero, this.seedLabel, this.coinCap());
    drawActionBar(ctx, this.width, this.height, this.hero, this.lanternTimeLeft, LANTERN_DURATION);
    drawQuestPanel(ctx, this.width, this.questIndex, this.questCompleteFlashTime);
    if (this.nightBannerTime > 0) {
      drawNightBanner(
        ctx,
        this.width,
        this.height,
        this.clock.night,
        this.nightBannerTime / NIGHT_BANNER_DURATION,
      );
    }
    if (this.dawnBannerTime > 0) {
      drawDawnBanner(
        ctx,
        this.width,
        this.height,
        this.clock.night,
        this.dawnBannerTime / DAWN_BANNER_DURATION,
      );
    }

    if (this.activeNote) {
      drawNoteCard(ctx, this.width, this.height, this.activeNote, this.noteRevealTime);
    }

    if (this.gameOver) {
      drawEndScreen(
        ctx,
        this.width,
        this.height,
        this.victory,
        this.clock,
        this.stats,
        this.seedLabel,
      );
      if (this.endOfRunNamePromptVisible) {
        // Overlay the prompt on top of the end screen with the
        // "sign the chronicles" copy variant so the player knows their
        // score qualified.
        this.handlePromptLayout = drawHandlePrompt(
          ctx,
          this.width,
          this.height,
          this.handlePromptState,
          this.input.mouseX,
          this.input.mouseY,
          END_OF_RUN_COPY,
        );
      }
    } else if (this.endlessChoicePending) {
      this.endlessChoiceLayout = drawEndlessChoiceOverlay(
        ctx,
        this.width,
        this.height,
        this.input.mouseX,
        this.input.mouseY,
      );
    }
  }

  private onNodeHit(node: ResourceNode) {
    // Hero chops pop two coins per swing — day income needs to pull its
    // weight vs. night enemy drops.
    this.coins.push(createCoin(node.x, node.y, 1));
    this.coins.push(createCoin(node.x, node.y, 1));
  }

  private onPhaseEnter(phase: Phase) {
    if (phase === 'day') {
      // Dawn → day side effects that used to live in `closeShop()`.
      // The dawn upgrade shop has been removed entirely; this happens
      // automatically when the dawn phase elapses (DAWN_LENGTH).
      this.wandererTimer = 8;
      this.ensureBaseStructuresForLevel();
      if (this.clock.night > WIN_NIGHT && !this.endlessMode && !this.endlessChoicePending) {
        // Victory moment. Present the "Return / Press into the dark"
        // choice before ending the run. updateEndlessChoice decides
        // which path to take and either flips gameOver (Return) or
        // sets endlessMode (continue).
        this.endlessChoicePending = true;
      }
    } else if (phase === 'night') {
      this.waveSchedule = scheduleFor(this.clock.night);
      this.recruits = this.recruits.filter((r) => r.status !== 'wandering');
      this.nightBannerTime = NIGHT_BANNER_DURATION;
      // Wild portals come back at night-start, in fresh locations.
      const wildAlive = this.portals.filter((p) => p.kind === 'wild').length;
      const need = Math.max(0, WILD_PORTAL_TARGET_COUNT - wildAlive);
      for (let i = 0; i < need; i++) this.spawnWildPortal();
      // Siege portals bloom from each warlight marker.
      for (const wl of this.warlights) {
        this.portals.push(createPortal('siege', wl.x, wl.y));
      }
      this.warlights = [];
      this.duskTelegraphActive = false;
      this.siegeActive = true;
      // Night POIs spawn now — bargain shrines that despawn at dawn.
      this.spawnNightPois();
    } else if (phase === 'dawn') {
      // Siege portals despawn at dawn. Any siege-origin enemies still
      // alive get cleared too — the gate-keeping nightEnemiesCleared()
      // already prevents reaching dawn while there are live enemies, so
      // this is mostly a clean-up for orphan cases.
      this.siegeActive = false;
      this.portals = this.portals.filter((p) => p.kind !== 'siege');
      this.enemies = this.enemies.filter((e) => e.origin !== 'siege');
      // Despawn unclaimed night POIs and any villagers marked for the
      // dawn pyre.
      this.despawnUnclaimedNightPois();
      this.despawnDawnMarkedRecruits();
    }
    if (phase === 'dawn') {
      this.dawnBannerTime = DAWN_BANNER_DURATION;
      // Surface the Scribe's diary entry for the night that just ended —
      // paces the mystery across the 10-night arc. The player must dismiss
      // the card before any other dawn action (shop, consumables, etc.).
      // "Forgotten Scribe" modifier strips the whole dawn ceremony — no diary,
      // no shop — so the narrative-only crowd can play pure runs.
      const diarySuppressed = this.modifierEffects.disableDiaryAndShop;
      if (!diarySuppressed) {
        const diary = diaryFor(this.clock.night);
        if (diary) {
          this.enqueueNote(diary);
          // Reading this page unlocks it permanently in the codex. Also
          // counts toward the Scholar achievement this run.
          if (unlockCodex(this.player, `diary:${this.clock.night}`)) {
            savePlayer(this.player);
          }
          this.runCtx.diaryEntriesReadThisRun += 1;
          // Reading every diary entry in a single run also unlocks the
          // hidden portal field note "the sign" — the Yellow-Sign hint.
          // It's a deliberate reward for the player who's been pacing
          // their reading; missing a single dawn locks them out for the
          // run.
          if (this.runCtx.diaryEntriesReadThisRun >= 10) {
            if (unlockCodex(this.player, 'portal:9')) {
              savePlayer(this.player);
            }
          }
        }
      }
    }
  }

  private processSpawnQueue() {
    const t = this.clock.phaseTime;
    while (this.waveSchedule.length > 0 && this.waveSchedule[0].time <= t) {
      const entry = this.waveSchedule.shift()!;
      this.spawnEnemy(entry.kind);
    }
  }

  /** Night is "clear" when no more wave entries are queued to spawn and
   *  every SIEGE-origin enemy is dead. Wild-origin packs are background
   *  threats meant to persist regardless of phase, so they don't gate
   *  dawn — that would deadlock the night any time wild enemies were
   *  alive somewhere on the map. Siege-origin enemies (wave spawns,
   *  graveyard POI scares, etc.) are the actual "hold the line" pressure. */
  nightEnemiesCleared(): boolean {
    if (this.waveSchedule.length > 0) return false;
    return !this.enemies.some((e) => e.origin === 'siege');
  }

  private spawnEnemy(kind: EnemyKind) {
    // Wave enemies emerge from siege portals. Wild portals are exploration
    // hazards that run their own pack scheduler — they don't soak the
    // wave schedule, so the player can still feel a siege focused at the
    // base even while wild portals exist on the map.
    const siegePortals = this.portals.filter((p) => p.kind === 'siege');
    if (siegePortals.length > 0) {
      const portal = siegePortals[Math.floor(Math.random() * siegePortals.length)];
      const jx = (Math.random() - 0.5) * 24;
      const jy = (Math.random() - 0.5) * 24;
      this.enemies.push(createEnemy(kind, portal.x + jx, portal.y + jy, 'siege'));
      portal.spawnedThisNight += 1;
      return;
    }
    // No siege portal on the map (e.g. day-time scares from POIs) — spawn
    // at a random edge so the enemy still appears.
    const [x, y] = this.randomEdgePoint();
    this.enemies.push(createEnemy(kind, x, y, 'siege'));
  }

  /** Spawn a 2–3 enemy pack at a wild portal. Pack members carry the
   *  portal's id so they patrol around it (see `updateEnemies`). */
  private spawnWildPack(portal: Portal) {
    if (portal.kind !== 'wild') return;
    // Cap: don't keep stuffing packs at a portal the player is ignoring.
    const liveAtPortal = this.enemies.filter(
      (e) => e.origin === 'wild' && e.homePortalId === portal.id,
    ).length;
    if (liveAtPortal >= WILD_PORTAL_PACK_CAP) {
      // Try again later; reset cooldown shorter so we re-check soon.
      portal.packCooldown = 8 + Math.random() * 4;
      return;
    }
    // Pack composition scales lightly with night number — runners early,
    // a chance of a brute from N4+.
    const size = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < size; i++) {
      const a = (i / size) * Math.PI * 2 + Math.random() * 0.3;
      const r = 22 + Math.random() * 14;
      const ex = portal.x + Math.cos(a) * r;
      const ey = portal.y + Math.sin(a) * r;
      const isBrute = this.clock.night >= 4 && Math.random() < 0.18;
      const kind: EnemyKind = isBrute ? 'brute' : 'runner';
      this.enemies.push(createEnemy(kind, ex, ey, 'wild', portal.id));
    }
    portal.packCooldown = WILD_PORTAL_PACK_INTERVAL * (0.85 + Math.random() * 0.3);
  }

  private updatePortals(dt: number) {
    for (const p of this.portals) {
      if (p.hitFlash > 0) p.hitFlash -= dt;
      if (p.defendCooldown > 0) p.defendCooldown = Math.max(0, p.defendCooldown - dt);
      p.swirl = (p.swirl + dt * 1.6) % (Math.PI * 2);

      // Wild portals tick down toward the next pack spawn. Skip if a pack
      // can't fit (cap check is inside spawnWildPack so the cooldown
      // resets to a short value rather than stalling forever).
      if (p.kind === 'wild' && p.hp > 0) {
        p.packCooldown = Math.max(0, p.packCooldown - dt);
        if (p.packCooldown <= 0) this.spawnWildPack(p);
      }
    }

    // Killed portals — coins drop on death. Wild portals stay gone until
    // the next night-start (handled in onPhaseEnter). Siege portals
    // simply despawn for the night.
    const killed = this.portals.filter((p) => p.hp <= 0);
    if (killed.length > 0) {
      for (const dead of killed) {
        // Reward: a shower of coins spills from the collapsing portal.
        for (let i = 0; i < 25; i++) {
          this.coins.push(createCoin(dead.x, dead.y, 1));
        }
        // Orphan any wild enemies whose home portal just died — switch them
        // to aggro mode so they don't get stuck patrolling a dead point.
        for (const e of this.enemies) {
          if (e.origin === 'wild' && e.homePortalId === dead.id) {
            e.homePortalId = undefined;
            e.patrolMode = 'aggro';
          }
        }
      }
      this.portals = this.portals.filter((p) => p.hp > 0);
    }

    // Tick warlight markers (dusk telegraphs).
    for (const w of this.warlights) w.age += dt;
  }

  /** Spawn a fresh wild portal at a random ring-position not too close to
   *  existing portals or warlight markers. Used at night-start to bring
   *  the wild count back to `WILD_PORTAL_TARGET_COUNT`. */
  private spawnWildPortal() {
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    const ringR = Math.min(cx, cy) * 0.82;
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = ringR * (0.72 + Math.random() * 0.28);
      const x = clamp(cx + Math.cos(angle) * r, 60, this.worldW - 60);
      const y = clamp(cy + Math.sin(angle) * r, 60, this.worldH - 60);
      const tooClose =
        this.portals.some((p) => Math.hypot(p.x - x, p.y - y) < 160) ||
        this.warlights.some((wl) => Math.hypot(wl.x - x, wl.y - y) < 160);
      if (!tooClose) {
        this.portals.push(createPortal('wild', x, y));
        return;
      }
    }
  }

  private updatePOIs(dt: number) {
    let target: POI | undefined;
    let bestD = POI_INTERACT_RANGE;
    for (const poi of this.pois) {
      if (poi.claimed) continue;
      const d = Math.hypot(poi.x - this.hero.x, poi.y - this.hero.y);
      if (d < bestD) {
        target = poi;
        bestD = d;
      }
    }

    const holding = this.input.held('Space');

    for (const poi of this.pois) {
      if (poi === target && holding) {
        poi.interactProgress += dt;
        if (poi.interactProgress >= POI_INTERACT_DURATION) {
          poi.interactProgress = 0;
          const inst = poiInstance(poi.instanceId);
          if (inst?.category === 'night' && inst.nightKissCurseId) {
            // Night POIs are irreversible bargains — surface a Y/N
            // confirmation card before applying the kiss/curse so the
            // player can back out if the cost reads worse than the gain.
            // The POI is NOT marked claimed yet; cancelling leaves it on
            // the map and the player can re-attempt or walk away.
            this.requestNightBargainConfirmation(poi);
          } else {
            poi.claimed = true;
            this.claimPOI(poi);
          }
        }
      } else if (poi.interactProgress > 0) {
        poi.interactProgress = Math.max(0, poi.interactProgress - dt * 2);
      }
    }
  }

  /** Surface a confirmation card for the night POI's kiss/curse pair.
   *  The card is the same explainer text shown on accept (so the player
   *  sees exactly the price) but with a Y/N prompt footer. The POI is
   *  parked in `pendingNightBargainPoi` until the card resolves. */
  private requestNightBargainConfirmation(poi: POI) {
    const inst = poiInstance(poi.instanceId);
    if (!inst || !inst.nightKissCurseId) return;
    const preview = nightKissCurseDescription(inst.nightKissCurseId);
    if (!preview) return;
    this.pendingNightBargainPoi = poi;
    this.enqueueNote({
      title: preview.title,
      body: preview.body,
      accent: 'ember',
      prompt: {
        confirmLabel: 'Take the bargain',
        cancelLabel: 'Walk away',
      },
    });
  }

  /** The player confirmed the pending night POI bargain. Mark the POI
   *  claimed and route through the normal claim path so the lore card +
   *  effects fire. */
  private acceptPendingNightBargain() {
    const poi = this.pendingNightBargainPoi;
    this.pendingNightBargainPoi = null;
    if (!poi) return;
    poi.claimed = true;
    this.claimPOI(poi);
  }

  /** The player declined. Leave the POI on the map for retry — its
   *  interactProgress was already reset, so the next hold-Space gesture
   *  will fill the meter again from zero. No coins lost, no effects. */
  private cancelPendingNightBargain() {
    this.pendingNightBargainPoi = null;
  }

  /** Apply a claimed POI's reward and surface its lore card. Behavior is
   *  driven entirely by the authored instance's `category` + payload. */
  private claimPOI(poi: POI) {
    const inst = poiInstance(poi.instanceId);
    if (!inst) return;

    switch (inst.category) {
      case 'relic': {
        // Set the unlock flag for the corresponding gate. Campfire-tier
        // relics flip l2/l3; building-unlock relics flip the matching
        // building flag. No coins, no villagers — the gate just opens.
        if (inst.relicLevel === 2) this.relicsFound.l2 = true;
        if (inst.relicLevel === 3) this.relicsFound.l3 = true;
        if (inst.unlocksBuilding) {
          this.relicsFound[inst.unlocksBuilding] = true;
        }
        break;
      }
      case 'settlement': {
        const n = inst.villagerCount ?? 0;
        for (let i = 0; i < n; i++) {
          const angle = (i / Math.max(1, n)) * Math.PI * 2;
          const spawnX = poi.x + Math.cos(angle) * 20;
          const spawnY = poi.y + Math.sin(angle) * 20;
          // Villagers found at settlements still need to be rescued for
          // RESCUE_COST coins each, like wanderers from the map edges.
          // They linger at the POI (targetX/Y = spawn) until the hero
          // walks up and pays. Encourages the player to plan a rescue
          // run instead of getting free villagers off any settlement.
          const v = createWanderer(spawnX, spawnY, spawnX, spawnY);
          v.orbitAngle = Math.random() * Math.PI * 2;
          this.recruits.push(v);
        }
        break;
      }
      case 'lore': {
        const n = inst.coinReward ?? 0;
        for (let i = 0; i < n; i++) {
          this.coins.push(createCoin(poi.x, poi.y, 1));
        }
        break;
      }
      case 'upgrade': {
        // Claim advances the next un-earned tier on the matching track.
        // If the track is already maxed we still surface the lore card
        // below — but no tier change happens.
        if (inst.upgradeTrack) {
          this.applyForgeTrackTier(inst.upgradeTrack);
        }
        break;
      }
      case 'night': {
        // Apply the kiss/curse pair effects. The bargain description was
        // already shown on the pre-claim confirmation card, so we don't
        // re-surface it here — the lore card below is the only post-claim
        // beat the player sees.
        if (inst.nightKissCurseId) {
          this.applyNightKissCurse(inst.nightKissCurseId);
        }
        break;
      }
    }

    // Surface the authored lore card. Goes through the parchment-card
    // queue, so multi-claim chains (e.g. relic + settlement back-to-back)
    // present cleanly one after the other.
    this.enqueueNote({ title: inst.loreTitle, body: inst.loreBody });

    // For relics, follow the lore card with a punchy ember-accented
    // "UPGRADE UNLOCKED" card. The lore card is easy to skim past as
    // more narrative; this second card is the one that explicitly tells
    // the player what they just bought and what they should do next.
    if (inst.category === 'relic') {
      if (inst.relicLevel === 2) {
        this.enqueueNote({
          title: 'Upgrade unlocked · Campfire L2',
          body:
            "The fire can be fed. Bring 40 coins to the campfire and hold the pay key — the flame will grow, its aura will reach further, and the dark will hold its breath a little longer. The fire still wants a Barracks built before it will accept the offering.",
          accent: 'ember',
          cta: 'Build a Barracks · Bring 40 coins to the fire',
        });
      } else if (inst.relicLevel === 3) {
        this.enqueueNote({
          title: 'Upgrade unlocked · Campfire L3',
          body:
            "The hollow kindling will burn brighter and longer than any green wood. Bring 75 coins to the campfire and hold the pay key — the fire will rise to its full height. It still wants the Stables and a Blacksmith standing watch before it will accept the offering.",
          accent: 'ember',
          cta: 'Build the Stables + Blacksmith · Bring 75 coins to the fire',
        });
      } else if (inst.unlocksBuilding === 'workshop') {
        this.enqueueNote({
          title: 'Workshop unlocked',
          body:
            "The blueprint folds into your pack like it knew where it was going. The workshop ghost is no longer locked. Build it and the builders will know how to mend what the dark breaks.",
          accent: 'ember',
          cta: 'Workshop is now buildable.',
        });
      } else if (inst.unlocksBuilding === 'blacksmith') {
        this.enqueueNote({
          title: 'Blacksmith unlocked',
          body:
            "The anvil is heavier than it should be, but it carries. The blacksmith ghost is no longer locked. Build it and the smith will hone your blade against fresher iron.",
          accent: 'ember',
          cta: 'Blacksmith is now buildable.',
        });
      } else if (inst.unlocksBuilding === 'stables') {
        this.enqueueNote({
          title: 'Stables unlocked',
          body:
            "You sling the bridle over your shoulder. The stables ghost is no longer locked. Build it and the knights will ride out instead of waiting for the dark to find them.",
          accent: 'ember',
          cta: 'Stables are now buildable.',
        });
      }
    }
  }

  /** Advance the given forge track by one tier, if not already maxed.
   *  Surfaces an ember "tier unlocked" card after the lore card so the
   *  player gets a clear "you've earned X" beat. If the track is
   *  already at Tier III, surface a graceful "fully drilled" note
   *  instead. */
  private applyForgeTrackTier(track: ForgeTrack) {
    const newTier = advanceTrackOneTier(this.forge, track);
    const trackSpec = FORGE_TRACKS[track];
    if (newTier === null) {
      // Already maxed — the lore card stands alone, with a footer hint.
      this.enqueueNote({
        title: `${trackSpec.label} · Already drilled`,
        body:
          `Your ${trackSpec.label.toLowerCase()} have already learned everything this lesson can teach. The chronicle is still worth a read — but the iron is already as keen as it will be.`,
        accent: 'ember',
      });
      return;
    }
    const tierSpec = trackSpec.tiers[newTier - 1];
    this.enqueueNote({
      title: `${trackSpec.label} · Tier ${newTier}`,
      body: `${tierSpec.name}. ${tierSpec.blurb}.`,
      accent: 'ember',
      cta:
        newTier < 3
          ? `Find ${trackSpec.label} again to earn the next tier.`
          : `${trackSpec.label} fully forged.`,
    });
  }

  /** Apply the kiss/curse pair effects for a night POI claim. The
   *  description shown on the pre-claim confirmation card is sourced
   *  from `nightKissCurseDescription()` — keep both in lockstep when
   *  adding new bargains. */
  private applyNightKissCurse(id: string) {
    if (id === 'restless_bowyer') {
      // KISS: hero swing +2 dmg for 60s. CURSE: a runner spawns at
      // hero every 8s for that 60s, "marked" by a yellow figure that
      // followed you home.
      this.activeKisses.restlessBowyer = { timeLeft: 60, nextSpawnIn: 8 };
    } else if (id === 'pyre_villager') {
      // KISS: a free idle villager spawns near the campfire. CURSE:
      // marked, will despawn at dawn.
      const v = createWanderer(
        this.campfire.x + 14,
        this.campfire.y + 18,
        this.campfire.x + 14,
        this.campfire.y + 18,
      );
      v.status = 'idle';
      v.orbitAngle = Math.random() * Math.PI * 2;
      // Stash the marked flag on the recruit. We loose-cast because
      // the field is optional and only nights touch it.
      (v as Recruit & { markedForDawn?: boolean }).markedForDawn = true;
      this.recruits.push(v);
    } else if (id === 'leaky_purse') {
      // KISS: 25 coins now. CURSE: drop 1 coin every 5s for 50s.
      const give = 25;
      const cap = this.coinCap();
      this.resources.coin = Math.min(cap, this.resources.coin + give);
      this.stats.coinsCollected += give;
      this.activeKisses.leakyPurse = { timeLeft: 50, nextDropIn: 5 };
    } else if (id === 'singing_well') {
      // KISS: hero heals to full. CURSE: hero max HP -1 permanent.
      this.hero.hp = this.hero.maxHp;
      if (this.hero.maxHp > 1) {
        this.hero.maxHp -= 1;
        this.hero.hp = Math.min(this.hero.hp, this.hero.maxHp);
      }
    } else if (id === 'drill_pit') {
      // KISS: villagers attack 30% faster for 90s. CURSE: campfire
      // takes 15 dmg when the kiss expires.
      this.activeKisses.drillPit = { timeLeft: 90 };
    } else if (id === 'mask_in_grass') {
      // KISS: lantern duration tripled (or set if not lit). CURSE:
      // hero light radius halved for 60s.
      const tripled = LANTERN_DURATION * 3;
      this.lanternTimeLeft = Math.max(this.lanternTimeLeft, tripled);
      this.activeKisses.maskInGrass = { timeLeft: 60 };
    }
  }

  /** Per-frame tick for active kisses/curses. Decrements timers, fires
   *  periodic effects, removes expired entries (and applies their
   *  on-end consequences). Called from `update()` near the other
   *  per-frame ticks. */
  private tickKissCurses(dt: number) {
    const k = this.activeKisses;

    // Restless bowyer: hero damage buff + timed runner spawns.
    if (k.restlessBowyer) {
      k.restlessBowyer.timeLeft -= dt;
      k.restlessBowyer.nextSpawnIn -= dt;
      if (k.restlessBowyer.nextSpawnIn <= 0) {
        k.restlessBowyer.nextSpawnIn = 8;
        // Spawn a runner near the hero — slightly offset so it doesn't
        // clip into the hero on its first frame.
        const angle = Math.random() * Math.PI * 2;
        const r = 36;
        this.enemies.push(
          createEnemy(
            'runner',
            this.hero.x + Math.cos(angle) * r,
            this.hero.y + Math.sin(angle) * r,
            'siege',
          ),
        );
      }
      if (k.restlessBowyer.timeLeft <= 0) k.restlessBowyer = undefined;
    }

    // Leaky purse: drop 1 coin every 5s for as long as the curse holds.
    if (k.leakyPurse) {
      k.leakyPurse.timeLeft -= dt;
      k.leakyPurse.nextDropIn -= dt;
      if (k.leakyPurse.nextDropIn <= 0) {
        k.leakyPurse.nextDropIn = 5;
        if (this.resources.coin > 0) {
          this.resources.coin -= 1;
          // Drop a coin behind the hero with a tiny pop velocity so it
          // visibly leaves them.
          const angle = Math.random() * Math.PI * 2;
          const c = createCoin(this.hero.x, this.hero.y, 1);
          c.vx = Math.cos(angle) * 80;
          c.vy = Math.sin(angle) * 80;
          // Reset age so the coin is pickup-immune for its pop window —
          // otherwise the magnet would yank it back into the purse.
          c.age = 0;
          this.coins.push(c);
        }
      }
      if (k.leakyPurse.timeLeft <= 0) k.leakyPurse = undefined;
    }

    // Drilling pit: villager speed boost; on expiry, 15 dmg to fire.
    if (k.drillPit) {
      k.drillPit.timeLeft -= dt;
      if (k.drillPit.timeLeft <= 0) {
        k.drillPit = undefined;
        this.campfire.hp = Math.max(0, this.campfire.hp - 15);
      }
    }

    // Mask in the grass: vision shrink. Decrement only.
    if (k.maskInGrass) {
      k.maskInGrass.timeLeft -= dt;
      if (k.maskInGrass.timeLeft <= 0) k.maskInGrass = undefined;
    }
  }

  /** Read by hero swing damage to apply the restless bowyer kiss. */
  heroDamageBuffFromKiss(): number {
    return this.activeKisses.restlessBowyer ? 2 : 0;
  }
  /** Read by station work-tick to apply the drilling pit kiss. */
  villagerSpeedMultFromKiss(): number {
    return this.activeKisses.drillPit ? 0.7 : 1.0;
  }
  /** Read by lighting code to apply the mask kiss. */
  visibilityMultFromKiss(): number {
    return this.activeKisses.maskInGrass ? 0.5 : 1.0;
  }

  /** Spawn 1 + ⌊night/3⌋ night POIs (capped at 3) on a ring around
   *  the campfire. Each is a randomly-picked variant from the 'night'
   *  authored pool. They despawn at dawn if unclaimed. */
  private spawnNightPois() {
    const count = Math.min(3, 1 + Math.floor(this.clock.night / 3));
    const nightPool = [...instancesOfCategory('night')];
    if (nightPool.length === 0) return;
    // Shuffle so we don't always pick the same first N variants.
    for (let i = nightPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nightPool[i], nightPool[j]] = [nightPool[j], nightPool[i]];
    }
    const cf = this.campfire;
    const ringMin = 220;
    const ringMax = 480;
    for (let i = 0; i < count; i++) {
      const inst = nightPool[i % nightPool.length];
      // Try to find a non-overlapping spot on the ring.
      for (let attempt = 0; attempt < 24; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = ringMin + Math.random() * (ringMax - ringMin);
        const x = cf.x + Math.cos(angle) * dist;
        const y = cf.y + Math.sin(angle) * dist;
        const tooClose =
          this.pois.some((p) => Math.hypot(p.x - x, p.y - y) < 100) ||
          this.portals.some((p) => Math.hypot(p.x - x, p.y - y) < 100);
        if (!tooClose) {
          // Mark the POI as already discovered so the player can see it
          // at night without walking into discovery range first — these
          // are visual beacons, not exploration finds.
          const poi = createPOI(inst.id, inst.sprite, x, y);
          poi.discovered = true;
          this.pois.push(poi);
          break;
        }
      }
    }
  }

  /** At dawn, remove any night POIs that were never claimed. They were
   *  bargains the player chose to walk past — they aren't preserved. */
  private despawnUnclaimedNightPois() {
    this.pois = this.pois.filter((poi) => {
      const inst = poiInstance(poi.instanceId);
      if (!inst) return true;
      if (inst.category !== 'night') return true;
      return poi.claimed; // keep claimed ones (so they show as ghosts), drop unclaimed
    });
  }

  /** Recruits earned from the pyre night POI carry a `markedForDawn`
   *  flag — they vanish at first light. */
  private despawnDawnMarkedRecruits() {
    type MarkedRecruit = Recruit & { markedForDawn?: boolean };
    this.recruits = this.recruits.filter(
      (r) => !((r as MarkedRecruit).markedForDawn === true),
    );
  }

  private randomEdgePoint(): [number, number] {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: return [Math.random() * this.worldW, -12];
      case 1: return [this.worldW + 12, Math.random() * this.worldH];
      case 2: return [Math.random() * this.worldW, this.worldH + 12];
      default: return [-12, Math.random() * this.worldH];
    }
  }

  /** Pick `count` siege-portal positions on a ring around the campfire.
   *  Ring radius is `SIEGE_PORTAL_RING_MIN..MAX`, and angles are spread by
   *  at least `SIEGE_PORTAL_MIN_SEPARATION` so multiple portals don't
   *  bloom on top of each other on the same flank. Falls back to the best
   *  candidate found if the separation constraint can't be met (rare). */
  private pickSiegeRingPoints(count: number): Array<[number, number]> {
    const cx = this.campfire.x;
    const cy = this.campfire.y;
    const angles: number[] = [];
    const out: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      let bestAngle = 0;
      let bestSep = -Infinity;
      // Try a handful of candidates and keep the one with the largest
      // angular gap from the angles we've already committed to.
      for (let k = 0; k < 32; k++) {
        const a = Math.random() * Math.PI * 2;
        let minGap = Math.PI * 2;
        for (const prior of angles) {
          let d = Math.abs(a - prior);
          if (d > Math.PI) d = Math.PI * 2 - d;
          if (d < minGap) minGap = d;
        }
        if (minGap >= SIEGE_PORTAL_MIN_SEPARATION) {
          bestAngle = a;
          bestSep = minGap;
          break;
        }
        if (minGap > bestSep) {
          bestSep = minGap;
          bestAngle = a;
        }
      }
      angles.push(bestAngle);
      const r =
        SIEGE_PORTAL_RING_MIN +
        Math.random() * (SIEGE_PORTAL_RING_MAX - SIEGE_PORTAL_RING_MIN);
      const x = clamp(cx + Math.cos(bestAngle) * r, 60, this.worldW - 60);
      const y = clamp(cy + Math.sin(bestAngle) * r, 60, this.worldH - 60);
      out.push([x, y]);
    }
    return out;
  }

  private wandererSpawnTick(dt: number) {
    // Auto-wanderers taper sharply after the early game. The long-term
    // villager source is settlement POIs — players have to leave the
    // base to grow their roster from N4 onward.
    //   N1–N2: full rate (1 every ~22s while < 2 wandering on screen)
    //   N3   : half rate (interval doubled)
    //   N4+  : zero
    const night = this.clock.night;
    if (night >= 4) return;
    const rateMult = night >= 3 ? 2 : 1;

    this.wandererTimer -= dt;
    if (this.wandererTimer > 0) return;
    const wandering = this.recruits.filter((r) => r.status === 'wandering').length;
    if (wandering >= 2) {
      this.wandererTimer = 5 * rateMult;
      return;
    }
    const [sx, sy] = this.randomEdgePoint();
    // Rest point sits on the same side as the spawn edge so the villager
    // approaches from outside and stops just past the wall perimeter —
    // otherwise a far-edge spawn can end up walking through the base.
    const spawnAngle = Math.atan2(sy - this.campfire.y, sx - this.campfire.x);
    const angle = spawnAngle + (Math.random() - 0.5) * 0.6;
    const dist = WALL_PERIMETER_RADIUS + 28 + Math.random() * 28;
    const dx = clamp(this.campfire.x + Math.cos(angle) * dist, 30, this.worldW - 30);
    const dy = clamp(this.campfire.y + Math.sin(angle) * dist, 30, this.worldH - 30);
    this.recruits.push(createWanderer(sx, sy, dx, dy));
    this.wandererTimer = 22 * rateMult;
  }

  private updateStationPayment(dt: number) {
    type Mode = 'build' | 'hire' | 'upgrade-station' | 'upgrade-campfire' | 'rescue' | 'lantern' | 'whetstone';
    let target: Station | undefined;
    let wandererTarget: Recruit | undefined;
    let campfireTarget = false;
    let lanternTarget = false;
    let whetstoneTarget: Station | undefined;
    let mode: Mode = 'build';
    let bestD = BUILD_PAY_RANGE;

    const hx = this.hero.x;
    const hy = this.hero.y;

    const isNight = this.clock.phase === 'night';

    // Lantern priority lock. The lantern is conceptually "at the
    // campfire" — when the hero is anywhere within LANTERN_PAY_RANGE
    // of the fire AND the lantern is fully extinguished, lantern wins
    // regardless of any other nearby candidate. Setting bestD to 0
    // ensures none of the subsequent candidate checks can beat it
    // (their `d < bestD` guards naturally skip).
    if (this.lanternTimeLeft <= 0) {
      const dCf = Math.hypot(this.campfire.x - hx, this.campfire.y - hy);
      if (dCf < LANTERN_PAY_RANGE) {
        lanternTarget = true;
        mode = 'lantern';
        bestD = 0;
      }
    }

    for (const s of this.stations) {
      if (!prereqMet(s.kind, this.stations, this.campfire.level, this.relicsFound)) continue;
      if (!s.active) {
        // Construction is a daytime activity — at night the ghost stays a ghost.
        if (isNight) continue;
        // Fresh-respawned ghost: brief grace period before coins drip in, so
        // a player walking past doesn't waste coins on a just-popped ghost.
        if (s.readyTimer > 0) continue;
        const d = Math.hypot(s.x - hx, s.y - hy);
        if (d < bestD) {
          target = s;
          mode = 'build';
          bestD = d;
        }
        continue;
      }

      // Brief grace period after build/level-up before more coins can be added.
      // Stops the Space-hold payment from immediately rolling into a hire or
      // upgrade — player needs to release and re-approach.
      if (s.readyTimer > 0) continue;

      const eff = effectiveStats(s);
      const committed = s.recruitIds.length + s.paidSlots;
      const hasOpenSlot = eff.capacity > 0 && committed < eff.capacity;

      if (hasOpenSlot) {
        const a = hireAnchorOffset(s.kind);
        if (a) {
          const d = Math.hypot(s.x + a.dx - hx, s.y + a.dy - hy);
          if (d < bestD) {
            target = s;
            mode = 'hire';
            bestD = d;
          }
        }
      }
      // Upgrades are daytime work — at night, only new hires or construction.
      const canUpgradeNow = this.clock.phase !== 'night';
      if (canUpgradeNow && nextUpgradeCost(s, this.campfire.level) !== null) {
        const a = upgradeAnchorOffset(s.kind);
        const d = Math.hypot(s.x + a.dx - hx, s.y + a.dy - hy);
        if (d < bestD) {
          target = s;
          mode = 'upgrade-station';
          bestD = d;
        }
      }
    }

    for (const r of this.recruits) {
      if (r.status !== 'wandering') continue;
      const d = Math.hypot(r.x - hx, r.y - hy);
      if (d < bestD) {
        target = undefined;
        campfireTarget = false;
        wandererTarget = r;
        mode = 'rescue';
        bestD = d;
      }
    }

    const dCf = Math.hypot(this.campfire.x - hx, this.campfire.y - hy - 38);
    const cfUpCost = this.campfire.nextUpgradeCost();
    const cfBlocked = this.campfire.upgradeBlockReason(this.stations, this.relicsFound);
    const canUpgradeCfNow =
      this.clock.phase !== 'night' && this.campfire.readyTimer <= 0;
    if (canUpgradeCfNow && dCf < bestD && cfUpCost !== null && cfBlocked === null) {
      target = undefined;
      wandererTarget = undefined;
      campfireTarget = true;
      mode = 'upgrade-campfire';
      bestD = dCf;
    }

    // Blacksmith whetstone — single one-time purchase. Standard
    // BUILD_PAY_RANGE proximity to the blacksmith building.
    if (!this.whetstoneBought) {
      const wa = this.whetstoneAnchor();
      if (wa && wa.station.readyTimer <= 0) {
        const dW = Math.hypot(wa.x - hx, wa.y - hy);
        if (dW < bestD) {
          target = undefined;
          wandererTarget = undefined;
          campfireTarget = false;
          lanternTarget = false;
          whetstoneTarget = wa.station;
          mode = 'whetstone';
          bestD = dW;
        }
      }
    }

    if (!target && !campfireTarget && !wandererTarget && !lanternTarget && !whetstoneTarget) {
      this.payTimer = 0;
      this.payTargetId = null;
      return;
    }

    // `required` is the coins still needed for this payment (remaining, not
    // total). Using remaining lets the drip resume mid-payment — otherwise
    // partial progress would stall as soon as `coin` dips below the total.
    let required = 0;
    let totalCost = 0;
    const applyCostMult = (n: number) =>
      Math.max(1, Math.floor(n * this.modifierEffects.costMult));
    if (mode === 'build') {
      required = target!.buildRemaining;
      // buildRemaining already had costMult baked in at ghost creation, so the
      // displayed "totalCost" must match the inflated figure rather than the
      // raw STATION_STATS value.
      totalCost = applyCostMult(STATION_STATS[target!.kind].cost);
    } else if (mode === 'hire') {
      totalCost = applyCostMult(STATION_STATS[target!.kind].hireCost);
      required = totalCost - target!.hireProgress;
    } else if (mode === 'upgrade-station') {
      totalCost = applyCostMult(nextUpgradeCost(target!, this.campfire.level)!);
      required = totalCost - target!.upgradeProgress;
    } else if (mode === 'rescue') {
      totalCost = RESCUE_COST;
      required = totalCost - wandererTarget!.rescueProgress;
    } else if (mode === 'lantern') {
      totalCost = LANTERN_COST;
      required = totalCost - this.lanternProgress;
    } else if (mode === 'whetstone') {
      totalCost = WHETSTONE_COST;
      required = totalCost - this.whetstoneProgress;
    } else {
      totalCost = applyCostMult(this.campfire.nextUpgradeCost()!);
      required = totalCost - this.campfire.upgradeProgress;
    }

    // Engage as long as the player has at least one coin — partial
    // contributions accumulate on the target and persist between sessions.
    // A player with 3c near an 8c build can drop those 3c now and come back
    // later to finish.
    const engaged = this.input.held('Space') && this.resources.coin > 0 && required > 0;
    if (!engaged) {
      this.payTimer = 0;
      this.payTargetId = null;
      return;
    }
    // Suppress the "full-cost needed" tracking — we pay one coin at a time and
    // the while loop below handles running out naturally.
    void required;

    const targetId = campfireTarget
      ? -1
      : wandererTarget
        ? -2000 - wandererTarget.id
        : lanternTarget
          ? -4000
          : whetstoneTarget
            ? -5000 - whetstoneTarget.id
            : target!.id;
    if (targetId !== this.payTargetId) {
      this.payTimer = 0;
      this.payTargetId = targetId;
    }

    this.payTimer += dt;
    while (this.payTimer >= BUILD_PAY_INTERVAL && this.resources.coin > 0) {
      this.payTimer -= BUILD_PAY_INTERVAL;
      this.resources.coin -= 1;
      this.stats.coinsSpent += 1;
      this.spawnFlyingCoinToSlot(mode, target, campfireTarget, wandererTarget, lanternTarget, whetstoneTarget);
      if (mode === 'build') {
        target!.buildRemaining -= 1;
        if (target!.buildRemaining <= 0) {
          target!.active = true;
          target!.buildRemaining = 0;
          target!.readyTimer = STATION_READY_DELAY;
          this.stats.stationsBuilt += 1;
          this.payTargetId = null;
          this.payTimer = 0;
          break;
        }
      } else if (mode === 'hire') {
        target!.hireProgress += 1;
        if (target!.hireProgress >= totalCost) {
          target!.hireProgress = 0;
          target!.paidSlots += 1;
          this.payTargetId = null;
          this.payTimer = 0;
          break;
        }
      } else if (mode === 'upgrade-station') {
        target!.upgradeProgress += 1;
        if (target!.upgradeProgress >= totalCost) {
          applyStationLevelUp(target!);
          this.payTargetId = null;
          this.payTimer = 0;
          break;
        }
      } else if (mode === 'rescue') {
        wandererTarget!.rescueProgress += 1;
        if (wandererTarget!.rescueProgress >= totalCost) {
          wandererTarget!.status = 'idle';
          wandererTarget!.rescueProgress = 0;
          wandererTarget!.orbitAngle = Math.random() * Math.PI * 2;
          // Reset the wanderer's stale targetX/Y (still pointed at their
          // outside-the-walls rest spot) so the idle wander logic picks a
          // fresh near-campfire loiter point on the next tick.
          wandererTarget!.targetX = wandererTarget!.x;
          wandererTarget!.targetY = wandererTarget!.y;
          wandererTarget!.workTimer = 0;
          this.stats.rescued += 1;
          this.payTargetId = null;
          this.payTimer = 0;
          break;
        }
      } else if (mode === 'lantern') {
        this.lanternProgress += 1;
        if (this.lanternProgress >= totalCost) {
          this.lanternProgress = 0;
          this.lanternTimeLeft = LANTERN_DURATION;
          this.payTargetId = null;
          this.payTimer = 0;
          break;
        }
      } else if (mode === 'whetstone') {
        this.whetstoneProgress += 1;
        if (this.whetstoneProgress >= totalCost) {
          this.whetstoneProgress = 0;
          this.whetstoneBought = true;
          this.upgrades.heroDamage += WHETSTONE_DAMAGE_BONUS;
          this.payTargetId = null;
          this.payTimer = 0;
          this.enqueueNote({
            title: 'Forge · Whetstone',
            body:
              "The blacksmith honed your blade against a fresh stone. The metal hums when you draw it. Every swing bites harder now.",
            accent: 'ember',
            cta: `+${WHETSTONE_DAMAGE_BONUS} hero swing damage · permanent for this run`,
          });
          break;
        }
      } else {
        this.campfire.upgradeProgress += 1;
        if (this.campfire.upgradeProgress >= totalCost) {
          this.campfire.levelUp();
          this.ensureBaseStructuresForLevel();
          this.payTargetId = null;
          this.payTimer = 0;
          break;
        }
      }
    }
  }

  private spawnFlyingCoinToSlot(
    mode: 'build' | 'hire' | 'upgrade-station' | 'upgrade-campfire' | 'rescue' | 'lantern' | 'whetstone',
    target: Station | undefined,
    campfireTarget: boolean,
    wandererTarget?: Recruit,
    lanternTarget?: boolean,
    whetstoneTarget?: Station,
  ) {
    let tx = 0;
    let ty = 0;
    if (campfireTarget) {
      tx = this.campfire.x;
      ty = this.campfire.y - 38;
    } else if (lanternTarget) {
      const a = this.lanternAnchor();
      tx = a.x;
      ty = a.y - 8;
    } else if (whetstoneTarget) {
      tx = whetstoneTarget.x;
      ty = whetstoneTarget.y - 10;
    } else if (wandererTarget) {
      tx = wandererTarget.x;
      ty = wandererTarget.y - 26;
    } else if (target) {
      if (mode === 'build') {
        tx = target.x;
        ty = target.y + (target.kind === 'wall' ? -22 : -40);
      } else if (mode === 'hire') {
        const a = hireAnchorOffset(target.kind);
        if (a) { tx = target.x + a.dx; ty = target.y + a.dy; }
        else { tx = target.x; ty = target.y - 26; }
      } else {
        const a = upgradeAnchorOffset(target.kind);
        tx = target.x + a.dx;
        ty = target.y + a.dy;
      }
    } else return;
    this.flyingCoins.push(createFlyingCoin(this.hero.x, this.hero.y - 6, tx, ty));
  }

  private updateFlyingCoins(dt: number) {
    this.flyingCoins = this.flyingCoins.filter((c) => updateFlyingCoin(c, dt));
  }

  private flushPaidSlots() {
    for (const station of this.stations) {
      if (!station.active) continue;
      if (!takesWorker(station.kind)) continue;
      const cap = effectiveStats(station).capacity;
      while (station.paidSlots > 0 && station.recruitIds.length < cap) {
        if (!this.tryHireVillager(station)) break;
        station.paidSlots -= 1;
      }
    }
  }

  private tryHireVillager(station: Station): boolean {
    let best: Recruit | undefined;
    let bestD = Infinity;
    for (const r of this.recruits) {
      if (r.status !== 'idle') continue;
      const d = Math.hypot(r.x - station.x, r.y - station.y);
      if (d < bestD) {
        best = r;
        bestD = d;
      }
    }
    if (!best) return false;
    best.stationId = station.id;
    best.status = 'moving';
    best.targetX = station.x;
    best.targetY = station.y;
    station.recruitIds.push(best.id);
    return true;
  }

  hasActiveBlacksmith(): boolean {
    return this.stations.some((s) => s.kind === 'blacksmith' && s.active);
  }

  /** Hero's current coin-carry cap, scaling with campfire level.
   *  L1 = 20, L2 = 40, L3 = 60. */
  coinCap(): number {
    return COIN_CAP_BASE + COIN_CAP_PER_CAMPFIRE_LEVEL * (this.campfire.level - 1);
  }

  /** Fires once per run, the first time during day-phase that the hero
   *  steps outside the campfire's effective light radius. The chronicle
   *  told them not to — and the entire economy is built so they have
   *  to. This is the catch-the-player-in-the-act beat. */
  private maybeFireLeftLightCallback() {
    if (this.hasLeftLightCallbackFired) return;
    if (this.clock.phase !== 'day') return;
    // The cold-open card is still up — wait until the player has read
    // and dismissed it before firing the callback, so the two cards
    // don't stack on the same frame.
    if (this.activeNote || this.noteQueue.length > 0) return;
    if (this.showMenu) return;
    if (this.hero.respawnTimer > 0) return;

    const lightR =
      this.campfire.lightRadius *
      this.upgrades.campfireLight *
      this.modifierEffects.lightRadiusMult;
    const d = Math.hypot(
      this.hero.x - this.campfire.x,
      this.hero.y - this.campfire.y,
    );
    if (d <= lightR) return;

    this.hasLeftLightCallbackFired = true;
    this.enqueueNote({
      title: "Margin of the chronicle",
      body: "You did what you had to do. So did I. — E.",
      accent: 'ember',
      // The repeated "did" carries the dramatic echo — the player's
      // small disobedience is being named the same shape as E.'s.
      shake: ['did'],
    });
  }

  /** Each frame, recompute which walls have a knight standing post and
   *  apply the Forge "Wall vigil" Tier II regen on those walls. The set
   *  is then read at enemy-damage time to apply Tier I damage reduction
   *  and Tier III armor. */
  private tickKnightWallSupport(dt: number) {
    this.guardedWallIds.clear();
    const activeWalls = this.stations.filter(
      (s) => s.kind === 'wall' && s.active && s.hp > 0,
    );
    if (activeWalls.length > 0) {
      // Garrison guards: each occupied slot maps to a wall via
      //   slot % activeWalls.length  (matches updateGuard).
      for (const garrison of this.stations) {
        if (garrison.kind !== 'garrison' || !garrison.active) continue;
        for (let i = 0; i < garrison.recruitIds.length; i++) {
          const wall = activeWalls[i % activeWalls.length];
          if (wall) this.guardedWallIds.add(wall.id);
        }
      }
    }
    // Barracks knights post to specific upgraded walls via wallPostId.
    for (const r of this.recruits) {
      if (r.wallPostId !== null) this.guardedWallIds.add(r.wallPostId);
    }
    // Forge Tier II: regen 1 HP/s on guarded walls.
    const regenRate = knightRegenPerSec(this.forge.knightTier);
    if (regenRate > 0) {
      const regen = regenRate * dt;
      for (const s of this.stations) {
        if (s.kind !== 'wall' || !s.active || s.hp <= 0) continue;
        if (!this.guardedWallIds.has(s.id)) continue;
        s.hp = Math.min(s.maxHp, s.hp + regen);
      }
    }
  }

  /** Returns the nearest active blacksmith within BUILD_PAY_RANGE of the
   *  hero, or null. Used to scope forge input + payment. */
  nearbyBlacksmith(): Station | null {
    let best: Station | null = null;
    let bestD = BUILD_PAY_RANGE;
    for (const s of this.stations) {
      if (s.kind !== 'blacksmith' || !s.active) continue;
      const d = Math.hypot(s.x - this.hero.x, s.y - this.hero.y);
      if (d < bestD) {
        best = s;
        bestD = d;
      }
    }
    return best;
  }

  private handleVillagerDrop() {
    // Any villager carrying coins within range of the hero tosses them toward
    // the hero automatically — no button press needed. Bias the toss so the
    // villager doesn't immediately pick the coins back up themselves.
    for (const r of this.recruits) {
      if (r.carriedCoins === 0) continue;
      if (r.status === 'wandering') continue;
      const dx = this.hero.x - r.x;
      const dy = this.hero.y - r.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d >= VILLAGER_DROP_RANGE) continue;

      const baseAngle = Math.atan2(dy, dx);
      const n = r.carriedCoins;
      r.carriedCoins = 0;
      for (let i = 0; i < n; i++) {
        const coin = createCoin(r.x, r.y, 1);
        const spread = (Math.random() - 0.5) * 1.1;
        const speed = 140 + Math.random() * 80;
        coin.vx = Math.cos(baseAngle + spread) * speed;
        coin.vy = Math.sin(baseAngle + spread) * speed;
        this.coins.push(coin);
      }
    }
  }

  private updateEnemies(dt: number) {
    const fx = this.campfire.x;
    const fy = this.campfire.y;
    const WALL_ATTRACT_BONUS = 24; // treat walls as this much closer than they are

    for (const e of this.enemies) {
      if (e.hitFlash > 0) e.hitFlash -= dt;

      const stats = ENEMY_STATS[e.kind];
      const attackRange = 20 + stats.radius;

      // ── Wild-pack AI branch ───────────────────────────────────────
      // Wild-origin enemies orbit their home portal in patrol mode. They
      // switch to aggro when a hero/villager comes inside the aggro
      // radius, chase as long as the target stays within the leash from
      // the home portal, and fall back to patrol otherwise. Siege-origin
      // enemies fall through to the existing seek-and-destroy code below.
      if (e.origin === 'wild') {
        // Patrol anchor priority: a live home-portal wins; otherwise
        // the static `homeX/Y` from a wandering wild pack. Either way
        // we end up with a `home: {x, y}` for the patrol orbit.
        let home: { x: number; y: number } | undefined;
        if (e.homePortalId) {
          const portal = this.portals.find(
            (p) => p.id === e.homePortalId && p.kind === 'wild',
          );
          if (portal) home = { x: portal.x, y: portal.y };
        }
        if (!home && e.homeX !== undefined && e.homeY !== undefined) {
          home = { x: e.homeX, y: e.homeY };
        }

        // Find the nearest aggro candidate (hero or non-wandering recruit).
        let aggroX = e.x;
        let aggroY = e.y;
        let aggroD = Infinity;
        let aggroTarget: 'hero' | 'recruit' | null = null;
        let aggroRecruit: Recruit | null = null;
        if (!this.hero.isDead) {
          const d = Math.hypot(this.hero.x - e.x, this.hero.y - e.y);
          if (d < aggroD) {
            aggroD = d;
            aggroX = this.hero.x;
            aggroY = this.hero.y;
            aggroTarget = 'hero';
          }
        }
        for (const r of this.recruits) {
          if (r.status === 'wandering') continue;
          const d = Math.hypot(r.x - e.x, r.y - e.y);
          if (d < aggroD) {
            aggroD = d;
            aggroX = r.x;
            aggroY = r.y;
            aggroTarget = 'recruit';
            aggroRecruit = r;
          }
        }

        // Decide patrol vs aggro this frame.
        if (e.patrolMode === 'patrol') {
          if (aggroD <= WILD_AGGRO_RADIUS) e.patrolMode = 'aggro';
        } else {
          // In aggro: drop back to patrol if the target is gone, dead, or
          // strayed far from the home portal.
          if (!aggroTarget) {
            e.patrolMode = 'patrol';
          } else if (home) {
            const dHome = Math.hypot(aggroX - home.x, aggroY - home.y);
            if (dHome > WILD_LEASH_RADIUS) e.patrolMode = 'patrol';
          }
        }

        if (e.patrolMode === 'aggro' && aggroTarget) {
          // Seek the target.
          const dx = aggroX - e.x;
          const dy = aggroY - e.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d > attackRange) {
            e.x += (dx / d) * stats.speed * dt;
            e.y += (dy / d) * stats.speed * dt;
            e.attackTimer = 0;
          } else {
            e.attackTimer += dt;
            if (e.attackTimer >= stats.attackInterval) {
              e.attackTimer -= stats.attackInterval;
              if (aggroTarget === 'hero') this.hero.takeDamage(stats.damage);
              else if (aggroRecruit) {
                // Recruits don't have HP yet; for now, scatter them
                // back to wandering as a stand-in for being knocked
                // around. Future: real recruit HP.
                aggroRecruit.status = 'wandering';
              }
            }
          }
        } else if (home) {
          // Patrol orbit — circle the portal at a soft radius.
          e.patrolPhase += dt * 0.4;
          const orbitR = 30 + Math.sin(e.patrolPhase * 0.7) * 8;
          const tx = home.x + Math.cos(e.patrolPhase) * orbitR;
          const ty = home.y + Math.sin(e.patrolPhase) * orbitR;
          const dx = tx - e.x;
          const dy = ty - e.y;
          const d = Math.hypot(dx, dy) || 1;
          // Slow drift in patrol mode — half speed.
          const v = stats.speed * 0.45;
          e.x += (dx / d) * v * dt;
          e.y += (dy / d) * v * dt;
          e.attackTimer = 0;
        } else {
          // Orphaned (home portal destroyed) — do nothing fancy; the
          // earlier orphan handler in updatePortals already flipped them
          // to aggro and unset homePortalId, so this path is rare.
        }
        continue;
      }

      // ── Siege AI branch (rush the campfire / walls / hero) ────────
      // Pick the nearest thing to chase/attack: hero, campfire, or an active
      // wall. Walls get a distance discount — they attract enemies to the
      // perimeter even when the hero or campfire is closer.
      let targetX = fx;
      let targetY = fy;
      let targetType: 'hero' | 'fire' | 'wall' = 'fire';
      let targetWall: Station | null = null;
      let bestD = Math.hypot(fx - e.x, fy - e.y);

      if (!this.hero.isDead) {
        const dHero = Math.hypot(this.hero.x - e.x, this.hero.y - e.y);
        if (dHero < bestD) {
          bestD = dHero;
          targetX = this.hero.x;
          targetY = this.hero.y;
          targetType = 'hero';
        }
      }

      for (const s of this.stations) {
        if (s.kind !== 'wall' || !s.active || s.hp <= 0) continue;
        const d = Math.hypot(s.x - e.x, s.y - e.y) - WALL_ATTRACT_BONUS;
        if (d < bestD) {
          bestD = d;
          targetX = s.x;
          targetY = s.y;
          targetType = 'wall';
          targetWall = s;
        }
      }

      const dx = targetX - e.x;
      const dy = targetY - e.y;
      const d = Math.hypot(dx, dy) || 1;

      if (d > attackRange) {
        e.x += (dx / d) * stats.speed * dt;
        e.y += (dy / d) * stats.speed * dt;
        e.attackTimer = 0;
      } else {
        e.attackTimer += dt;
        if (e.attackTimer >= stats.attackInterval) {
          e.attackTimer -= stats.attackInterval;
          if (targetType === 'fire') {
            this.campfire.hp = Math.max(0, this.campfire.hp - stats.damage);
          } else if (targetType === 'wall' && targetWall) {
            // Forge "Knights" track applies via the wall the knight is
            // guarding. Tier I reduces incoming damage by 33% (so the
            // wall acts as if it had ~50% more HP); Tier III absorbs a
            // flat 1 dmg per hit on top of that.
            let dmg = stats.damage;
            if (this.guardedWallIds.has(targetWall.id)) {
              const kt = this.forge.knightTier;
              if (kt >= 1) dmg = dmg * 0.667;
              const armor = knightArmor(kt);
              if (armor > 0) dmg = Math.max(1, dmg - armor);
            }
            targetWall.hp -= dmg;
          } else if (targetType === 'hero') {
            this.hero.takeDamage(stats.damage);
          }
        }
      }
    }

    // Remove dead walls. Flag the run so "Tidy Camp" can't unlock if any
    // wall ever died, even if it later respawned as a ghost.
    const before = this.stations.length;
    this.stations = this.stations.filter(
      (s) => !(s.kind === 'wall' && s.active && s.hp <= 0),
    );
    if (this.stations.length !== before) this.runCtx.anyWallEverDied = true;

    this.enemies = this.enemies.filter((e) => {
      if (e.hp <= 0) {
        const stats = ENEMY_STATS[e.kind];
        for (let i = 0; i < stats.coinValue; i++) {
          this.coins.push(createCoin(e.x, e.y, 1));
        }
        this.stats.kills += 1;
        this.maybeFireChildReveal();
        return false;
      }
      return true;
    });
  }

  /** Once per run, the first enemy kill after the player has reached
   *  Night 5 AND logged 25 kills surfaces the chronicle's hardest
   *  reveal: the things they've been fighting are the missing children,
   *  running TOWARD the campfire, not at it. The card recontextualises
   *  every prior kill. The player can't stop — the fire dies if they
   *  do — but they know now. */
  private maybeFireChildReveal() {
    if (this.childRevealFired) return;
    if (this.clock.night < 5) return;
    if (this.stats.kills < 25) return;
    this.childRevealFired = true;
    this.enqueueNote({
      title: 'Margin of the chronicle',
      body:
        "You struck one down at the eastern wall tonight. The runner-shape came apart wrong — they are supposed to come apart in pieces, and this one came apart in cloth. Small cloth. I knelt. I checked. I had to know. It was Keno. The lantern-boy. He was nine years old. He was not running at us. He was running toward us. They are coming home. They have been coming home since the first night. — E.",
      accent: 'ember',
      cta: 'You will keep killing them. You have to. You know that now.',
      // The cruellest nouns shake forever after they land — the
      // chronicle is making sure the player can't unread them.
      shake: ['keno', 'home', 'child', 'children', 'small', 'cloth'],
    });
  }

  /** Campfire passive aura. Every `CAMPFIRE_AURA_INTERVAL` seconds, every
   *  enemy within `campfire.auraRadius` takes `campfire.auraDamage`. The
   *  radius and damage both grow with campfire level, giving the player
   *  a tangible combat benefit for upgrading beyond "more HP" and
   *  "more light." Kills are cleaned up by the existing filter in
   *  updateEnemies on the next tick. Firing the aura also starts a
   *  brief pulse animation handled in Render. */
  private applyCampfireAura(): void {
    // The campfire no longer does tick damage. Instead, enemies inside
    // its aura take 1.5x damage from any source — see
    // `enemyVulnerabilityMult`. We still tick the aura timer so the
    // visual pulse stays on the same cadence the player learned, and
    // we keep the hitFlash effect on enemies inside the aura so the
    // kill zone reads visually even when nothing's actively damaging.
    if (!this.campfire.tryFireAura()) return;
    const cx = this.campfire.x;
    const cy = this.campfire.y;
    const r = this.campfire.auraRadius;
    const r2 = r * r;
    for (const e of this.enemies) {
      const dx = e.x - cx;
      const dy = e.y - cy;
      if (dx * dx + dy * dy > r2) continue;
      // Faint shimmer indicating "this enemy is weakened right now."
      // Doesn't compete with real damage flashes — only sets if dimmer.
      if (e.hitFlash < 0.08) e.hitFlash = 0.08;
    }
  }

  /** Returns the damage multiplier applied to the next hit on `e`.
   *  Stacks all "make this enemy more vulnerable" zones — currently
   *  the campfire aura (1.5x) and the lantern aura (1.5x) — so a
   *  player who carries the lantern across the kill zone deals
   *  1.5 * 1.5 = 2.25x damage there. */
  private enemyVulnerabilityMult(e: Enemy): number {
    let mult = 1;
    const cdx = e.x - this.campfire.x;
    const cdy = e.y - this.campfire.y;
    const cR = this.campfire.auraRadius;
    if (cdx * cdx + cdy * cdy <= cR * cR) mult *= 1.5;
    if (this.lanternTimeLeft > 0 && !this.hero.isDead) {
      const ldx = e.x - this.hero.x;
      const ldy = e.y - this.hero.y;
      const lR = LANTERN_RADIUS;
      if (ldx * ldx + ldy * ldy <= lR * lR) mult *= LANTERN_VULN_MULT;
    }
    return mult;
  }

  /** World-space anchor for the lantern hook — a small post just
   *  southeast of the campfire stones. Hero stands here and holds
   *  Space to spend `LANTERN_COST` and refresh the lantern. */
  lanternAnchor(): { x: number; y: number } {
    return { x: this.campfire.x + 28, y: this.campfire.y + 14 };
  }

  /** World-space anchor for the blacksmith whetstone — sits at the
   *  blacksmith's south side. Returns null if no active blacksmith. */
  whetstoneAnchor(): { x: number; y: number; station: Station } | null {
    for (const s of this.stations) {
      if (s.kind !== 'blacksmith' || !s.active) continue;
      return { x: s.x, y: s.y + 14, station: s };
    }
    return null;
  }

  /** Public accessors for the whetstone progress so render code can
   *  show pips. */
  whetstoneProgressValue(): number {
    return this.whetstoneProgress;
  }
  whetstoneCost(): number {
    return WHETSTONE_COST;
  }

  private updateFarms(dt: number) {
    for (const s of this.stations) {
      if (s.kind !== 'farm' || !s.active) continue;
      const eff = effectiveStats(s);
      s.workTimer += dt;
      while (s.workTimer >= eff.workInterval) {
        s.workTimer -= eff.workInterval;
        for (let i = 0; i < eff.power; i++) {
          this.coins.push(createCoin(s.x, s.y, 1));
        }
      }
    }
  }

  /** Scratch map rebuilt at the start of `updateRecruits` so wall-post
   *  counting is O(R) once instead of O(R × W × R) inside each knight. */
  private wallPostCount: Map<number, number> = new Map();
  /** Station-id → Station cache, rebuilt once per frame so the many
   *  `stations.find(s => s.id === …)` calls become O(1) lookups. */
  private stationLookup: Map<number, Station> = new Map();

  private stationById(id: number): Station | undefined {
    return this.stationLookup.get(id);
  }

  private updateRecruits(dt: number) {
    this.pruneDeadStationRefs();
    this.stationLookup.clear();
    for (const s of this.stations) this.stationLookup.set(s.id, s);
    // Rebuild the wall-post counter once, then every knight can read it
    // cheaply during maintainKnightWallPost.
    this.wallPostCount.clear();
    for (const r of this.recruits) {
      if (r.wallPostId === null) continue;
      this.wallPostCount.set(r.wallPostId, (this.wallPostCount.get(r.wallPostId) ?? 0) + 1);
    }
    for (const r of this.recruits) {
      switch (r.status) {
        case 'wandering': {
          // Walk to rest point and stop — player has to come fetch them.
          moveTowards(r, r.targetX, r.targetY, dt);
          break;
        }
        case 'idle': {
          // Wander-and-linger: villagers stroll to a random spot near the
          // fire, then stand still for a few seconds before picking another.
          // Uses `workTimer` as the linger countdown since idle state doesn't
          // otherwise touch it.
          const dToTarget = Math.hypot(r.targetX - r.x, r.targetY - r.y);
          if (dToTarget < 4) {
            if (r.workTimer > 0) {
              r.workTimer = Math.max(0, r.workTimer - dt);
            } else {
              // Pick a new loiter point somewhere in an annulus around the
              // campfire — close enough to feel like camp life, not a parade.
              const angle = Math.random() * Math.PI * 2;
              const dist = 30 + Math.random() * 55;
              r.targetX = this.campfire.x + Math.cos(angle) * dist;
              r.targetY = this.campfire.y + Math.sin(angle) * dist;
              r.workTimer = 2 + Math.random() * 4;
            }
          } else {
            moveTowards(r, r.targetX, r.targetY, dt);
          }
          break;
        }
        case 'moving': {
          const arrived = moveTowards(r, r.targetX, r.targetY, dt);
          if (arrived) {
            r.status = 'working';
            r.workTimer = 0;
          }
          break;
        }
        case 'working': {
          this.updateRecruitWork(r, dt);
          break;
        }
      }
    }
  }

  private updateRecruitWork(r: Recruit, dt: number) {
    const station = r.stationId !== null ? this.stationById(r.stationId) : undefined;
    if (!station) {
      r.status = 'idle';
      r.stationId = null;
      r.chopTargetNodeId = null;
      return;
    }

    switch (station.kind) {
      case 'tower':
        this.updateArcher(r, station, dt);
        return;
      case 'gather':
        this.updateGatherer(r, station, dt);
        return;
      case 'workshop':
        this.updateBuilder(r, station, dt);
        return;
      case 'barracks':
        this.updateKnight(r, station, dt);
        return;
      case 'garrison':
        this.updateGuard(r, station, dt);
        return;
      default:
        return;
    }
  }

  private updateArcher(r: Recruit, station: Station, dt: number) {
    const eff = effectiveStats(station);
    const slot = station.recruitIds.indexOf(r.id);
    const total = station.recruitIds.length;
    const off = (slot - (total - 1) / 2) * 14;
    moveTowards(r, station.x + off, station.y + 6, dt);
    if (this.clock.phase !== 'night') return;
    r.workTimer += dt;
    // Forge "Drilled volleys" Tier II makes towers fire 20% faster.
    const archerTier = this.forge.archerTier;
    const fireRateMult = archerFireRateMult(archerTier);
    const interval = (eff.workInterval / this.upgrades.towerRate) * fireRateMult * this.villagerSpeedMultFromKiss();
    if (r.workTimer < interval) return;
    const enemy = this.nearestEnemyTo(station.x, station.y, eff.workRange);
    if (!enemy) return;
    r.workTimer = 0;
    const angle = Math.atan2(enemy.y - station.y, enemy.x - station.x);
    const arrow = createArrow(station.x + off, station.y - 12, angle);
    // Forge "Hardened arrowheads" / "Drilled volleys" stack +1/+1 damage.
    const baseDmg = eff.power + archerDamageBonus(archerTier);
    arrow.damage = Math.max(0, Math.floor(baseDmg * this.modifierEffects.towerDamageMult));
    // Forge "Pierce-tipped shafts" Tier III: arrows keep flying through
    // the first enemy they hit.
    if (archerArrowsPierce(archerTier)) {
      arrow.piercesRemaining = 1;
      arrow.hitEnemyIds = [];
    }
    this.projectiles.push(arrow);
  }

  private updateGatherer(r: Recruit, station: Station, dt: number) {
    // Gatherer no longer chops. They tend a grove around the post —
    // planting fresh trees and bushes that the PLAYER then chops for
    // coins. The role flips from "passive coin source" to "renewable
    // resource provider"; the player has to actually engage the wilds
    // to get coins, but they never run out near the post.
    const eff = effectiveStats(station);
    const PLANT_RADIUS = 80;
    const PLANT_CAP = 8;

    // Validate / pick a plant spot. We re-pick whenever the current
    // target has drifted out of range or has snapped to the post (our
    // post-plant signal that says "I'm done here, find a new spot").
    const dTargetFromPost = Math.hypot(
      r.targetX - station.x,
      r.targetY - station.y,
    );
    if (dTargetFromPost > PLANT_RADIUS || dTargetFromPost < 14) {
      this.pickGathererPlantSpot(r, station, PLANT_RADIUS);
      r.workTimer = 0;
      return;
    }

    // Walk to the target.
    const dToTarget = Math.hypot(r.targetX - r.x, r.targetY - r.y);
    if (dToTarget > 4) {
      moveTowards(r, r.targetX, r.targetY, dt);
      r.workTimer = 0;
      return;
    }

    // At spot — tick the plant timer.
    r.workTimer += dt;
    if (r.workTimer >= eff.workInterval) {
      r.workTimer = 0;

      // Cap check: don't overrun the area. Scan the global node list
      // — cheap at the scales we care about (~40 trees + ~18 bushes).
      let nearbyCount = 0;
      for (const n of this.map.nodes) {
        const dx = n.x - station.x;
        const dy = n.y - station.y;
        if (dx * dx + dy * dy < PLANT_RADIUS * PLANT_RADIUS) nearbyCount++;
      }
      if (nearbyCount < PLANT_CAP) {
        // 65/35 trees vs bushes — matches the world-gen ratio so the
        // grove feels of a piece with the wilds.
        const isTree = Math.random() < 0.65;
        const hp = isTree ? 3 : 2;
        this.map.nodes.push({
          id: nextResourceNodeId(),
          kind: isTree ? 'tree' : 'bush',
          x: r.x,
          y: r.y,
          hp,
          maxHp: hp,
        });
      }

      // Force a re-pick on the next frame regardless of whether we
      // planted. Setting target = post position trips the
      // `dTargetFromPost < 14` guard above.
      r.targetX = station.x;
      r.targetY = station.y;
    }
  }

  /** Choose a fresh plant spot inside the gatherer's working radius
   *  around the post. Tries up to 12 candidates; picks the first that
   *  doesn't overlap an existing resource node so newly-planted nodes
   *  spread out instead of clumping. */
  private pickGathererPlantSpot(
    r: Recruit,
    station: Station,
    radius: number,
  ) {
    const minDistFromPost = 18;
    const minSpacing = 16;
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = minDistFromPost + Math.random() * (radius - minDistFromPost);
      const x = station.x + Math.cos(angle) * dist;
      const y = station.y + Math.sin(angle) * dist;
      let conflict = false;
      for (const n of this.map.nodes) {
        const dx = n.x - x;
        const dy = n.y - y;
        if (dx * dx + dy * dy < minSpacing * minSpacing) {
          conflict = true;
          break;
        }
      }
      if (!conflict) {
        r.targetX = x;
        r.targetY = y;
        return;
      }
    }
    // Fallback: best-effort even with conflict.
    r.targetX = station.x + (Math.random() - 0.5) * radius;
    r.targetY = station.y + (Math.random() - 0.5) * radius;
  }

  private updateBuilder(r: Recruit, station: Station, dt: number) {
    const eff = effectiveStats(station);
    let damaged: Station | undefined;
    let bestD = eff.workRange;
    for (const s of this.stations) {
      if (s.kind !== 'wall' || !s.active) continue;
      if (s.hp >= s.maxHp) continue;
      const d = Math.hypot(s.x - station.x, s.y - station.y);
      if (d < bestD) {
        damaged = s;
        bestD = d;
      }
    }
    if (!damaged) {
      moveTowards(r, station.x, station.y, dt);
      r.workTimer = 0;
      return;
    }
    const dWall = Math.hypot(damaged.x - r.x, damaged.y - r.y);
    if (dWall > 18) {
      moveTowards(r, damaged.x, damaged.y, dt);
      r.workTimer = 0;
    } else {
      r.workTimer += dt;
      if (r.workTimer >= eff.workInterval) {
        r.workTimer -= eff.workInterval;
        // Each repair tick drains 1 coin from the kingdom's purse. If the
        // player is broke, the builder swings anyway but the wall stays cracked
        // and the workshop briefly flashes red so it's visible.
        if (this.resources.coin > 0) {
          this.resources.coin -= 1;
          this.stats.coinsSpent += 1;
          damaged.hp = Math.min(damaged.maxHp, damaged.hp + eff.power);
          station.repairFx = 0.8;
        } else {
          station.unpaidFx = 0.8;
        }
      }
    }
  }

  private updateGuard(r: Recruit, station: Station, dt: number) {
    const eff = effectiveStats(station);

    const activeWalls = this.stations.filter(
      (s) => s.kind === 'wall' && s.active && s.hp > 0,
    );
    if (activeWalls.length === 0) {
      moveTowards(r, station.x, station.y + 10, dt);
      r.workTimer = 0;
      return;
    }

    const slot = station.recruitIds.indexOf(r.id);
    const wall = activeWalls[slot % activeWalls.length];
    if (!wall) {
      moveTowards(r, station.x, station.y + 10, dt);
      r.workTimer = 0;
      return;
    }

    // Post just OUTSIDE the wall (on the attacker-facing side).
    const wdx = wall.x - this.campfire.x;
    const wdy = wall.y - this.campfire.y;
    const wd = Math.hypot(wdx, wdy) || 1;
    const postX = wall.x + (wdx / wd) * 14;
    const postY = wall.y + (wdy / wd) * 14;

    // Leash: guard will chase enemies within LEASH of the post, and snap back
    // if pushed past it so they don't wander across the map.
    const LEASH = 52;
    const enemy = this.nearestEnemyTo(postX, postY, LEASH);
    if (enemy) {
      const ed = Math.hypot(enemy.x - r.x, enemy.y - r.y);
      if (ed > 14) {
        moveTowards(r, enemy.x, enemy.y, dt);
        const postD = Math.hypot(r.x - postX, r.y - postY);
        if (postD > LEASH) {
          const over = postD - LEASH;
          r.x += ((postX - r.x) / postD) * over;
          r.y += ((postY - r.y) / postD) * over;
        }
        r.workTimer = 0;
      } else {
        r.workTimer += dt;
        if (r.workTimer >= eff.workInterval) {
          r.workTimer -= eff.workInterval;
          enemy.hp -= armoredDamage(enemy, eff.power) * this.enemyVulnerabilityMult(enemy);
          enemy.hitFlash = 0.12;
        }
      }
      return;
    }

    const dToPost = Math.hypot(postX - r.x, postY - r.y);
    if (dToPost > 4) {
      moveTowards(r, postX, postY, dt);
    }
    r.workTimer = 0;
  }

  private updateKnight(r: Recruit, station: Station, dt: number) {
    const eff = effectiveStats(station);

    // Keep the knight's wall posting fresh. Each upgraded wall demands
    // `level - 1` barracks defenders (garrison covers the first slot).
    this.maintainKnightWallPost(r);

    if (r.wallPostId !== null) {
      const wall = this.stationById(r.wallPostId);
      if (wall && wall.kind === 'wall' && wall.active && wall.hp > 0) {
        this.defendFromWall(r, wall, eff, dt);
        return;
      }
      // Wall gone — clear and fall through to normal knight behaviour.
      r.wallPostId = null;
    }

    // At night, prioritise enemies in range.
    if (this.clock.phase === 'night') {
      // Forge "Polearm reach" Tier II extends barracks search range.
      const soldierTier = this.forge.soldierTier;
      const range = eff.workRange * soldierRangeMult(soldierTier);
      const enemy = this.nearestEnemyTo(station.x, station.y, range);
      if (enemy) {
        const d = Math.hypot(enemy.x - r.x, enemy.y - r.y);
        if (d > 16) {
          moveTowards(r, enemy.x, enemy.y, dt);
          r.workTimer = 0;
        } else {
          r.workTimer += dt;
          if (r.workTimer >= eff.workInterval) {
            r.workTimer -= eff.workInterval;
            // Forge "Sharpened swords" / "Polearm reach" stack +1/+1 dmg.
            const dmg = eff.power + soldierDamageBonus(soldierTier);
            enemy.hp -= dmg * this.enemyVulnerabilityMult(enemy);
            enemy.hitFlash = 0.12;
            // Forge "Whirlwind drilling" Tier III: cleave to a second
            // enemy within a small radius of the primary target.
            if (soldierCleaves(soldierTier)) {
              const secondary = this.secondNearestEnemyTo(enemy, 18);
              if (secondary) {
                secondary.hp -= dmg * this.enemyVulnerabilityMult(secondary);
                secondary.hitFlash = 0.12;
              }
            }
          }
        }
        return;
      }
    }

    // Otherwise patrol the camp. Pick a new waypoint once the knight arrives
    // at the current one — meanders loops around the campfire area.
    const dToPatrol = Math.hypot(r.x - r.targetX, r.y - r.targetY);
    if (dToPatrol < 6) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 70 + Math.random() * 150;
      r.targetX = this.campfire.x + Math.cos(angle) * dist;
      r.targetY = this.campfire.y + Math.sin(angle) * dist;
    }
    moveTowards(r, r.targetX, r.targetY, dt);
    r.workTimer = 0;
  }

  /**
   * Ensure this knight is posted at an upgraded wall that still needs a
   * defender. A wall at level L wants L total defenders — one from garrison,
   * L-1 from barracks knights. Release posts that have become obsolete
   * (wall destroyed, downgraded, or already overstaffed).
   */
  private maintainKnightWallPost(r: Recruit) {
    if (r.wallPostId !== null) {
      const wall = this.stationById(r.wallPostId);
      const valid = wall && wall.kind === 'wall' && wall.active && wall.hp > 0;
      if (!valid || !wall || wall.level < 2) {
        if (r.wallPostId !== null) this.decWallPostCount(r.wallPostId);
        r.wallPostId = null;
      } else {
        const posted = this.wallPostCount.get(wall.id) ?? 0;
        if (posted > wall.level - 1) {
          this.decWallPostCount(wall.id);
          r.wallPostId = null;
        }
      }
    }
    if (r.wallPostId !== null) return;
    let best: Station | null = null;
    let bestD = Infinity;
    for (const s of this.stations) {
      if (s.kind !== 'wall' || !s.active || s.hp <= 0) continue;
      if (s.level < 2) continue;
      const posted = this.wallPostCount.get(s.id) ?? 0;
      if (posted >= s.level - 1) continue;
      const d = Math.hypot(s.x - r.x, s.y - r.y);
      if (d < bestD) { bestD = d; best = s; }
    }
    if (best) {
      r.wallPostId = best.id;
      this.wallPostCount.set(best.id, (this.wallPostCount.get(best.id) ?? 0) + 1);
    }
  }

  private decWallPostCount(wallId: number) {
    const n = this.wallPostCount.get(wallId) ?? 0;
    if (n <= 1) this.wallPostCount.delete(wallId);
    else this.wallPostCount.set(wallId, n - 1);
  }

  /** Shared leash-and-swing behaviour for anyone stationed at a wall post. */
  private defendFromWall(
    r: Recruit,
    wall: Station,
    eff: EffectiveStationStats,
    dt: number,
  ) {
    const wdx = wall.x - this.campfire.x;
    const wdy = wall.y - this.campfire.y;
    const wd = Math.hypot(wdx, wdy) || 1;
    const postX = wall.x + (wdx / wd) * 18;
    const postY = wall.y + (wdy / wd) * 18;
    const LEASH = 56;
    const enemy = this.nearestEnemyTo(postX, postY, LEASH);
    if (enemy) {
      const ed = Math.hypot(enemy.x - r.x, enemy.y - r.y);
      if (ed > 14) {
        moveTowards(r, enemy.x, enemy.y, dt);
        const postD = Math.hypot(r.x - postX, r.y - postY);
        if (postD > LEASH) {
          const over = postD - LEASH;
          r.x += ((postX - r.x) / postD) * over;
          r.y += ((postY - r.y) / postD) * over;
        }
        r.workTimer = 0;
      } else {
        r.workTimer += dt;
        if (r.workTimer >= eff.workInterval) {
          r.workTimer -= eff.workInterval;
          enemy.hp -= armoredDamage(enemy, eff.power) * this.enemyVulnerabilityMult(enemy);
          enemy.hitFlash = 0.12;
        }
      }
      return;
    }
    const dToPost = Math.hypot(postX - r.x, postY - r.y);
    if (dToPost > 4) moveTowards(r, postX, postY, dt);
    r.workTimer = 0;
  }

  private pruneDeadStationRefs() {
    // Build a "still alive and still posted here" set per station in one pass
    // so the prune is O(R + S·slots) instead of O(S · slots · R).
    const liveByStation: Map<number, Set<number>> = new Map();
    for (const r of this.recruits) {
      if (r.stationId === null) continue;
      let set = liveByStation.get(r.stationId);
      if (!set) { set = new Set(); liveByStation.set(r.stationId, set); }
      set.add(r.id);
    }
    for (const station of this.stations) {
      if (!takesWorker(station.kind)) continue;
      const live = liveByStation.get(station.id);
      if (!live) {
        if (station.recruitIds.length > 0) station.recruitIds = [];
        continue;
      }
      // Avoid allocating a new array when nothing needs to be pruned.
      let allLive = true;
      for (const id of station.recruitIds) {
        if (!live.has(id)) { allLive = false; break; }
      }
      if (!allLive) {
        station.recruitIds = station.recruitIds.filter((id) => live.has(id));
      }
    }
  }

  private updateProjectiles(dt: number) {
    for (const p of this.projectiles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      for (const e of this.enemies) {
        const r = ENEMY_STATS[e.kind].radius + 3;
        if (Math.hypot(p.x - e.x, p.y - e.y) < r) {
          if (p.hitEnemyIds && p.hitEnemyIds.includes(e.id)) continue;
          e.hp -= armoredDamage(e, p.damage) * this.enemyVulnerabilityMult(e);
          e.hitFlash = 0.12;
          // Forge "Pierce-tipped shafts": instead of dying, decrement the
          // pierce count and keep flying. We also record the id so the
          // arrow doesn't double-hit the same enemy on the next frame
          // before clearing its hitbox.
          if (p.piercesRemaining && p.piercesRemaining > 0) {
            p.piercesRemaining -= 1;
            if (!p.hitEnemyIds) p.hitEnemyIds = [];
            p.hitEnemyIds.push(e.id);
            // Don't break — arrow keeps flying this frame, but the
            // hitEnemyIds guard above prevents re-hitting `e`.
            continue;
          }
          p.life = 0;
          break;
        }
      }
    }
    this.projectiles = this.projectiles.filter(
      (p) =>
        p.life > 0 &&
        p.x > -20 &&
        p.x < this.worldW + 20 &&
        p.y > -20 &&
        p.y < this.worldH + 20,
    );
  }

  private updateCoins(dt: number) {
    const hx = this.hero.x;
    const hy = this.hero.y;
    const kept: Coin[] = [];
    for (const c of this.coins) {
      c.age += dt;

      // Pop-out grace: drift freely with drag, no magnet, no pickup.
      if (c.age < COIN_POP_TIME) {
        c.vx -= c.vx * COIN_DRAG * dt;
        c.vy -= c.vy * COIN_DRAG * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.age < c.lifetime) kept.push(c);
        continue;
      }

      const dx = hx - c.x;
      const dy = hy - c.y;
      const d = Math.hypot(dx, dy) || 1;

      if (d < COIN_PICKUP_RADIUS) {
        const cap = this.coinCap();
        if (this.resources.coin + c.value > cap) {
          // Overflow: hero's purse is full. Scatter the coin back into
          // the world with a fresh pop so it's pickup-immune for the
          // POP window — otherwise it'd snap right back in.
          const ang = Math.random() * Math.PI * 2;
          const spd = 80 + Math.random() * 60;
          c.x = hx + Math.cos(ang) * 6;
          c.y = hy + Math.sin(ang) * 6;
          c.vx = Math.cos(ang) * spd;
          c.vy = Math.sin(ang) * spd;
          c.age = 0;
          c.magnetized = false;
          kept.push(c);
          continue;
        }
        this.resources.coin += c.value;
        this.stats.coinsCollected += c.value;
        continue;
      }

      let grabbedByVillager = false;
      for (const r of this.recruits) {
        if (r.status === 'wandering') continue;
        if (r.carriedCoins >= RECRUIT_CARRY_CAP) continue;
        const dv = Math.hypot(r.x - c.x, r.y - c.y);
        if (dv < RECRUIT_PICKUP_RADIUS) {
          r.carriedCoins += c.value;
          grabbedByVillager = true;
          break;
        }
      }
      if (grabbedByVillager) continue;

      if (d < COIN_MAGNET_RADIUS) c.magnetized = true;

      if (c.magnetized) {
        c.x += (dx / d) * COIN_MAGNET_SPEED * dt;
        c.y += (dy / d) * COIN_MAGNET_SPEED * dt;
      } else {
        c.vx -= c.vx * COIN_DRAG * dt;
        c.vy -= c.vy * COIN_DRAG * dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
      }

      if (c.age < c.lifetime) kept.push(c);
    }
    this.coins = kept;
  }

  private resolveHeroAttack() {
    if (!this.input.attacking() || !this.hero.canSwing()) return;

    const range = this.effectiveSwingRange;
    const autoTargetRange = range + 22;

    // Autotarget: face the nearest enemy (or portal) within a slightly wider
    // radius than the swing itself.
    let targetX = NaN;
    let targetY = NaN;
    let bestD = autoTargetRange;
    for (const e of this.enemies) {
      const stats = ENEMY_STATS[e.kind];
      const d = Math.hypot(e.x - this.hero.x, e.y - this.hero.y) - stats.radius;
      if (d < bestD) {
        targetX = e.x;
        targetY = e.y;
        bestD = d;
      }
    }
    for (const p of this.portals) {
      const d = Math.hypot(p.x - this.hero.x, p.y - this.hero.y) - PORTAL_RADIUS;
      if (d < bestD) {
        targetX = p.x;
        targetY = p.y;
        bestD = d;
      }
    }
    if (!Number.isNaN(targetX)) {
      this.hero.facing = Math.atan2(targetY - this.hero.y, targetX - this.hero.x);
    }

    this.hero.triggerSwing();

    const damage = HERO_SWING_DAMAGE + this.upgrades.heroDamage + this.heroDamageBuffFromKiss();
    const fx = Math.cos(this.hero.facing);
    const fy = Math.sin(this.hero.facing);
    const arcCos = Math.cos(HERO_SWING_ARC / 2);

    for (const e of this.enemies) {
      const stats = ENEMY_STATS[e.kind];
      const dx = e.x - this.hero.x;
      const dy = e.y - this.hero.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > range + stats.radius) continue;
      const dot = (dx * fx + dy * fy) / d;
      if (dot < arcCos) continue;
      e.hp -= armoredDamage(e, damage) * this.enemyVulnerabilityMult(e);
      e.hitFlash = 0.12;
    }

    for (const p of this.portals) {
      const dx = p.x - this.hero.x;
      const dy = p.y - this.hero.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > range + PORTAL_RADIUS) continue;
      const dot = (dx * fx + dy * fy) / d;
      if (dot < arcCos) continue;
      p.hp -= damage;
      p.hitFlash = 0.16;
      // Portals retaliate: if the portal's still alive and off cooldown, it
      // pushes out a knot of defenders that chase the hero.
      if (p.hp > 0 && p.defendCooldown <= 0) {
        this.spawnPortalDefenders(p);
        p.defendCooldown = PORTAL_DEFEND_COOLDOWN * this.modifierEffects.portalDefendCooldownMult;
      }
    }
  }

  private spawnPortalDefenders(portal: Portal) {
    // Scale defender count with the current night — portals get more dangerous
    // as the run progresses.
    const count = 2 + Math.min(3, Math.floor(this.clock.night / 3));
    const baseAngle = Math.atan2(this.hero.y - portal.y, this.hero.x - portal.x);
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * 0.45;
      const angle = baseAngle + spread;
      const spawnR = PORTAL_RADIUS + 8;
      const x = portal.x + Math.cos(angle) * spawnR;
      const y = portal.y + Math.sin(angle) * spawnR;
      // Defenders at higher nights include a brute; flyers come even later.
      let kind: EnemyKind = 'runner';
      if (i === 0 && this.clock.night >= 4) kind = 'brute';
      if (i === count - 1 && this.clock.night >= 6) kind = 'flyer';
      this.enemies.push(createEnemy(kind, x, y));
    }
  }


  private nearestEnemyTo(x: number, y: number, range: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = range;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  /** Find the nearest *other* enemy within `range` of the given primary
   *  enemy. Used by the Forge "Whirlwind drilling" cleave tier so a
   *  soldier's swing carries through to a second target standing next
   *  to the first. */
  private secondNearestEnemyTo(primary: Enemy, range: number): Enemy | undefined {
    let best: Enemy | undefined;
    let bestD = range;
    for (const e of this.enemies) {
      if (e.id === primary.id) continue;
      const d = Math.hypot(e.x - primary.x, e.y - primary.y);
      if (d < bestD) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }
}
