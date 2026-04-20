import { Resources } from '../game/Game';
import { Clock } from '../game/Clock';
import { Campfire } from '../entities/Campfire';
import { Recruit } from '../entities/Recruit';
import { Hero } from '../entities/Hero';
import { QUESTS } from '../game/Quests';

const UI_FONT = "'Inter Tight', system-ui, sans-serif";
const SERIF_FONT = "'Cormorant Garamond', 'Iowan Old Style', Georgia, serif";
const MONO_FONT = "'JetBrains Mono', ui-monospace, monospace";

const COLORS = {
  surface: 'rgba(12, 14, 22, 0.9)',
  surfaceDim: 'rgba(12, 14, 22, 0.55)',
  stroke: 'rgba(234, 223, 196, 0.12)',
  gold: '#f2c94c',
  goldDim: '#b88a20',
  cyan: '#4da6ff',
  orange: '#ff9a55',
  cream: '#eadfc4',
  creamDim: '#cfc7b1',
  ink: '#e7e3d6',
  inkDim: '#9a9589',
  inkFaint: '#585a6a',
  purple: '#6b5aa3',
  red: '#ff5a5a',
  green: '#7fc96b',
  hero: '#4da6ff',
  fire: '#ff9a55',
};

const HUD_LEFT = 24;
const HUD_TOP = 22;

// Dial geometry from the design spec (96×96, r = 42).
const DIAL_SIZE = 96;
const DIAL_R = 42;
const DIAL_CX = HUD_LEFT + DIAL_SIZE / 2;
const DIAL_CY = HUD_TOP + DIAL_SIZE / 2;
const STATS_X = HUD_LEFT + DIAL_SIZE + 12;
const STATS_TOP = HUD_TOP + 14;
const HP_BAR_W = 108;
const HP_BAR_H = 5;

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  resources: Resources,
  clock: Clock,
  campfire: Campfire,
  recruits: Recruit[],
  hero: Hero,
  seedLabel?: string,
) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  drawHudBackdrop(ctx, !!seedLabel);
  drawSigilDial(ctx, resources.coin, clock);
  drawStatsFan(ctx, hero, campfire, recruits);
  if (seedLabel) drawSeedLine(ctx, HUD_LEFT + 10, STATS_TOP + 72, seedLabel);

  drawNightWarning(ctx, clock);
  ctx.restore();
}

function drawHudBackdrop(ctx: CanvasRenderingContext2D, withSeed: boolean) {
  const padLeft = 14;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 18;
  const x = HUD_LEFT - padLeft;
  const y = HUD_TOP - padTop;
  const contentH = withSeed ? 88 : 72;
  const w = DIAL_SIZE + 12 + HP_BAR_W + padLeft + padRight;
  const h = contentH + padTop + padBottom;

  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(x, y, w, h);
  // Subtle cream left accent stripe, matching the other panels.
  ctx.fillStyle = 'rgba(234, 223, 196, 0.14)';
  ctx.fillRect(x, y, 2, h);
}

