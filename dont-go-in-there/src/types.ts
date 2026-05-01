// Generic mechanical items (used by multiple parts), unique "body" items
// (each used by exactly one part — they gate the final repair of that part),
// and special quest items (super_glue: a one-time pickup that unlocks the
// crafting table).
export type ItemKind =
  | 'gear'
  | 'wire'
  | 'battery'
  | 'spring'
  | 'voice_box'
  | 'eyes'
  | 'heart'
  | 'claw'
  | 'foot'
  | 'super_glue';

export const ALL_ITEMS: ItemKind[] = [
  'gear',
  'wire',
  'battery',
  'spring',
  'voice_box',
  'eyes',
  'heart',
  'claw',
  'foot',
  'super_glue',
];

export const GENERIC_ITEMS: ItemKind[] = ['gear', 'wire', 'battery', 'spring'];
export const UNIQUE_ITEMS: ItemKind[] = ['voice_box', 'eyes', 'heart', 'claw', 'foot'];

export const ITEM_LABEL: Record<ItemKind, string> = {
  gear: 'Gear',
  wire: 'Wire',
  battery: 'Battery',
  spring: 'Spring',
  voice_box: 'Voice Box',
  eyes: 'Eyes',
  heart: 'Heart',
  claw: 'Claw',
  foot: 'Foot',
  super_glue: 'Super Glue',
};

export const ITEM_COLOR: Record<ItemKind, string> = {
  gear: '#c9a14a',
  wire: '#7ec0ee',
  battery: '#b25b5b',
  spring: '#9aa3ad',
  voice_box: '#d4a847',
  eyes: '#ffd76a',
  heart: '#8b1a1a',
  claw: '#d8d0bc',
  foot: '#5a8a52',
  super_glue: '#9aff5a',
};

export type PartKey = 'head' | 'chest' | 'arm' | 'leg';

export const ALL_PARTS: PartKey[] = ['head', 'chest', 'arm', 'leg'];

export const PART_LABEL: Record<PartKey, string> = {
  head: 'Head',
  chest: 'Chest',
  arm: 'Arm',
  leg: 'Leg',
};

// Each part requires several generic items (kinds overlap across parts) plus
// one UNIQUE item that only that part needs. The unique item gates final
// repair: even with stacks of generic items, you need to find the right
// "body part" deep in the basement. Generics: 6 gear, 5 wire, 4 battery,
// 4 spring (19 total). Plus 4 uniques. → 23 items to fully repair.
export type PartRequirements = Partial<Record<ItemKind, number>>;

export const PART_REQS: Record<PartKey, PartRequirements> = {
  head: { gear: 2, battery: 1, wire: 1, voice_box: 1, eyes: 1 },
  chest: { gear: 3, battery: 2, spring: 1, heart: 1 },
  arm: { gear: 1, wire: 3, spring: 1, claw: 1 },
  leg: { wire: 1, spring: 2, battery: 1, foot: 1 },
};

// "Primary" material for each part — used for the visual color when repaired
// (eyes glow, body fills in with the unique-item color).
export const PART_PRIMARY: Record<PartKey, ItemKind> = {
  head: 'eyes',
  chest: 'heart',
  arm: 'claw',
  leg: 'foot',
};

// Minimum basement depth where each unique body item can spawn. Eyes are
// tutorial-only (depth 1, hard-coded in the tutorial generator). Each later
// quest pushes the player one floor deeper to find their primary, so the
// run-by-run feeling is "i need to go a step further this time."
export const UNIQUE_MIN_DEPTH: Partial<Record<ItemKind, number>> = {
  heart: 2,
  claw: 3,
  foot: 4,
};

// Short summary of the passive benefit unlocked when a part is fully repaired,
// shown under each part header in the RepairPanel.
export const PART_BENEFIT: Record<PartKey, string> = {
  head: 'wider basement light',
  chest: 'slower panic in the basement',
  arm: '+2 carry slots',
  leg: 'faster climb out',
};

// Craftable tools. Built at the workbench from banked items, equipped
// passively during basement runs, and LOST when the player dies.
export type ToolKind = 'flashlight' | 'talisman' | 'lockpick' | 'backpack';

export const ALL_TOOLS: ToolKind[] = ['backpack', 'flashlight', 'talisman', 'lockpick'];

export const TOOL_LABEL: Record<ToolKind, string> = {
  flashlight: 'Flashlight',
  talisman: 'Talisman',
  lockpick: 'Lockpick',
  backpack: 'Backpack',
};

export const TOOL_BENEFIT: Record<ToolKind, string> = {
  flashlight: 'much wider basement light',
  talisman: 'panic builds slower',
  lockpick: 'cracks one safe instantly (consumed)',
  backpack: '+1 carry slot',
};

export type ToolRecipe = Partial<Record<ItemKind, number>>;

// Recipes only consume GENERIC items (gear/wire/battery/spring). Unique items
// (voice_box/heart/claw/foot) are reserved for repairing the friend and must
// never appear in a crafting recipe.
export const TOOL_RECIPE: Record<ToolKind, ToolRecipe> = {
  flashlight: { battery: 1, wire: 2 },
  talisman: { spring: 2, battery: 1 },
  lockpick: { wire: 2, gear: 1 },
  backpack: { wire: 1, spring: 2 },
};

