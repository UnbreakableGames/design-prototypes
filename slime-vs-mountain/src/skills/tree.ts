import type { Inventory } from '../game/types';

export type PerkId =
  | 'foundation'
  // SLIME — spitter unlocks (15 slot tiers + damage/crit)
  | 'spitterSlot1' | 'spitterSlot2' | 'spitterSlot3' | 'spitterSlot4' | 'spitterSlot5'
  | 'spitterSlot6' | 'spitterSlot7' | 'spitterSlot8' | 'spitterSlot9' | 'spitterSlot10'
  | 'spitterSlot11' | 'spitterSlot12' | 'spitterSlot13' | 'spitterSlot14' | 'spitterSlot15'
  | 'spitterDmg1' | 'spitterDmg2' | 'spitterDmg3' | 'spitterDmg4'
  | 'spitterCrit1' | 'spitterCrit2' | 'spitterCrit3'
  // PLAYER (player-avatar leading nodes + runner-hire tail)
  | 'playerCarry1' | 'playerCarry2' | 'playerCarry3' | 'playerCarry4'
  | 'shootUnlock' | 'shootDmg1' | 'shootDmg2' | 'shootDmg3'
  | 'playerSpeed1' | 'playerSpeed2' | 'playerSpeed3'
  | 'shootBurn' | 'shootFrost' | 'shootLightning'
  | 'auraUnlock' | 'auraDmg1' | 'auraSpeed' | 'auraRadius'
  | 'runnerUnlock'
  | 'runnerSlot1' | 'runnerSlot2' | 'runnerSlot3' | 'runnerSlot4' | 'runnerSlot5'
  | 'runnerSlot6' | 'runnerSlot7' | 'runnerSlot8' | 'runnerSlot9' | 'runnerSlot10'
  | 'runnerSlot11' | 'runnerSlot12' | 'runnerSlot13' | 'runnerSlot14' | 'runnerSlot15'
  | 'carryCap1' | 'carryCap2' | 'carryCap3' | 'carryCap4' | 'carryCap5'
  | 'fasterDrop1' | 'fasterDrop2'
  // SPEED (12)
  | 'fasterPickup1' | 'fasterPickup2' | 'fasterPickup3' | 'fasterPickup4'
  | 'runnerSpeed1' | 'runnerSpeed2' | 'runnerSpeed3' | 'runnerSpeed4'
  | 'reclaimReduce1' | 'reclaimReduce2'
  | 'floorMax1' | 'floorMax2'
  // RICHES (12)
  | 'dropChance1' | 'dropChance2' | 'dropChance3' | 'dropChance4' | 'dropChance5'
  | 'biggerCoins1' | 'biggerCoins2' | 'biggerCoins3'
  | 'heavyDrops1' | 'heavyDrops2'
  | 'biggerGems1' | 'biggerGems2'
  // LUCK (6 flat + 4 multiplier)
  | 'luckyFoot' | 'fourLeaf' | 'horseshoe'
  | 'lucky4' | 'lucky5' | 'lucky6'
  | 'luckMul1' | 'luckMul2' | 'luckMul3' | 'luckMul4'
  // ECONOMY (12)
  | 'cheaperSpin1' | 'cheaperSpin2' | 'cheaperSpin3' | 'cheaperSpin4' | 'cheaperSpin5' | 'cheaperSpin6'
  | 'autoSpin' | 'rollMul2' | 'rollMul4' | 'rollMul8'
  | 'luxurySpin' | 'royalSpin'
  // Bonus reel chance (sub-branch off ECONOMY)
  | 'bonusChance1' | 'bonusChance2' | 'bonusChance3'
  // ROLLS consumables (repeatable, paid in rolls)
  | 'quickRoll'
  // FOOD drop UNLOCKS (permanent, paid in gold). Each enables the
  // corresponding food kind to spawn from mountain hits.
  | 'cheeseUnlock' | 'eggUnlock' | 'drumstickUnlock' | 'pizzaUnlock';

