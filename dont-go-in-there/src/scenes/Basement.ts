import type { Scene } from './Scene';
import type { Game } from '../game/Game';
import type { Input } from '../systems/Input';
import { Player, type Rect } from '../entities/Player';
import { ItemPickup } from '../entities/ItemPickup';
import { Stalker } from '../entities/Stalker';
import { Stairs } from '../entities/Stairs';
import { Container } from '../entities/Container';
import { renderObstacle } from '../entities/Obstacle';
import { renderFearObject } from '../entities/FearObject';
import {
  FEAR_RADIUS,
  FEAR_RATE,
  fearBlocks,
  generate,
  generateTutorial,
  isWalkable,
  type BasementMap,
} from '../systems/Procgen';
import { rect, text, darkness, W, H, dist } from '../systems/Render';
import {
  activeQuestUnique,
  ALL_ITEMS,
  QUEST_TEXT,
  RAID_MODIFIERS,
  totalItems,
  type ItemKind,
  type RaidModifier,
} from '../types';
import { renderRunHud } from '../ui/HUD';
import { JournalPanel } from '../ui/JournalPanel';
import { renderNotifications } from '../ui/NotificationOverlay';

const VIEW_W = W;
const VIEW_H = H;

type Phase = 'playing' | 'caught' | 'extracting';

export class Basement implements Scene {
  private map!: BasementMap;
  private player!: Player;
  private items!: ItemPickup[];
  private containers!: Container[];
  private stalkers!: Stalker[];
  private exitStairs: Stairs[] = [];
  private depth = 1;
  private panic = 0;
  private phase: Phase = 'playing';
  private phaseTimer = 0;
  private cameraX = 0;
  private cameraY = 0;
  private hint = '';
  private message = '';
  private flicker = 0;
  // Holding Space at an Up exit accumulates progress; release decays it.
  private climbingExit: Stairs | null = null;
  private climbProgress = 0;
  private readonly CLIMB_DURATION = 2.4;
  // Failed-QTE noise + panic burst: 4s of 3x panic accumulation, alerts both
  // stalkers to the failure location.
  private panicBoostTimer = 0;
  private readonly PANIC_BOOST_DURATION = 4.0;
  private readonly PANIC_BOOST_MULTIPLIER = 3.0;

  // Per-run "tonight..." modifier — picked once when entering the basement
  // and held across descents so a single trip down feels like one night.
  private modifier: RaidModifier = RAID_MODIFIERS[0]!;
  private modifierBannerTimer = 0;

  // FTUE flag — true while the player's first descent should use the safe
  // tutorial layout. Latched on enter, persists across regenerate() calls.
  private isTutorial = false;
  private journal = new JournalPanel();
  // Cached reference so regenerate() can inject quest items without having
  // to thread `game` through every descent.
  private game!: Game;

  enter(game: Game): void {
    this.game = game;
    this.isTutorial = game.isTutorialActive();
    // Roll a fresh "tonight..." modifier on each entry from the bedroom.
    // Held for the whole basement trip — descending stairs keeps the same one.
    this.modifier =
      RAID_MODIFIERS[Math.floor(Math.random() * RAID_MODIFIERS.length)] ?? RAID_MODIFIERS[0]!;
    this.modifierBannerTimer = this.isTutorial ? 0 : 4.0;
    this.regenerate(1, Date.now());
  }

  exit(): void {}

