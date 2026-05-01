import { ALL_PARTS, PART_PRIMARY, ITEM_COLOR, type PartKey } from '../types';
import { rect, text } from '../systems/Render';

const AMBIENT_LINES = [
  'hello...',
  '...are you there?',
  '...friend...',
  '...come closer...',
  "i'm waiting.",
  "...don't leave...",
  '...do you hear me?',
  '...so cold.',
  '...closer.',
  '...you came back.',
  '...soon.',
];

const AMBIENT_DURATION = 3.5;

export class Friend {
  x: number;
  y: number;
  w = 64;
  h = 110;

  private ambientLine: string | null = null;
  private ambientTimer = 0;
  private ambientCooldown: number;
  private ambientFloatY = 0;
  private firstShown = false;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    // First line appears 3-7s after entering the bedroom — long enough that
    // the player gets oriented, short enough that they probably haven't left.
    this.ambientCooldown = 3 + Math.random() * 4;
  }

  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(dt: number): void {
    if (this.ambientLine !== null) {
      this.ambientTimer -= dt;
      this.ambientFloatY += dt * 6;
      if (this.ambientTimer <= 0) {
        this.ambientLine = null;
        this.ambientFloatY = 0;
        this.ambientCooldown = 8 + Math.random() * 8; // next line 8-16s later
      }
    } else {
      this.ambientCooldown -= dt;
      if (this.ambientCooldown <= 0) {
        if (!this.firstShown) {
          this.ambientLine = 'hello...';
          this.firstShown = true;
        } else {
          this.ambientLine =
            AMBIENT_LINES[Math.floor(Math.random() * AMBIENT_LINES.length)] ?? null;
        }
        this.ambientTimer = AMBIENT_DURATION;
        this.ambientFloatY = 0;
      }
    }
  }

  renderAmbient(ctx: CanvasRenderingContext2D, suppressed: boolean): void {
    if (suppressed || this.ambientLine === null) return;
    const elapsed = AMBIENT_DURATION - this.ambientTimer;
    let alpha = 1;
    if (elapsed < 0.4) alpha = elapsed / 0.4;
    else if (this.ambientTimer < 0.7) alpha = this.ambientTimer / 0.7;
    alpha = Math.max(0, Math.min(1, alpha));
    const tx = this.x + this.w / 2;
    const ty = this.y - 32 - this.ambientFloatY;
    ctx.save();
    ctx.globalAlpha = alpha;
    text(ctx, this.ambientLine, tx, ty, {
      align: 'center',
      size: 13,
      color: '#a5526a',
      font: "'Special Elite', monospace",
    });
    ctx.restore();
  }

  partRects(): Record<PartKey, { x: number; y: number; w: number; h: number }> {
    return {
      head: { x: this.x + 18, y: this.y, w: 28, h: 28 },
      chest: { x: this.x + 8, y: this.y + 32, w: 48, h: 36 },
      arm: { x: this.x + 56, y: this.y + 34, w: 14, h: 36 },
      leg: { x: this.x + 14, y: this.y + 72, w: 36, h: 38 },
    };
  }

  render(ctx: CanvasRenderingContext2D, parts: Record<PartKey, boolean>): void {
    // shadow under
    rect(ctx, this.x - 4, this.y + this.h - 4, this.w + 8, 6, 'rgba(0,0,0,0.4)');
    const pr = this.partRects();
    for (const p of ALL_PARTS) {
      const r = pr[p];
      const repaired = parts[p];
      const fill = repaired ? ITEM_COLOR[PART_PRIMARY[p]] : '#1a1418';
      const stroke = repaired ? '#3a2c1a' : '#2a232b';
      rect(ctx, r.x, r.y, r.w, r.h, fill, stroke);
    }
    // eyes if head repaired — creepy
    const head = pr.head;
    if (parts.head) {
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(head.x + 8, head.y + 14, 2.5, 0, Math.PI * 2);
      ctx.arc(head.x + 20, head.y + 14, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = '#3b2b1a';
      ctx.fillRect(head.x + 6, head.y + 12, 5, 4);
      ctx.fillRect(head.x + 18, head.y + 12, 5, 4);
    }
    // mouth slit
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(head.x + 8, head.y + 22, 12, 2);

    text(ctx, 'friend', this.x + this.w / 2, this.y - 14, {
      align: 'center',
      size: 10,
      color: '#5a4836',
      font: "'Special Elite', monospace",
    });
  }
}
