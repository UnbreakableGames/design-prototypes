import { rect, text } from '../systems/Render';

export class BasementDoor {
  x: number;
  y: number;
  w = 44;
  h = 60;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  render(ctx: CanvasRenderingContext2D): void {
    rect(ctx, this.x, this.y, this.w, this.h, '#0a0608', '#1a1418');
    rect(ctx, this.x + 4, this.y + 4, this.w - 8, this.h - 8, '#1f1418', '#0a0608');
    // handle
    ctx.fillStyle = '#c9a14a';
    ctx.beginPath();
    ctx.arc(this.x + this.w - 10, this.y + this.h / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'basement', this.x + this.w / 2, this.y - 12, {
      align: 'center',
      size: 10,
      color: '#7a3030',
      font: "'Special Elite', monospace",
    });
  }
}
