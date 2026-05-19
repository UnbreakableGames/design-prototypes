// Lazy-loaded icon cache. Each id maps to an explicit PNG filename so the
// asset names can be capitalized / branded however the artist supplies them.
// Missing files fall through to the original vector glyph in each call-site.

export type IconId =
  | 'tree' | 'autoplay' | 'rebirth' | 'essence' | 'dice' | 'luck'
  | 'gold' | 'gem' | 'essenceCurrency' | 'collection'
  // perk-tree art
  | 'spitter' | 'runner' | 'backpack' | 'star' | 'exclamation' | 'gift'
  | 'attack'
  | 'diceGold' | 'diceRainbow'
  | 'luckGold' | 'luckPurple' | 'luckRainbow'
  | 'close' | 'autoRoll' | 'settings' | 'reset' | 'craft';

const FILES: Record<IconId, string> = {
  tree:            'SkillTree.png',
  autoplay:        'AiAutoPlay.png',
  rebirth:         'Rebirth.png',
  essence:         'EssenceTree.png',
  dice:            'Dice.png',
  luck:            'Luck.png',
  gold:            'Gold.png',
  gem:             'Gem.png',
  essenceCurrency: 'RebirthEssence.png',
  collection:      'Backpack.png',
  // perk-tree art
  spitter:         'Spitter.png',
  runner:          'runner.png',
  backpack:        'Backpack.png',
  star:            'Star.png',
  exclamation:     'Exclamation.png',
  gift:            'Gift.png',
  attack:          'attack.png',
  diceGold:        'DiceGold.png',
  diceRainbow:     'DiceRainbow.png',
  luckGold:        'LuckGold.png',
  luckPurple:      'LuckPurple.png',
  luckRainbow:     'LuckRainbow.png',
  close:           'Close.png',
  autoRoll:        'Auto.png',
  settings:        'Settings.png',
  reset:           'Reset.png',
  craft:           'Craft.png',
};

const cache = new Map<IconId, HTMLImageElement | null>();

export function loadIcons(): void {
  for (const id of Object.keys(FILES) as IconId[]) {
    if (cache.has(id)) continue;
    cache.set(id, null);
    const img = new Image();
    img.onload = () => cache.set(id, img);
    img.onerror = () => cache.set(id, null);
    img.src = `icons/${FILES[id]}`;
  }
}

export function getIcon(id: IconId): HTMLImageElement | null {
  return cache.get(id) ?? null;
}
