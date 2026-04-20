import type { Game } from './Game';

export interface Quest {
  id: string;
  title: string;
  goal: string;
  isComplete: (g: Game) => boolean;
}

// Linear onboarding arc that walks a new player through the core loop:
// chop coins → build → hire → rescue → survive a night.
export const QUESTS: Quest[] = [
  {
    id: 'coins',
    title: 'Earn some coins',
    goal: 'Chop a nearby tree: walk up to it and hold Space.',
    isComplete: (g) => g.stats.coinsCollected >= 3,
  },
  {
    id: 'build_gather',
    title: 'Activate the Gather Post',
    goal: 'Walk to the Gather Post ghost and hold Space to pay its build cost.',
    isComplete: (g) => g.stations.some((s) => s.kind === 'gather' && s.active),
  },
  {
    id: 'hire_gatherer',
    title: 'Hire a gatherer',
    goal: 'Stand at the BASE of the Gather Post and hold Space to hire a worker.',
    isComplete: (g) =>
      g.stations.some((s) => s.kind === 'gather' && s.active && s.recruitIds.length > 0),
  },
  {
    id: 'build_tower',
    title: 'Raise a Watchtower',
    goal: 'A tower ghost now appears. Walk up and hold Space to build it.',
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
    id: 'rescue_villager',
    title: 'Rescue a lost villager',
    goal: 'Venture outside the walls. Find a villager with a "?" over them and press Space.',
    isComplete: (g) => g.stats.rescued >= 1,
  },
  {
    id: 'upgrade_wall',
    title: 'Build a wall',
    goal: 'Walk to any wall ghost on the perimeter and hold Space to build it.',
    isComplete: (g) => g.stations.some((s) => s.kind === 'wall' && s.active),
  },
  {
    id: 'build_garrison',
    title: 'Raise a Garrison',
    goal: 'Walls need defenders. Walk to the Garrison ghost and hold Space to build it.',
    isComplete: (g) => g.stations.some((s) => s.kind === 'garrison' && s.active),
  },
  {
    id: 'staff_garrison',
    title: 'Post a guard on the wall',
    goal: 'Stand at the BASE of the Garrison and hold Space to hire a wall guard.',
    isComplete: (g) =>
      g.stations.some(
        (s) => s.kind === 'garrison' && s.active && s.recruitIds.length > 0,
      ),
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
