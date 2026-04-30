import { Input } from '../systems/Input';
import * as Persistence from '../systems/Persistence';
import { Bedroom } from '../scenes/Bedroom';
import { Basement } from '../scenes/Basement';
import type { Scene } from '../scenes/Scene';
import { freshSave, type Inventory, type ItemKind, type PartKey, type SaveState, emptyInventory } from '../types';

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
    this.persist();
  }

  loseCarried(): void {
    this.carried = emptyInventory();
  }

  spend(kind: ItemKind, n = 1): boolean {
    if (this.save.banked[kind] < n) return false;
    this.save.banked[kind] -= n;
    return true;
  }

  repair(part: PartKey): void {
    this.save.parts[part] = true;
    this.persist();
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
