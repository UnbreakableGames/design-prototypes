// Authored POI instances. Each is a unique, named landmark with bespoke
// lore — they are intentionally NOT generic kinds. World-gen picks one
// instance per POI slot at run start (deterministic on the daily seed).
//
// Three categories drive behavior:
//   * relic      — claiming sets a flag on Game (relicsFound.l2 / .l3) that
//                  unlocks the corresponding Campfire upgrade. No coins, no
//                  villagers — just the unlock and its lore note.
//   * settlement — spawns N idle villagers at the POI. The mid/late-game
//                  villager source once auto-wanderers taper off (N4+).
//   * lore       — drops a small coin reward + a story note. No upgrade
//                  unlock, no villagers — pure narrative + economy nudge.

import type { POICategory, POISpriteKind } from '../entities/POI';
import type { ForgeTrack } from './BlacksmithUpgrades';

export interface POIInstance {
  id: string;
  category: POICategory;
  sprite: POISpriteKind;
  label: string;
  hint: string;
  loreTitle: string;
  loreBody: string;

  // Behavior payload — only the fields relevant to the category are read.
  /** For 'relic': which campfire level this relic unlocks (2 or 3). */
  relicLevel?: 2 | 3;
  /** For 'relic': which late-game BUILDING this relic makes
   *  constructible. Mutually exclusive with `relicLevel` — a relic
   *  POI either gates a campfire upgrade OR a station unlock, not both. */
  unlocksBuilding?: 'workshop' | 'blacksmith' | 'stables';
  /** For 'settlement': how many idle villagers spawn on claim. */
  villagerCount?: number;
  /** For 'lore': how many coins drop on claim. */
  coinReward?: number;
  /** For 'upgrade': which forge track advances by one tier on claim. */
  upgradeTrack?: ForgeTrack;
  /** For 'night': which kiss/curse pair fires on claim. */
  nightKissCurseId?: string;

  /** Optional per-instance placement ring. When present, the world-gen
   *  scatter constrains this instance to a specific distance from the
   *  campfire. Used to put the L2 relic in the near wilds and the L3
   *  relic deep in the far wilds, so progression naturally pulls the
   *  player further out. */
  ringMin?: number;
  ringMax?: number;
}

// ── Relics ────────────────────────────────────────────────────────────
// Two relics, one per gated upgrade. Always present in every run.

const RELIC_L2: POIInstance = {
  id: 'relic_l2',
  category: 'relic',
  sprite: 'chest',
  label: 'The Stone Heart',
  hint: 'Hold Space to lift the ember-stone',
  loreTitle: 'A relic recovered \u00b7 The Stone Heart',
  loreBody:
    "A heavy ember-stone, still warm to the touch though the fire that warmed it last is centuries gone. They say the first campfire burned in stones like these, and that the stones remember. The campfire knows what to do with it.",
  relicLevel: 2,
  // Near ring — just past the wall perimeter. The first upgrade should
  // be a quick scouting trip, not an expedition.
  ringMin: 320,
  ringMax: 560,
};

const RELIC_L3: POIInstance = {
  id: 'relic_l3',
  category: 'relic',
  sprite: 'shrine',
  label: 'The Hollow Kindling',
  hint: 'Hold Space to gather the kindling',
  loreTitle: 'A relic recovered \u00b7 The Hollow Kindling',
  loreBody:
    "Wood from the Old Tree, hollow now \u2014 lighter than air, and warmer than wood has any right to be. They burn nine times longer than green wood and twelve times brighter. The Old Tree had only so much of itself to give.",
  relicLevel: 3,
  // Far ring — deep wilds, near the map edge. The second upgrade is
  // meant to be a real expedition with the L2 fire's bigger aura helping
  // you push out to it.
  ringMin: 880,
  ringMax: 1140,
};

// ── Building-unlock relics ────────────────────────────────────────────
// Three more relics — one per late-game building. Each is a single
// authored POI placed deterministically in a wide mid-band ring.
// Claiming one flips the matching `relicsFound.<building>` flag on
// Game and unblocks `prereqMet` for that station kind.

