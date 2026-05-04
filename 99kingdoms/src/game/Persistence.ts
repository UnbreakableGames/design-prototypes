// Local-only player state. Everything in this file lives in localStorage on a
// single browser; clearing site data resets the player. There is no sync, no
// account, no cloud component. The Roblox port replaces the whole layer with
// DataStoreService keyed by Player.UserId — the shape of PlayerState ports
// over unchanged.

const KEY = '99kingdoms:player.v1';

export interface LifetimeStats {
  totalKills: number;
  totalNights: number;
  totalRescued: number;
  totalRunsWon: number;
  totalRunsPlayed: number;
  totalCoinsSpent: number;
  totalCoinsCollected: number;
}

export interface PlayerState {
  handle: string;
  /** achievementId → unlock timestamp (epoch ms). */
  achievements: Record<string, number>;
  /** codex entry id → unlock timestamp (epoch ms). */
  codex: Record<string, number>;
  /** Supabase row ids this browser has submitted — used to highlight "your"
   *  rows on the leaderboard. */
  postedScoreIds: number[];
  /** True once we've shown the end-of-run name prompt (regardless of
   *  whether the player actually chose a name). Prevents us from nagging
   *  every run after the first. */
  nameAsked: boolean;
  lifetime: LifetimeStats;
}

const DEFAULT_HANDLE = 'anon';

function emptyLifetime(): LifetimeStats {
  return {
    totalKills: 0,
    totalNights: 0,
    totalRescued: 0,
    totalRunsWon: 0,
    totalRunsPlayed: 0,
    totalCoinsSpent: 0,
    totalCoinsCollected: 0,
  };
}

export function defaultPlayerState(): PlayerState {
  return {
    handle: DEFAULT_HANDLE,
    achievements: {},
    codex: {},
    postedScoreIds: [],
    nameAsked: false,
    lifetime: emptyLifetime(),
  };
}

/**
 * Best-effort load. Any corruption or absence → return defaults. Never throws;
 * the game must boot even if localStorage is disabled (e.g. private mode).
 */
export function loadPlayer(): PlayerState {
  if (typeof localStorage === 'undefined') return defaultPlayerState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultPlayerState();
    const parsed = JSON.parse(raw) as Partial<PlayerState> | null;
    if (!parsed || typeof parsed !== 'object') return defaultPlayerState();
    // Shallow-merge onto defaults so future schema additions default cleanly.
    const base = defaultPlayerState();
    return {
      handle: typeof parsed.handle === 'string' ? parsed.handle : base.handle,
      achievements: parsed.achievements && typeof parsed.achievements === 'object' ? parsed.achievements : {},
      codex: parsed.codex && typeof parsed.codex === 'object' ? parsed.codex : {},
      postedScoreIds: Array.isArray(parsed.postedScoreIds) ? parsed.postedScoreIds : [],
      nameAsked: typeof parsed.nameAsked === 'boolean' ? parsed.nameAsked : false,
      lifetime: { ...base.lifetime, ...(parsed.lifetime ?? {}) },
    };
  } catch {
    return defaultPlayerState();
  }
}

/** Write the whole state. Swallows quota/serialize errors — persistence is
 *  best-effort, not a hard dependency. */
export function savePlayer(state: PlayerState): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode / quota exceeded — silently skip. The session still works,
    // just won't survive a reload.
  }
}

/** Mark an achievement as unlocked (idempotent). Returns true if this call
 *  was the one that unlocked it. */
export function unlockAchievement(state: PlayerState, id: string): boolean {
  if (state.achievements[id]) return false;
  state.achievements[id] = Date.now();
  return true;
}

/** Same shape for codex entries. */
export function unlockCodex(state: PlayerState, id: string): boolean {
  if (state.codex[id]) return false;
  state.codex[id] = Date.now();
  return true;
}

/** Fold a run's stats into the lifetime totals. Caller passes deltas, not
 *  totals, so this is safe to call once at run end. */
export function mergeLifetime(state: PlayerState, delta: Partial<LifetimeStats>): void {
  for (const k of Object.keys(delta) as (keyof LifetimeStats)[]) {
    const v = delta[k];
    if (typeof v === 'number') state.lifetime[k] += v;
  }
}

/** Handle is trimmed + clamped to 3–12 printable chars. Empty / too short
 *  falls back to the default. */
export function setHandle(state: PlayerState, raw: string): void {
  const cleaned = raw.trim().slice(0, 12);
  state.handle = cleaned.length >= 3 ? cleaned : DEFAULT_HANDLE;
}

/** Returns true if the player has never been prompted to pick a name (or
 *  kept the default). The menu uses this to decide whether to show the
 *  first-time HandlePrompt after their first run. */
export function hasCustomHandle(state: PlayerState): boolean {
  return state.handle !== DEFAULT_HANDLE;
}
