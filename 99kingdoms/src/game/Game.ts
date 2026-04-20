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
  drawConsumableChips,
  drawActiveConsumableStatus,
  drawBurnFx,
  drawProjectiles,
  drawCoins,
  drawFlyingCoins,
  drawDownedMarker,
  drawNightBanner,
  drawDawnBanner,
  drawNoteCard,
  drawWandererSlots,
  drawPortals,
  drawPOIs,
  applyLighting,
  drawEndScreen,
  drawMenuScreen,
} from '../systems/Render';
import { drawHUD, drawQuestPanel } from '../ui/HUD';
import { drawShop, shopPickAt, ShopPick } from '../ui/Shop';
import { ResourceNode } from '../entities/ResourceNode';
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
import { UpgradeOffer, rollOffers } from './Upgrades';
import { FogOfWar } from '../systems/Fog';
import { Portal, createPortal, PORTAL_RADIUS, PORTAL_DEFEND_COOLDOWN } from '../entities/Portal';
import {
  CONSUMABLES,
  ConsumableId,
  FLARE_DURATION,
  RALLY_DURATION,
  BURN_RADIUS,
  BURN_DAMAGE,
  BURN_FX_DURATION,
  CAMPFIRE_INTERACT_RADIUS,
} from '../entities/Consumable';
import { Autoplay } from '../systems/Autoplay';
import { NoteCard, diaryFor, poiNoteFor } from './Narrative';
import { POI, POIKind, createPOI, POI_INTERACT_RANGE, POI_INTERACT_DURATION } from '../entities/POI';
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
const BLACKSMITH_RESTOCK_COST = 10;
const VILLAGER_DROP_RANGE = 34;
const STARTING_COIN = 10;
const BUILD_PAY_RANGE = 44;
const BUILD_PAY_INTERVAL = 0.16;
const WALL_PERIMETER_RADIUS = 210;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
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
  private portalRespawnDelays: number[] = [];
  shopOpen = false;
  shopOffers: UpgradeOffer[] = [];
  readonly stats: RunStats = { kills: 0, rescued: 0, stationsBuilt: 0, coinsCollected: 0, coinsSpent: 0 };
  questIndex = 0;
  questCompleteFlashTime = 0;
  nightBannerTime = 0;
  dawnBannerTime = 0;
  /** When set, the renderer shows a parchment card and gameplay is paused
   *  until the player dismisses it (Space / click). Used for POI notes and
   *  the nightly Scribe's diary. */
  activeNote: NoteCard | null = null;
  flareTime = 0;
  rallyTime = 0;
  burnFxTime = 0;
  /** The forge begins each dawn needing a top-up. While unstocked the dawn
   *  shop and night consumables are disabled — a recurring coin sink that
   *  scales with how long you keep the blacksmith running. */
  blacksmithStocked = true;
  blacksmithRestockFailedAt = 0;
  private waveSchedule: WaveEntry[] = [];
  private lastPhase: Phase = 'day';
  private wandererTimer = 10;
  private payTimer = 0;
  private payTargetId: number | null = null;
  gameOver = false;
  victory = false;
  wantsRestart = false;
  /** Main menu gates game start — player presses Space/click to dismiss and
   *  begin the run. Also shown between runs (return-to-menu flow). */
  showMenu = true;
  readonly autoplay = new Autoplay();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.width = canvas.width;
    this.height = canvas.height;
    this.worldW = 1600;
    this.worldH = 1200;
    const { seed, label } = resolveSeed();
    this.seed = seed;
    this.seedLabel = label;
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
    this.updateCamera();
    this.updateFog();
  }

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
      this.portals.push(createPortal(x, y));
    }
  }

  private initializePOIs() {
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    const minDist = 360;
    const maxDist = Math.min(cx, cy) * 0.95;
    const rng = this.worldRng;

    const place = (kind: POIKind) => {
      for (let attempt = 0; attempt < 40; attempt++) {
        const angle = rng() * Math.PI * 2;
        const dist = minDist + rng() * (maxDist - minDist);
        const x = cx + Math.cos(angle) * dist;
        const y = cy + Math.sin(angle) * dist;
        const tooClose =
          this.portals.some((p) => Math.hypot(p.x - x, p.y - y) < 100) ||
          this.pois.some((p) => Math.hypot(p.x - x, p.y - y) < 140);
        if (!tooClose) {
          this.pois.push(createPOI(kind, x, y));
          return;
        }
      }
    };

    place('camp');
    place('camp');
    place('chest');
    place('chest');
    place('cache');
    place('shrine');
    place('graveyard');
    place('ruin');
  }

  private tickReadyTimers(dt: number) {
    if (this.flareTime > 0) this.flareTime = Math.max(0, this.flareTime - dt);
    if (this.rallyTime > 0) this.rallyTime = Math.max(0, this.rallyTime - dt);
    if (this.burnFxTime > 0) this.burnFxTime = Math.max(0, this.burnFxTime - dt);
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
        p.defendCooldown = PORTAL_DEFEND_COOLDOWN;
      }
    }
    for (const poi of this.pois) {
      if (poi.discovered) continue;
      const dx = poi.x - x;
      const dy = poi.y - y;
      if (dx * dx + dy * dy < r2) poi.discovered = true;
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
    const addGhost = (kind: StationKind, x: number, y: number) => {
      const s = createStation(kind, x, y);
      if (delayFreshGhosts) s.readyTimer = STATION_READY_DELAY;
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
    for (const p of spawns) {
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
      // Any "next" input dismisses the menu and starts the run.
      if (
        this.input.pressed('Space') ||
        this.input.pressed('Enter') ||
        this.input.mouseJustDown
      ) {
        this.showMenu = false;
      }
      this.input.endFrame();
      return;
    }
    if (this.gameOver) {
      // After a run ends, any "next" input throws us back to the main menu.
      if (
        this.input.pressed('KeyR') ||
        this.input.pressed('Space') ||
        this.input.pressed('Enter') ||
        this.input.mouseJustDown
      ) {
        this.wantsRestart = true;
      }
      this.input.endFrame();
      return;
    }
    if (this.activeNote) {
      // Parchment card blocks gameplay until dismissed. Any obvious "next"
      // input clears it — Space, Enter, or a mouse click.
      if (
        this.input.pressed('Space') ||
        this.input.pressed('Enter') ||
        this.input.mouseJustDown
      ) {
        this.activeNote = null;
      }
      this.input.endFrame();
      return;
    }
    if (this.shopOpen) {
      this.handleShopInput();
      this.input.endFrame();
      return;
    }

    this.clock.update(dt);
    if (this.clock.phase !== this.lastPhase) {
      this.onPhaseEnter(this.clock.phase);
      this.lastPhase = this.clock.phase;
    }

    this.autoplay.update(this, dt);

    this.campfire.update(dt);
    this.handleVillagerDrop();
    this.handleConsumableInput();

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

    if (this.clock.phase === 'day') this.wandererSpawnTick(dt);
    if (this.clock.phase === 'night') this.processSpawnQueue();

    this.updateEnemies(dt);
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

    this.input.endFrame();
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.showMenu) {
      drawMenuScreen(ctx, this.width, this.height, this.seedLabel);
      return;
    }
    ctx.save();
    ctx.translate(-this.cameraX, -this.cameraY);

    drawWorld(ctx, this.map, this.hero);
    drawStations(ctx, this.stations, this.payTargetId, this.hero, this.campfire.level, this.clock.phase === 'night');
    drawPortals(ctx, this.portals);
    drawPOIs(ctx, this.pois);
    drawCampfire(ctx, this.campfire);
    drawCampfireUpgradeHint(ctx, this.campfire, this.hero, this.stations, this.clock.phase === 'night');
    // Consumables are a "fight the night" toolkit — only surface the chips
    // when they're actually useful (night + dawn afterglow) AND the smithy
    // is stocked for this cycle. They render at the blacksmith so the forge
    // is clearly the source of those abilities.
    const smith = this.stations.find((s) => s.kind === 'blacksmith' && s.active);
    if (
      smith &&
      this.clock.phase !== 'day' &&
      this.blacksmithStocked
    ) {
      drawConsumableChips(
        ctx,
        CONSUMABLES,
        smith,
        this.hero,
        this.resources.coin,
        CAMPFIRE_INTERACT_RADIUS,
        this.flareTime,
        this.rallyTime,
      );
    }
    if (smith) {
      drawActiveConsumableStatus(ctx, smith, this.flareTime, this.rallyTime);
    }
    if (this.burnFxTime > 0) {
      drawBurnFx(ctx, this.campfire, this.burnFxTime, BURN_FX_DURATION, BURN_RADIUS);
    }
    drawCoins(ctx, this.coins);
    drawRecruits(ctx, this.recruits);
    drawWandererSlots(ctx, this.recruits, this.hero);
    drawFlyingCoins(ctx, this.flyingCoins);
    if (this.hero.respawnTimer > 0) {
      drawDownedMarker(ctx, this.campfire.x, this.campfire.y, this.hero.respawnTimer);
    }
    drawEnemies(ctx, this.enemies);
    if (this.hero.respawnTimer <= 0) drawHero(ctx, this.hero);
    drawProjectiles(ctx, this.projectiles);
    drawAttackFlash(ctx, this.hero, this.effectiveSwingRange);

    ctx.restore();

    // Fog of war obscures unexplored areas on top of the world rendering.
    this.fog.draw(ctx, this.cameraX, this.cameraY, this.width, this.height);

    applyLighting(
      ctx,
      this.clock,
      this.campfire,
      this.hero,
      this.stations,
      this.recruits,
      this.width,
      this.height,
      this.upgrades.campfireLight,
      this.cameraX,
      this.cameraY,
      this.flareTime,
    );

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
    );
    drawHUD(ctx, this.resources, this.clock, this.campfire, this.recruits, this.hero, this.seedLabel);
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
      drawNoteCard(
        ctx,
        this.width,
        this.height,
        this.activeNote.title,
        this.activeNote.body,
      );
    }

    if (this.shopOpen) {
      const hover: ShopPick = shopPickAt(
        this.input.mouseX,
        this.input.mouseY,
        this.width,
        this.height,
        this.shopOffers.length,
      );
      drawShop(ctx, this.shopOffers, this.resources, hover, this.width, this.height);
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
    }
  }

  private onNodeHit(node: ResourceNode) {
    // Hero chops pop two coins per swing — day income needs to pull its
    // weight vs. night enemy drops.
    this.coins.push(createCoin(node.x, node.y, 1));
    this.coins.push(createCoin(node.x, node.y, 1));
  }

  private onPhaseEnter(phase: Phase) {
    if (phase === 'night') {
      this.waveSchedule = scheduleFor(this.clock.night);
      this.recruits = this.recruits.filter((r) => r.status !== 'wandering');
      this.nightBannerTime = NIGHT_BANNER_DURATION;
    } else if (phase === 'dawn') {
      this.dawnBannerTime = DAWN_BANNER_DURATION;
      // Surface the Scribe's diary entry for the night that just ended —
      // paces the mystery across the 10-night arc. The player must dismiss
      // the card before any other dawn action (shop, consumables, etc.).
      const diary = diaryFor(this.clock.night);
      if (diary) this.activeNote = diary;
      // Charge the blacksmith's recurring restock. If the player can afford
      // it, consumables + the dawn shop stay online for the coming day/night.
      // If not, they're locked until the next dawn where the player can pay.
      if (this.hasActiveBlacksmith()) {
        if (this.resources.coin >= BLACKSMITH_RESTOCK_COST) {
          this.resources.coin -= BLACKSMITH_RESTOCK_COST;
          this.stats.coinsSpent += BLACKSMITH_RESTOCK_COST;
          this.blacksmithStocked = true;
          this.openShop();
        } else {
          this.blacksmithStocked = false;
          this.blacksmithRestockFailedAt = this.clock.night;
        }
      } else {
        this.blacksmithStocked = false;
      }
    }
  }

  private openShop() {
    this.shopOpen = true;
    this.shopOffers = rollOffers(3, this.clock.night);
  }

  private closeShop() {
    this.shopOpen = false;
    this.clock.phase = 'day';
    this.clock.phaseTime = 0;
    this.clock.night += 1;
    this.lastPhase = 'day';
    this.wandererTimer = 8;
    this.ensureBaseStructuresForLevel();
    if (this.clock.night > WIN_NIGHT) {
      this.victory = true;
      this.gameOver = true;
    }
  }

  private handleShopInput() {
    if (!this.input.mouseJustDown) return;
    const pick = shopPickAt(
      this.input.mouseX,
      this.input.mouseY,
      this.width,
      this.height,
      this.shopOffers.length,
    );
    if (pick === null) return;
    if (pick === 'skip') {
      this.closeShop();
      return;
    }
    const offer = this.shopOffers[pick];
    if (this.resources.coin < offer.cost) return;
    this.resources.coin -= offer.cost;
    offer.apply(this);
    this.closeShop();
  }

  private processSpawnQueue() {
    const t = this.clock.phaseTime;
    while (this.waveSchedule.length > 0 && this.waveSchedule[0].time <= t) {
      const entry = this.waveSchedule.shift()!;
      this.spawnEnemy(entry.kind);
    }
  }

  private spawnEnemy(kind: EnemyKind) {
    if (this.portals.length > 0) {
      const portal = this.portals[Math.floor(Math.random() * this.portals.length)];
      const jx = (Math.random() - 0.5) * 24;
      const jy = (Math.random() - 0.5) * 24;
      this.enemies.push(createEnemy(kind, portal.x + jx, portal.y + jy));
      return;
    }
    const [x, y] = this.randomEdgePoint();
    this.enemies.push(createEnemy(kind, x, y));
  }

  private updatePortals(dt: number) {
    for (const p of this.portals) {
      if (p.hitFlash > 0) p.hitFlash -= dt;
      if (p.defendCooldown > 0) p.defendCooldown = Math.max(0, p.defendCooldown - dt);
      p.swirl = (p.swirl + dt * 1.6) % (Math.PI * 2);
    }
    const killed = this.portals.filter((p) => p.hp <= 0);
    if (killed.length > 0) {
      for (const dead of killed) {
        // Reward: a shower of coins spills from the collapsing portal.
        for (let i = 0; i < 25; i++) {
          this.coins.push(createCoin(dead.x, dead.y, 1));
        }
        this.portalRespawnDelays.push(75);
      }
      this.portals = this.portals.filter((p) => p.hp > 0);
    }
    for (let i = this.portalRespawnDelays.length - 1; i >= 0; i--) {
      this.portalRespawnDelays[i] -= dt;
      if (this.portalRespawnDelays[i] <= 0) {
        this.spawnReplacementPortal();
        this.portalRespawnDelays.splice(i, 1);
      }
    }
  }

  private spawnReplacementPortal() {
    const cx = this.worldW / 2;
    const cy = this.worldH / 2;
    const ringR = Math.min(cx, cy) * 0.82;
    // Respawn happens mid-run, so use Math.random — this is live-game noise,
    // not the deterministic-world layout.
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = ringR * (0.72 + Math.random() * 0.28);
      const x = clamp(cx + Math.cos(angle) * r, 60, this.worldW - 60);
      const y = clamp(cy + Math.sin(angle) * r, 60, this.worldH - 60);
      const tooClose = this.portals.some((p) => Math.hypot(p.x - x, p.y - y) < 160);
      if (!tooClose) {
        this.portals.push(createPortal(x, y));
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
          poi.claimed = true;
          poi.interactProgress = 0;
          this.claimPOI(poi);
          // Drop an in-world note fragment when the POI is claimed — pools
          // per kind, picked by a hash of the POI's position so the same
          // world layout always surfaces the same story fragment order.
          const seed = Math.floor(poi.x * 131 + poi.y * 7919);
          this.activeNote = poiNoteFor(poi.kind, seed);
        }
      } else if (poi.interactProgress > 0) {
        poi.interactProgress = Math.max(0, poi.interactProgress - dt * 2);
      }
    }
  }

  private claimPOI(poi: POI) {
    switch (poi.kind) {
      case 'camp': {
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2;
          const spawnX = poi.x + Math.cos(angle) * 20;
          const spawnY = poi.y + Math.sin(angle) * 20;
          const v = createWanderer(spawnX, spawnY, spawnX, spawnY);
          v.status = 'idle';
          v.orbitAngle = Math.random() * Math.PI * 2;
          this.recruits.push(v);
        }
        break;
      }
      case 'chest': {
        for (let i = 0; i < 15; i++) {
          this.coins.push(createCoin(poi.x, poi.y, 1));
        }
        break;
      }
      case 'shrine': {
        const offers = rollOffers(1, this.clock.night);
        if (offers[0]) offers[0].apply(this);
        break;
      }
      case 'graveyard': {
        // A scare — three runners rise from the graves — but a reward remains.
        for (let i = 0; i < 3; i++) {
          const angle = (i / 3) * Math.PI * 2 + Math.random() * 0.4;
          const ex = poi.x + Math.cos(angle) * 22;
          const ey = poi.y + Math.sin(angle) * 22;
          this.enemies.push(createEnemy('runner', ex, ey));
        }
        for (let i = 0; i < 20; i++) {
          this.coins.push(createCoin(poi.x, poi.y, 1));
        }
        break;
      }
      case 'cache': {
        for (let i = 0; i < 30; i++) {
          this.coins.push(createCoin(poi.x, poi.y, 1));
        }
        break;
      }
      case 'ruin': {
        // Raise a free, pre-staffed gather outpost where the ruin stood.
        const station = createStation('gather', poi.x, poi.y);
        station.active = true;
        station.buildRemaining = 0;
        this.stats.stationsBuilt += 1;
        const v = createWanderer(poi.x, poi.y, poi.x, poi.y);
        v.status = 'moving';
        v.stationId = station.id;
        v.targetX = station.x;
        v.targetY = station.y;
        station.recruitIds.push(v.id);
        this.recruits.push(v);
        this.stations.push(station);
        break;
      }
    }
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

  private wandererSpawnTick(dt: number) {
    this.wandererTimer -= dt;
    if (this.wandererTimer > 0) return;
    const wandering = this.recruits.filter((r) => r.status === 'wandering').length;
    if (wandering >= 2) {
      this.wandererTimer = 5;
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
    this.wandererTimer = 22;
  }

  private updateStationPayment(dt: number) {
    type Mode = 'build' | 'hire' | 'upgrade-station' | 'upgrade-campfire' | 'rescue';
    let target: Station | undefined;
    let wandererTarget: Recruit | undefined;
    let campfireTarget = false;
    let mode: Mode = 'build';
    let bestD = BUILD_PAY_RANGE;

    const hx = this.hero.x;
    const hy = this.hero.y;

    const isNight = this.clock.phase === 'night';

    for (const s of this.stations) {
      if (!prereqMet(s.kind, this.stations, this.campfire.level)) continue;
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
    const cfBlocked = this.campfire.upgradeBlockReason(this.stations);
    const canUpgradeCfNow =
      this.clock.phase !== 'night' && this.campfire.readyTimer <= 0;
    if (canUpgradeCfNow && dCf < bestD && cfUpCost !== null && cfBlocked === null) {
      target = undefined;
      wandererTarget = undefined;
      campfireTarget = true;
      mode = 'upgrade-campfire';
      bestD = dCf;
    }

    if (!target && !campfireTarget && !wandererTarget) {
      this.payTimer = 0;
      this.payTargetId = null;
      return;
    }

    // `required` is the coins still needed for this payment (remaining, not
    // total). Using remaining lets the drip resume mid-payment — otherwise
    // partial progress would stall as soon as `coin` dips below the total.
    let required = 0;
    let totalCost = 0;
    if (mode === 'build') {
      required = target!.buildRemaining;
      totalCost = STATION_STATS[target!.kind].cost;
    } else if (mode === 'hire') {
      totalCost = STATION_STATS[target!.kind].hireCost;
      required = totalCost - target!.hireProgress;
    } else if (mode === 'upgrade-station') {
      totalCost = nextUpgradeCost(target!, this.campfire.level)!;
      required = totalCost - target!.upgradeProgress;
    } else if (mode === 'rescue') {
      totalCost = RESCUE_COST;
      required = totalCost - wandererTarget!.rescueProgress;
    } else {
      totalCost = this.campfire.nextUpgradeCost()!;
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
      this.spawnFlyingCoinToSlot(mode, target, campfireTarget, wandererTarget);
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
    mode: 'build' | 'hire' | 'upgrade-station' | 'upgrade-campfire' | 'rescue',
    target: Station | undefined,
    campfireTarget: boolean,
    wandererTarget?: Recruit,
  ) {
    let tx = 0;
    let ty = 0;
    if (campfireTarget) {
      tx = this.campfire.x;
      ty = this.campfire.y - 38;
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

  private handleConsumableInput() {
    if (this.clock.phase === 'day') return;
    if (!this.blacksmithStocked) return;
    const smith = this.stations.find((s) => s.kind === 'blacksmith' && s.active);
    if (!smith) return;
    const d = Math.hypot(smith.x - this.hero.x, smith.y - this.hero.y);
    if (d > CAMPFIRE_INTERACT_RADIUS) return;
    if (this.hero.isDead) return;
    for (const c of CONSUMABLES) {
      if (!this.input.pressed(c.key)) continue;
      if (this.resources.coin < c.cost) continue;
      // Block re-triggering a buff that's already running.
      if (c.id === 'flare' && this.flareTime > 0) continue;
      if (c.id === 'rally' && this.rallyTime > 0) continue;
      this.resources.coin -= c.cost;
      this.stats.coinsSpent += c.cost;
      this.applyConsumable(c.id);
    }
  }

  hasActiveBlacksmith(): boolean {
    return this.stations.some((s) => s.kind === 'blacksmith' && s.active);
  }

  private applyConsumable(id: ConsumableId) {
    if (id === 'flare') {
      this.flareTime = FLARE_DURATION;
      // Reveal a wide radius around the hero so the flare literally lights the
      // map — any fog the player hadn't discovered becomes visible.
      this.discoverAround(this.hero.x, this.hero.y, 420);
      this.fog.reveal(this.hero.x, this.hero.y, 420);
    } else if (id === 'rally') {
      this.rallyTime = RALLY_DURATION;
    } else if (id === 'burn') {
      this.burnFxTime = BURN_FX_DURATION;
      for (const e of this.enemies) {
        const dd = Math.hypot(e.x - this.campfire.x, e.y - this.campfire.y);
        if (dd <= BURN_RADIUS) {
          e.hp -= armoredDamage(e, BURN_DAMAGE);
          e.hitFlash = 0.2;
        }
      }
    }
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
            targetWall.hp -= stats.damage;
          } else if (targetType === 'hero') {
            this.hero.takeDamage(stats.damage);
          }
        }
      }
    }

    // Remove dead walls.
    this.stations = this.stations.filter(
      (s) => !(s.kind === 'wall' && s.active && s.hp <= 0),
    );

    this.enemies = this.enemies.filter((e) => {
      if (e.hp <= 0) {
        const stats = ENEMY_STATS[e.kind];
        for (let i = 0; i < stats.coinValue; i++) {
          this.coins.push(createCoin(e.x, e.y, 1));
        }
        this.stats.kills += 1;
        return false;
      }
      return true;
    });
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
    const interval = eff.workInterval / this.upgrades.towerRate;
    if (r.workTimer < interval) return;
    const enemy = this.nearestEnemyTo(station.x, station.y, eff.workRange);
    if (!enemy) return;
    r.workTimer = 0;
    const angle = Math.atan2(enemy.y - station.y, enemy.x - station.x);
    const arrow = createArrow(station.x + off, station.y - 12, angle);
    arrow.damage = eff.power;
    this.projectiles.push(arrow);
  }

  private updateGatherer(r: Recruit, station: Station, dt: number) {
    const eff = effectiveStats(station);
    const CARRY_LIMIT = 3;

    const dStation = Math.hypot(station.x - r.x, station.y - r.y);

    // Deliver any carried coins when at the station.
    if (r.carriedCoins > 0 && dStation < 14) {
      for (let i = 0; i < r.carriedCoins; i++) {
        const angle = Math.random() * Math.PI * 2;
        const coin = createCoin(station.x, station.y, 1);
        const spd = 35 + Math.random() * 40;
        coin.vx = Math.cos(angle) * spd;
        coin.vy = Math.sin(angle) * spd;
        this.coins.push(coin);
      }
      r.carriedCoins = 0;
    }

    // If loaded up, head back to the post to drop off.
    if (r.carriedCoins >= CARRY_LIMIT) {
      moveTowards(r, station.x, station.y, dt);
      r.workTimer = 0;
      return;
    }

    let target: ResourceNode | undefined;
    if (r.chopTargetNodeId !== null) {
      target = this.map.nodes.find((n) => n.id === r.chopTargetNodeId);
      if (
        !target ||
        Math.hypot(target.x - station.x, target.y - station.y) > eff.workRange
      ) {
        target = undefined;
      }
    }
    if (!target) {
      target = this.findNearestNodeAny(station.x, station.y, eff.workRange);
      r.chopTargetNodeId = target?.id ?? null;
      r.workTimer = 0;
    }
    if (!target) {
      moveTowards(r, station.x, station.y, dt);
      return;
    }

    const dNode = Math.hypot(target.x - r.x, target.y - r.y);
    if (dNode > 20) {
      moveTowards(r, target.x, target.y, dt);
      r.workTimer = 0;
    } else {
      r.workTimer += dt;
      if (r.workTimer >= eff.workInterval) {
        r.workTimer -= eff.workInterval;
        target.hp -= 1;
        // Coins drop from the tree/bush itself. The villager (who is standing
        // next to it) will scoop them up and carry them home. Damp the pop
        // velocity so the coins don't scatter past the villager's reach.
        for (let i = 0; i < eff.power; i++) {
          const coin = createCoin(target.x, target.y, 1);
          coin.vx *= 0.2;
          coin.vy *= 0.2;
          this.coins.push(coin);
        }
        if (target.hp <= 0) {
          this.map.removeNode(target.id);
          r.chopTargetNodeId = null;
        }
      }
    }
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
          enemy.hp -= armoredDamage(enemy, eff.power);
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
      const enemy = this.nearestEnemyTo(station.x, station.y, eff.workRange);
      if (enemy) {
        const d = Math.hypot(enemy.x - r.x, enemy.y - r.y);
        if (d > 16) {
          moveTowards(r, enemy.x, enemy.y, dt);
          r.workTimer = 0;
        } else {
          r.workTimer += dt;
          if (r.workTimer >= eff.workInterval) {
            r.workTimer -= eff.workInterval;
            enemy.hp -= eff.power;
            enemy.hitFlash = 0.12;
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
          enemy.hp -= armoredDamage(enemy, eff.power);
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
          e.hp -= armoredDamage(e, p.damage);
          e.hitFlash = 0.12;
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

    const baseDamage = HERO_SWING_DAMAGE + this.upgrades.heroDamage;
    const damage = this.rallyTime > 0 ? baseDamage * 2 : baseDamage;
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
      e.hp -= armoredDamage(e, damage);
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
        p.defendCooldown = PORTAL_DEFEND_COOLDOWN;
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

  private findNearestNodeAny(
    x: number,
    y: number,
    range: number,
  ): ResourceNode | undefined {
    let best: ResourceNode | undefined;
    let bestD = range;
    for (const n of this.map.nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
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
}
