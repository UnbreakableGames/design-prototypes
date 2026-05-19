import { WORLD } from '../game/types';
import type { Loot } from './Loot';

/** One coin/gem mid-toss into the dropoff. Holds the source + target points
 *  for the arc tween. The actual Loot's collected/inventory side effects fire
 *  when `t` reaches 1, so the player visually sees the cash land. */
interface TossingLoot {
  l: Loot;
  t: number;
  duration: number;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  arcHeight: number;
  rotation: number;
  rotSpeed: number;
}

const BASE_SPEED = 220;     // px/s — brisk walk so clicks feel responsive
const PICKUP_RADIUS = 46;   // magnet radius; loot inside this circle is grabbed
const BASE_CARRY_CAP = 5;   // baseline carry; perks raise it via setCarryBonus()
const SHOOT_COOLDOWN = 0.6; // seconds between consecutive shots

// Roblox R6-style block humanoid. (x, y) is the FEET position on the ground.
// All offsets here are measured upward from that anchor.
const LEG_W = 4;
const LEG_H = 10;
const LEG_GAP = 1;          // horizontal gap between the two legs
const TORSO_W = 12;
const TORSO_H = 14;
const ARM_W = 3;
const ARM_H = 12;
const ARM_GAP = 1;          // gap between arm and torso
const HEAD_W = 10;
const HEAD_H = 10;

// Vertical anchors (y is "px above feet").
const LEG_TOP   = LEG_H;                            // 10
const TORSO_TOP = LEG_TOP + TORSO_H;                // 24
const HEAD_TOP  = TORSO_TOP + HEAD_H;               // 34

// Center of the body, used for the pickup-radius circle and carry stack.
const BODY_CENTER_OFFSET = LEG_TOP + TORSO_H / 2;   // 17

// Classic Roblox "noob" palette — bright + recognizable from a glance.
const COL_HEAD = '#ffd84a';
const COL_FACE_DARK = '#1a1208';
const COL_TORSO = '#00b9ff';
const COL_ARMS = '#ffd84a';
const COL_LEGS = '#1aaa44';
const COL_OUTLINE = 'rgba(0, 0, 0, 0.45)';

/** Player avatar — click anywhere on the play area to set a walk target.
 *  Loot inside `PICKUP_RADIUS` is added to the `carried` pile (up to
 *  `CARRY_CAP` pieces). Walking through the dropoff zone deposits every
 *  carried piece via the supplied `onDeposit` callback.
 *
 *  The starter active mechanic — runner slimes are gated behind a perk now,
 *  so the avatar IS the only collector at the start of a fresh run. */
export class Player {
  x: number;
  y: number;
  targetX: number | null = null;
  facing: 1 | -1 = 1;
  /** Walk-cycle phase, advanced while moving. Drives leg + bob animation. */
  walkPhase = 0;
  /** Loot the avatar is holding. Same `Loot` instances as on the floor —
   *  marked `carriedBy = -1` so the slime runners + reclaim system leave them
   *  alone while we cart them back to the dropoff pad. */
  carried: Loot[] = [];
  /** Pieces mid-toss into the dropoff bin. The deposit callback fires when an
   *  arc finishes, not when the player crosses the pad — so visually you see
   *  the avatar fling the coins in before the gold counter ticks up. */
  private tossing: TossingLoot[] = [];
  /** Extra carry slots granted by perks (playerCarry1 / playerCarry2). The
   *  Game refreshes this each frame from `effectivePlayerCarryBonus()` so
   *  the avatar doesn't have to keep its own perk references. */
  carryBonus = 0;
  /** Movement speed multiplier (1 = base). Driven by PLAYER-branch speed
   *  perks; Game refreshes each frame. */
  speedMul = 1;
  /** Cooldown timer between player shots. Ticks down regardless of input —
   *  shoot() only fires when this reaches 0. */
  shootCooldownT = 0;
  /** Brief tracer animation t (1.0 → 0.0 over ~0.15s) so we can render a
   *  short laser line from avatar to target after a shot. */
  shootTracerT = 0;
  shootTracerEndX = 0;
  shootTracerEndY = 0;

