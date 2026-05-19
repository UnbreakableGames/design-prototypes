import type { DamageType, ProjectileKind, SlimeVariantId } from '../game/types';
import { WORLD } from '../game/types';
import type { MountainGoon } from './MountainGoon';

/** Callback environment given to each Projectile.update tick. The Game wires
 *  these up so projectiles can apply damage, spawn child projectiles, and
 *  trigger camera shake without knowing anything about Game internals. */
export interface ProjectileCtx {
  cliffLeft: number;
  cliffTop: number;
  cliffBottom: number;
  groundY: number;
  /** Apply damage at a point on/near the cliff. */
  applyHit: (x: number, y: number, damage: number, type: DamageType, source: Projectile) => void;
  /** Add a new projectile (used by Cluster, Mortar). */
  spawn: (p: Projectile) => void;
  /** Camera shake intensity (0..1ish). */
  shake?: (intensity: number) => void;
  /** Live goon list (used by Pinball to hop between them). */
  goons: MountainGoon[];
}

export interface ProjectileInit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  kind?: ProjectileKind;
  damageType?: DamageType;
  // Origin point (for boomerang return, lazer source).
  originX?: number;
  originY?: number;
  /** Damage multiplier vs. goons (anti-goon variants set this to 2). */
  vsGoonMul?: number;
  /** Source variant id. Used by the boss weakness system to multiply damage
   *  when the firing bee is on the boss's weak list. */
  variantId?: SlimeVariantId;
}

const GRAVITY_DEFAULT = 240;
const GRAVITY_CANNONBALL = 380;
const GRAVITY_MORTAR = 320;
const GRAVITY_SKIP = 600;

