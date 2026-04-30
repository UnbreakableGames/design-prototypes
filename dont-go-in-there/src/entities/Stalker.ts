import { hasLineOfSight, isWalkable, type BasementMap, type WaypointPath } from '../systems/Procgen';

export type StalkerState = 'patrol' | 'scan' | 'chase' | 'investigate';

export class Stalker {
  x: number;
  y: number;
  radius = 14;
  state: StalkerState = 'patrol';
  facing = 0;
  speedPatrol = 50;
  speedChase = 110;
  speedInvestigate = 70;
  visionRange = 120;
  visionHalfAngle = Math.PI / 6; // 30° each side → 60° cone

  private waypoints: WaypointPath;
  private wpIndex = 0;
  private scanPhase: 'hold-pre' | 'sweep1' | 'hold-mid' | 'sweep2' | 'hold-post' = 'hold-pre';
  private scanPhaseTimer = 0;
  private scanArc = 0;
  private scanSweepDuration = 1.4;
  private scanFromAngle = 0;
  private scanToAngle = 0;
  private scanDoubleBack = false;
  private holdPreDuration = 1.4;
  private holdMidDuration = 0.7;
  private holdPostDuration = 1.2;
  private lostTimer = 0;
  private lastSeenX = 0;
  private lastSeenY = 0;
  private stuckTimer = 0;
  private prevX = 0;
  private prevY = 0;

  constructor(waypoints: WaypointPath) {
    this.waypoints = waypoints.length > 0 ? waypoints : [{ x: 0, y: 0 }];
    const wp = this.waypoints[0]!;
    this.x = wp.x;
    this.y = wp.y;
    const next = this.waypoints[Math.min(1, this.waypoints.length - 1)]!;
    this.facing = Math.atan2(next.y - wp.y, next.x - wp.x);
    this.prevX = this.x;
    this.prevY = this.y;
  }

  update(dt: number, map: BasementMap, playerX: number, playerY: number): void {
    const sees = this.canSee(playerX, playerY, map);
    if (sees) {
      this.state = 'chase';
      this.lastSeenX = playerX;
      this.lastSeenY = playerY;
      this.lostTimer = 0;
    }

    switch (this.state) {
      case 'patrol':
        this.tickPatrol(dt, map);
        break;
      case 'scan':
        this.tickScan(dt);
        break;
      case 'chase':
        this.tickChase(dt, map, playerX, playerY);
        break;
      case 'investigate':
        this.tickInvestigate(dt, map);
        break;
    }

    if (this.state === 'patrol' || this.state === 'investigate') {
      const moved = Math.hypot(this.x - this.prevX, this.y - this.prevY);
      if (moved < 0.4) {
        this.stuckTimer += dt;
        if (this.stuckTimer > 1.0) {
          if (this.state === 'patrol') this.advanceWaypoint();
          else this.beginScan(Math.PI * 1.4, 1.6);
          this.stuckTimer = 0;
        }
      } else {
        this.stuckTimer = 0;
      }
    } else {
      this.stuckTimer = 0;
    }

    this.prevX = this.x;
    this.prevY = this.y;
  }

  private tickPatrol(dt: number, map: BasementMap): void {
    const wp = this.waypoints[this.wpIndex]!;
    const d = Math.hypot(wp.x - this.x, wp.y - this.y);
    if (d < 14) {
      this.beginScan((Math.random() < 0.5 ? -1 : 1) * (Math.PI * 0.6 + Math.random() * Math.PI * 0.4), 1.4);
      return;
    }
    this.faceToward(wp.x, wp.y, dt * 0.7);
    this.moveToward(wp.x, wp.y, this.speedPatrol * dt, map);
  }

  private tickScan(dt: number): void {
    this.scanPhaseTimer += dt;
    switch (this.scanPhase) {
      case 'hold-pre':
        if (this.scanPhaseTimer >= this.holdPreDuration) {
          this.scanPhase = 'sweep1';
          this.scanPhaseTimer = 0;
          this.scanFromAngle = this.facing;
          this.scanToAngle = this.facing + this.scanArc;
        }
        break;
      case 'sweep1': {
        const t = Math.min(1, this.scanPhaseTimer / this.scanSweepDuration);
        this.facing = normalizeAngle(
          this.scanFromAngle + (this.scanToAngle - this.scanFromAngle) * easeInOut(t),
        );
        if (this.scanPhaseTimer >= this.scanSweepDuration) {
          if (this.scanDoubleBack) {
            this.scanPhase = 'hold-mid';
          } else {
            this.scanPhase = 'hold-post';
          }
          this.scanPhaseTimer = 0;
        }
        break;
      }
      case 'hold-mid':
        if (this.scanPhaseTimer >= this.holdMidDuration) {
          this.scanPhase = 'sweep2';
          this.scanPhaseTimer = 0;
          this.scanFromAngle = this.facing;
          this.scanToAngle = this.facing - this.scanArc * 0.85;
        }
        break;
      case 'sweep2': {
        const t = Math.min(1, this.scanPhaseTimer / this.scanSweepDuration);
        this.facing = normalizeAngle(
          this.scanFromAngle + (this.scanToAngle - this.scanFromAngle) * easeInOut(t),
        );
        if (this.scanPhaseTimer >= this.scanSweepDuration) {
          this.scanPhase = 'hold-post';
          this.scanPhaseTimer = 0;
        }
        break;
      }
      case 'hold-post':
        if (this.scanPhaseTimer >= this.holdPostDuration) {
          this.advanceWaypoint();
          this.state = 'patrol';
        }
        break;
    }
  }

