import { Rng } from './Rng';
import { GENERIC_ITEMS, UNIQUE_MIN_DEPTH, type ItemKind } from '../types';

export type Room = {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isConnector: boolean;
};

export type ObstacleKind = 'box' | 'crate' | 'shelf' | 'pipe' | 'furniture' | 'pillar';

export type Obstacle = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ObstacleKind;
};

export type Hazard = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'creak';
};

export type ItemSpawn = { x: number; y: number; kind: ItemKind };

// Atmospheric "fear" objects that ramp up panic when the player is nearby.
// Some are physical (furnace, broken pipe = walls); others are floor or
// ceiling props (bloodstain, hanging dolls).
export type FearKind = 'furnace' | 'dolls' | 'bloodstain' | 'steampipe';

export type FearObject = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: FearKind;
};

export function fearSize(kind: FearKind): { w: number; h: number } {
  switch (kind) {
    case 'furnace':
      return { w: 56, h: 72 };
    case 'dolls':
      return { w: 36, h: 48 };
    case 'bloodstain':
      return { w: 44, h: 32 };
    case 'steampipe':
      return { w: 80, h: 18 };
  }
}

// Whether the fear object physically blocks movement (added to the wall list).
export function fearBlocks(kind: FearKind): boolean {
  return kind === 'furnace' || kind === 'steampipe';
}

// Per-kind panic radius and rate. The contribution falls off linearly from
// rate at the center to 0 at the edge of `radius`.
export const FEAR_RADIUS: Record<FearKind, number> = {
  furnace: 110,
  dolls: 80,
  bloodstain: 60,
  steampipe: 80,
};

export const FEAR_RATE: Record<FearKind, number> = {
  furnace: 5,
  dolls: 4,
  bloodstain: 2,
  steampipe: 3,
};

// Regular containers (toolbox/locker/cabinet) open with hold-Space; safes are
// special: they require the arrow-key QTE to crack, but contain the best loot.
export type ContainerKind = 'toolbox' | 'locker' | 'cabinet' | 'safe';
export const REGULAR_CONTAINER_KINDS: Exclude<ContainerKind, 'safe'>[] = ['toolbox', 'locker', 'cabinet'];

export type ContainerSpec = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ContainerKind;
  items: ItemKind[];
};

// Hold-Space duration for the regular kinds. Safes don't use this — they
// open via the arrow-key QTE in Container.ts.
export const CONTAINER_DURATION: Record<ContainerKind, number> = {
  toolbox: 1.8,
  locker: 3.2,
  cabinet: 2.4,
  safe: 0, // unused; safe uses QTE
};

export function containerSize(kind: ContainerKind): { w: number; h: number } {
  switch (kind) {
    case 'toolbox':
      return { w: 42, h: 26 };
    case 'locker':
      return { w: 32, h: 60 };
    case 'cabinet':
      return { w: 68, h: 36 };
    case 'safe':
      return { w: 48, h: 48 };
  }
}

export type Exit = { x: number; y: number; dir: 'up' | 'down' };

export type WaypointPath = { x: number; y: number }[];

export type BasementMap = {
  seed: number;
  depth: number;
  rooms: Room[];
  obstacles: Obstacle[];
  containers: ContainerSpec[];
  hazards: Hazard[];
  fearObjects: FearObject[];
  items: ItemSpawn[];
  exits: Exit[];
  stalkerPaths: WaypointPath[];
  startX: number;
  startY: number;
  worldW: number;
  worldH: number;
};