  private regenerate(depth: number, seed: number, resetPanic = true): void {
    this.depth = depth;
    const questUnique = this.game ? activeQuestUnique(this.game.save.partProgress) : null;
    this.map =
      this.isTutorial && depth === 1
        ? generateTutorial(seed)
        : generate(seed, depth, questUnique);
    this.player = new Player(this.map.startX, this.map.startY);
    this.items = this.map.items.map((it) => new ItemPickup(it.x, it.y, it.kind));
    // Quest injection: while the workshop isn't unlocked yet (post-FTUE),
    // guarantee one Super Glue tube in a random container so the player can
    // make progress on the glue quest every run.
    if (
      this.game &&
      this.game.save.tutorialStep === 'done' &&
      !this.game.save.craftingUnlocked &&
      this.map.containers.length > 0
    ) {
      const target = this.map.containers[Math.floor(Math.random() * this.map.containers.length)]!;
      if (!target.items.includes('super_glue')) target.items.push('super_glue');
    }
    this.containers = this.map.containers.map((c) => new Container(c));
    this.stalkers = this.map.stalkerPaths.map((p) => {
      const s = new Stalker(p);
      s.speedMult = this.modifier.stalkerSpeedMult;
      s.visionMult = this.modifier.visionRangeMult;
      return s;
    });
    this.exitStairs = this.map.exits.map((e) => new Stairs(e.x, e.y, e.dir));
    if (resetPanic) this.panic = 0;
    this.panicBoostTimer = 0;
    this.phase = 'playing';
    this.phaseTimer = 0;
    this.climbingExit = null;
    this.climbProgress = 0;
  }