// Branches:
//   - SLIME (east): everything the slimes do — spitter + runner slot unlocks,
//     spitter damage/crit, runner carry/dropoff. Both creature types live
//     together in one path so the player buys their automation in one place.
//   - PLAYER (west): player-avatar progression — carry pockets and the
//     click-to-shoot ability.
export type Branch = 'slime' | 'player' | 'speed' | 'riches' | 'luck' | 'economy';

export const BRANCH_COLORS: Record<Branch, string> = {
  slime: '#ff8c5a',
  player: '#5af0ff',
  speed: '#a0ff5a',
  riches: '#ffd24a',
  luck: '#5af04a',
  economy: '#b070ff',
};
export const BRANCH_NAMES: Record<Branch, string> = {
  slime: 'BEE',
  player: 'PLAYER',
  speed: 'SPEED',
  riches: 'RICHES',
  luck: 'LUCK',
  economy: 'ECONOMY',
};
export const BRANCH_DIR: Record<Branch, [number, number]> = {
  slime: [+1, 0],
  player: [-1, 0],
  speed: [0, -1],
  riches: [0, +1],
  luck: [+1, -1],
  economy: [-1, +1],
};

export interface SkillNode {
  id: PerkId;
  branch: Branch | 'root';
  q: number;
  r: number;
  name: string;
  desc: string;
  costGold?: number;
  costGems?: number;
  /** Rolls cost (4th currency, minted +1 per manual spin). Used by repeatable
   *  consumable nodes — buy → trigger boost → re-buy later. */
  costRolls?: number;
  /** When true, the node is a consumable boost: clicking it re-pays the cost
   *  and re-arms the effect instead of permanently unlocking. */
  repeatable?: boolean;
  /** Explicit prerequisite perk that must be permanently unlocked (overrides
   *  the normal adjacency-only gate). Used to keep Dice consumables behind
   *  their matching Unlock perk even when a neighbour from another branch
   *  would otherwise satisfy adjacency. */
  requiresPerk?: PerkId;
}

/**
 * Tree layout: 6 radial branches × 12 nodes each = 72 perks + root = 73 nodes.
 * Each branch grows along its hex direction. Costs ramp into gem territory
 * around the 3rd node and scale exponentially deeper.
 *
 * Naming convention: tiered perks use suffixes (`spitterDmg1`, `spitterDmg2`).
 * Each tier in a category adds (not replaces) — so spitterDmg1 + spitterDmg2
 * stack to give the player both bonuses.
 */
function row(branch: Branch, items: Array<Omit<SkillNode, 'branch' | 'q' | 'r'>>): SkillNode[] {
  const [dq, dr] = BRANCH_DIR[branch];
  return items.map((item, i) => ({
    ...item,
    branch,
    q: dq * (i + 1),
    r: dr * (i + 1),
  }));
}