// FTUE-only basement: one room, no stalkers, no fear, no obstacles in the
// way of the eyes container, only an up exit.
export function generateTutorial(seed: number): BasementMap {
  const rng = new Rng(seed);
  // Compact safe room, comfortably traversable on the player's first descent.
  const w = 480;
  const h = 320;
  const room: Room = { id: 0, x: 80, y: 80, w, h, isConnector: false };
  const rooms: Room[] = [room];

  // A handful of inert obstacles for atmosphere — placed away from the
  // container/exit corridor so the player can't get stuck.
  const obstacles: Obstacle[] = [];
  const decoCount = 3 + rng.int(0, 2);
  const kinds: ObstacleKind[] = ['box', 'crate', 'shelf', 'pillar'];
  for (let i = 0; i < decoCount; i++) {
    const kind = rng.pick(kinds);
    const sz = obstacleSize(kind, rng);
    for (let a = 0; a < 30; a++) {
      const x = room.x + rng.range(40, room.w - sz.w - 40);
      const y = room.y + rng.range(40, room.h - sz.h - 40);
      const candidate = { x, y, w: sz.w, h: sz.h };
      // Keep the center clear so the eyes container + path is unobstructed.
      const cx = room.x + room.w / 2;
      const cy = room.y + room.h / 2;
      if (Math.abs(candidate.x + candidate.w / 2 - cx) < 80 && Math.abs(candidate.y + candidate.h / 2 - cy) < 80) continue;
      if (overlapsAny(candidate, obstacles, 16)) continue;
      obstacles.push({ ...candidate, kind });
      break;
    }
  }

  // Single guaranteed-eyes toolbox in the middle of the room.
  const tbSize = containerSize('toolbox');
  const containers: ContainerSpec[] = [
    {
      x: room.x + room.w / 2 - tbSize.w / 2,
      y: room.y + room.h / 2 - tbSize.h / 2,
      w: tbSize.w,
      h: tbSize.h,
      kind: 'toolbox',
      items: ['eyes'],
    },
  ];

  // Single up exit on the right wall.
  const exits: Exit[] = [
    { x: room.x + room.w - 60, y: room.y + room.h / 2, dir: 'up' },
  ];

  // No stalkers, no fear objects, no hazards.
  const stalkerPaths: WaypointPath[] = [];
  const fearObjects: FearObject[] = [];
  const hazards: Hazard[] = [];
  const items: ItemSpawn[] = [];

  // Player spawns near the left wall — has to walk past everything to reach
  // the container and then continue right to the exit.
  const startX = room.x + 80;
  const startY = room.y + room.h / 2;

  return {
    seed,
    depth: 1,
    rooms,
    obstacles,
    containers,
    hazards,
    fearObjects,
    items,
    exits,
    stalkerPaths,
    startX,
    startY,
    worldW: room.x * 2 + w,
    worldH: room.y * 2 + h,
  };
}