  private tickChase(dt: number, map: BasementMap, px: number, py: number): void {
    this.faceToward(px, py, dt * 1.4);
    this.moveToward(px, py, this.speedChase * dt, map);
    if (!this.canSee(px, py, map)) {
      this.lostTimer += dt;
      if (this.lostTimer > 0.45) {
        this.state = 'investigate';
        this.lostTimer = 0;
      }
    } else {
      this.lostTimer = 0;
    }
  }

  private tickInvestigate(dt: number, map: BasementMap): void {
    const d = Math.hypot(this.lastSeenX - this.x, this.lastSeenY - this.y);
    if (d < 14) {
      this.beginScan(Math.PI * 1.4, 1.8);
      return;
    }
    this.faceToward(this.lastSeenX, this.lastSeenY, dt * 1.0);
    this.moveToward(this.lastSeenX, this.lastSeenY, this.speedInvestigate * dt, map);
  }

  private beginScan(arc: number, sweepDuration: number): void {
    this.state = 'scan';
    this.scanPhase = 'hold-pre';
    this.scanPhaseTimer = 0;
    this.scanArc = arc;
    this.scanSweepDuration = sweepDuration;
    this.scanFromAngle = this.facing;
    this.scanToAngle = this.facing;
    this.scanDoubleBack = Math.random() < 0.55;
    this.holdPreDuration = 1.2 + Math.random() * 1.2;
    this.holdMidDuration = 0.6 + Math.random() * 0.6;
    this.holdPostDuration = 1.0 + Math.random() * 1.0;
  }

  private advanceWaypoint(): void {
    this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;
  }

  private canSee(targetX: number, targetY: number, map: BasementMap): boolean {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const d = Math.hypot(dx, dy);
    if (d > this.visionRange) return false;
    if (d > 0.001) {
      const angleToTarget = Math.atan2(dy, dx);
      const diff = Math.abs(normalizeAngle(angleToTarget - this.facing));
      if (diff > this.visionHalfAngle) return false;
    }
    return hasLineOfSight(map, this.x, this.y, targetX, targetY);
  }

  private faceToward(tx: number, ty: number, t: number): void {
    const target = Math.atan2(ty - this.y, tx - this.x);
    const diff = normalizeAngle(target - this.facing);
    const turn = Math.min(Math.abs(diff), t * 2);
    this.facing = normalizeAngle(this.facing + Math.sign(diff) * turn);
  }

  private moveToward(tx: number, ty: number, step: number, map: BasementMap): void {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.001) return;
    const ux = dx / d;
    const uy = dy / d;
    this.tryStep(ux * step, 0, map);
    this.tryStep(0, uy * step, map);
  }

  private tryStep(dx: number, dy: number, map: BasementMap): void {
    const nx = this.x + dx;
    const ny = this.y + dy;
    if (!isWalkable(map, nx, ny)) return;
    const r = this.radius - 4;
    for (const o of map.obstacles) {
      if (nx > o.x - r && nx < o.x + o.w + r && ny > o.y - r && ny < o.y + o.h + r) return;
    }
    for (const c of map.containers) {
      if (nx > c.x - r && nx < c.x + c.w + r && ny > c.y - r && ny < c.y + c.h + r) return;
    }
    this.x = nx;
    this.y = ny;
  }

  hits(playerX: number, playerY: number, playerR: number): boolean {
    const d = Math.hypot(playerX - this.x, playerY - this.y);
    return d < this.radius + playerR;
  }

  renderCone(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    const isChase = this.state === 'chase';
    const r = this.visionRange;
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, r);
    if (isChase) {
      grad.addColorStop(0, 'rgba(165,82,106,0.50)');
      grad.addColorStop(0.6, 'rgba(165,82,106,0.18)');
      grad.addColorStop(1, 'rgba(165,82,106,0)');
    } else {
      grad.addColorStop(0, 'rgba(255,215,140,0.28)');
      grad.addColorStop(0.6, 'rgba(255,200,120,0.10)');
      grad.addColorStop(1, 'rgba(255,200,120,0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.arc(this.x, this.y, r, this.facing - this.visionHalfAngle, this.facing + this.visionHalfAngle);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = isChase ? 'rgba(180,90,110,0.55)' : 'rgba(255,215,140,0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(
      this.x + Math.cos(this.facing - this.visionHalfAngle) * r,
      this.y + Math.sin(this.facing - this.visionHalfAngle) * r,
    );
    ctx.lineTo(this.x, this.y);
    ctx.lineTo(
      this.x + Math.cos(this.facing + this.visionHalfAngle) * r,
      this.y + Math.sin(this.facing + this.visionHalfAngle) * r,
    );
    ctx.stroke();
    ctx.restore();
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#0a0608';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.state === 'chase' ? '#a5526a' : '#3a2c2c';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius - 3, 0, Math.PI * 2);
    ctx.fill();
    const ex = this.x + Math.cos(this.facing) * (this.radius - 5);
    const ey = this.y + Math.sin(this.facing) * (this.radius - 5);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(ex, ey, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}