export const SKILL_TREE: SkillNode[] = [
  { id: 'foundation', branch: 'root', q: 0, r: 0, name: 'Foundation', desc: 'Where it all begins.' },

  // === BEE branch (East) === all slot unlocks live on the spine ===
  // The first 7 nodes are slot unlocks (alternating spitter + runner) so
  // a player walking the core gets the most-impactful purchases first. The
  // remaining slot tiers continue from there. Damage + carry perks sit on
  // OFFSHOOT rows north (damage) and south (carry) of the spine.
  ...row('slime', [
    { id: 'runnerUnlock', name: 'Hire Runner', desc: 'Runner cap 0 → 1 — your first upgrade is on us'                                                  },
    { id: 'spitterSlot1', name: '+1 Spitter',  desc: 'Spitter cap 1 → 2',                                    costGold: 15 },
    { id: 'runnerSlot1',  name: '+1 Runner',   desc: 'Runner cap 1 → 2',                                     costGold: 60 },
    { id: 'spitterSlot2', name: '+1 Spitter',  desc: 'Spitter cap → 3',                                      costGold: 150 },
    { id: 'runnerSlot2',  name: '+1 Runner',   desc: 'Runner cap → 3',                                       costGold: 350 },
    { id: 'spitterSlot3', name: '+1 Spitter',  desc: 'Spitter cap → 4',                                      costGold: 700 },
    { id: 'runnerSlot3',  name: '+1 Runner',   desc: 'Runner cap → 4',                                       costGold: 1400 },
    // — first 7 nodes end here — anything beyond is also slots, alternating.
    // Gems don't start gating purchases until late-mid game.
    { id: 'spitterSlot4', name: '+1 Spitter',  desc: 'Spitter cap → 5',                                      costGold: 2500 },
    { id: 'runnerSlot4',  name: '+1 Runner',   desc: 'Runner cap → 5',                                       costGold: 4500 },
    { id: 'spitterSlot5', name: '+1 Spitter',  desc: 'Spitter cap → 6',                                      costGold: 8000 },
    { id: 'runnerSlot5',  name: '+1 Runner',   desc: 'Runner cap → 6',                                       costGold: 14000 },
    // Gem costs begin here — players need rare gem drops to keep expanding.
    { id: 'spitterSlot6',  name: '+1 Spitter', desc: 'Spitter cap → 7',  costGold: 24000,      costGems: 200 },
    { id: 'runnerSlot6',   name: '+1 Runner',  desc: 'Runner cap → 7',   costGold: 38000,      costGems: 380 },
    // Late-game ramp: 3-5× steeper from here so end-game purchases feel like real
    // commitments. Players have lots of currency post-rebirth, the old curve
    // gave them everything in one sitting.
    { id: 'spitterSlot7',  name: '+1 Spitter', desc: 'Spitter cap → 8',  costGold: 180000,     costGems: 2200 },
    { id: 'runnerSlot7',   name: '+1 Runner',  desc: 'Runner cap → 8',   costGold: 280000,     costGems: 4000 },
    { id: 'spitterSlot8',  name: '+1 Spitter', desc: 'Spitter cap → 9',  costGold: 420000,     costGems: 8500 },
    { id: 'runnerSlot8',   name: '+1 Runner',  desc: 'Runner cap → 9',   costGold: 640000,     costGems: 16000 },
    { id: 'spitterSlot9',  name: '+1 Spitter', desc: 'Spitter cap → 10', costGold: 950000,     costGems: 30000 },
    { id: 'runnerSlot9',   name: '+1 Runner',  desc: 'Runner cap → 10',  costGold: 1400000,    costGems: 55000 },
    { id: 'spitterSlot10', name: '+1 Spitter', desc: 'Spitter cap → 11', costGold: 2100000,    costGems: 100000 },
    { id: 'runnerSlot10',  name: '+1 Runner',  desc: 'Runner cap → 11',  costGold: 3100000,    costGems: 180000 },
    { id: 'spitterSlot11', name: '+1 Spitter', desc: 'Spitter cap → 12', costGold: 4700000,    costGems: 320000 },
    { id: 'runnerSlot11',  name: '+1 Runner',  desc: 'Runner cap → 12',  costGold: 7000000,    costGems: 560000 },
    { id: 'spitterSlot12', name: '+1 Spitter', desc: 'Spitter cap → 13', costGold: 11000000,   costGems: 1000000 },
    { id: 'runnerSlot12',  name: '+1 Runner',  desc: 'Runner cap → 13',  costGold: 16500000,   costGems: 1800000 },
    { id: 'spitterSlot13', name: '+1 Spitter', desc: 'Spitter cap → 14', costGold: 26000000,   costGems: 3300000 },
    { id: 'runnerSlot13',  name: '+1 Runner',  desc: 'Runner cap → 14',  costGold: 40000000,   costGems: 6000000 },
    { id: 'spitterSlot14', name: '+1 Spitter', desc: 'Spitter cap → 15', costGold: 65000000,   costGems: 11000000 },
    { id: 'runnerSlot14',  name: '+1 Runner',  desc: 'Runner cap → 15',  costGold: 100000000,  costGems: 20000000 },
    { id: 'spitterSlot15', name: '+1 Spitter', desc: 'Spitter cap → 16', costGold: 160000000,  costGems: 36000000 },
    { id: 'runnerSlot15',  name: '+1 Runner',  desc: 'Runner cap → 16',  costGold: 260000000,  costGems: 65000000 },
  ]),

  // === BEE — damage offshoot === parallel row NORTH of the slot spine.
  // Each node at r=-1 is hex-adjacent to its corresponding spine slot, so
  // the player can branch up into spitter damage once they own the slots.
  // First three are gold-only; gems gate only the late-tier upgrades.
  { id: 'spitterDmg1',  branch: 'slime', q: 3, r: -1,
    name: '+25% Damage', desc: 'All spitters hit harder',
    costGold: 80 },
  { id: 'spitterDmg2',  branch: 'slime', q: 4, r: -1,
    name: '+50% Damage', desc: 'Stacks: +75% total damage bonus',
    costGold: 250 },
  { id: 'spitterCrit1', branch: 'slime', q: 5, r: -1,
    name: '+10% Crit', desc: 'All spitters crit on hit (×2 damage)',
    costGold: 600 },
  { id: 'spitterDmg3',  branch: 'slime', q: 6, r: -1,
    name: '+100% Damage', desc: 'Stacks: +175% total damage bonus',
    costGold: 4500, costGems: 120 },
  { id: 'spitterCrit2', branch: 'slime', q: 7, r: -1,
    name: '+15% Crit', desc: 'Stacks: 25% total crit chance',
    costGold: 14000, costGems: 600 },
  { id: 'spitterDmg4',  branch: 'slime', q: 8, r: -1,
    name: '+200% Damage', desc: 'Stacks: +375% total damage bonus',
    costGold: 42000, costGems: 2200 },
  { id: 'spitterCrit3', branch: 'slime', q: 9, r: -1,
    name: '+25% Crit', desc: 'Stacks: 50% total crit chance',
    costGold: 110000, costGems: 7500 },

  // === BEE — carry offshoot === parallel row SOUTH of the slot spine.
  // Runner carry capacity + dropoff speed buffs. Same "gems push to late
  // tiers" rule as the damage offshoot.
  { id: 'carryCap1', branch: 'slime', q: 3, r: 1,
    name: '+1 Carry', desc: 'Runners carry one more piece',
    costGold: 100 },
  { id: 'carryCap2', branch: 'slime', q: 4, r: 1,
    name: '+1 Carry', desc: 'Stacks: +2 total carry',
    costGold: 300 },
  { id: 'carryCap3', branch: 'slime', q: 5, r: 1,
    name: '+1 Carry', desc: 'Stacks: +3 total carry',
    costGold: 700 },
  { id: 'fasterDrop1', branch: 'slime', q: 6, r: 1,
    name: '-25% Drop', desc: 'Dropoff at the spitter base is faster',
    costGold: 4500, costGems: 120 },
  { id: 'carryCap4', branch: 'slime', q: 7, r: 1,
    name: '+2 Carry', desc: 'Stacks: +5 total carry',
    costGold: 14000, costGems: 600 },
  { id: 'fasterDrop2', branch: 'slime', q: 8, r: 1,
    name: '-35% Drop', desc: 'Stacks (~51% off total)',
    costGold: 42000, costGems: 2200 },
  { id: 'carryCap5', branch: 'slime', q: 9, r: 1,
    name: '+2 Carry', desc: 'Stacks: +7 total carry',
    costGold: 110000, costGems: 7500 },

  // === PLAYER (West) === player-avatar upgrades only ===
  // Bigger pockets, click-to-shoot, move speed, carry stack, shot scaling.
  // Offshoots above/below the spine cover elemental shots and the bee aura.
  ...row('player', [
    { id: 'shootUnlock',  name: 'Shoot Cliff', desc: 'Click on the mountain to fire — small ranged hit',    costGold: 15 },
    { id: 'playerCarry1', name: '+2 Pockets',  desc: 'Avatar carry cap 5 → 7',                              costGold: 80 },
    { id: 'shootDmg1',    name: '+50% Shot',   desc: 'Each player shot deals 50% more damage',              costGold: 200 },
    { id: 'playerCarry2', name: '+3 Pockets',  desc: 'Carry cap → 10 (stacks)',                             costGold: 350 },
    { id: 'playerSpeed1', name: '+25% Speed',  desc: 'Avatar walks 25% faster',                             costGold: 600 },
    { id: 'shootDmg2',    name: '+75% Shot',   desc: 'Stacks: +125% total shot damage',                     costGold: 1200 },
    { id: 'playerCarry3', name: '+5 Pockets',  desc: 'Carry cap → 15 (stacks)',                             costGold: 2400 },
    { id: 'playerSpeed2', name: '+40% Speed',  desc: 'Stacks: +65% total move speed',                       costGold: 4800, costGems: 80 },
    { id: 'shootDmg3',    name: '+150% Shot',  desc: 'Stacks: +275% total shot damage',                     costGold: 9600, costGems: 200 },
    { id: 'playerCarry4', name: '+8 Pockets',  desc: 'Carry cap → 23 (stacks)',                             costGold: 18000, costGems: 450 },
    { id: 'playerSpeed3', name: '+60% Speed',  desc: 'Stacks: +125% total move speed',                      costGold: 32000, costGems: 950 },
  ]),

  // === PLAYER — elemental shots offshoot === row r=+1 (south of player spine).
  // Each unlock adds a new damage type to the cycle (default rotates with
  // Q / clicking the chip). Matching a boss's elemental weakness triggers
  // BOSS_WEAKNESS_MUL (3×), the same bonus that bee-variant weaknesses use.
  { id: 'shootBurn',      branch: 'player', q: -3, r: +1,
    name: 'Burn Shot',    desc: 'Cycle: shots can apply Burn (DoT + 3× vs Glacial boss)',
    costGold: 500 },
  { id: 'shootFrost',     branch: 'player', q: -5, r: +1,
    name: 'Frost Shot',   desc: 'Cycle: shots can apply Frost (slows respawn + 3× vs Amber/Ember bosses)',
    costGold: 1400, costGems: 30 },
  { id: 'shootLightning', branch: 'player', q: -7, r: +1,
    name: 'Storm Shot',   desc: 'Cycle: shots chain lightning (+3× vs Shadow boss)',
    costGold: 3800, costGems: 90 },

  // === PLAYER — aura offshoot === row r=-1 (north of player spine).
  // Buffs every bee inside a radius around the avatar — encourages the
  // player to stand near their swarm instead of sprinting back and forth.
  { id: 'auraUnlock', branch: 'player', q: -3, r: -1,
    name: 'Bee Aura',    desc: 'Bees within 140px deal +15% damage',
    costGold: 600 },
  { id: 'auraDmg1',   branch: 'player', q: -5, r: -1,
    name: 'Aura: +DMG', desc: 'Stacks: +40% damage to bees in aura',
    costGold: 1800, costGems: 40 },
  { id: 'auraSpeed',  branch: 'player', q: -7, r: -1,
    name: 'Aura: Buzz', desc: 'Aura also boosts attack speed by 25%',
    costGold: 4500, costGems: 120 },
  { id: 'auraRadius', branch: 'player', q: -9, r: -1,
    name: 'Wide Aura',  desc: 'Aura radius +60% (140 → 224px)',
    costGold: 11000, costGems: 300 },

  // === SPEED (North) === pickup / move / reclaim / floor cap ===
  ...row('speed', [
    { id: 'fasterPickup1', name: '-20% Pickup',  desc: 'Quicker grabs at the floor pile',          costGold: 20 },
    { id: 'fasterPickup2', name: '-40% Pickup',  desc: 'Stacks (~40% off pickup total)',           costGold: 50 },
    { id: 'runnerSpeed1',  name: '+25% Speed',   desc: 'Runners sprint between cliff and dropoff', costGold: 120 },
    { id: 'fasterPickup3', name: '-60% Pickup',  desc: 'Stacks (~58% off pickup total)',           costGold: 120 },
    { id: 'runnerSpeed2',  name: '+50% Speed',   desc: 'Stacks: +75% total runner speed',          costGold: 200 },
    { id: 'fasterPickup4', name: '-75% Pickup',  desc: 'Stacks (~75% off pickup total)',           costGold: 320 },
    { id: 'runnerSpeed3',  name: '+75% Speed',   desc: 'Stacks: +150% total runner speed',         costGold: 500 },
    { id: 'reclaimReduce1',name: 'Slow Reclaim', desc: 'Mountain reclaim interval ×2 (50% slower)', costGold: 750 },
    { id: 'floorMax1',     name: 'Bigger Pile',  desc: '+15 floor capacity (50 → 65 pieces)',     costGold: 1050 },
    { id: 'runnerSpeed4',  name: '+100% Speed',  desc: 'Stacks: +250% total runner speed',         costGold: 5500, costGems: 220 },
    { id: 'reclaimReduce2',name: 'Halt Reclaim', desc: 'Stacks: reclaim ×4 slower total (~75% slower)', costGold: 14000, costGems: 700 },
    { id: 'floorMax2',     name: 'Mega Pile',    desc: '+30 floor capacity (stacks → 95 pieces)', costGold: 32000, costGems: 1800 },
  ]),

  // === RICHES (South) === drop rate / value / gems ===
  ...row('riches', [
    { id: 'dropChance1', name: '+8% Drops',    desc: '+8% chance for an extra drop per damage point', costGold: 25 },
    { id: 'biggerCoins1',name: 'Bigger Coins', desc: 'Each gold piece worth 2',                       costGold: 60 },
    { id: 'dropChance2', name: '+12% Drops',   desc: 'Stacks (~20% per damage point)',                costGold: 140 },
    { id: 'heavyDrops1', name: 'Heavy Drops',  desc: '50% chance loot doubles',                       costGold: 100 },
    { id: 'dropChance3', name: '+18% Drops',   desc: 'Stacks (~38% per damage point)',                costGold: 180 },
    { id: 'biggerCoins2',name: 'Coin Bonanza', desc: 'Each pollen piece worth 3',                     costGold: 320 },
    { id: 'biggerGems1', name: 'Bigger Gems',  desc: 'Each gem worth 2',                              costGold: 520 },
    { id: 'dropChance4', name: '+25% Drops',   desc: 'Stacks (~63% per damage point)',                costGold: 2400, costGems: 80 },
    { id: 'heavyDrops2', name: 'Always Heavy', desc: '100% chance loot doubles',                      costGold: 6500, costGems: 220 },
    { id: 'biggerCoins3',name: 'Mega Coins',   desc: 'Each pollen piece worth 5',                     costGold: 16000, costGems: 550 },
    { id: 'dropChance5', name: '+35% Drops',   desc: 'Stacks (~98% per damage point)',                costGold: 38000, costGems: 1200 },
    { id: 'biggerGems2', name: 'Mega Gems',    desc: 'Each gem worth 4',                              costGold: 85000, costGems: 2800 },
  ]),

  // === LUCK (NE) === rarer slimes on spin ===
  // 6 chunky nodes instead of 12 small ones — meta sources (milestones,
  // Essence Fortune) carry more of the early luck budget now, so the in-run
  // tree can ramp faster without flooding the layout.
  ...row('luck', [
    { id: 'luckyFoot', name: '+10 Luck',    desc: 'Lucky Foot — rarer rolls',          costGold: 30 },
    { id: 'fourLeaf',  name: '+50 Luck',    desc: 'Four Leaf — stacks (+60 total)',    costGold: 120 },
    { id: 'horseshoe', name: '+150 Luck',   desc: 'Horseshoe — stacks (+210 total)',   costGold: 350 },
    { id: 'lucky4',    name: '+400 Luck',   desc: 'Fortune favors you (+610 total)',   costGold: 900 },
    { id: 'lucky5',    name: '+1,000 Luck', desc: 'Stacks: +1,610 total',              costGold: 9000,  costGems: 500 },
    { id: 'lucky6',    name: '+1,650 Luck', desc: 'Apex luck — +3,260 total flat',     costGold: 40000, costGems: 3500 },
  ]),

  // === ECONOMY (SW) === auto-roll / faster rolls / special spins ===
  // Auto Roll is the first ECONOMY pickup so the moment players reach this
  // branch they can stop spam-clicking the dice.
  ...row('economy', [
    { id: 'autoSpin',     name: 'Auto Roll',    desc: 'Unlocks the Auto Roll toggle (A key)', costRolls: 3 },
    { id: 'cheaperSpin1', name: 'Faster Roll',  desc: 'Roll cooldown 8s → 7.5s',              costRolls: 15 },
    { id: 'cheaperSpin2', name: 'Faster Roll',  desc: 'Stacks: cooldown → 7.0s',              costRolls: 30 },
    { id: 'cheaperSpin3', name: 'Faster Roll',  desc: 'Stacks: cooldown → 6.5s',              costRolls: 60 },
    { id: 'cheaperSpin4', name: 'Faster Roll',  desc: 'Stacks: cooldown → 6.0s',              costRolls: 120 },
    { id: 'cheaperSpin5', name: 'Faster Roll',  desc: 'Stacks: cooldown → 5.5s',              costRolls: 200 },
    { id: 'cheaperSpin6', name: 'Faster Roll',  desc: 'Stacks: cooldown → 5.0s (perk floor)', costRolls: 1500 },
    { id: 'rollMul2',     name: '×2 Roll',      desc: 'Each roll spawns 2 bees',              costRolls: 3500 },
    { id: 'rollMul4',     name: '×4 Roll',      desc: 'Each roll spawns 4 bees',              costRolls: 9000 },
    { id: 'rollMul8',     name: '×8 Roll',      desc: 'Each roll spawns 8 bees',              costRolls: 25000 },
    { id: 'luxurySpin',   name: 'Luxury Roll',  desc: 'Floor: rolls are at least Uncommon',   costRolls: 50000 },
    { id: 'royalSpin',    name: 'Royal Roll',   desc: 'Floor: rolls are at least Rare',       costRolls: 120000 },
  ]),

  // === FOOD drop UNLOCKS ===
  // Sub-branch east of RICHES. Each unlock enables the corresponding food kind
  // to drop from mountain hits. Without these, the cliff never produces food
  // and slimes can't level up — they're a deliberate early-game milestone.
  { id: 'cheeseUnlock',    branch: 'riches', q: +1, r: +1,
    name: 'Unlock Cheese',    desc: 'Cheese drops from cliff hits (1-in-80, +25 XP)',
    costGold: 50 },
  { id: 'eggUnlock',       branch: 'riches', q: +1, r: +3,
    name: 'Unlock Egg',       desc: 'Egg drops from cliff hits (1-in-200, +50 XP)',
    costGold: 200 },
  { id: 'drumstickUnlock', branch: 'riches', q: +1, r: +5,
    name: 'Unlock Drumstick', desc: 'Drumstick drops from cliff hits (1-in-1000, +150 XP)',
    costGold: 800 },
  { id: 'pizzaUnlock',     branch: 'riches', q: +1, r: +7,
    name: 'Unlock Pizza',     desc: 'Pizza drops from cliff hits (1-in-5000, +400 XP)',
    costGold: 14000, costGems: 600 },

  // === BONUS chance (ECONOMY sub-branch) ===
  // Multiplies the trigger chance of the bonus reel popping during a roll.
  // Each node is additive: +50% / +100% / +200% above the base 5% chance.
  { id: 'bonusChance1', branch: 'economy', q: -3, r: +4,
    name: '+50% Bonus', desc: 'Bonus reel chance 5% → 7.5%',
    costRolls: 100 },
  { id: 'bonusChance2', branch: 'economy', q: -5, r: +6,
    name: '+100% Bonus', desc: 'Stacks: bonus chance 12.5% (2.5× base)',
    costRolls: 800 },
  { id: 'bonusChance3', branch: 'economy', q: -7, r: +8,
    name: '+200% Bonus', desc: 'Stacks: bonus chance 22.5% (4.5× base)',
    costRolls: 3500 },

  // === LUCK multipliers ===
  // Sub-branch one hex east of the main LUCK line. Each node multiplies the
  // effective luck after the flat-luck sum, so late-game scaling stays
  // meaningful even as flat-luck saturates.
  { id: 'luckMul1', branch: 'luck', q: 3,  r: -2,
    name: '×1.10 Luck', desc: 'Multiplies total luck by 1.10',
    costGold: 200 },
  { id: 'luckMul2', branch: 'luck', q: 5,  r: -4,
    name: '×1.25 Luck', desc: 'Multiplies total luck by 1.25 (stacks)',
    costGold: 600 },
  { id: 'luckMul3', branch: 'luck', q: 7, r: -6,
    name: '×1.50 Luck', desc: 'Multiplies total luck by 1.50 (stacks)',
    costGold: 6500, costGems: 250 },
  { id: 'luckMul4', branch: 'luck', q: 8, r: -7,
    name: '×2.00 Luck', desc: 'Multiplies total luck by 2.00 (stacks)',
    costGold: 22000, costGems: 1200 },

  // === ROLLS consumable ===
  // Quick Roll is the lone repeatable node south of Auto Roll. The mutation
  // dice cluster that used to live here was archived 2026-05-18 — see
  // docs/MUTATIONS.md for the original design.
  { id: 'quickRoll', branch: 'economy', q: -1, r: +2,
    name: 'Quick Roll', desc: 'Next 10 rolls have half cooldown',
    costRolls: 5, repeatable: true },
];