// `questUnique` is the active body part the player is currently searching
// for (e.g. 'heart' while repairing the chest). When non-null it's the only
// unique item that can spawn this run — heart/claw/foot are gated to their
// respective part quests. When null (no active body-part quest) only generic
// items spawn. Each unique also has a minimum depth (UNIQUE_MIN_DEPTH); on
// shallower floors we silently treat questUnique as null so the player has
// to go deeper to actually find the part.
export function generate(seed: number, depth: number, questUnique: ItemKind | null): BasementMap {
  const rng = new Rng(seed);
  const minDepth = questUnique != null ? UNIQUE_MIN_DEPTH[questUnique] ?? 1 : 1;
  const effectiveQuestUnique = questUnique != null && depth >= minDepth ? questUnique : null;

  // Few large rooms — 1 at depth 1, growing to 3 at deeper depths
  const numRooms = Math.min(3, 1 + Math.floor((depth - 1) / 2));

  const rooms: Room[] = [];
  let cursorX = 80;
  let maxBottom = 0;
  for (let i = 0; i < numRooms; i++) {
    const w = Math.round(rng.range(880, 1200) / 32) * 32;
    const h = Math.round(rng.range(680, 920) / 32) * 32;
    const yJitter = i === 0 ? 0 : rng.int(-120, 200);
    const y = 80 + yJitter;
    rooms.push({ id: i, x: cursorX, y, w, h, isConnector: false });
    cursorX += w;
    if (y + h > maxBottom) maxBottom = y + h;
  }

  // Connectors join consecutive rooms with a wide opening (overlapping both)
  for (let i = 0; i < numRooms - 1; i++) {
    const a = rooms[i]!;
    const b = rooms[i + 1]!;
    const sharedTop = Math.max(a.y, b.y);
    const sharedBot = Math.min(a.y + a.h, b.y + b.h);
    const shared = sharedBot - sharedTop;
    const opening = Math.min(360, Math.max(160, shared - 120));
    const oy = sharedTop + (shared - opening) / 2 + rng.range(-30, 30);
    const cw = 180;
    rooms.push({
      id: 100 + i,
      x: a.x + a.w - 90,
      y: oy,
      w: cw,
      h: opening,
      isConnector: true,
    });
  }

  const worldW = cursorX + 80;
  const worldH = maxBottom + 80;

  const mainRooms = rooms.filter((r) => !r.isConnector);

  // Exits placed FIRST so every other prop (obstacles, containers, fear,
  // hazards, stalker waypoints) can treat the stairs as a no-build zone.
  // The visible Stairs sprite is 36×36 centered on (e.x, e.y); we wrap each
  // one in an 80×80 footprint (~22px margin past the sprite) and then layer
  // additional pad on top in each consumer's overlap check.
  const numExits = Math.min(5, 2 + Math.floor(depth / 2));
  const dirOrder: ('up' | 'down')[] = [];
  for (let i = 0; i < numExits; i++) dirOrder.push(i % 2 === 0 ? 'up' : 'down');
  const exits: Exit[] = [];
  for (const dir of dirOrder) {
    let placed = tryPlace(rng, mainRooms, [], exits, 360, 0);
    if (!placed) placed = tryPlace(rng, mainRooms, [], exits, 240, 0);
    if (!placed) placed = tryPlace(rng, mainRooms, [], exits, 140, 0);
    if (placed) exits.push({ ...placed, dir });
  }
  const exitFootprints: RectLike[] = exits.map((e) => ({ x: e.x - 40, y: e.y - 40, w: 80, h: 80 }));

  // Obstacles — clutter inside main rooms, avoiding exit footprints so the
  // stairs themselves stay clear of clutter.
  const obstacles: Obstacle[] = [];
  for (const r of rooms) {
    if (r.isConnector) continue;
    const target = 14 + rng.int(0, 10);
    let attempts = 0;
    while (obstacles.filter((o) => inRoom(o, r)).length < target && attempts < 160) {
      attempts++;
      const kind = rng.pick<ObstacleKind>(['box', 'crate', 'shelf', 'pipe', 'furniture', 'pillar']);
      const sz = obstacleSize(kind, rng);
      const x = r.x + rng.range(28, r.w - sz.w - 28);
      const y = r.y + rng.range(28, r.h - sz.h - 28);
      const candidate = { x, y, w: sz.w, h: sz.h };
      if (overlapsAny(candidate, obstacles, 14)) continue;
      // keep connector mouths clear so rooms stay reachable
      if (overlapsConnectorMouth(candidate, rooms, 24)) continue;
      // keep the stairs themselves clear
      if (overlapsAny(candidate, exitFootprints, 12)) continue;
      obstacles.push({ ...candidate, kind });
    }
  }

  // Containers — 3-5 per main room, dodging obstacles and exit footprints.
  const containers: ContainerSpec[] = [];
  const safeRate = Math.min(0.85, 0.2 + depth * 0.12);
  for (const r of mainRooms) {
    const count = 3 + rng.int(0, 3);
    for (let i = 0; i < count; i++) {
      const kind = rng.pick<ContainerKind>(['toolbox', 'locker', 'cabinet']);
      placeContainer(rng, r, kind, depth, obstacles, containers, rooms, exitFootprints, effectiveQuestUnique);
    }
    if (rng.chance(safeRate)) {
      placeContainer(rng, r, 'safe', depth, obstacles, containers, rooms, exitFootprints, effectiveQuestUnique);
    }
  }

  // Fear objects — also avoid the exit footprints.
  const fearObjects: FearObject[] = [];
  const fearKinds: FearKind[] = ['furnace', 'dolls', 'bloodstain', 'steampipe'];
  for (const r of mainRooms) {
    const count = 1 + rng.int(0, Math.min(3, 1 + Math.floor(depth / 2)));
    for (let i = 0; i < count; i++) {
      const kind = rng.pick<FearKind>(fearKinds);
      const sz = fearSize(kind);
      let placed: { x: number; y: number; w: number; h: number } | null = null;
      for (let a = 0; a < 30; a++) {
        const x = r.x + rng.range(40, r.w - sz.w - 40);
        const y = r.y + rng.range(40, r.h - sz.h - 40);
        const candidate = { x, y, w: sz.w, h: sz.h };
        if (overlapsAny(candidate, obstacles, 22)) continue;
        if (containerOverlap(candidate, containers, 28)) continue;
        if (overlapsConnectorMouth(candidate, rooms, 32)) continue;
        if (overlapsAny(candidate, exitFootprints, 12)) continue;
        let overlapsFear = false;
        for (const f of fearObjects) {
          if (
            candidate.x < f.x + f.w + 24 &&
            candidate.x + candidate.w + 24 > f.x &&
            candidate.y < f.y + f.h + 24 &&
            candidate.y + candidate.h + 24 > f.y
          ) {
            overlapsFear = true;
            break;
          }
        }
        if (overlapsFear) continue;
        placed = candidate;
        break;
      }
      if (placed) fearObjects.push({ ...placed, kind });
    }
  }

  // Combined blockers — clutter, containers, and the solid fear objects
  // (furnace, steampipe) are walls and can't be spawned on by items,
  // hazards, or the player. Exit footprints are appended so creak tiles and
  // stalker patrol points can't land on or right next to a stair (the player
  // can still walk over the exit itself — just nothing else can spawn there).
  const fearBlockerRects = fearObjects.filter((f) => fearBlocks(f.kind));
  const blockers: RectLike[] = [
    ...obstacles,
    ...containers,
    ...fearBlockerRects,
    ...exitFootprints,
  ];

  // No scattered ground items — every item lives inside a container.
  const items: ItemSpawn[] = [];

  // Hazards — 0-2 creaky tiles
  const hazardCount = rng.int(0, 3);
  const hazards: Hazard[] = [];
  for (let i = 0; i < hazardCount; i++) {
    const placed = tryPlace(rng, mainRooms, blockers, [], 0, 18);
    if (placed) hazards.push({ x: placed.x - 14, y: placed.y - 14, w: 28, h: 28, kind: 'creak' });
  }

  // Stalker patrols — 2 stalkers, each with its own coherent route. Their
  // spawn points (path[0]) are placed far apart first so the two enemies
  // don't start side-by-side, then each path adds 2-4 more waypoints scattered
  // through the rooms.
  const sortedMain = [...mainRooms].sort((a, b) => a.x - b.x);
  const NUM_STALKERS = 2;
  const stalkerSpawns: { x: number; y: number }[] = [];
  for (let s = 0; s < NUM_STALKERS; s++) {
    const minSpacing = s === 0 ? 0 : 350;
    let placed = tryPlace(rng, sortedMain, blockers, stalkerSpawns, minSpacing, 22);
    if (!placed) placed = tryPlace(rng, sortedMain, blockers, stalkerSpawns, 220, 22);
    if (!placed) placed = tryPlace(rng, sortedMain, blockers, stalkerSpawns, 0, 22);
    if (placed) stalkerSpawns.push(placed);
  }
  const stalkerPaths: WaypointPath[] = [];
  for (const spawn of stalkerSpawns) {
    const path: WaypointPath = [spawn];
    const extra = 2 + rng.int(0, 3);
    for (let i = 0; i < extra; i++) {
      const r = rng.pick(sortedMain);
      const placed = tryPlace(rng, [r], blockers, path, 220, 22);
      if (placed) path.push(placed);
    }
    while (path.length < 2) {
      const placed = tryPlace(rng, sortedMain, blockers, path, 0, 22);
      if (placed) path.push(placed);
      else break;
    }
    stalkerPaths.push(path);
  }

  // Player start: walkable, clear of every prop, far from every exit, far
  // from the stalker spawn, and with line-of-sight to it broken (something
  // between them) so the stalker can't see the player on the very first
  // frame. PLAYER_PAD of 20 means the player's center is at least 20 units
  // from any prop edge — comfortably past the 10-unit player radius so the
  // sprite never clips into a wall and never spawns sitting on a creak tile
  // or panic-emitting prop. Includes non-solid fear (dolls, bloodstain) and
  // hazards (creak tiles) — neither blocks movement, but spawning on top of
  // either would immediately tick panic.
  const PLAYER_PAD = 20;
  const playerBlockers: RectLike[] = [...blockers, ...fearObjects, ...hazards];
  const startMinExitDist = 360;
  const losMap = { rooms, obstacles, containers, fearObjects } as BasementMap;

  const findSpawn = (
    minStalkerDist: number,
    minExitDist: number,
    requireLosBlocked: boolean,
  ): { x: number; y: number } | null => {
    for (let attempt = 0; attempt < 300; attempt++) {
      const r = rng.pick(mainRooms);
      const x = r.x + rng.range(40, r.w - 40);
      const y = r.y + rng.range(40, r.h - 40);
      if (pointInObstacle(x, y, playerBlockers, PLAYER_PAD)) continue;
      let ok = true;
      for (const e of exits) {
        if (Math.hypot(e.x - x, e.y - y) < minExitDist) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      let okStalkers = true;
      for (const ss of stalkerSpawns) {
        if (Math.hypot(ss.x - x, ss.y - y) < minStalkerDist) {
          okStalkers = false;
          break;
        }
        if (requireLosBlocked && hasLineOfSight(losMap, ss.x, ss.y, x, y)) {
          okStalkers = false;
          break;
        }
      }
      if (!okStalkers) continue;
      return { x, y };
    }
    return null;
  };

  let startX = 0;
  let startY = 0;
  // Progressive relaxation: in tight single-room layouts the strict constraints
  // can't all be met, so we step down. The stalker's vision range is 120, so
  // even the loosest stage (140) keeps the player just outside detection range.
  const found =
    findSpawn(280, startMinExitDist, true) ??
    findSpawn(280, startMinExitDist, false) ??
    findSpawn(220, 280, false) ??
    findSpawn(160, 200, false);
  if (found) {
    startX = found.x;
    startY = found.y;
  } else {
    // Final fallback: pick the walkable cell that's farthest from the stalker
    // spawn — guarantees we don't start inside an obstacle, and stays as far
    // from the stalker as the geometry allows.
    let bestDist = -1;
    for (const r of mainRooms) {
      for (let yy = r.y + 30; yy < r.y + r.h - 30; yy += 16) {
        for (let xx = r.x + 30; xx < r.x + r.w - 30; xx += 16) {
          if (pointInObstacle(xx, yy, playerBlockers, PLAYER_PAD)) continue;
          // Prefer the cell whose closest stalker is farthest away
          let nearest = Infinity;
          for (const ss of stalkerSpawns) {
            const d = Math.hypot(ss.x - xx, ss.y - yy);
            if (d < nearest) nearest = d;
          }
          if (nearest === Infinity) nearest = 0;
          if (nearest > bestDist) {
            bestDist = nearest;
            startX = xx;
            startY = yy;
          }
        }
      }
    }
  }

  return {
    seed,
    depth,
    rooms,
    obstacles,
    containers,
    hazards,
    fearObjects,
    items,
    exits,
    stalkerPaths,
    startX,
    startY,
    worldW,
    worldH,
  };
}

function obstacleSize(kind: ObstacleKind, rng: Rng): { w: number; h: number } {
  switch (kind) {
    case 'box':
      return { w: rng.int(28, 50), h: rng.int(28, 50) };
    case 'crate':
      return { w: rng.int(40, 64), h: rng.int(40, 64) };
    case 'shelf':
      return rng.chance(0.5)
        ? { w: rng.int(90, 160), h: rng.int(20, 30) }
        : { w: rng.int(20, 30), h: rng.int(90, 160) };
    case 'pipe':
      return rng.chance(0.5)
        ? { w: rng.int(80, 220), h: 14 }
        : { w: 14, h: rng.int(80, 180) };
    case 'furniture':
      return { w: rng.int(60, 110), h: rng.int(46, 74) };
    case 'pillar':
      return { w: rng.int(28, 36), h: rng.int(28, 36) };
  }
}

function inRoom(o: { x: number; y: number; w: number; h: number }, r: Room): boolean {
  return o.x >= r.x && o.y >= r.y && o.x + o.w <= r.x + r.w && o.y + o.h <= r.y + r.h;
}

type RectLike = { x: number; y: number; w: number; h: number };

function containerOverlap(c: RectLike, list: ContainerSpec[], pad: number): boolean {
  for (const o of list) {
    if (
      c.x < o.x + o.w + pad &&
      c.x + c.w + pad > o.x &&
      c.y < o.y + o.h + pad &&
      c.y + c.h + pad > o.y
    ) {
      return true;
    }
  }
  return false;
}

function containerItemCount(kind: ContainerKind, rng: Rng): number {
  switch (kind) {
    case 'toolbox':
      return 1; // always 1 — quickest container, smallest reward
    case 'cabinet':
      return 1; // always 1 — same as a toolbox, just slower to crack
    case 'locker':
      return 1 + rng.int(0, 2); // 1-2 — slower hold-open, slightly better
    case 'safe':
      return 2 + rng.int(0, 2); // 2-3 — best loot, requires QTE or lockpick
  }
}

// Place a single container of the given kind into the room. Skips placement
// if no clear spot is found within 30 attempts. Safes prefer the active
// quest unique when one is set — otherwise they roll generics like everything
// else (still distinguished by larger item counts and the QTE).
function placeContainer(
  rng: Rng,
  r: Room,
  kind: ContainerKind,
  depth: number,
  obstacles: Obstacle[],
  containers: ContainerSpec[],
  rooms: Room[],
  exitFootprints: RectLike[],
  questUnique: ItemKind | null,
): void {
  const sz = containerSize(kind);
  let placed: { x: number; y: number; w: number; h: number } | null = null;
  for (let a = 0; a < 30; a++) {
    const x = r.x + rng.range(40, r.w - sz.w - 40);
    const y = r.y + rng.range(40, r.h - sz.h - 40);
    const candidate = { x, y, w: sz.w, h: sz.h };
    if (overlapsAny(candidate, obstacles, 22)) continue;
    if (containerOverlap(candidate, containers, 28)) continue;
    if (overlapsConnectorMouth(candidate, rooms, 30)) continue;
    if (overlapsAny(candidate, exitFootprints, 12)) continue;
    placed = candidate;
    break;
  }
  if (!placed) return;
  const itemCount = containerItemCount(kind, rng);
  const items: ItemKind[] = [];
  for (let j = 0; j < itemCount; j++) {
    if (kind === 'safe' && questUnique !== null && rng.chance(0.6)) {
      items.push(questUnique);
    } else {
      items.push(pickItemKind(rng, depth, questUnique));
    }
  }
  containers.push({ ...placed, kind, items });
}

function overlapsAny(
  c: RectLike,
  list: RectLike[],
  pad: number,
): boolean {
  for (const o of list) {
    if (
      c.x < o.x + o.w + pad &&
      c.x + c.w + pad > o.x &&
      c.y < o.y + o.h + pad &&
      c.y + c.h + pad > o.y
    ) {
      return true;
    }
  }
  return false;
}

function overlapsConnectorMouth(
  c: { x: number; y: number; w: number; h: number },
  rooms: Room[],
  pad: number,
): boolean {
  for (const r of rooms) {
    if (!r.isConnector) continue;
    if (
      c.x < r.x + r.w + pad &&
      c.x + c.w + pad > r.x &&
      c.y < r.y + r.h + pad &&
      c.y + c.h + pad > r.y
    ) {
      return true;
    }
  }
  return false;
}

function pointInObstacle(x: number, y: number, list: RectLike[], pad: number): boolean {
  for (const o of list) {
    if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) {
      return true;
    }
  }
  return false;
}

