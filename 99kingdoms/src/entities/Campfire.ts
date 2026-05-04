export interface CampfireLevel {
  maxHp: number;
  baseLightRadius: number;
  upgradeCost: number;
  /** Enemies inside this radius take `auraDamage` every aura tick. */
  auraRadius: number;
  /** Damage per aura tick. Small on purpose — aura is a passive stall,
   *  not a weapon. Level 3 can solo a runner in 3–4 s if it lingers. */
  auraDamage: number;
}

export const CAMPFIRE_LEVELS: CampfireLevel[] = [
  { maxHp: 100, baseLightRadius: 150, upgradeCost:  0, auraRadius:  58, auraDamage: 0.1 },
  { maxHp: 160, baseLightRadius: 185, upgradeCost: 40, auraRadius:  82, auraDamage: 0.2 },
  { maxHp: 240, baseLightRadius: 220, upgradeCost: 75, auraRadius: 108, auraDamage: 0.3 },
];

export const MAX_CAMPFIRE_LEVEL = CAMPFIRE_LEVELS.length;
export const CAMPFIRE_READY_DELAY = 0.9;
/** Seconds between aura damage ticks. Held constant across levels —
 *  the upgrade grows the radius and per-tick damage instead. */
export const CAMPFIRE_AURA_INTERVAL = 0.5;
/** Period of the boundary ring's visual pulse, in seconds. Intentionally
 *  decoupled from the damage tick so the ring doesn't strobe — it breathes
 *  calmly over a much longer window. A full sine cycle each period. */
export const CAMPFIRE_AURA_PULSE_PERIOD = 10;

export class Campfire {
  readonly x: number;
  readonly y: number;
  maxHp: number;
  hp: number;
  flicker = 0;
  level = 1;
  upgradeProgress = 0;
  readyTimer = 0;
  /** Elapsed since the last aura tick. Crosses `CAMPFIRE_AURA_INTERVAL`
   *  → Game sweeps in-range enemies and does damage. */
  auraTimer = 0;
  /** Independent phase driving the boundary ring's visual pulse. Wraps at
   *  `CAMPFIRE_AURA_PULSE_PERIOD`, so Render can convert to a 0→1 sine
   *  value without ever "snapping." Decoupled from `auraTimer` on
   *  purpose — the ring should breathe slowly, not strobe. */
  auraPulsePhase = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.maxHp = CAMPFIRE_LEVELS[0].maxHp;
    this.hp = this.maxHp;
  }

  update(dt: number) {
    this.flicker = (this.flicker + dt * 2.8) % (Math.PI * 2);
    this.auraTimer += dt;
    this.auraPulsePhase = (this.auraPulsePhase + dt) % CAMPFIRE_AURA_PULSE_PERIOD;
  }

  get lightRadius(): number {
    const base = CAMPFIRE_LEVELS[this.level - 1].baseLightRadius;
    return base + Math.sin(this.flicker) * 6;
  }

  get auraRadius(): number {
    return CAMPFIRE_LEVELS[this.level - 1].auraRadius;
  }

  get auraDamage(): number {
    return CAMPFIRE_LEVELS[this.level - 1].auraDamage;
  }

  /** If the tick interval has elapsed, consume it and return true so the
   *  caller applies damage. The boundary ring snaps back to transparent
   *  the frame this returns true (since `auraTimer` resets near zero). */
  tryFireAura(): boolean {
    if (this.auraTimer < CAMPFIRE_AURA_INTERVAL) return false;
    this.auraTimer -= CAMPFIRE_AURA_INTERVAL;
    return true;
  }

  nextUpgradeCost(): number | null {
    if (this.level >= MAX_CAMPFIRE_LEVEL) return null;
    return CAMPFIRE_LEVELS[this.level].upgradeCost;
  }

  /** Returns null if the next campfire level is ready to pay for; else a
   *  reason string. Each upgrade has TWO gates: an in-base building
   *  prereq (Barracks for L2, Stables + Blacksmith for L3) AND a relic
   *  found out in the wilds (relicsFound.l2 / .l3). Both must be
   *  satisfied. The wilds-side reason is surfaced first when both fail
   *  — the player should know exploration is part of the gate.
   *
   *  The internal kind codes ('garrison', 'barracks') were left
   *  untouched during the rename pass, so the station-kind checks
   *  here look "wrong" against the user-facing strings. The display
   *  flip:
   *    'garrison' (kind) → "Barracks" (display, wall guards)
   *    'barracks' (kind) → "Stables" (display, mounted patrols)
   */
  upgradeBlockReason(
    stations: Array<{ kind: string; active: boolean }>,
    relicsFound: { l2: boolean; l3: boolean } = { l2: false, l3: false },
  ): string | null {
    if (this.level >= MAX_CAMPFIRE_LEVEL) return null;
    const nextLevel = this.level + 1;
    if (nextLevel === 2) {
      if (!relicsFound.l2) return 'Find the Stone Heart in the wilds';
      const ok = stations.some((s) => s.kind === 'garrison' && s.active);
      return ok ? null : 'Build a Barracks first';
    }
    if (nextLevel === 3) {
      if (!relicsFound.l3) return 'Find the Hollow Kindling in the wilds';
      const stables = stations.some((s) => s.kind === 'barracks' && s.active);
      const blacksmith = stations.some((s) => s.kind === 'blacksmith' && s.active);
      if (!stables) return 'Build the Stables first';
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
