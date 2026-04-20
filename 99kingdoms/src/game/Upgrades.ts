import type { Game } from './Game';

export interface UpgradeOffer {
  id: string;
  name: string;
  description: string;
  cost: number;
  apply: (g: Game) => void;
}

type OfferFactory = (night: number) => UpgradeOffer;

const POOL: ReadonlyArray<OfferFactory> = [
  (n) => ({
    id: 'brighter_flame',
    name: 'Brighter Flame',
    description: '+25% campfire light radius',
    cost: 3 + Math.floor(n / 2),
    apply: (g) => {
      g.upgrades.campfireLight += 0.25;
    },
  }),
  (n) => ({
    id: 'reinforced_logs',
    name: 'Reinforced Logs',
    description: '+40 max HP, heal to full',
    cost: 4 + Math.floor(n / 2),
    apply: (g) => {
      g.campfire.maxHp += 40;
      g.campfire.hp = g.campfire.maxHp;
    },
  }),
  (n) => ({
    id: 'sharpened_blade',
    name: 'Sharpened Blade',
    description: '+1 hero swing damage',
    cost: 5 + Math.floor(n / 2),
    apply: (g) => {
      g.upgrades.heroDamage += 1;
    },
  }),
  (n) => ({
    id: 'longer_reach',
    name: 'Longer Reach',
    description: '+8 hero swing range',
    cost: 3 + Math.floor(n / 2),
    apply: (g) => {
      g.upgrades.heroRange += 8;
    },
  }),
  (n) => ({
    id: 'steady_hands',
    name: 'Steady Hands',
    description: '+25% watchtower fire rate',
    cost: 4 + Math.floor(n / 2),
    apply: (g) => {
      g.upgrades.towerRate += 0.25;
    },
  }),
];

export function rollOffers(count: number, night: number): UpgradeOffer[] {
  const indices = [...POOL.keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, count).map((i) => POOL[i](night));
}
