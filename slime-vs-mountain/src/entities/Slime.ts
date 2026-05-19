import type { SlotType, SlimeVariant, StatusKind } from '../game/types';
import { WORLD } from '../game/types';
import { Loot } from './Loot';
import { Projectile } from './Projectile';
import { drawSlimeDecoration } from './SlimeDecorations';

/** Uniform visual + hitbox scale applied to every slime. The canonical
 *  `variant.size` values define the *intended* size; this multiplier shrinks
 *  the on-screen rig so the player-avatar and stacked spitter columns have
 *  room to breathe. Set to 1.0 to render at the original size. */
const SLIME_SCALE = 0.6;

interface ActiveStatus {
  kind: StatusKind;
  timeLeft: number;
  value: number;
}

type RunnerState = 'idle' | 'goto_loot' | 'picking_up' | 'returning' | 'dropping_off';

const STATUS_ICONS: Record<StatusKind, string> = {
  stun: '✦', // freeze
  slow: '⤓',
  blind: '!',
  burn: '♨',
  tangle: '✕',
  drain: '◌',
  drop: '!',
};
const STATUS_COLORS: Record<StatusKind, string> = {
  stun: '#b0e8ff',
  slow: '#6fd060',
  blind: '#e0c890',
  burn: '#ff6040',
  tangle: '#c8a0ff',
  drain: '#a060ff',
  drop: '#8a8a8a',
};

export class Slime {
  /** Stable per-entity identity. Loot.claimedBy / carriedBy reference this so
   *  pickup tracking survives a runner crossing the world. */
  slimeId: number;
  variant: SlimeVariant;
  slotType: SlotType;
  /** Position in the owning slot list (spitterSlots / runnerSlots). Updated
   *  when rebuildActiveSlimes runs after slot edits. */
  slotIndex: number;
  homeX: number;
  homeY: number;
  x: number;
  y: number;
  bobT: number;
  fireCd = 0;
  facing: 1 | -1 = 1;
  runnerState: RunnerState = 'idle';
  targetLoot: Loot | null = null;
  carried: Loot[] = [];
  pickupT = 0;
  squash = 0;
  status: ActiveStatus | null = null;

  constructor(
    slimeId: number,
    variant: SlimeVariant,
    slotType: SlotType,
    slotIndex: number,
    homeX: number,
    homeY: number = WORLD.groundY
  ) {
    this.slimeId = slimeId;
    this.variant = variant;
    this.slotType = slotType;
    this.slotIndex = slotIndex;
    this.homeX = homeX;
    this.homeY = homeY;
    this.x = homeX;
    this.y = homeY;
    this.bobT = Math.random() * Math.PI * 2;
    this.fireCd = variant.fireRate > 0 ? Math.random() * (1 / variant.fireRate) : 0;
  }

  containsPoint(px: number, py: number) {
    const r = this.variant.size * SLIME_SCALE;
    const dx = px - this.x;
    const dy = py - (this.y - r * 0.6);
    return dx * dx + dy * dy < r * r;
  }

  /** Called by a GoonAttack landing on this slime. 'drop' is instant (knocks
   *  one carried loot off); other statuses set a timer that the update loop
   *  honors. Latest status wins (no stacking for now). */
  applyStatus(kind: StatusKind, duration: number, value: number) {
    if (kind === 'drop') {
      const l = this.carried.pop();
      if (l) {
        l.carriedBy = null;
        l.claimedBy = null;
        l.collected = false;
        l.settled = false;
        l.x = this.x;
        l.y = this.y - 10;
        l.vx = (Math.random() - 0.5) * 100;
        l.vy = -180;
      }
      return;
    }
    this.status = { kind, timeLeft: duration, value };
  }

  // Drop carried loot back to the ground at the slime's current position when unslotted.
  releaseCarried() {
    for (const l of this.carried) {
      l.carriedBy = null;
      l.claimedBy = null;
      l.collected = false;
      l.settled = false;
      l.x = this.x;
      l.y = this.y - 10;
      l.vx = (Math.random() - 0.5) * 80;
      l.vy = -80 - Math.random() * 40;
    }
    this.carried.length = 0;
    if (this.targetLoot) {
      this.targetLoot.claimedBy = null;
      this.targetLoot = null;
    }
  }

