export interface CampfireLevel {
  maxHp: number;
  baseLightRadius: number;
  upgradeCost: number;
}

export const CAMPFIRE_LEVELS: CampfireLevel[] = [
  { maxHp: 100, baseLightRadius: 150, upgradeCost: 0 },
  { maxHp: 160, baseLightRadius: 185, upgradeCost: 40 },
  { maxHp: 240, baseLightRadius: 220, upgradeCost: 75 },
];

export const MAX_CAMPFIRE_LEVEL = CAMPFIRE_LEVELS.length;
export const CAMPFIRE_READY_DELAY = 0.9;

export class Campfire {
  readonly x: number;
  readonly y: number;
  maxHp: number;
  hp: number;
  flicker = 0;
  level = 1;
  upgradeProgress = 0;
  readyTimer = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.maxHp = CAMPFIRE_LEVELS[0].maxHp;
    this.hp = this.maxHp;
  }

  update(dt: number) {
    this.flicker = (this.flicker + dt * 2.8) % (Math.PI * 2);
  }

  get lightRadius(): number {
    const base = CAMPFIRE_LEVELS[this.level - 1].baseLightRadius;
    return base + Math.sin(this.flicker) * 6;
  }

  nextUpgradeCost(): number | null {
    if (this.level >= MAX_CAMPFIRE_LEVEL) return null;
    return CAMPFIRE_LEVELS[this.level].upgradeCost;
  }

  /** Returns null if the next campfire level is ready to pay for; else a reason string. */
  upgradeBlockReason(
    stations: Array<{ kind: string; active: boolean }>,
  ): string | null {
    if (this.level >= MAX_CAMPFIRE_LEVEL) return null;
    const nextLevel = this.level + 1;
    if (nextLevel === 2) {
      const ok = stations.some((s) => s.kind === 'garrison' && s.active);
      return ok ? null : 'Build a Garrison first';
    }
    if (nextLevel === 3) {
      const barracks = stations.some((s) => s.kind === 'barracks' && s.active);
      const blacksmith = stations.some((s) => s.kind === 'blacksmith' && s.active);
      if (!barracks) return 'Build a Barracks first';
      if (!blacksmith) return 'Build a Blacksmith first';
    }
    return null;
  }

  levelUp() {
    if (this.level >= MAX_CAMPFIRE_LEVEL) return;
    this.level += 1;
    this.upgradeProgress = 0;
    this.readyTimer = CAMPFIRE_READY_DELAY;
    this.maxHp = CAMPFIRE_LEVELS[this.level - 1].maxHp;
    this.hp = this.maxHp;
  }
}
