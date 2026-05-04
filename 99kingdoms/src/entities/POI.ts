// Points of interest scattered through the wilds. The visible sprite type
// (camp / chest / shrine / etc.) is decoupled from the *behavior* category
// (relic / settlement / lore): a "lore" POI can use the chest sprite, a
// "settlement" can use the camp sprite, etc. Authored instances in
// `POIInstances.ts` bind a sprite + category + named lore together.

/** The visual kind drives which sprite drawPOI renders. Keeps every world
 *  layout looking varied even though the behavior categories are fewer. */
export type POISpriteKind =
  | 'camp'
  | 'chest'
  | 'shrine'
  | 'graveyard'
  | 'cache'
  | 'ruin';

/** Behavior bucket. Each instance (see POIInstances.ts) belongs to one of
 *  these and carries the appropriate payload (relicLevel / villagerCount /
 *  coinReward / upgradeTrack / nightKissCurseId). */
export type POICategory = 'relic' | 'settlement' | 'lore' | 'upgrade' | 'night';

export interface POI {
  id: number;
  /** Stable id of the authored instance (e.g. 'relic_l2', 'settlement_meadowfold'). */
  instanceId: string;
  /** Sprite to render — pulled from the instance at world-gen and cached
   *  here so Render.ts doesn't need to chase the instance table per frame. */
  sprite: POISpriteKind;
  x: number;
  y: number;
  claimed: boolean;
  discovered: boolean;
  interactProgress: number;
}

export const POI_INTERACT_RANGE = 42;
export const POI_INTERACT_DURATION = 1.4;

let nextId = 1;

export function createPOI(
  instanceId: string,
  sprite: POISpriteKind,
  x: number,
  y: number,
): POI {
  return {
    id: nextId++,
    instanceId,
    sprite,
    x,
    y,
    claimed: false,
    discovered: false,
    interactProgress: 0,
  };
}