function drawSigilDial(
  ctx: CanvasRenderingContext2D,
  coin: number,
  clock: Clock,
) {
  const { color, label } = phaseStyle(clock);
  const progress = Math.max(0, Math.min(1, clock.progress()));

  // Track circle.
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(DIAL_CX, DIAL_CY, DIAL_R, 0, Math.PI * 2);
  ctx.stroke();

  // Phase-progress arc (starts at 12 o'clock, clockwise).
  if (progress > 0) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.arc(
      DIAL_CX,
      DIAL_CY,
      DIAL_R,
      -Math.PI / 2,
      -Math.PI / 2 + progress * Math.PI * 2,
    );
    ctx.stroke();
  }

  // Four quarter ticks cut through the arc at cardinals.
  ctx.strokeStyle = '#1b1d2c';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const x1 = DIAL_CX + Math.cos(a) * DIAL_R;
    const y1 = DIAL_CY + Math.sin(a) * DIAL_R;
    const x2 = DIAL_CX + Math.cos(a) * (DIAL_R - 8);
    const y2 = DIAL_CY + Math.sin(a) * (DIAL_R - 8);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Coin medallion (60×60 circle with radial gradient fill).
  const medR = 30;
  const medGrad = ctx.createRadialGradient(
    DIAL_CX - medR * 0.2,
    DIAL_CY - medR * 0.3,
    0,
    DIAL_CX,
    DIAL_CY,
    medR,
  );
  medGrad.addColorStop(0, '#2a2d42');
  medGrad.addColorStop(0.7, '#0e0f1a');
  medGrad.addColorStop(1, '#0e0f1a');
  ctx.fillStyle = medGrad;
  ctx.beginPath();
  ctx.arc(DIAL_CX, DIAL_CY, medR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(242, 201, 76, 0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Coin icon + count inside medallion, stacked.
  drawCoinIcon(ctx, DIAL_CX, DIAL_CY - 7, 7);
  ctx.fillStyle = COLORS.gold;
  ctx.font = `700 13px ${MONO_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(String(coin), DIAL_CX, DIAL_CY + 1);

  // Phase label straddles the top edge of the dial on a dark chip.
  ctx.font = `italic 700 11px ${SERIF_FONT}`;
  const labelW = ctx.measureText(label).width + 12;
  const labelH = 14;
  const labelX = DIAL_CX - labelW / 2;
  const labelY = HUD_TOP - 4;
  ctx.fillStyle = '#0e0f1a';
  ctx.fillRect(labelX, labelY, labelW, labelH);
  ctx.fillStyle = COLORS.cream;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, DIAL_CX, labelY + labelH / 2 + 1);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}

function drawStatsFan(
  ctx: CanvasRenderingContext2D,
  hero: Hero,
  campfire: Campfire,
  recruits: Recruit[],
) {
  let y = STATS_TOP;

  // Hero row: dot + "HERO" smallcaps + segmented HP.
  drawStatHeading(ctx, STATS_X, y, COLORS.hero, 'Hero', false);
  drawSegmentedBar(ctx, STATS_X, y + 5, HP_BAR_W, HP_BAR_H, hero.hp / hero.maxHp, COLORS.hero);
  y += 19;

  // Fire row: flickering dot + "FIRE" smallcaps + segmented HP.
  drawStatHeading(ctx, STATS_X, y, COLORS.fire, 'Fire', true);
  drawSegmentedBar(ctx, STATS_X, y + 5, HP_BAR_W, HP_BAR_H, campfire.hp / campfire.maxHp, COLORS.fire);
  y += 20;

  // Villagers row: dot + "VILLAGERS" smallcaps + count + "+N" lost.
  let rescued = 0;
  let wandering = 0;
  for (const r of recruits) {
    if (r.status === 'wandering') wandering++;
    else rescued++;
  }
  drawVillagersRow(ctx, STATS_X, y + 2, rescued, wandering);
}

function drawStatHeading(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tint: string,
  label: string,
  flicker: boolean,
) {
  // 7px dot in tint colour.
  const alpha = flicker
    ? 0.85 + 0.15 * Math.sin(performance.now() / 160)
    : 1;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = tint;
  ctx.beginPath();
  ctx.arc(x + 3.5, y + 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = COLORS.inkDim;
  ctx.font = `600 8px ${UI_FONT}`;
  ctx.textBaseline = 'middle';
  drawSmallCaps(ctx, label, x + 11, y + 2, 1.7);
}

function drawVillagersRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  count: number,
  lost: number,
) {
  const rowW = HP_BAR_W;

  // Dot + smallcaps label on the left.
  ctx.fillStyle = COLORS.cream;
  ctx.beginPath();
  ctx.arc(x + 3.5, y + 2, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLORS.inkDim;
  ctx.font = `600 8px ${UI_FONT}`;
  ctx.textBaseline = 'middle';
  drawSmallCaps(ctx, 'Villagers', x + 11, y + 2, 1.7);

  // Right-aligned count + lost count (mono).
  const rightX = x + rowW;
  ctx.textAlign = 'right';
  if (lost > 0) {
    ctx.fillStyle = COLORS.red;
    ctx.font = `700 8.5px ${MONO_FONT}`;
    ctx.fillText(`+${lost}`, rightX, y + 2);
    const lostW = ctx.measureText(`+${lost}`).width;
    ctx.fillStyle = COLORS.cream;
    ctx.font = `700 11px ${MONO_FONT}`;
    ctx.fillText(String(count), rightX - lostW - 4, y + 2);
  } else {
    ctx.fillStyle = COLORS.cream;
    ctx.font = `700 11px ${MONO_FONT}`;
    ctx.fillText(String(count), rightX, y + 2);
  }
  ctx.textAlign = 'left';
}

function drawSegmentedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  tint: string,
) {
  const segs = 10;
  const gap = 1.5;
  const segW = (w - gap * (segs - 1)) / segs;
  const filled = Math.round(Math.max(0, Math.min(1, pct)) * segs);
  for (let i = 0; i < segs; i++) {
    const sx = x + i * (segW + gap);
    if (i < filled) {
      ctx.fillStyle = tint;
      ctx.fillRect(sx, y, segW, h);
      ctx.shadowColor = tint;
      ctx.shadowBlur = 3;
      ctx.fillRect(sx, y, segW, h);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
      ctx.fillRect(sx, y, segW, h);
    }
  }
}

function drawSeedLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
) {
  ctx.fillStyle = COLORS.inkFaint;
  ctx.font = `500 8.5px ${MONO_FONT}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`SEED ${label.toUpperCase()}`, x, y);
}

