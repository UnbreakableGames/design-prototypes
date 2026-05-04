// Portals come in two flavours now:
//   * 'wild'  — always-on, scattered across the map. Spit out small enemy
//               packs that patrol around the portal and aggro the player
//               on sight. Destroying one stops new packs until night-start,
//               at which point a fresh wild portal opens elsewhere.
//   * 'siege' — only alive at night. At dusk a "warlight" marker pulses
//               at a random map edge; at night-start it blooms into a
//               real siege portal that runs the wave schedule. Despawns
//               at dawn.
// Both kinds share the same shape, HP, and rendering hooks — they only
// differ in lifecycle and AI.

export type PortalKind = 'wild' | 'siege';

export interface Portal {
  id: number;
  kind: PortalKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
  swirl: number;
  discovered: boolean;
  defendCooldown: number;
  /** Only used by wild portals. Counts down to the next pack spawn.
   *  Resets after each pack until the per-portal cap is hit. */
  packCooldown: number;
  /** Only used by siege portals. The wave-spawn round-robin index uses
   *  this to track how many enemies it's emitted this night. */
  spawnedThisNight: number;
}

/** Warlight markers are not Portals — they're transient telegraphs that
 *  pulse during dusk to show where a siege portal is about to open. They
 *  carry just enough state to position + animate. */
export interface Warlight {
  id: number;
  x: number;
  y: number;
  age: number;
}

export const PORTAL_MAX_HP = 30;
export const PORTAL_RADIUS = 18;
export const PORTAL_DEFEND_COOLDOWN = 2.4;
/** Seconds between pack spawns for an idle wild portal. */
export const WILD_PORTAL_PACK_INTERVAL = 45;
/** A wild portal stops spawning once this many wild enemies are alive
 *  near it, so packs don't infinitely accumulate when the player is
 *  away. */
export const WILD_PORTAL_PACK_CAP = 6;

let nextId = 1;
let nextWarlightId = 1;

export function createPortal(kind: PortalKind, x: number, y: number): Portal {
  return {
    id: nextId++,
    kind,
    x,
    y,
    hp: PORTAL_MAX_HP,
    maxHp: PORTAL_MAX_HP,
    hitFlash: 0,
    swirl: Math.random() * Math.PI * 2,
    discovered: kind === 'siege', // siege portals telegraph in dusk so they're "discovered" on spawn
    defendCooldown: 0,
    packCooldown: kind === 'wild' ? 12 + Math.random() * 8 : 0,
    spawnedThisNight: 0,
  };
}

export function createWarlight(x: number, y: number): Warlight {
  return { id: nextWarlightId++, x, y, age: 0 };
}
