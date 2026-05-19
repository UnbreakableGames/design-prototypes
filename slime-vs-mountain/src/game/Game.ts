import { FoodDrop } from '../entities/FoodDrop';
import { Loot } from '../entities/Loot';
import { FALL_DURATION, Mountain, RISE_DURATION } from '../entities/Mountain';
import { GoonAttack, MountainGoon } from '../entities/MountainGoon';
import { Player } from '../entities/Player';
import { Projectile } from '../entities/Projectile';
import { Slime } from '../entities/Slime';
import { type FtueSnapshot, newFtue } from './ftue';
import {
  autoRollBtnContains,
  collectionCellRect,
  collectionMaxScroll,
  collectionViewportContains,
  drawAutoRollButton,
  drawBossBanner,
  drawHUD,
  drawRebirthButton,
  drawRebirthModal,
  drawResetModal,
  drawSlotGhost,
  drawSpinReelOrDie,
  equipBestBtnContains,
  hitCollectionCell,
  panelContains,
  rebirthBtnContains,
  REBIRTH_BTN,
  rebirthModalCancelContains,
  rebirthModalConfirmContains,
  resetModalCancelContains,
  resetModalConfirmContains,
  spinBtnContains,
  SPIN_BASE_COOLDOWN,
  SPIN_BTN,
} from '../ui/HUD';
import {
  drawSettingsButton,
  drawSettingsOverlay,
  settingsAutoplayHit,
  settingsBtnContains,
  settingsCheatHit,
  settingsCloseBtnContains,
  settingsResetHit,
} from '../ui/SettingsView';
import type { HudState, ReelTile } from '../ui/HUD';
import {
  CENTER_X as TREE_CENTER_X,
  CENTER_Y as TREE_CENTER_Y,
  drawSkillTreeOverlay,
  drawTreeButton,
  TREE_BTN,
  hitVisibleHex,
  treeBtnContains,
  treeCloseBtnContains,
  treeOverlayContains,
} from '../ui/SkillTreeView';
import {
  drawEssenceTreeButton,
  drawEssenceTreeOverlay,
  ESSENCE_TREE_BTN,
  essenceCloseBtnContains,
  essenceTreeBtnContains,
  essenceOverlayContains,
  hitEssenceNode,
} from '../ui/EssenceTreeView';
import type { EssenceNode } from '../skills/essence';
import {
  drawShopButton,
  drawShopOverlay,
  drawShopPurchaseModal,
  hitShopItem,
  shopBtnContains,
  shopCloseBtnContains,
  shopModalBuyContains,
  shopModalCancelContains,
  shopOverlayContains,
} from '../ui/ShopView';
import {
  drawIndexButton,
  drawIndexOverlay,
  indexBtnContains,
  indexCloseBtnContains,
  indexClaimBtnAt,
  indexGridViewportContains,
  indexMaxScroll,
} from '../ui/IndexView';
import {
  drawDiscoveryReveal,
  durationFor as discoveryDurationFor,
  type DiscoveryRevealState,
} from '../ui/DiscoveryReveal';
import {
  craftBtnContains,
  craftCloseBtnContains,
  craftFuseBtnContains,
  craftOverlayContains,
  defaultCraftRarity,
  drawCraftButton,
  drawCraftOverlay,
  hitCraftTier,
  hitCraftVariant,
} from '../ui/CraftView';
import {
  FUSION_INPUT_COUNT,
  canFuse as canFuseVariant,
  nextRarity as nextFusionRarity,
  rollFusionOutput,
} from '../skills/crafting';
import type { Rarity } from './types';
import type { ShopItem, ShopItemId } from '../shop/items';
import { SHOP_ITEMS } from '../shop/items';
import {
  SKILL_TREE,
  isUnlockable,
  payCost,
  neighborsOf,
  type PerkId,
  type SkillNode,
} from '../skills/tree';
import {
  ESSENCE_TREE,
  essencePayout,
  essenceUnlockable,
  type EssenceId,
} from '../skills/essence';
import type { DamageType, FoodKind, Inventory, SlimeVariantId, SlotType, VariantState } from './types';
import {
  ALL_VARIANT_IDS,
  BOSS_BY_THEME,
  BOSS_SPAWN_EVERY,
  BOSS_WEAKNESS_MUL,
  FOOD_SPECS,
  GEM_CURRENCY,
  INDEX_MILESTONES,
  levelMul,
  MAX_FLOOR_LOOT,
  MOUNTAIN_THEMES,
  pickFoodDrop,
  pickGoonDrop,
  pickMineDrop,
  pickMountainDrop,
  SMALL_GOLD,
  RARITIES,
  RARITY_FACE,
  RARITY_LUCK_DIVISOR,
  RARITY_NAMES,
  RECLAIM_INTERVAL,
  SLIME_VARIANTS,
  SLOT_LIMITS,
  WORLD,
  xpForNextLevel,
} from './types';

const PHYSICS_ITERATIONS = 4;
/** How many sub-ticks per frame when autoplay is on (lets a viewer watch the
 *  AI progress through hours of game time in minutes). */
const AUTOPLAY_SPEED = 4;
const PAIR_RESTITUTION = 0.05;
/** Save-schema version. Bump this whenever the on-disk shape changes in a
 *  way that can't be load-time migrated — old saves get wiped instead of
 *  partially-loaded. Bumps so far:
 *    2 — post-stack-refactor
 *    3 — slime/player branch rework, FTUE, runner gating, totalRebirths
 *    4 — bee/tree retheme, bagProgress, endless milestones, honeyDrop,
 *        honeycomb essence-tree layout, AI rebirth gate fix
 *    5 — Next-Tree picker (chosenNextTheme), per-theme tree art, PLAYER
 *        branch expansion (speed/carry/dmg tiers, aura offshoot, elemental
 *        shot cycle), boss weakDamageTypes, late-game cost ramp */
const SAVE_VERSION = 5;
/** Base roll *duration*: how long the slot animation runs from click to result.
 *  This is also the rate-limit between rolls — there's no separate cooldown.
 *  Reduced by ECONOMY-branch perks (Faster Roll). */
const SPIN_BASE_DURATION = SPIN_BASE_COOLDOWN;
/** Duration of the final "settle" phase at the end of every spin. The reel
 *  scrolls at constant velocity until this much time is left, then
 *  decelerates to a stop on the result. A shorter total spin time (from
 *  cheaperSpin perks) shortens the constant-velocity phase first; the
 *  settle stays roughly constant so every roll always reads "spin → land". */
const REEL_SETTLE_DURATION = 2.2;
/** Fraction of the scroll distance covered during the constant-velocity
 *  phase. The remaining (1 - FRACTION) is the deceleration settle. */
const REEL_CONST_FRACTION = 0.85;
// Lots of filler tiles before the result so the constant-velocity phase
// blurs past dozens of slimes — feels like a real slot machine, not a slow
// scroll. The total scroll distance scales with this number; the settle
// always covers the final (1 - REEL_CONST_FRACTION) of it.
const REEL_FILLER_BEFORE = 200;
const REEL_FILLER_AFTER = 4;

interface PendingSpawn {
  /** Variants to acquire when the (final) slot animation finishes. The reel
   *  landed on the rarest of these (the "featured" result); the rest are
   *  added silently. */
  ids: SlimeVariantId[];
  /** Bonus multiplier hit on the main reel (1 = none, otherwise 2/4/8). */
  bonusMul: number;
  /** True while the main reel landed on bonus but the second reel hasn't
   *  been kicked off yet (gap between phase 1 and phase 2). */
  awaitingBonusReel: boolean;
}

interface SlotGeom {
  type: SlotType;
  index: number;
  x: number;
  y: number;
  size: number;
  occupied: boolean;
}

interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}

/** Monotonic counter for active-Slime-entity identity. Replaces the old
 *  per-copy ownedId model — the new collection is a stack-by-variant map,
 *  so this id only identifies in-world Slime instances (for loot
 *  claimedBy/carriedBy references). */
let nextSlimeId = 1;

export class Game {
  private canvas: HTMLCanvasElement;
  private mountain = new Mountain();
  /** Stack-by-variant inventory. One entry per variant the player owns,
   *  carrying count + lifetime rolls + slotted-copies + shared level/XP. */
  private collection: Map<SlimeVariantId, VariantState> = new Map();
  /** Slot order — each entry is the variantId occupying that slot. With
   *  stacks, multiple slots can hold the same variantId (each consuming
   *  one copy from the stack's `slotted` counter). */
  private spitterSlots: SlimeVariantId[] = [];
  private runnerSlots: SlimeVariantId[] = [];
  private slimes: Slime[] = [];
  private projectiles: Projectile[] = [];
  private loot: Loot[] = [];
  private foodDrops: FoodDrop[] = [];
  private goons: MountainGoon[] = [];
  private goonAttacks: GoonAttack[] = [];
  /** Player-controlled avatar. Click anywhere on the play area to set its
   *  walk target; any loot inside its pickup radius is absorbed directly into
   *  the inventory (no carry/deposit round-trip). The starter active mechanic
   *  — runners will come back as an unlockable that automates this. */
  private player = new Player();
  /** First-time-user-experience cursor. Step 1..6 walk the player through the
   *  core loop (assign slime → pickup → deposit → buy slot → roll → assign);
   *  0 means complete, -1 means skipped. See `ftue.ts` for the step table. */
  private ftue: FtueSnapshot = newFtue();
  /** Secondary FTUE that fires once the player can rebirth for the first time.
   *  Steps:
   *    1 — click REBIRTH (rebirthUnlocked is true)
   *    2 — open REBIRTH TREE + buy an essence node
   *    0 — complete (no more arrows). */
  private ftueRebirthStep = 0;
  private goonSpawnT = 0;
  private mineSpawnT = 0;
  private inventory: Inventory = { gold: 0, gems: 0, luck: 5, essence: 0, rolls: 0 };
  /** Lifetime mountains killed — used for the Rebirth payout formula and the
   *  rebirth-button unlock gate. Persists across rebirths once save/load lands. */
  private totalMountainsKilled = 0;
  /** Lifetime rebirths performed. Used to gate the Rebirth Tree button — we
   *  hide it entirely until the player has rebirthed at least once, so the
   *  early-game HUD isn't littered with meta-currency UI they can't use. */
  private totalRebirths = 0;
  /** Number of times the player has clicked ROLL (across all runs). Starter
   *  slime acquires don't count — those are grants, not rolls. Used by the
   *  first-roll new-variant guarantee. */
  private lifetimeSpins = 0;
  /** How many mountain themes are unlocked THIS RUN. Starts at 1 (Verdant
   *  only); resets to 1 on rebirth. The player can spend gold to unlock the
   *  next theme using the button above the mountain. */
  private themesUnlocked = 1;
  /** Theme index the next tree should spawn as (set by the player via the
   *  Next-Tree picker). null = auto-advance to the next theme in order, like
   *  before. Consumed when `tryAdvanceMountain` runs. */
  private chosenNextTheme: number | null = null;
  /** Cursor into `playerDmgTypeOptions()` for the avatar's shot cycle. Q
   *  rotates it; clicking the HUD chip works too. Wraps automatically when
   *  the unlocked option list shrinks (e.g. after rebirth). */
  private playerDmgTypeIdx = 0;
  /** Mountains killed in the current run only. Resets on rebirth. */
  private runMountainsKilled = 0;
  /** Gold earned in the current run only. Drives the Essence payout formula. */
  private runGoldEarned = 0;
  /** Permanent Essence-tree purchases (persists across rebirths). */
  private essenceUnlocked: Set<EssenceId> = new Set();
  private mouseX = 0;
  private mouseY = 0;
  private hoveredSpin = false;
  /** Time remaining in the current roll animation. Doubles as the rate-limit
   *  between rolls — clicking is blocked while > 0. */
  private spinFlash = 0;
  /** Duration applied to the most recent roll (for the HUD progress bar).
   *  The roll's animation IS the rate-limit: the reel spins at constant
   *  velocity for most of this window, then decelerates over the final
   *  `REEL_SETTLE_DURATION` to land on the result. */
  private spinDurationMax = SPIN_BASE_COOLDOWN;
  private spinResult: { id: SlimeVariantId; count: number; bonusMul: number; t: number } | null = null;
  private dieFace = 1;
  private dieAngle = -0.08;
  private slotReel: ReelTile[] = [];
  private slotScrollFloat = 0;
  private slotResultIdx = 0;
  // Second slot machine that pops up when the main reel lands on a bonus tile.
  private bonusReel: ReelTile[] = [];
  private bonusScrollFloat = 0;
  private bonusResultIdx = 0;
  private bonusFlash = 0;
  private bonusDurationMax = 0;
  private pendingSpawn: PendingSpawn | null = null;
  /** Variant the player has selected for slot assignment / detail view.
   *  Replaces the old per-copy ownedId selection — selection is by stack now. */
  private selectedVariantId: SlimeVariantId | null = null;
  private reclaimT = 0;
  private time = 0;
  // Screen-shake intensity (0..1ish). Decays each frame; applied to world render.
  private screenShake = 0;
  // Smoke particles spawned during the mountain death sequence.
  private smoke: SmokeParticle[] = [];
  private showTree = false;
  private hoveredTreeBtn = false;
  private hoveredHex: SkillNode | null = null;
  private unlockedPerks: Set<PerkId> = new Set(['foundation']);
  // Tree pan offset (drag inside overlay to scroll)
  private treePanX = 0;
  private treePanY = 0;
  /** Default zoom: open the tree already magnified so individual hex icons
   *  and labels are readable without scrolling first. */
  private treeZoom = 1.7;
  private treeDragging = false;
  private treeDragStartX = 0;
  private treeDragStartY = 0;
  private treeDragOriginPanX = 0;
  private treeDragOriginPanY = 0;

  // Collection panel horizontal scroll + drag-or-click tracking
  private collectionScroll = 0;
  private panelInteract: {
    startX: number;
    startY: number;
    originScroll: number;
    moved: boolean;
  } | null = null;

  // Visible-in-browser autoplay AI. Toggle with the on-canvas button or the 'A' key.
  private autoplay = false;
  private autoplayTickT = 0;
  private rebirthHovered = false;
  private rebirthModalOpen = false;
  private showEssenceTree = false;
  private essenceTreeBtnHovered = false;
  private themeUnlockBtnHovered = false;
  private hoveredEssenceNode: EssenceNode | null = null;
  /** Hover state for each overlay's close button. */
  private treeCloseHovered = false;
  private essenceCloseHovered = false;
  private shopCloseHovered = false;
  private resetModalOpen = false;
  // Settings overlay state — replaces the top-left AI Autoplay + standalone Reset buttons.
  private showSettings = false;
  private settingsBtnHovered = false;
  private settingsCloseHovered = false;
  private settingsAutoplayHovered = false;
  private settingsCheatHovered = false;
  private settingsResetHovered = false;
  /** Player-controlled toggle: when on AND the autoSpin perk is unlocked, the
   *  dice rolls automatically as soon as the cooldown is ready. */
  private autoRoll = false;
  private autoRollBtnHovered = false;
  // Shop state
  private showShop = false;
  private shopBtnHovered = false;
  private hoveredShopItem: ShopItem | null = null;
  private pendingShopItem: ShopItem | null = null;
  private ownedShopItems: Set<ShopItemId> = new Set();
  // Index state
  private showIndex = false;
  /** Vertical scroll offset (px) of the Index grid viewport. */
  private indexScroll = 0;
  private indexBtnHovered = false;
  private indexCloseHovered = false;
  // Craft state — duplicate-fusion overlay, gated behind the `craft1` essence node.
  private showCraft = false;
  private craftBtnHovered = false;
  private craftCloseHovered = false;
  private craftSelectedRarity: Rarity = 'common';
  private craftSelectedVariantId: SlimeVariantId | null = null;
  private hoveredCraftVariantId: SlimeVariantId | null = null;
  private craftFuseHovered = false;
  /** Bag O Bees progress — drives the endless milestone ladder. Earned per
   *  roll: +10 for a brand-new variant, +1 for a duplicate. Replaces the old
   *  "unique-variants discovered" metric. Persists across rebirths. */
  private bagProgress = 0;
  /** Set of milestone thresholds whose reward has been granted. Persists in save. */
  private claimedMilestones: Set<number> = new Set();
  /** Milestones the player has crossed but not yet claimed. The reward sits in
   *  this set until the player clicks the CLAIM button in the Index overlay. */
  private pendingMilestones: Set<number> = new Set();
  /** Single floating toast — shown after milestone payouts. */
  private toast: { text: string; t: number } | null = null;
  /** Full-screen new-variant reveal animation. Set when acquireSlime sees a
   *  brand-new variantId; the renderer animates it for a few seconds. */
  private discoveryReveal: DiscoveryRevealState | null = null;
  /** Active boost timers — keyed by boost kind, value = seconds remaining. */
  private boosts: { serverLuck: number; serverCoins: number; luckySpinsLeft: number } = {
    serverLuck: 0,
    serverCoins: 0,
    luckySpinsLeft: 0,
  };
  /** Counts how many rebirth-essence-boost charges are queued. */
  private rebirthBoostCharges = 0;
  /** Quick Roll charges (consumable skill-tree node). Each spin while > 0 uses
   *  half the normal cooldown and decrements one. */
  private quickRollChargesLeft = 0;
  /** Essence earned during the current run (mountain kills, milestone claims).
   *  Sits unspendable until `rebirth()` transfers it to `inventory.essence`.
   *  Persists in save so a refresh mid-run doesn't lose progress. */
  private pendingEssence = 0;
  /** Game-time the autoplay has been running. Resets when toggled off. Used to
   *  scale the fusion patience window — late-game perks cost orders of
   *  magnitude more than early ones, so the AI should hold off on fusion longer. */
  private autoplayRunSec = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Try to restore from a previous session; fall back to fresh starters.
    const loaded = this.tryLoad();
    if (!loaded) {
      // FTUE: the player owns ONE starter bee (green) on the bench. Step 1
      // asks them to assign it to the lone spitter slot. Other bees come
      // from rolling later in the FTUE.
      this.acquireSlime('green');
      // Starter shouldn't celebrate itself — clear the discovery reveal that
      // acquireSlime set so the player doesn't see an animation on launch.
      this.discoveryReveal = null;
      // The starter grant counted as a "new variant" via acquireSlime and
      // bumped bagProgress + flagged a milestone. Zero that out so the new
      // player's bag bar starts at empty.
      this.bagProgress = 0;
      this.pendingMilestones.clear();
    }

    // Tutorial-tree treatment: the FIRST mountain of a player's life is a
    // pushover so the rebirth FTUE lands quickly. Once they've killed it,
    // every subsequent tree (including future Verdants on cycle) uses the
    // theme's normal stats.
    if (this.isTutorialTree()) {
      this.mountain.maxHp = 120;
      this.mountain.hp = Math.min(this.mountain.hp, 120);
    }

    // Seed goons for the starting level.
    this.spawnGoons();

    canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    canvas.addEventListener('mousedown', (e) => this.onClick(e));
    canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    canvas.addEventListener('mouseleave', () => this.onMouseUp(null));
    canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    // Touch — translate single touches into the equivalent mouse events so all
    // existing click/drag logic just works on mobile. Two-finger gestures
    // separately handle pinch-zoom for the skill tree.
    canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    canvas.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    canvas.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });
    // Flush the latest state when the tab closes / refreshes / backgrounds.
    window.addEventListener('beforeunload', () => this.save());
    window.addEventListener('pagehide', () => this.save());
  }

  // ---- Touch input -------------------------------------------------------
  // Strategy: single-finger touches fire synthetic mouse events that go through
  // the same down/move/up pipeline as desktop. Two-finger touches drive
  // pinch-zoom on the skill tree (no equivalent on desktop).
  private pinchPrevDist: number | null = null;

  private onTouchStart(e: TouchEvent) {
    if (e.touches.length === 1) {
      const t = e.touches[0]!;
      this.dispatchMouse('mousedown', t.clientX, t.clientY);
      e.preventDefault();
    } else if (e.touches.length === 2) {
      // Cancel any in-progress drag before entering pinch mode.
      this.onMouseUp(null);
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      this.pinchPrevDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      e.preventDefault();
    }
  }

  private onTouchMove(e: TouchEvent) {
    if (e.touches.length === 1 && this.pinchPrevDist === null) {
      const t = e.touches[0]!;
      this.dispatchMouse('mousemove', t.clientX, t.clientY);
      e.preventDefault();
    } else if (e.touches.length === 2 && this.showTree) {
      const t0 = e.touches[0]!;
      const t1 = e.touches[1]!;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (this.pinchPrevDist !== null && this.pinchPrevDist > 0) {
        const factor = dist / this.pinchPrevDist;
        const newZoom = Math.max(0.5, Math.min(3, this.treeZoom * factor));
        if (newZoom !== this.treeZoom) {
          // Anchor zoom to the midpoint between the two fingers.
          const r = this.canvas.getBoundingClientRect();
          const midX = ((t0.clientX + t1.clientX) / 2 - r.left) / r.width * this.canvas.width;
          const midY = ((t0.clientY + t1.clientY) / 2 - r.top) / r.height * this.canvas.height;
          const k = newZoom / this.treeZoom;
          this.treePanX = (midX - TREE_CENTER_X) - k * ((midX - TREE_CENTER_X) - this.treePanX);
          this.treePanY = (midY - TREE_CENTER_Y) - k * ((midY - TREE_CENTER_Y) - this.treePanY);
          this.treeZoom = newZoom;
        }
      }
      this.pinchPrevDist = dist;
      e.preventDefault();
    }
  }

  private onTouchEnd(e: TouchEvent) {
    if (e.touches.length === 0) {
      this.pinchPrevDist = null;
      // Use changedTouches[0] for the final position so mouseup hit-tests work.
      const t = e.changedTouches[0];
      if (t) this.dispatchMouse('mouseup', t.clientX, t.clientY);
      else this.onMouseUp(null);
      e.preventDefault();
    } else if (e.touches.length === 1) {
      // Coming out of pinch — clear pinch state but DON'T reopen a drag.
      this.pinchPrevDist = null;
      e.preventDefault();
    }
  }

  /** Convert raw clientX/clientY to a fake MouseEvent and route through the
   *  existing handlers. Keeps the desktop click pipeline as the single source
   *  of truth for hit-testing. */
  private dispatchMouse(kind: 'mousedown' | 'mousemove' | 'mouseup', clientX: number, clientY: number) {
    const fake = { clientX, clientY } as MouseEvent;
    if (kind === 'mousedown') this.onClick(fake);
    else if (kind === 'mousemove') this.onMouseMove(fake);
    else this.onMouseUp(fake);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'a' || e.key === 'A') {
      this.autoplay = !this.autoplay;
    }
    if (e.key === 'q' || e.key === 'Q') {
      this.cyclePlayerDmgType();
    }
  }

  /** Advance the player-shot damage-type cursor. No-op when only the default
   *  physical option is available (no elemental shots unlocked). */
  private cyclePlayerDmgType() {
    const opts = this.playerDmgTypeOptions();
    if (opts.length <= 1) return;
    this.playerDmgTypeIdx = (this.playerDmgTypeIdx + 1) % opts.length;
    this.toast = { text: `Shot: ${opts[this.playerDmgTypeIdx]!}`, t: 1.0 };
  }

  private onWheel(e: WheelEvent) {
    const r = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const py = ((e.clientY - r.top) / r.height) * this.canvas.height;
    // Tree overlay: scroll zooms, anchored so the point under the cursor stays put.
    if (this.showTree && treeOverlayContains(px, py)) {
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.max(0.5, Math.min(3, this.treeZoom * factor));
      const k = newZoom / this.treeZoom;
      // World formula in hexToPixel is `CENTER + pan + local * zoom`, so the
      // pivot is `(cursor - CENTER)`, not just cursor. Without this the zoom
      // appeared to drift toward the right/bottom of the canvas.
      this.treePanX = (px - TREE_CENTER_X) - k * ((px - TREE_CENTER_X) - this.treePanX);
      this.treePanY = (py - TREE_CENTER_Y) - k * ((py - TREE_CENTER_Y) - this.treePanY);
      this.treeZoom = newZoom;
      e.preventDefault();
      return;
    }
    if (this.showTree) return;
    // Index overlay: vertical scroll inside the grid viewport.
    if (this.showIndex && indexGridViewportContains(px, py)) {
      this.indexScroll = Math.max(0, Math.min(indexMaxScroll(), this.indexScroll + e.deltaY));
      e.preventDefault();
      return;
    }
    if (this.showIndex) return;
    if (!collectionViewportContains(px, py)) return;
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    this.collectionScroll = this.clampScroll(this.collectionScroll + dx);
    e.preventDefault();
  }

  private clampScroll(s: number): number {
    return Math.max(0, Math.min(s, collectionMaxScroll(this.hudState())));
  }

  private onMouseUp(e: MouseEvent | null) {
    this.treeDragging = false;
    if (this.panelInteract && !this.panelInteract.moved && e) {
      // Treat as a click — dispatch the panel hit logic that we deferred on mousedown.
      const r = this.canvas.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * this.canvas.width;
      const py = ((e.clientY - r.top) / r.height) * this.canvas.height;
      this.handlePanelClick(px, py);
    }
    this.panelInteract = null;
  }

  /** Reset goon state at the start of a mountain level. Seeds one goon
   *  immediately and arms the periodic spawn timers (goons + mines). */
  /** True for the player's very first tree of their very first run — used to
   *  apply a one-time HP cut + zero-goons override so the tutorial mountain
   *  goes down fast and the rebirth FTUE lands quickly. Once they've killed
   *  it (totalMountainsKilled becomes 1) every subsequent tree, INCLUDING
   *  future Verdant respawns on cycle, uses the full theme values. */
  private isTutorialTree(): boolean {
    return this.totalMountainsKilled === 0 && this.mountain.level === 0;
  }

  private spawnGoons() {
    this.goons = [];
    this.goonAttacks = [];
    if (this.isTutorialTree()) {
      // Peaceful tutorial: no attacking bees, no mines either, so the player
      // gets a clean, calm intro to the loot/dropoff loop.
      const th = this.mountain.theme();
      this.goonSpawnT = th.goonSpawnInterval;
      this.mineSpawnT = th.mineSpawnInterval * 0.5;
      return;
    }
    this.spawnGoon();
    const th = this.mountain.theme();
    this.goonSpawnT = th.goonSpawnInterval;
    // Stagger the first mine — gives the player a chance to engage goons first.
    this.mineSpawnT = th.mineSpawnInterval * 0.5;
    // Boss check — cadence is based on lifetime mountains killed so the player
    // gets their first boss on the Nth tree of their first run regardless of
    // which theme the rotation lands on.
    this.maybeSpawnBoss();
  }

  /** Spawn a boss bee if this tree is a boss tree. Bosses appear once every
   *  `BOSS_SPAWN_EVERY` mountains killed (skipping the tutorial). HP scales
   *  with mountain level so later bosses stay threatening. */
  private maybeSpawnBoss() {
    // Boss spawns on the player's Nth, 2Nth, … mountain. `totalMountainsKilled`
    // is incremented when a mountain dies, BEFORE spawnGoons is called for the
    // next one — so to land the boss on the 5th tree we check (kills + 1) % N.
    if ((this.totalMountainsKilled + 1) % BOSS_SPAWN_EVERY !== 0) return;
    const themeName = this.mountain.theme().name;
    const boss = BOSS_BY_THEME[themeName];
    if (!boss) return;
    // Bosses already alive shouldn't double-spawn (e.g. load mid-fight).
    if (this.goons.some((g) => g.kind === 'boss')) return;
    const cfg = this.mountain.theme().goon;
    // Place near the middle of the cliff face so the banner-aligned silhouette
    // reads cleanly.
    const x = this.mountain.x + 14 + Math.random() * 10;
    const y = this.mountain.topY + 60 + Math.random() * Math.max(20, this.mountain.bottomY - this.mountain.topY - 120);
    const baseHp = 100 + this.mountain.level * 25;
    const hp = Math.floor(baseHp * boss.hpMul);
    this.goons.push(new MountainGoon(x, y, cfg, hp, 'boss', boss));
    this.toast = { text: `⚠ Boss bee: ${boss.name} — weak to ${boss.weaknessLabel}`, t: 4 };
  }

  /** Pay out the gem burst + free roll for killing a boss in time. Gem count
   *  scales with mountain level so late-game bosses are still worth the swap;
   *  the +1 roll is a flat, always-good reward (the player can spend it
   *  immediately on a bee that helps the rest of the run). */
  private awardBossReward(g: MountainGoon) {
    const boss = g.boss!;
    const gemCount = 8 + Math.floor(this.mountain.level * 1.5);
    for (let i = 0; i < gemCount; i++) {
      const sx = g.x + (Math.random() - 0.5) * 28;
      const sy = g.y - 4 - Math.random() * 12;
      this.loot.push(new Loot(sx, sy, GEM_CURRENCY));
    }
    // Big celebratory gold burst too — bosses should feel chunky.
    const goldCount = 6 + Math.floor(Math.random() * 4);
    const gemChance = this.mountain.theme().gemChance;
    for (let i = 0; i < goldCount; i++) {
      const spec = pickGoonDrop(gemChance);
      const sx = g.x + (Math.random() - 0.5) * 28;
      const sy = g.y - Math.random() * 10;
      this.loot.push(new Loot(sx, sy, spec));
    }
    this.spawnSmokePuff(g.x, g.y, 18, 12);
    this.screenShake = Math.max(this.screenShake, 0.6);
    this.inventory.rolls += 1;
    this.toast = { text: `★ ${boss.name} defeated! +${gemCount} gems  +1 roll`, t: 3.5 };
  }

  /** Spawn a burst of smoke particles at (x, y). Used during the mountain
   *  death sequence (initial burst, continuous billowing during fall, etc.). */
  private spawnSmokePuff(x: number, y: number, count: number, baseSize: number) {
    for (let i = 0; i < count; i++) {
      this.smoke.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 80,
        vy: -40 - Math.random() * 60,
        age: 0,
        life: 1.6 + Math.random() * 0.8,
        size: baseSize + Math.random() * 6,
      });
    }
  }

  /** Spawn a single goon at a fresh random spot on the cliff face. Goon HP
   *  scales with mountain level so later mountains have meaningfully tougher
   *  dens. */
  private spawnGoon() {
    const cfg = this.mountain.theme().goon;
    const x = this.mountain.x + 8 + Math.random() * 16;
    const y = this.mountain.topY + 30 + Math.random() * (this.mountain.bottomY - this.mountain.topY - 60);
    const hp = 100 + this.mountain.level * 25;
    this.goons.push(new MountainGoon(x, y, cfg, hp));
  }

  /** Spawn a mine: passive crystal cluster, no attack. Slightly more HP than
   *  a goon (it's a real target the player has to commit damage into). */
  private spawnMine() {
    const cfg = this.mountain.theme().goon;
    const x = this.mountain.x + 8 + Math.random() * 16;
    const y = this.mountain.topY + 30 + Math.random() * (this.mountain.bottomY - this.mountain.topY - 60);
    const hp = 150 + this.mountain.level * 30;
    this.goons.push(new MountainGoon(x, y, cfg, hp, 'mine'));
  }

  /** Get-or-create the variant state row for the given variantId. */
  private variantState(variantId: SlimeVariantId): VariantState {
    let v = this.collection.get(variantId);
    if (!v) {
      v = { variantId, count: 0, timesRolled: 0, slotted: 0, level: 1, xp: 0 };
      this.collection.set(variantId, v);
    }
    return v;
  }

  /** Bench-available copies of a variant (i.e. not currently slotted). */
  private availableCount(variantId: SlimeVariantId): number {
    const v = this.collection.get(variantId);
    return v ? v.count - v.slotted : 0;
  }

  /** Add a new slime to the collection. Increments count + lifetime
   *  timesRolled (used by the Index milestone system in Phase 3). */
  private acquireSlime(variantId: SlimeVariantId) {
    const wasNew = !this.collection.has(variantId);
    const v = this.variantState(variantId);
    v.count++;
    v.timesRolled++;
    // Bag progress: a fresh variant counts for much more than a duplicate.
    // Both contribute so an unlucky streak still inches the bar forward.
    this.bagProgress += wasNew ? 10 : 1;
    this.checkMilestones();
    if (wasNew) {
      // First-time discovery — kick off the celebration reveal.
      this.discoveryReveal = { variantId, t: 0, duration: discoveryDurationFor(variantId) };
    }
  }

  /** Dev cheat — grants enough of every currency to walk the skill tree. Fires
   *  from the Settings overlay "GIVE ME LOOT" row. Also unlocks the autoSpin
   *  perk so Quick Roll / mutation dice are reachable without grinding. */
  private grantCheatResources() {
    this.inventory.gold += 100_000;
    this.inventory.gems += 10_000;
    // Cheat fills BOTH essence pools — the spendable balance (so the rebirth
    // tree is immediately usable) AND the pending pool (so the HUD shows the
    // grant landed, since the HUD only displays pending).
    this.inventory.essence += 50;
    this.pendingEssence += 50;
    this.inventory.rolls += 1_000;
    this.toast = { text: 'Cheat: +100k pollen +10k gems +50 essence +1k rolls', t: 3 };
  }

  /** Total flat luck granted by claimed Index milestones. Persists across
   *  rebirths so the milestone reward isn't wiped by `inventory.luck = 2`. */
  private milestoneLuckBonus(): number {
    let n = 0;
    for (const m of INDEX_MILESTONES) {
      if (m.reward.kind === 'luck' && this.claimedMilestones.has(m.threshold)) {
        n += m.reward.amount;
      }
    }
    return n;
  }

  /** Mark any newly-crossed Index milestone as pending. The reward sits in
   *  pendingMilestones until the player explicitly clicks CLAIM in the Index. */
  private checkMilestones() {
    const progress = this.bagProgress;
    for (const m of INDEX_MILESTONES) {
      if (progress < m.threshold) break;
      if (this.claimedMilestones.has(m.threshold)) continue;
      if (this.pendingMilestones.has(m.threshold)) continue;
      this.pendingMilestones.add(m.threshold);
      this.toast = { text: `Bag milestone — reward ready to claim!`, t: 3.5 };
    }
  }

  /** Apply the reward for a pending milestone and mark it claimed. Returns
   *  true on success, false if the threshold isn't currently pending. */
  private claimMilestone(threshold: number): boolean {
    if (!this.pendingMilestones.has(threshold)) return false;
    const m = INDEX_MILESTONES.find((x) => x.threshold === threshold);
    if (!m) return false;
    switch (m.reward.kind) {
      case 'gold':    this.inventory.gold    += m.reward.amount; break;
      case 'gems':    this.inventory.gems    += m.reward.amount; break;
      // Index essence rewards are deferred too — they're "during a run" income.
      case 'essence': this.pendingEssence       += m.reward.amount; break;
      case 'luck':    this.inventory.luck    += m.reward.amount; break;
    }
    this.pendingMilestones.delete(threshold);
    this.claimedMilestones.add(threshold);
    const rewardText =
      m.reward.kind === 'gold'    ? `+${m.reward.amount} Gold` :
      m.reward.kind === 'gems'    ? `+${m.reward.amount} Gems` :
      m.reward.kind === 'essence' ? `+${m.reward.amount} Essence` :
                                     `+${m.reward.amount} Luck`;
    this.toast = { text: `Claimed: ${rewardText}`, t: 2.5 };
    return true;
  }

  // === Perk effects ===
  private has(id: PerkId): boolean {
    return this.unlockedPerks.has(id);
  }
  private hasE(id: EssenceId): boolean {
    return this.essenceUnlocked.has(id);
  }
  /** Permanent global gold multiplier from the Essence "Wealth" branch. */
  private essenceGoldMul(): number {
    let bonus = 0;
    if (this.hasE('wealth1')) bonus += 0.25;
    if (this.hasE('wealth2')) bonus += 0.50;
    if (this.hasE('wealth3')) bonus += 1.00;
    return 1 + bonus;
  }
  /** Permanent global spitter damage multiplier from the Essence "Power" branch. */
  private essenceDmgMul(): number {
    let bonus = 0;
    if (this.hasE('power1')) bonus += 0.25;
    if (this.hasE('power2')) bonus += 0.50;
    if (this.hasE('power3')) bonus += 1.00;
    return 1 + bonus;
  }
  /** Permanent global loot-value multiplier (stacks on top of gold/gem mul). */
  private essenceHaulMul(): number {
    let bonus = 0;
    if (this.hasE('haul1')) bonus += 0.25;
    if (this.hasE('haul2')) bonus += 0.50;
    if (this.hasE('haul3')) bonus += 1.00;
    return 1 + bonus;
  }
  /** Permanent starting luck from the Essence "Fortune" branch. */
  private essenceStartingLuck(): number {
    let n = 0;
    if (this.hasE('fortune1')) n += 50;
    if (this.hasE('fortune2')) n += 150;
    if (this.hasE('fortune3')) n += 400;
    return n;
  }
  /** Permanent starting-slot bonus (applies to both spitter + runner). */
  private essenceQuickStartBonus(): number {
    return this.hasE('quickstart') ? 1 : 0;
  }
  /** Permanent starting pollen each run (Essence "Honey Drop"). */
  private essenceStartingPollen(): number {
    return this.hasE('honeyDrop') ? 25 : 0;
  }
  /** Multiplier on the Essence payout when the player rebirths. */
  private essenceEchoBonus(): number {
    return this.hasE('echo') ? 0.25 : 0;
  }

  /** Essence the player would gain if they rebirthed RIGHT NOW. Used by both
   *  the HUD button label and the rebirth confirmation modal. */
  rebirthPreview(): number {
    const base = essencePayout(this.runGoldEarned, this.runMountainsKilled, this.essenceEchoBonus());
    return this.rebirthBoostCharges > 0 ? base * 3 : base;
  }

  /** True once the player has killed at least one mountain (so rebirth has a
   *  reason to exist). Gates the on-screen Rebirth button. */
  rebirthUnlocked(): boolean {
    return this.totalMountainsKilled >= 1;
  }

  /** Auto-save accumulator — flushed every 10s of real game time. */
  private saveT = 0;

  /** Reset the run, keeping slimes + Essence + Essence-tree unlocks. */
  rebirth() {
    if (!this.rebirthUnlocked()) return;
    const payout = this.rebirthPreview();
    // Rebirth transfers everything earned this run (mountain drops, milestone
    // claims) into spendable essence, plus the prestige payout from the run
    // formula. After this, pendingEssence resets to zero for the new run.
    this.inventory.essence += payout + this.pendingEssence;
    this.pendingEssence = 0;
    // Track lifetime rebirths — first one is the signal to reveal the
    // Rebirth Tree button on the HUD.
    this.totalRebirths++;
    // Mountain theme unlocks are per-run; rebirth wipes them so the player
    // re-commits gold to re-unlock the harder mountains each cycle.
    this.themesUnlocked = 1;
    this.chosenNextTheme = null;
    // Consume one Rebirth Boost charge if any were stockpiled.
    if (this.rebirthBoostCharges > 0) this.rebirthBoostCharges--;
    // Reset run-scoped state.
    this.inventory.gold = this.essenceStartingPollen();
    this.inventory.gems = 0;
    // Base luck + any flat luck granted by claimed Index milestones (meta).
    this.inventory.luck = 5 + this.milestoneLuckBonus();
    this.inventory.rolls = 0;
    this.quickRollChargesLeft = 0;
    this.unlockedPerks = new Set(['foundation']);
    this.runGoldEarned = 0;
    this.runMountainsKilled = 0;
    this.mountain.level = 0;
    this.mountain.cycle = 0;
    this.mountain.maxHp = Math.floor(2400 * this.mountain.theme().hpMul);
    this.mountain.hp = this.mountain.maxHp;
    this.mountain.phase = 'alive';
    this.mountain.phaseT = 0;
    this.mountain.effects = [];
    this.goons = [];
    this.goonAttacks = [];
    this.projectiles = [];
    this.loot = [];
    this.foodDrops = [];
    this.spawnGoons();
    // Slimes + slot assignments PERSIST. Just re-equip-best so the slot caps
    // shrinking back to 2sp/2rn (+ Essence quickstart) gets handled cleanly.
    this.equipBest();
    this.rebuildActiveSlimes();
    // Auto-open the Rebirth Tree right after the rebirth confirms — the player
    // just earned essence and the next decision is "what to spend it on?".
    // Skipping the click on the Rebirth Tree button keeps momentum.
    this.showEssenceTree = true;
    this.save();
  }

  /** Apply a confirmed shop purchase. Marks one-time items as owned, hands
   *  out currencies, and starts any boost timers. No actual money changes
   *  hands — this is the simulated Robux flow. */
  private applyShopPurchase(item: ShopItem) {
    switch (item.id) {
      case 'starterPack':
        this.inventory.gold += 1000;
        this.inventory.gems += 50;
        this.inventory.essence += 5;
        break;
      case 'serverLuck':
        // Stacks additively in time (re-buying adds another 10 min).
        this.boosts.serverLuck += 10 * 60;
        break;
      case 'serverCoins':
        this.boosts.serverCoins += 10 * 60;
        break;
      case 'megaCoins':
        // Permanent gold mul handled in effectiveGoldMul via ownedShopItems.
        break;
      case 'gemPackSmall':
        this.inventory.gems += 500;
        break;
      case 'gemPackLarge':
        this.inventory.gems += 2500;
        break;
      case 'slotExpansion':
        // Permanent slot bonus handled in effective*Limit via ownedShopItems.
        break;
      case 'autoRollGamepass':
        // Permanently unlock the autoSpin perk (skip the tree).
        this.unlockedPerks.add('autoSpin');
        this.rebuildActiveSlimes();
        break;
      case 'luckySpins':
        this.boosts.luckySpinsLeft += 5;
        break;
      case 'rebirthBoost':
        this.rebirthBoostCharges += 1;
        break;
    }
    if (item.oneTime) this.ownedShopItems.add(item.id);
    this.save();
  }

  /** Try to unlock an Essence-tree node. Returns true on success.
   *  Most node effects (wealth/power/haul/echo) are read via `hasE()` every
   *  time they're computed, so they apply mid-run automatically. The
   *  "starting <X>" nodes (honeyDrop pollen, fortune luck) only seed values
   *  at run-start, so we ALSO pump their value into the current inventory
   *  right away — purchases mid-run feel responsive instead of waiting for
   *  the next rebirth. */
  tryUnlockEssence(id: EssenceId): boolean {
    const node = ESSENCE_TREE.find((n) => n.id === id);
    if (!node) return false;
    if (!essenceUnlockable(node, this.essenceUnlocked, this.inventory)) return false;
    this.inventory.essence -= node.cost;
    this.essenceUnlocked.add(node.id);
    // Apply "starting X" effects immediately so the buyer sees the boost.
    switch (id) {
      case 'honeyDrop': this.inventory.gold += 25; break;
      case 'fortune1':  this.inventory.luck += 50; break;
      case 'fortune2':  this.inventory.luck += 150; break;
      case 'fortune3':  this.inventory.luck += 400; break;
    }
    // Re-derive any caps that changed (e.g. quickstart).
    this.rebuildActiveSlimes();
    return true;
  }

  /** Consume N bench dupes of the currently-selected craft variant, roll a
   *  random variant in the next-rarity tier, and add it to the collection.
   *  No-op if the selection isn't fusable (silent — the FUSE button is also
   *  visually disabled in that state). */
  private tryFuseSelected(): boolean {
    const id = this.craftSelectedVariantId;
    if (!id) return false;
    const state = this.collection.get(id);
    if (!canFuseVariant(state, id)) return false;
    const rarity = SLIME_VARIANTS[id].rarity;
    const target = nextFusionRarity(rarity);
    if (!target) return false;
    const need = FUSION_INPUT_COUNT[rarity];
    const output = rollFusionOutput(target);
    if (!output) return false;

    // Consume the inputs. `state` is non-null because canFuseVariant passed.
    state!.count -= need;

    // Add the output to the collection (lifetime roll counter + bag progress
    // both bump exactly like a regular roll — fused bees aren't second-class).
    this.acquireSlime(output);

    // Drop the selection if the player burned through their last fusable copy.
    if (!canFuseVariant(state, id)) {
      this.craftSelectedVariantId = null;
    }

    const outVariant = SLIME_VARIANTS[output];
    this.toast = { text: `Fused → ${outVariant.name} (${RARITY_NAMES[target]})`, t: 2.5 };
    this.save();
    return true;
  }

  private effectiveSpitterLimit(): number {
    let n = SLOT_LIMITS.spitter + this.essenceQuickStartBonus();
    if (this.ownedShopItems.has('slotExpansion')) n++;
    if (this.has('spitterSlot1'))  n++;
    if (this.has('spitterSlot2'))  n++;
    if (this.has('spitterSlot3'))  n++;
    if (this.has('spitterSlot4'))  n++;
    if (this.has('spitterSlot5'))  n++;
    if (this.has('spitterSlot6'))  n++;
    if (this.has('spitterSlot7'))  n++;
    if (this.has('spitterSlot8'))  n++;
    if (this.has('spitterSlot9'))  n++;
    if (this.has('spitterSlot10')) n++;
    if (this.has('spitterSlot11')) n++;
    if (this.has('spitterSlot12')) n++;
    if (this.has('spitterSlot13')) n++;
    if (this.has('spitterSlot14')) n++;
    if (this.has('spitterSlot15')) n++;
    return n;
  }
  /** Extra carry slots the player avatar gets from PLAYER-branch perks. */
  private effectivePlayerCarryBonus(): number {
    let n = 0;
    if (this.has('playerCarry1')) n += 2;
    if (this.has('playerCarry2')) n += 3;
    if (this.has('playerCarry3')) n += 5;
    if (this.has('playerCarry4')) n += 8;
    return n;
  }
  /** Walk-speed multiplier on top of the avatar's base 220 px/s. */
  private effectivePlayerSpeedMul(): number {
    let m = 1;
    if (this.has('playerSpeed1')) m += 0.25;
    if (this.has('playerSpeed2')) m += 0.4;
    if (this.has('playerSpeed3')) m += 0.6;
    return m;
  }
  /** Damage of one player shot. Base is in the "small chip" range so it feels
   *  noticeable in the early game but doesn't outclass slime damage. */
  private effectivePlayerShotDmg(): number {
    let dmg = 6;
    if (this.has('shootDmg1')) dmg *= 1.5;
    if (this.has('shootDmg2')) dmg *= 1.75;
    if (this.has('shootDmg3')) dmg *= 2.5;
    return dmg * this.effectiveSpitterDmgMul();
  }
  /** Damage types currently available in the player's shot cycle. Physical
   *  is always present; the elemental unlocks add to the rotation. Order
   *  determines cycle direction. */
  private playerDmgTypeOptions(): DamageType[] {
    const opts: DamageType[] = ['physical'];
    if (this.has('shootBurn'))      opts.push('burn');
    if (this.has('shootFrost'))     opts.push('frost');
    if (this.has('shootLightning')) opts.push('lightning');
    return opts;
  }
  /** Currently-selected player shot damage type. Wraps so deleting a perk
   *  (rebirth) doesn't leave a dangling index past the array end. */
  private currentPlayerDmgType(): DamageType {
    const opts = this.playerDmgTypeOptions();
    return opts[this.playerDmgTypeIdx % opts.length]!;
  }
  /** Aura buff configuration computed from PLAYER-aura perks. Returns
   *  null when the aura is locked. */
  private playerAura(): { radius: number; dmgMul: number; fireRateMul: number } | null {
    if (!this.has('auraUnlock')) return null;
    let dmgMul = 1.15;
    if (this.has('auraDmg1')) dmgMul = 1.40;
    const fireRateMul = this.has('auraSpeed') ? 1.25 : 1;
    let radius = 140;
    if (this.has('auraRadius')) radius = 224;
    return { radius, dmgMul, fireRateMul };
  }
  private effectiveRunnerLimit(): number {
    let n = SLOT_LIMITS.runner + this.essenceQuickStartBonus();
    // The unlock perk grants ONE starter runner — the player avatar still
    // does most of the work early on, the first runner is help, not a replacement.
    // Without this perk, base SLOT_LIMITS.runner is zero (gated by design).
    if (this.has('runnerUnlock')) n += 1;
    if (this.ownedShopItems.has('slotExpansion')) n++;
    if (this.has('runnerSlot1'))  n++;
    if (this.has('runnerSlot2'))  n++;
    if (this.has('runnerSlot3'))  n++;
    if (this.has('runnerSlot4'))  n++;
    if (this.has('runnerSlot5'))  n++;
    if (this.has('runnerSlot6'))  n++;
    if (this.has('runnerSlot7'))  n++;
    if (this.has('runnerSlot8'))  n++;
    if (this.has('runnerSlot9'))  n++;
    if (this.has('runnerSlot10')) n++;
    if (this.has('runnerSlot11')) n++;
    if (this.has('runnerSlot12')) n++;
    if (this.has('runnerSlot13')) n++;
    if (this.has('runnerSlot14')) n++;
    if (this.has('runnerSlot15')) n++;
    return n;
  }
  /** Roll *duration* in seconds — the slot animation runs this long from click
   *  to result, and is also the rate-limit between rolls. Reduced by
   *  ECONOMY-branch perks. Floors at 1s so the dice never becomes fully spammable. */
  private effectiveSpinDuration(): number {
    let d = SPIN_BASE_DURATION;
    if (this.has('cheaperSpin1')) d -= 0.5;
    if (this.has('cheaperSpin2')) d -= 0.5;
    if (this.has('cheaperSpin3')) d -= 0.5;
    if (this.has('cheaperSpin4')) d -= 0.5;
    if (this.has('cheaperSpin5')) d -= 0.5;
    if (this.has('cheaperSpin6')) d -= 0.5;
    if (this.quickRollChargesLeft > 0) d *= 0.5;
    return Math.max(0.5, d);
  }
  /** How many slimes a single roll spawns. Tiered absolute values — having a
   *  later tier supersedes earlier ones. */
  private effectiveRollMul(): number {
    if (this.has('rollMul8')) return 8;
    if (this.has('rollMul4')) return 4;
    if (this.has('rollMul2')) return 2;
    return 1;
  }
  // ---- Save / load (localStorage) ---------------------------------------
  /** Serialize all persistent state into a small JSON blob. Skips transient
   *  entities (slimes, projectiles, loot, smoke, animations) — those rebuild
   *  from the slot assignments + mountain state on load. */
  /** Set by clearSave() so beforeunload / pagehide / auto-save can't re-write
   *  the save we just deleted before the reload happens. */
  private saveSuppressed = false;

  save() {
    if (this.saveSuppressed) return;
    try {
      const data = {
        v: SAVE_VERSION,
        inv: this.inventory,
        // Serialize the Map as an array of entries.
        collection: [...this.collection.values()],
        spitterSlots: this.spitterSlots,
        runnerSlots: this.runnerSlots,
        unlockedPerks: [...this.unlockedPerks],
        essenceUnlocked: [...this.essenceUnlocked],
        claimedMilestones: [...this.claimedMilestones],
        pendingMilestones: [...this.pendingMilestones],
        bagProgress: this.bagProgress,
        foodDrops: this.foodDrops
          .filter((f) => !f.collected)
          .map((f) => ({ x: f.x, y: f.y, kind: f.kind })),
        ownedShopItems: [...this.ownedShopItems],
        boosts: this.boosts,
        rebirthBoostCharges: this.rebirthBoostCharges,
        quickRollChargesLeft: this.quickRollChargesLeft,
        pendingEssence: this.pendingEssence,
        ftue: this.ftue,
        ftueRebirthStep: this.ftueRebirthStep,
        runGoldEarned: this.runGoldEarned,
        runMountainsKilled: this.runMountainsKilled,
        totalMountainsKilled: this.totalMountainsKilled,
        totalRebirths: this.totalRebirths,
        lifetimeSpins: this.lifetimeSpins,
        themesUnlocked: this.themesUnlocked,
        chosenNextTheme: this.chosenNextTheme,
        mountainLevel: this.mountain.level,
        mountainCycle: this.mountain.cycle,
        mountainHp: this.mountain.hp,
        autoRoll: this.autoRoll,
      };
      localStorage.setItem('svm-save', JSON.stringify(data));
    } catch {
      // localStorage can throw in private mode / quota — silently no-op.
    }
  }

  /** Load + hydrate from localStorage. Returns true when state was restored.
   *  Any save whose `v` doesn't match `SAVE_VERSION` is wiped from local
   *  storage and treated as a brand-new player — this game is still in
   *  prototype-churn territory, so we'd rather force a fresh start than
   *  ship partially-loaded data that crashes the runtime. */
  private tryLoad(): boolean {
    try {
      const raw = localStorage.getItem('svm-save');
      if (!raw) return false;
      const d = JSON.parse(raw);
      if (!d || d.v !== SAVE_VERSION) {
        // Stale save from an older build — wipe it so the next save doesn't
        // co-exist with the corpse. Constructor falls through to fresh start.
        try { localStorage.removeItem('svm-save'); } catch {}
        return false;
      }
      this.inventory = d.inv;
      // Back-compat: pre-Phase-5 saves don't carry the Rolls field.
      if (typeof this.inventory.rolls !== 'number') this.inventory.rolls = 0;
      // Rehydrate the stack inventory from the saved array of VariantState.
      // Filter out entries whose `variantId` no longer exists in SLIME_VARIANTS
      // (e.g. an old save that referenced `pebble` after we trimmed the roster).
      this.collection = new Map();
      for (const v of (d.collection ?? []) as VariantState[]) {
        if (!SLIME_VARIANTS[v.variantId]) continue;
        this.collection.set(v.variantId, {
          variantId: v.variantId,
          count: v.count ?? 0,
          timesRolled: v.timesRolled ?? 0,
          slotted: 0, // recomputed from slot lists below
          level: v.level ?? 1,
          xp: v.xp ?? 0,
        });
      }
      // Same filter on slot lists — drop any slot referencing a removed variant.
      this.spitterSlots = ((d.spitterSlots ?? []) as SlimeVariantId[])
        .filter((id) => SLIME_VARIANTS[id]);
      this.runnerSlots = ((d.runnerSlots ?? []) as SlimeVariantId[])
        .filter((id) => SLIME_VARIANTS[id]);
      // Recompute slotted counters from the slot lists.
      for (const id of [...this.spitterSlots, ...this.runnerSlots]) {
        const v = this.collection.get(id);
        if (v) v.slotted++;
      }
      // Build sets of currently-valid IDs so we can scrub stale references
      // (e.g. mutation perks / cut shop items / removed milestone thresholds
      // from older builds) without crashing or leaving phantom data.
      const validPerks = new Set(SKILL_TREE.map((n) => n.id));
      const validEssence = new Set(ESSENCE_TREE.map((n) => n.id));
      const validShop = new Set(SHOP_ITEMS.map((i) => i.id));
      const validMilestones = new Set(INDEX_MILESTONES.map((m) => m.threshold));
      this.unlockedPerks = new Set(
        (d.unlockedPerks ?? ['foundation']).filter((id: string) => validPerks.has(id as PerkId)),
      );
      if (!this.unlockedPerks.has('foundation')) this.unlockedPerks.add('foundation');
      // Migration: saves predating the runnerUnlock gate had two runner slots
      // by default. We grant `runnerUnlock` (+1 slot) AND `runnerSlot1` (+1
      // slot) so their two starting runners don't orphan above the new cap.
      const hadRunners = Array.isArray(d.runnerSlots) && d.runnerSlots.length > 0;
      const hadProgress = (d.totalMountainsKilled ?? 0) > 0;
      if (hadRunners || hadProgress) {
        this.unlockedPerks.add('runnerUnlock');
        this.unlockedPerks.add('runnerSlot1');
      }
      this.essenceUnlocked = new Set(
        (d.essenceUnlocked ?? []).filter((id: string) => validEssence.has(id as EssenceId)),
      );
      this.claimedMilestones = new Set(
        (d.claimedMilestones ?? []).filter((t: number) => validMilestones.has(t)),
      );
      this.pendingMilestones = new Set(
        (d.pendingMilestones ?? []).filter((t: number) => validMilestones.has(t)),
      );
      this.bagProgress = typeof d.bagProgress === 'number' ? d.bagProgress : 0;
      this.foodDrops = [];
      for (const f of (d.foodDrops ?? []) as Array<{ x: number; y: number; kind: keyof typeof FOOD_SPECS }>) {
        const spec = FOOD_SPECS[f.kind];
        if (spec) this.foodDrops.push(new FoodDrop(f.x, f.y, spec));
      }
      this.ownedShopItems = new Set(
        (d.ownedShopItems ?? []).filter((id: string) => validShop.has(id as ShopItemId)),
      );
      this.boosts = d.boosts ?? { serverLuck: 0, serverCoins: 0, luckySpinsLeft: 0 };
      this.rebirthBoostCharges = d.rebirthBoostCharges ?? 0;
      this.quickRollChargesLeft = d.quickRollChargesLeft ?? 0;
      this.pendingEssence = d.pendingEssence ?? 0;
      // FTUE: only override the default snapshot if the save has a sane one.
      // Old saves without `ftue` mean a pre-FTUE player — treat them as done
      // (step 0) so we don't re-onboard a veteran.
      if (d.ftue && typeof d.ftue.step === 'number') {
        this.ftue = {
          step: d.ftue.step,
          goldAtStepStart: d.ftue.goldAtStepStart ?? 0,
          rollsAtStepStart: d.ftue.rollsAtStepStart ?? 0,
        };
      } else {
        this.ftue.step = 0;
      }
      this.ftueRebirthStep = typeof d.ftueRebirthStep === 'number' ? d.ftueRebirthStep : 0;
      this.runGoldEarned = d.runGoldEarned ?? 0;
      this.runMountainsKilled = d.runMountainsKilled ?? 0;
      this.totalMountainsKilled = d.totalMountainsKilled ?? 0;
      // Older saves predate this counter — infer from `essenceUnlocked` /
      // existing essence balance: if the player owns any meta progress they've
      // rebirthed at least once, so unhide the Rebirth Tree button for them.
      const inferredRebirths =
        (d.essenceUnlocked?.length ?? 0) > 0 || (d.inv?.essence ?? 0) > 0 ? 1 : 0;
      this.totalRebirths = d.totalRebirths ?? inferredRebirths;
      this.lifetimeSpins = d.lifetimeSpins ?? 0;
      this.themesUnlocked = Math.max(1, d.themesUnlocked ?? 1);
      this.chosenNextTheme =
        typeof d.chosenNextTheme === 'number' &&
        d.chosenNextTheme >= 0 &&
        d.chosenNextTheme < this.themesUnlocked
          ? d.chosenNextTheme
          : null;
      this.autoRoll = d.autoRoll ?? false;
      this.mountain.level = d.mountainLevel ?? 0;
      this.mountain.cycle = d.mountainCycle ?? 0;
      this.mountain.maxHp = Math.floor(2400 * this.mountain.theme().hpMul);
      this.mountain.hp = Math.min(d.mountainHp ?? this.mountain.maxHp, this.mountain.maxHp);
      this.mountain.phase = 'alive';
      this.mountain.phaseT = 0;
      this.mountain.effects = [];
      // tryLoad bypasses assignToSlot, so the in-world Slime entities never
      // get spawned. Rebuild them here from the restored slot lists so the
      // game opens with active slimes instead of empty slots.
      this.rebuildActiveSlimes();
      return true;
    } catch {
      return false;
    }
  }

  /** Wipe save and reset to a fresh game. Exposed via window.__game.clearSave()
   *  for debugging from the console. Suppress further writes so the unload
   *  handlers don't re-write the save we just removed. */
  clearSave() {
    this.saveSuppressed = true;
    try { localStorage.removeItem('svm-save'); } catch {}
    location.reload();
  }

  private effectiveAutoSpin(): boolean {
    return this.has('autoSpin');
  }
  /** Minimum rarity floor for spin results. 0 = common, 1 = uncommon, 2 = rare.
   *  Lucky Spins shop boost (5 charges) forces a Rare-or-better floor that beats
   *  the perk floor and decrements one per spin. */
  private effectiveMinRarityIdx(): number {
    let n = 0;
    if (this.has('royalSpin')) n = Math.max(n, 2);
    else if (this.has('luxurySpin')) n = Math.max(n, 1);
    if (this.boosts.luckySpinsLeft > 0) n = Math.max(n, 2);
    return n;
  }
  /** Per-damage-point chance of an *extra* drop on top of the guaranteed small
   *  gold. Base is 0 — a vanilla hit produces only the guaranteed piece. Each
   *  dropChance perk tier adds an absolute %. */
  private effectiveDropChancePerPoint(): number {
    let p = 0;
    if (this.has('dropChance1')) p += 0.08;
    if (this.has('dropChance2')) p += 0.12;
    if (this.has('dropChance3')) p += 0.18;
    if (this.has('dropChance4')) p += 0.25;
    if (this.has('dropChance5')) p += 0.35;
    return p;
  }
  private effectiveSpitterDmgMul(): number {
    let bonus = 0;
    if (this.has('spitterDmg1')) bonus += 0.25;
    if (this.has('spitterDmg2')) bonus += 0.50;
    if (this.has('spitterDmg3')) bonus += 1.00;
    if (this.has('spitterDmg4')) bonus += 2.00;
    return (1 + bonus) * this.essenceDmgMul();
  }
  /** Global crit chance added to every spitter's roll (stacks with variant.critChance). */
  private effectiveGlobalCrit(): number {
    let p = 0;
    if (this.has('spitterCrit1')) p += 0.10;
    if (this.has('spitterCrit2')) p += 0.15;
    if (this.has('spitterCrit3')) p += 0.25;
    return p;
  }
  private effectiveRunnerSpeedMul(): number {
    let bonus = 0;
    if (this.has('runnerSpeed1')) bonus += 0.25;
    if (this.has('runnerSpeed2')) bonus += 0.50;
    if (this.has('runnerSpeed3')) bonus += 0.75;
    if (this.has('runnerSpeed4')) bonus += 1.00;
    return 1 + bonus;
  }
  private effectivePickupMul(): number {
    let m = 1;
    if (this.has('fasterPickup1')) m *= 0.8;
    if (this.has('fasterPickup2')) m *= 0.75;
    if (this.has('fasterPickup3')) m *= 0.7;
    if (this.has('fasterPickup4')) m *= 0.6;
    return m;
  }
  private effectiveDropoffMul(): number {
    let m = 1;
    if (this.has('fasterDrop1')) m *= 0.75;
    if (this.has('fasterDrop2')) m *= 0.65;
    return m;
  }
  private effectiveCarryBonus(): number {
    let n = 0;
    if (this.has('carryCap1')) n += 1;
    if (this.has('carryCap2')) n += 1;
    if (this.has('carryCap3')) n += 1;
    if (this.has('carryCap4')) n += 2;
    if (this.has('carryCap5')) n += 2;
    return n;
  }
  private effectiveGoldMul(): number {
    let m = 1;
    if (this.has('biggerCoins1')) m = 2;
    if (this.has('biggerCoins2')) m = 3;
    if (this.has('biggerCoins3')) m = 5;
    // Shop: Mega Coins gamepass = permanent +50%
    if (this.ownedShopItems.has('megaCoins')) m *= 1.5;
    // Shop: 2× Coins timed boost
    if (this.boosts.serverCoins > 0) m *= 2;
    return m * this.essenceGoldMul() * this.essenceHaulMul();
  }
  private effectiveGemMul(): number {
    let m = 1;
    if (this.has('biggerGems2')) m = 4;
    else if (this.has('biggerGems1')) m = 2;
    return m * this.essenceHaulMul();
  }
  /** 0 = none, 0.5 = 50% chance loot doubles, 1.0 = always doubles. */
  private effectiveHeavyDropChance(): number {
    if (this.has('heavyDrops2')) return 1.0;
    if (this.has('heavyDrops1')) return 0.5;
    return 0;
  }
  /** Reclaim interval multiplier (>1 means slower). */
  private effectiveReclaimSlowMul(): number {
    let m = 1;
    if (this.has('reclaimReduce1')) m *= 2;
    if (this.has('reclaimReduce2')) m *= 2;
    return m;
  }
  private effectiveFloorMaxBonus(): number {
    let n = 0;
    if (this.has('floorMax1')) n += 15;
    if (this.has('floorMax2')) n += 30;
    return n;
  }
  /** Total luck: inventory.luck plus the 6 luck-branch perks + Essence Fortune.
   *  Server Luck Boost (shop) multiplies the final total ×3 while active. */
  private effectiveLuck(): number {
    let n = this.inventory.luck + this.essenceStartingLuck();
    if (this.has('luckyFoot')) n += 10;
    if (this.has('fourLeaf'))  n += 50;
    if (this.has('horseshoe')) n += 150;
    if (this.has('lucky4'))    n += 400;
    if (this.has('lucky5'))    n += 1000;
    if (this.has('lucky6'))    n += 1650;
    // Luck multipliers (sub-branch). Stack multiplicatively after the flat sum.
    let mul = 1;
    if (this.has('luckMul1')) mul *= 1.10;
    if (this.has('luckMul2')) mul *= 1.25;
    if (this.has('luckMul3')) mul *= 1.50;
    if (this.has('luckMul4')) mul *= 2.00;
    n *= mul;
    if (this.boosts.serverLuck > 0) n *= 3; // Server Luck shop boost (×3 while active)
    return n;
  }

  /** Push a copy of the given variant into the next free position of the
   *  given slot type. Requires an available (un-slotted) copy in the stack.
   *  No-op if the slot type is full, no copies are free, OR the same variant
   *  is already occupying a slot of this type — one of each kind per role. */
  private assignToSlot(variantId: SlimeVariantId, type: SlotType): boolean {
    const v = this.collection.get(variantId);
    if (!v) return false;
    if (v.count - v.slotted <= 0) return false;
    const list = type === 'spitter' ? this.spitterSlots : this.runnerSlots;
    // Uniqueness per slot type: you can have a Green spitter AND a Green
    // runner, but not two Green spitters even if you own multiple copies.
    if (list.includes(variantId)) return false;
    const limit = type === 'spitter' ? this.effectiveSpitterLimit() : this.effectiveRunnerLimit();
    if (list.length >= limit) return false;
    list.push(variantId);
    v.slotted++;
    this.rebuildActiveSlimes();
    return true;
  }

  /** Remove the slime occupying (type, index). Decrements the variant's
   *  `slotted` counter. `dropCargo: true` releases any carried loot. */
  private removeFromSlot(type: SlotType, index: number, dropCargo: boolean): boolean {
    const list = type === 'spitter' ? this.spitterSlots : this.runnerSlots;
    const variantId = list[index];
    if (variantId === undefined) return false;
    list.splice(index, 1);
    const v = this.collection.get(variantId);
    if (v) v.slotted = Math.max(0, v.slotted - 1);
    if (dropCargo) {
      const s = this.slimes.find((sl) => sl.slotType === type && sl.slotIndex === index);
      if (s) s.releaseCarried();
    }
    return true;
  }

  /** Empty every slot list (decrementing each variant's slotted counter).
   *  Used by equipBest before re-pushing the optimal arrangement. */
  private clearAllSlots(dropCargo: boolean) {
    while (this.spitterSlots.length > 0) this.removeFromSlot('spitter', 0, dropCargo);
    while (this.runnerSlots.length > 0) this.removeFromSlot('runner', 0, dropCargo);
  }

  /** Compute the (x,y) home for each filled slot position.
   *
   *  Spitters stack in columns of up to 3, filling bottom-to-top. Once a
   *  column tops out, the next slime opens a fresh column to the LEFT of the
   *  current one — keeps the stack from clipping into the HUD when the player
   *  buys many spitter-slot perks. */
  private computeSlotGeoms(): SlotGeom[] {
    const geoms: SlotGeom[] = [];
    const SPITTER_COL_HEIGHT = 3;
    const SPITTER_COL_SPACING = 26;
    const visualScale = 0.6;
    for (let i = 0; i < this.effectiveSpitterLimit(); i++) {
      const variantId = this.spitterSlots[i];
      const variant = variantId !== undefined ? SLIME_VARIANTS[variantId] : null;
      const size = (variant ? variant.size : 28) * visualScale;
      const col = Math.floor(i / SPITTER_COL_HEIGHT);
      const row = i % SPITTER_COL_HEIGHT;
      // Row spacing scales with the (shrunken) sprite height. Add a small
      // constant so adjacent slimes have a hair of breathing room.
      const rowStep = size * 1.4 + 2;
      geoms.push({
        type: 'spitter',
        index: i,
        x: WORLD.spitterX - col * SPITTER_COL_SPACING,
        y: WORLD.groundY - row * rowStep,
        size,
        occupied: variantId !== undefined,
      });
    }
    // Runner row across the bottom — same horizontal layout as before.
    for (let i = 0; i < this.effectiveRunnerLimit(); i++) {
      const variantId = this.runnerSlots[i];
      const variant = variantId !== undefined ? SLIME_VARIANTS[variantId] : null;
      const size = (variant ? variant.size : 28) * visualScale;
      geoms.push({
        type: 'runner',
        index: i,
        x: WORLD.runnerHomeX + i * WORLD.runnerSpacing * 2,
        y: WORLD.groundY,
        size,
        occupied: variantId !== undefined,
      });
    }
    return geoms;
  }

  /** Sync this.slimes with current slot assignments. Existing Slime instances
   *  whose (slotType, slotIndex, variantId) matches are kept — preserving
   *  their carry state, runner machine, fire cooldown, position. Mismatches
   *  spawn fresh Slime instances; vacated slots drop their entities. */
  private rebuildActiveSlimes() {
    const geoms = this.computeSlotGeoms();
    const existingBySlot = new Map<string, Slime>();
    for (const s of this.slimes) existingBySlot.set(`${s.slotType}:${s.slotIndex}`, s);
    const next: Slime[] = [];
    for (const g of geoms) {
      const list = g.type === 'spitter' ? this.spitterSlots : this.runnerSlots;
      const variantId = list[g.index];
      if (variantId === undefined) continue;
      const key = `${g.type}:${g.index}`;
      const prev = existingBySlot.get(key);
      if (prev && prev.variant.id === variantId) {
        prev.homeX = g.x;
        prev.homeY = g.y;
        if (g.type === 'spitter') {
          prev.x = g.x;
          prev.y = g.y;
        }
        next.push(prev);
        existingBySlot.delete(key);
      } else {
        if (prev) prev.releaseCarried();
        next.push(new Slime(nextSlimeId++, SLIME_VARIANTS[variantId], g.type, g.index, g.x, g.y));
      }
    }
    for (const orphan of existingBySlot.values()) orphan.releaseCarried();
    this.slimes = next;
  }

  private onMouseMove(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = ((e.clientX - r.left) / r.width) * this.canvas.width;
    this.mouseY = ((e.clientY - r.top) / r.height) * this.canvas.height;
    if (this.treeDragging) {
      this.treePanX = this.treeDragOriginPanX + (this.mouseX - this.treeDragStartX);
      this.treePanY = this.treeDragOriginPanY + (this.mouseY - this.treeDragStartY);
    }
    if (this.panelInteract) {
      const dx = this.mouseX - this.panelInteract.startX;
      const dy = this.mouseY - this.panelInteract.startY;
      if (!this.panelInteract.moved && dx * dx + dy * dy > 25) {
        this.panelInteract.moved = true;
      }
      if (this.panelInteract.moved) {
        // Drag scrolls in the opposite direction (drag right → reveal earlier cells).
        this.collectionScroll = this.clampScroll(this.panelInteract.originScroll - dx);
      }
    }
    this.hoveredSpin = spinBtnContains(this.mouseX, this.mouseY);
    this.hoveredTreeBtn = treeBtnContains(this.mouseX, this.mouseY);
    // Old top-left autoplay button hover is gone — handled inside Settings now.
    this.rebirthHovered = rebirthBtnContains(this.mouseX, this.mouseY);
    this.essenceTreeBtnHovered =
      this.totalRebirths > 0 && essenceTreeBtnContains(this.mouseX, this.mouseY);
    this.themeUnlockBtnHovered = this.themeUnlockBtnContains(this.mouseX, this.mouseY);
    this.treeCloseHovered = this.showTree && treeCloseBtnContains(this.mouseX, this.mouseY);
    this.essenceCloseHovered = this.showEssenceTree && essenceCloseBtnContains(this.mouseX, this.mouseY);
    this.shopCloseHovered = this.showShop && shopCloseBtnContains(this.mouseX, this.mouseY);
    this.indexCloseHovered = this.showIndex && indexCloseBtnContains(this.mouseX, this.mouseY);
    this.indexBtnHovered = indexBtnContains(this.mouseX, this.mouseY);
    this.craftBtnHovered = this.hasE('craft1') && craftBtnContains(this.mouseX, this.mouseY);
    this.craftCloseHovered = this.showCraft && craftCloseBtnContains(this.mouseX, this.mouseY);
    this.craftFuseHovered = this.showCraft && craftFuseBtnContains(this.mouseX, this.mouseY);
    this.hoveredCraftVariantId = this.showCraft
      ? hitCraftVariant(this.mouseX, this.mouseY, this.craftSelectedRarity)
      : null;
    const overlayOpenNow = this.showTree || this.showEssenceTree || this.showShop || this.showSettings || this.showIndex || this.showCraft;
    this.settingsBtnHovered = !overlayOpenNow && settingsBtnContains(this.mouseX, this.mouseY);
    this.settingsCloseHovered = this.showSettings && settingsCloseBtnContains(this.mouseX, this.mouseY);
    this.settingsAutoplayHovered = this.showSettings && settingsAutoplayHit(this.mouseX, this.mouseY);
    this.settingsCheatHovered = this.showSettings && settingsCheatHit(this.mouseX, this.mouseY);
    this.settingsResetHovered = this.showSettings && settingsResetHit(this.mouseX, this.mouseY);
    this.autoRollBtnHovered = this.has('autoSpin') && autoRollBtnContains(this.mouseX, this.mouseY);
    this.shopBtnHovered = shopBtnContains(this.mouseX, this.mouseY);
    this.hoveredShopItem = this.showShop
      ? hitShopItem(this.mouseX, this.mouseY, this.ownedShopItems)
      : null;
    this.hoveredEssenceNode = this.showEssenceTree
      ? hitEssenceNode(this.mouseX, this.mouseY, this.essenceUnlocked)
      : null;
    this.hoveredHex = this.showTree
      ? hitVisibleHex(this.mouseX, this.mouseY, this.unlockedPerks, this.treePanX, this.treePanY, this.treeZoom)
      : null;
    const overFood = !overlayOpenNow && this.foodDrops.some((f) => !f.collected && f.containsPoint(this.mouseX, this.mouseY));
    const overSlime = !this.showTree && !!this.hitSlime(this.mouseX, this.mouseY);
    const overSlot =
      !this.showTree &&
      this.selectedVariantId !== null &&
      !!this.hitSlotGhost(this.mouseX, this.mouseY);
    const overCell = !this.showTree && !!hitCollectionCell(this.hudState(), this.mouseX, this.mouseY);
    this.canvas.style.cursor =
      (this.hoveredSpin && this.spinFlash === 0) ||
      this.hoveredTreeBtn ||
      this.hoveredHex !== null ||
      overSlime ||
      overSlot ||
      overCell ||
      overFood
        ? 'pointer'
        : 'default';
  }

  private onClick(e: MouseEvent) {
    const r = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * this.canvas.width;
    const py = ((e.clientY - r.top) / r.height) * this.canvas.height;

    // Discovery reveal eats all clicks while playing — click anywhere to skip.
    if (this.discoveryReveal) {
      this.discoveryReveal = null;
      return;
    }

    // Rebirth modal eats all clicks while open.
    if (this.rebirthModalOpen) {
      if (rebirthModalConfirmContains(px, py)) {
        this.rebirth();
        this.rebirthModalOpen = false;
      } else if (rebirthModalCancelContains(px, py)) {
        this.rebirthModalOpen = false;
      }
      return;
    }

    // Reset-progress modal eats all clicks while open.
    if (this.resetModalOpen) {
      if (resetModalConfirmContains(px, py)) {
        this.clearSave();
      } else if (resetModalCancelContains(px, py)) {
        this.resetModalOpen = false;
      }
      return;
    }

    // When the settings overlay is open: close-button → row actions.
    if (this.showSettings) {
      if (settingsCloseBtnContains(px, py)) {
        this.showSettings = false;
        return;
      }
      if (settingsAutoplayHit(px, py)) {
        this.autoplay = !this.autoplay;
        return;
      }
      if (settingsCheatHit(px, py)) {
        this.grantCheatResources();
        return;
      }
      if (settingsResetHit(px, py)) {
        this.resetModalOpen = true;
        return;
      }
      return;
    }

    // Settings button — opens the settings overlay.
    if (settingsBtnContains(px, py)) {
      this.showSettings = true;
      this.selectedVariantId = null;
      return;
    }

    // Shop purchase modal eats all clicks while open.
    if (this.pendingShopItem) {
      if (shopModalBuyContains(px, py)) {
        this.applyShopPurchase(this.pendingShopItem);
        this.pendingShopItem = null;
      } else if (shopModalCancelContains(px, py)) {
        this.pendingShopItem = null;
      }
      return;
    }

    // When the shop overlay is open: close-button takes priority, then card clicks.
    if (this.showShop) {
      if (shopCloseBtnContains(px, py)) {
        this.showShop = false;
        return;
      }
      if (shopOverlayContains(px, py)) {
        const item = hitShopItem(px, py, this.ownedShopItems);
        if (item) this.pendingShopItem = item;
      }
      return;
    }

    // When the Index is open: close button + claim chip.
    if (this.showIndex) {
      if (indexCloseBtnContains(px, py)) {
        this.showIndex = false;
        return;
      }
      const claimThreshold = indexClaimBtnAt(px, py, this.pendingMilestones);
      if (claimThreshold !== null) {
        this.claimMilestone(claimThreshold);
        return;
      }
      return;
    }

    // Index button — opens the discovery overlay.
    if (indexBtnContains(px, py)) {
      this.showIndex = true;
      this.selectedVariantId = null;
      return;
    }

    // Shop button — opens overlay (close button is the way to close).
    if (shopBtnContains(px, py)) {
      this.showShop = true;
      this.selectedVariantId = null;
      return;
    }

    // Tree button — opens the tree overlay (close button is the way to close).
    if (treeBtnContains(px, py) && !this.showTree) {
      this.showTree = true;
      this.selectedVariantId = null;
      return;
    }

    // (Top-left AI Autoplay button moved to the Settings overlay. The 'A' key
    // shortcut still toggles it via onKeyDown.)

    // Auto-Roll toggle — only respond when the perk is unlocked.
    if (this.has('autoSpin') && autoRollBtnContains(px, py)) {
      this.autoRoll = !this.autoRoll;
      return;
    }

    // Rebirth button — opens the confirmation modal when unlocked.
    if (rebirthBtnContains(px, py)) {
      if (this.rebirthUnlocked()) this.rebirthModalOpen = true;
      return;
    }

    // When the essence tree is open: close-button takes priority, then node clicks.
    if (this.showEssenceTree) {
      if (essenceCloseBtnContains(px, py)) {
        this.showEssenceTree = false;
        return;
      }
      if (essenceOverlayContains(px, py)) {
        const node = hitEssenceNode(px, py, this.essenceUnlocked);
        if (node && !this.essenceUnlocked.has(node.id)) {
          this.tryUnlockEssence(node.id);
        }
      }
      return;
    }

    // Essence tree button — opens the prestige tree overlay. Hidden (and
    // un-clickable) until the player has rebirthed once.
    if (this.totalRebirths > 0 && essenceTreeBtnContains(px, py)) {
      this.showEssenceTree = true;
      this.selectedVariantId = null;
      return;
    }

    // When the Crafting overlay is open: close → fuse → tier-tab → variant-card.
    if (this.showCraft) {
      if (craftCloseBtnContains(px, py)) {
        this.showCraft = false;
        return;
      }
      if (craftFuseBtnContains(px, py)) {
        this.tryFuseSelected();
        return;
      }
      if (craftOverlayContains(px, py)) {
        const tier = hitCraftTier(px, py);
        if (tier) {
          this.craftSelectedRarity = tier;
          this.craftSelectedVariantId = null;
          return;
        }
        const variantId = hitCraftVariant(px, py, this.craftSelectedRarity);
        if (variantId) {
          this.craftSelectedVariantId = variantId;
          return;
        }
      }
      return;
    }

    // Crafting button — opens the fusion overlay. Hidden until the `craft1`
    // essence node has been unlocked.
    if (this.hasE('craft1') && craftBtnContains(px, py)) {
      this.showCraft = true;
      this.craftSelectedRarity = defaultCraftRarity(this.collection);
      this.craftSelectedVariantId = null;
      this.selectedVariantId = null;
      return;
    }

    // Unlock-next-theme button (above the mountain). Spends gold to gate-jump
    // the mountain progression to the next theme. Skipped while ANY overlay
    // is open so the button's hitbox doesn't poach clicks meant for the
    // close button (they sit in the same top-right corner of the canvas).
    const anyOverlayOpen =
      this.showTree || this.showEssenceTree || this.showShop || this.showSettings || this.showIndex || this.showCraft;
    if (!anyOverlayOpen && this.themeUnlockBtnContains(px, py)) {
      if (!this.buyNextThemeUnlock()) {
        this.toast = { text: 'Not enough pollen', t: 1.5 };
      }
      return;
    }

    // Next-Tree picker — let the player force the next tree's theme. Only
    // active when 2+ themes are unlocked and no overlay is intercepting.
    if (!anyOverlayOpen) {
      const picked = this.themePickerHit(px, py);
      if (picked !== undefined) {
        this.chosenNextTheme = picked;
        const label =
          picked === null ? 'Auto' : MOUNTAIN_THEMES[picked]!.name;
        this.toast = { text: `Next tree: ${label}`, t: 1.2 };
        this.save();
        return;
      }
    }

    // Damage-type chip — clicking it cycles the player's shot type just like Q.
    if (!anyOverlayOpen && this.dmgTypeChipContains(px, py)) {
      this.cyclePlayerDmgType();
      return;
    }

    // When the tree is open: close-button → hex click → drag-to-pan.
    if (this.showTree) {
      if (treeCloseBtnContains(px, py)) {
        this.showTree = false;
        return;
      }
      if (treeOverlayContains(px, py)) {
        const node = hitVisibleHex(px, py, this.unlockedPerks, this.treePanX, this.treePanY, this.treeZoom);
        if (node && (node.repeatable || !this.unlockedPerks.has(node.id))) {
          if (this.tryUnlock(node)) return;
        } else if (!node) {
          // Start drag-to-pan
          this.treeDragging = true;
          this.treeDragStartX = px;
          this.treeDragStartY = py;
          this.treeDragOriginPanX = this.treePanX;
          this.treeDragOriginPanY = this.treePanY;
        }
      }
      return;
    }

    if (spinBtnContains(px, py)) {
      this.spin();
      return;
    }

    // Equip-Best button (in collection panel label column)
    if (equipBestBtnContains(this.hudState(), px, py)) {
      this.equipBest();
      return;
    }

    // 1) Collection panel — defer to mouseup so we can distinguish click vs drag-to-scroll.
    if (panelContains(px, py)) {
      this.panelInteract = {
        startX: px,
        startY: py,
        originScroll: this.collectionScroll,
        moved: false,
      };
      return;
    }

    // 2) Click on an embedded food drop — feed XP to the selected variant.
    //    Food sits on the cliff and the only way to consume it is a direct click.
    for (const f of this.foodDrops) {
      if (f.collected) continue;
      if (f.containsPoint(px, py)) {
        if (this.selectedVariantId === null) {
          this.toast = { text: 'Select a bee first!', t: 1.8 };
        } else {
          f.collected = true;
          this.addXpToVariant(this.selectedVariantId, f.spec.xp);
        }
        return;
      }
    }

    // 3) Click on an empty slot ghost — assign a copy of the selected variant
    //    if one's free on the bench (count > slotted).
    const ghost = this.hitSlotGhost(px, py);
    if (ghost && this.selectedVariantId !== null) {
      this.assignToSlot(this.selectedVariantId, ghost.type);
      this.selectedVariantId = null;
      return;
    }

    // 3) Click on an in-world slime. With stack inventory each clicked slime
    //    belongs to a specific (slotType, slotIndex). Selection still tracks
    //    a variantId — clicking the slime selects its variant.
    const hit = this.hitSlime(px, py);
    if (hit) {
      if (this.selectedVariantId === null) {
        this.selectedVariantId = hit.variant.id;
      } else if (this.selectedVariantId === hit.variant.id) {
        // Second click on the same variant in this slot — unslot it.
        this.removeFromSlot(hit.slotType, hit.slotIndex, /* dropCargo */ true);
        this.rebuildActiveSlimes();
        this.selectedVariantId = null;
      } else {
        // Different variant selected — swap the variantId in this slot for
        // a copy of the selected variant (if one is available on the bench).
        const newVariant = this.selectedVariantId;
        const oldVariant = hit.variant.id;
        const available = this.availableCount(newVariant);
        if (available > 0) {
          // Remove the existing occupant (returns 1 copy of oldVariant to bench).
          this.removeFromSlot(hit.slotType, hit.slotIndex, /* dropCargo */ false);
          // Insert the new variant at the same slot index.
          const list = hit.slotType === 'spitter' ? this.spitterSlots : this.runnerSlots;
          list.splice(hit.slotIndex, 0, newVariant);
          const v = this.collection.get(newVariant);
          if (v) v.slotted++;
          this.rebuildActiveSlimes();
          void oldVariant;
        }
        this.selectedVariantId = null;
      }
      return;
    }

    // 4) Click on empty world. Three cases:
    //    a) Player owns Shoot Cliff perk + click landed on the mountain →
    //       fire a player shot (instead of walking on top of the cliff).
    //    b) Otherwise: deselect and route the click to the player avatar
    //       as a walk target.
    this.selectedVariantId = null;
    const onMountain =
      this.has('shootUnlock') &&
      px >= this.mountain.x &&
      py >= this.mountain.topY &&
      py <= this.mountain.bottomY &&
      this.mountain.isInCombat();
    if (onMountain) {
      // Once shoot is unlocked, any mountain click is a *shoot intent* — even
      // if the cooldown is still ticking. Swallow the click either way so the
      // player doesn't accidentally start walking toward the cliff face while
      // mashing the trigger.
      if (this.player.tryShoot(px, py)) {
        const dmg = this.effectivePlayerShotDmg();
        const type = this.currentPlayerDmgType();
        // Reuse the existing impact pipeline so player shots benefit from the
        // same loot drops, goon-shield logic, and damage scaling as projectiles.
        // The synthetic "source" is null since there's no real projectile.
        // allowChain = true lets Storm Shot trigger its lightning chain.
        this.applyImpact(px, py, dmg, type, null, /* allowChain */ type === 'lightning');
      }
      return;
    }
    if (py < WORLD.groundY + 30) {
      this.player.setTarget(px, py);
    }
  }

  /** Re-equip slots with the best copies by role. Each variant can occupy at
   *  most ONE spitter slot and ONE runner slot, even if the player owns many
   *  copies — the slot-uniqueness rule applies to equip-best too. A variant
   *  with multiple copies CAN appear in both roles (one as spitter, one as
   *  runner), as long as it still has a free copy to spare. */
  private equipBest() {
    if (this.collection.size === 0) return;

    type Ranked = {
      variantId: SlimeVariantId;
      available: number;
      sp: number;
      rn: number;
    };
    const ranked: Ranked[] = [];
    for (const v of this.collection.values()) {
      const sv = SLIME_VARIANTS[v.variantId];
      const mul = levelMul(v.level);
      ranked.push({
        variantId: v.variantId,
        available: v.count,
        sp: sv.damage * mul,
        rn: sv.moveSpeed * sv.carryCapacity * mul,
      });
    }

    // Spitters: top N unique variants by damage. Each pick decrements that
    // variant's `available` so runners can't also claim the last copy.
    const spitterLimit = this.effectiveSpitterLimit();
    const targetSpitters: SlimeVariantId[] = [];
    for (const r of [...ranked].sort((a, b) => b.sp - a.sp)) {
      if (targetSpitters.length >= spitterLimit) break;
      if (r.available <= 0) continue;
      targetSpitters.push(r.variantId);
      r.available--;
    }
    // Runners: top M unique variants by haul score, drawing from whatever
    // copies are still free after the spitter pass.
    const runnerLimit = this.effectiveRunnerLimit();
    const targetRunners: SlimeVariantId[] = [];
    for (const r of [...ranked].sort((a, b) => b.rn - a.rn)) {
      if (targetRunners.length >= runnerLimit) break;
      if (r.available <= 0) continue;
      targetRunners.push(r.variantId);
      r.available--;
    }

    const sameList = (a: SlimeVariantId[], b: SlimeVariantId[]) => {
      if (a.length !== b.length) return false;
      const counts = new Map<SlimeVariantId, number>();
      for (const k of a) counts.set(k, (counts.get(k) ?? 0) + 1);
      for (const k of b) counts.set(k, (counts.get(k) ?? 0) - 1);
      for (const c of counts.values()) if (c !== 0) return false;
      return true;
    };
    if (sameList(targetSpitters, this.spitterSlots) && sameList(targetRunners, this.runnerSlots)) {
      return;
    }

    this.clearAllSlots(/* dropCargo */ false);
    for (const id of targetSpitters) this.assignToSlot(id, 'spitter');
    for (const id of targetRunners) this.assignToSlot(id, 'runner');
  }

  /** Resolve a deferred panel click (fired from mouseup when no drag occurred).
   *  Cell-hit-test will be re-wired to return a variantId in the HUD refactor;
   *  for now any panel click just deselects so the slot-ghost path stays usable. */
  private handlePanelClick(px: number, py: number) {
    const cell = hitCollectionCell(this.hudState(), px, py);
    if (cell) {
      this.selectedVariantId = this.selectedVariantId === cell ? null : cell;
    } else {
      this.selectedVariantId = null;
    }
  }

  private hitSlotGhost(px: number, py: number): { type: SlotType; index: number } | null {
    const geoms = this.computeSlotGeoms();
    for (const g of geoms) {
      if (g.occupied) continue;
      const dx = px - g.x;
      const dy = py - (g.y - g.size * 0.6);
      if (dx * dx + dy * dy < g.size * g.size) return { type: g.type, index: g.index };
    }
    return null;
  }

  private hitSlime(px: number, py: number): Slime | null {
    for (let i = this.slimes.length - 1; i >= 0; i--) {
      const s = this.slimes[i]!;
      if (s.containsPoint(px, py)) return s;
    }
    return null;
  }

  /** How many skill-tree nodes are currently both adjacent-to-unlocked and
   *  affordable. Drives the red notification dot on the SKILL TREE button so
   *  the player knows when there's something to spend on. While FTUE is in
   *  progress only `spitterSlot1` counts — tryUnlock rejects everything else,
   *  so showing a "ready to buy" badge for any other node would be a lie.
   *  Repeatable perks (Quick Roll etc.) are excluded — the player can always
   *  buy them again once they have the currency, so they'd pin the dot on. */
  private affordableSkillTreeCount(): number {
    let n = 0;
    for (const node of SKILL_TREE) {
      if (node.repeatable) continue;
      // During FTUE step 4 only the spotlighted node counts; tryUnlock rejects
      // everything else, so showing a "ready to buy" badge for any other node
      // would be a lie.
      if (this.ftue.step > 0 && node.id !== 'runnerUnlock') continue;
      if (isUnlockable(node, this.unlockedPerks, this.inventory)) n++;
    }
    return n;
  }

  private tryUnlock(node: SkillNode): boolean {
    // FTUE gate — during onboarding the player is only allowed to buy the
    // node the tutorial is pointing at. Step 4 spotlights `runnerUnlock`;
    // every other node is locked until FTUE completes (step 0) or is skipped.
    if (this.ftue.step > 0 && node.id !== 'runnerUnlock') return false;
    // Explicit perk prereq (Dice nodes require their matching Unlock).
    if (node.requiresPerk !== undefined && !this.unlockedPerks.has(node.requiresPerk)) return false;
    // adjacency check via neighborsOf
    const hasAdj = neighborsOf(node.q, node.r).some((n) => this.unlockedPerks.has(n.id));
    if (!hasAdj) return false;
    if (node.costGold !== undefined && this.inventory.gold < node.costGold) return false;
    if (node.costGems !== undefined && this.inventory.gems < node.costGems) return false;
    if (node.costRolls !== undefined && this.inventory.rolls < node.costRolls) return false;
    payCost(node, this.inventory);
    if (node.repeatable) {
      // Consumable boost — arm the effect instead of permanent unlock.
      this.applyConsumablePerk(node.id);
    } else {
      this.unlockedPerks.add(node.id);
      // Slot caps may have grown — keep the world in sync.
      this.rebuildActiveSlimes();
    }
    // FTUE: auto-close the tree once the player buys the spotlighted node so
    // they can immediately see the new runner slot waiting for them.
    if (this.ftue.step === 4 && node.id === 'runnerUnlock') {
      this.showTree = false;
    }
    return true;
  }

  /** Fire the per-perk effect for repeatable consumable nodes. */
  private applyConsumablePerk(id: PerkId) {
    switch (id) {
      case 'quickRoll':
        this.quickRollChargesLeft += 10;
        this.toast = { text: `Quick Roll armed — next 10 rolls @ half cooldown`, t: 2.5 };
        break;
    }
  }

  // (fuseSlimes removed — fusion was replaced by the Sol's-style stack
  //  inventory + variant leveling system. Power scales via XP/level instead
  //  of consuming dupes. See VariantState in src/game/types.ts.)

  /** Pick a common-or-uncommon variant the player doesn't yet own. Used to
   *  guarantee the very first roll mints a brand-new slime — feels much better
   *  than a duplicate-green for the player's first reel result. Returns null
   *  if every starter variant is already in the collection. */
  private pickFreshStarterVariant(): SlimeVariantId | null {
    const pool: SlimeVariantId[] = [];
    for (const id of ALL_VARIANT_IDS) {
      if (this.collection.has(id)) continue;
      const v = SLIME_VARIANTS[id];
      if (v.rarity === 'common' || v.rarity === 'uncommon') pool.push(id);
    }
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)]!;
  }

  private spin() {
    if (this.spinFlash > 0 || this.bonusFlash > 0) return;
    // First roll guarantees a new variant — overrides one of the rolled IDs
    // below with a fresh common/uncommon the player doesn't own yet. We
    // track this on a dedicated lifetime counter so starter-slime acquires
    // (which bump `variant.timesRolled` too) don't cancel the guarantee.
    const firstEverRoll = this.lifetimeSpins === 0;
    this.lifetimeSpins++;
    this.spinDurationMax = this.effectiveSpinDuration();
    this.spinFlash = this.spinDurationMax;
    // Lucky Spins shop boost: each charge guarantees Rare-or-better via the
    // rarity floor and decrements here.
    if (this.boosts.luckySpinsLeft > 0) this.boosts.luckySpinsLeft--;
    // Quick Roll decrements after locking in the (already-halved) cooldown.
    // Big Dice consumes on roll (rarity floor was already read).
    if (this.quickRollChargesLeft > 0) this.quickRollChargesLeft--;
    // Every roll — manual or auto — mints 1 Roll currency. Rolls fund the
    // ECONOMY perks (cheaper spins, multi-roll, rarity floors), so autorolls
    // double as the passive progression engine.
    this.inventory.rolls += 1;

    // The main reel pre-decides whether to land on a slime or a bonus tile. If
    // bonus, the actual slime rolls happen during phase 2 (the second slot
    // machine that pops up alongside this one).
    const baseMul = this.effectiveRollMul();
    // First roll skips the bonus path so the new-variant guarantee always lands
    // through the normal reel. A bonus on the very first spin would be a fun
    // surprise but it'd swallow the "you found a new slime" beat.
    const bonusMul = firstEverRoll ? 1 : this.rollBonusMul();

    if (bonusMul === 1) {
      // Normal case: roll N slimes, feature the rarest in the main reel.
      const ids: SlimeVariantId[] = [];
      for (let i = 0; i < baseMul; i++) ids.push(this.rollOnce());
      // FTUE-friendly first roll: swap in a brand-new variant so the player
      // sees a discovery, not a duplicate green.
      if (firstEverRoll) {
        const fresh = this.pickFreshStarterVariant();
        if (fresh) ids[0] = fresh;
      }
      const rarityIdx = (id: SlimeVariantId) => RARITIES.indexOf(SLIME_VARIANTS[id].rarity);
      const featuredId = ids.reduce((acc, id) => (rarityIdx(id) > rarityIdx(acc) ? id : acc), ids[0]!);
      this.slotReel = this.buildReel({ kind: 'slime', id: featuredId });
      this.slotResultIdx = REEL_FILLER_BEFORE;
      this.slotScrollFloat = 0;
      this.pendingSpawn = { ids, bonusMul: 1, awaitingBonusReel: false };
    } else {
      // Bonus case: main reel lands on a BONUS tile. The slime rolls happen
      // when the bonus reel resolves, so we defer them.
      this.slotReel = this.buildReel({ kind: 'bonus', mul: bonusMul as 2 | 4 | 8 });
      this.slotResultIdx = REEL_FILLER_BEFORE;
      this.slotScrollFloat = 0;
      this.pendingSpawn = { ids: [], bonusMul, awaitingBonusReel: true };
    }
  }

  /** Construct a reel with N filler tiles before + the featured tile + M filler
   *  tiles after. Filler is mostly slimes with the occasional bonus marker so
   *  bonus tiles don't feel out-of-place when one actually lands. */
  private buildReel(featured: ReelTile): ReelTile[] {
    const filler = (): ReelTile => {
      // 1-in-15 filler is a random low-mul bonus to keep the player aware they exist.
      if (Math.random() < 1 / 15) {
        const muls: Array<2 | 4 | 8> = [2, 2, 2, 4, 8];
        return { kind: 'bonus', mul: muls[Math.floor(Math.random() * muls.length)]! };
      }
      const id = ALL_VARIANT_IDS[Math.floor(Math.random() * ALL_VARIANT_IDS.length)]!;
      return { kind: 'slime', id };
    };
    const reel: ReelTile[] = [];
    for (let i = 0; i < REEL_FILLER_BEFORE; i++) reel.push(filler());
    reel.push(featured);
    for (let i = 0; i < REEL_FILLER_AFTER; i++) reel.push(filler());
    return reel;
  }

  /** Kick off the second slot machine once the main reel has landed on a bonus.
   *  Rolls baseMul × bonusMul slime variants; reel features the rarest. */
  private startBonusReel(bonusMul: number) {
    const baseMul = this.effectiveRollMul();
    const total = baseMul * bonusMul;
    const ids: SlimeVariantId[] = [];
    for (let i = 0; i < total; i++) ids.push(this.rollOnce());
    const rarityIdx = (id: SlimeVariantId) => RARITIES.indexOf(SLIME_VARIANTS[id].rarity);
    const featuredId = ids.reduce((acc, id) => (rarityIdx(id) > rarityIdx(acc) ? id : acc), ids[0]!);
    this.bonusReel = this.buildReel({ kind: 'slime', id: featuredId });
    this.bonusResultIdx = REEL_FILLER_BEFORE;
    this.bonusScrollFloat = 0;
    this.bonusDurationMax = this.effectiveSpinDuration();
    this.bonusFlash = this.bonusDurationMax;
    this.pendingSpawn = { ids, bonusMul, awaitingBonusReel: false };
  }

  /** Scatter-style bonus check. 5% base chance per spin to trigger; when it
   *  does, weighted-pick a multiplier (×2 most common, ×4 less, ×8 ultra rare).
   *  Stacks multiplicatively with the always-on rollMul perk. */
  private rollBonusMul(): number {
    // Base 5% chance to enter bonus mode. Tree perks add additive % on top
    // (capped at 50% so the bonus reel never becomes the default outcome).
    let chance = 0.05;
    if (this.has('bonusChance1')) chance += 0.025;
    if (this.has('bonusChance2')) chance += 0.05;
    if (this.has('bonusChance3')) chance += 0.10;
    if (chance > 0.50) chance = 0.50;
    if (Math.random() >= chance) return 1;
    const r = Math.random();
    if (r < 0.05) return 8;
    if (r < 0.30) return 4;
    return 2;
  }

  /** One weighted draw using the current luck + rarity-floor perks. */
  private rollOnce(): SlimeVariantId {
    const luck = this.effectiveLuck();
    const minIdx = this.effectiveMinRarityIdx();
    const variants = Object.values(SLIME_VARIANTS);
    let total = 0;
    const weights: number[] = [];
    for (const v of variants) {
      const rarityIdx = RARITIES.indexOf(v.rarity);
      if (rarityIdx < minIdx) {
        weights.push(0);
        continue;
      }
      const divisor = RARITY_LUCK_DIVISOR[v.rarity];
      const luckMul = isFinite(divisor) ? 1 + luck / divisor : 1;
      const w = (1 / v.rollN) * luckMul;
      weights.push(w);
      total += w;
    }
    let pick = Math.random() * total;
    for (let i = 0; i < variants.length; i++) {
      if (pick < weights[i]!) return variants[i]!.id;
      pick -= weights[i]!;
    }
    return variants[0]!.id;
  }

  /** Build the projectile callback context. Centralizes the impact pipeline:
   *  apply damage of the appropriate type → roll for loot → handle lightning chain. */
  private makeProjectileCtx() {
    return {
      cliffLeft: this.mountain.x,
      cliffTop: this.mountain.topY,
      cliffBottom: this.mountain.bottomY,
      groundY: WORLD.groundY,
      applyHit: (x: number, y: number, dmg: number, type: DamageType, source: Projectile) => {
        if (!this.mountain.isInCombat()) return;
        this.applyImpact(x, y, dmg, type, source, /* allowChain */ true);
      },
      spawn: (p: Projectile) => this.projectiles.push(p),
      shake: (intensity: number) => this.mountain.applyShake?.(intensity),
      goons: this.goons,
    };
  }

  /** Apply a damage hit at (x, y) with the given type. `allowChain` is false for
   *  lightning's secondary chain to prevent infinite chains. `source` is null
   *  for player-avatar shots, which have no projectile entity. */
  private applyImpact(
    x: number,
    y: number,
    dmg: number,
    type: DamageType,
    source: Projectile | null,
    allowChain: boolean
  ) {
    // First, see if the hit landed on a goon/mine. They act as shields — they
    // take the hit instead of the mountain. Anti-goon projectiles double
    // damage; bosses additionally take BOSS_WEAKNESS_MUL× when the firing bee
    // is on the boss's weak list.
    for (const g of this.goons) {
      if (!g.alive) continue;
      if (g.containsPoint(x, y)) {
        let mul = source?.vsGoonMul ?? 1;
        if (g.kind === 'boss' && g.boss) {
          if (source?.variantId && g.boss.weakVariants.includes(source.variantId)) {
            mul *= BOSS_WEAKNESS_MUL;
          }
          // Player shots (source === null) match boss elemental weaknesses.
          if (source === null && g.boss.weakDamageTypes?.includes(type)) {
            mul *= BOSS_WEAKNESS_MUL;
          }
        }
        g.takeDamage(dmg * mul);
        // Same "always a small gold piece per hit" guarantee as the mountain —
        // chipping a den should feel like progress, not a wasted shot.
        const spawn = this.mountain.randomLootSpawn(y);
        this.loot.push(new Loot(spawn.x, spawn.y, SMALL_GOLD));
        return;
      }
    }
    this.mountain.takeDamage(dmg);
    if (type === 'burn') this.mountain.applyBurnAt(x, y, 1);
    if (type === 'frost') this.mountain.applyFrostAt(x, y, 3);
    if (type === 'lightning' && allowChain) {
      // Chain to a random other spot on the cliff (half damage, no further chain)
      const ty = this.mountain.topY + 20 + Math.random() * (this.mountain.bottomY - this.mountain.topY - 40);
      this.applyImpact(this.mountain.x + 4, ty, dmg * 0.5, 'physical', source, false);
    }
    // Loot drops scale with the impact damage.
    const chance = this.effectiveDropChancePerPoint();
    const heavyChance = this.effectiveHeavyDropChance();
    let drops = 0;
    const dmgPoints = Math.max(1, Math.ceil(dmg));
    for (let d = 0; d < dmgPoints; d++) {
      if (Math.random() < chance) drops++;
    }
    if (heavyChance > 0) {
      const base = drops;
      for (let d = 0; d < base; d++) {
        if (Math.random() < heavyChance) drops++;
      }
    }
    const gemChance = this.mountain.theme().gemChance;
    // Every impact guarantees one small gold piece — the player always feels
    // a hit produced something. Extra random drops layer on top.
    const guaranteedSpawn = this.mountain.randomLootSpawn(y);
    this.loot.push(new Loot(guaranteedSpawn.x, guaranteedSpawn.y, SMALL_GOLD));
    for (let i = 0; i < drops; i++) {
      const spec = pickMountainDrop(gemChance);
      const spawn = this.mountain.randomLootSpawn(y);
      this.loot.push(new Loot(spawn.x, spawn.y, spec));
    }
    // Food drops — XP feeders. Eject from the impact point like gold loot,
    // arc into the loot band, settle on the ground. Click-to-feed once landed.
    // Each kind requires its matching Unlock perk; locked kinds don't roll.
    if (this.foodDrops.length < 8) {
      const food = pickFoodDrop(this.allowedFoods());
      if (food) {
        const spawn = this.mountain.randomLootSpawn(y);
        this.foodDrops.push(new FoodDrop(spawn.x, spawn.y, food));
      }
    }
  }

  /** Set of food kinds the player has unlocked. Used to gate natural drops. */
  private allowedFoods(): Set<FoodKind> {
    const s: Set<FoodKind> = new Set();
    if (this.has('cheeseUnlock'))    s.add('cheese');
    if (this.has('eggUnlock'))       s.add('egg');
    if (this.has('drumstickUnlock')) s.add('drumstick');
    if (this.has('pizzaUnlock'))     s.add('pizza');
    return s;
  }

  /** Per-run gold cost to unlock the next mountain theme. `themesUnlocked`
   *  starts at 1 (Verdant), so the first call returns the cost of theme #1
   *  (Stone). Returns `null` once every theme has been unlocked. */
  private nextThemeCost(): number | null {
    const i = this.themesUnlocked;
    if (i >= MOUNTAIN_THEMES.length) return null;
    const COSTS = [150, 750, 3000, 12000, 45000, 180000];
    return COSTS[i - 1] ?? COSTS[COSTS.length - 1]!;
  }

  /** Name of the next theme the player can unlock, or null when maxed. */
  private nextThemeName(): string | null {
    const i = this.themesUnlocked;
    if (i >= MOUNTAIN_THEMES.length) return null;
    return MOUNTAIN_THEMES[i]!.name;
  }

  /** Advance the mountain after a kill — but only if the next theme is
   *  unlocked. If the next theme is gated, we respawn the current mountain
   *  instead so the player can keep grinding gold to afford the unlock.
   *  When the player has used the Next-Tree picker, we honor that choice
   *  instead of the natural progression. */
  private tryAdvanceMountain() {
    if (
      this.chosenNextTheme !== null &&
      this.chosenNextTheme >= 0 &&
      this.chosenNextTheme < this.themesUnlocked
    ) {
      const chosen = this.chosenNextTheme;
      const curCycle = this.mountain.cycle;
      const curThemeIdx = this.mountain.level % MOUNTAIN_THEMES.length;
      // If the player picked the current theme or one earlier in the order,
      // wrap to the next cycle (Mt. counter keeps moving forward).
      const nextCycle = chosen <= curThemeIdx ? curCycle + 1 : curCycle;
      this.mountain.cycle = nextCycle;
      this.mountain.level = chosen + nextCycle * MOUNTAIN_THEMES.length;
      this.mountain.maxHp = Math.floor(
        2400 * this.mountain.theme().hpMul * Math.pow(2, nextCycle),
      );
      this.mountain.hp = this.mountain.maxHp;
      this.mountain.effects = [];
      this.chosenNextTheme = null;
      return;
    }
    const nextLevel = this.mountain.level + 1;
    const nextThemeIdx = nextLevel % MOUNTAIN_THEMES.length;
    if (nextThemeIdx >= this.themesUnlocked) {
      // Locked — respawn current mountain at the same level + theme.
      this.mountain.hp = this.mountain.maxHp;
      this.mountain.effects = [];
    } else {
      this.mountain.advance();
    }
  }

  /** Screen rect of the "Unlock <next theme>" button. Sits centered above the
   *  mountain HP bar. Hidden (and thus returns null) once every theme is
   *  unlocked. */
  private themeUnlockBtnRect(): { x: number; y: number; w: number; h: number } | null {
    if (this.themesUnlocked >= MOUNTAIN_THEMES.length) return null;
    const w = 220;
    const h = 38;
    // Right-anchored above the mountain. The HP bar sits at topY-18 ≈ 92,
    // so we anchor near the very top of the canvas (matching the SETTINGS
    // button row) to keep the HP bar visible underneath.
    const x = WORLD.width - w - 18;
    const y = 14;
    return { x, y, w, h };
  }

  /** Hit-test for the unlock button. Returns false when no button is showing. */
  private themeUnlockBtnContains(px: number, py: number): boolean {
    const r = this.themeUnlockBtnRect();
    if (!r) return false;
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  /** Render the "Unlock <Stone> — N gold" button. Hidden once all themes are
   *  unlocked. Visually disabled (grayer) when the player can't afford it. */
  private drawThemeUnlockButton(ctx: CanvasRenderingContext2D) {
    const rect = this.themeUnlockBtnRect();
    if (!rect) return;
    const cost = this.nextThemeCost()!;
    const themeName = this.nextThemeName()!;
    const affordable = this.inventory.gold >= cost;
    const hovered = this.themeUnlockBtnHovered;
    ctx.save();
    // Background — darker when not affordable, lit gold when ready.
    ctx.fillStyle = affordable ? (hovered ? '#3a2810' : '#2a1e0a') : '#1a1820';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = affordable ? '#ffd24a' : '#4a4055';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
    // Pulse glow when affordable (mirrors the skill-tree notification dot vibe)
    if (affordable && !hovered) {
      const pulse = 0.4 + 0.2 * Math.sin(this.time * 5);
      ctx.shadowBlur = 12;
      ctx.shadowColor = `rgba(255, 210, 80, ${pulse})`;
      ctx.strokeStyle = `rgba(255, 210, 80, ${pulse})`;
      ctx.strokeRect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2);
      ctx.shadowBlur = 0;
    }
    // Two-line label: action up top, cost beneath.
    ctx.textAlign = 'center';
    ctx.fillStyle = affordable ? '#fff2b0' : '#7a6f88';
    ctx.font = '600 12px Inter Tight, sans-serif';
    ctx.fillText(`Unlock ${themeName}`, rect.x + rect.w / 2, rect.y + 16);
    ctx.font = '700 13px Inter Tight, sans-serif';
    ctx.fillStyle = affordable ? '#ffd24a' : '#665a72';
    ctx.fillText(`✦ ${cost.toLocaleString()} pollen`, rect.x + rect.w / 2, rect.y + 31);
    ctx.textAlign = 'start';
    ctx.restore();
  }

  /** Layout for the Next-Tree picker — a row of theme chips sitting under the
   *  unlock button. Each chip lets the player force the next tree to spawn
   *  as that theme. The leftmost "Auto" chip clears the override. Returns
   *  null when the player only has one theme (nothing to pick from). */
  private themePickerLayout(): {
    panel: { x: number; y: number; w: number; h: number };
    chips: Array<{ x: number; y: number; w: number; h: number; theme: number | null }>;
  } | null {
    if (this.themesUnlocked < 2) return null;
    const panelW = 220;
    const panelH = 34;
    // Anchor right below the unlock button when it's visible; otherwise tuck
    // up against the top so the picker still has a stable spot late-game.
    const unlock = this.themeUnlockBtnRect();
    const panelX = WORLD.width - panelW - 18;
    const panelY = unlock ? unlock.y + unlock.h + 6 : 14;
    // Auto chip + one chip per unlocked theme. Squeeze into panelW with even gaps.
    const slots = this.themesUnlocked + 1;
    const gap = 4;
    const innerPad = 6;
    const chipW = Math.floor((panelW - innerPad * 2 - gap * (slots - 1)) / slots);
    const chipH = panelH - 10;
    const chips: Array<{ x: number; y: number; w: number; h: number; theme: number | null }> = [];
    for (let i = 0; i < slots; i++) {
      const x = panelX + innerPad + i * (chipW + gap);
      const y = panelY + 5;
      const theme = i === 0 ? null : i - 1;
      chips.push({ x, y, w: chipW, h: chipH, theme });
    }
    return { panel: { x: panelX, y: panelY, w: panelW, h: panelH }, chips };
  }

  /** Render the Next-Tree picker chip strip. Highlights the active selection
   *  and shows a small "Next" caption above the row. */
  private drawThemePicker(ctx: CanvasRenderingContext2D) {
    const layout = this.themePickerLayout();
    if (!layout) return;
    const { panel, chips } = layout;
    ctx.save();
    ctx.fillStyle = 'rgba(20, 16, 32, 0.78)';
    ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
    ctx.strokeStyle = '#3a324a';
    ctx.lineWidth = 1;
    ctx.strokeRect(panel.x + 0.5, panel.y + 0.5, panel.w - 1, panel.h - 1);
    for (const chip of chips) {
      const isAuto = chip.theme === null;
      const selected =
        (isAuto && this.chosenNextTheme === null) ||
        (!isAuto && this.chosenNextTheme === chip.theme);
      const fill = isAuto ? '#3a324a' : MOUNTAIN_THEMES[chip.theme!]!.bodyGradMid;
      ctx.fillStyle = fill;
      ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
      ctx.strokeStyle = selected ? '#ffd24a' : '#1a1424';
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(chip.x + 0.5, chip.y + 0.5, chip.w - 1, chip.h - 1);
      if (isAuto) {
        ctx.textAlign = 'center';
        ctx.fillStyle = selected ? '#fff2b0' : '#bdb5cc';
        ctx.font = '700 10px Inter Tight, sans-serif';
        ctx.fillText('Auto', chip.x + chip.w / 2, chip.y + chip.h - 6);
        ctx.textAlign = 'start';
      }
    }
    ctx.restore();
  }

  /** Hit-test the chip strip; returns the selected theme (null = Auto) or
   *  undefined when the click missed every chip. */
  private themePickerHit(px: number, py: number): number | null | undefined {
    const layout = this.themePickerLayout();
    if (!layout) return undefined;
    for (const chip of layout.chips) {
      if (px >= chip.x && px <= chip.x + chip.w && py >= chip.y && py <= chip.y + chip.h) {
        return chip.theme;
      }
    }
    return undefined;
  }

  /** Screen rect for the player-shot damage-type chip. Sits near the spin
   *  reel along the bottom edge. Hidden when no elemental shots are unlocked. */
  private dmgTypeChipRect(): { x: number; y: number; w: number; h: number } | null {
    if (this.playerDmgTypeOptions().length <= 1) return null;
    const w = 110;
    const h = 26;
    return { x: 18, y: WORLD.height - h - 18, w, h };
  }

  /** Render the current player-shot damage type chip + Q-to-cycle hint. */
  private drawDmgTypeChip(ctx: CanvasRenderingContext2D) {
    const rect = this.dmgTypeChipRect();
    if (!rect) return;
    const type = this.currentPlayerDmgType();
    const colors: Record<DamageType, string> = {
      physical:  '#bdb5cc',
      burn:      '#ff6040',
      frost:     '#b0e8ff',
      lightning: '#a060ff',
      void:      '#a060ff',
    };
    const labels: Record<DamageType, string> = {
      physical:  'Physical',
      burn:      'Burn',
      frost:     'Frost',
      lightning: 'Storm',
      void:      'Void',
    };
    const accent = colors[type] ?? '#fff';
    ctx.save();
    ctx.fillStyle = 'rgba(20, 16, 32, 0.85)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
    // Color swatch
    ctx.fillStyle = accent;
    ctx.fillRect(rect.x + 6, rect.y + 6, 14, rect.h - 12);
    ctx.fillStyle = '#fff';
    ctx.font = '600 11px Inter Tight, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(labels[type] ?? type, rect.x + 26, rect.y + 13);
    ctx.fillStyle = '#9b94a8';
    ctx.font = '500 9px Inter Tight, sans-serif';
    ctx.fillText('Q to cycle', rect.x + 26, rect.y + 22);
    ctx.restore();
  }

  /** Hit-test for the damage-type chip. Returns true on hit so the click
   *  handler can rotate the type. */
  private dmgTypeChipContains(px: number, py: number): boolean {
    const r = this.dmgTypeChipRect();
    if (!r) return false;
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  /** Buy the next mountain-theme unlock if affordable. Called from the unlock
   *  button click handler. Returns true on success. */
  private buyNextThemeUnlock(): boolean {
    const cost = this.nextThemeCost();
    if (cost === null) return false;
    if (this.inventory.gold < cost) return false;
    this.inventory.gold -= cost;
    this.themesUnlocked++;
    this.toast = { text: `Unlocked ${MOUNTAIN_THEMES[this.themesUnlocked - 1]!.name}!`, t: 2.5 };
    return true;
  }

  /** Sum of `timesRolled` across the whole collection — FTUE step 5 watches
   *  this to detect "the player completed a roll." */
  private totalTimesRolled(): number {
    let n = 0;
    for (const v of this.collection.values()) n += v.timesRolled;
    return n;
  }

  /** Take a fresh snapshot for the *current* FTUE step. Called whenever we
   *  advance — captures the counters that the next step's completion test
   *  needs to diff against. */
  private snapshotFtue() {
    this.ftue.goldAtStepStart = this.inventory.gold;
    this.ftue.rollsAtStepStart = this.totalTimesRolled();
  }

  /** Advance the FTUE step if the player has just completed it. Called once
   *  per tick. Each branch matches the table in `ftue.ts`. */
  private updateFtue() {
    // The main-FTUE switch advances ftue.step; the rebirth-FTUE block below
    // it runs *every* tick (even after the main FTUE is done) so the rebirth
    // arrows can still be triggered.
    if (this.ftue.step > 0) switch (this.ftue.step) {
      case 1:
        if (this.spitterSlots.length >= 1) { this.ftue.step = 2; this.snapshotFtue(); }
        break;
      case 2:
        if (this.player.carried.length >= 1) { this.ftue.step = 3; this.snapshotFtue(); }
        break;
      case 3:
        if (this.player.carried.length === 0 && this.inventory.gold > this.ftue.goldAtStepStart) {
          this.ftue.step = 4;
          this.snapshotFtue();
        }
        break;
      case 4:
        if (this.has('runnerUnlock')) { this.ftue.step = 5; this.snapshotFtue(); }
        break;
      case 5:
        if (this.totalTimesRolled() > this.ftue.rollsAtStepStart) {
          this.ftue.step = 6;
          this.snapshotFtue();
        }
        break;
      case 6:
        if (this.runnerSlots.length >= 1) {
          this.ftue.step = 0;  // done!
          this.toast = { text: 'You’re off and running. Have fun!', t: 3 };
        }
        break;
    }
    // Secondary FTUE — the rebirth flow. Triggers the moment the player
    // earns their first rebirth (kills >= 1 mtn), regardless of where they
    // are in the main FTUE. With the first tree now so low-HP that it can
    // die during the basic loop tutorial, we want this beat to land as soon
    // as the player has access to rebirth — not after they finish step 6.
    if (this.ftueRebirthStep === 0 && this.rebirthUnlocked() && this.totalRebirths === 0) {
      this.ftueRebirthStep = 1;
      this.toast = { text: 'Rebirth is unlocked!', t: 3 };
    }
    if (this.ftueRebirthStep === 1 && this.totalRebirths >= 1) {
      this.ftueRebirthStep = 2;
    }
    if (this.ftueRebirthStep === 2 && this.essenceUnlocked.size >= 1) {
      this.ftueRebirthStep = 0;
      this.toast = { text: 'Meta-progression mastered. Good luck!', t: 3 };
    }
  }

  /** Grant XP to the named variant, leveling up any number of times if a big
   *  food (or chained feeds) pushes through multiple thresholds. */
  private addXpToVariant(variantId: SlimeVariantId, xp: number) {
    const v = this.collection.get(variantId);
    if (!v) return;
    v.xp += xp;
    let leveled = false;
    while (v.xp >= xpForNextLevel(v.level)) {
      v.xp -= xpForNextLevel(v.level);
      v.level++;
      leveled = true;
    }
    const name = SLIME_VARIANTS[variantId].name;
    if (leveled) {
      this.toast = { text: `${name} reached Lv ${v.level}!`, t: 2.5 };
    } else {
      this.toast = { text: `${name} +${xp} XP`, t: 1.8 };
    }
  }

  private resolveLootPairs() {
    const n = this.loot.length;
    for (let i = 0; i < n; i++) {
      const a = this.loot[i]!;
      if (a.collected || a.carriedBy !== null) continue;
      for (let j = i + 1; j < n; j++) {
        const b = this.loot[j]!;
        if (b.collected || b.carriedBy !== null) continue;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const sum = a.size + b.size;
        const d2 = dx * dx + dy * dy;
        if (d2 >= sum * sum) continue;
        let d = Math.sqrt(d2);
        if (d < 0.0001) {
          dx = 0.5;
          dy = 0;
          d = 0.5;
        }
        const nx = dx / d;
        const ny = dy / d;
        const overlap = sum - d;
        a.x -= nx * overlap * 0.5;
        a.y -= ny * overlap * 0.5;
        b.x += nx * overlap * 0.5;
        b.y += ny * overlap * 0.5;
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          const jimp = (-(1 + PAIR_RESTITUTION) * vn) / 2;
          a.vx -= jimp * nx;
          a.vy -= jimp * ny;
          b.vx += jimp * nx;
          b.vy += jimp * ny;
        }
        a.settled = false;
        b.settled = false;
        a.settleT = 0;
        b.settleT = 0;
      }
    }
  }

  update(dt: number) {
    // Re-clamp once per frame in case fusion or reclaim shrunk the collection
    // while scroll was at the right edge.
    this.collectionScroll = this.clampScroll(this.collectionScroll);

    // Speed up while autoplay is on by running multiple sub-ticks per frame,
    // each with the original dt. Keeps physics stable while letting the
    // viewer watch the AI progress quickly.
    const subSteps = this.autoplay ? AUTOPLAY_SPEED : 1;
    for (let step = 0; step < subSteps; step++) this.tick(dt);
  }

  private tick(dt: number) {
    this.time += dt;
    this.mountain.update(dt);
    this.updateFtue();

    // Discovery reveal — counts up; cleared when its duration elapses.
    if (this.discoveryReveal) {
      this.discoveryReveal.t += dt;
      if (this.discoveryReveal.t >= this.discoveryReveal.duration) {
        this.discoveryReveal = null;
      }
    }

    // Toast timer ticks regardless of overlay state.
    if (this.toast) {
      this.toast.t -= dt;
      if (this.toast.t <= 0) this.toast = null;
    }

    // Shop boost timers tick down. (Lucky Spins is charge-based, not timed.)
    if (this.boosts.serverLuck > 0) this.boosts.serverLuck = Math.max(0, this.boosts.serverLuck - dt);
    if (this.boosts.serverCoins > 0) this.boosts.serverCoins = Math.max(0, this.boosts.serverCoins - dt);

    // Auto-save every 10s of game time. Cheap — small JSON, no allocations beyond that.
    this.saveT += dt;
    if (this.saveT >= 10) {
      this.saveT = 0;
      this.save();
    }

    if (this.autoplay) {
      this.autoplayRunSec += dt;
      this.autoplayTickT += dt;
      if (this.autoplayTickT >= 0.15) {
        this.autoplayTickT = 0;
        this.runAutoplayTick();
      }
    } else {
      this.autoplayRunSec = 0;
    }

    const dmgMul = this.effectiveSpitterDmgMul();
    const globalCrit = this.effectiveGlobalCrit();
    const aura = this.playerAura();
    const auraRSq = aura ? aura.radius * aura.radius : 0;
    const runnerPerksBase = {
      speedMul: this.effectiveRunnerSpeedMul(),
      pickupMul: this.effectivePickupMul(),
      dropoffMul: this.effectiveDropoffMul(),
      carryBonus: this.effectiveCarryBonus(),
      globalCrit,
    };
    const goldMul = this.effectiveGoldMul();
    const gemMul = this.effectiveGemMul();
    for (const s of this.slimes) {
      // Per-variant shared level → damage / carry multiplier.
      const v = this.collection.get(s.variant.id);
      const tierMul = v ? levelMul(v.level) : 1;
      if (s.slotType === 'spitter') {
        if (this.mountain.isInCombat()) {
          // Aura buff applies when the bee is inside the player's radius. Both
          // damage and fire-rate multipliers stack with the global spitterDmgMul.
          let auraDmg = 1;
          let auraFireRate = 1;
          if (aura) {
            const dxP = s.x - this.player.x;
            const dyP = s.y - this.player.y;
            if (dxP * dxP + dyP * dyP <= auraRSq) {
              auraDmg = aura.dmgMul;
              auraFireRate = aura.fireRateMul;
            }
          }
          s.updateSpitter(
            dt,
            this.mountain.x,
            this.mountain.topY,
            this.mountain.bottomY,
            (p) => this.projectiles.push(p),
            dmgMul * tierMul * auraDmg,
            this.goons,
            globalCrit,
            auraFireRate
          );
        }
      } else {
        const sorter = s.variant.runnerAbility === 'sorter';
        s.updateRunner(
          dt,
          this.loot,
          WORLD.dropoffX,
          (l) => {
            const sorterBonus = sorter && l.shape === 'gem' ? 2 : 1;
            if (l.kind === 'gold') {
              const amt = l.value * goldMul * sorterBonus;
              this.inventory.gold += amt;
              this.runGoldEarned += amt;
            } else {
              this.inventory.gems += l.value * gemMul * sorterBonus;
            }
          },
          { ...runnerPerksBase, carryMul: tierMul }
        );
      }
    }

    // Auto-spin: perk unlocks the toggle, toggle gates the actual auto-roll.
    // We also wait for the reveal banner (spinResult) to finish so the player
    // actually gets to read which bee they just got before the next spin
    // starts. Without this gate the reel restarts the instant spinFlash hits
    // 0 and the result flashes by unread.
    if (
      this.effectiveAutoSpin() &&
      this.autoRoll &&
      this.spinFlash === 0 &&
      this.spinResult === null
    ) {
      this.spin();
    }

    // Projectile tick. Each projectile decides when/where to apply damage; the
    // ctx.applyHit callback funnels into our shared damage + loot pipeline.
    const ctx = this.makeProjectileCtx();
    // Snapshot the array so newly-spawned child projectiles (cluster / mortar)
    // don't update twice in the same frame.
    const snapshot = this.projectiles.slice();
    for (const p of snapshot) p.update(dt, ctx);
    this.projectiles = this.projectiles.filter((p) => p.alive);

    // Goon population control: while the mountain is in combat, spawn more
    // goons on the theme's interval up to its max. The moment the mountain
    // dies (or enters fall/rise animation), every goon and pending attack vanishes.
    if (!this.mountain.isInCombat()) {
      this.goons = [];
      this.goonAttacks = [];
    } else if (this.isTutorialTree()) {
      // Tutorial mountain stays peaceful — no spawns of any kind.
      this.goons = [];
      this.goonAttacks = [];
    } else {
      const theme = this.mountain.theme();
      // Goons (attacking dens) — capped count + spawn interval
      const aliveGoons = this.goons.filter((g) => g.kind === 'goon').length;
      if (aliveGoons < theme.maxGoons) {
        this.goonSpawnT -= dt;
        if (this.goonSpawnT <= 0) {
          this.spawnGoon();
          this.goonSpawnT = theme.goonSpawnInterval;
        }
      } else {
        this.goonSpawnT = theme.goonSpawnInterval;
      }
      // Mines (passive gem-income) — independent timer
      const aliveMines = this.goons.filter((g) => g.kind === 'mine').length;
      if (aliveMines < theme.maxMines) {
        this.mineSpawnT -= dt;
        if (this.mineSpawnT <= 0) {
          this.spawnMine();
          this.mineSpawnT = theme.mineSpawnInterval;
        }
      } else {
        this.mineSpawnT = theme.mineSpawnInterval;
      }
    }

    // Mountain goons: tick attacks. Each goon picks a random runner to fire at.
    const runners = this.slimes.filter((s) => s.slotType === 'runner');
    for (const goon of this.goons) {
      goon.update(
        dt,
        () => {
          if (runners.length === 0) return null;
          const r = runners[Math.floor(Math.random() * runners.length)]!;
          return { x: r.x, y: r.y - 10 };
        },
        (att) => this.goonAttacks.push(att)
      );
    }
    // Detect dying goons/mines before filtering them out. Goons drop a richer
    // mix than mountain hits; mines drop guaranteed gems + chunky gold.
    const dying = this.goons.filter((g) => !g.alive);
    for (const g of dying) {
      if (g.kind === 'boss') {
        if (g.fled) {
          // Timer expired — boss escapes. Show a consolation toast, no reward.
          // We still vent a small puff so the disappearance reads on screen.
          this.spawnSmokePuff(g.x, g.y, 12, 10);
          this.toast = { text: `${g.boss?.name ?? 'Boss'} fled — swap to its weakness next time!`, t: 3 };
        } else {
          // Player killed the boss in time — drop the bonus reward.
          this.awardBossReward(g);
        }
        continue;
      }
      if (g.kind === 'mine') {
        // 2 guaranteed gem currencies + 50% chance for a 3rd, plus 5-7 big
        // pieces from the mine table. This is the reliable gem-income pipe.
        const gemCount = 2 + (Math.random() < 0.5 ? 1 : 0);
        for (let i = 0; i < gemCount; i++) {
          const sx = g.x + (Math.random() - 0.5) * 14;
          const sy = g.y - Math.random() * 8;
          this.loot.push(new Loot(sx, sy, GEM_CURRENCY));
        }
        const bigCount = 5 + Math.floor(Math.random() * 3);
        for (let i = 0; i < bigCount; i++) {
          const spec = pickMineDrop();
          const sx = g.x + (Math.random() - 0.5) * 14;
          const sy = g.y - Math.random() * 8;
          this.loot.push(new Loot(sx, sy, spec));
        }
        this.spawnSmokePuff(g.x, g.y, 10, 8);
      } else {
        const count = 5 + Math.floor(Math.random() * 4); // 5-8 pieces
        const gemChance = this.mountain.theme().gemChance;
        for (let i = 0; i < count; i++) {
          const spec = pickGoonDrop(gemChance);
          const sx = g.x + (Math.random() - 0.5) * 12;
          const sy = g.y - Math.random() * 6;
          this.loot.push(new Loot(sx, sy, spec));
        }
        this.spawnSmokePuff(g.x, g.y, 5, 8);
      }
    }
    this.goons = this.goons.filter((g) => g.alive);

    // Goon attacks travel + hit runners with status.
    for (const att of this.goonAttacks) {
      att.update(dt, runners);
    }
    this.goonAttacks = this.goonAttacks.filter((a) => a.alive);

    // Cliff effect patches: tick burn DoT (mountain + nearby goons), and
    // freeze goons in any frost patch.
    for (const e of this.mountain.effects) {
      if (e.kind === 'burn' && this.mountain.alive()) {
        e.tickT -= dt;
        if (e.tickT <= 0) {
          e.tickT = 0.3;
          // Mountain damage proportional to stacks (per-tick).
          this.mountain.takeDamage(e.intensity * 1.4 * 0.3);
          // DoT chance to drop a small gold piece (per tick, per patch).
          // Scales with stacks so a hot patch trickles loot more reliably.
          const tickDropP = Math.min(0.6, 0.18 * e.intensity);
          if (Math.random() < tickDropP) {
            const spawn = this.mountain.randomLootSpawn(e.y);
            this.loot.push(new Loot(spawn.x, spawn.y, SMALL_GOLD));
          }
          // Damage + chance to drop gold for any goon within the patch radius.
          for (const g of this.goons) {
            if (!g.alive) continue;
            const dx = g.x - e.x;
            const dy = g.y - e.y;
            const r = e.radius + 16;
            if (dx * dx + dy * dy < r * r) {
              g.takeDamage(e.intensity * 1.2);
              if (Math.random() < tickDropP) {
                const spawn = this.mountain.randomLootSpawn(g.y);
                this.loot.push(new Loot(spawn.x, spawn.y, SMALL_GOLD));
              }
            }
          }
        }
      }
      if (e.kind === 'frost') {
        // Freeze any goon within radius — push their attack cooldown forward.
        for (const g of this.goons) {
          if (!g.alive) continue;
          const dx = g.x - e.x;
          const dy = g.y - e.y;
          const r = e.radius + 16;
          if (dx * dx + dy * dy < r * r) {
            g.attackCd = Math.max(g.attackCd, 0.3);
          }
        }
      }
    }

    for (const l of this.loot) l.applyGravity(dt);
    for (const l of this.loot) l.integrate(dt);
    for (let it = 0; it < PHYSICS_ITERATIONS; it++) {
      this.resolveLootPairs();
      for (const l of this.loot) l.clampToWorld();
    }
    for (const l of this.loot) l.checkSettle(dt);
    // Reclaim pass — runs the arc-tween on any loot the mountain is absorbing.
    for (const l of this.loot) l.updateReclaim(dt);

    // Player avatar — walks toward its click target, magnet-grabs any loot
    // within its pickup radius (up to a carry cap), then deposits the whole
    // stack when it walks through the dropoff pad. Same perk multipliers as
    // the slime runners (no sorter bonus — the avatar is generic).
    {
      const goldMul = this.effectiveGoldMul();
      const gemMul = this.effectiveGemMul();
      // Refresh perk-driven carry cap each frame so playerCarry1/2 picks up
      // the moment they're purchased mid-run.
      this.player.carryBonus = this.effectivePlayerCarryBonus();
      this.player.speedMul = this.effectivePlayerSpeedMul();
      this.player.update(dt, this.loot, (l) => {
        if (l.kind === 'gold') {
          const amt = l.value * goldMul;
          this.inventory.gold += amt;
          this.runGoldEarned += amt;
        } else {
          this.inventory.gems += l.value * gemMul;
        }
      });
    }

    // Trigger reclaims when the floor pile overflows. Picks the loot closest
    // to the mountain (highest x) since the mountain is "sucking back" what's
    // in reach. Skips runner-claimed or carried pieces.
    const floorEligible = this.loot.filter(
      (l) =>
        !l.collected && l.carriedBy === null && l.claimedBy === null && !l.reclaiming
    );
    const cap = MAX_FLOOR_LOOT + this.effectiveFloorMaxBonus();
    if (floorEligible.length > cap) {
      this.reclaimT -= dt;
      if (this.reclaimT <= 0) {
        this.reclaimT = RECLAIM_INTERVAL * this.effectiveReclaimSlowMul();
        // Burst-reclaim when severely over the cap. 1 piece at slight overflow,
        // up to 8 pieces per tick when the pile is way over — caps entity
        // accumulation without blowing out the animation budget.
        const overflow = floorEligible.length - cap;
        const batch = Math.min(8, Math.max(1, Math.ceil(overflow / 8)));
        // Sort by x desc so we always grab the pieces closest to the mountain.
        floorEligible.sort((a, b) => b.x - a.x);
        for (let i = 0; i < batch && i < floorEligible.length; i++) {
          const target = floorEligible[i]!;
          const tx = this.mountain.x + 4 + Math.random() * 8;
          const ty =
            this.mountain.topY +
            30 +
            Math.random() * (this.mountain.bottomY - this.mountain.topY - 60);
          target.startReclaim(tx, ty);
        }
      }
    } else {
      this.reclaimT = 0;
    }
    this.loot = this.loot.filter((l) => !l.collected);

    // Food drops use the same physics pipeline as gold loot — fall, settle in
    // the loot band, stay put until clicked. They never get carried.
    for (const f of this.foodDrops) {
      f.applyGravity(dt);
      f.integrate(dt);
      f.clampToWorld();
      f.checkSettle(dt);
      f.update(dt);
    }
    this.foodDrops = this.foodDrops.filter((f) => !f.collected);

    // Mountain death state machine: alive → falling → rising → alive.
    if (!this.mountain.alive() && this.mountain.phase === 'alive') {
      // Just died — kick off the fall, big shake + smoke burst.
      this.mountain.startFalling();
      // Food belongs to the cliff that just collapsed — clear it so the new
      // mountain rises clean.
      this.foodDrops = [];
      this.screenShake = 1.0;
      this.spawnSmokePuff(this.mountain.x + 30, this.mountain.bottomY - 10, 20, 14);
      // Prestige drip + lifetime stats. mountain.level is the index of the
      // mountain that just died (0 = Verdant), so payout scales with depth.
      // Mountain-kill essence is deferred: lands in pendingEssence and only
      // becomes spendable when the player rebirths. Pushes the player to
      // actually commit to a rebirth rather than nibbling at the tree.
      const essenceDrop = 1 + this.mountain.level;
      this.pendingEssence += essenceDrop;
      this.runMountainsKilled++;
      this.totalMountainsKilled++;
    }
    if (this.mountain.phase === 'falling') {
      // Smoke billows continuously while it sinks.
      if (Math.random() < 0.55) {
        this.spawnSmokePuff(
          this.mountain.x + Math.random() * 60,
          this.mountain.bottomY - 10 + Math.random() * 20,
          2,
          10
        );
      }
      if (this.mountain.phaseT >= FALL_DURATION) {
        this.tryAdvanceMountain();
        this.mountain.startRising();
        this.screenShake = Math.max(this.screenShake, 0.6);
        this.spawnSmokePuff(this.mountain.x + 30, this.mountain.bottomY - 10, 18, 12);
      }
    }
    if (this.mountain.phase === 'rising') {
      if (Math.random() < 0.3) {
        this.spawnSmokePuff(
          this.mountain.x + Math.random() * 60,
          this.mountain.bottomY - 4,
          1,
          8
        );
      }
      if (this.mountain.phaseT >= RISE_DURATION) {
        this.mountain.finishRising();
        this.screenShake = Math.max(this.screenShake, 0.3);
        this.spawnGoons();
      }
    }

    // Decay screen shake + update smoke
    if (this.screenShake > 0) this.screenShake = Math.max(0, this.screenShake - dt * 1.8);
    for (const p of this.smoke) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 30 * dt;          // light drag back down
      p.vx *= 1 - 0.6 * dt;
      p.age += dt;
    }
    this.smoke = this.smoke.filter((p) => p.age < p.life);

    // The spin animation IS the cooldown — there's no separate rate-limit
    // window. The reel scrolls at a CONSTANT velocity for the bulk of the
    // duration, then decelerates over `REEL_SETTLE_DURATION` at the end to
    // land on the result. Shorter spins (cheaperSpin perks) trim the
    // constant phase first; the settle stays the same so every roll still
    // reads as "spin → land". The settle is clamped to never exceed 40%
    // of the total duration, so very short spins still get *some* high-
    // speed phase rather than a pure decelerating crawl.
    if (this.spinFlash > 0) {
      this.spinFlash = Math.max(0, this.spinFlash - dt);
      const total = this.spinDurationMax;
      const settle = Math.min(REEL_SETTLE_DURATION, total * 0.4);
      const constDur = Math.max(0.0001, total - settle);
      const elapsed = total - this.spinFlash;
      const targetIdx = this.slotResultIdx;
      if (elapsed < constDur) {
        // Linear ramp through CONST_FRACTION of the scroll.
        const frac = elapsed / constDur;
        this.slotScrollFloat = frac * REEL_CONST_FRACTION * targetIdx;
      } else {
        // Settle: ease-out cubic across the remaining (1 - CONST_FRACTION).
        const settleT = settle > 0 ? (elapsed - constDur) / settle : 1;
        const eased = 1 - Math.pow(1 - settleT, 3);
        this.slotScrollFloat = (REEL_CONST_FRACTION + eased * (1 - REEL_CONST_FRACTION)) * targetIdx;
      }
      if (this.spinFlash === 0 && this.pendingSpawn) {
        if (this.pendingSpawn.awaitingBonusReel) {
          // Main reel landed on bonus — kick off the second slot machine.
          this.startBonusReel(this.pendingSpawn.bonusMul);
        } else {
          this.resolveSpawn();
        }
      }
    }
    if (this.bonusFlash > 0) {
      this.bonusFlash = Math.max(0, this.bonusFlash - dt);
      const progress = this.bonusDurationMax > 0 ? 1 - this.bonusFlash / this.bonusDurationMax : 1;
      const eased = 1 - Math.pow(1 - progress, 3);
      this.bonusScrollFloat = eased * this.bonusResultIdx;
      if (this.bonusFlash === 0 && this.pendingSpawn) {
        this.resolveSpawn();
      }
    }
    if (this.spinResult) {
      this.spinResult.t -= dt;
      if (this.spinResult.t <= 0) this.spinResult = null;
    }
  }

  /** Final spin resolution — acquire all pending slimes and flash the reveal
   *  banner. Called when the main reel finishes (no bonus) or after the bonus
   *  reel finishes. */
  private resolveSpawn() {
    if (!this.pendingSpawn) return;
    const ids = this.pendingSpawn.ids;
    for (const id of ids) this.acquireSlime(id);
    const rarityIdx = (id: SlimeVariantId) => RARITIES.indexOf(SLIME_VARIANTS[id].rarity);
    const featuredId = ids.reduce((acc, id) => (rarityIdx(id) > rarityIdx(acc) ? id : acc), ids[0]!);
    this.spinResult = {
      id: featuredId,
      count: ids.length,
      bonusMul: this.pendingSpawn.bonusMul,
      // Holds the reveal banner on screen for this many seconds. Auto-roll
      // waits for it to expire before kicking off the next spin, so the
      // player gets a clear "here's what you got" beat between rolls.
      t: 3.5,
    };
    this.dieFace = RARITY_FACE[SLIME_VARIANTS[featuredId].rarity];
    this.pendingSpawn = null;
  }

  /** One AI step: auto-spin, auto-slot, auto-fuse, auto-unlock cheapest reachable
   *  perk. Same shape as scripts/autoplay.mjs so behavior matches the headless
   *  balance simulator. Toggle from the on-screen button or 'A' key. */
  private runAutoplayTick() {
    // 1) Always roll the moment the reel is idle.
    if (this.spinFlash === 0) {
      this.spin();
    }

    // 2) Auto-slot any unslotted collection slime. Early game (first mountain)
    //    we prefer runners — they convert pile-up gold into income, which is
    //    the main bottleneck before any perks land. After the first mountain
    //    falls, switch to spitter-first so damage output ramps up.
    const preferRunner = this.mountain.level === 0;
    for (const v of this.collection.values()) {
      while (v.count - v.slotted > 0) {
        const spitterRoom = this.spitterSlots.length < this.effectiveSpitterLimit();
        const runnerRoom = this.runnerSlots.length < this.effectiveRunnerLimit();
        const slot: SlotType | null = preferRunner
          ? runnerRoom ? 'runner' : spitterRoom ? 'spitter' : null
          : spitterRoom ? 'spitter' : runnerRoom ? 'runner' : null;
        if (!slot) break;
        if (!this.assignToSlot(v.variantId, slot)) break;
      }
    }

    // 2.5) Equip-best — swap inferior slotted slimes out for stronger bench ones.
    this.equipBest();

    // 3) Auto-unlock the cheapest reachable, affordable perk (gems weighted
    //    ~10× gold). Respects the FTUE gate — during onboarding only the
    //    spotlighted node (`runnerUnlock`) is considered, mirroring the same
    //    rule `tryUnlock` enforces. Without this gate the AI repeatedly
    //    tried to buy non-spotlighted nodes and tryUnlock silently refused,
    //    so the skill tree never progressed mid-FTUE.
    let bestNode: SkillNode | null = null;
    let bestCost = Infinity;
    for (const node of SKILL_TREE) {
      if (node.branch === 'root') continue;
      if (this.unlockedPerks.has(node.id) && !node.repeatable) continue;
      if (this.ftue.step > 0 && node.id !== 'runnerUnlock') continue;
      if (!isUnlockable(node, this.unlockedPerks, this.inventory)) continue;
      const cost = (node.costGold ?? 0) + (node.costGems ?? 0) * 10 + (node.costRolls ?? 0) * 3;
      if (cost < bestCost) {
        bestCost = cost;
        bestNode = node;
      }
    }
    if (bestNode) this.tryUnlock(bestNode);

    // 3.5) Auto-unlock cheapest reachable Rebirth Tree node.
    let bestEssence: { id: EssenceId; cost: number } | null = null;
    for (const node of ESSENCE_TREE) {
      if (this.essenceUnlocked.has(node.id)) continue;
      if (!essenceUnlockable(node, this.essenceUnlocked, this.inventory)) continue;
      if (!bestEssence || node.cost < bestEssence.cost) {
        bestEssence = { id: node.id, cost: node.cost };
      }
    }
    if (bestEssence) this.tryUnlockEssence(bestEssence.id);

    // 4) Drive the player avatar. The avatar AI picks among three behaviors
    //    based on current state:
    //      a) carry full          → walk to dropoff to deposit
    //      b) shootUnlock + cd 0  → click the nearest mine / cliff to chip HP
    //      c) any free floor loot → walk to the nearest piece
    //      d) (fallback)          → drift toward the loot field center
    //    Each branch sets `player.targetX` so the existing player.update path
    //    handles motion + magnet pickup naturally.
    this.runAvatarAutoplay();

    // 5) Rebirth + theme-unlock automation. `rebirthUnlocked()` is gated on
    //    LIFETIME mountains killed, so after the first kill it stays true
    //    forever — without an extra per-run check the AI would call
    //    rebirth() every 0.15s, wiping in-flight projectiles and resetting
    //    the mountain mid-fight. Require at least one mountain killed THIS
    //    run before rebirthing.
    if (this.rebirthUnlocked() && this.runMountainsKilled >= 1) {
      this.rebirth();
      // After rebirth the auto-opened rebirth tree would freeze further input.
      // Close it so subsequent autoplay ticks can keep doing things.
      this.showEssenceTree = false;
      return;
    }
    if (this.nextThemeCost() !== null && this.inventory.gold >= this.nextThemeCost()! * 2) {
      this.buyNextThemeUnlock();
    }

    // 6) Claim any pending Bag O Bees milestone.
    if (this.pendingMilestones.size > 0) {
      const lowest = Math.min(...this.pendingMilestones);
      this.claimMilestone(lowest);
    }
  }

  /** Avatar autoplay — moves the player around the field collecting loot,
   *  depositing at the dropoff, and shooting the cliff / boss if the
   *  `shootUnlock` perk is owned. Walk targets are LOCKED once chosen so the
   *  AI doesn't oscillate by re-picking "nearest loot" every tick — only
   *  changes direction when the avatar arrives (targetX === null) or the
   *  carry becomes full and forces a dropoff trip. */
  private runAvatarAutoplay() {
    // Carry full → head to dropoff (override any current target).
    if (this.player.full) {
      this.player.setTarget(WORLD.dropoffX, WORLD.groundY);
      // Fall through so we can still shoot during the walk back.
    }
    // Shoot priority (highest → lowest):
    //   1. Boss — limited-time, fleeing on timer, so blast it ASAP.
    //   2. Mountain cliff — the win condition; the spitter swarm + the player
    //      should both be funneling damage into the tree.
    //   3. (mines are no longer auto-targeted — they were absorbing shots
    //       intended for the tree, making the cliff feel un-hittable.)
    //
    // The aim point for the cliff stays roughly fixed mid-face so the shots
    // don't constantly flit around — fewer visual jumps and a higher chance
    // of the projectile path being clear of stray mines.
    if (this.has('shootUnlock') && this.mountain.isInCombat() && this.player.shootCooldownT <= 0) {
      const aliveBosses = this.goons.filter((g) => g.alive && g.kind === 'boss');
      let tx: number;
      let ty: number;
      if (aliveBosses.length > 0) {
        const b = aliveBosses[0]!;
        tx = b.x;
        ty = b.y;
      } else {
        // Aim at a stable mid-cliff point with slight per-shot jitter so the
        // hit flash spreads instead of stacking on one pixel.
        tx = this.mountain.x + 6;
        ty = this.mountain.topY + (this.mountain.bottomY - this.mountain.topY) * 0.5
          + (Math.random() - 0.5) * 30;
      }
      if (this.player.tryShoot(tx, ty)) {
        const type = this.currentPlayerDmgType();
        this.applyImpact(tx, ty, this.effectivePlayerShotDmg(), type, null, type === 'lightning');
      }
    }
    // Movement re-target only fires when the avatar has actually arrived
    // (targetX===null) — otherwise let the existing walk finish so we don't
    // oscillate every 0.15s.
    if (this.player.targetX !== null) return;
    // Walk to the nearest floor loot if any.
    let nearest: Loot | null = null;
    let bestD = Infinity;
    for (const l of this.loot) {
      if (l.collected || l.carriedBy !== null || l.claimedBy !== null || l.reclaiming) continue;
      const d = Math.abs(l.x - this.player.x);
      if (d < bestD) { bestD = d; nearest = l; }
    }
    if (nearest) {
      this.player.setTarget(nearest.x, WORLD.groundY);
      return;
    }
    // No loot in sight — sit halfway between the dropoff and the cliff so
    // the next spawn lands closer to the avatar.
    this.player.setTarget((WORLD.dropoffX + this.mountain.x) / 2, WORLD.groundY);
  }


  private hudState(): HudState {
    return {
      inv: this.inventory,
      hoveredSpin: this.hoveredSpin,
      canSpin: this.spinFlash === 0 && this.bonusFlash === 0,
      spinCooldown: Math.max(this.spinFlash, this.bonusFlash),
      spinCooldownMax: this.spinDurationMax,
      spinning: this.spinFlash > 0,
      spinResult: this.spinResult,
      dieFace: this.dieFace,
      dieAngle: this.dieAngle,
      slotReel: this.slotReel,
      slotScrollFloat: this.slotScrollFloat,
      bonusReel: this.bonusReel,
      bonusScrollFloat: this.bonusScrollFloat,
      bonusActive: this.bonusFlash > 0,
      // Sort by timesRolled desc so the most-rolled variants appear first.
      // Within a tie, newer acquisitions sort lower — Map preserves insertion order.
      collection: [...this.collection.values()].sort((a, b) => b.timesRolled - a.timesRolled),
      spitterSlots: this.spitterSlots,
      runnerSlots: this.runnerSlots,
      selectedVariantId: this.selectedVariantId,
      collectionScroll: this.collectionScroll,
      luck: this.effectiveLuck(),
      pendingEssence: this.pendingEssence,
      rebirthUnlocked: this.rebirthUnlocked(),
      rebirthPreview: this.rebirthPreview(),
      rebirthHovered: this.rebirthHovered,
      rebirthModalOpen: this.rebirthModalOpen,
    };
  }

  render(ctx: CanvasRenderingContext2D) {
    const w = WORLD.width;
    const h = WORLD.height;
    const groundY = WORLD.groundY;

    const theme = this.mountain.theme();
    const sky = ctx.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, theme.skyTop);
    sky.addColorStop(1, theme.skyBottom);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, groundY);

    // World layer is shaken when the mountain dies; HUD stays steady.
    ctx.save();
    if (this.screenShake > 0) {
      const s = this.screenShake;
      ctx.translate((Math.random() - 0.5) * 12 * s, (Math.random() - 0.5) * 12 * s);
    }

    ctx.fillStyle = theme.bgRidge;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w * 0.18, groundY - 100);
    ctx.lineTo(w * 0.34, groundY - 40);
    ctx.lineTo(w * 0.5, groundY - 120);
    ctx.lineTo(w * 0.66, groundY - 50);
    ctx.lineTo(w, groundY);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#1d2a1f';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = '#243a27';
    ctx.fillRect(0, groundY, w, 6);

    // dropoff pad
    ctx.fillStyle = 'rgba(90, 240, 255, 0.08)';
    ctx.fillRect(WORLD.dropoffX - WORLD.dropoffWidth / 2, groundY - 4, WORLD.dropoffWidth, 4);
    ctx.strokeStyle = 'rgba(90, 240, 255, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(WORLD.dropoffX - WORLD.dropoffWidth / 2, groundY - 4);
    ctx.lineTo(WORLD.dropoffX + WORLD.dropoffWidth / 2, groundY - 4);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#5af0ff99';
    ctx.font = '10px Inter Tight, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DROPOFF', WORLD.dropoffX, groundY - 10);

    // Slot zone labels
    ctx.fillStyle = '#ff8c5a99';
    ctx.fillText('SPITTERS', WORLD.spitterX, groundY - 10);
    ctx.textAlign = 'start';

    this.mountain.render(ctx);

    // Mountain goons embedded in the cliff face
    for (const goon of this.goons) goon.render(ctx);
    for (const att of this.goonAttacks) att.render(ctx);

    for (const l of this.loot) {
      if (l.carriedBy !== null) continue;
      l.render(ctx);
    }

    // Food drops are rendered with the loot pile (they share the loot band).
    for (const f of this.foodDrops) f.render(ctx);

    for (const p of this.projectiles) p.render(ctx);

    // Slime stack (filled slots)
    const sorted = [...this.slimes].sort((a, b) => b.y - a.y);
    for (const s of sorted) s.render(ctx, this.selectedVariantId === s.variant.id);

    // Bee Aura ring — soft glow drawn UNDER the player and bees so it reads
    // as a ground halo, not a sprite outline.
    const auraDraw = this.playerAura();
    if (auraDraw) {
      ctx.save();
      const cx = this.player.x;
      const cy = this.player.y - 14;
      const grad = ctx.createRadialGradient(cx, cy, auraDraw.radius * 0.2, cx, cy, auraDraw.radius);
      grad.addColorStop(0,   'rgba(120, 220, 255, 0.18)');
      grad.addColorStop(0.7, 'rgba(120, 220, 255, 0.08)');
      grad.addColorStop(1,   'rgba(120, 220, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, auraDraw.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150, 230, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, auraDraw.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Player avatar — drawn after slimes so it visually overlaps when they meet.
    this.player.draw(ctx);

    // Empty slot ghosts
    const geoms = this.computeSlotGeoms();
    const hasSelection = this.selectedVariantId !== null;
    for (const g of geoms) {
      if (g.occupied) continue;
      drawSlotGhost(ctx, g.x, g.y, g.size, g.type, hasSelection);
    }

    // Smoke particles (drawn over everything in the world layer)
    for (const p of this.smoke) {
      const t = p.age / p.life;
      const a = (1 - t) * 0.6;
      const r = p.size * (1 + t * 0.6);
      const grd = ctx.createRadialGradient(p.x, p.y, 1, p.x, p.y, r);
      grd.addColorStop(0, `rgba(180, 170, 160, ${a})`);
      grd.addColorStop(0.6, `rgba(110, 100, 95, ${a * 0.7})`);
      grd.addColorStop(1, `rgba(60, 55, 50, 0)`);
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // End world layer (shake transform).
    ctx.restore();

    drawHUD(ctx, this.hudState());

    // Boss bee banner — sits below the SETTINGS row so it doesn't cover the
    // dice cluster. Skipped when an overlay is open so the modal UI owns the
    // screen.
    const liveBoss = this.goons.find((g) => g.kind === 'boss' && g.alive);
    const overlayOpenForBoss = this.showTree || this.showEssenceTree || this.showShop || this.showSettings || this.showIndex || this.showCraft;
    if (liveBoss && liveBoss.boss && !overlayOpenForBoss) {
      const boss = liveBoss.boss;
      drawBossBanner(
        ctx,
        {
          name: boss.name,
          hpFrac: liveBoss.hp / liveBoss.maxHp,
          timeLeft: liveBoss.timeLeft,
          timeLimit: boss.timeLimit,
          weaknessLabel: boss.weaknessLabel,
          accentColor: boss.accentColor,
        },
        this.time,
      );
    }

    // HUD buttons only when no overlay is open — overlays are modal "top UI"
    // and should cover the underlying buttons / dice / counters.
    const overlayOpen = this.showTree || this.showEssenceTree || this.showShop || this.showSettings || this.showIndex || this.showCraft;
    if (!overlayOpen) {
      drawSettingsButton(ctx, this.settingsBtnHovered, false, this.time);
      drawTreeButton(ctx, this.hoveredTreeBtn, false, this.time, this.affordableSkillTreeCount());
      drawRebirthButton(ctx, this.hudState(), this.time);
      // Rebirth Tree button hides until the player has rebirthed once — the
      // meta currency it spends doesn't exist before that, so the icon would
      // just be confusing on the early-game HUD.
      if (this.totalRebirths > 0) {
        drawEssenceTreeButton(ctx, this.essenceTreeBtnHovered, false, this.time);
      }
      // Craft button — only after the `craft1` essence node is bought.
      if (this.hasE('craft1')) {
        drawCraftButton(ctx, this.craftBtnHovered, false, this.time);
      }
      drawShopButton(ctx, this.shopBtnHovered, false, this.time);
      drawIndexButton(ctx, this.indexBtnHovered, false, this.time, this.pendingMilestones.size);
      // "Unlock <theme>" button above the mountain — only shown while there's
      // still a theme to unlock. Cost grows per theme; resets every rebirth.
      this.drawThemeUnlockButton(ctx);
      // Next-Tree picker — appears once the player has 2+ themes unlocked.
      this.drawThemePicker(ctx);
      // Player shot damage-type chip — appears once any elemental shot perk is owned.
      this.drawDmgTypeChip(ctx);
    }

    // Spin reel / idle die. The AutoRoll badge wants to render ABOVE the
    // idle dice but BEHIND the spinning reel — so when the reel's spinning
    // we draw AutoRoll first (and the reel covers it), and when the dice is
    // idle we draw AutoRoll second (so it sits on top of the dice).
    const overlayOpenForAuto = this.showTree || this.showEssenceTree || this.showShop || this.showSettings || this.showIndex || this.showCraft;
    const spinningReel = this.spinFlash > 0;
    if (spinningReel && !overlayOpenForAuto) {
      drawAutoRollButton(ctx, this.has('autoSpin'), this.autoRoll, this.autoRollBtnHovered, this.time);
    }
    drawSpinReelOrDie(ctx, this.hudState());
    if (!spinningReel && !overlayOpenForAuto) {
      drawAutoRollButton(ctx, this.has('autoSpin'), this.autoRoll, this.autoRollBtnHovered, this.time);
    }

    // Overlays render LAST (above HUD + buttons) so they're the dominant UI.
    if (this.showTree) {
      drawSkillTreeOverlay(
        ctx,
        this.unlockedPerks,
        this.inventory,
        this.hoveredHex,
        this.treePanX,
        this.treePanY,
        this.treeZoom,
        this.treeCloseHovered,
      );
    }
    if (this.showEssenceTree) {
      drawEssenceTreeOverlay(ctx, this.essenceUnlocked, this.inventory, this.hoveredEssenceNode, this.essenceCloseHovered);
    }
    if (this.showShop) {
      drawShopOverlay(ctx, this.ownedShopItems, this.hoveredShopItem, this.shopCloseHovered);
    }
    if (this.showSettings) {
      drawSettingsOverlay(
        ctx,
        this.autoplay,
        this.settingsCloseHovered,
        this.settingsAutoplayHovered,
        this.settingsCheatHovered,
        this.settingsResetHovered,
      );
    }
    if (this.showIndex) {
      drawIndexOverlay(
        ctx,
        this.collection,
        this.claimedMilestones,
        this.pendingMilestones,
        this.indexScroll,
        this.time,
        this.indexCloseHovered,
        this.bagProgress,
      );
    }
    if (this.showCraft) {
      drawCraftOverlay(ctx, {
        collection: this.collection,
        selectedRarity: this.craftSelectedRarity,
        selectedVariantId: this.craftSelectedVariantId,
        hoveredVariantId: this.hoveredCraftVariantId,
        fuseHovered: this.craftFuseHovered,
        closeHovered: this.craftCloseHovered,
      });
    }

    // Toast bubble — fades out after a few seconds.
    if (this.toast && this.toast.t > 0) {
      const alpha = Math.min(1, this.toast.t);
      ctx.save();
      ctx.globalAlpha = alpha;
      const text = this.toast.text;
      ctx.font = '700 14px system-ui, sans-serif';
      const tw = ctx.measureText(text).width + 32;
      const tx = Math.round((WORLD.width - tw) / 2);
      const ty = 96;
      ctx.fillStyle = 'rgba(20, 24, 32, 0.92)';
      ctx.fillRect(tx, ty, tw, 30);
      ctx.strokeStyle = '#7fe39d';
      ctx.lineWidth = 2;
      ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 29);
      ctx.fillStyle = '#f0f4f8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, tx + tw / 2, ty + 15);
      ctx.restore();
    }

    // Modals sit on top of EVERYTHING when open.
    if (this.rebirthModalOpen) drawRebirthModal(ctx, this.hudState());
    if (this.pendingShopItem) drawShopPurchaseModal(ctx, this.pendingShopItem);
    if (this.resetModalOpen) drawResetModal(ctx);

    // New-variant celebration plays above every other layer (incl. modals).
    if (this.discoveryReveal) drawDiscoveryReveal(ctx, this.discoveryReveal);

    // FTUE arrows render above the HUD but below modals/discovery so they
    // never block a celebration or a confirm dialog.
    this.drawFtueArrows(ctx);
  }

  /** Draw a bouncing chevron + label at each target location for the current
   *  FTUE step. Different steps point at different UI elements; some steps
   *  show two arrows when the player needs to chain two clicks (e.g. select
   *  a bench slime, then click the empty slot). */
  private drawFtueArrows(ctx: CanvasRenderingContext2D) {
    // Skip ONLY if BOTH FTUEs are inactive — the rebirth FTUE arrows live
    // below this switch and need to render even when the main FTUE is done.
    if (this.ftue.step <= 0 && this.ftueRebirthStep <= 0) return;
    const targets: { x: number; y: number; label: string; from: 'above' | 'below' }[] = [];
    if (this.ftue.step > 0) switch (this.ftue.step) {
      case 1: {
        // Two arrows: one over the green slime on the bench (so the player
        // selects it), one over the empty spitter slot ghost.
        if (this.selectedVariantId !== 'green') {
          const cellRect = collectionCellRect(this.hudState(), 0);
          targets.push({
            x: cellRect.x + cellRect.w / 2,
            y: cellRect.y,
            label: '1. Pick your bee',
            from: 'above',
          });
        }
        const slot = this.computeSlotGeoms().find((g) => g.type === 'spitter' && !g.occupied);
        if (slot) {
          targets.push({
            x: slot.x,
            y: slot.y - slot.size * 2.2,
            label: this.selectedVariantId === 'green' ? '1. Drop it in the spitter slot' : 'then assign to spitter',
            from: 'above',
          });
        }
        break;
      }
      case 2: {
        // Point at the leftmost piece of floor loot (or the middle of the
        // play area if nothing's dropped yet) — "click the ground to walk".
        const piece = this.loot.find(
          (l) => !l.collected && l.carriedBy === null && l.claimedBy === null && !l.reclaiming,
        );
        if (piece) {
          targets.push({ x: piece.x, y: piece.y - 30, label: '2. Walk over the pollen', from: 'above' });
        } else {
          targets.push({
            x: WORLD.width / 2,
            y: WORLD.groundY - 60,
            label: '2. Wait for pollen to drop, then click it',
            from: 'above',
          });
        }
        break;
      }
      case 3: {
        targets.push({
          x: WORLD.dropoffX,
          y: WORLD.groundY - 36,
          label: '3. Click the dropoff to deposit',
          from: 'above',
        });
        break;
      }
      case 4: {
        targets.push({
          x: TREE_BTN.x + TREE_BTN.w / 2,
          y: TREE_BTN.y + TREE_BTN.h + 6,
          label: '4. Open the Bee Tree and hire your first Runner',
          from: 'below',
        });
        break;
      }
      case 5: {
        targets.push({
          x: SPIN_BTN.x + SPIN_BTN.w / 2,
          y: SPIN_BTN.y + SPIN_BTN.h + 6,
          label: '5. Roll for a new bee',
          from: 'below',
        });
        break;
      }
      case 6: {
        // Find the newly-unlocked runner slot ghost.
        const slot = this.computeSlotGeoms().find((g) => g.type === 'runner' && !g.occupied);
        if (slot) {
          targets.push({
            x: slot.x,
            y: slot.y - slot.size * 2.2,
            label: '6. Put your new bee in the runner slot',
            from: 'above',
          });
        }
        break;
      }
    }

    // Rebirth FTUE arrows (independent of the main FTUE).
    if (this.ftueRebirthStep === 1) {
      targets.push({
        x: REBIRTH_BTN.x + REBIRTH_BTN.w / 2,
        y: REBIRTH_BTN.y - 4,
        label: 'Click REBIRTH to cash in your run',
        from: 'above',
      });
    } else if (this.ftueRebirthStep === 2) {
      targets.push({
        x: ESSENCE_TREE_BTN.x + ESSENCE_TREE_BTN.w / 2,
        y: ESSENCE_TREE_BTN.y - 4,
        label: 'Open the Rebirth Tree and spend Essence',
        from: 'above',
      });
    }

    const t = this.time;
    for (const tg of targets) drawFtueArrow(ctx, tg.x, tg.y, tg.label, tg.from, t);
  }

  // (Old top-left AI Autoplay button removed — moved into the Settings overlay.)
}