function phaseStyle(clock: Clock): { color: string; label: string } {
  switch (clock.phase) {
    case 'day':
      return { color: COLORS.green, label: `Day ${clock.night}` };
    case 'night':
      return { color: COLORS.purple, label: `Night ${clock.night}` };
    case 'dawn':
      return { color: COLORS.orange, label: 'Dawn' };
  }
}

function drawNightWarning(ctx: CanvasRenderingContext2D, clock: Clock) {
  if (clock.phase === 'day') {
    const r = clock.remaining();
    if (r > 12) return;
    const alpha = Math.min(1, (12 - r) / 3);
    drawPhaseWarning(ctx, alpha, {
      headline: `Night ${clock.night} in`,
      countdown: `${Math.ceil(r)}s`,
      footer: 'Get to the fire.',
      topColor: `rgba(107, 90, 163, ${0.95 * alpha})`,
      bottomColor: `rgba(48, 30, 80, ${0.9 * alpha})`,
      accentStripe: `rgba(184, 138, 32, ${alpha})`,
      smallcapsColor: `rgba(242, 201, 76, ${alpha})`,
      countdownColor: `rgba(255, 224, 130, ${alpha})`,
      shadowColor: `rgba(255, 154, 85, ${0.6 * alpha})`,
      footerColor: `rgba(207, 199, 177, ${alpha})`,
      shakePx: 2,
    });
    return;
  }
  if (clock.phase === 'night') {
    const r = clock.remaining();
    if (r > 12) return;
    const alpha = Math.min(1, (12 - r) / 3);
    // Dawn coming — a warmer, calmer ceremony than the nightfall banner.
    // Gold/orange gradient, gentle breathing pulse instead of shaking.
    drawPhaseWarning(ctx, alpha, {
      headline: 'Dawn in',
      countdown: `${Math.ceil(r)}s`,
      footer: 'Hold the line.',
      topColor: `rgba(255, 154, 85, ${0.92 * alpha})`,
      bottomColor: `rgba(160, 70, 30, ${0.88 * alpha})`,
      accentStripe: `rgba(255, 224, 130, ${alpha})`,
      smallcapsColor: `rgba(255, 224, 130, ${alpha})`,
      countdownColor: `rgba(255, 244, 200, ${alpha})`,
      shadowColor: `rgba(255, 180, 100, ${0.7 * alpha})`,
      footerColor: `rgba(245, 235, 210, ${alpha})`,
      shakePx: 0,
      breathe: true,
    });
  }
}

interface PhaseWarningStyle {
  headline: string;
  countdown: string;
  footer: string;
  topColor: string;
  bottomColor: string;
  accentStripe: string;
  smallcapsColor: string;
  countdownColor: string;
  shadowColor: string;
  footerColor: string;
  shakePx: number;
  breathe?: boolean;
}