  constructor(x = WORLD.dropoffX + 20, y = WORLD.groundY) {
    this.x = x;
    this.y = y;
  }

  setTarget(x: number, _y: number) {
    this.targetX = x;
    this.facing = (x >= this.x ? 1 : -1) as 1 | -1;
    void _y;
  }

  /** Effective carry cap = base + perk bonus. */
  get carryCap(): number {
    return BASE_CARRY_CAP + this.carryBonus;
  }
  /** True when the carry pile is full. UI hint = a different ring color. */
  get full(): boolean {
    return this.carried.length >= this.carryCap;
  }

  /** Returns true if a shot fires (cooldown was ready). Caller is responsible
   *  for the actual damage / loot pipeline — we just track cooldown + tracer. */
  tryShoot(targetX: number, targetY: number): boolean {
    if (this.shootCooldownT > 0) return false;
    this.shootCooldownT = SHOOT_COOLDOWN;
    this.shootTracerT = 1;
    this.shootTracerEndX = targetX;
    this.shootTracerEndY = targetY;
    this.facing = (targetX >= this.x ? 1 : -1) as 1 | -1;
    return true;
  }

  update(dt: number, loot: Loot[], onDeposit: (l: Loot) => void) {
    // 1) Walk toward target along the ground line.
    if (this.targetX !== null) {
      const dx = this.targetX - this.x;
      const step = BASE_SPEED * this.speedMul * dt;
      if (Math.abs(dx) <= step) {
        this.x = this.targetX;
        this.targetX = null;
      } else {
        this.x += Math.sign(dx) * step;
        this.walkPhase += dt * 12;
      }
    }

    // Tick the shoot cooldown + tracer regardless of input.
    if (this.shootCooldownT > 0) this.shootCooldownT = Math.max(0, this.shootCooldownT - dt);
    if (this.shootTracerT > 0) this.shootTracerT = Math.max(0, this.shootTracerT - dt / 0.15);

    // 2) Magnet pickup — only while there's still room in the carry pile.
    //    Two-pass: gem-shaped loot is picked up FIRST, then coin-shaped
    //    fills any remaining slots. The player avatar is opportunistic, so
    //    if there's a gem in range it grabs that before a nearby coin.
    if (this.carried.length < this.carryCap) {
      const rSq = PICKUP_RADIUS * PICKUP_RADIUS;
      const centerY = this.y - BODY_CENTER_OFFSET;
      const inRange = (l: Loot) => {
        if (l.collected || l.carriedBy !== null || l.claimedBy !== null || l.reclaiming) return false;
        const dx = l.x - this.x;
        const dy = l.y - centerY;
        return dx * dx + dy * dy <= rSq;
      };
      const grab = (l: Loot) => {
        // Reserve this piece for the player. carriedBy = -1 keeps slime
        // runners + the mountain reclaim from contesting it.
        l.carriedBy = -1;
        l.claimedBy = null;
        this.carried.push(l);
      };
      // Pass 1: prioritize gem-shaped loot.
      for (const l of loot) {
        if (this.carried.length >= this.carryCap) break;
        if (l.shape !== 'gem') continue;
        if (inRange(l)) grab(l);
      }
      // Pass 2: fill remaining slots with coin-shaped loot.
      for (const l of loot) {
        if (this.carried.length >= this.carryCap) break;
        if (l.shape === 'gem') continue;
        if (inRange(l)) grab(l);
      }
    }

    // 3) Carry the held pieces along with the avatar (visually stacked above
    //    the head). Their x/y here only matter for any other system that
    //    inspects them — they're never rendered while carried (see draw()).
    const headTopWorldY = this.y - HEAD_TOP;
    for (let i = 0; i < this.carried.length; i++) {
      const l = this.carried[i]!;
      l.x = this.x;
      l.y = headTopWorldY - 4 - i * 5;
    }

    // 4) Deposit when crossing the dropoff pad. Each piece becomes an in-flight
    //    toss with a gravity-style arc into the bin — the avatar literally
    //    throws the coins. The inventory credit fires when the arc lands, not
    //    when the player crosses the pad.
    const inDropoff =
      Math.abs(this.x - WORLD.dropoffX) <= WORLD.dropoffWidth / 2 && this.carried.length > 0;
    if (inDropoff) {
      const handY = this.y - TORSO_TOP + 4;  // about where the avatar's hand sits
      for (let i = 0; i < this.carried.length; i++) {
        const l = this.carried[i]!;
        this.tossing.push({
          l,
          t: 0,
          // Stagger each piece slightly so they don't all land in one frame —
          // gives a satisfying machine-gun-of-coins feel into the bin.
          duration: 0.45 + Math.random() * 0.15,
          sourceX: this.x + (Math.random() - 0.5) * 4,
          sourceY: handY,
          targetX: WORLD.dropoffX + (Math.random() - 0.5) * WORLD.dropoffWidth * 0.6,
          targetY: WORLD.groundY - 2,
          arcHeight: 28 + Math.random() * 10,
          rotation: l.rotation,
          rotSpeed: (Math.random() - 0.5) * 14,
        });
      }
      this.carried.length = 0;
    }

    // 5) Advance any in-flight tosses. Credit + remove each piece when its
    //    arc completes.
    for (let i = this.tossing.length - 1; i >= 0; i--) {
      const t = this.tossing[i]!;
      t.t += dt / t.duration;
      t.rotation += t.rotSpeed * dt;
      if (t.t >= 1) {
        t.l.collected = true;
        t.l.carriedBy = null;
        onDeposit(t.l);
        this.tossing.splice(i, 1);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    const baseY = this.y;          // feet
    const cx = this.x;
    const moving = this.targetX !== null;
    // Bob the whole rig slightly while walking — classic Roblox character
    // animation has a clear up/down body motion that sells the walk cycle.
    const bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 1.2 : 0;
    // Front leg goes back, back leg comes forward, and the arms swing opposite.
    const swing = moving ? Math.sin(this.walkPhase) * 3 : 0;

    // Soft elliptical shadow on the ground.
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 1, 9, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Pickup radius hint — faint when idle, brighter while walking, red-tinted
    // when the carry pile is full so the player knows to head back to deposit.
    ctx.save();
    const radiusAlpha = this.full ? 0.4 : moving ? 0.35 : 0.15;
    ctx.strokeStyle = this.full
      ? `rgba(255, 120, 100, ${radiusAlpha})`
      : `rgba(255, 220, 120, ${radiusAlpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, baseY - BODY_CENTER_OFFSET, PICKUP_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Helper to paint a Roblox-style block: filled fill + thin outline. We
    // use 1px outlines so the rig reads like the chunky pre-2010 R6 look
    // rather than a flat 2D sprite.
    const block = (x: number, y: number, w: number, h: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = COL_OUTLINE;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    };

    // === LEGS === drawn first so the torso overlaps them at the hip seam.
    // Two-leg gait: when swing > 0 the right leg goes forward (shorter visible
    // length because the foot lifts) and the left lags behind.
    const legY = baseY - LEG_H - bob;
    const leftLegX = cx - LEG_W - LEG_GAP / 2;
    const rightLegX = cx + LEG_GAP / 2;
    const leftLegShorten = Math.max(0, -swing);     // 0..3
    const rightLegShorten = Math.max(0, swing);
    block(leftLegX,  legY + leftLegShorten,  LEG_W, LEG_H - leftLegShorten,  COL_LEGS);
    block(rightLegX, legY + rightLegShorten, LEG_W, LEG_H - rightLegShorten, COL_LEGS);

    // === TORSO ===
    const torsoX = cx - TORSO_W / 2;
    const torsoY = baseY - TORSO_TOP - bob;
    block(torsoX, torsoY, TORSO_W, TORSO_H, COL_TORSO);

    // === ARMS === swing opposite to the legs.
    const armY = torsoY + 1;
    const leftArmX = torsoX - ARM_W - ARM_GAP;
    const rightArmX = torsoX + TORSO_W + ARM_GAP;
    // Forward-swinging arm shortens slightly so it reads as "in front of body."
    const leftArmShift = swing;            // positive = forward (away from facing -1, toward +1)
    const rightArmShift = -swing;
    block(leftArmX,  armY + Math.max(0, -leftArmShift),  ARM_W, ARM_H - Math.abs(leftArmShift),  COL_ARMS);
    block(rightArmX, armY + Math.max(0, -rightArmShift), ARM_W, ARM_H - Math.abs(rightArmShift), COL_ARMS);

    // === HEAD === a cube with a smiley face.
    const headX = cx - HEAD_W / 2;
    const headY = baseY - HEAD_TOP - bob;
    block(headX, headY, HEAD_W, HEAD_H, COL_HEAD);

    // Face — two black eye pixels + curved smile. Shifts slightly with facing.
    ctx.save();
    ctx.fillStyle = COL_FACE_DARK;
    const eyeY = headY + 3;
    const eyeXLeft = headX + 3 + (this.facing === 1 ? 0 : 0);  // symmetrical for now
    const eyeXRight = headX + HEAD_W - 4;
    ctx.fillRect(eyeXLeft, eyeY, 1.5, 2);
    ctx.fillRect(eyeXRight, eyeY, 1.5, 2);
    // Smile — small arc.
    ctx.strokeStyle = COL_FACE_DARK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(headX + HEAD_W / 2, headY + 6, 2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();

    // === Carried-loot stack === floats above the head with the bob.
    const stackBaseY = headY - 4;
    for (let i = 0; i < this.carried.length; i++) {
      const l = this.carried[i]!;
      const yi = stackBaseY - i * 5;
      ctx.fillStyle = l.color;
      ctx.strokeStyle = l.outline;
      ctx.lineWidth = 1;
      if (l.shape === 'gem') {
        ctx.beginPath();
        ctx.moveTo(cx, yi - 3);
        ctx.lineTo(cx + 3, yi);
        ctx.lineTo(cx, yi + 3);
        ctx.lineTo(cx - 3, yi);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(cx, yi, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Carry capacity readout — only when holding something.
    if (this.carried.length > 0) {
      ctx.save();
      ctx.fillStyle = this.full ? '#ff8060' : '#fff2b0';
      ctx.font = '600 9px Inter Tight, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.carried.length}/${this.carryCap}`, cx, headY - this.carried.length * 5 - 8);
      ctx.restore();
    }

    // Shot tracer — short bright line from the avatar's hand to the impact
    // point, fading out over ~150ms. A simple white-yellow streak that reads
    // as "the player just zapped something."
    if (this.shootTracerT > 0) {
      const alpha = this.shootTracerT;
      const handX = cx + this.facing * 6;
      const handY = baseY - TORSO_TOP + 4;
      ctx.save();
      ctx.strokeStyle = `rgba(255, 240, 160, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(this.shootTracerEndX, this.shootTracerEndY);
      ctx.stroke();
      // Bright core
      ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(handX, handY);
      ctx.lineTo(this.shootTracerEndX, this.shootTracerEndY);
      ctx.stroke();
      ctx.restore();
    }

    // Click-target marker at the destination while walking.
    if (moving) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 220, 120, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(this.targetX!, WORLD.groundY - 2, 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // In-flight deposit tosses — each coin follows a sin-arc from the player's
    // hand to a target point inside the dropoff pad.
    for (const t of this.tossing) {
      const k = Math.min(1, t.t);
      const ax = t.sourceX + (t.targetX - t.sourceX) * k;
      const ay =
        t.sourceY + (t.targetY - t.sourceY) * k - Math.sin(k * Math.PI) * t.arcHeight;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(t.rotation);
      ctx.fillStyle = t.l.color;
      ctx.strokeStyle = t.l.outline;
      ctx.lineWidth = 1;
      if (t.l.shape === 'gem') {
        ctx.beginPath();
        ctx.moveTo(0, -t.l.size);
        ctx.lineTo(t.l.size, 0);
        ctx.lineTo(0, t.l.size);
        ctx.lineTo(-t.l.size, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, t.l.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
