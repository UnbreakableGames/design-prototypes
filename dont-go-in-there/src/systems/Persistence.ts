import {
  ALL_PARTS,
  PART_REQS,
  emptyPartProgress,
  freshSave,
  type PartKey,
  type PartProgress,
  type SaveState,
} from '../types';

const KEY = 'dgit:save:v0';

export function load(): SaveState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const base = freshSave();
    const banked = { ...base.banked, ...((parsed.banked as Record<string, number> | undefined) ?? {}) };
    const partProgress = emptyPartProgress();
    // New format: partProgress with per-kind installed counts
    const incomingProgress = parsed.partProgress as Record<PartKey, PartProgress> | undefined;
    if (incomingProgress) {
      for (const part of ALL_PARTS) {
        partProgress[part] = { ...(incomingProgress[part] ?? {}) };
      }
    } else {
      // Legacy format: { parts: Record<PartKey, boolean> } — convert each
      // boolean=true into a fully-met progress map for that part.
      const legacy = parsed.parts as Record<PartKey, boolean> | undefined;
      if (legacy) {
        for (const part of ALL_PARTS) {
          if (legacy[part]) partProgress[part] = { ...PART_REQS[part] };
        }
      }
    }
    return {
      banked,
      partProgress,
      deepestReached: (parsed.deepestReached as number | undefined) ?? 0,
      metFriend: (parsed.metFriend as boolean | undefined) ?? false,
      pendingReturn: (parsed.pendingReturn as boolean | undefined) ?? false,
    };
  } catch {
    return freshSave();
  }
}

export function save(state: SaveState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore quota errors in prototype
  }
}

export function clear(): void {
  localStorage.removeItem(KEY);
}
