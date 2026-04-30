import { rect, text } from '../systems/Render';

export type StairsDir = 'up' | 'down';

export class Stairs {
  x: number;
  y: number;
  w = 36;
  h = 36;
  dir: StairsDir;

  constructor(x: number, y: number, dir: StairsDir) {
    this.x = x - this.w / 2;
    this.y = y - this.h / 2;
    this.dir = dir;
  }

  cx() {
    return this.x + this.w / 2;
  }
  cy() {
    return this.y + this.h / 2;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const base = this.dir === 'up' ? '#3a3026' : '#2a1a18';
    const accent = this.dir === 'up' ? '#7a6a4a' : '#5a2a26';
    rect(ctx, this.x, this.y, this.w, this.h, base, '#0a0608');
    // step lines
    for (let i = 0; i < 4; i++) {
      const yy = this.y + 6 + i * 7;
      rect(ctx, this.x + 4, yy, this.w - 8, 2, accent);
    }
    text(ctx, this.dir === 'up' ? 'UP' : 'DOWN', this.cx(), this.y - 14, {
      align: 'center',
      size: 10,
      color: this.dir === 'up' ? '#9aa3ad' : '#a5526a',
      font: "'Special Elite', monospace",
    });
  }
}
