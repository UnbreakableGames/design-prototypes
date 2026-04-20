export type Rng = () => number;

/**
 * Mulberry32 — small fast deterministic RNG. Same seed → same sequence.
 */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derives a stable integer seed from a date. UTC-based so clients in
 * different timezones share the same daily world.
 */
export function dailySeed(date: Date = new Date()): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return hashString(`${y}-${m}-${d}`);
}

export function hashString(s: string): number {
  // FNV-1a
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Resolve the game seed: URL `?seed=` override wins, else today's daily seed. */
export function resolveSeed(): { seed: number; label: string } {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const override = params.get('seed');
    if (override) {
      const parsed = /^\d+$/.test(override) ? Number(override) : hashString(override);
      return { seed: parsed, label: override };
    }
  }
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return { seed: dailySeed(d), label: `${y}-${m}-${day}` };
}
