// Narrative content for the 99kingdoms run — all keyed off the central
// mystery: the children of the village are vanishing into the portals. Diary
// entries pace the story across 10 nights; POI notes are optional flavour.
import type { POIKind } from '../entities/POI';

export interface NoteCard {
  title: string;
  body: string;
}

/**
 * One entry per night, read at dawn. Index 0 = the morning after Night 1.
 * Story arc: confusion → denial → hearing the portal → the truth → the
 * Scribe's decision to go through.
 */
export const DIARY_ENTRIES: string[] = [
  // After Night 1
  "The lantern-boy Keno wandered off at dusk. Mercy and I looked until our eyes burned. The woods only gave back silence.",
  // After Night 2
  "Reft missing this morning. His cot still warm. The gate was latched from the inside.",
  // After Night 3
  "Feli's mother keeps asking me if I've seen him. I cannot meet her eyes.",
  // After Night 4
  "Sune says he heard a child's voice from inside the purple portal. I told him it was the wind. We both knew I was lying.",
  // After Night 5
  "The whispers come earlier now. Children's names, always. Never our own.",
  // After Night 6
  "Four empty beds tonight. Mother Ira burns her last candle before the fire instead of in her window.",
  // After Night 7
  "Old Tahr dreamt of a throne made of small shoes. He woke screaming. He will not sleep again.",
  // After Night 8
  "The portal pulses in rhythm now. A slow heartbeat. Something on the other side is learning.",
  // After Night 9
  "I think they are not being taken. I think they are being called. None of ours have run to the fire. Only away from it.",
  // After Night 10 (not normally shown — run ends on N10 victory)
  "Tonight I go through. I will bring them back or I will not return at all. — E.",
];

export function diaryFor(night: number): NoteCard | null {
  // `night` is the night that just ended (e.g. 1 after the first night).
  const idx = night - 1;
  if (idx < 0 || idx >= DIARY_ENTRIES.length) return null;
  return {
    title: `The Scribe's diary · Night ${night}`,
    body: DIARY_ENTRIES[idx],
  };
}

/**
 * Optional flavour notes that appear when a POI is claimed. Keyed by POI kind
 * with pools of lines — picked pseudo-randomly per discovery so repeat POI
 * kinds don't always show the same text. All fragments should feel like
 * overheard pieces of the same mystery as the diary.
 */
const POI_NOTE_POOLS: Record<POIKind, string[]> = {
  camp: [
    "They left the dolls. Why would they leave the dolls?",
    "The hunter left a map circled with a child's crayon. We followed it to another empty cradle.",
    "Campfire still warm. A single little shoe, half-buried in the ash.",
  ],
  chest: [
    "My savings, under the floor. Use them. I do not need coin where I'm going.",
    "Found: a tooth that was not mine. And a lock of hair that was.",
    "Take what you need. Leave what you cannot carry. The portal does not care what is heavy.",
  ],
  shrine: [
    "We asked the carved faces. The carved faces do not answer anymore.",
    "The altar is scratched with small handprints. None of them face outward.",
    "The priestess taught us a prayer against the dark. I have forgotten the words.",
  ],
  graveyard: [
    "The freshest stones have no names. There was no body to bury.",
    "The earth here is too loose. As if something was dug out, not buried in.",
    "We mourn the ones we lost. We do not speak of the ones who left walking.",
  ],
  cache: [
    "If you are reading this, the trade caravan did not return. They never do.",
    "Rations for a week, packed by a hand that shook. Nothing is labelled.",
    "Hidden supplies from before the portals opened. Some of it is still good.",
  ],
  ruin: [
    "The old keep fell on the third night. We never agreed which third night.",
    "Soot marks on the walls are small and high. As if the fire was held by children.",
    "The doors were barricaded from the inside. It did not help.",
  ],
};

export function poiNoteFor(kind: POIKind, seed: number): NoteCard {
  const pool = POI_NOTE_POOLS[kind];
  const body = pool[Math.abs(seed) % pool.length];
  return {
    title: `A note found at the ${kind}`,
    body,
  };
}