export const TOOL_COLOR: Record<ToolKind, string> = {
  flashlight: '#d4a847',
  talisman: '#8b1a1a',
  lockpick: '#9aa3ad',
  backpack: '#8b5a3c',
};

export type Equipped = Record<ToolKind, number>;

export function emptyEquipped(): Equipped {
  return { flashlight: 0, talisman: 0, lockpick: 0, backpack: 0 };
}

export type PartProgress = Partial<Record<ItemKind, number>>;

export function emptyPartProgress(): Record<PartKey, PartProgress> {
  return { head: {}, chest: {}, arm: {}, leg: {} };
}

export function isPartRepaired(progress: PartProgress | undefined, reqs: PartRequirements): boolean {
  if (!progress) return false;
  for (const k of ALL_ITEMS) {
    const need = reqs[k] ?? 0;
    if (need === 0) continue;
    if ((progress[k] ?? 0) < need) return false;
  }
  return true;
}

// Player-facing journal entries, derived from current save state. Entries
// are ordered by priority (most-pressing first), and each carries an
// active/done status so the panel can group them visually. The tutorial
// entry is always shown while the FTUE runs; everything else only appears
// once the player has discovered it (see Game.discoverQuest).
export interface JournalChecklistItem {
  text: string;
  done: boolean;
}

export interface JournalEntry {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'done';
  checklist?: JournalChecklistItem[];
}

export function getJournalEntries(save: SaveState): JournalEntry[] {
  const entries: JournalEntry[] = [];

  // FTUE — a single guided "what to do next" entry while the tutorial runs.
  // Always shown (not gated on discovery).
  if (save.tutorialStep !== 'done') {
    entries.push({
      id: 'tutorial',
      title: 'GETTING STARTED',
      description: QUEST_TEXT[save.tutorialStep].toLowerCase(),
      status: 'active',
    });
    return entries;
  }

  const has = (id: string): boolean => save.discoveredQuests.includes(id);

  // Super glue — discovered when the player tries to use the locked workshop.
  if (has('super_glue')) {
    entries.push({
      id: 'super_glue',
      title: 'FIND SUPER GLUE',
      description: 'the workshop table is broken. find a tube of glue somewhere in the basement.',
      status: save.craftingUnlocked ? 'done' : 'active',
    });
  }

  // Body part quests — discovered explicitly via dialog / part completion.
  for (const part of ALL_PARTS) {
    const id = `repair_${part}`;
    if (!has(id)) continue;
    const reqs = PART_REQS[part];
    const progress = save.partProgress[part];
    const repaired = isPartRepaired(progress, reqs);
    const checklist: JournalChecklistItem[] = [];
    for (const k of ALL_ITEMS) {
      const need = reqs[k] ?? 0;
      if (need === 0) continue;
      if (k === 'voice_box') continue;
      const have = progress[k] ?? 0;
      const minDepth = UNIQUE_MIN_DEPTH[k];
      const depthHint = minDepth ? ` · depth ${minDepth}+` : '';
      checklist.push({
        text: `${ITEM_LABEL[k].toLowerCase()} (${Math.min(have, need)}/${need})${depthHint}`,
        done: have >= need,
      });
    }
    entries.push({
      id,
      title: `REPAIR THE ${PART_LABEL[part].toUpperCase()}`,
      description: repaired
        ? `complete — ${PART_BENEFIT[part]}.`
        : `bring "friend" the parts to fix the ${PART_LABEL[part].toLowerCase()}.`,
      status: repaired ? 'done' : 'active',
      checklist,
    });
  }

  return entries;
}

// The unique "body" item the player is currently questing for, if any.
// Walks parts head→leg; the first part whose primary is still missing gates
// the active quest. If a part's primary is already installed but generics
// remain, no unique is active (the player is collecting generics for that
// part, not searching for body parts). This is what gates basement spawns of
// heart/claw/foot — they only appear during their respective part quests.
export function activeQuestUnique(
  partProgress: Record<PartKey, PartProgress>,
): ItemKind | null {
  for (const part of ALL_PARTS) {
    const reqs = PART_REQS[part];
    if (isPartRepaired(partProgress[part], reqs)) continue;
    const primary = PART_PRIMARY[part];
    if ((partProgress[part][primary] ?? 0) < (reqs[primary] ?? 0)) return primary;
    return null;
  }
  return null;
}

export type Inventory = Record<ItemKind, number>;

export function emptyInventory(): Inventory {
  return {
    gear: 0,
    wire: 0,
    battery: 0,
    spring: 0,
    voice_box: 0,
    eyes: 0,
    heart: 0,
    claw: 0,
    foot: 0,
    super_glue: 0,
  };
}

export function totalItems(inv: Inventory): number {
  let sum = 0;
  for (const k of ALL_ITEMS) sum += inv[k];
  return sum;
}

