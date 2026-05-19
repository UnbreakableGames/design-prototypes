import type { FoodKind, FoodSpec } from '../game/types';
import { WORLD } from '../game/types';

const GRAVITY = 900;
const AIR_DRAG = 0.4;
const GROUND_BOUNCE = 0.25;
const GROUND_FRICTION = 0.55;
const WALL_BOUNCE = 0.35;
const SETTLE_SPEED = 6;

let nextFoodId = 1;

/** XP feeder. Ejects from the cliff like gold loot, falls under gravity, and
 *  settles in the loot band. Stays put once settled — the only way to consume
 *  it is a direct click (runners never pick food up). */
export class FoodDrop {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: FoodKind;
  spec: FoodSpec;
  collected = false;
  settled = false;
  settleT = 0;
  /** Spawn time used for the wiggle/pulse animation. */
  t = 0;

  constructor(x: number, y: number, spec: FoodSpec) {
    this.id = nextFoodId++;
    this.x = x;
    this.y = y;
    this.kind = spec.kind;
    this.spec = spec;
    // Eject outward + upward like Loot does, so food arcs from the cliff face
    // toward the play area.
    this.vx = -80 - Math.random() * 160;
    this.vy = -120 - Math.random() * 140;
  }

  update(dt: number) {
    this.t += dt;
  }

  applyGravity(dt: number) {
    if (this.collected) return;
    this.vy += GRAVITY * dt;
    this.vx *= 1 - AIR_DRAG * dt;
  }

  integrate(dt: number) {
    if (this.collected) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  clampToWorld() {
    if (this.collected) return;
    const groundTop = WORLD.groundY - this.spec.size;
    if (this.y > groundTop) {
      this.y = groundTop;
      if (this.vy > 60) this.vy = -this.vy * GROUND_BOUNCE;
      else this.vy = 0;
      this.vx *= GROUND_FRICTION;
    }
    const cliffFace = WORLD.mountainX - this.spec.size;
    if (this.x > cliffFace) {
      this.x = cliffFace;
      if (this.vx > 0) this.vx = -this.vx * WALL_BOUNCE;
      else this.vx *= GROUND_FRICTION;
    }
    const leftBound = WORLD.spitterX + 40 + this.spec.size;
    if (this.x < leftBound) {
      this.x = leftBound;
      if (this.vx < 0) this.vx = -this.vx * WALL_BOUNCE;
    }
  }

  checkSettle(dt: number) {
    if (this.collected) return;
    const speed2 = this.vx * this.vx + this.vy * this.vy;
    const onGround = this.y >= WORLD.groundY - this.spec.size - 0.5;
    if (speed2 < SETTLE_SPEED * SETTLE_SPEED && onGround) {
      this.settleT += dt;
      if (this.settleT > 0.15) this.settled = true;
    } else {
      this.settleT = 0;
      this.settled = false;
    }
  }

  containsPoint(px: number, py: number): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const r = this.spec.size + 4;
    return dx * dx + dy * dy <= r * r;
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.collected) return;
    // Settled food gets a gentle bob so it reads as "alive" / clickable; in-air
    // food draws at its raw position so the arc looks crisp.
    const wob = this.settled ? Math.sin(this.t * 4) * 1.5 : 0;
    const cy = this.y + wob;
    const s = this.spec.size;

    // Soft halo helps the food pop against the dirt ground / cliff.
    const halo = ctx.createRadialGradient(this.x, cy, 0, this.x, cy, s + 10);
    halo.addColorStop(0, 'rgba(255, 240, 180, 0.45)');
    halo.addColorStop(1, 'rgba(255, 240, 180, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(this.x, cy, s + 10, 0, Math.PI * 2);
    ctx.fill();

    switch (this.kind) {
      case 'cheese':    drawCheese(ctx, this.x, cy, s, this.spec.color, this.spec.outline); break;
      case 'egg':       drawEgg(ctx, this.x, cy, s, this.spec.color, this.spec.outline); break;
      case 'drumstick': drawDrumstick(ctx, this.x, cy, s, this.spec.color, this.spec.outline); break;
      case 'pizza':     drawPizza(ctx, this.x, cy, s, this.spec.color, this.spec.outline); break;
    }
  }
}

function drawCheese(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string, outline: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.5);
  ctx.lineTo(x + s, y + s * 0.5);
  ctx.lineTo(x, y - s * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = outline;
  ctx.beginPath();
  ctx.arc(x - s * 0.25, y + s * 0.15, 1.6, 0, Math.PI * 2);
  ctx.arc(x + s * 0.2, y + s * 0.25, 1.4, 0, Math.PI * 2);
  ctx.arc(x, y - s * 0.2, 1.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawEgg(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string, outline: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x, y, s * 0.78, s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.25, y - s * 0.35, s * 0.18, s * 0.3, -0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawDrumstick(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string, outline: string) {
  ctx.fillStyle = fill;
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(x - s * 0.2, y - s * 0.1, s * 0.7, s * 0.55, 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f0e8d0';
  ctx.strokeStyle = outline;
  ctx.beginPath();
  ctx.ellipse(x + s * 0.55, y + s * 0.45, s * 0.32, s * 0.18, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,230,180,0.5)';
  ctx.beginPath();
  ctx.ellipse(x - s * 0.35, y - s * 0.3, s * 0.15, s * 0.22, 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function drawPizza(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fill: string, outline: string) {
  ctx.fillStyle = '#e0b070';
  ctx.strokeStyle = outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.85, y + s * 0.55);
  ctx.lineTo(x - s * 0.85, y + s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.78);
  ctx.lineTo(x + s * 0.7, y + s * 0.42);
  ctx.lineTo(x - s * 0.7, y + s * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#b03040';
  ctx.beginPath();
  ctx.arc(x - s * 0.2, y, 1.8, 0, Math.PI * 2);
  ctx.arc(x + s * 0.2, y + s * 0.1, 1.8, 0, Math.PI * 2);
  ctx.arc(x, y + s * 0.3, 1.6, 0, Math.PI * 2);
  ctx.fill();
}
