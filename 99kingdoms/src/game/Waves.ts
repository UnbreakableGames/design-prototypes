import { EnemyKind } from '../entities/Enemy';

export interface WaveEntry {
  time: number;
  kind: EnemyKind;
}

export function scheduleFor(night: number): WaveEntry[] {
  const entries: WaveEntry[] = [];
  const window = 32;

  // Target curve: ~15 / 25 / 40 / 55 / 70 / 85+ enemies per night.
  const runners = Math.min(64, 9 + night * 8);
  for (let i = 0; i < runners; i++) {
    entries.push({ time: (i / runners) * window + 1, kind: 'runner' });
  }

  if (night >= 2) {
    const brutes = Math.min(20, Math.floor((night - 1) / 2) * 4);
    for (let i = 0; i < brutes; i++) {
      entries.push({ time: 4 + i * 2.0, kind: 'brute' });
    }
  }

  if (night >= 4) {
    const flyers = Math.min(24, (night - 2) * 3);
    for (let i = 0; i < flyers; i++) {
      entries.push({ time: 8 + i * 1.4, kind: 'flyer' });
    }
  }

  if (night >= 10) {
    for (let i = 0; i < 9; i++) {
      entries.push({ time: 2 + i * 3, kind: 'brute' });
    }
  }

  // Bosses start appearing late in the run — one per night from 7 onward,
  // two on the final night as the climax.
  if (night >= 7) {
    entries.push({ time: 20, kind: 'boss' });
  }
  if (night >= 10) {
    entries.push({ time: 8, kind: 'boss' });
  }

  entries.sort((a, b) => a.time - b.time);
  return entries;
}
