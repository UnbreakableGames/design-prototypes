// Placeholder monetized shop. Items use a fake "R$" (Robux) price and trigger
// effects via a Game-side handler. Nothing here actually charges money — this
// is purely simulating the feel of a Roblox in-game shop for prototype playtest.

import type { IconId } from '../ui/icons';

export type ShopItemId =
  | 'starterPack'
  | 'serverLuck'
  | 'serverCoins'
  | 'megaCoins'
  | 'gemPackSmall'
  | 'gemPackLarge'
  | 'slotExpansion'
  | 'autoRollGamepass'
  | 'luckySpins'
  | 'rebirthBoost';

export interface ShopItem {
  id: ShopItemId;
  name: string;
  desc: string;
  iconId: IconId;
  robux: number;
  /** When true, item disappears (greyed "OWNED") after first purchase. */
  oneTime: boolean;
  /** Optional category badge ("LIMITED", "GAMEPASS", "BOOST"). */
  tag?: string;
  /** Highlight color used for the price button + tag. */
  color: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'starterPack',
    name: 'Starter Pack',
    desc: '1000 pollen + 50 gems + 5 essence',
    iconId: 'gift',
    robux: 99,
    oneTime: true,
    tag: 'LIMITED',
    color: '#ffaa28',
  },
  {
    id: 'serverLuck',
    name: '+200% Luck (10 min)',
    desc: 'Server-wide luck boost',
    iconId: 'luckRainbow',
    robux: 49,
    oneTime: false,
    tag: 'BOOST',
    color: '#5af04a',
  },
  {
    id: 'serverCoins',
    name: '2× Pollen (10 min)',
    desc: 'Double pollen income',
    iconId: 'gold',
    robux: 49,
    oneTime: false,
    tag: 'BOOST',
    color: '#ffd24a',
  },
  {
    id: 'megaCoins',
    name: 'Mega Pollen',
    desc: 'Permanent +50% pollen income',
    iconId: 'diceGold',
    robux: 199,
    oneTime: true,
    tag: 'GAMEPASS',
    color: '#ffaa28',
  },
  {
    id: 'gemPackSmall',
    name: '500 Gems',
    desc: 'Instantly added',
    iconId: 'gem',
    robux: 79,
    oneTime: false,
    color: '#5af0ff',
  },
  {
    id: 'gemPackLarge',
    name: '2500 Gems',
    desc: 'Best value · most popular',
    iconId: 'gem',
    robux: 299,
    oneTime: false,
    tag: 'POPULAR',
    color: '#5af0ff',
  },
  {
    id: 'slotExpansion',
    name: 'Slot Expansion',
    desc: '+1 spitter & +1 runner slot (permanent)',
    iconId: 'spitter',
    robux: 129,
    oneTime: true,
    tag: 'GAMEPASS',
    color: '#ff8c5a',
  },
  {
    id: 'autoRollGamepass',
    name: 'Auto Roll',
    desc: 'Permanently unlock the Auto Roll button',
    iconId: 'autoplay',
    robux: 149,
    oneTime: true,
    tag: 'GAMEPASS',
    color: '#5af04a',
  },
  {
    id: 'luckySpins',
    name: 'Lucky 5 Rolls',
    desc: 'Next 5 rolls guaranteed Rare or better',
    iconId: 'diceRainbow',
    robux: 59,
    oneTime: false,
    tag: 'BOOST',
    color: '#b070ff',
  },
  {
    id: 'rebirthBoost',
    name: '3× Rebirth Essence',
    desc: 'Triples your next rebirth payout',
    iconId: 'rebirth',
    robux: 99,
    oneTime: false,
    tag: 'BOOST',
    color: '#c170ff',
  },
];