const RELIC_WORKSHOP: POIInstance = {
  id: 'relic_workshop',
  category: 'relic',
  sprite: 'cache',
  label: "The mason's blueprint",
  hint: 'Hold Space to lift the scroll',
  loreTitle: "A relic recovered · The mason's blueprint",
  loreBody:
    "A scroll wrapped in oilcloth, found among the bones of a master mason. The plans inside are for a workshop — a place where things broken can be made whole again. The hands that drew them are gone, but the lines are clean. The chronicle could be rebuilt from these pages alone.",
  unlocksBuilding: 'workshop',
  ringMin: 480,
  ringMax: 720,
};

const RELIC_BLACKSMITH: POIInstance = {
  id: 'relic_blacksmith',
  category: 'relic',
  sprite: 'shrine',
  label: 'The anvil that remembers',
  hint: 'Hold Space to lay your hand on the iron',
  loreTitle: 'A relic recovered · The anvil that remembers',
  loreBody:
    "Iron pulled from the heart of a fallen meteorite, beaten flat by a smith whose name no one knows. It is still warm. Set it in a forge and it will tell the next blade what to be — and the next, and the next, and the one that ends this.",
  unlocksBuilding: 'blacksmith',
  ringMin: 600,
  ringMax: 820,
};

const RELIC_STABLES: POIInstance = {
  id: 'relic_stables',
  category: 'relic',
  sprite: 'graveyard',
  label: 'The bridle of the last horse',
  hint: 'Hold Space to take the bridle',
  loreTitle: 'A relic recovered · The bridle of the last horse',
  loreBody:
    "A bridle of black leather, hanging from a low branch. The horse it once held is gone — through the seam, perhaps. The leather is still oiled, the buckles still bright. Knights without horses are not knights. Build the stables and the riders will come.",
  unlocksBuilding: 'stables',
  ringMin: 720,
  ringMax: 940,
};

// ── Settlements ──────────────────────────────────────────────────────
// Three named settlement variants. World-gen picks 3 instances total
// (at most one of each — repeats are harmless but uninteresting).

const SETTLEMENT_MEADOWFOLD: POIInstance = {
  id: 'settlement_meadowfold',
  category: 'settlement',
  sprite: 'camp',
  label: 'Meadowfold farmstead',
  hint: 'Hold Space to call them out',
  loreTitle: 'Meadowfold farmstead',
  loreBody:
    "A family of five was hiding in the grain bins, breathing as quietly as they could. They thank you in a language you almost recognize. Three follow you back to the fire; two stay behind to bury what they have to bury.",
  villagerCount: 3,
};

const SETTLEMENT_QUARRY: POIInstance = {
  id: 'settlement_quarry',
  category: 'settlement',
  sprite: 'ruin',
  label: 'Stonewright\u2019s quarry',
  hint: 'Hold Space to dig them out',
  loreTitle: 'Stonewright\u2019s quarry',
  loreBody:
    "Two stonecutters, half-buried in their own work. They were carving a name into the cliff when the dark came for them. They follow you home without a word, the chisel still in one of their hands.",
  villagerCount: 2,
};

const SETTLEMENT_CHAPEL: POIInstance = {
  id: 'settlement_chapel',
  category: 'settlement',
  sprite: 'shrine',
  label: 'Chapel of Lit Candles',
  hint: 'Hold Space to wake them',
  loreTitle: 'Chapel of Lit Candles',
  loreBody:
    "Three votive-keepers still tend the wicks, though every candle but one has burned down to a stub. They have been waiting. They hope you came for them. They take no provisions but the small flames they cup in their hands.",
  villagerCount: 3,
};

// ── Lore (story + small coin reward) ─────────────────────────────────
// Three lore variants. Pure narrative + a small economic nudge.