/** Draw a bouncing chevron + label that points at a target screen position.
 *  `from: 'above'` puts the arrow above the target, pointing DOWN; `'below'`
 *  puts it below pointing UP. Sized to read against the canvas backdrop. */
function drawFtueArrow(
  ctx: CanvasRenderingContext2D,
  targetX: number,
  targetY: number,
  label: string,
  from: 'above' | 'below',
  time: number,
) {
  const bob = Math.sin(time * 6) * 4 + 4;             // 0..8 px bobbing offset
  const dir = from === 'above' ? -1 : +1;             // -1 = arrow sits above, points down
  const tipY = targetY + dir * (10 + bob);
  const baseY = tipY + dir * 12;
  const halfW = 9;
  // Filled chevron
  ctx.save();
  ctx.fillStyle = '#ffd24a';
  ctx.strokeStyle = '#1a1208';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(targetX, tipY);
  ctx.lineTo(targetX - halfW, baseY);
  ctx.lineTo(targetX + halfW, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Label sits just past the arrow's flat side. Clamp horizontally so it
  // stays fully on-screen even when the target is near the right/left edge.
  const textY = baseY + dir * 14;
  ctx.save();
  ctx.font = '600 12px Inter Tight, sans-serif';
  const metrics = ctx.measureText(label);
  const padX = 8;
  const padY = 3;
  const bgW = metrics.width + padX * 2;
  const bgH = 18;
  let bgX = targetX - bgW / 2;
  const MARGIN = 6;
  if (bgX + bgW > 960 - MARGIN) bgX = 960 - MARGIN - bgW;
  if (bgX < MARGIN) bgX = MARGIN;
  const bgY = textY - (from === 'above' ? bgH : 0) + (from === 'above' ? -2 : 2);
  ctx.fillStyle = 'rgba(15, 10, 25, 0.92)';
  ctx.fillRect(bgX, bgY, bgW, bgH);
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 1;
  ctx.strokeRect(bgX + 0.5, bgY + 0.5, bgW - 1, bgH - 1);
  ctx.fillStyle = '#f0d8ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bgX + bgW / 2, bgY + bgH / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'start';
  ctx.restore();
  void padY;
}
