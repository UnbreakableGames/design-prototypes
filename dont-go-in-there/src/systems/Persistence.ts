import { freshSave, type SaveState } from '../types';

const KEY = 'dgit:save:v0';

export function load(): SaveState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    const base = freshSave();
    return {
      banked: { ...base.banked, ...(parsed.banked ?? {}) },
      parts: { ...base.parts, ...(parsed.parts ?? {}) },
      deepestReached: parsed.deepestReached ?? 0,
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