const LORE_BURNED_HOUSE: POIInstance = {
  id: 'lore_burned_house',
  category: 'lore',
  sprite: 'ruin',
  label: 'The burned house',
  hint: 'Hold Space to sift the ashes',
  loreTitle: 'A note found in the ashes',
  loreBody:
    "Soot lines climb the inner walls only as high as a child\u2019s hand. Whoever set this fire knew what they were burning. There is no body. There is only a single bronze coin in the centre of the hearth, still warm, and a circle of smaller coins arranged around it like watchers.",
  coinReward: 12,
};

const LORE_SHALLOW_GRAVE: POIInstance = {
  id: 'lore_shallow_grave',
  category: 'lore',
  sprite: 'graveyard',
  label: 'A shallow grave',
  hint: 'Hold Space to disturb the earth',
  loreTitle: 'A note from the earth',
  loreBody:
    "The earth here is loose. You find three gold pieces and a single child\u2019s tooth. There is no body. We do not name what we found beneath \u2014 only that it was warm, and that it was breathing, and that it was not asleep.",
  coinReward: 18,
};

const LORE_MERCHANT_CACHE: POIInstance = {
  id: 'lore_merchant_cache',
  category: 'lore',
  sprite: 'cache',
  label: 'The merchant\u2019s cache',
  hint: 'Hold Space to crack the seal',
  loreTitle: 'The merchant\u2019s ledger',
  loreBody:
    "An iron-bound chest hidden under a flat rock. A trader meant to come back for it. The trader did not. The chest has been waiting since the equinox, and the ledger inside lists names you do not know, and one name you do.",
  coinReward: 18,
};

// ── Extra settlement variants (added when the map doubled and we needed
// more bodies in the wilds) ──────────────────────────────────────────

const SETTLEMENT_WOODCUTTER: POIInstance = {
  id: 'settlement_woodcutter',
  category: 'settlement',
  sprite: 'camp',
  label: 'Woodcutter\u2019s camp',
  hint: 'Hold Space to wake them',
  loreTitle: 'Woodcutter\u2019s camp',
  loreBody:
    "Two woodcutters were felling a black oak when the dark came over the ridge. They have been hiding in the felled trunk since, breathing through the rot and the rain. Their axes are still in the bark. They will follow your fire.",
  villagerCount: 2,
};

const SETTLEMENT_APIARY: POIInstance = {
  id: 'settlement_apiary',
  category: 'settlement',
  sprite: 'shrine',
  label: 'The bee priest\u2019s apiary',
  hint: 'Hold Space to call them out',
  loreTitle: 'The bee priest\u2019s apiary',
  loreBody:
    "Three apiary keepers crouch among their hives, smoke-stained and quiet. The bees stayed when everything else fled. They say the bees know things the bees should not, and that the bees have agreed to come with them.",
  villagerCount: 3,
};

const SETTLEMENT_MILL: POIInstance = {
  id: 'settlement_mill',
  category: 'settlement',
  sprite: 'ruin',
  label: 'Riverside mill',
  hint: 'Hold Space to lift the cellar door',
  loreTitle: 'Riverside mill',
  loreBody:
    "Two millers, a child, and an old dog are wedged into the flour-cellar. They survived because the dog would not stop barking and they could not stop hiding. The dog is mute now. The child is not. They follow.",
  villagerCount: 3,
};

// ── Extra lore variants ──────────────────────────────────────────────

const LORE_BROKEN_WHEEL: POIInstance = {
  id: 'lore_broken_wheel',
  category: 'lore',
  sprite: 'ruin',
  label: 'A broken cart',
  hint: 'Hold Space to search the wreckage',
  loreTitle: 'What was on the cart',
  loreBody:
    "A cart, off the road, wheel snapped clean. Whoever was driving it left in a hurry. You find a strongbox under a tarp, ten coins inside, and a single small shoe wedged into the spokes. You take the coins. You leave the shoe.",
  coinReward: 10,
};

