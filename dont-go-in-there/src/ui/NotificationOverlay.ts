import type { Game } from '../game/Game';
import { rect, text, W } from '../systems/Render';

const TOAST_W = 320;
const TOAST_H = 36;
const TOAST_GAP = 6;

// Color palette per kind. `quest` is the "you got a new thing to do" toast,
// `done` is "you finished it", `info` is everything else.
const KIND_FILL: Record<string, string> = {
  quest: '#1a1218',
  done: '#1a2418',
  info: '#15101a',
};
const KIND_STROKE: Record<string, string> = {
  quest: '#7a3030',
  done: '#5a7a4a',
  info: '#3a2c1a',
};
const KIND_PIP: Record<string, string> = {
  quest: '#ffd76a',
  done: '#9ed79a',
  info: '#c9b9a4',
};

export function renderNotifications(ctx: CanvasRenderingContext2D, game: Game): void {
  const list = game.notifications();
  if (list.length === 0) return;
  const now = performance.now();
  const x = W - TOAST_W - 12;
  let y = 12;
  for (const n of list) {
    const age = now - n.createdAt;
    const remaining = n.ttl - age;
    // Fade in the first 200ms, fade out the last 600ms.
    let alpha = 1;
    if (age < 200) alpha = age / 200;
    else if (remaining < 600) alpha = Math.max(0, remaining / 600);

    ctx.save();
    ctx.globalAlpha = alpha;
    rect(ctx, x, y, TOAST_W, TOAST_H, KIND_FILL[n.kind] ?? KIND_FILL.info, KIND_STROKE[n.kind] ?? KIND_STROKE.info);
    ctx.fillStyle = KIND_PIP[n.kind] ?? KIND_PIP.info;
    ctx.beginPath();
    ctx.arc(x + 12, y + TOAST_H / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, n.text, x + 24, y + 11, {
      size: 11,
      color: '#c9b9a4',
      font: "'Special Elite', monospace",
    });
    ctx.restore();

    y += TOAST_H + TOAST_GAP;
  }
}
