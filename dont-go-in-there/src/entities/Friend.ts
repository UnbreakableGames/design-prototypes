import { ALL_PARTS, PART_PRIMARY, ITEM_COLOR, type PartKey } from '../types';
import { rect, text } from '../systems/Render';

const AMBIENT_LINES = [
  'hello...',
  '...are you there?',
  '..."friend"...',
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
    // Pedestal / operating table beneath the friend
    const pedX = this.x - 14;
    const pedY = this.y + this.h - 2;
    const pedW = this.w + 28;
    rect(ctx, pedX, pedY, pedW, 12, '#3a2820', '#1a120a');
    rect(ctx, pedX + 2, pedY + 2, pedW - 4, 4, '#5b432a', '#1a120a');
    // pedestal legs
    ctx.fillStyle = '#2a1c14';
    ctx.fillRect(pedX + 4, pedY + 12, 5, 8);
    ctx.fillRect(pedX + pedW - 9, pedY + 12, 5, 8);
    // a clipboard / chart hanging off the pedestal edge — adds "in surgery" feel
    rect(ctx, pedX + pedW - 12, pedY - 18, 14, 18, '#d8c8a8', '#7a5a3a');
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(pedX + pedW - 10, pedY - 14 + i * 4);
      ctx.lineTo(pedX + pedW - 4, pedY - 14 + i * 4);
      ctx.stroke();
    }
    // shadow under
    rect(ctx, this.x - 4, pedY - 4, this.w + 8, 6, 'rgba(0,0,0,0.4)');

    // Wires hanging from broken parts — drawn behind the parts so they trail out.
    const pr = this.partRects();
    ctx.lineWidth = 1.5;
    if (!parts.chest) {
      ctx.strokeStyle = '#7ec0ee';
      ctx.beginPath();
      ctx.moveTo(pr.chest.x + 8, pr.chest.y + pr.chest.h);
      ctx.bezierCurveTo(
        pr.chest.x + 4,
        pr.chest.y + pr.chest.h + 14,
        pr.chest.x + 16,
        pr.chest.y + pr.chest.h + 18,
        pr.chest.x + 12,
        pr.chest.y + pr.chest.h + 28,
      );
      ctx.stroke();
      ctx.strokeStyle = '#a5526a';
      ctx.beginPath();
      ctx.moveTo(pr.chest.x + 22, pr.chest.y + pr.chest.h);
      ctx.bezierCurveTo(
        pr.chest.x + 30,
        pr.chest.y + pr.chest.h + 12,
        pr.chest.x + 18,
        pr.chest.y + pr.chest.h + 22,
        pr.chest.x + 26,
        pr.chest.y + pr.chest.h + 30,
      );
      ctx.stroke();
    }
    if (!parts.arm) {
      ctx.strokeStyle = '#c9a14a';
      ctx.beginPath();
      ctx.moveTo(pr.arm.x + pr.arm.w, pr.arm.y + 6);
      ctx.bezierCurveTo(
        pr.arm.x + pr.arm.w + 14,
        pr.arm.y + 4,
        pr.arm.x + pr.arm.w + 12,
        pr.arm.y + 22,
        pr.arm.x + pr.arm.w + 18,
        pr.arm.y + 28,
      );
      ctx.stroke();
    }

    // Body parts — base color brightened from #1a1418 so the friend reads
    // clearly against the bedroom floor.
    for (const p of ALL_PARTS) {
      const r = pr[p];
      const repaired = parts[p];
      const fill = repaired ? ITEM_COLOR[PART_PRIMARY[p]] : '#4a3a3c';
      const stroke = repaired ? '#3a2c1a' : '#6a4a4c';
      rect(ctx, r.x, r.y, r.w, r.h, fill, stroke);
      // Visible screws in the corners of each part
      if (!repaired) {
        ctx.fillStyle = '#1a120a';
        ctx.fillRect(r.x + 2, r.y + 2, 2, 2);
        ctx.fillRect(r.x + r.w - 4, r.y + 2, 2, 2);
        ctx.fillRect(r.x + 2, r.y + r.h - 4, 2, 2);
        ctx.fillRect(r.x + r.w - 4, r.y + r.h - 4, 2, 2);
      }
    }
    // Cracks across the chest plate — extra detail on the unrepaired animatronic.
    if (!parts.chest) {
      ctx.strokeStyle = '#0a0608';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pr.chest.x + 12, pr.chest.y + 6);
      ctx.lineTo(pr.chest.x + 18, pr.chest.y + 14);
      ctx.lineTo(pr.chest.x + 14, pr.chest.y + 22);
      ctx.lineTo(pr.chest.x + 22, pr.chest.y + 30);
      ctx.stroke();
    }

    // Eyes
    const head = pr.head;
    if (parts.head) {
      // glowing pair when repaired
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(head.x + 8, head.y + 14, 2.8, 0, Math.PI * 2);
      ctx.arc(head.x + 20, head.y + 14, 2.8, 0, Math.PI * 2);
      ctx.fill();
      // soft glow halo
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(head.x + 8, head.y + 14, 5, 0, Math.PI * 2);
      ctx.arc(head.x + 20, head.y + 14, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // hollow sockets when broken
      ctx.fillStyle = '#0a0608';
      ctx.fillRect(head.x + 6, head.y + 11, 6, 6);
      ctx.fillRect(head.x + 16, head.y + 11, 6, 6);
      // tiny pinprick "pupil" deep in the socket
      ctx.fillStyle = '#3a1418';
      ctx.fillRect(head.x + 8, head.y + 13, 2, 2);
      ctx.fillRect(head.x + 18, head.y + 13, 2, 2);
    }
    // Stitched mouth
    ctx.strokeStyle = '#0a0608';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(head.x + 7, head.y + 22);
    ctx.lineTo(head.x + 21, head.y + 22);
    ctx.stroke();
    ctx.fillStyle = '#0a0608';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(head.x + 9 + i * 3, head.y + 21, 1, 4);
    }

    // Hanging "PROTOTYPE 7" tag — gives it a creepy doll/animatronic feel.
    const tagX = this.x + this.w / 2 - 12;
    const tagY = this.y + this.h - 6;
    ctx.strokeStyle = '#5a4836';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x + this.w / 2, this.y + this.h - 14);
    ctx.lineTo(this.x + this.w / 2, tagY);
    ctx.stroke();
    rect(ctx, tagX, tagY, 24, 12, '#d8c8a8', '#7a5a3a');
    text(ctx, 'PROTO 7', tagX + 12, tagY + 2, {
      align: 'center',
      size: 7,
      color: '#7a3030',
      font: "'Special Elite', monospace",
    });

    text(ctx, '"friend"', this.x + this.w / 2, this.y - 14, {
      align: 'center',
      size: 10,
      color: '#5a4836',
      font: "'Special Elite', monospace",
    });
  }
}