const LORE_WITCH_LEDGER: POIInstance = {
  id: 'lore_witch_ledger',
  category: 'lore',
  sprite: 'shrine',
  label: 'The witch\u2019s ledger',
  hint: 'Hold Space to crack the binding',
  loreTitle: 'The witch\u2019s ledger',
  loreBody:
    "A leather-bound book chained to a stone pillar. Every page is a list of names \u2014 some crossed out in red, some still being added. Your name is not in it. Three of the children\u2019s names are. Tucked inside: fifteen coins, and a key that fits no lock you know.",
  coinReward: 15,
};

const LORE_CINDER_PIT: POIInstance = {
  id: 'lore_cinder_pit',
  category: 'lore',
  sprite: 'graveyard',
  label: 'The cinder pit',
  hint: 'Hold Space to rake the cinders',
  loreTitle: 'The cinder pit',
  loreBody:
    "An old burn-pit, deeper than it looks. You rake through the cinders and find fourteen old coins, blackened but unmelted. At the bottom, a hand-mirror, its glass cracked. The face that looks back is not yours, and is not afraid.",
  coinReward: 14,
};

// ── Upgrade POIs ─────────────────────────────────────────────────────
// Each grants a single tier on its track when claimed. Player finds
// them in any order; `claimPOI` advances the next un-earned tier on
// the matching track. Five variants per track (15 total) so the
// scatter has variety run-to-run.

// Archers ─────────
const UPGRADE_ARCHER_BOWYER_GRAVE: POIInstance = {
  id: 'upgrade_archer_bowyer_grave',
  category: 'upgrade',
  sprite: 'graveyard',
  label: "The bowyer's grave",
  hint: 'Hold Space to dig at the headstone',
  loreTitle: "The bowyer's grave",
  loreBody:
    "A craftsman who shaped a thousand bows lies under this stone. The arrowheads buried with him are still sharp; the cord on his last unstrung bow has not yet rotted. Someone wanted this work to keep working.",
  upgradeTrack: 'archer',
};
const UPGRADE_ARCHER_GUILDHOUSE: POIInstance = {
  id: 'upgrade_archer_guildhouse',
  category: 'upgrade',
  sprite: 'ruin',
  label: "Old archers' guildhouse",
  hint: 'Hold Space to enter',
  loreTitle: "The old archers' guildhouse",
  loreBody:
    "Wind has been moving through this hall for a long time. The drillsong is still chiselled into the rafters — every measure, every refrain. Whoever reads it remembers it.",
  upgradeTrack: 'archer',
};
const UPGRADE_ARCHER_ARROW_TREE: POIInstance = {
  id: 'upgrade_archer_arrow_tree',
  category: 'upgrade',
  sprite: 'ruin',
  label: 'The arrow tree',
  hint: 'Hold Space to gather the iron',
  loreTitle: 'The arrow tree',
  loreBody:
    "A black oak so dense with arrowheads it has stopped growing. The fletchings have rotted away. The iron remembers what it was for.",
  upgradeTrack: 'archer',
};
const UPGRADE_ARCHER_VIGIL_STONE: POIInstance = {
  id: 'upgrade_archer_vigil_stone',
  category: 'upgrade',
  sprite: 'shrine',
  label: 'The vigil-stone',
  hint: 'Hold Space to read the stone',
  loreTitle: 'The vigil-stone',
  loreBody:
    "An archer's watchpost. They died here, bow in hand, eyes open, and the stone they leaned against has remembered their posture for a hundred years. Stand here long enough and your shoulders learn it too.",
  upgradeTrack: 'archer',
};
const UPGRADE_ARCHER_RANGER_CAIRN: POIInstance = {
  id: 'upgrade_archer_ranger_cairn',
  category: 'upgrade',
  sprite: 'graveyard',
  label: "The ranger's cairn",
  hint: 'Hold Space to disturb the cairn',
  loreTitle: "The ranger's cairn",
  loreBody:
    "Stones piled around a dead longbow. The man under them was famous in his time. The bow was older. You take the lessons and leave the bow where it was.",
  upgradeTrack: 'archer',
};

