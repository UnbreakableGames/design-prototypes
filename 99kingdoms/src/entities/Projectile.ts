export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  /** Forge "pierce-tipped shafts" Tier III lets an arrow keep flying after
   *  hitting one enemy. Capped at one extra pass so volleys don't sweep
   *  whole packs in a single shot. */
  piercesRemaining?: number;
  /** ids of enemies this arrow has already passed through, so a piercing
   *  shaft doesn't double-hit the same target on consecutive frames. */
  hitEnemyIds?: number[];
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
