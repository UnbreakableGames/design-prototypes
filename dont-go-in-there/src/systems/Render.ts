export const W = 960;
export const H = 640;

export function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}

export function text(
  ctx: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  opts: { color?: string; size?: number; font?: string; align?: CanvasTextAlign; baseline?: CanvasTextBaseline } = {},
) {
  ctx.fillStyle = opts.color ?? '#c9b9a4';
  ctx.font = `${opts.size ?? 14}px ${opts.font ?? "'Inter Tight', system-ui, sans-serif"}`;
  ctx.textAlign = opts.align ?? 'left';
  ctx.textBaseline = opts.baseline ?? 'top';
  ctx.fillText(s, x, y);
}

export function vignette(ctx: CanvasRenderingContext2D, strength = 0.6) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

export function darkness(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  alpha = 0.92,
) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.4, cx, cy, radius);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, `rgba(0,0,0,${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // outer pitch black
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  ctx.restore();
}

export function pointInRect(px: number, py: number, x: number, y: number, w: number, h: number): boolean {
  return px >= x && px <= x + w && py >= y && py <= y + h;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Distance from a point to the nearest edge of an AABB. Returns 0 when the
// point is inside the rect. Useful for "interaction range" checks against
// entities of any aspect ratio — works equally well from short and long sides.
export function distToRect(px: number, py: number, x: number, y: number, w: number, h: number): number {
  const cx = Math.max(x, Math.min(px, x + w));
  const cy = Math.max(y, Math.min(py, y + h));
  const dx = px - cx;
  const dy = py - cy;
  return Math.sqrt(dx * dx + dy * dy);
}
