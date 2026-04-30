import type { Scene } from './Scene';
import type { Game } from '../game/Game';
import type { Input } from '../systems/Input';
import { Player, type Rect } from '../entities/Player';
import { ItemPickup } from '../entities/ItemPickup';
import { Stalker } from '../entities/Stalker';
import { Stairs } from '../entities/Stairs';
import { Container } from '../entities/Container';
import { renderObstacle } from '../entities/Obstacle';
import { generate, isWalkable, type BasementMap, type Exit } from '../systems/Procgen';
import { rect, text, darkness, W, H, dist } from '../systems/Render';
import { ALL_ITEMS, totalItems, type ItemKind } from '../types';
import { CARRY_SLOTS, renderRunHud } from '../ui/HUD';

const VIEW_W = W;
const VIEW_H = H;

type Phase = 'playing' | 'caught' | 'extracting';

export class Basement implements Scene {
  private map!: BasementMap;
  private player!: Player;
  private items!: ItemPickup[];
  private containers!: Container[];
  private stalker!: Stalker;
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

  enter(): void {
    this.regenerate(1, Date.now());
  }

  exit(): void {}

  private regenerate(depth: number, seed: number, resetPanic = true): void {
    this.depth = depth;
    this.map = generate(seed, depth);
    this.player = new Player(this.map.startX, this.map.startY);
    this.items = this.map.items.map((it) => new ItemPickup(it.x, it.y, it.kind));
    this.containers = this.map.containers.map((c) => new Container(c));
    this.stalker = new Stalker(this.map.stalkerWaypoints);
    this.exitStairs = this.map.exits.map((e) => new Stairs(e.x, e.y, e.dir));
    if (resetPanic) this.panic = 0;
    this.phase = 'playing';
    this.phaseTimer = 0;
  }

  private obstaclesAsWalls(): Rect[] {
    const obs = this.map.obstacles.map((o) => ({ x: o.x, y: o.y, w: o.w, h: o.h }));
    const cont = this.map.containers.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h }));
    return [...obs, ...cont];
  }

  update(dt: number, input: Input, game: Game): void {
    this.flicker += dt;

    if (this.phase !== 'playing') {
      this.phaseTimer += dt;
      if (this.phaseTimer > 1.6) {
        if (this.phase === 'caught') {
          game.loseCarried();
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

    this.player.update(
      dt,
      input,
      this.obstaclesAsWalls(),
      { x: 0, y: 0, w: this.map.worldW, h: this.map.worldH },
      (x, y) => isWalkable(this.map, x, y),
    );

    this.cameraX = Math.max(0, Math.min(this.map.worldW - VIEW_W, this.player.x - VIEW_W / 2));
    this.cameraY = Math.max(0, Math.min(this.map.worldH - VIEW_H, this.player.y - VIEW_H / 2));

    for (const it of this.items) {
      it.update(dt);
      if (it.taken) continue;
      const inRange = dist(it.x, it.y, this.player.x, this.player.y) < 18;
      if (!it.pickupArmed && !inRange) it.pickupArmed = true;
      if (it.pickupArmed && inRange && totalItems(game.carried) < CARRY_SLOTS) {
        it.taken = true;
        game.carried[it.kind]++;
      }
    }

    // Drop carried items via number keys (1-4 = the four HUD slots, in order)
    for (let slot = 1; slot <= CARRY_SLOTS; slot++) {
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

    this.stalker.update(dt, this.map, this.player.x, this.player.y);
    if (this.stalker.hits(this.player.x, this.player.y, this.player.radius)) {
      this.phase = 'caught';
      this.phaseTimer = 0;
      this.message = 'CAUGHT';
      return;
    }

    let panicRate = 1.4;
    const distStalker = dist(this.stalker.x, this.stalker.y, this.player.x, this.player.y);
    if (distStalker < 160) panicRate += 6 * (1 - distStalker / 160);
    if (this.stalker.state === 'chase') panicRate += 4;
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
    this.panic = Math.min(100, this.panic + panicRate * dt);
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

    // Hold Space to open the nearest container; progress decays if released
    let openingActive = false;
    if (containerInRange && nearContainer && input.held('Space')) {
      openingActive = true;
      nearContainer.openProgress += dt;
      if (nearContainer.openProgress >= nearContainer.duration()) {
        this.openContainer(nearContainer);
      }
    } else if (nearContainer && nearContainer.openProgress > 0) {
      nearContainer.openProgress = Math.max(0, nearContainer.openProgress - dt * 1.6);
    }

    // Find nearest exit
    this.hint = '';
    let nearestExit: Exit | null = null;
    let nearestDist = Infinity;
    for (const e of this.map.exits) {
      const d = dist(this.player.x, this.player.y, e.x, e.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearestExit = e;
      }
    }

    // Hint priority: container interaction > exit
    if (containerInRange && nearContainer) {
      this.hint = `[hold space] open ${nearContainer.spec.kind}`;
    } else if (nearestExit && nearestDist < 30) {
      this.hint = nearestExit.dir === 'up' ? '[space] climb up & extract' : '[space] descend deeper';
    }

    // Don't fire exit interaction while holding Space to open a container,
    // otherwise pressing Space near both would trigger both.
    if (!openingActive && input.pressed('Space') && nearestExit && nearestDist < 30) {
      if (nearestExit.dir === 'up') {
        this.phase = 'extracting';
        this.phaseTimer = 0;
        this.message = 'EXTRACTED';
        game.recordDepth(this.depth);
      } else {
        game.recordDepth(this.depth);
        this.regenerate(this.depth + 1, Date.now(), false);
      }
    }
  }

  private openContainer(c: Container): void {
    c.isOpen = true;
    c.openProgress = c.duration();
    // Each item pops out with a randomized direction + small velocity, so
    // they spread on the floor instead of stacking. Pickups land disarmed
    // (player will likely still be standing on the container).
    const baseAngle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    for (let i = 0; i < c.spec.items.length; i++) {
      const a = baseAngle + (i - (c.spec.items.length - 1) / 2) * 0.7 + (Math.random() - 0.5) * 0.3;
      const speed = 70 + Math.random() * 50;
      const pickup = new ItemPickup(c.cx(), c.cy(), c.spec.items[i]!);
      pickup.vx = Math.cos(a) * speed;
      pickup.vy = Math.sin(a) * speed;
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

    // Containers (after obstacles so they sit on top visually)
    for (const c of this.containers) c.render(ctx);

    // Items
    for (const it of this.items) it.render(ctx);
    this.stalker.render(ctx);
    this.player.render(ctx);

    // Container progress bars (above everything in world space)
    for (const c of this.containers) c.renderProgressBar(ctx);

    ctx.restore();

    // Darkness lighting around player
    const lightR = 200 - Math.min(80, this.depth * 12);
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
    this.stalker.renderCone(ctx);
    ctx.restore();

    // HUD
    renderRunHud(
      ctx,
      game.carried,
      this.panic,
      this.depth,
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
  }
}
