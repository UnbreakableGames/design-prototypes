import type { BossConfig, GoonConfig, StatusKind } from '../game/types';

let nextGoonId = 1;

/** What kind of mountain occupant this is.
 *  - 'goon' — corrupt slime that attacks runners with status effects
 *  - 'mine' — passive crystal cluster; doesn't attack, drops gem-heavy loot on death
 *  - 'boss' — limited-time mini-boss with a countdown timer and a weakness */
export type GoonKind = 'goon' | 'mine' | 'boss';

/** Embedded entity on the mountain cliff face. Both goons and mines share the
 *  same HP / hit-detection mechanics — the differences are: mines skip the
 *  attack loop, and they render as a crystal cluster instead of a slime. */
export class MountainGoon {
  id = nextGoonId++;
  kind: GoonKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  config: GoonConfig;
  attackCd: number;
  alive = true;
  hitFlash = 0;
  bobT = Math.random() * Math.PI * 2;
  /** Boss-only fields. `boss` is the config; `timeLeft` ticks down in update;
   *  `fled` flips when the timer expires so the kill loop knows to despawn
   *  WITHOUT awarding the bonus reward. */
  boss: BossConfig | null = null;
  timeLeft = 0;
  fled = false;

  constructor(x: number, y: number, config: GoonConfig, hp = 100, kind: GoonKind = 'goon', boss: BossConfig | null = null) {
    this.x = x;
    this.y = y;
    this.config = config;
    this.maxHp = hp;
    this.hp = hp;
    this.kind = kind;
    this.boss = boss;
    if (boss) this.timeLeft = boss.timeLimit;
    // Stagger first attack so multiple goons don't fire in lockstep
    this.attackCd = 0.8 + Math.random() * config.attackInterval;
  }

  takeDamage(amount: number) {
    this.hp -= amount;
    this.hitFlash = 0.18;
    if (this.hp <= 0) this.alive = false;
  }

  containsPoint(px: number, py: number): boolean {
    // Bosses are visibly larger and need a matching hitbox.
    const r = this.kind === 'boss' ? 36 : 22;
    const dx = px - this.x;
    const dy = py - this.y;
    return dx * dx + dy * dy < r * r;
  }

