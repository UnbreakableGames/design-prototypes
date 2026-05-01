import { rect, text } from '../systems/Render';

export class Workbench {
  x: number;
  y: number;
  w = 100;
  h = 38;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Wood top
    rect(ctx, this.x, this.y, this.w, this.h, '#5b3a28', '#1a120a');
    rect(ctx, this.x + 2, this.y + 2, this.w - 4, 6, '#7a5a3a', '#3a2820');
    // table legs
    ctx.fillStyle = '#3a2820';
    ctx.fillRect(this.x + 2, this.y + this.h - 2, 6, 4);
    ctx.fillRect(this.x + this.w - 8, this.y + this.h - 2, 6, 4);

    // Schematic / blueprint sheet (graph paper with traces)
    const sx = this.x + 6;
    const sy = this.y + 12;
    const sw = 30;
    const sh = 22;
    rect(ctx, sx, sy, sw, sh, '#1a3a4a', '#7a5a3a');
    ctx.strokeStyle = '#3a6a7a';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(sx + i * (sw / 4), sy);
      ctx.lineTo(sx + i * (sw / 4), sy + sh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx, sy + i * (sh / 4));
      ctx.lineTo(sx + sw, sy + i * (sh / 4));
      ctx.stroke();
    }
    // circuit trace + node dots
    ctx.strokeStyle = '#7ec0ee';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + 4, sy + 6);
    ctx.lineTo(sx + sw - 4, sy + 6);
    ctx.lineTo(sx + sw - 4, sy + sh - 6);
    ctx.lineTo(sx + 4, sy + sh - 6);
    ctx.stroke();
    ctx.fillStyle = '#a5526a';
    ctx.fillRect(sx + 3, sy + 5, 2, 2);
    ctx.fillRect(sx + sw - 5, sy + sh - 7, 2, 2);

    // Soldering iron (handle + metal shaft + glowing tip + cord)
    ctx.fillStyle = '#3a2820';
    ctx.fillRect(this.x + 40, this.y + 14, 14, 4);
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(this.x + 54, this.y + 15, 8, 2);
    ctx.fillStyle = '#ff6a40';
    ctx.fillRect(this.x + 62, this.y + 15, 2, 2);
    // cord coiling off the back
    ctx.strokeStyle = '#0a0608';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x + 40, this.y + 16);
    ctx.bezierCurveTo(
      this.x + 32,
      this.y + 28,
      this.x + 50,
      this.y + 30,
      this.x + 38,
      this.y + 34,
    );
    ctx.stroke();

    // Screwdriver below the iron
    ctx.fillStyle = '#7a3030';
    ctx.fillRect(this.x + 42, this.y + 22, 9, 4);
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(this.x + 51, this.y + 23, 9, 2);

    // Spool of wire
    ctx.fillStyle = '#7ec0ee';
    ctx.beginPath();
    ctx.arc(this.x + 74, this.y + 18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a8aa5';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#1a1218';
    ctx.beginPath();
    ctx.arc(this.x + 74, this.y + 18, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Pliers
    ctx.strokeStyle = '#9aa3ad';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(this.x + 84, this.y + 14);
    ctx.lineTo(this.x + 92, this.y + 26);
    ctx.moveTo(this.x + 92, this.y + 14);
    ctx.lineTo(this.x + 84, this.y + 26);
    ctx.stroke();
    ctx.fillStyle = '#7a5a3a';
    ctx.beginPath();
    ctx.arc(this.x + 88, this.y + 20, 1.5, 0, Math.PI * 2);
    ctx.fill();

    text(ctx, 'crafting table', this.x + this.w / 2, this.y - 12, {
      align: 'center',
      size: 10,
      color: '#5a4836',
      font: "'Special Elite', monospace",
    });
  }
}
