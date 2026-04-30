import type { Obstacle, ObstacleKind } from '../systems/Procgen';
import { rect } from '../systems/Render';

export function renderObstacle(ctx: CanvasRenderingContext2D, o: Obstacle): void {
  switch (o.kind) {
    case 'box':
      drawBox(ctx, o);
      break;
    case 'crate':
      drawCrate(ctx, o);
      break;
    case 'shelf':
      drawShelf(ctx, o);
      break;
    case 'pipe':
      drawPipe(ctx, o);
      break;
    case 'furniture':
      drawFurniture(ctx, o);
      break;
    case 'pillar':
      drawPillar(ctx, o);
      break;
  }
}

function drawBox(ctx: CanvasRenderingContext2D, o: Obstacle) {
  rect(ctx, o.x, o.y, o.w, o.h, '#5b4030', '#1a120a');
  rect(ctx, o.x + 2, o.y + 2, o.w - 4, o.h - 4, '#6e4c38', '#3a2a1c');
  // tape strip
  ctx.fillStyle = '#3a2a1c';
  ctx.fillRect(o.x + o.w / 2 - 2, o.y + 2, 4, o.h - 4);
}

function drawCrate(ctx: CanvasRenderingContext2D, o: Obstacle) {
  rect(ctx, o.x, o.y, o.w, o.h, '#3a2a1c', '#1a120a');
  rect(ctx, o.x + 2, o.y + 2, o.w - 4, o.h - 4, '#4a3522', '#1a120a');
  ctx.strokeStyle = '#1a120a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x + 4, o.y + 4);
  ctx.lineTo(o.x + o.w - 4, o.y + o.h - 4);
  ctx.moveTo(o.x + o.w - 4, o.y + 4);
  ctx.lineTo(o.x + 4, o.y + o.h - 4);
  ctx.stroke();
}

function drawShelf(ctx: CanvasRenderingContext2D, o: Obstacle) {
  rect(ctx, o.x, o.y, o.w, o.h, '#2e2620', '#0a0608');
  if (o.w >= o.h) {
    // horizontal: divider lines + small clutter on top
    const div = o.y + Math.floor(o.h / 2);
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(o.x + 1, div, o.w - 2, 1);
    // tiny boxes
    for (let bx = o.x + 4; bx < o.x + o.w - 8; bx += 12) {
      ctx.fillStyle = '#5b4030';
      ctx.fillRect(bx, o.y + 2, 8, Math.max(4, o.h / 2 - 4));
    }
  } else {
    const div = o.x + Math.floor(o.w / 2);
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(div, o.y + 1, 1, o.h - 2);
  }
}

function drawPipe(ctx: CanvasRenderingContext2D, o: Obstacle) {
  rect(ctx, o.x, o.y, o.w, o.h, '#3a3a3e', '#0a0608');
  // highlight strip
  ctx.fillStyle = '#5a5a60';
  if (o.w >= o.h) {
    ctx.fillRect(o.x + 2, o.y + 2, o.w - 4, 2);
    // joint caps
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(o.x, o.y - 2, 6, o.h + 4);
    ctx.fillRect(o.x + o.w - 6, o.y - 2, 6, o.h + 4);
  } else {
    ctx.fillRect(o.x + 2, o.y + 2, 2, o.h - 4);
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(o.x - 2, o.y, o.w + 4, 6);
    ctx.fillRect(o.x - 2, o.y + o.h - 6, o.w + 4, 6);
  }
}

function drawFurniture(ctx: CanvasRenderingContext2D, o: Obstacle) {
  // dusty couch / armchair silhouette
  rect(ctx, o.x, o.y, o.w, o.h, '#2a1c2a', '#0a0608');
  rect(ctx, o.x + 4, o.y + 4, o.w - 8, o.h - 16, '#3b2a44', '#1a1218');
  // legs / shadow strip
  ctx.fillStyle = '#0a0608';
  ctx.fillRect(o.x + 2, o.y + o.h - 4, 6, 4);
  ctx.fillRect(o.x + o.w - 8, o.y + o.h - 4, 6, 4);
  // dust sheet ripples
  ctx.strokeStyle = '#1a1218';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(o.x + 6, o.y + 10);
  ctx.lineTo(o.x + o.w - 6, o.y + 10);
  ctx.stroke();
}

function drawPillar(ctx: CanvasRenderingContext2D, o: Obstacle) {
  rect(ctx, o.x, o.y, o.w, o.h, '#2e2a2e', '#0a0608');
  rect(ctx, o.x + 3, o.y + 3, o.w - 6, o.h - 6, '#3a363a', '#1a1820');
  // crack
  ctx.strokeStyle = '#0a0608';
  ctx.beginPath();
  ctx.moveTo(o.x + o.w / 2, o.y + 4);
  ctx.lineTo(o.x + o.w / 2 - 2, o.y + o.h / 2);
  ctx.lineTo(o.x + o.w / 2 + 1, o.y + o.h - 6);
  ctx.stroke();
}

export function obstacleKindLabel(kind: ObstacleKind): string {
  return kind;
}
