export interface Portal {
  id: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  swirl: number;
  discovered: boolean;
  defendCooldown: number;
}

export const PORTAL_MAX_HP = 30;
export const PORTAL_RADIUS = 18;
export const PORTAL_DEFEND_COOLDOWN = 2.4;

let nextId = 1;

export function createPortal(x: number, y: number): Portal {
  return {
    id: nextId++,
    x,
    y,
    hp: PORTAL_MAX_HP,
    maxHp: PORTAL_MAX_HP,
    hitFlash: 0,
    swirl: Math.random() * Math.PI * 2,
    discovered: false,
    defendCooldown: 0,
  };
}
