export type ConsumableId = 'flare' | 'rally' | 'burn';

export interface Consumable {
  id: ConsumableId;
  label: string;
  blurb: string;
  cost: number;
  /** Keyboard code (Input uses DOM key codes). */
  key: 'Digit1' | 'Digit2' | 'Digit3';
  keyHint: string;
  tint: string;
}

export const CONSUMABLES: Consumable[] = [
  {
    id: 'flare',
    label: 'Flare',
    blurb: 'Reveals the map and lights the night for 6s',
    cost: 10,
    key: 'Digit1',
    keyHint: '1',
    tint: '#ffe082',
  },
  {
    id: 'rally',
    label: 'Rally',
    blurb: 'Hero damage ×2 for 10s',
    cost: 8,
    key: 'Digit2',
    keyHint: '2',
    tint: '#4da6ff',
  },
  {
    id: 'burn',
    label: 'Burn',
    blurb: 'Campfire pulse: 15 damage in a 160px ring',
    cost: 12,
    key: 'Digit3',
    keyHint: '3',
    tint: '#ff5a5a',
  },
];

export const FLARE_DURATION = 6.0;
export const RALLY_DURATION = 10.0;
export const BURN_RADIUS = 160;
export const BURN_DAMAGE = 15;
export const BURN_FX_DURATION = 0.6;
export const CAMPFIRE_INTERACT_RADIUS = 70;