// Soldiers ────────
const UPGRADE_SOLDIER_DRILLING_FIELD: POIInstance = {
  id: 'upgrade_soldier_drilling_field',
  category: 'upgrade',
  sprite: 'ruin',
  label: 'The drilling field',
  hint: 'Hold Space to walk the steps',
  loreTitle: 'The drilling field',
  loreBody:
    "Footprints in the dust. A formation that remembers itself — the same ten paces traced in cold earth, again and again, by feet that have stopped pacing. Walk it once and your soldiers learn it.",
  upgradeTrack: 'soldier',
};
const UPGRADE_SOLDIER_DUELIST: POIInstance = {
  id: 'upgrade_soldier_duelist',
  category: 'upgrade',
  sprite: 'graveyard',
  label: "A duelist's last stand",
  hint: 'Hold Space to take what was left',
  loreTitle: "A duelist's last stand",
  loreBody:
    "Three swords planted in the dirt, their owners around them. He took two of the three with him. The third blade is still warm, somehow. You leave it where it is.",
  upgradeTrack: 'soldier',
};
const UPGRADE_SOLDIER_PAY_STONE: POIInstance = {
  id: 'upgrade_soldier_pay_stone',
  category: 'upgrade',
  sprite: 'cache',
  label: "The mercenary's pay-stone",
  hint: 'Hold Space to read the ledger',
  loreTitle: "The mercenary's pay-stone",
  loreBody:
    "A flat rock where soldiers were paid in coin and salt. The names are nearly worn smooth. The drill they were paid to learn is not.",
  upgradeTrack: 'soldier',
};
const UPGRADE_SOLDIER_SIEGE_CAMP: POIInstance = {
  id: 'upgrade_soldier_siege_camp',
  category: 'upgrade',
  sprite: 'ruin',
  label: 'A siege-camp ash-pit',
  hint: 'Hold Space to sift the ashes',
  loreTitle: 'The siege-camp ash-pit',
  loreBody:
    "An old soldiers' camp. Their shields are still propped against the trees. Whatever they were besieging, they outlasted; whatever it was, they did not come home.",
  upgradeTrack: 'soldier',
};
const UPGRADE_SOLDIER_WEEPING_HELM: POIInstance = {
  id: 'upgrade_soldier_weeping_helm',
  category: 'upgrade',
  sprite: 'cache',
  label: 'The weeping helm',
  hint: 'Hold Space to lift the helm',
  loreTitle: 'The weeping helm',
  loreBody:
    "A helm filled with rainwater. Birds drink from it now. The man who wore it left teeth marks on the inside lip — he was biting it shut as he died. Whatever he learned in that last bite, he left.",
  upgradeTrack: 'soldier',
};

// Knights ─────────
const UPGRADE_KNIGHT_FALLEN_LANCE: POIInstance = {
  id: 'upgrade_knight_fallen_lance',
  category: 'upgrade',
  sprite: 'graveyard',
  label: 'The fallen lance',
  hint: 'Hold Space to take the pennant',
  loreTitle: 'The fallen lance',
  loreBody:
    "A knight's lance buried point-down, planted as a marker. The pennant is gone. The lance is still standing because the earth around it is still afraid.",
  upgradeTrack: 'knight',
};
const UPGRADE_KNIGHT_CHAINED_CHAMPION: POIInstance = {
  id: 'upgrade_knight_chained_champion',
  category: 'upgrade',
  sprite: 'ruin',
  label: "The chained champion's tomb",
  hint: 'Hold Space to read the chains',
  loreTitle: "The chained champion's tomb",
  loreBody:
    "Bound in irons even in death. They were afraid of him. They remain afraid of him. Whoever you are, do what he did and they will be afraid of you.",
  upgradeTrack: 'knight',
};
const UPGRADE_KNIGHT_TOURNAMENT: POIInstance = {
  id: 'upgrade_knight_tournament',
  category: 'upgrade',
  sprite: 'ruin',
  label: 'The tournament ring',
  hint: 'Hold Space to step into the ring',
  loreTitle: 'The tournament ring',
  loreBody:
    "A circle of stones where men in plate killed each other for sport. The grass inside the circle has not grown back. The shape of every bout is still legible if you know how to look.",
  upgradeTrack: 'knight',
};
const UPGRADE_KNIGHT_DESTRIER: POIInstance = {
  id: 'upgrade_knight_destrier',
  category: 'upgrade',
  sprite: 'graveyard',
  label: "The destrier's grave",
  hint: 'Hold Space to lay a hand on the stone',
  loreTitle: "The faithful destrier's grave",
  loreBody:
    "He was buried beside his rider. They remember him by name. The stone is heavier than horses are; the love that put it here was heavier still. Some of that strength is still in the ground.",
  upgradeTrack: 'knight',
};
const UPGRADE_KNIGHT_SQUIRE: POIInstance = {
  id: 'upgrade_knight_squire',
  category: 'upgrade',
  sprite: 'ruin',
  label: "The squire's ash-pit",
  hint: 'Hold Space to sift the iron',
  loreTitle: "The squire's ash-pit",
  loreBody:
    "A boy's first armour, melted into a single pool of iron. He did not earn the armour. He earned the lesson. The lesson is still here.",
  upgradeTrack: 'knight',
};

