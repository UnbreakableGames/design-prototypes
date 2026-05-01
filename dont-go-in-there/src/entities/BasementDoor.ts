import { rect, text } from '../systems/Render';

export class BasementDoor {
  x: number;
  y: number;
  w = 88;
  h = 130;
  // Used to drive a slow red pulse behind the door so it draws the eye.
  flicker = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  update(dt: number): void {
    this.flicker += dt;
  }

  render(ctx: CanvasRenderingContext2D): void {
    // Pulsing red glow behind the door — an unmissable focal point.
    const pulse = 0.55 + 0.25 * (Math.sin(this.flicker * 1.6) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = pulse * 0.55;
    const glow = ctx.createRadialGradient(
      this.x + this.w / 2,
      this.y + this.h / 2,
      8,
      this.x + this.w / 2,
      this.y + this.h / 2,
      this.w,
    );
    glow.addColorStop(0, '#a5526a');
    glow.addColorStop(1, 'rgba(165,82,106,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(this.x - this.w / 2, this.y - this.h / 4, this.w * 2, this.h * 1.5);
    ctx.restore();

    // Heavy door frame
    rect(ctx, this.x - 4, this.y - 4, this.w + 8, this.h + 8, '#3a1418', '#7a1c20');
    rect(ctx, this.x, this.y, this.w, this.h, '#0a0608', '#1a1418');
    rect(ctx, this.x + 6, this.y + 6, this.w - 12, this.h - 12, '#1f1418', '#0a0608');
    // door panels (vertical planks)
    ctx.strokeStyle = '#0a0608';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const px = this.x + 6 + (this.w - 12) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(px, this.y + 6);
      ctx.lineTo(px, this.y + this.h - 6);
      ctx.stroke();
    }

    // Red warning tape — diagonal X across the door
    ctx.save();
    ctx.strokeStyle = '#c9a14a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(this.x + 8, this.y + 16);
    ctx.lineTo(this.x + this.w - 8, this.y + this.h - 16);
    ctx.moveTo(this.x + this.w - 8, this.y + 16);
    ctx.lineTo(this.x + 8, this.y + this.h - 16);
    ctx.stroke();
    // Black hazard stripes on the tape
    ctx.strokeStyle = '#0a0608';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(this.x + 8, this.y + 16);
    ctx.lineTo(this.x + this.w - 8, this.y + this.h - 16);
    ctx.moveTo(this.x + this.w - 8, this.y + 16);
    ctx.lineTo(this.x + 8, this.y + this.h - 16);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // "STAY OUT" sign nailed to the door
    const signW = 60;
    const signH = 18;
    const signX = this.x + (this.w - signW) / 2;
    const signY = this.y + 16;
    rect(ctx, signX, signY, signW, signH, '#d8c8a8', '#7a5a3a');
    text(ctx, 'STAY OUT', signX + signW / 2, signY + 4, {
      align: 'center',
      size: 11,
      color: '#7a1c20',
      font: "'Special Elite', monospace",
    });
    // tape corners
    ctx.fillStyle = '#7a3030';
    ctx.fillRect(signX - 2, signY - 2, 6, 4);
    ctx.fillRect(signX + signW - 4, signY - 2, 6, 4);

    // Brass door knob
    ctx.fillStyle = '#c9a14a';
    ctx.beginPath();
    ctx.arc(this.x + this.w - 14, this.y + this.h / 2 + 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label above the door
    text(ctx, 'BASEMENT', this.x + this.w / 2, this.y - 18, {
      align: 'center',
      size: 12,
      color: '#a5526a',
      font: "'Special Elite', monospace",
    });
  }
}
