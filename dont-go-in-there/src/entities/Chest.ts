import { rect, text } from '../systems/Render';

export class Chest {
  x: number;
  y: number;
  w = 50;
  h = 36;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  render(ctx: CanvasRenderingContext2D): void {
    rect(ctx, this.x, this.y + 4, this.w, this.h - 4, '#4a3522', '#1a120a');
    rect(ctx, this.x, this.y, this.w, 10, '#5b432a', '#1a120a');
    rect(ctx, this.x + this.w / 2 - 3, this.y + 14, 6, 6, '#c9a14a');
    text(ctx, 'chest', this.x + this.w / 2, this.y - 12, {
      align: 'center',
      size: 10,
      color: '#5a4836',
      font: "'Special Elite', monospace",
    });
  }
}
