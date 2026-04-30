import { ALL_PARTS, PART_REQUIRES, ITEM_COLOR, type PartKey } from '../types';
import { rect, text } from '../systems/Render';

export class Friend {
  x: number;
  y: number;
  w = 64;
  h = 110;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
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
      const fill = repaired ? ITEM_COLOR[PART_REQUIRES[p]] : '#1a1418';
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
