export type ItemKind = 'gear' | 'wire' | 'battery' | 'spring';

export const ALL_ITEMS: ItemKind[] = ['gear', 'wire', 'battery', 'spring'];

export const ITEM_LABEL: Record<ItemKind, string> = {
  gear: 'Gear',
  wire: 'Wire',
  battery: 'Battery',
  spring: 'Spring',
};

export const ITEM_COLOR: Record<ItemKind, string> = {
  gear: '#c9a14a',
  wire: '#7ec0ee',
  battery: '#b25b5b',
  spring: '#9aa3ad',
};

export type PartKey = 'head' | 'chest' | 'arm' | 'leg';

export const ALL_PARTS: PartKey[] = ['head', 'chest', 'arm', 'leg'];

export const PART_LABEL: Record<PartKey, string> = {
  head: 'Head',
  chest: 'Chest',
  arm: 'Arm',
  leg: 'Leg',
};

export const PART_REQUIRES: Record<PartKey, ItemKind> = {
  head: 'battery',
  chest: 'gear',
  arm: 'wire',
  leg: 'spring',
};

export type Inventory = Record<ItemKind, number>;

export function emptyInventory(): Inventory {
  return { gear: 0, wire: 0, battery: 0, spring: 0 };
}

export function totalItems(inv: Inventory): number {
  return inv.gear + inv.wire + inv.battery + inv.spring;
}

export type SaveState = {
  banked: Inventory;
  parts: Record<PartKey, boolean>;
  deepestReached: number;
};

export function freshSave(): SaveState {
  return {
    banked: emptyInventory(),
    parts: { head: false, chest: false, arm: false, leg: false },
    deepestReached: 0,
  };
}
