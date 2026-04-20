export interface FlyingCoin {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  age: number;
  duration: number;
  arcHeight: number;
}

const DEFAULT_DURATION = 0.32;

export function createFlyingCoin(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): FlyingCoin {
  const dist = Math.hypot(tx - sx, ty - sy);
  return {
    sx,
    sy,
    tx,
    ty,
    age: 0,
    duration: DEFAULT_DURATION,
    arcHeight: Math.min(32, 10 + dist * 0.12),
  };
}

export function updateFlyingCoin(c: FlyingCoin, dt: number): boolean {
  c.age += dt;
  return c.age < c.duration;
}

export function flyingCoinPos(c: FlyingCoin): { x: number; y: number } {
  const t = Math.min(1, c.age / c.duration);
  const x = c.sx + (c.tx - c.sx) * t;
  const y = c.sy + (c.ty - c.sy) * t - Math.sin(Math.PI * t) * c.arcHeight;
  return { x, y };
}