function tryPlace(
  rng: Rng,
  rooms: Room[],
  obstacles: RectLike[],
  others: { x: number; y: number }[],
  minSpacing: number,
  pad: number,
): { x: number; y: number } | null {
  for (let i = 0; i < 40; i++) {
    const r = rng.pick(rooms);
    const x = r.x + rng.range(40, r.w - 40);
    const y = r.y + rng.range(40, r.h - 40);
    if (pointInObstacle(x, y, obstacles, pad)) continue;
    let tooClose = false;
    for (const o of others) {
      if (Math.hypot(o.x - x, o.y - y) < minSpacing) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;
    return { x, y };
  }
  return null;
}

function pickItemKind(rng: Rng, depth: number, questUnique: ItemKind | null): ItemKind {
  // Unique "body" items are rare on shallow floors and increasingly common
  // deeper down — incentive to descend if you're missing one. Cap at ~40%.
  // Only the currently-quested unique can spawn; with no active quest, every
  // roll falls back to a generic item.
  if (questUnique !== null) {
    const uniqueRate = Math.min(0.4, 0.06 + depth * 0.06);
    if (rng.next() < uniqueRate) return questUnique;
  }
  return rng.pick(GENERIC_ITEMS);
}

export function isWalkable(map: BasementMap, x: number, y: number): boolean {
  for (const r of map.rooms) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true;
  }
  return false;
}

export function hasLineOfSight(
  map: BasementMap,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = ax + (bx - ax) * t;
    const y = ay + (by - ay) * t;
    if (!isWalkable(map, x, y)) return false;
    for (const o of map.obstacles) {
      if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) return false;
    }
    for (const c of map.containers) {
      if (x > c.x && x < c.x + c.w && y > c.y && y < c.y + c.h) return false;
    }
    for (const f of map.fearObjects) {
      if (!fearBlocks(f.kind)) continue;
      if (x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h) return false;
    }
  }
  return true;
}
