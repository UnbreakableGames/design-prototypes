import type { Game } from './Game';

export interface Quest {
  id: string;
  title: string;
  goal: string;
  isComplete: (g: Game) => boolean;
}

// Linear onboarding arc that walks a new player through the core loop.
// Defense-first sequencing: combat-ready before economy. The player
// chops natural trees (one-shot, no regrowth) for their early coin
// supply while they put up the watchtower, walls, barracks, and
// soldiers. The Forester's hut comes after the perimeter is up — it's
// the renewable economy unlock that lets the base sustain itself once
// the wilds start to thin.
//
//   coin → watchtower → archer → wall → barracks → wall soldier
//        → forester hut → forester hire → lantern (prep)
//        → rescue → night 1 → scout the wilds.
export const QUESTS: Quest[] = [
  {
    id: 'coins',
    title: 'Earn some coins',
    goal: 'Chop a nearby tree: walk up to it and hold Space.',
    isComplete: (g) => g.stats.coinsCollected >= 3,
  },
  {
    id: 'build_tower',
    title: 'Raise a Watchtower',
    goal: 'A tower ghost stands near the campfire. Walk up and hold Space to build it.',
    isComplete: (g) => g.stations.some((s) => s.kind === 'tower' && s.active),
  },
  {
    id: 'hire_archer',
    title: 'Hire an archer',
    goal: 'Stand at the BASE of the Watchtower and hold Space to hire an archer.',
    isComplete: (g) =>
      g.stations.some((s) => s.kind === 'tower' && s.active && s.recruitIds.length > 0),
  },
  {
    id: 'upgrade_wall',
    title: 'Build a wall',
    goal: 'Walk to any wall ghost on the perimeter and hold Space to build it.',
    isComplete: (g) => g.stations.some((s) => s.kind === 'wall' && s.active),
  },
  {
    id: 'build_garrison',
    title: 'Raise the Barracks',
    goal: 'Walls need defenders. Walk to the Barracks ghost and hold Space to build it.',
    isComplete: (g) => g.stations.some((s) => s.kind === 'garrison' && s.active),
  },
  {
    id: 'staff_garrison',
    title: 'Post a soldier on the wall',
    goal: 'Stand at the base of the Barracks and hold Space to hire a wall soldier.',
    isComplete: (g) =>
      g.stations.some(
        (s) => s.kind === 'garrison' && s.active && s.recruitIds.length > 0,
      ),
  },
  {
    id: 'build_gather',
    title: "Raise the Forester's hut",
    goal: "The wilds are thinning. Walk to the Forester's hut ghost and hold Space to build it — its worker plants fresh trees you can chop.",
    isComplete: (g) => g.stations.some((s) => s.kind === 'gather' && s.active),
  },
  {
    id: 'hire_gatherer',
    title: 'Hire a forester',
    goal: "Stand at the base of the Forester's hut and hold Space to hire a worker.",
    isComplete: (g) =>
      g.stations.some((s) => s.kind === 'gather' && s.active && s.recruitIds.length > 0),
  },
  {
    id: 'light_lantern',
    title: 'Light the lantern',
    goal: 'Stand at the campfire and hold Space (8c). The lantern weakens enemies near you while it burns.',
    isComplete: (g) => g.lanternTimeLeft > 0,
  },
  {
    id: 'rescue_villager',
    title: 'Rescue a lost villager',
    goal: 'Venture outside the walls. Find a villager with a "?" over them and press Space.',
    isComplete: (g) => g.stats.rescued >= 1,
  },
  {
    id: 'survive_night',
    title: 'Survive the first night',
    goal: 'Night is coming. Stand near your campfire and defend it until dawn.',
    isComplete: (g) => g.clock.night >= 2,
  },
  {
    id: 'explore_poi',
    title: 'Scout the wilds',
    goal: 'Push into the fog and discover a point of interest.',
    isComplete: (g) => g.pois.some((p) => p.discovered),
  },
];
