import type { CliffEffect, MountainTheme } from '../game/types';
import { MOUNTAIN_THEMES, WORLD } from '../game/types';

let nextEffectId = 1;

const BASE_HP = 2400;
const BURN_MAX_STACKS = 6;
const BURN_DURATION = 2.5;     // a fresh burn patch lives this long
const FROST_DEFAULT_DURATION = 3;
const PATCH_MERGE_DIST = 22;   // burn/frost hits within this distance merge into one patch

export type MountainPhase = 'alive' | 'falling' | 'rising';
export const FALL_DURATION = 1.4;
export const RISE_DURATION = 1.0;

export class Mountain {
  x = WORLD.mountainX;
  width = WORLD.mountainWidth;
  topY = 110;
  bottomY = WORLD.groundY;
  level = 0;
  cycle = 0;
  maxHp = Math.floor(BASE_HP * MOUNTAIN_THEMES[0]!.hpMul);
  hp = this.maxHp;
  hitFlash = 0;
  shakeT = 0;
  /** Death-sequence phase. 'alive' = combat-ready. 'falling' = sinking after
   *  death, 'rising' = new mountain emerging from below. */
  phase: MountainPhase = 'alive';
  phaseT = 0;
  /** Area DoT patches on the cliff face. Game ticks them so it can apply
   *  damage to goons (Mountain doesn't know about goons). */
  effects: CliffEffect[] = [];

  alive() {
    return this.hp > 0;
  }

  /** True only when combat is active. False during fall/rise transitions so
   *  spitters don't shoot at an animating cliff. */
  isInCombat(): boolean {
    return this.alive() && this.phase === 'alive';
  }

  /** Vertical offset for render — sinks the cliff during fall, lifts it from
   *  below during rise. */
  yOffset(): number {
    const total = this.bottomY - this.topY + 60;
    if (this.phase === 'falling') {
      const t = Math.min(1, this.phaseT / FALL_DURATION);
      // ease-in: starts slow, accelerates
      return t * t * total;
    }
    if (this.phase === 'rising') {
      const t = Math.min(1, this.phaseT / RISE_DURATION);
      // ease-out: comes up fast, settles
      const eased = 1 - Math.pow(1 - t, 3);
      return (1 - eased) * total;
    }
    return 0;
  }

  startFalling() {
    this.phase = 'falling';
    this.phaseT = 0;
    this.effects = [];
  }

  startRising() {
    this.phase = 'rising';
    this.phaseT = 0;
  }

  finishRising() {
    this.phase = 'alive';
    this.phaseT = 0;
  }

  theme(): MountainTheme {
    return MOUNTAIN_THEMES[this.level % MOUNTAIN_THEMES.length]!;
  }

  advance() {
    this.level++;
    if (this.level >= MOUNTAIN_THEMES.length) {
      this.cycle = Math.floor(this.level / MOUNTAIN_THEMES.length);
    }
    const t = this.theme();
    const cycleMul = Math.pow(2, this.cycle);
    this.maxHp = Math.floor(BASE_HP * t.hpMul * cycleMul);
    this.hp = this.maxHp;
    this.effects = [];
  }

  levelLabel(): string {
    const cy = this.cycle > 0
      ? ` ${'II III IV V VI VII VIII IX X'.split(' ')[this.cycle - 1] ?? this.cycle}`
      : '';
    return `${this.theme().name}${cy} — Mt. ${this.level + 1}`;
  }

  takeDamage(amount: number) {
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = 0.15;
    this.shakeT = 0.2;
  }

  applyShake(intensity: number) {
    this.shakeT = Math.max(this.shakeT, 0.2 * intensity * 2);
  }

