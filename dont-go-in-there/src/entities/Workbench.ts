import { rect, text } from '../systems/Render';

export class Workbench {
  x: number;
  y: number;
  w = 90;
  h = 32;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  interactPos() {
    return { x: this.x + this.w / 2, y: this.y + this.h + 18 };
  }

  render(ctx: CanvasRenderingContext2D): void {
    rect(ctx, this.x, this.y, this.w, this.h, '#3a2a1c', '#1a120a');
    rect(ctx, this.x + 4, this.y + 4, this.w - 8, 6, '#5b432a');
    // tools laid out
    rect(ctx, this.x + 10, this.y + 14, 16, 4, '#9aa3ad');
    rect(ctx, this.x + 32, this.y + 12, 4, 14, '#c9a14a');
    rect(ctx, this.x + 44, this.y + 16, 22, 3, '#7ec0ee');
    text(ctx, 'workbench', this.x + this.w / 2, this.y - 12, {
      align: 'center',
      size: 10,
      color: '#5a4836',
      font: "'Special Elite', monospace",
    });
  }
}
