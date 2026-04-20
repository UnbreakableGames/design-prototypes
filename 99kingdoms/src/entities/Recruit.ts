export type RecruitStatus = 'wandering' | 'idle' | 'moving' | 'working';

export const RECRUIT_SPEED = 75;
export const RECRUIT_RADIUS = 8;

export interface Recruit {
  id: number;
  x: number;
  y: number;
  status: RecruitStatus;
  stationId: number | null;
  /** For knights: the wall station they've been posted to (upgraded walls
   *  demand extra defenders that barracks fills). null for all other recruits. */
  wallPostId: number | null;
  targetX: number;
  targetY: number;
  orbitAngle: number;
  workTimer: number;
  chopTargetNodeId: number | null;
  carriedCoins: number;
  rescueProgress: number;
}

export const RECRUIT_CARRY_CAP = 6;
export const RECRUIT_PICKUP_RADIUS = 12;

let nextId = 1;

export function createWanderer(
  spawnX: number,
  spawnY: number,
  destX: number,
  destY: number,
): Recruit {
  return {
    id: nextId++,
    x: spawnX,
    y: spawnY,
    status: 'wandering',
    stationId: null,
    wallPostId: null,
    targetX: destX,
    targetY: destY,
    orbitAngle: Math.random() * Math.PI * 2,
    workTimer: 0,
    chopTargetNodeId: null,
    carriedCoins: 0,
    rescueProgress: 0,
  };
}

export const RESCUE_COST = 2;

export function moveTowards(r: Recruit, tx: number, ty: number, dt: number): boolean {
  const dx = tx - r.x;
  const dy = ty - r.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  r.x += (dx / d) * RECRUIT_SPEED * dt;
  r.y += (dy / d) * RECRUIT_SPEED * dt;
  return false;
}
