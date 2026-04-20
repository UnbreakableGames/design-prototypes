import { Game } from './game/Game';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');
if (!ctx) throw new Error('2D context unavailable');

let game = new Game(canvas);
exposeDebug(game);

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  if (game.wantsRestart) {
    game = new Game(canvas);
    exposeDebug(game);
  }
  game.render(ctx!);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function exposeDebug(g: Game) {
  const w = window as unknown as {
    __game: Game;
    autoplay: {
      start: () => void;
      stop: () => void;
      report: () => string;
      log: () => object[];
      trace: () => object[];
      flips: (windowSec?: number) => object[];
      pauses: () => object[];
      diagnose: () => object;
    };
  };
  w.__game = g;
  w.autoplay = {
    start: () => {
      (window as unknown as { __game: Game }).__game.autoplay.start();
      return;
    },
    stop: () => (window as unknown as { __game: Game }).__game.autoplay.stop(),
    report: () => (window as unknown as { __game: Game }).__game.autoplay.report(),
    log: () => (window as unknown as { __game: Game }).__game.autoplay.log,
    trace: () => (window as unknown as { __game: Game }).__game.autoplay.taskTrace,
    flips: (windowSec?: number) =>
      (window as unknown as { __game: Game }).__game.autoplay.flips(windowSec),
    pauses: () => (window as unknown as { __game: Game }).__game.autoplay.pauseEvents,
    diagnose: () => (window as unknown as { __game: Game }).__game.autoplay.diagnose(),
  };
}
