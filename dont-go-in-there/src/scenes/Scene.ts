import type { Game } from '../game/Game';
import type { Input } from '../systems/Input';

export interface Scene {
  enter(game: Game): void;
  exit(): void;
  update(dt: number, input: Input, game: Game): void;
  render(ctx: CanvasRenderingContext2D, game: Game): void;
  onClick?(x: number, y: number, game: Game): void;
}