// ── Night-only POIs ───────────────────────────────────────────────────
// Spawn at night-start, despawn at dawn if unclaimed. Each grants a
// kiss/curse pair: a powerful short-term benefit balanced against a
// real cost. Visually shifted yellow/red — these are the corrupted
// echoes of the day-time POIs. The `nightKissCurseId` field is read
// in `Game.claimPOI` to apply the matching effect.

const NIGHT_BOWYER_RESTLESS: POIInstance = {
  id: 'night_bowyer_restless',
  category: 'night',
  sprite: 'graveyard',
  label: "The bowyer's restless grave",
  hint: 'Hold Space to disturb him',
  loreTitle: "The bowyer's restless grave",
  loreBody:
    "He was buried with his bows. He has not stayed buried. The arrowheads are still sharp; he hands one to you, in the cold way the dead hand things. Your blade hums when you draw it. Something with yellow eyes is following you home.",
  nightKissCurseId: 'restless_bowyer',
};
const NIGHT_PYRE_CHAPEL: POIInstance = {
  id: 'night_pyre_chapel',
  category: 'night',
  sprite: 'shrine',
  label: 'A pyre at the chapel',
  hint: 'Hold Space to take what walks out',
  loreTitle: 'The pyre at the chapel',
  loreBody:
    "A villager steps out of the smoke. She knows you. You don't know her. She follows you home without being asked. There is a sign carved into her palm she does not look at, and at dawn the sign will take her back.",
  nightKissCurseId: 'pyre_villager',
};
const NIGHT_OPEN_GRAVE_MERCHANT: POIInstance = {
  id: 'night_open_grave_merchant',
  category: 'night',
  sprite: 'cache',
  label: "A merchant's open grave",
  hint: 'Hold Space to take what was buried',
  loreTitle: "The merchant's open grave",
  loreBody:
    "His coins are arranged around him like a wreath. You take them. He smiles. For the rest of the hour you will leak coin like blood — every step a tax he is collecting from where you cannot see.",
  nightKissCurseId: 'leaky_purse',
};
const NIGHT_SINGING_WELL: POIInstance = {
  id: 'night_singing_well',
  category: 'night',
  sprite: 'ruin',
  label: 'The singing well',
  hint: 'Hold Space to drink',
  loreTitle: 'The singing well',
  loreBody:
    "The water sings when the wind moves over it, in a child's voice that is almost yours. Drink and your wounds knit. Drink and a piece of you is in the well now. You will be smaller for the rest of the run.",
  nightKissCurseId: 'singing_well',
};
const NIGHT_DRILLING_PIT: POIInstance = {
  id: 'night_drilling_pit',
  category: 'night',
  sprite: 'ruin',
  label: 'The drilling pit',
  hint: 'Hold Space to call the formation',
  loreTitle: 'The drilling pit',
  loreBody:
    "Soldiers in the dark, dead a long time, drill in the pit. They will lend you their cadence. Your villagers will fight faster while the dead remember how. When the cadence ends, the dead want their fee paid in firelight.",
  nightKissCurseId: 'drill_pit',
};
const NIGHT_MASK_IN_GRASS: POIInstance = {
  id: 'night_mask_in_grass',
  category: 'night',
  sprite: 'shrine',
  label: 'A mask in the grass',
  hint: 'Hold Space to lift the mask',
  loreTitle: 'A mask in the grass',
  loreBody:
    "A pallid mask, half-buried, half-smiling. It fits, even though you don't put it on. Your lantern burns longer than it should now. The world around you presses inward, narrower. You see less of it than you did.",
  nightKissCurseId: 'mask_in_grass',
};

