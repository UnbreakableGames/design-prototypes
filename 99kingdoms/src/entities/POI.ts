export type POIKind = 'camp' | 'chest' | 'shrine' | 'graveyard' | 'cache' | 'ruin';

export interface POI {
  id: number;
  kind: POIKind;
  x: number;
  y: number;
  claimed: boolean;
  discovered: boolean;
  interactProgress: number;
}

export const POI_INTERACT_RANGE = 42;
export const POI_INTERACT_DURATION = 1.4;

export const POI_LABELS: Record<POIKind, string> = {
  camp: 'Abandoned camp',
  chest: 'Old chest',
  shrine: 'Mossy shrine',
  graveyard: 'Haunted graveyard',
  cache: 'Hidden cache',
  ruin: 'Ruined outpost',
};

export const POI_HINTS: Record<POIKind, string> = {
  camp: 'Hold Space to call the villagers',
  chest: 'Hold Space to pry it open',
  shrine: 'Hold Space to receive a blessing',
  graveyard: 'Hold Space to disturb the dead',
  cache: 'Hold Space to crack it open',
  ruin: 'Hold Space to raise the outpost',
};

let nextId = 1;

export function createPOI(kind: POIKind, x: number, y: number): POI {
  return {
    id: nextId++,
    kind,
    x,
    y,
    claimed: false,
    discovered: false,
    interactProgress: 0,
  };
}
