import type { FearObject } from '../systems/Procgen';
import { rect } from '../systems/Render';

// Renders one fear object. The pulse value (0..1) drives subtle animation
// (furnace flicker, dripping blood, swaying dolls, hissing steam).
export function renderFearObject(ctx: CanvasRenderingContext2D, f: FearObject, pulse: number): void {
  switch (f.kind) {
    case 'furnace':
      drawFurnace(ctx, f.x, f.y, f.w, f.h, pulse);
      break;
    case 'dolls':
      drawDolls(ctx, f.x, f.y, f.w, f.h, pulse);
      break;
    case 'bloodstain':
      drawBloodstain(ctx, f.x, f.y, f.w, f.h);
      break;
    case 'steampipe':
      drawSteampipe(ctx, f.x, f.y, f.w, f.h, pulse);
      break;
  }
}

function drawFurnace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pulse: number) {
  // Heavy iron body
  rect(ctx, x, y, w, h, '#1a1418', '#0a0608');
  rect(ctx, x + 3, y + 3, w - 6, h - 6, '#2a2024', '#0a0608');
  // bolts
  ctx.fillStyle = '#3a2c1a';
  for (const [dx, dy] of [
    [6, 6],
    [w - 10, 6],
    [6, h - 10],
    [w - 10, h - 10],
  ]) {
    ctx.fillRect(x + dx, y + dy, 4, 4);
  }
  // chimney pipe at the top
  rect(ctx, x + w / 2 - 10, y - 14, 20, 14, '#2a2024', '#0a0608');
  rect(ctx, x + w / 2 - 12, y - 18, 24, 6, '#3a3a3e', '#0a0608');
  // grill door — flickering fire visible inside
  const doorX = x + 12;
  const doorY = y + h / 2 - 14;
  const doorW = w - 24;
  const doorH = 28;
  rect(ctx, doorX, doorY, doorW, doorH, '#0a0608', '#3a2820');
  // fire glow
  const flameAlpha = 0.6 + 0.3 * pulse;
  ctx.save();
  ctx.globalAlpha = flameAlpha;
  const grad = ctx.createLinearGradient(0, doorY, 0, doorY + doorH);
  grad.addColorStop(0, '#ffb84a');
  grad.addColorStop(0.6, '#d4622a');
  grad.addColorStop(1, '#7a1c20');
  ctx.fillStyle = grad;
  ctx.fillRect(doorX + 2, doorY + 2, doorW - 4, doorH - 4);
  ctx.restore();
  // grill bars
  ctx.fillStyle = '#0a0608';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(doorX + 2 + i * (doorW / 5), doorY + 2, 2, doorH - 4);
  }
  // handle
  ctx.fillStyle = '#c9a14a';
  ctx.fillRect(x + w - 18, y + h / 2 + 16, 6, 3);
}

function drawDolls(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, _h: number, pulse: number) {
  // Three dolls hanging by strings from above. Each sways slightly in opposite phases.
  const sway = Math.sin(pulse * Math.PI * 2) * 1.5;
  const dolls = [
    { dx: 4, dy: 0, phase: 0 },
    { dx: w / 2 - 4, dy: -4, phase: 1 },
    { dx: w - 12, dy: 2, phase: 0.5 },
  ];
  for (const d of dolls) {
    const localSway = sway * Math.cos(d.phase * Math.PI * 2);
    const cx = x + d.dx + 4 + localSway;
    const top = y + d.dy;
    // string
    ctx.strokeStyle = '#5a4836';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + d.dx + 4, y - 6);
    ctx.lineTo(cx, top + 4);
    ctx.stroke();
    // head
    ctx.fillStyle = '#d8c8a8';
    ctx.beginPath();
    ctx.arc(cx, top + 6, 4, 0, Math.PI * 2);
    ctx.fill();
    // hollow eyes (creepy)
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(cx - 2, top + 4, 1, 2);
    ctx.fillRect(cx + 1, top + 4, 1, 2);
    // x-stitch mouth
    ctx.strokeStyle = '#0a0608';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 1, top + 8);
    ctx.lineTo(cx + 1, top + 9);
    ctx.stroke();
    // body — dirty cloth
    ctx.fillStyle = '#5a4040';
    ctx.fillRect(cx - 4, top + 10, 8, 14);
    // arms / legs (loose threads)
    ctx.strokeStyle = '#3a2820';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 4, top + 14);
    ctx.lineTo(cx - 7, top + 18);
    ctx.moveTo(cx + 4, top + 14);
    ctx.lineTo(cx + 7, top + 18);
    ctx.moveTo(cx - 2, top + 24);
    ctx.lineTo(cx - 3, top + 30);
    ctx.moveTo(cx + 2, top + 24);
    ctx.lineTo(cx + 3, top + 30);
    ctx.stroke();
  }
}