// ── Roster ───────────────────────────────────────────────────────────

export const POI_INSTANCES: POIInstance[] = [
  RELIC_L2,
  RELIC_L3,
  RELIC_WORKSHOP,
  RELIC_BLACKSMITH,
  RELIC_STABLES,
  SETTLEMENT_MEADOWFOLD,
  SETTLEMENT_QUARRY,
  SETTLEMENT_CHAPEL,
  SETTLEMENT_WOODCUTTER,
  SETTLEMENT_APIARY,
  SETTLEMENT_MILL,
  LORE_BURNED_HOUSE,
  LORE_SHALLOW_GRAVE,
  LORE_MERCHANT_CACHE,
  LORE_BROKEN_WHEEL,
  LORE_WITCH_LEDGER,
  LORE_CINDER_PIT,
  // Upgrade POIs
  UPGRADE_ARCHER_BOWYER_GRAVE,
  UPGRADE_ARCHER_GUILDHOUSE,
  UPGRADE_ARCHER_ARROW_TREE,
  UPGRADE_ARCHER_VIGIL_STONE,
  UPGRADE_ARCHER_RANGER_CAIRN,
  UPGRADE_SOLDIER_DRILLING_FIELD,
  UPGRADE_SOLDIER_DUELIST,
  UPGRADE_SOLDIER_PAY_STONE,
  UPGRADE_SOLDIER_SIEGE_CAMP,
  UPGRADE_SOLDIER_WEEPING_HELM,
  UPGRADE_KNIGHT_FALLEN_LANCE,
  UPGRADE_KNIGHT_CHAINED_CHAMPION,
  UPGRADE_KNIGHT_TOURNAMENT,
  UPGRADE_KNIGHT_DESTRIER,
  UPGRADE_KNIGHT_SQUIRE,
  // Night-only POIs (spawned dynamically at night, not via the scatter
  // recipe — but they live in the same instance registry so claimPOI
  // can find them by id).
  NIGHT_BOWYER_RESTLESS,
  NIGHT_PYRE_CHAPEL,
  NIGHT_OPEN_GRAVE_MERCHANT,
  NIGHT_SINGING_WELL,
  NIGHT_DRILLING_PIT,
  NIGHT_MASK_IN_GRASS,
];

const BY_ID = new Map(POI_INSTANCES.map((i) => [i.id, i] as const));

export function poiInstance(id: string): POIInstance | undefined {
  return BY_ID.get(id);
}

/** Return all instances of a given category. Used by world-gen to pick
 *  which settlement / lore variants to scatter this run. */
export function instancesOfCategory(category: POICategory): POIInstance[] {
  return POI_INSTANCES.filter((i) => i.category === category);
}

/** Scatter recipe for daytime POIs. Total = 32 — bloated to give the
 *  player a richer wilds and ensure most upgrade tracks have at least
 *  one tier reachable per run without trivializing the layout. Night
 *  POIs spawn dynamically (see Game.ts night-start logic) and aren't
 *  in this recipe. */
export const POI_SCATTER_RECIPE: { category: POICategory; count: number }[] = [
  // 5 relics: 2 campfire-upgrade gates + 3 building-unlock gates.
  { category: 'relic', count: 5 },
  { category: 'settlement', count: 11 },
  { category: 'lore', count: 10 },
  { category: 'upgrade', count: 9 },
];