  update(
    dt: number,
    pickTarget: () => { x: number; y: number } | null,
    spawnAttack: (a: GoonAttack) => void
  ) {
    if (!this.alive) return;
    this.bobT += dt;
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    // Boss countdown — if it expires before the player chips it down, the
    // boss flees (no rewards, no damage owed). Flagging `fled` first lets the
    // death-handling loop in Game.ts skip the loot/gem burst it would emit
    // for a true kill.
    if (this.kind === 'boss') {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.fled = true;
        this.alive = false;
        return;
      }
    }
    // Mines don't attack — they just sit and wait to be mined.
    if (this.kind === 'mine') return;
    this.attackCd -= dt;
    if (this.attackCd <= 0) {
      this.attackCd = this.config.attackInterval;
      const t = pickTarget();
      if (t) {
        spawnAttack(new GoonAttack(this.x, this.y, t.x, t.y, this.config));
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    if (!this.alive) return;
    if (this.kind === 'mine') {
      this.renderMine(ctx);
      return;
    }
    if (this.kind === 'boss') {
      this.renderBoss(ctx);
      return;
    }
    // === Evil bee guard === — dark-bodied bee emerging from the hive
    // surface. Glowing red eyes + blood-red stripes signal "do not loot the
    // pollen unattended." Same hitbox + HP behaviour as the old goon — just
    // cosmetic.
    const wind = Math.sin(this.bobT * 2.4) * 1.4;
    const r = 16;
    const cx = this.x;
    const cy = this.y + wind * 0.4;

    // Charge glow pulses as next attack nears (red instead of themed color).
    const chargeT = Math.max(
      0,
      1 - this.attackCd / Math.min(1.2, this.config.attackInterval)
    );
    if (chargeT > 0) {
      ctx.save();
      ctx.shadowBlur = 10 + chargeT * 10;
      ctx.shadowColor = '#ff3030';
      ctx.fillStyle = `rgba(0,0,0,0)`;
      ctx.beginPath();
      ctx.arc(cx, cy - 4, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Smoky dark wings poke up behind the body (drawn first so body overlaps).
    const wingFlap = Math.sin(this.bobT * 9) * 0.15;
    ctx.save();
    ctx.fillStyle = 'rgba(60, 50, 60, 0.55)';
    ctx.strokeStyle = 'rgba(20, 16, 20, 0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.ellipse(cx - 4, cy - r * 0.95, r * 0.55, r * 0.35 * (1 + wingFlap), -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 4, cy - r * 0.95, r * 0.5, r * 0.32 * (1 - wingFlap), -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Body — dark dome (half slime → half bee body).
    ctx.fillStyle = '#1c1418';
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.quadraticCurveTo(cx - r, cy - r * 1.2, cx, cy - r * 1.2);
    ctx.quadraticCurveTo(cx + r, cy - r * 1.2, cx + r, cy);
    ctx.closePath();
    ctx.fill();

    // Blood-red stripes clipped to the body silhouette.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.quadraticCurveTo(cx - r, cy - r * 1.2, cx, cy - r * 1.2);
    ctx.quadraticCurveTo(cx + r, cy - r * 1.2, cx + r, cy);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#8a1a24';
    ctx.fillRect(cx - r, cy - r * 0.95, r * 2, 3);
    ctx.fillRect(cx - r, cy - r * 0.45, r * 2, 3);
    ctx.restore();

    // Antennae
    ctx.save();
    ctx.strokeStyle = '#1a0608';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - r * 1.1);
    ctx.quadraticCurveTo(cx - 8, cy - r * 1.4, cx - 9, cy - r * 1.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 5, cy - r * 1.1);
    ctx.quadraticCurveTo(cx + 8, cy - r * 1.4, cx + 9, cy - r * 1.55);
    ctx.stroke();
    ctx.fillStyle = '#8a1a24';
    ctx.beginPath();
    ctx.arc(cx - 9, cy - r * 1.55, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 9, cy - r * 1.55, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // hit flash overlay
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 200, 180, ${this.hitFlash})`;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.quadraticCurveTo(cx - r, cy - r * 1.2, cx, cy - r * 1.2);
      ctx.quadraticCurveTo(cx + r, cy - r * 1.2, cx + r, cy);
      ctx.closePath();
      ctx.fill();
    }

    // Glowing red slit eyes (forced red regardless of theme).
    ctx.save();
    ctx.shadowBlur = 5;
    ctx.shadowColor = '#ff4040';
    ctx.strokeStyle = '#ff3030';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 6, cy - r * 0.6);
    ctx.lineTo(cx - 2, cy - r * 0.55);
    ctx.moveTo(cx + 6, cy - r * 0.6);
    ctx.lineTo(cx + 2, cy - r * 0.55);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();

    // Tiny HP bar below
    const barW = 28;
    const barX = cx - barW / 2;
    const barY = cy + 4;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(barX, barY, barW, 3);
    ctx.fillStyle = '#d24a4a';
    ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), 3);
  }

  /** Oversized boss bee. Same silhouette as a goon but ~1.8× scale with a
   *  pulsing aura, a tiny crown, and the boss accent color baked into the
   *  stripes. Floats higher to read as a "big" entity on the cliff face. */
  private renderBoss(ctx: CanvasRenderingContext2D) {
    const boss = this.boss!;
    const wind = Math.sin(this.bobT * 2.2) * 1.8;
    const r = 30;
    const cx = this.x;
    const cy = this.y + wind * 0.5;
    const pulse = 0.6 + 0.4 * Math.sin(this.bobT * 4);

    // Aura — large soft halo in the accent color so the boss reads even
    // through the mountain backdrop.
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.2 * pulse;
    ctx.shadowBlur = 22 + pulse * 12;
    ctx.shadowColor = boss.accentColor;
    ctx.fillStyle = boss.accentColor + '40'; // hex+alpha
    ctx.beginPath();
    ctx.arc(cx, cy - 6, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Wings — same shape as a goon, scaled up.
    const wingFlap = Math.sin(this.bobT * 8) * 0.18;
    ctx.save();
    ctx.fillStyle = 'rgba(60, 50, 60, 0.65)';
    ctx.strokeStyle = 'rgba(20, 16, 20, 0.85)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx - 8, cy - r * 0.95, r * 0.7, r * 0.42 * (1 + wingFlap), -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 8, cy - r * 0.95, r * 0.66, r * 0.4 * (1 - wingFlap), -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Body
    ctx.fillStyle = boss.bodyColor;
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.quadraticCurveTo(cx - r, cy - r * 1.2, cx, cy - r * 1.2);
    ctx.quadraticCurveTo(cx + r, cy - r * 1.2, cx + r, cy);
    ctx.closePath();
    ctx.fill();

    // Accent stripes — thicker than a regular goon's.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.quadraticCurveTo(cx - r, cy - r * 1.2, cx, cy - r * 1.2);
    ctx.quadraticCurveTo(cx + r, cy - r * 1.2, cx + r, cy);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = boss.accentColor;
    ctx.fillRect(cx - r, cy - r * 0.95, r * 2, 5);
    ctx.fillRect(cx - r, cy - r * 0.45, r * 2, 5);
    ctx.restore();

    // Antennae (longer).
    ctx.save();
    ctx.strokeStyle = '#1a0608';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 8, cy - r * 1.1);
    ctx.quadraticCurveTo(cx - 14, cy - r * 1.45, cx - 16, cy - r * 1.65);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 8, cy - r * 1.1);
    ctx.quadraticCurveTo(cx + 14, cy - r * 1.45, cx + 16, cy - r * 1.65);
    ctx.stroke();
    ctx.fillStyle = boss.accentColor;
    ctx.beginPath();
    ctx.arc(cx - 16, cy - r * 1.65, 2.4, 0, Math.PI * 2);
    ctx.arc(cx + 16, cy - r * 1.65, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Crown — three little gold spikes between the antennae to signal "boss."
    ctx.save();
    ctx.fillStyle = '#ffd24a';
    ctx.strokeStyle = '#7a5010';
    ctx.lineWidth = 1.2;
    const crownY = cy - r * 1.25;
    const spikes = [-9, 0, 9];
    for (const sx of spikes) {
      ctx.beginPath();
      ctx.moveTo(cx + sx - 4, crownY);
      ctx.lineTo(cx + sx, crownY - 8);
      ctx.lineTo(cx + sx + 4, crownY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Glowing red slit eyes (forced red).
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff4040';
    ctx.strokeStyle = '#ff3030';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy - r * 0.6);
    ctx.lineTo(cx - 3, cy - r * 0.55);
    ctx.moveTo(cx + 10, cy - r * 0.6);
    ctx.lineTo(cx + 3, cy - r * 0.55);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 220, 200, ${this.hitFlash})`;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.quadraticCurveTo(cx - r, cy - r * 1.2, cx, cy - r * 1.2);
      ctx.quadraticCurveTo(cx + r, cy - r * 1.2, cx + r, cy);
      ctx.closePath();
      ctx.fill();
    }

    // No HP bar — drawn by the HUD banner instead.
  }

  /** A honeycomb den (formerly a crystal "mine"): a small cluster of
   *  hexagonal cells filled with glowing honey-gold. Pulses gently to
   *  advertise the gem-heavy drop. Same hitbox + HP behaviour as the
   *  old crystal — just cosmetic re-skin to match the evil-bee theme. */
  private renderMine(ctx: CanvasRenderingContext2D) {
    const cx = this.x;
    const cy = this.y;
    const pulse = 0.7 + Math.sin(this.bobT * 3) * 0.3;
    const HEX_R = 5.5;
    const COMB_COL = '#e8a830';        // wax/comb body
    const HONEY_COL = '#ffd24a';       // honey fill
    const HONEY_GLOW = '#ffe890';      // pulse highlight
    const WAX_STROKE = '#7a4810';

    // Soft honey glow around the cluster.
    ctx.save();
    ctx.shadowBlur = 6 + pulse * 4;
    ctx.shadowColor = '#ffd070';
    ctx.fillStyle = 'rgba(255, 220, 140, 0.18)';
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Helper: draw one filled, outlined hexagonal cell at (hx, hy).
    const drawHex = (hx: number, hy: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.strokeStyle = WAX_STROKE;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6; // flat-top hex
        const px = hx + Math.cos(a) * HEX_R;
        const py = hy + Math.sin(a) * HEX_R;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };

    // Cluster of 7 cells: 1 center + 6 surrounding. Hex grid spacing is
    // sqrt(3) * R between row-staggered rows; flat-top neighbours sit at
    // (±1.5R, ±0.866R) and (0, ±1.732R).
    const dx = HEX_R * 1.732;          // horizontal spacing
    const dy = HEX_R * 1.5;            // vertical spacing
    const cells: Array<[number, number, boolean]> = [
      // [offset x, offset y, isPremium? (lighter honey)]
      [0,         0,         true],   // center — glows
      [-dx,       0,         false],
      [+dx,       0,         false],
      [-dx * 0.5, -dy,       false],
      [+dx * 0.5, -dy,       false],
      [-dx * 0.5, +dy,       false],
      [+dx * 0.5, +dy,       false],
    ];
    // Wax base for each cell (a slightly larger filled hex behind the honey).
    for (const [hx, hy] of cells) {
      drawHex(cx + hx, cy + hy - 2, COMB_COL);
    }
    // Honey fill — center cell pulses brighter to draw the eye.
    for (let i = 0; i < cells.length; i++) {
      const [hx, hy, premium] = cells[i]!;
      const honeyFill = premium
        ? `rgba(${255}, ${0xd2 + Math.floor(pulse * 24)}, ${0x4a + Math.floor(pulse * 60)}, 1)`
        : HONEY_COL;
      // Inset the honey slightly so the wax outline reads.
      ctx.save();
      ctx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2 + Math.PI / 6;
        const px = cx + hx + Math.cos(a) * HEX_R * 0.65;
        const py = cy + hy - 2 + Math.sin(a) * HEX_R * 0.65;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = honeyFill;
      ctx.fill();
      ctx.restore();
      // Tiny shine dot on the top-left of every cell.
      ctx.fillStyle = premium ? HONEY_GLOW : 'rgba(255, 240, 180, 0.65)';
      ctx.beginPath();
      ctx.arc(cx + hx - 1.6, cy + hy - 2 - 1.6, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hit flash
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(255, 240, 180, ${this.hitFlash})`;
      ctx.beginPath();
      ctx.arc(cx, cy - 2, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // HP bar — honey-yellow.
    const barW = 28;
    const barX = cx - barW / 2;
    const barY = cy + 14;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(barX, barY, barW, 3);
    ctx.fillStyle = '#ffd24a';
    ctx.fillRect(barX, barY, barW * (this.hp / this.maxHp), 3);
  }
}

/** Status-effect projectile fired by a MountainGoon. Travels to its target
 *  position (or until it hits a runner) and applies the goon's status. */
export class GoonAttack {
  x: number;
  y: number;
  vx: number;
  vy: number;
  config: GoonConfig;
  alive = true;
  age = 0;

  constructor(x: number, y: number, tx: number, ty: number, config: GoonConfig) {
    this.x = x;
    this.y = y;
    const dx = tx - x;
    const dy = ty - y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const speed = 320;
    this.vx = (dx / dist) * speed;
    this.vy = (dy / dist) * speed;
    this.config = config;
  }

  /** Update with runner-collision callback. The callback returns true if a
   *  runner was hit (so we know to despawn). */
  update(
    dt: number,
    runners: Array<{ x: number; y: number; applyStatus: (s: StatusKind, dur: number, val: number) => void }>
  ) {
    if (!this.alive) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;
    for (const r of runners) {
      const dx = r.x - this.x;
      const dy = (r.y - 12) - this.y;
      if (dx * dx + dy * dy < 16 * 16) {
        r.applyStatus(this.config.status, this.config.statusDuration, this.config.statusValue);
        this.alive = false;
        return;
      }
    }
    if (this.age > 3) this.alive = false;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.config.attackColor;
    ctx.fillStyle = this.config.attackColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, 5, 0, Math.PI * 2);
    ctx.fill();
    // small wobble trail
    ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.arc(this.x - this.vx * 0.04, this.y - this.vy * 0.04, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
