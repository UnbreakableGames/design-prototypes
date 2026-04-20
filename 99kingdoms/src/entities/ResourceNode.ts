export interface ResourceNode {
  id: number;
  kind: 'tree' | 'bush';
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

let nextId = 1;
export function nextResourceNodeId(): number {
  return nextId++;
}