  /** Apply a burn patch at (x, y). If there's an existing patch nearby it adds
   *  a stack to it; otherwise a fresh patch is created. */
  applyBurnAt(x: number, y: number, stacks = 1) {
    for (const e of this.effects) {
      if (e.kind !== 'burn') continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy < PATCH_MERGE_DIST * PATCH_MERGE_DIST) {
        e.intensity = Math.min(BURN_MAX_STACKS, e.intensity + stacks);
        e.timeLeft = Math.max(e.timeLeft, BURN_DURATION);
        return;
      }
    }
    this.effects.push({
      id: nextEffectId++,
      x, y,
      radius: 24,
      kind: 'burn',
      intensity: stacks,
      timeLeft: BURN_DURATION,
      tickT: 0,
    });
  }

  applyFrostAt(x: number, y: number, duration = FROST_DEFAULT_DURATION) {
    for (const e of this.effects) {
      if (e.kind !== 'frost') continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy < PATCH_MERGE_DIST * PATCH_MERGE_DIST) {
        e.timeLeft = Math.max(e.timeLeft, duration);
        return;
      }
    }
    this.effects.push({
      id: nextEffectId++,
      x, y,
      radius: 28,
      kind: 'frost',
      intensity: 1,
      timeLeft: duration,
      tickT: 0,
    });
  }

  /** Respawn slows while any frost patch is active. */
  respawnRateMul(): number {
    return this.effects.some((e) => e.kind === 'frost') ? 0.45 : 1;
  }

  update(dt: number) {
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.phase !== 'alive') this.phaseT += dt;
    for (const e of this.effects) e.timeLeft -= dt;
    if (!this.alive()) this.effects = [];
    else this.effects = this.effects.filter((e) => e.timeLeft > 0);
  }

  randomImpactPoint() {
    return {
      x: this.x + 4 + Math.random() * 6,
      y: this.topY + 20 + Math.random() * (this.bottomY - this.topY - 30),
    };
  }

  randomLootSpawn(impactY: number) {
    return {
      x: this.x + Math.random() * 30,
      y: impactY - 8 + Math.random() * 12,
    };
  }


  /** Paint a small per-theme accent layer on top of the canopy. Each accent
   *  type uses a fixed deterministic set of positions tuned to sit between
   *  the canopy clusters. */
  private renderAccent(
    ctx: CanvasRenderingContext2D,
    kind: 'none' | 'honeyDrips' | 'embers' | 'icicles' | 'resinDrips' | 'shadowGlints',
    color: string,
    canopyMidY: number,
  ) {
    if (kind === 'none') return;
    // Deterministic anchor points around the canopy.
    const anchors: Array<[number, number]> = [
      [+30, +44], [+80, +50], [+135, +46], [+185, +52],
      [+230, +48], [+270, +44], [+15, +30], [+60, +22],
    ];
    if (kind === 'honeyDrips' || kind === 'resinDrips') {
      // Drooping teardrop shape hanging below the canopy.
      for (const [dx, dy] of anchors) {
        const x = this.x + dx;
        const y = canopyMidY + dy;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x, y, 2.4, 5.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Small reflective glint near the top of the drip.
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(x - 0.6, y - 2.4, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'embers') {
      // Glowing pinpoints scattered through the canopy.
      const points: Array<[number, number]> = [
        [+18, -10], [+55, +18], [+100, -22], [+140, +6], [+180, -18],
        [+220, +16], [+260, -4], [+90, +28], [+200, +30],
      ];
      for (const [dx, dy] of points) {
        const x = this.x + dx;
        const y = canopyMidY + dy;
        ctx.fillStyle = color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff6c0';
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind === 'icicles') {
      // Thin downward triangles hanging from the canopy's lower edge.
      const points: Array<[number, number, number]> = [
        [+20, +50, 12], [+55, +52, 16], [+95, +48, 14], [+135, +52, 18],
        [+175, +48, 12], [+215, +52, 16], [+255, +48, 14], [+295, +52, 10],
      ];
      for (const [dx, dy, h] of points) {
        const x = this.x + dx;
        const y = canopyMidY + dy;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x - 3, y);
        ctx.lineTo(x + 3, y);
        ctx.lineTo(x, y + h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.moveTo(x - 1, y + 1);
        ctx.lineTo(x + 0.5, y + 1);
        ctx.lineTo(x, y + h - 3);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind === 'shadowGlints') {
      // Cold pinprick highlights deep in the dark canopy.
      const points: Array<[number, number]> = [
        [+12, -8], [+44, +20], [+82, -28], [+118, +4], [+158, -22],
        [+200, +18], [+240, -8], [+275, +12], [+72, +34], [+182, +32],
      ];
      for (const [dx, dy] of points) {
        const x = this.x + dx;
        const y = canopyMidY + dy;
        ctx.fillStyle = color;
        ctx.shadowBlur = 6;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(x, y, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(x, y, 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    const shakeX = this.shakeT > 0 ? (Math.random() - 0.5) * 4 * (this.shakeT / 0.2) : 0;
    const offY = this.yOffset();
    const art = this.theme().treeArt;
    ctx.save();
    ctx.translate(shakeX, offY);

    // === Theme-flavored tree === — bushy canopy extending off the right edge
    // of the screen. Honeycomb dens (rendered as the "mine" goon kind) hang
    // from the branches, defended by evil bees. Trunk runs along the right
    // edge so the canopy reads as the leftmost slice of a much larger tree
    // continuing out of frame. Colors/decorations come from the theme's
    // treeArt recipe.
    const trunkX = this.x + 20;
    const trunkTopY = this.topY + (this.bottomY - this.topY) * 0.4;
    ctx.fillStyle = art.trunkBody;
    ctx.fillRect(trunkX, trunkTopY, WORLD.width - trunkX + 20, this.bottomY - trunkTopY);
    // Bark texture — vertical streaks
    ctx.strokeStyle = art.trunkBark;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i++) {
      const sx = trunkX + 6 + i * 12;
      if (sx > WORLD.width) break;
      ctx.beginPath();
      ctx.moveTo(sx, trunkTopY + 2);
      ctx.lineTo(sx + 1, this.bottomY - 4);
      ctx.stroke();
    }

    // Bushy canopy — overlapping leaf clusters in three shades for depth.
    const canopyMidY = this.topY + (trunkTopY - this.topY) * 0.5;
    const overhang = 80;
    const clusters: Array<[number, number, number, string]> = [
      // Back layer
      [+10,  +14, 70, art.canopyBack],
      [+50,  -18, 82, art.canopyBack],
      [+100, +22, 88, art.canopyBack],
      [+150, -10, 92, art.canopyBack],
      [+200, +20, 88, art.canopyBack],
      [+240 + overhang, +0,  96, art.canopyBack],
      // Mid layer
      [-5,   +0,  62, art.canopyMid],
      [+30,  +30, 64, art.canopyMid],
      [+80,  +0,  74, art.canopyMid],
      [+120, +30, 70, art.canopyMid],
      [+170, +5,  80, art.canopyMid],
      [+220, +28, 76, art.canopyMid],
      [+260 + overhang, -6, 80, art.canopyMid],
      // Highlights
      [+25,  -36, 46, art.canopyHi],
      [+70,  -30, 52, art.canopyHi],
      [+130, -38, 58, art.canopyHi],
      [+190, -32, 56, art.canopyHi],
      [+240, -28, 54, art.canopyHi],
    ];
    for (const [dx, dy, r, color] of clusters) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(this.x + dx, canopyMidY + dy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Scattered decorative flowers — deterministic positions.
    if (art.flowerPalette.length > 0) {
      const flowers: Array<[number, number]> = [
        [+5, +6], [+25, -20], [+45, +28], [+60, -8], [+80, +14], [+95, -32],
        [+115, +22], [+135, -16], [+155, +6], [+175, +30], [+195, -28], [+215, +12],
        [+235, -18], [+255, +24], [+275, -4], [+295, +18], [+25, +42], [+85, +40],
        [+150, +40], [+210, +42], [+45, -44], [+170, -42],
      ];
      for (let i = 0; i < flowers.length; i++) {
        const fx = this.x + flowers[i]![0];
        const fy = canopyMidY + flowers[i]![1];
        const col = art.flowerPalette[i % art.flowerPalette.length]!;
        ctx.fillStyle = col;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(fx + Math.cos(a) * 2.4, fy + Math.sin(a) * 2.4, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = art.flowerCore;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Theme-specific accent layer (drips, embers, icicles, glints).
    this.renderAccent(ctx, art.accent, art.accentColor, canopyMidY);

    if (this.hitFlash > 0) {
      ctx.fillStyle = art.hitGlow.replace('ALPHA', String(this.hitFlash * 1.3));
      ctx.beginPath();
      ctx.arc(this.x + 60, canopyMidY, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Area effect patches drawn on the cliff face
    for (const e of this.effects) {
      const fade = Math.min(1, e.timeLeft / 1.0);
      if (e.kind === 'burn') {
        const intensity = 0.18 + 0.12 * Math.min(1, e.intensity / BURN_MAX_STACKS);
        const a = intensity * fade;
        const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.radius);
        g.addColorStop(0, `rgba(255, 200, 100, ${a * 1.4})`);
        g.addColorStop(0.5, `rgba(255, 110, 50, ${a})`);
        g.addColorStop(1, `rgba(255, 80, 30, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'frost') {
        const a = 0.35 * fade;
        const g = ctx.createRadialGradient(e.x, e.y, 2, e.x, e.y, e.radius);
        g.addColorStop(0, `rgba(220, 245, 255, ${a * 1.3})`);
        g.addColorStop(0.6, `rgba(160, 220, 255, ${a})`);
        g.addColorStop(1, `rgba(120, 180, 230, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Hide HP bar during the death/respawn animation.
    if (this.phase !== 'alive') return;

    // HP bar above mountain
    const barW = this.width - 40;
    const barX = this.x + 20;
    const barY = this.topY - 18;
    ctx.fillStyle = '#0a0c12';
    ctx.fillRect(barX, barY, barW, 8);
    ctx.fillStyle = '#3a2a2a';
    ctx.fillRect(barX, barY, barW, 8);
    const pct = this.hp / this.maxHp;
    ctx.fillStyle = pct > 0.4 ? '#d24a4a' : '#ff7a55';
    ctx.fillRect(barX, barY, barW * pct, 8);
    ctx.strokeStyle = '#1a1620';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, 7);

    ctx.fillStyle = '#b6c2d1';
    ctx.font = '10px Inter Tight, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${this.levelLabel()}  ·  ${Math.ceil(this.hp)} / ${this.maxHp}`,
      barX + barW / 2,
      barY - 4
    );
    ctx.textAlign = 'start';
  }
}
