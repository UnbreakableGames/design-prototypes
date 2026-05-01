import { ITEM_COLOR, ITEM_LABEL, type ItemKind } from '../types';
import { text } from '../systems/Render';

export class ItemPickup {
  x: number;
  y: number;
  kind: ItemKind;
  taken = false;
  pickupArmed = true;
  bob = 0;
  vx = 0;
  vy = 0;

  constructor(x: number, y: number, kind: ItemKind) {
    this.x = x;
    this.y = y;
    this.kind = kind;
    this.bob = Math.random() * Math.PI * 2;
  }

  update(dt: number, isWalkableFn?: (x: number, y: number) => boolean): void {
    this.bob += dt * 2;
    if (this.vx !== 0 || this.vy !== 0) {
      // Per-axis movement so a wall on one axis doesn't kill the other
      const stepX = this.vx * dt;
      const stepY = this.vy * dt;
      if (!isWalkableFn || isWalkableFn(this.x + stepX, this.y)) {
        this.x += stepX;
      } else {
        this.vx = 0;
      }
      if (!isWalkableFn || isWalkableFn(this.x, this.y + stepY)) {
        this.y += stepY;
      } else {
        this.vy = 0;
      }
      const decay = Math.pow(0.0008, dt);
      this.vx *= decay;
      this.vy *= decay;
      if (Math.abs(this.vx) < 1) this.vx = 0;
      if (Math.abs(this.vy) < 1) this.vy = 0;
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    if (this.taken) return;
    const yy = this.y + Math.sin(this.bob) * 2;
    // glow
    ctx.fillStyle = ITEM_COLOR[this.kind] + '33';
    ctx.beginPath();
    ctx.arc(this.x, yy, 14, 0, Math.PI * 2);
    ctx.fill();
    // body
    ctx.fillStyle = ITEM_COLOR[this.kind];
    ctx.fillRect(this.x - 6, yy - 6, 12, 12);
    ctx.strokeStyle = '#0a0608';
    ctx.strokeRect(this.x - 6 + 0.5, yy - 6 + 0.5, 11, 11);
    text(ctx, ITEM_LABEL[this.kind], this.x, yy - 22, {
      align: 'center',
      size: 9,
      color: '#a59886',
      font: "'Special Elite', monospace",
    });
  }
}