  updateSpitter(
    dt: number,
    mountainLeftX: number,
    mountainTopY: number,
    mountainBottomY: number,
    spawnProjectile: (p: Projectile) => void,
    dmgMul: number = 1,
    goons: Array<{ x: number; y: number; alive: boolean }> = [],
    globalCrit: number = 0,
    fireRateMul: number = 1
  ) {
    this.bobT += dt * 3;
    this.facing = 1;
    if (this.variant.fireRate <= 0) return;
    this.fireCd -= dt * fireRateMul;
    if (this.fireCd <= 0) {
      // Use the effective rate when refilling the cooldown so aura-buffed
      // bees keep firing faster instead of slipping back to base after one shot.
      this.fireCd += 1 / (this.variant.fireRate * fireRateMul);
      const muzzleX = this.x + this.variant.size * SLIME_SCALE * 0.6;
      const muzzleY = this.y - this.variant.size * SLIME_SCALE * 0.9;
      // Anti-goon variants pick a goon target if any are alive.
      let targetX = mountainLeftX + 4;
      let targetY = mountainTopY + 30 + Math.random() * (mountainBottomY - mountainTopY - 60);
      if (this.variant.antiGoon) {
        const aliveGoons = goons.filter((g) => g.alive);
        if (aliveGoons.length > 0) {
          // Pick the closest goon by x distance.
          let best = aliveGoons[0]!;
          let bd = Math.abs(best.x - this.x);
          for (const g of aliveGoons) {
            const d = Math.abs(g.x - this.x);
            if (d < bd) { bd = d; best = g; }
          }
          targetX = best.x;
          targetY = best.y;
        }
      }
      const dx = targetX - muzzleX;
      const dy = targetY - muzzleY;
      const projSpeed = this.variant.projectileSpeed;
      let vx: number;
      let vy: number;
      const kind = this.variant.projectile ?? 'bullet';
      // Spear/lazer go in a straight line, no arcing — solve for direct aim.
      if (kind === 'spear' || kind === 'lazer') {
        const dist = Math.max(1, Math.hypot(dx, dy));
        vx = (dx / dist) * projSpeed;
        vy = (dy / dist) * projSpeed;
      } else {
        // Arcing projectile — solve a parabola so we land near the target.
        const t = Math.max(0.35, Math.min(0.9, dx / projSpeed));
        vx = dx / t;
        // Gravity used by `Projectile.updateBullet` is 240; approximate.
        vy = (dy - 0.5 * 240 * t * t) / t;
      }
      // Crit roll — variant chance + global skill-tree chance, capped at 100%.
      let damage = this.variant.damage * dmgMul;
      const critP = Math.min(1, (this.variant.critChance ?? 0) + globalCrit);
      if (critP > 0 && Math.random() < critP) damage *= 2;
      spawnProjectile(
        new Projectile({
          x: muzzleX,
          y: muzzleY,
          vx,
          vy,
          damage,
          color: this.variant.body,
          kind,
          damageType: this.variant.damageType ?? 'physical',
          originX: muzzleX,
          originY: muzzleY,
          vsGoonMul: this.variant.antiGoon ? 2 : 1,
          variantId: this.variant.id,
        })
      );
      this.squash = 0.18;
    }
    if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 2);
  }

  updateRunner(
    dt: number,
    available: Loot[],
    dropoffX: number,
    onDropoff: (loot: Loot, ability?: 'sprinter' | 'sorter' | 'magnet' | 'vacuum') => void,
    perks: {
      speedMul?: number;
      pickupMul?: number;
      dropoffMul?: number;
      carryBonus?: number;
      carryMul?: number;
      globalCrit?: number;
    } = {}
  ) {
    const ability = this.variant.runnerAbility;
    // Tick status; clear if expired.
    if (this.status) {
      this.status.timeLeft -= dt;
      if (this.status.timeLeft <= 0) this.status = null;
    }
    // Stun: full freeze. Don't move, don't pick.
    if (this.status?.kind === 'stun') return;

    // Apply status-driven multipliers to base stats.
    const slowMul = this.status?.kind === 'slow' ? this.status.value : 1;
    const drainSpeedMul = this.status?.kind === 'drain' ? this.status.value : 1;
    const burnPickupMul = this.status?.kind === 'burn' ? this.status.value : 1;
    const drainPickupMul = this.status?.kind === 'drain' ? 1 / this.status.value : 1; // 0.5 value → 2× pickup
    const tangleMul = this.status?.kind === 'tangle' ? this.status.value : 1;
    const isBlind = this.status?.kind === 'blind';

    // Sprinter: +30% movement when carrying anything.
    const sprintMul = ability === 'sprinter' && this.carried.length > 0 ? 1.3 : 1;
    const speed =
      this.variant.moveSpeed * (perks.speedMul ?? 1) * sprintMul * slowMul * drainSpeedMul;
    const pickupT =
      this.variant.pickupTime * (perks.pickupMul ?? 1) * burnPickupMul * drainPickupMul;
    const dropT = this.variant.dropoffTime * (perks.dropoffMul ?? 1);
    const baseCap = this.variant.carryCapacity * (perks.carryMul ?? 1) * tangleMul;
    const carryMax = Math.max(1, Math.floor(baseCap + (perks.carryBonus ?? 0)));

    // Magnet: tug nearby loot toward this slime while moving (small radius).
    if (ability === 'magnet') {
      const R2 = 80 * 80;
      for (const l of available) {
        if (l.collected || l.carriedBy !== null || l.claimedBy !== null || l.reclaiming) continue;
        const dx = this.x - l.x;
        const dy = (this.y - 10) - l.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const pull = 90;
          l.vx += (dx / d) * pull * dt;
          l.vy += (dy / d) * pull * dt;
        }
      }
    }

    // Vacuum: instantly collect any settled loot in a wide radius without
    // needing to travel/pickup. Hops straight to inventory.
    if (ability === 'vacuum') {
      const R2 = 140 * 140;
      for (const l of available) {
        if (l.collected || l.carriedBy !== null || l.claimedBy !== null || l.reclaiming) continue;
        if (!l.settled) {
          const sp2 = l.vx * l.vx + l.vy * l.vy;
          if (sp2 > 400) continue;
        }
        const dx = this.x - l.x;
        const dy = (this.y - 10) - l.y;
        if (dx * dx + dy * dy < R2) {
          l.collected = true;
          onDropoff(l, 'vacuum');
        }
      }
    }
    this.bobT += dt * 4;

    if (this.runnerState === 'idle') {
      // Blind: can't see loot. Just sit (or drift back to home if not there).
      if (isBlind) {
        if (this.carried.length > 0) {
          this.runnerState = 'returning';
        } else if (Math.abs(this.x - this.homeX) > 1) {
          const dir = Math.sign(this.homeX - this.x);
          this.x += dir * speed * 0.5 * dt;
          this.facing = dir as 1 | -1;
        }
        return;
      }
      // Regular runners grab the nearest loot regardless of shape — gems are
      // mixed in with coins on the floor and don't get special treatment.
      // Sorter runners (the gem-pickup specialist) only collect gem-shaped loot,
      // which is what makes them worth slotting.
      const findNearest = (preferShape: 'gem' | 'coin' | null) => {
        let b: Loot | null = null;
        let bd = Infinity;
        for (const l of available) {
          if (l.collected || l.claimedBy !== null || l.carriedBy !== null || l.reclaiming) continue;
          if (preferShape !== null && l.shape !== preferShape) continue;
          if (!l.settled) {
            const speed2 = l.vx * l.vx + l.vy * l.vy;
            if (speed2 > 400) continue;
          }
          const d = Math.abs(l.x - this.x);
          if (d < bd) {
            bd = d;
            b = l;
          }
        }
        return b;
      };
      const best = ability === 'sorter' ? findNearest('gem') : findNearest(null);
      if (best) {
        best.claimedBy = this.slimeId;
        this.targetLoot = best;
        this.runnerState = 'goto_loot';
      } else if (this.carried.length > 0) {
        this.runnerState = 'returning';
      } else if (Math.abs(this.x - this.homeX) > 1) {
        const dir = Math.sign(this.homeX - this.x);
        this.x += dir * speed * dt;
        this.facing = dir as 1 | -1;
      }
      return;
    }

    if (this.runnerState === 'goto_loot') {
      const target = this.targetLoot;
      if (!target || target.collected) {
        this.runnerState = 'idle';
        this.targetLoot = null;
        return;
      }
      const dx = target.x - this.x;
      this.facing = (dx >= 0 ? 1 : -1) as 1 | -1;
      const step = speed * dt;
      if (Math.abs(dx) <= step + 4) {
        this.x = target.x;
        this.runnerState = 'picking_up';
        this.pickupT = pickupT;
      } else {
        this.x += Math.sign(dx) * step;
      }
      return;
    }

    if (this.runnerState === 'picking_up') {
      const target = this.targetLoot;
      if (!target || target.collected) {
        this.runnerState = 'idle';
        this.targetLoot = null;
        this.squash = 0;
        return;
      }
      this.pickupT -= dt;
      const t = 1 - this.pickupT / pickupT;
      this.squash = 0.18 * Math.sin(t * Math.PI * 3);
      if (this.pickupT <= 0) {
        target.carriedBy = this.slimeId;
        target.claimedBy = null;
        this.carried.push(target);
        this.targetLoot = null;
        this.squash = 0;
        this.runnerState = this.carried.length >= carryMax ? 'returning' : 'idle';
      }
      return;
    }

    if (this.runnerState === 'returning') {
      const dx = dropoffX - this.x;
      this.facing = (dx >= 0 ? 1 : -1) as 1 | -1;
      const step = speed * dt;
      if (Math.abs(dx) <= step + 1) {
        this.x = dropoffX;
        this.runnerState = 'dropping_off';
        this.pickupT = dropT;
      } else {
        this.x += Math.sign(dx) * step;
      }
      return;
    }

    if (this.runnerState === 'dropping_off') {
      if (this.carried.length === 0) {
        this.runnerState = 'idle';
        this.squash = 0;
        return;
      }
      this.pickupT -= dt;
      const t = 1 - this.pickupT / dropT;
      this.squash = 0.18 * Math.sin(t * Math.PI * 2);
      if (this.pickupT <= 0) {
        // Dump the entire load in one go — keeps the dropoff snappy regardless of cap.
        for (const l of this.carried) {
          l.collected = true;
          l.carriedBy = null;
          onDropoff(l);
        }
        this.carried.length = 0;
        this.runnerState = 'idle';
        this.squash = 0;
      }
      return;
    }
  }

  render(ctx: CanvasRenderingContext2D, selected: boolean) {
    const v = this.variant;
    const bob = Math.sin(this.bobT) * 2.5;
    const sq = this.squash;
    const sz = v.size * SLIME_SCALE;
    const w = sz * (1 + sq * 0.4);
    const h = sz * 1.4 * (1 - sq * 0.4);
    const baseY = this.y + bob;
    const cx = this.x;

    if (this.y >= WORLD.groundY - 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(cx, this.y + 4, sz * 0.9, sz * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // === Bee body === oval torso with stripes, wings behind, antennae on top.
    // Variant `body` color stays the dominant hue so the player still reads
    // each variant's identity at a glance — bees just happen to be green/blue/
    // red/etc. on this island. The "slime" code names stick around behind
    // the cosmetic for now (see types.ts / Slime.ts class name).
    const bodyCenterY = baseY - h * 0.5;
    const bodyHalfH = h * 0.5;

    // Wings — two translucent ovals behind the body. Flap subtly with the bob.
    const wingFlap = Math.sin(this.bobT * 7) * 0.12;
    const wingW = w * 0.65;
    const wingH = h * 0.45;
    ctx.save();
    ctx.fillStyle = 'rgba(245, 250, 255, 0.55)';
    ctx.strokeStyle = 'rgba(110, 120, 145, 0.5)';
    ctx.lineWidth = 0.8;
    // Back wing (further from camera)
    ctx.beginPath();
    ctx.ellipse(
      cx - this.facing * w * 0.05,
      bodyCenterY - h * 0.55,
      wingW,
      wingH * (1 + wingFlap),
      -0.25 * this.facing,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
    // Front wing
    ctx.beginPath();
    ctx.ellipse(
      cx + this.facing * w * 0.15,
      bodyCenterY - h * 0.5,
      wingW * 0.85,
      wingH * 0.9 * (1 - wingFlap),
      -0.1 * this.facing,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Body (oval)
    ctx.fillStyle = v.body;
    ctx.beginPath();
    ctx.ellipse(cx, bodyCenterY, w, bodyHalfH, 0, 0, Math.PI * 2);
    ctx.fill();

    // Stripes — two horizontal black bands across the body, clipped to body
    // so they hug the curve.
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, bodyCenterY, w, bodyHalfH, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = 'rgba(20, 14, 8, 0.85)';
    const stripeH = bodyHalfH * 0.25;
    ctx.fillRect(cx - w, bodyCenterY - stripeH * 1.6, w * 2, stripeH);
    ctx.fillRect(cx - w, bodyCenterY + stripeH * 0.4, w * 2, stripeH);
    ctx.restore();

    // Body highlight (kept — sells the round shape).
    ctx.fillStyle = v.highlight;
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.3, bodyCenterY - bodyHalfH * 0.6, w * 0.18, bodyHalfH * 0.4, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Antennae — thin curved lines + tip dots above the head.
    ctx.save();
    ctx.strokeStyle = '#1a120c';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    const antTopY = bodyCenterY - bodyHalfH - h * 0.18;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.32, bodyCenterY - bodyHalfH * 0.9);
    ctx.quadraticCurveTo(cx - w * 0.45, bodyCenterY - bodyHalfH - h * 0.05, cx - w * 0.5, antTopY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + w * 0.32, bodyCenterY - bodyHalfH * 0.9);
    ctx.quadraticCurveTo(cx + w * 0.45, bodyCenterY - bodyHalfH - h * 0.05, cx + w * 0.5, antTopY);
    ctx.stroke();
    ctx.fillStyle = '#1a120c';
    ctx.beginPath();
    ctx.arc(cx - w * 0.5, antTopY, 1.6, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.5, antTopY, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Eyes (same placement as before — small black dots on the face).
    ctx.fillStyle = '#0c1018';
    const eyeOffset = this.facing * w * 0.18;
    ctx.beginPath();
    ctx.arc(cx - w * 0.22 + eyeOffset, bodyCenterY - bodyHalfH * 0.35, 2.6, 0, Math.PI * 2);
    ctx.arc(cx + w * 0.22 + eyeOffset, bodyCenterY - bodyHalfH * 0.35, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Status icon (stun/slow/blind/burn/tangle/drain) above the head.
    if (this.status) {
      const sIcon = STATUS_ICONS[this.status.kind] ?? '?';
      const sColor = STATUS_COLORS[this.status.kind] ?? '#fff';
      ctx.save();
      ctx.fillStyle = 'rgba(10,12,18,0.7)';
      ctx.beginPath();
      ctx.arc(cx + w + 6, baseY - h - 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = sColor;
      ctx.font = 'bold 12px Inter Tight, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(sIcon, cx + w + 6, baseY - h - 4);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'start';
      ctx.restore();
    }

    // Per-variant decoration layer (hats, body details, custom faces). Drawn
    // last so it can paint over the default eyes when needed.
    drawSlimeDecoration(this.variant.id, {
      ctx,
      cx,
      baseY,
      w,
      h,
      body: this.variant.body,
      highlight: this.variant.highlight,
      facing: this.facing,
      time: this.bobT,
    });

    const working =
      this.runnerState === 'picking_up'
        ? this.variant.pickupTime
        : this.runnerState === 'dropping_off'
        ? this.variant.dropoffTime
        : 0;
    if (working > 0) {
      const progress = Math.max(0, Math.min(1, 1 - this.pickupT / working));
      const barW = sz * 1.3;
      const barX = cx - barW / 2;
      const barY = baseY - h - 10;
      ctx.fillStyle = 'rgba(10,12,18,0.8)';
      ctx.fillRect(barX, barY, barW, 4);
      ctx.fillStyle = this.runnerState === 'dropping_off' ? '#5af0ff' : '#ffd24a';
      ctx.fillRect(barX, barY, barW * progress, 4);
    }

    if (selected) {
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.ellipse(cx, baseY - h * 0.5, w + 5, h * 0.65 + 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    for (let i = 0; i < this.carried.length; i++) {
      const l = this.carried[i]!;
      l.x = cx;
      l.y = baseY - h - 6 - i * 8;
      l.render(ctx);
    }
  }
}

