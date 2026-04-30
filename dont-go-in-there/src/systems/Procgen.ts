import { Rng } from './Rng';
import { ALL_ITEMS, type ItemKind } from '../types';

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

export type ContainerKind = 'toolbox' | 'locker' | 'cabinet';

export type ContainerSpec = {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ContainerKind;
  items: ItemKind[];
};

export const CONTAINER_DURATION: Record<ContainerKind, number> = {
  toolbox: 1.8,
  locker: 3.2,
  cabinet: 2.4,
};

export function containerSize(kind: ContainerKind): { w: number; h: number } {
  switch (kind) {
    case 'toolbox':
      return { w: 42, h: 26 };
    case 'locker':
      return { w: 32, h: 60 };
    case 'cabinet':
      return { w: 68, h: 36 };
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
  items: ItemSpawn[];
  exits: Exit[];
  stalkerWaypoints: WaypointPath;
  startX: number;
  startY: number;
  worldW: number;
  worldH: number;
};

export function generate(seed: number, depth: number): BasementMap {
  const rng = new Rng(seed);

  // Few large rooms — 1 at depth 1, growing to 3 at deeper depths
  const numRooms = Math.min(3, 1 + Math.floor((depth - 1) / 2));

  const rooms: Room[] = [];
  let cursorX = 80;
  let maxBottom = 0;
  for (let i = 0; i < numRooms; i++) {
    const w = Math.round(rng.range(440, 600) / 32) * 32;
    const h = Math.round(rng.range(340, 460) / 32) * 32;
    const yJitter = i === 0 ? 0 : rng.int(-60, 100);
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
    const opening = Math.min(180, Math.max(80, shared - 60));
    const oy = sharedTop + (shared - opening) / 2 + rng.range(-20, 20);
    const cw = 120;
    rooms.push({
      id: 100 + i,
      x: a.x + a.w - 60,
      y: oy,
      w: cw,
      h: opening,
      isConnector: true,
    });
  }

  const worldW = cursorX + 80;
  const worldH = maxBottom + 80;

  // Obstacles — clutter inside main rooms
  const obstacles: Obstacle[] = [];
  for (const r of rooms) {
    if (r.isConnector) continue;
    const target = 6 + rng.int(0, 6);
    let attempts = 0;
    while (obstacles.filter((o) => inRoom(o, r)).length < target && attempts < 80) {
      attempts++;
      const kind = rng.pick<ObstacleKind>(['box', 'crate', 'shelf', 'pipe', 'furniture', 'pillar']);
      const sz = obstacleSize(kind, rng);
      const x = r.x + rng.range(28, r.w - sz.w - 28);
      const y = r.y + rng.range(28, r.h - sz.h - 28);
      const candidate = { x, y, w: sz.w, h: sz.h };
      if (overlapsAny(candidate, obstacles, 14)) continue;
      // keep connector mouths clear so rooms stay reachable
      if (overlapsConnectorMouth(candidate, rooms, 24)) continue;
      obstacles.push({ ...candidate, kind });
    }
  }

  // Containers — 1-2 per main room, placed so they don't block exits/connectors
  const mainRooms = rooms.filter((r) => !r.isConnector);
  const containers: ContainerSpec[] = [];
  for (const r of mainRooms) {
    const count = 1 + rng.int(0, 2);
    for (let i = 0; i < count; i++) {
      const kind = rng.pick<ContainerKind>(['toolbox', 'locker', 'cabinet']);
      const sz = containerSize(kind);
      let placed: { x: number; y: number; w: number; h: number } | null = null;
      for (let a = 0; a < 30; a++) {
        const x = r.x + rng.range(40, r.w - sz.w - 40);
        const y = r.y + rng.range(40, r.h - sz.h - 40);
        const candidate = { x, y, w: sz.w, h: sz.h };
        if (overlapsAny(candidate, obstacles, 22)) continue;
        if (containerOverlap(candidate, containers, 28)) continue;
        if (overlapsConnectorMouth(candidate, rooms, 30)) continue;
        placed = candidate;
        break;
      }
      if (placed) {
        const itemCount = containerItemCount(kind, rng);
        const items: ItemKind[] = [];
        for (let j = 0; j < itemCount; j++) items.push(pickItemKind(rng, depth));
        containers.push({ ...placed, kind, items });
      }
    }
  }

  // Combined blockers — both clutter and containers are walls and can't be
  // spawned-on by exits, items, hazards, or the player.
  const blockers: RectLike[] = [...obstacles, ...containers];

  // Exits: 2 + floor(depth/2), capped at 5; alternating up/down so we always
  // get at least one of each.
  const numExits = Math.min(5, 2 + Math.floor(depth / 2));
  const dirOrder: ('up' | 'down')[] = [];
  for (let i = 0; i < numExits; i++) dirOrder.push(i % 2 === 0 ? 'up' : 'down');
  const exits: Exit[] = [];
  // Try with comfortable spacing first; relax if room runs out.
  for (const dir of dirOrder) {
    let placed = tryPlace(rng, mainRooms, blockers, exits, 200, 28);
    if (!placed) placed = tryPlace(rng, mainRooms, blockers, exits, 140, 28);
    if (!placed) placed = tryPlace(rng, mainRooms, blockers, exits, 80, 28);
    if (placed) exits.push({ ...placed, dir });
  }

  // Items — 2-4 scattered, deeper-biased rarity
  const itemCount = 2 + rng.int(0, 3);
  const items: ItemSpawn[] = [];
  for (let i = 0; i < itemCount; i++) {
    const placed = tryPlace(rng, mainRooms, blockers, [], 0, 18);
    if (placed) items.push({ ...placed, kind: pickItemKind(rng, depth) });
  }

  // Hazards — 0-2 creaky tiles
  const hazardCount = rng.int(0, 3);
  const hazards: Hazard[] = [];
  for (let i = 0; i < hazardCount; i++) {
    const placed = tryPlace(rng, mainRooms, blockers, [], 0, 18);
    if (placed) hazards.push({ x: placed.x - 14, y: placed.y - 14, w: 28, h: 28, kind: 'creak' });
  }

  // Stalker patrol — a coherent tour through every main room in spatial order,
  // 1-2 waypoints per room, spaced apart so the path is legible.
  const stalkerWaypoints: WaypointPath = [];
  const sortedMain = [...mainRooms].sort((a, b) => a.x - b.x);
  for (const r of sortedMain) {
    const count = 1 + rng.int(0, 2);
    for (let i = 0; i < count; i++) {
      const placed = tryPlace(rng, [r], blockers, stalkerWaypoints, 100, 22);
      if (placed) stalkerWaypoints.push(placed);
    }
  }
  while (stalkerWaypoints.length < 2) {
    const placed = tryPlace(rng, mainRooms, blockers, stalkerWaypoints, 0, 22);
    if (placed) stalkerWaypoints.push(placed);
    else break;
  }

  // Player start: walkable, far from every exit, far from stalker first waypoint
  let startX = 0;
  let startY = 0;
  const startMinExitDist = 240;
  for (let attempt = 0; attempt < 200; attempt++) {
    const r = rng.pick(mainRooms);
    const x = r.x + rng.range(40, r.w - 40);
    const y = r.y + rng.range(40, r.h - 40);
    if (pointInObstacle(x, y, blockers, 14)) continue;
    let ok = true;
    for (const e of exits) {
      if (Math.hypot(e.x - x, e.y - y) < startMinExitDist) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (stalkerWaypoints.length > 0) {
      const wp = stalkerWaypoints[0]!;
      if (Math.hypot(wp.x - x, wp.y - y) < 180) continue;
    }
    startX = x;
    startY = y;
    break;
  }
  if (startX === 0 && startY === 0) {
    const r = mainRooms[0]!;
    startX = r.x + r.w / 2;
    startY = r.y + r.h / 2;
  }

  return {
    seed,
    depth,
    rooms,
    obstacles,
    containers,
    hazards,
    items,
    exits,
    stalkerWaypoints,
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
      return 1 + rng.int(0, 2); // 1-2
    case 'locker':
      return 2 + rng.int(0, 2); // 2-3
    case 'cabinet':
      return 1 + rng.int(0, 2); // 1-2
  }
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

function pickItemKind(rng: Rng, depth: number): ItemKind {
  const bias = Math.min(0.45, 0.1 * depth);
  const idx =
    rng.next() < bias
      ? Math.min(ALL_ITEMS.length - 1, ALL_ITEMS.length - 1 - rng.int(0, 2))
      : rng.int(0, ALL_ITEMS.length);
  return ALL_ITEMS[idx]!;
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
  }
  return true;
}
