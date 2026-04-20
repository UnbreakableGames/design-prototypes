import { ResourceNode, nextResourceNodeId } from '../entities/ResourceNode';
import { Rng, mulberry32 } from '../systems/Rng';

export type Decoration = { kind: 'rock'; x: number; y: number };

export class WorldMap {
  readonly width: number;
  readonly height: number;
  nodes: ResourceNode[];
  readonly decorations: Decoration[];

  constructor(width: number, height: number, rng?: Rng) {
    this.width = width;
    this.height = height;
    const r = rng ?? mulberry32(0xb00b5);
    const { nodes, decorations } = this.scatter(r);
    this.nodes = nodes;
    this.decorations = decorations;
  }

  removeNode(id: number) {
    const idx = this.nodes.findIndex((n) => n.id === id);
    if (idx >= 0) this.nodes.splice(idx, 1);
  }

  private scatter(rng: Rng): { nodes: ResourceNode[]; decorations: Decoration[] } {
    const nodes: ResourceNode[] = [];
    const decorations: Decoration[] = [];
    const safeRadius = 80;
    const cx = this.width / 2;
    const cy = this.height / 2;

    const tryPlace = (): { x: number; y: number } | null => {
      for (let i = 0; i < 20; i++) {
        const x = 20 + rng() * (this.width - 40);
        const y = 20 + rng() * (this.height - 40);
        if (Math.hypot(x - cx, y - cy) >= safeRadius) return { x, y };
      }
      return null;
    };

    const areaScale = (this.width * this.height) / (960 * 640);
    const treeCount = Math.round(40 * areaScale);
    const bushCount = Math.round(18 * areaScale);
    const rockCount = Math.round(10 * areaScale);

    for (let i = 0; i < treeCount; i++) {
      const p = tryPlace();
      if (!p) continue;
      nodes.push({
        id: nextResourceNodeId(),
        kind: 'tree',
        x: p.x,
        y: p.y,
        hp: 3,
        maxHp: 3,
      });
    }
    for (let i = 0; i < bushCount; i++) {
      const p = tryPlace();
      if (!p) continue;
      nodes.push({
        id: nextResourceNodeId(),
        kind: 'bush',
        x: p.x,
        y: p.y,
        hp: 2,
        maxHp: 2,
      });
    }
    for (let i = 0; i < rockCount; i++) {
      const p = tryPlace();
      if (!p) continue;
      decorations.push({ kind: 'rock', x: p.x, y: p.y });
    }

    return { nodes, decorations };
  }
}