export const HEX_NEIGHBOR_DIRS: Array<[number, number]> = [
  [+1, 0], [+1, -1], [0, -1], [-1, 0], [-1, +1], [0, +1],
];

export function nodeByCoord(q: number, r: number): SkillNode | undefined {
  return SKILL_TREE.find((n) => n.q === q && n.r === r);
}

export function neighborsOf(q: number, r: number): SkillNode[] {
  const out: SkillNode[] = [];
  for (const [dq, dr] of HEX_NEIGHBOR_DIRS) {
    const n = nodeByCoord(q + dq, r + dr);
    if (n) out.push(n);
  }
  return out;
}

export function isVisible(node: SkillNode, unlocked: Set<PerkId>): boolean {
  if (unlocked.has(node.id)) return true;
  for (const n of neighborsOf(node.q, node.r)) {
    if (unlocked.has(n.id)) return true;
  }
  return false;
}

/** "Mystery" tier — one hop beyond the visible frontier. Rendered as a "?"
 *  hex so the player knows there's more to find without seeing what or how
 *  much it costs. Returns false for nodes that are already visible. */
export function isMystery(node: SkillNode, unlocked: Set<PerkId>): boolean {
  if (isVisible(node, unlocked)) return false;
  for (const n of neighborsOf(node.q, node.r)) {
    if (isVisible(n, unlocked)) return true;
  }
  return false;
}