export class Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  kind: ProjectileKind;
  damageType: DamageType;
  vsGoonMul: number;
  variantId: SlimeVariantId | null;
  alive = true;
  age = 0;
  originX: number;
  originY: number;
  // Per-kind state
  hitCount = 0;
  bounceCount = 0;
  embedded = false;
  embedTickT = 0;
  embedDuration = 0;
  embedX = 0;
  embedY = 0;
  phase: 'travel' | 'returning' | 'orbiting' | 'embedded' | 'done' = 'travel';
  split = false;
  orbitT = 0;
  orbitCenterX = 0;
  orbitCenterY = 0;
  orbitAngle = 0;
  groundBounces = 0;
  // Pinball goon-hopping state
  goonTarget: MountainGoon | null = null;
  lastGoonHit: MountainGoon | null = null;
  // Visual
  rotation = 0;
  rotSpeed = 0;
  trail: Array<{ x: number; y: number }> = [];

  constructor(init: ProjectileInit) {
    this.x = init.x;
    this.y = init.y;
    this.vx = init.vx;
    this.vy = init.vy;
    this.damage = init.damage;
    this.color = init.color;
    this.kind = init.kind ?? 'bullet';
    this.damageType = init.damageType ?? 'physical';
    this.vsGoonMul = init.vsGoonMul ?? 1;
    this.variantId = init.variantId ?? null;
    this.originX = init.originX ?? init.x;
    this.originY = init.originY ?? init.y;
    if (this.kind === 'boomerang' || this.kind === 'driller' || this.kind === 'skip') {
      this.rotSpeed = 14;
    }
  }

  private isInCliff(ctx: ProjectileCtx): boolean {
    return (
      this.x >= ctx.cliffLeft &&
      this.x <= ctx.cliffLeft + 30 &&
      this.y >= ctx.cliffTop &&
      this.y <= ctx.cliffBottom
    );
  }

  private outOfBounds(): boolean {
    return this.y > WORLD.groundY + 30 || this.x > WORLD.width + 40 || this.x < -40;
  }

  update(dt: number, ctx: ProjectileCtx) {
    this.age += dt;
    if (this.rotSpeed) this.rotation += this.rotSpeed * dt;
    switch (this.kind) {
      case 'bullet':     this.updateBullet(dt, ctx); break;
      case 'spear':      this.updateSpear(dt, ctx); break;
      case 'cannonball': this.updateCannonball(dt, ctx); break;
      case 'lazer':      this.updateLazer(dt, ctx); break;
      case 'cluster':    this.updateCluster(dt, ctx); break;
      case 'mortar':     this.updateMortar(dt, ctx); break;
      case 'pinball':    this.updatePinball(dt, ctx); break;
      case 'ricochet':   this.updateRicochet(dt, ctx); break;
      case 'driller':    this.updateDriller(dt, ctx); break;
      case 'bouncer':    this.updateBouncer(dt, ctx); break;
      case 'boomerang':  this.updateBoomerang(dt, ctx); break;
      case 'orbiter':    this.updateOrbiter(dt, ctx); break;
      case 'skip':       this.updateSkip(dt, ctx); break;
    }
    if (this.age > 6) this.alive = false;
  }

  // === per-kind movement / impact ===

  private moveArc(dt: number, gravity = GRAVITY_DEFAULT) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += gravity * dt;
  }

  private updateBullet(dt: number, ctx: ProjectileCtx) {
    this.moveArc(dt);
    if (this.isInCliff(ctx)) {
      ctx.applyHit(this.x, this.y, this.damage, this.damageType, this);
      this.alive = false;
    }
    if (this.outOfBounds()) this.alive = false;
  }

  private updateSpear(dt: number, ctx: ProjectileCtx) {
    // straight line, no gravity, pierces 2 hits
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.isInCliff(ctx)) {
      ctx.applyHit(this.x, this.y, this.damage, this.damageType, this);
      this.hitCount++;
      // nudge forward so we don't re-trigger this frame
      this.x += 18;
      if (this.hitCount >= 2) this.alive = false;
    }
    if (this.outOfBounds()) this.alive = false;
  }

  private updateCannonball(dt: number, ctx: ProjectileCtx) {
    this.moveArc(dt, GRAVITY_CANNONBALL);
    if (this.isInCliff(ctx)) {
      ctx.applyHit(this.x, this.y, this.damage * 1.4, this.damageType, this);
      ctx.shake?.(0.5);
      this.alive = false;
    }
    if (this.outOfBounds()) this.alive = false;
  }

  private updateLazer(dt: number, ctx: ProjectileCtx) {
    // Instantaneous hit: on the first frame, apply damage at the cliff face
    // along the original aim direction. Beam stays visible for 0.18s.
    if (this.age - dt <= 0) {
      // Project to cliff X
      const dx = this.x - this.originX;
      const dy = this.y - this.originY;
      const distToCliff = ctx.cliffLeft - this.originX;
      const ratio = dx !== 0 ? distToCliff / dx : 1;
      const hitX = ctx.cliffLeft + 2;
      const hitY = Math.max(
        ctx.cliffTop + 4,
        Math.min(ctx.cliffBottom - 4, this.originY + dy * ratio)
      );
      // Store hit point for rendering the beam endpoint
      this.x = hitX;
      this.y = hitY;
      this.vx = 0;
      this.vy = 0;
      ctx.applyHit(hitX, hitY, this.damage, this.damageType, this);
    }
    if (this.age > 0.18) this.alive = false;
  }

  private updateCluster(dt: number, ctx: ProjectileCtx) {
    this.moveArc(dt);
    if (!this.split && this.age > 0.28) {
      this.split = true;
      // spawn 3 mini-bullets in a fan
      for (let i = -1; i <= 1; i++) {
        ctx.spawn(
          new Projectile({
            x: this.x,
            y: this.y,
            vx: this.vx * 0.95,
            vy: this.vy + i * 110,
            damage: this.damage / 3,
            color: this.color,
            kind: 'bullet',
            damageType: this.damageType,
            vsGoonMul: this.vsGoonMul,
            variantId: this.variantId ?? undefined,
          })
        );
      }
      this.alive = false;
      return;
    }
    if (this.isInCliff(ctx)) {
      ctx.applyHit(this.x, this.y, this.damage, this.damageType, this);
      this.alive = false;
    }
    if (this.outOfBounds()) this.alive = false;
  }

  private updateMortar(dt: number, ctx: ProjectileCtx) {
    this.moveArc(dt, GRAVITY_MORTAR);
    if (this.isInCliff(ctx)) {
      // Main impact
      ctx.applyHit(this.x, this.y, this.damage, this.damageType, this);
      // Fragments: 3 mini bullets scattering sideways from impact
      for (let i = 0; i < 3; i++) {
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.4;
        const speed = 140 + Math.random() * 80;
        ctx.spawn(
          new Projectile({
            x: this.x,
            y: this.y,
            vx: Math.cos(angle) * speed * 0.4,
            vy: Math.sin(angle) * speed,
            damage: this.damage * 0.5,
            color: this.color,
            kind: 'bullet',
            damageType: this.damageType,
            vsGoonMul: this.vsGoonMul,
            variantId: this.variantId ?? undefined,
          })
        );
      }
      this.alive = false;
    }
    if (this.outOfBounds()) this.alive = false;
  }

  private updatePinball(dt: number, ctx: ProjectileCtx) {
    // Pinball homes from den to den. Up to 5 hits, picking a new alive goon
    // (different from the last one if multiple exist). If no goons are alive,
    // falls and hits the cliff once like a regular shot.
    if (!this.goonTarget || !this.goonTarget.alive) {
      const aliveCount = ctx.goons.reduce((n, g) => n + (g.alive ? 1 : 0), 0);
      let best: MountainGoon | null = null;
      let bd = Infinity;
      for (const g of ctx.goons) {
        if (!g.alive) continue;
        if (g === this.lastGoonHit && aliveCount > 1) continue;
        const dx = g.x - this.x;
        const dy = g.y - this.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bd) {
          bd = d2;
          best = g;
        }
      }
      this.goonTarget = best;
    }

    if (this.goonTarget) {
      const dx = this.goonTarget.x - this.x;
      const dy = this.goonTarget.y - this.y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const speed = 500;
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (dist < 20) {
        // Route through applyHit so anti-goon mul + damage type still apply.
        ctx.applyHit(this.goonTarget.x, this.goonTarget.y, this.damage, this.damageType, this);
        this.lastGoonHit = this.goonTarget;
        this.goonTarget = null;
        this.bounceCount++;
        if (this.bounceCount >= 5) this.alive = false;
      }
      if (this.outOfBounds() || this.age > 3.5) this.alive = false;
    } else {
      // No goons — fall and hit the cliff like a regular shot.
      this.moveArc(dt);
      if (this.isInCliff(ctx)) {
        ctx.applyHit(this.x, this.y, this.damage, this.damageType, this);
        this.alive = false;
      }
      if (this.outOfBounds() || this.age > 3) this.alive = false;
    }
  }

  private updateRicochet(dt: number, ctx: ProjectileCtx) {
    this.moveArc(dt);
    if (this.isInCliff(ctx)) {
      ctx.applyHit(this.x, this.y, this.damage, this.damageType, this);
      this.hitCount++;
      if (this.hitCount === 1) {
        // Teleport to a second random spot on the cliff and re-fire as a small bullet
        const targetY = ctx.cliffTop + 20 + Math.random() * (ctx.cliffBottom - ctx.cliffTop - 40);
        const targetX = ctx.cliffLeft + 4;
        ctx.applyHit(targetX, targetY, this.damage * 0.7, this.damageType, this);
        this.alive = false;
      } else {
        this.alive = false;
      }
    }
    if (this.outOfBounds()) this.alive = false;
  }

  private updateDriller(dt: number, ctx: ProjectileCtx) {
    if (!this.embedded) {
      this.moveArc(dt);
      if (this.isInCliff(ctx)) {
        this.embedded = true;
        this.embedX = this.x;
        this.embedY = this.y;
        this.embedDuration = 1.2;
        this.embedTickT = 0;
        this.vx = 0;
        this.vy = 0;
        ctx.applyHit(this.x, this.y, this.damage * 0.5, this.damageType, this);
      } else if (this.outOfBounds()) {
        this.alive = false;
      }
    } else {
      // Embedded: tick damage
      this.embedTickT -= dt;
      if (this.embedTickT <= 0) {
        this.embedTickT = 0.2;
        ctx.applyHit(this.x, this.y, this.damage * 0.35, this.damageType, this);
      }
      this.embedDuration -= dt;
      if (this.embedDuration <= 0) this.alive = false;
    }
  }

  private updateBouncer(dt: number, ctx: ProjectileCtx) {
    this.moveArc(dt, GRAVITY_DEFAULT * 0.7);
    // Ground bounce
    if (this.y > ctx.groundY - 6) {
      this.y = ctx.groundY - 6;
      this.vy = -Math.abs(this.vy) * 0.55;
      this.groundBounces++;
      if (this.groundBounces > 4) this.alive = false;
    }
    if (this.isInCliff(ctx)) {
      ctx.applyHit(this.x, this.y, this.damage * 0.7, this.damageType, this);
      this.bounceCount++;
      this.vx = -Math.abs(this.vx) * 0.7;
      this.vy = -Math.abs(this.vy) * 0.6 - 80;
      this.x = ctx.cliffLeft - 12;
      if (this.bounceCount >= 3) this.alive = false;
    }
    if (this.outOfBounds()) this.alive = false;
  }

  private updateBoomerang(dt: number, ctx: ProjectileCtx) {
    // Travel out, hit, then on return tick reverse velocity toward origin.
    if (this.phase === 'travel') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += GRAVITY_DEFAULT * 0.25 * dt;
      if (this.isInCliff(ctx)) {
        ctx.applyHit(this.x, this.y, this.damage, this.damageType, this);
        this.hitCount++;
        // Reverse direction
        this.vx = -Math.abs(this.vx);
        this.vy = -80;
        this.phase = 'returning';
      } else if (this.outOfBounds()) {
        this.alive = false;
      }
    } else if (this.phase === 'returning') {
      // Steer toward origin
      const dx = this.originX - this.x;
      const dy = this.originY - this.y;
      const dist = Math.hypot(dx, dy);
      const steer = 600 * dt;
      this.vx += (dx / Math.max(1, dist)) * steer;
      this.vy += (dy / Math.max(1, dist)) * steer;
      // cap speed
      const sp = Math.hypot(this.vx, this.vy);
      const cap = 500;
      if (sp > cap) {
        this.vx = (this.vx / sp) * cap;
        this.vy = (this.vy / sp) * cap;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      // If we re-cross the cliff on the way back, hit again
      if (this.isInCliff(ctx)) {
        ctx.applyHit(this.x, this.y, this.damage * 0.7, this.damageType, this);
      }
      if (dist < 18) this.alive = false;
      if (this.outOfBounds()) this.alive = false;
    }
  }

  private updateOrbiter(dt: number, ctx: ProjectileCtx) {
    if (this.phase === 'travel') {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += GRAVITY_DEFAULT * 0.4 * dt;
      if (this.x > ctx.cliffLeft - 30) {
        // Park in front of cliff
        this.phase = 'orbiting';
        this.orbitCenterX = ctx.cliffLeft - 22;
        this.orbitCenterY = this.y;
        this.orbitAngle = Math.atan2(this.y - this.orbitCenterY, this.x - this.orbitCenterX);
        this.orbitT = 1.5;
      }
      if (this.outOfBounds()) this.alive = false;
    } else if (this.phase === 'orbiting') {
      this.orbitT -= dt;
      this.orbitAngle += 7 * dt;
      const r = 18;
      this.x = this.orbitCenterX + Math.cos(this.orbitAngle) * r;
      this.y = this.orbitCenterY + Math.sin(this.orbitAngle) * r;
      // When passing closest to cliff, apply a tick
      if (Math.cos(this.orbitAngle) > 0.6) {
        this.embedTickT -= dt;
        if (this.embedTickT <= 0) {
          this.embedTickT = 0.18;
          ctx.applyHit(ctx.cliffLeft + 2, this.y, this.damage * 0.4, this.damageType, this);
        }
      }
      if (this.orbitT <= 0) this.alive = false;
    }
  }

  private updateSkip(dt: number, ctx: ProjectileCtx) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += GRAVITY_SKIP * dt;
    if (this.y > ctx.groundY - 4) {
      this.y = ctx.groundY - 4;
      this.groundBounces++;
      if (this.groundBounces < 3) {
        // Bounce smaller each time
        this.vy = -300 + this.groundBounces * 60;
        this.vx *= 0.95;
      } else if (this.groundBounces === 3) {
        // Final ramp toward cliff
        this.vy = -540;
        this.vx = Math.max(this.vx, 320);
      } else {
        // After ramping, if we land again, die
        this.alive = false;
      }
    }
    if (this.isInCliff(ctx)) {
      ctx.applyHit(this.x, this.y, this.damage, this.damageType, this);
      this.alive = false;
    }
    if (this.outOfBounds()) this.alive = false;
  }

  // === render ===

  render(ctx: CanvasRenderingContext2D) {
    switch (this.kind) {
      case 'lazer':     return this.renderLazer(ctx);
      case 'spear':     return this.renderSpear(ctx);
      case 'cannonball':return this.renderCannonball(ctx);
      case 'boomerang': return this.renderBoomerang(ctx);
      case 'driller':   return this.renderDriller(ctx);
      case 'pinball':   return this.renderPinball(ctx);
      case 'bouncer':   return this.renderBouncer(ctx);
      case 'mortar':    return this.renderMortar(ctx);
      case 'orbiter':   return this.renderOrbiter(ctx);
      case 'skip':      return this.renderSkip(ctx);
      case 'cluster':   return this.renderCluster(ctx);
      case 'ricochet':  return this.renderRicochet(ctx);
      default:          return this.renderBullet(ctx);
    }
  }

  private renderBullet(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.03, this.y - this.vy * 0.03);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private renderSpear(ctx: CanvasRenderingContext2D) {
    const len = 22;
    const angle = Math.atan2(this.vy, this.vx);
    const tailX = this.x - Math.cos(angle) * len;
    const tailY = this.y - Math.sin(angle) * len;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tailX, tailY);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
  }

  private renderCannonball(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0008';
    ctx.beginPath();
    ctx.arc(this.x, this.y + 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1620';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private renderLazer(ctx: CanvasRenderingContext2D) {
    const t = 1 - this.age / 0.18;
    ctx.save();
    ctx.globalAlpha = Math.max(0, t);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 6 * t;
    ctx.lineCap = 'round';
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.moveTo(this.originX, this.originY);
    ctx.lineTo(this.x, this.y);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  private renderCluster(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();
    // hint of impending split — outer ring
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private renderMortar(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6.5, 0, Math.PI * 2);
    ctx.fill();
    // smoke trail
    ctx.fillStyle = 'rgba(160,160,160,0.5)';
    ctx.beginPath();
    ctx.arc(this.x - this.vx * 0.04, this.y - this.vy * 0.04, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderPinball(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.age * 18);
    ctx.fillStyle = this.color;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(2, 0);
      ctx.lineTo(0, 6);
      ctx.lineTo(-2, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  private renderRicochet(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x - this.vx * 0.04, this.y - this.vy * 0.04);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private renderDriller(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.color;
    for (let i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(2.5, -3);
      ctx.lineTo(-2.5, -3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#1a1620';
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderBouncer(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#0008';
    ctx.beginPath();
    ctx.arc(this.x, this.y + 4, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff5';
    ctx.beginPath();
    ctx.arc(this.x - 2, this.y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  private renderBoomerang(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(0, -6);
    ctx.lineTo(9, 0);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.lineCap = 'butt';
    ctx.restore();
  }

  private renderOrbiter(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.fillStyle = '#fff8';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private renderSkip(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a1620';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}
