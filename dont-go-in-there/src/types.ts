// Generic mechanical items (used by multiple parts) and unique "body" items
// (each used by exactly one part — they gate the final repair of that part).
export type ItemKind =
  | 'gear'
  | 'wire'
  | 'battery'
  | 'spring'
  | 'voice_box'
  | 'heart'
  | 'claw'
  | 'foot';

export const ALL_ITEMS: ItemKind[] = [
  'gear',
  'wire',
  'battery',
  'spring',
  'voice_box',
  'heart',
  'claw',
  'foot',
];

export const GENERIC_ITEMS: ItemKind[] = ['gear', 'wire', 'battery', 'spring'];
export const UNIQUE_ITEMS: ItemKind[] = ['voice_box', 'heart', 'claw', 'foot'];

export const ITEM_LABEL: Record<ItemKind, string> = {
  gear: 'Gear',
  wire: 'Wire',
  battery: 'Battery',
  spring: 'Spring',
  voice_box: 'Voice Box',
  heart: 'Heart',
  claw: 'Claw',
  foot: 'Foot',
};

export const ITEM_COLOR: Record<ItemKind, string> = {
  gear: '#c9a14a',
  wire: '#7ec0ee',
  battery: '#b25b5b',
  spring: '#9aa3ad',
  voice_box: '#d4a847',
  heart: '#8b1a1a',
  claw: '#d8d0bc',
  foot: '#5a8a52',
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
  head: { gear: 2, battery: 1, wire: 1, voice_box: 1 },
  chest: { gear: 3, battery: 2, spring: 1, heart: 1 },
  arm: { gear: 1, wire: 3, spring: 1, claw: 1 },
  leg: { wire: 1, spring: 2, battery: 1, foot: 1 },
};

// "Primary" material for each part — used for the visual color when repaired
// (eyes glow, body fills in with the unique-item color).
export const PART_PRIMARY: Record<PartKey, ItemKind> = {
  head: 'voice_box',
  chest: 'heart',
  arm: 'claw',
  leg: 'foot',
};

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

export type Inventory = Record<ItemKind, number>;

export function emptyInventory(): Inventory {
  return {
    gear: 0,
    wire: 0,
    battery: 0,
    spring: 0,
    voice_box: 0,
    heart: 0,
    claw: 0,
    foot: 0,
  };
}

export function totalItems(inv: Inventory): number {
  let sum = 0;
  for (const k of ALL_ITEMS) sum += inv[k];
  return sum;
}

export type SaveState = {
  banked: Inventory;
  partProgress: Record<PartKey, PartProgress>;
  deepestReached: number;
  // Dialog state
  metFriend: boolean;       // has the player completed the first conversation
  pendingReturn: boolean;   // has the player extracted but the friend hasn't acknowledged
};

export function freshSave(): SaveState {
  return {
    banked: emptyInventory(),
    partProgress: emptyPartProgress(),
    deepestReached: 0,
    metFriend: false,
    pendingReturn: false,
  };
}