function drawPhaseWarning(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  style: PhaseWarningStyle,
) {
  ctx.save();
  const cx = ctx.canvas.width / 2;
  const panelW = 230;
  const panelH = 94;
  const panelY = 36;
  const panelX = cx - panelW / 2;

  if (style.shakePx > 0) {
    const shake = Math.sin(performance.now() / 40) * style.shakePx * alpha;
    ctx.translate(shake, 0);
  }
  if (style.breathe) {
    const s = 1 + Math.sin(performance.now() / 520) * 0.02 * alpha;
    ctx.translate(cx, panelY + panelH / 2);
    ctx.scale(s, s);
    ctx.translate(-cx, -(panelY + panelH / 2));
  }

  const grad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  grad.addColorStop(0, style.topColor);
  grad.addColorStop(1, style.bottomColor);
  ctx.fillStyle = grad;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.strokeStyle = `rgba(234, 223, 196, ${0.25 * alpha})`;
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

  ctx.fillStyle = style.accentStripe;
  ctx.fillRect(panelX, panelY + panelH - 2, panelW, 2);

  ctx.fillStyle = style.smallcapsColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `600 10px ${UI_FONT}`;
  drawSmallCaps(ctx, style.headline, cx, panelY + 10, 1.4);

  ctx.fillStyle = style.countdownColor;
  ctx.shadowColor = style.shadowColor;
  ctx.shadowBlur = 18;
  ctx.font = `italic 700 44px ${SERIF_FONT}`;
  ctx.fillText(style.countdown, cx, panelY + 26);
  ctx.shadowBlur = 0;

  ctx.fillStyle = style.footerColor;
  ctx.font = `500 10px ${UI_FONT}`;
  ctx.fillText(style.footer, cx, panelY + 76);

  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────────────────
// Quest panel

export function drawQuestPanel(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  questIndex: number,
  completeFlashTime: number,
) {
  const panelW = 308;
  const panelX = canvasW - panelW - 12;
  const panelY = 12;

  ctx.save();
  ctx.textBaseline = 'alphabetic';

  const flashing = completeFlashTime > 0;
  const done = questIndex >= QUESTS.length;
  const q = done ? null : QUESTS[questIndex];
  const panelH = done ? 52 : 76;

  ctx.fillStyle = COLORS.surface;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // Left stripe (flash gold on completion).
  ctx.fillStyle = flashing ? COLORS.gold : COLORS.cyan;
  ctx.fillRect(panelX, panelY, 3, panelH);

  if (flashing) {
    // Gold wash overlay easing out.
    const t = Math.min(1, completeFlashTime / 2.5);
    const alpha = 0.25 * t;
    const grad = ctx.createLinearGradient(panelX, panelY, panelX + panelW * 0.7, panelY);
    grad.addColorStop(0, `rgba(242, 201, 76, ${alpha})`);
    grad.addColorStop(1, 'rgba(242, 201, 76, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(panelX, panelY, panelW, panelH);
  }

  const padX = 14;
  ctx.textAlign = 'left';

  if (done) {
    ctx.fillStyle = flashing ? COLORS.gold : COLORS.inkDim;
    drawSmallCaps(ctx, 'Quest complete', panelX + padX, panelY + 16, 1.4);
    ctx.fillStyle = COLORS.gold;
    ctx.font = `italic 700 19px ${SERIF_FONT}`;
    ctx.fillText('Now survive 10 nights', panelX + padX, panelY + 38);
  } else if (q) {
    ctx.fillStyle = flashing ? COLORS.gold : COLORS.inkDim;
    drawSmallCaps(ctx, 'Quest', panelX + padX, panelY + 16, 1.4);

    ctx.fillStyle = flashing ? COLORS.gold : COLORS.inkDim;
    ctx.font = `500 9px ${MONO_FONT}`;
    ctx.fillText(`${questIndex + 1} / ${QUESTS.length}`, panelX + padX + 44, panelY + 16);

    ctx.fillStyle = COLORS.gold;
    ctx.font = `italic 700 19px ${SERIF_FONT}`;
    ctx.fillText(q.title, panelX + padX, panelY + 38);

    ctx.fillStyle = COLORS.creamDim;
    ctx.font = `500 10.5px ${UI_FONT}`;
    wrapText(ctx, q.goal, panelX + padX, panelY + 53, panelW - padX * 2, 13);
  }

  ctx.restore();
}

// Small visual helpers kept at module scope so renderers can share them.

function drawCoinIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, 0, cx, cy, r);
  grad.addColorStop(0, '#ffe082');
  grad.addColorStop(0.6, '#f2c94c');
  grad.addColorStop(1, '#b88a20');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(184, 138, 32, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawSmallCaps(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking = 1.2,
) {
  // Approximate small-caps by uppercasing the string and using the context's
  // letter-spacing so the font itself handles kerning and spaces correctly —
  // drawing each char individually produces uneven gaps.
  const upper = text.toUpperCase();
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = c.letterSpacing;
  c.letterSpacing = `${tracking}px`;
  ctx.fillText(upper, x, y);
  c.letterSpacing = prev ?? '0px';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
) {
  const words = text.split(/\s+/);
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lineH;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, cy);
}

// Centralised colour & font constants exposed for other renderers.
export const UI_COLORS = COLORS;
export const UI_FONTS = {
  ui: UI_FONT,
  serif: SERIF_FONT,
  mono: MONO_FONT,
};
export { drawSmallCaps, drawCoinIcon };
