export interface Coin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  value: number;
  magnetized: boolean;
}

export const COIN_MAGNET_RADIUS = 22;
export const COIN_PICKUP_RADIUS = 14;
export const COIN_DRAG = 3.8;
export const COIN_MAGNET_SPEED = 220;
export const COIN_POP_TIME = 0.45;

export function createCoin(x: number, y: number, value = 1): Coin {
  const angle = Math.random() * Math.PI * 2;
  const speed = 90 + Math.random() * 80;
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    age: 0,
    lifetime: 30,
    value,
    magnetized: false,
  };
}
