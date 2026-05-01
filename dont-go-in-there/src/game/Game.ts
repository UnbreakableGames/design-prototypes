import { Input } from '../systems/Input';
import * as Persistence from '../systems/Persistence';
import { Bedroom } from '../scenes/Bedroom';
import { Basement } from '../scenes/Basement';
import type { Scene } from '../scenes/Scene';
import {
  freshSave,
  isPartRepaired,
  PART_REQS,
  type Inventory,
  type ItemKind,
  type PartKey,
  type SaveState,
  emptyInventory,
} from '../types';

export type SceneName = 'bedroom' | 'basement';

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly input: Input;
  save: SaveState;
  carried: Inventory = emptyInventory();
  scene: Scene;
  sceneName: SceneName = 'bedroom';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.save = Persistence.load();
    this.scene = new Bedroom();
    this.scene.enter();

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
      const y = ((e.clientY - rect.top) * canvas.height) / rect.height;
      this.scene.onClick?.(x, y, this);
    });
  }

  update(dt: number): void {
    this.scene.update(dt, this.input, this);
    this.input.endFrame();
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.scene.render(ctx, this);
  }

  switchScene(name: SceneName): void {
    this.scene.exit();
    this.sceneName = name;
    this.scene = name === 'bedroom' ? new Bedroom() : new Basement();
    this.scene.enter();
  }

  bankCarried(): void {
    for (const k of Object.keys(this.carried) as ItemKind[]) {
      this.save.banked[k] += this.carried[k];
      this.carried[k] = 0;
    }
    // Successful escape — friend will have something to say next time.
    this.save.pendingReturn = true;
    this.persist();
  }

  markMet(): void {
    if (!this.save.metFriend) {
      this.save.metFriend = true;
      this.persist();
    }
  }

  ackReturn(): void {
    if (this.save.pendingReturn) {
      this.save.pendingReturn = false;
      this.persist();
    }
  }

  loseCarried(): void {
    this.carried = emptyInventory();
  }

  spend(kind: ItemKind, n = 1): boolean {
    if (this.save.banked[kind] < n) return false;
    this.save.banked[kind] -= n;
    return true;
  }

  // Install one item of `kind` toward `part`'s requirement. Returns true if
  // the install happened, false if the part is already at max for that kind
  // or there's nothing in the chest.
  installItem(part: PartKey, kind: ItemKind): boolean {
    const reqs = PART_REQS[part];
    const need = reqs[kind] ?? 0;
    if (need === 0) return false;
    const progress = this.save.partProgress[part];
    const have = progress[kind] ?? 0;
    if (have >= need) return false;
    if (this.save.banked[kind] < 1) return false;
    this.save.banked[kind] -= 1;
    progress[kind] = have + 1;
    this.persist();
    return true;
  }

  isPartRepaired(part: PartKey): boolean {
    return isPartRepaired(this.save.partProgress[part], PART_REQS[part]);
  }

  recordDepth(d: number): void {
    if (d > this.save.deepestReached) {
      this.save.deepestReached = d;
      this.persist();
    }
  }

  persist(): void {
    Persistence.save(this.save);
  }

  resetSave(): void {
    Persistence.clear();
    this.save = freshSave();
    this.carried = emptyInventory();
  }
}
