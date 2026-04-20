export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
}

export function createArrow(x: number, y: number, angle: number): Projectile {
  const speed = 280;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    life: 1.2,
    damage: 2,
  };
}
