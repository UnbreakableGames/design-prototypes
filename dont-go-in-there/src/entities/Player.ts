import type { Input } from '../systems/Input';

export type Rect = { x: number; y: number; w: number; h: number };

export class Player {
  x: number;
  y: number;
  radius = 10;
  speed = 160;
  facing: 'up' | 'down' | 'left' | 'right' = 'down';

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(
    dt: number,
    input: Input,
    walls: Rect[],
    bounds: Rect,
    isPosValid?: (x: number, y: number) => boolean,
  ): void {
    let dx = 0;
    let dy = 0;
    if (input.held('KeyW') || input.held('ArrowUp')) dy -= 1;
    if (input.held('KeyS') || input.held('ArrowDown')) dy += 1;
    if (input.held('KeyA') || input.held('ArrowLeft')) dx -= 1;
    if (input.held('KeyD') || input.held('ArrowRight')) dx += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      if (Math.abs(dx) > Math.abs(dy)) this.facing = dx > 0 ? 'right' : 'left';
      else this.facing = dy > 0 ? 'down' : 'up';
    }

    const step = this.speed * dt;
    this.tryMove(dx * step, 0, walls, bounds, isPosValid);
    this.tryMove(0, dy * step, walls, bounds, isPosValid);
  }

  private tryMove(
    dx: number,
    dy: number,
    walls: Rect[],
    bounds: Rect,
    isPosValid?: (x: number, y: number) => boolean,
  ): void {
    const nx = this.x + dx;
    const ny = this.y + dy;
    const r = this.radius;
    if (nx - r < bounds.x || nx + r > bounds.x + bounds.w) return;
    if (ny - r < bounds.y || ny + r > bounds.y + bounds.h) return;
    for (const w of walls) {
      const cx = Math.max(w.x, Math.min(nx, w.x + w.w));
      const cy = Math.max(w.y, Math.min(ny, w.y + w.h));
      const ddx = nx - cx;
      const ddy = ny - cy;
      if (ddx * ddx + ddy * ddy < r * r) return;
    }
    if (isPosValid) {
      // sample 4 cardinal points on the radius so player can't slip across a room edge
      if (
        !isPosValid(nx, ny) ||
        !isPosValid(nx + r * 0.7, ny) ||
        !isPosValid(nx - r * 0.7, ny) ||
        !isPosValid(nx, ny + r * 0.7) ||
        !isPosValid(nx, ny - r * 0.7)
      ) {
        return;
      }
    }
    this.x = nx;
    this.y = ny;
  }

  render(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = '#e8d9b8';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a1c';
    let fx = this.x;
    let fy = this.y;
    const off = this.radius - 3;
    if (this.facing === 'up') fy -= off;
    if (this.facing === 'down') fy += off;
    if (this.facing === 'left') fx -= off;
    if (this.facing === 'right') fx += off;
    ctx.beginPath();
    ctx.arc(fx, fy, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  near(x: number, y: number, range: number): boolean {
    const dx = this.x - x;
    const dy = this.y - y;
    return dx * dx + dy * dy < range * range;
  }
}
