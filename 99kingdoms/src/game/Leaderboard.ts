// Supabase-backed leaderboard. The rest of the game talks to this module via
// its two verbs (`post`, `top`) and never touches fetch or headers directly.
// Swapping the Supabase impl for a Roblox DataStoreService impl at port time
// is a drop-in.

import type { ModifierId } from './Modifiers';

export interface ScoreRow {
  id: number;
  seed: string;
  score: number;
  nights: number;
  rescued: number;
  coins_spent: number;
  modifiers: ModifierId[];
  endless_nights: number;
  name: string;
  created_at: string;
}

export interface PostScoreInput {
  seed: string;
  score: number;
  nights: number;
  rescued: number;
  coinsSpent: number;
  modifiers: ModifierId[];
  endlessNights: number;
  name: string;
}

export interface TopQuery {
  /** 'seed' → daily board filtered to `seed`; 'all' → cross-seed best. */
  scope: 'seed' | 'all';
  seed?: string;
  limit?: number;
  /** If true, return only entries with zero modifiers — "clean runs". */
  modifierFreeOnly?: boolean;
}

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when the game has Supabase credentials baked in. The leaderboard
 * is optional — if creds are missing (e.g. a fork without an .env), the
 * rest of the game still works; `post` and `top` just no-op.
 */
export function leaderboardEnabled(): boolean {
  return typeof URL === 'string' && URL.length > 0 && typeof KEY === 'string' && KEY.length > 0;
}

function authHeaders(): Record<string, string> {
  return {
    apikey: KEY as string,
    Authorization: `Bearer ${KEY}`,
  };
}

/**
 * Post a finished run. Returns the inserted row's id (so the caller can mark
 * it as "yours" for highlighting) or null on failure / when disabled.
 */
export async function postScore(input: PostScoreInput): Promise<number | null> {
  if (!leaderboardEnabled()) return null;
  try {
    const res = await fetch(`${URL}/rest/v1/scores?select=id`, {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        seed: input.seed,
        score: input.score,
        nights: input.nights,
        rescued: input.rescued,
        coins_spent: input.coinsSpent,
        modifiers: input.modifiers,
        endless_nights: input.endlessNights,
        name: input.name,
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { id: number }[];
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Fetch the top N rows for a given scope. Returns `[]` on failure so the UI
 * can always render without special-casing; a spinner/empty-state higher up
 * is the right UX for "board unreachable".
 */
export async function topScores(query: TopQuery): Promise<ScoreRow[]> {
  if (!leaderboardEnabled()) return [];
  const limit = query.limit ?? 20;
  const params = new URLSearchParams();
  params.set('select', '*');
  params.set('order', 'score.desc');
  params.set('limit', String(limit));
  if (query.scope === 'seed' && query.seed) {
    params.set('seed', `eq.${query.seed}`);
  }
  if (query.modifierFreeOnly) {
    // PostgREST: `modifiers=eq.{}` matches the empty-array literal.
    params.set('modifiers', 'eq.{}');
  }
  try {
    const res = await fetch(`${URL}/rest/v1/scores?${params.toString()}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return [];
    return (await res.json()) as ScoreRow[];
  } catch {
    return [];
  }
}
