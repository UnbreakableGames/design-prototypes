export type EnemyKind = 'runner' | 'brute' | 'flyer' | 'boss';

export interface EnemyStats {
  hp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  radius: number;
  coinValue: number;
  /** Flat damage reduction applied to every hit the enemy takes — gives
   *  armored units like the brute a way to soak arrows. */
  armor: number;
}

export const ENEMY_STATS: Record<EnemyKind, EnemyStats> = {
  runner: { hp: 4,  speed: 55, damage: 4,  attackInterval: 1.0, radius: 8,  coinValue: 1,  armor: 0 },
  brute:  { hp: 12, speed: 32, damage: 10, attackInterval: 1.4, radius: 11, coinValue: 3,  armor: 1 },
  flyer:  { hp: 4,  speed: 70, damage: 3,  attackInterval: 0.8, radius: 7,  coinValue: 2,  armor: 0 },
  boss:   { hp: 80, speed: 24, damage: 20, attackInterval: 1.8, radius: 18, coinValue: 20, armor: 2 },
};

/** Apply armor to an incoming hit — returns the damage dealt after soak,
 *  clamped to a minimum of 1 so hits always land at least a chip. */
export function armoredDamage(enemy: Enemy, damage: number): number {
  const armor = ENEMY_STATS[enemy.kind].armor;
  return Math.max(1, damage - armor);
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackTimer: number;
  hitFlash: number;
}

let nextId = 1;

export function createEnemy(kind: EnemyKind, x: number, y: number): Enemy {
  const s = ENEMY_STATS[kind];
  return {
    id: nextId++,
    kind,
    x,
    y,
    hp: s.hp,
    maxHp: s.hp,
    attackTimer: 0,
    hitFlash: 0,
  };
}