// One per-run "tonight..." flavor that tweaks panic / light / stalker.
// Picked randomly when the player enters the basement.
export type ModifierKey = 'quiet' | 'watching' | 'cold' | 'dark' | 'hungry' | 'restless';

export interface RaidModifier {
  key: ModifierKey;
  name: string;
  flavor: string;
  panicRateMult: number;
  lightRadiusBonus: number;
  stalkerSpeedMult: number;
  visionRangeMult: number;
}

export const RAID_MODIFIERS: RaidModifier[] = [
  {
    key: 'quiet',
    name: 'TONIGHT IT IS QUIET',
    flavor: 'they move slower',
    panicRateMult: 1,
    lightRadiusBonus: 0,
    stalkerSpeedMult: 0.7,
    visionRangeMult: 1,
  },
  {
    key: 'watching',
    name: 'TONIGHT IT WATCHES',
    flavor: 'they see further',
    panicRateMult: 1,
    lightRadiusBonus: 0,
    stalkerSpeedMult: 1,
    visionRangeMult: 1.6,
  },
  {
    key: 'cold',
    name: 'TONIGHT IT IS COLD',
    flavor: 'panic builds slower',
    panicRateMult: 0.7,
    lightRadiusBonus: 0,
    stalkerSpeedMult: 1,
    visionRangeMult: 1,
  },
  {
    key: 'dark',
    name: 'TONIGHT IT IS DARK',
    flavor: 'your light is small',
    panicRateMult: 1,
    lightRadiusBonus: -50,
    stalkerSpeedMult: 1,
    visionRangeMult: 1,
  },
  {
    key: 'hungry',
    name: 'TONIGHT IT IS HUNGRY',
    flavor: 'fear creeps in faster',
    panicRateMult: 1.4,
    lightRadiusBonus: 0,
    stalkerSpeedMult: 1,
    visionRangeMult: 1,
  },
  {
    key: 'restless',
    name: 'TONIGHT IT IS RESTLESS',
    flavor: 'they patrol faster',
    panicRateMult: 1,
    lightRadiusBonus: 0,
    stalkerSpeedMult: 1.3,
    visionRangeMult: 1,
  },
];

// First-time-user tutorial state machine. Each step gates a specific player
// action; advancing happens via game-side hooks (talked to friend, looted
// eyes, extracted, installed eyes, collected reward). 'done' = fully unlocked.
export type TutorialStep =
  | 'talk_to_friend'
  | 'enter_basement'
  | 'find_eyes'
  | 'return_to_room'
  | 'install_eyes'
  | 'collect_reward'
  | 'continue_briefing'
  | 'done';

export const QUEST_TEXT: Record<TutorialStep, string> = {
  talk_to_friend: 'TALK TO YOUR "FRIEND"',
  enter_basement: 'GO TO THE BASEMENT',
  find_eyes: 'FIND THE EYES IN A CONTAINER',
  return_to_room: 'CLIMB BACK TO YOUR ROOM',
  install_eyes: 'INSTALL THE EYES ON THE "FRIEND"',
  collect_reward: 'TALK TO YOUR "FRIEND" AGAIN',
  continue_briefing: 'ASK THE "FRIEND" WHAT\'S NEXT',
  done: '',
};

export type SaveState = {
  banked: Inventory;
  partProgress: Record<PartKey, PartProgress>;
  deepestReached: number;
  // Dialog state
  metFriend: boolean;       // has the player completed the first conversation
  pendingReturn: boolean;   // has the player extracted but the friend hasn't acknowledged
  // Crafted tools — workshop totals (always safe in the bedroom).
  equipped: Equipped;
  // Loadout = subset of `equipped` taken into the next/current raid. Tools
  // are only effective if loaded; on death they're deducted from `equipped`.
  loadout: Equipped;
  // Guided first-time-user tutorial.
  tutorialStep: TutorialStep;
  // Crafting table unlocked once the player banks Super Glue.
  craftingUnlocked: boolean;
  // Journal quest IDs the player has uncovered. The tutorial entry is always
  // shown (no discovery needed); every other quest must be added here before
  // it appears, so quests have a clear "you got it" moment with a notification.
  discoveredQuests: string[];
  // First-death commentary. `pending` is true after the player has died but
  // hasn't yet heard the friend's reaction; flips false the moment the
  // dialog plays. `seen` is the persistent gate that prevents it from ever
  // triggering twice — once the friend has commented once, never again.
  firstDeathPending: boolean;
  firstDeathSeen: boolean;
};

export function freshSave(): SaveState {
  // Voice box is pre-installed on the friend ("it already has a voice box").
  // Tutorial walks the player through finding the EYES.
  const partProgress = emptyPartProgress();
  partProgress.head.voice_box = 1;
  return {
    banked: emptyInventory(),
    partProgress,
    deepestReached: 0,
    metFriend: false,
    pendingReturn: false,
    equipped: emptyEquipped(),
    loadout: emptyEquipped(),
    tutorialStep: 'talk_to_friend',
    craftingUnlocked: false,
    discoveredQuests: [],
    firstDeathPending: false,
    firstDeathSeen: false,
  };
}
