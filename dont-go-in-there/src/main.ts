import { Game } from './game/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');

const game = new Game(canvas);
(window as unknown as { __game: Game }).__game = game;

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  game.render(ctx!);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
