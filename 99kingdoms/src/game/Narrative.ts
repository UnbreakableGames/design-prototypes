// Narrative content for the 99kingdoms run — all keyed off the central
// mystery: the children of the village are vanishing into the portals.
// Diary entries pace the story across 10 nights. POI lore now lives
// alongside its authored instance in `POIInstances.ts`.

export interface NoteCard {
  title: string;
  body: string;
  /** Visual accent. Default = 'blood' (lore / diary / narrative). Use
   *  'ember' for mechanically important cards (upgrade unlocked, gate
   *  cleared) so players don't skim past them as more lore. */
  accent?: 'blood' | 'ember';
  /** Optional bold call-to-action shown beneath the body in tone-colored
   *  small-caps, e.g. "BUILD A GARRISON · BRING 40 COINS TO THE FIRE". */
  cta?: string;
  /** Words (lowercase, exact match after stripping punctuation) that
   *  should keep a tiny sinusoidal jitter after they've landed during
   *  the typewriter-style reveal animation. Used to make a recurring
   *  command word — "stay", "light", "did" — feel insistent. Matched
   *  against title, body, AND cta. */
  shake?: string[];
  /** Optional confirm/decline prompt. When set the card replaces its
   *  "PRESS SPACE TO CONTINUE" footer with two side-by-side prompts
   *  and the Game's input router treats Space/Enter/click as the
   *  CONFIRM action and Escape as the CANCEL action — giving the
   *  player a chance to back out of an irreversible choice (e.g. a
   *  night POI's kiss/curse bargain). */
  prompt?: {
    confirmLabel: string;
    cancelLabel: string;
  };
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
  "Sune says he heard a child's voice from inside the seam. He says the light at its edge has begun to yellow, like a sick man's skin. I told him it was the dusk. We both knew I was lying.",
  // After Night 5
  "The whispers come earlier now. Children's names, always. Never our own.",
  // After Night 6
  "Four empty beds tonight. Mother Ira burns her last candle before the fire instead of in her window.",
  // After Night 7
  "Old Tahr dreamt of a throne made of small shoes. He woke screaming. He will not sleep again.",
  // After Night 8
  "The portal pulses in rhythm now. A slow heartbeat. Something on the other side is learning. I have begun to see it in my sleep — a figure standing very still, draped in tatters the colour of old paper. It does not move. It only waits.",
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


// ──────────────────────────────────────────────────────────────────────────
// Codex: persistent compendium of everything the player has discovered.
// Four categories feed it — diary pages read at dawn, figure dossiers earned
// by in-run triggers, portal field notes unlocked by endless-mode milestones
// and boss kills, and lost-children names revealed one per completed run.

export type CodexCategory = 'diary' | 'figure' | 'portal' | 'child';

export interface CodexEntry {
  id: string;
  category: CodexCategory;
  title: string;
  body: string;
  /** Short hint shown when the entry is still locked. Never leaks body text. */
  unlockHint: string;
}

/** 10 diary entries mirrored from DIARY_ENTRIES, ids `diary:1..10`. */
const DIARY_CODEX: CodexEntry[] = DIARY_ENTRIES.map((body, i) => ({
  id: `diary:${i + 1}`,
  category: 'diary',
  title: `The Scribe's diary · Night ${i + 1}`,
  body,
  unlockHint: `Read the Scribe at dawn after Night ${i + 1}.`,
}));

/** Character dossiers — unlocked by specific in-run events. */
const FIGURE_CODEX: CodexEntry[] = [
  {
    id: 'figure:mercy',
    category: 'figure',
    title: 'Mercy, the Lantern-keeper',
    body:
      "The first to go looking for Keno and the last to come back. Mercy trims every lantern in the village — even the ones outside the wall. She says a lit wick is a promise, and will not keep one she cannot pay. On the eighth night she did not come home.",
    unlockHint: 'Rescue a villager on the same day you read diary 1.',
  },
  {
    id: 'figure:feli',
    category: 'figure',
    title: 'Feli, and his mother',
    body:
      "Feli was seven. He liked to draw the walls. His mother still sets a bowl at the table, in case he returns hungry. She has not stopped cooking for him, and I do not have the heart to tell her the cold bowl is what frightens me most.",
    unlockHint: 'Claim a shrine after reading diary 3.',
  },
  {
    id: 'figure:old_tahr',
    category: 'figure',
    title: 'Old Tahr',
    body:
      "The village's oldest living soul, though none of us know exactly how old. Tahr remembers the equinox before the equinox — the one we all agreed not to speak of. He says the portals have opened before. He says we survived the last time because the king who came through was not yet awake. He says he saw the king's face once, when he was very small, and that the face was a mask, and that the mask was smiling.",
    unlockHint: 'Reach Campfire L3 and claim a graveyard.',
  },
  {
    id: 'figure:mother_ira',
    category: 'figure',
    title: 'Mother Ira',
    body:
      "Ira kept the candles in the window the way her mother kept them, and her mother's mother. When her own daughter went missing she brought the last candle to the campfire and set it beside the logs. She has not spoken since. She only tends the flame.",
    unlockHint: 'Survive a night with no wall destroyed.',
  },
  {
    id: 'figure:e',
    category: 'figure',
    title: 'E. — the Scribe',
    body:
      "I am writing this so that if I do not return, someone will read it and know there was a plan. I have prepared. I have weighed the risks. I have read what was chained at the witch's pillar, and I am no longer the same. I am afraid of what I have understood. I am more afraid of what I have not. — E.",
    unlockHint: 'Win a full ten-night run.',
  },
];

/** Field notes on the portals themselves — fragmentary theories that
 *  accumulate as the player pushes further into endless mode. */
const PORTAL_CODEX: CodexEntry[] = [
  {
    id: 'portal:1',
    category: 'portal',
    title: 'Field note: the seams',
    body:
      "The portals tear along seams in the air, not in the ground. We assumed they were doors. They are wounds.",
    unlockHint: 'Attack a portal and survive the defenders.',
  },
  {
    id: 'portal:2',
    category: 'portal',
    title: 'Field note: the pulse',
    body:
      "Measured the pulses between two full revolutions of the northern star. 73 beats. Same as a child's resting heart.",
    unlockHint: 'Destroy a portal.',
  },
  {
    id: 'portal:3',
    category: 'portal',
    title: 'Field note: the light',
    body:
      "The violet is not a colour. It is the absence of a colour we once had and forgot. Lately the seams have begun to yellow at their edges, the way old vellum yellows on its way to rot. I cannot describe this more precisely. I have tried.",
    unlockHint: 'Read diary 4 and claim a ruin in the same run.',
  },
  {
    id: 'portal:4',
    category: 'portal',
    title: 'Field note: the count',
    body:
      "For every child taken, one runner comes out. For every adult taken, one brute. We are not being attacked by strangers.",
    unlockHint: 'Reach Night 12 in endless mode.',
  },
  {
    id: 'portal:5',
    category: 'portal',
    title: 'Field note: the song',
    body:
      "A villager who stood too close reported hearing a song from inside the seam, sung slowly, in a child's voice he almost recognised. He could only remember one line of it: \"Strange is the night where black stars rise.\" He had never been taught the song. He says he had always known it.",
    unlockHint: 'Reach Night 15 in endless mode.',
  },
  {
    id: 'portal:6',
    category: 'portal',
    title: 'Field note: the king',
    body:
      "There is a presiding intelligence on the other side. It does not speak our language but it knows our names. When it sends something against the fire, it sends it by name.",
    unlockHint: 'Defeat a boss.',
  },
  {
    id: 'portal:7',
    category: 'portal',
    title: 'Field note: the bargain',
    body:
      "If we send nothing through, it sends more. If we send something small, it sends less. I do not know what this means but I am afraid we already know the price.",
    unlockHint: 'Reach Night 18 in endless mode.',
  },
  {
    id: 'portal:8',
    category: 'portal',
    title: 'Field note: the door',
    body:
      "On the far side of the seam I glimpsed a door, and beyond the door, a city. Two suns sank into a lake that did not move. The stars over the city were black, and there were too many of them. The door itself was cut into the air exactly the shape of our own, worn smooth as if a thousand small hands had pushed it open. — E.",
    unlockHint: 'Reach Night 20 in endless mode.',
  },
  {
    id: 'portal:9',
    category: 'portal',
    title: 'Field note: the sign',
    body:
      "Mercy carved a shape into the inside of her shutters before she went. None of us recognise it. None of us can stop drawing it. Mother Ira pressed it into the ash of the windowsill yesterday and could not say why. I have caught my own hand making it, in the margin of this page, while my mind was elsewhere. — E.",
    unlockHint: 'Read every diary entry in a single run.',
  },
];

/** Roll-call of missing children. One name revealed per completed run, in
 *  order. Ids are stable so unlocking them persists across updates. */
const LOST_CHILDREN: { name: string; note: string }[] = [
  { name: 'Keno',    note: 'The lantern-boy. Took his cloak and left without it.' },
  { name: 'Reft',    note: 'Left no note. His cot still warm when we found it.' },
  { name: 'Feli',    note: 'Seven years old. Loved to draw the walls.' },
  { name: 'Sune',    note: 'Heard the song first, and walked toward it.' },
  { name: 'Tirra',   note: 'Mother Ira\'s only daughter. The candles went out when she left.' },
  { name: 'Bel',     note: 'Was afraid of the dark. Carried her little light with her, we hope.' },
  { name: 'Harn',    note: 'Twin. His brother has not spoken since.' },
  { name: 'Ulo',     note: 'Left a single tooth on the pillow. We have not touched it.' },
  { name: 'Pim',     note: 'The carver\'s apprentice. Took no tools.' },
  { name: 'Yev',     note: 'The youngest. The hardest to accept.' },
];

const CHILD_CODEX: CodexEntry[] = LOST_CHILDREN.map((c, i) => ({
  id: `child:${c.name.toLowerCase()}`,
  category: 'child' as const,
  title: c.name,
  body: c.note,
  unlockHint: `Finish at least ${i + 1} run${i === 0 ? '' : 's'}.`,
}));

export const CODEX_ENTRIES: CodexEntry[] = [
  ...DIARY_CODEX,
  ...FIGURE_CODEX,
  ...PORTAL_CODEX,
  ...CHILD_CODEX,
];

const CODEX_BY_ID = new Map(CODEX_ENTRIES.map((e) => [e.id, e] as const));

export function codexEntry(id: string): CodexEntry | undefined {
  return CODEX_BY_ID.get(id);
}

export function codexEntriesByCategory(
  category: CodexCategory,
): CodexEntry[] {
  return CODEX_ENTRIES.filter((e) => e.category === category);
}

export function codexTotalByCategory(): Record<CodexCategory, number> {
  return {
    diary: DIARY_CODEX.length,
    figure: FIGURE_CODEX.length,
    portal: PORTAL_CODEX.length,
    child: CHILD_CODEX.length,
  };
}

/** Convenience ids used by the Game to trigger unlocks from event hooks. */
export const LOST_CHILD_IDS = CHILD_CODEX.map((c) => c.id);