  private obstaclesAsWalls(): Rect[] {
    const obs = this.map.obstacles.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    const cont = this.map.containers.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h }));
    const fear = this.map.fearObjects
      .filter((f) => fearBlocks(f.kind))
      .map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
    return [...obs, ...cont, ...fear];
  }

  update(dt: number, input: Input, game: Game): void {
    this.flicker += dt;
    if (this.modifierBannerTimer > 0) this.modifierBannerTimer = Math.max(0, this.modifierBannerTimer - dt);

    if (this.phase !== 'playing') {
      this.phaseTimer += dt;
      if (this.phaseTimer > 1.6) {
        if (this.phase === 'caught') {
          game.loseCarried();
          game.loseEquipped();
          game.markDeath();
          game.switchScene('bedroom');
          return;
        }
        if (this.phase === 'extracting') {
          game.bankCarried();
          game.switchScene('bedroom');
          return;
        }
      }
      return;
    }

    // Journal — opens with J, closes with J or Esc. While open the basement
    // pauses (no movement, no panic ticks, no stalker updates) so the player
    // can read without dying mid-glance.
    if (input.pressed('KeyJ')) this.journal.toggle();
    if (input.pressed('Escape')) this.journal.close();
    if (this.journal.open) return;

    // Freeze the player while any container QTE is in flight — once committed
    // to a lockpick, the kid can't run.
    const anyQTE = this.containers.some((c) => c.qteActive);
    if (!anyQTE) {
      this.player.update(
        dt,
        input,
        this.obstaclesAsWalls(),
        { x: 0, y: 0, w: this.map.worldW, h: this.map.worldH },
        (x, y) => isWalkable(this.map, x, y),
      );
    }

    this.cameraX = Math.max(0, Math.min(this.map.worldW - VIEW_W, this.player.x - VIEW_W / 2));
    this.cameraY = Math.max(0, Math.min(this.map.worldH - VIEW_H, this.player.y - VIEW_H / 2));

    const isItemWalkable = (x: number, y: number): boolean => {
      if (!isWalkable(this.map, x, y)) return false;
      for (const o of this.map.obstacles) {
        if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return false;
      }
      for (const cc of this.map.containers) {
        if (x > cc.x && x < cc.x + cc.w && y > cc.y && y < cc.y + cc.h) return false;
      }
      return true;
    };
    for (const it of this.items) {
      it.update(dt, isItemWalkable);
      if (it.taken) continue;
      const inRange = dist(it.x, it.y, this.player.x, this.player.y) < 18;
      if (!it.pickupArmed && !inRange) it.pickupArmed = true;
      if (it.pickupArmed && inRange && totalItems(game.carried) < game.carrySlots()) {
        it.taken = true;
        game.carried[it.kind]++;
        // FTUE: picking up the eyes advances the quest to "now go home".
        if (it.kind === 'eyes') game.advanceTutorial('find_eyes', 'return_to_room');
      }
    }

    // Drop carried items via number keys (1-4 = the four HUD slots, in order)
    for (let slot = 1; slot <= game.carrySlots(); slot++) {
      if (input.pressed(`Digit${slot}`) || input.pressed(`Numpad${slot}`)) {
        const flat: ItemKind[] = [];
        for (const k of ALL_ITEMS) {
          for (let i = 0; i < game.carried[k]; i++) flat.push(k);
        }
        const kind = flat[slot - 1];
        if (kind) {
          game.carried[kind]--;
          const dropped = new ItemPickup(this.player.x, this.player.y, kind);
          dropped.pickupArmed = false;
          this.items.push(dropped);
        }
      }
    }

    for (const s of this.stalkers) s.update(dt, this.map, this.player.x, this.player.y);
    for (const s of this.stalkers) {
      if (s.hits(this.player.x, this.player.y, this.player.radius)) {
        this.phase = 'caught';
        this.phaseTimer = 0;
        this.message = 'CAUGHT';
        return;
      }
    }

    let panicRate = 1.4;
    if (this.panicBoostTimer > 0) {
      this.panicBoostTimer = Math.max(0, this.panicBoostTimer - dt);
      panicRate *= this.PANIC_BOOST_MULTIPLIER;
    }
    let nearestStalker = Infinity;
    let anyChasing = false;
    for (const s of this.stalkers) {
      const d = dist(s.x, s.y, this.player.x, this.player.y);
      if (d < nearestStalker) nearestStalker = d;
      if (s.state === 'chase') anyChasing = true;
    }
    if (nearestStalker < 160) panicRate += 6 * (1 - nearestStalker / 160);
    if (anyChasing) panicRate += 4;
    for (const h of this.map.hazards) {
      if (
        this.player.x > h.x &&
        this.player.x < h.x + h.w &&
        this.player.y > h.y &&
        this.player.y < h.y + h.h
      ) {
        panicRate += 8;
      }
    }
    // Fear objects — proximity-based panic that falls off linearly to the
    // edge of each one's radius.
    for (const f of this.map.fearObjects) {
      const fcx = f.x + f.w / 2;
      const fcy = f.y + f.h / 2;
      const d = dist(this.player.x, this.player.y, fcx, fcy);
      const r = FEAR_RADIUS[f.kind];
      if (d < r) panicRate += FEAR_RATE[f.kind] * (1 - d / r);
    }
    this.panic = Math.min(
      100,
      this.panic + panicRate * dt * game.panicMultiplier() * this.modifier.panicRateMult,
    );
    if (this.panic >= 100) {
      this.phase = 'caught';
      this.phaseTimer = 0;
      this.message = 'PANIC OVERLOAD';
      return;
    }

    // Find nearest unopened container in interaction range
    let nearContainer: Container | null = null;
    let nearContainerDist = Infinity;
    for (const c of this.containers) {
      if (c.isOpen) continue;
      const d = dist(this.player.x, this.player.y, c.cx(), c.cy());
      if (d < nearContainerDist) {
        nearContainerDist = d;
        nearContainer = c;
      }
    }
    const containerInRange = !!(nearContainer && nearContainerDist < 50);

    // Tick safe QTE timers + cooldowns on every container. A QTE timeout
    // counts as a fail and triggers the same noise/panic burst.
    let openingActive = false;
    for (const c of this.containers) {
      const timedOut = c.tickQTE(dt);
      if (timedOut) this.handleContainerFail(c);
      if (c.qteActive) openingActive = true;
    }

    // Regular containers: hold Space to accumulate progress; release decays.
    if (
      containerInRange &&
      nearContainer &&
      !nearContainer.isSafe() &&
      input.held('Space')
    ) {
      openingActive = true;
      nearContainer.openProgress += dt;
      if (nearContainer.openProgress >= nearContainer.duration()) {
        this.openContainer(nearContainer);
      }
    } else if (nearContainer && !nearContainer.isSafe() && nearContainer.openProgress > 0) {
      nearContainer.openProgress = Math.max(0, nearContainer.openProgress - dt * 1.6);
    }

    // Safes: press Space once. With a lockpick equipped, the safe just opens
    // (and consumes the lockpick). Otherwise the arrow-key QTE begins.
    if (
      containerInRange &&
      nearContainer &&
      nearContainer.isSafe() &&
      !nearContainer.qteActive &&
      nearContainer.failCooldown <= 0 &&
      input.pressed('Space')
    ) {
      if (game.hasTool('lockpick')) {
        game.consumeTool('lockpick');
        this.openContainer(nearContainer);
      } else {
        nearContainer.startQTE();
      }
      openingActive = true;
    }

    // Feed arrow-key presses into the active safe's QTE.
    if (nearContainer && nearContainer.qteActive) {
      let key: 'up' | 'down' | 'left' | 'right' | null = null;
      if (input.pressed('ArrowUp')) key = 'up';
      else if (input.pressed('ArrowDown')) key = 'down';
      else if (input.pressed('ArrowLeft')) key = 'left';
      else if (input.pressed('ArrowRight')) key = 'right';
      if (key !== null) {
        const result = nearContainer.onArrowKey(key);
        if (result === 'success') this.openContainer(nearContainer);
        else if (result === 'fail') this.handleContainerFail(nearContainer);
      }
    }

    // Find nearest Up and Down stair separately so the hold-Space interaction
    // can target Up while still allowing instant Space-press for Down.
    this.hint = '';
    let nearestUp: Stairs | null = null;
    let nearestUpDist = Infinity;
    let nearestDown: Stairs | null = null;
    let nearestDownDist = Infinity;
    for (const s of this.exitStairs) {
      const d = dist(this.player.x, this.player.y, s.cx(), s.cy());
      if (s.dir === 'up') {
        if (d < nearestUpDist) {
          nearestUpDist = d;
          nearestUp = s;
        }
      } else if (d < nearestDownDist) {
        nearestDownDist = d;
        nearestDown = s;
      }
    }
    const inRangeUp = nearestUp !== null && nearestUpDist < 30;
    const inRangeDown = nearestDown !== null && nearestDownDist < 30;

    // Hold Space to climb up & extract; release decays the climb so you can't
    // half-climb, dodge a stalker, then resume.
    let climbingActive = false;
    if (!openingActive && inRangeUp && nearestUp && input.held('Space')) {
      // If the player switched to a different Up stair, restart progress.
      if (this.climbingExit !== nearestUp) {
        this.climbingExit = nearestUp;
        this.climbProgress = 0;
      }
      climbingActive = true;
      this.climbProgress += dt;
      if (this.climbProgress >= this.CLIMB_DURATION * game.climbDurationMultiplier()) {
        this.phase = 'extracting';
        this.phaseTimer = 0;
        this.message = 'ESCAPED';
        game.recordDepth(this.depth);
        this.climbingExit = null;
        this.climbProgress = 0;
      }
    } else if (this.climbProgress > 0) {
      this.climbProgress = Math.max(0, this.climbProgress - dt * 1.6);
      if (this.climbProgress === 0) this.climbingExit = null;
    }

    // Hint priority: container > climb-up > down
    if (containerInRange && nearContainer) {
      if (nearContainer.qteActive) {
        this.hint = 'arrow keys — match the sequence';
      } else if (nearContainer.failCooldown > 0) {
        this.hint = '...you fumbled it...';
      } else if (nearContainer.isSafe()) {
        this.hint = game.hasTool('lockpick')
          ? '[space] use lockpick on the safe'
          : '[space] crack the safe';
      } else {
        this.hint = `[hold space] open the ${nearContainer.spec.kind}`;
      }
    } else if (inRangeUp) {
      this.hint = '[hold space] climb up & extract';
    } else if (inRangeDown) {
      this.hint = '[space] descend deeper';
    }

    // Down still triggers on a single press — descending is a quick commit.
    // Skip if we're currently mid-climb on an Up stair so they don't fight.
    if (!openingActive && !climbingActive && input.pressed('Space') && inRangeDown && nearestDown) {
      game.recordDepth(this.depth);
      this.regenerate(this.depth + 1, Date.now(), false);
    }
  }

  // QTE failure: makes a noise that alerts every stalker to the container,
  // and burns panic 3x faster for 4 seconds.
  private handleContainerFail(c: Container): void {
    this.panicBoostTimer = this.PANIC_BOOST_DURATION;
    for (const s of this.stalkers) s.alertTo(c.cx(), c.cy());
  }

  private openContainer(c: Container): void {
    c.isOpen = true;
    // Items must land in the player's pickup-reachable zone:
    //   containerEdge < itemDist < containerEdge + (playerRadius + pickupRadius)
    // i.e. somewhere from "just past the edge" to "edge + 28" along the launch
    // direction. We aim for "edge + 12 to edge + 22" to leave margin on both
    // sides. The per-axis walkable check in ItemPickup.update halts the item
    // sooner if its trajectory hits a wall. Decay rate Math.pow(0.0008, dt)
    // gives travel ≈ v0 / 7.13.
    const baseAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    const halfW = c.w / 2;
    const halfH = c.h / 2;
    for (let i = 0; i < c.spec.items.length; i++) {
      const a = baseAngle + (i - (c.spec.items.length - 1) / 2) * 0.7 + (Math.random() - 0.5) * 0.3;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      // Distance from container center to its bounding-box edge along (dx, dy)
      const tx = Math.abs(dx) > 0.001 ? halfW / Math.abs(dx) : Infinity;
      const ty = Math.abs(dy) > 0.001 ? halfH / Math.abs(dy) : Infinity;
      const edgeDist = Math.min(tx, ty);
      const spawnDist = edgeDist + 6;
      const finalDist = edgeDist + 14 + Math.random() * 8;
      const travel = Math.max(2, finalDist - spawnDist);
      const speed = travel * 7.13;
      const pickup = new ItemPickup(
        c.cx() + dx * spawnDist,
        c.cy() + dy * spawnDist,
        c.spec.items[i]!,
      );
      pickup.vx = dx * speed;
      pickup.vy = dy * speed;
      pickup.pickupArmed = false;
      this.items.push(pickup);
    }
  }

  render(ctx: CanvasRenderingContext2D, game: Game): void {
    rect(ctx, 0, 0, W, H, '#05040a');

    ctx.save();
    ctx.translate(-this.cameraX, -this.cameraY);

    // Walkable floor — main rooms first, then connectors over them
    for (const r of this.map.rooms) {
      if (r.isConnector) continue;
      rect(ctx, r.x, r.y, r.w, r.h, '#1a1620', '#2a232b');
    }
    for (const r of this.map.rooms) {
      if (!r.isConnector) continue;
      rect(ctx, r.x, r.y, r.w, r.h, '#1a1620');
    }
    // Re-stroke main room outlines on top so connector overlap looks like an open mouth
    for (const r of this.map.rooms) {
      if (r.isConnector) continue;
      ctx.strokeStyle = '#2a232b';
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }

    // floorboards
    ctx.strokeStyle = '#120e16';
    ctx.lineWidth = 1;
    for (const r of this.map.rooms) {
      if (r.isConnector) continue;
      for (let yy = r.y + 32; yy < r.y + r.h; yy += 32) {
        ctx.beginPath();
        ctx.moveTo(r.x + 1, yy + 0.5);
        ctx.lineTo(r.x + r.w - 1, yy + 0.5);
        ctx.stroke();
      }
    }

    // Hazards under obstacles
    for (const h of this.map.hazards) {
      ctx.fillStyle = '#2a1a18';
      ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.strokeStyle = '#5a2a26';
      ctx.strokeRect(h.x + 0.5, h.y + 0.5, h.w - 1, h.h - 1);
      ctx.strokeStyle = '#7a4030';
      ctx.beginPath();
      ctx.moveTo(h.x + 4, h.y + 4);
      ctx.lineTo(h.x + h.w - 4, h.y + h.h - 4);
      ctx.moveTo(h.x + h.w - 4, h.y + 4);
      ctx.lineTo(h.x + 4, h.y + h.h - 4);
      ctx.stroke();
    }

    // Exits (under player)
    for (const s of this.exitStairs) s.render(ctx);

    // Obstacles
    for (const o of this.map.obstacles) renderObstacle(ctx, o);

    // Fear objects share a single pulse value so the flicker/sway/steam reads
    // as one ambient rhythm in the basement.
    const fearPulse = (Math.sin(this.flicker * 1.4) + 1) / 2;
    for (const f of this.map.fearObjects) renderFearObject(ctx, f, fearPulse);

    // Containers (after obstacles so they sit on top visually)
    for (const c of this.containers) c.render(ctx);

    // Items
    for (const it of this.items) it.render(ctx);
    for (const s of this.stalkers) s.render(ctx);
    this.player.render(ctx);

    // Container progress bars (above everything in world space)
    for (const c of this.containers) {
      c.renderProgressBar(ctx);
      c.renderQTE(ctx);
    }

    // Climb-extract progress bar above the Up stair you're climbing
    if (this.climbingExit && this.climbProgress > 0) {
      const s = this.climbingExit;
      const bw = s.w + 12;
      const bx = s.x - 6;
      const by = s.y - 12;
      rect(ctx, bx, by, bw, 4, '#1a1218', '#3a2c1a');
      const pct = Math.min(1, this.climbProgress / (this.CLIMB_DURATION * game.climbDurationMultiplier()));
      rect(ctx, bx + 1, by + 1, (bw - 2) * pct, 2, '#9ed79a');
    }

    ctx.restore();

    // Darkness lighting around player — head-repaired bonus widens the light.
    const lightR =
      200 - Math.min(80, this.depth * 12) + game.lightRadiusBonus() + this.modifier.lightRadiusBonus;
    const lightFlicker = Math.sin(this.flicker * 9) * 6 + Math.sin(this.flicker * 3.3) * 4;
    darkness(
      ctx,
      this.player.x - this.cameraX,
      this.player.y - this.cameraY,
      lightR + lightFlicker,
      0.94,
    );

    // Stalker vision cone — drawn AFTER darkness so the player can see
    // where the stalker is looking even when the stalker is itself in the dark.
    ctx.save();
    ctx.translate(-this.cameraX, -this.cameraY);
    for (const s of this.stalkers) s.renderCone(ctx);
    ctx.restore();

    // HUD
    renderRunHud(
      ctx,
      game.carried,
      this.panic,
      this.depth,
      game.carrySlots(),
      // Show only what was actually loaded into this run, not the workshop.
      game.save.loadout,
      this.phase !== 'playing' ? this.message : undefined,
    );

    // Counts on the side
    const upCount = this.map.exits.filter((e) => e.dir === 'up').length;
    const downCount = this.map.exits.filter((e) => e.dir === 'down').length;
    text(ctx, `exits  ↑ ${upCount}   ↓ ${downCount}`, 12, 56, {
      size: 11,
      color: '#7c6f5e',
      font: "'Special Elite', monospace",
    });

    if (this.hint && this.phase === 'playing') {
      text(ctx, this.hint, W / 2, H - 86, {
        align: 'center',
        size: 13,
        color: '#c9b9a4',
        font: "'Special Elite', monospace",
      });
    }

    if (this.phase !== 'playing') {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, H / 2 - 40, W, 80);
    }

    // FTUE quest banner — always visible at the top while the tutorial runs.
    if (game.save.tutorialStep !== 'done') {
      const questText = QUEST_TEXT[game.save.tutorialStep];
      rect(ctx, W / 2 - 200, 14, 400, 28, 'rgba(40,10,20,0.85)', '#7a3030');
      text(ctx, '› ' + questText, W / 2, 22, {
        align: 'center',
        size: 13,
        color: '#ffd76a',
        font: "'Special Elite', monospace",
      });
    }

    // "Tonight..." modifier banner — fades in for the first ~0.4s, then fades
    // out over the last ~1s of the timer.
    if (this.modifierBannerTimer > 0) {
      const elapsed = 4 - this.modifierBannerTimer;
      let alpha = 1;
      if (elapsed < 0.4) alpha = elapsed / 0.4;
      else if (this.modifierBannerTimer < 1) alpha = this.modifierBannerTimer / 1;
      alpha = Math.max(0, Math.min(1, alpha));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 80, W, 70);
      text(ctx, this.modifier.name, W / 2, 96, {
        align: 'center',
        size: 22,
        color: '#a5526a',
        font: "'Special Elite', monospace",
      });
      text(ctx, this.modifier.flavor, W / 2, 124, {
        align: 'center',
        size: 12,
        color: '#c9b9a4',
        font: "'Special Elite', monospace",
      });
      ctx.restore();
    }

    this.journal.render(ctx, game);
    renderNotifications(ctx, game);
  }

  onClick(x: number, y: number): void {
    this.journal.onClick(x, y);
  }
}