export function isUnlockable(node: SkillNode, unlocked: Set<PerkId>, inv: Inventory): boolean {
  // Repeatable consumable nodes stay unlockable forever — re-clicking re-arms
  // the effect, so we skip the "already unlocked" gate.
  if (!node.repeatable && unlocked.has(node.id)) return false;
  // Explicit prereq (e.g. Big Dice requires Big Unlock).
  if (node.requiresPerk !== undefined && !unlocked.has(node.requiresPerk)) return false;
  let hasAdj = false;
  for (const n of neighborsOf(node.q, node.r)) {
    if (unlocked.has(n.id)) {
      hasAdj = true;
      break;
    }
  }
  if (!hasAdj) return false;
  return canAfford(node, inv);
}

export function canAfford(node: SkillNode, inv: Inventory): boolean {
  // Nodes can require any combination of currencies — all must be available.
  if (node.costGold !== undefined && inv.gold < node.costGold) return false;
  if (node.costGems !== undefined && inv.gems < node.costGems) return false;
  if (node.costRolls !== undefined && inv.rolls < node.costRolls) return false;
  return true;
}

export function payCost(node: SkillNode, inv: Inventory) {
  if (node.costGold !== undefined) inv.gold -= node.costGold;
  if (node.costGems !== undefined) inv.gems -= node.costGems;
  if (node.costRolls !== undefined) inv.rolls -= node.costRolls;
}
