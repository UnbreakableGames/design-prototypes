import type { LootKind, LootShape, LootSpec } from '../game/types';
import { RECLAIM_DURATION, WORLD } from '../game/types';

const GRAVITY = 900;
const AIR_DRAG = 0.4;
const GROUND_BOUNCE = 0.25;
const GROUND_FRICTION = 0.55;
const WALL_BOUNCE = 0.35;
const SETTLE_SPEED = 6;

export class Loot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: LootKind;
  shape: LootShape;
  value: number;
  color: string;
  outline: string;
  size: number; // collision radius
  rotation: number;
  rotSpeed: number;
  // Pickup lifecycle
  claimedBy: number | null = null;
  carriedBy: number | null = null;
  collected = false;
  // Physics state
  settled = false;
  settleT = 0;
  // Reclaim state — when the mountain absorbs this loot
  reclaiming = false;
  reclaimT = 0;
  reclaimStartX = 0;
  reclaimStartY = 0;
  reclaimTargetX = 0;
  reclaimTargetY = 0;

  constructor(x: number, y: number, spec: LootSpec) {
    this.x = x;
    this.y = y;
    this.kind = spec.kind;
    this.shape = spec.shape;
    this.size = spec.size;
    this.color = spec.color;
    this.outline = spec.outline;
    this.value = spec.value;
    // Spit outward from the cliff: leftward + upward arc with variance
    this.vx = -80 - Math.random() * 160;
    this.vy = -120 - Math.random() * 140;
    this.rotation = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 6;
  }

  applyGravity(dt: number) {
    if (this.collected || this.carriedBy !== null || this.reclaiming) return;
    this.vy += GRAVITY * dt;
    this.vx *= 1 - AIR_DRAG * dt;
  }

  integrate(dt: number) {
    if (this.collected || this.carriedBy !== null || this.reclaiming) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.rotation += this.rotSpeed * dt;
  }

  /** Mountain absorbs this loot. Tweens it on an arc back into the cliff face. */
  startReclaim(targetX: number, targetY: number) {
    this.reclaiming = true;
    this.reclaimT = 0;
    this.reclaimStartX = this.x;
    this.reclaimStartY = this.y;
    this.reclaimTargetX = targetX;
    this.reclaimTargetY = targetY;
    this.claimedBy = null;
    this.settled = false;
    this.rotSpeed = 6;
  }

  updateReclaim(dt: number) {
    if (!this.reclaiming || this.collected) return;
    this.reclaimT += dt;
    const t = Math.min(1, this.reclaimT / RECLAIM_DURATION);
    const arcHeight = 70;
    this.x = this.reclaimStartX + (this.reclaimTargetX - this.reclaimStartX) * t;
    this.y =
      this.reclaimStartY +
      (this.reclaimTargetY - this.reclaimStartY) * t -
      arcHeight * Math.sin(t * Math.PI);
    this.rotation += this.rotSpeed * dt;
    if (t >= 1) {
      this.collected = true;
    }
  }

  // Resolve hard constraints (ground / cliff face / left bound). Called after pair-collision
  // pass so positions don't tunnel through world bounds when neighbours nudge them.
  clampToWorld() {
    if (this.collected || this.carriedBy !== null || this.reclaiming) return;

    const groundTop = WORLD.groundY - this.size;
    if (this.y > groundTop) {
      this.y = groundTop;
      if (this.vy > 60) {
        this.vy = -this.vy * GROUND_BOUNCE;
      } else {
        this.vy = 0;
      }
      this.vx *= GROUND_FRICTION;
      this.rotSpeed *= 0.6;
    }

    const cliffFace = WORLD.mountainX - this.size;
    if (this.x > cliffFace) {
      this.x = cliffFace;
      if (this.vx > 0) this.vx = -this.vx * WALL_BOUNCE;
      else this.vx *= GROUND_FRICTION;
    }

    // Left bound: loot can't spread past the spitter stack — keeps the pile
    // contained to the right of the spitters so the play area stays readable
    // and runners have a defined haul distance.
    const leftBound = WORLD.spitterX + 40 + this.size;
    if (this.x < leftBound) {
      this.x = leftBound;
      if (this.vx < 0) this.vx = -this.vx * WALL_BOUNCE;
    }
  }

  checkSettle(dt: number) {
    if (this.collected || this.carriedBy !== null || this.reclaiming) return;
    const speed2 = this.vx * this.vx + this.vy * this.vy;
    const onGround = this.y >= WORLD.groundY - this.size - 0.5;
    if (speed2 < SETTLE_SPEED * SETTLE_SPEED && onGround) {
      this.settleT += dt;
      if (this.settleT > 0.15) {
        this.settled = true;
        this.rotSpeed *= 0.7;
      }
    } else {
      this.settleT = 0;
      this.settled = false;
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (this.collected) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    if (this.shape === 'coin') {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(0, 0, this.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = this.outline;
      ctx.lineWidth = 1;
      ctx.stroke();
      // inner highlight
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(-this.size * 0.3, -this.size * 0.3, this.size * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Diamond gem shape
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.moveTo(0, -this.size);
      ctx.lineTo(this.size, 0);
      ctx.lineTo(0, this.size);
      ctx.lineTo(-this.size, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = this.outline;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      // gem facet shine
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.moveTo(-this.size * 0.6, -this.size * 0.1);
      ctx.lineTo(-this.size * 0.2, -this.size * 0.5);
      ctx.lineTo(0, -this.size * 0.2);
      ctx.lineTo(-this.size * 0.3, this.size * 0.1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