function drawBloodstain(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Irregular dark splatter on the floor. Composite of overlapping ellipses.
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.save();
  ctx.fillStyle = '#5a0608';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.45, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a0608';
  ctx.beginPath();
  ctx.ellipse(cx - 6, cy + 2, w * 0.32, h * 0.38, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy - 4, w * 0.25, h * 0.3, -0.2, 0, Math.PI * 2);
  ctx.fill();
  // spatter dots
  ctx.fillStyle = '#3a0608';
  ctx.beginPath();
  ctx.arc(cx + w * 0.5, cy - h * 0.2, 2, 0, Math.PI * 2);
  ctx.arc(cx - w * 0.55, cy + h * 0.1, 1.5, 0, Math.PI * 2);
  ctx.arc(cx + w * 0.4, cy + h * 0.5, 2, 0, Math.PI * 2);
  ctx.arc(cx - w * 0.4, cy - h * 0.45, 1.5, 0, Math.PI * 2);
  ctx.fill();
  // central darker pool
  ctx.fillStyle = '#1a0608';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w * 0.18, h * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSteampipe(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pulse: number) {
  // Horizontal pipe with a jagged break in the middle, hissing steam.
  rect(ctx, x, y, w, h, '#3a3a3e', '#0a0608');
  ctx.fillStyle = '#5a5a60';
  ctx.fillRect(x + 2, y + 2, w - 4, 2);
  // joint caps
  ctx.fillStyle = '#2a2a2e';
  ctx.fillRect(x, y - 2, 6, h + 4);
  ctx.fillRect(x + w - 6, y - 2, 6, h + 4);
  // jagged break
  const breakX = x + w / 2;
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.moveTo(breakX - 6, y);
  ctx.lineTo(breakX - 2, y + 4);
  ctx.lineTo(breakX - 4, y + 9);
  ctx.lineTo(breakX, y + 14);
  ctx.lineTo(breakX + 2, y + 9);
  ctx.lineTo(breakX + 4, y + 4);
  ctx.lineTo(breakX + 6, y);
  ctx.lineTo(breakX + 8, y + h);
  ctx.lineTo(breakX - 8, y + h);
  ctx.closePath();
  ctx.fill();
  // exposed inner edges glowing slightly
  ctx.fillStyle = '#7a1c20';
  ctx.fillRect(breakX - 6, y + 2, 3, 4);
  ctx.fillRect(breakX + 3, y + 2, 3, 4);
  // hissing steam puff above the break (pulses)
  ctx.save();
  ctx.globalAlpha = 0.35 + 0.25 * Math.sin(pulse * Math.PI * 2);
  ctx.fillStyle = '#c9b9a4';
  ctx.beginPath();
  ctx.arc(breakX, y - 8, 7, 0, Math.PI * 2);
  ctx.arc(breakX - 6, y - 12, 5, 0, Math.PI * 2);
  ctx.arc(breakX + 6, y - 14, 6, 0, Math.PI * 2);
  ctx.arc(breakX, y - 18, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
