// Achievements modal — 760×600 parchment panel. Single flat list of rows,
// sorted unlocked-first (by earned date asc), then locked in authored
// order. Each row: 40px gold sigil on the left, title + description/hint
// in the middle, a 90px right-hand block carrying either the unlock date
// (mono) or a "— TO EARN —" small-caps label.
// Filled rows have a warm gold wash.

import { ACHIEVEMENTS } from '../game/Achievements';
import {
  Rect,
  drawModalPanel,
  drawSigil,
  drawCipherTitle,
  rectContains,
  wrapText,
  footerLine,
  drawSmallCapsRight,
  INK,
  INK_DIM,
  UI_FONTS,
} from './MenuUI';

export interface AchievementsState {
  unlocked: Record<string, number>;
  scroll: number;
}

export interface AchievementsLayout {
  closeBtn: Rect;
  scrollUpBtn: Rect | null;
  scrollDownBtn: Rect | null;
}

export function drawAchievementsModal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: AchievementsState,
  mouseX: number,
  mouseY: number,
): AchievementsLayout {
  const total = ACHIEVEMENTS.length;
  const unlockedCount = ACHIEVEMENTS.reduce(
    (n, a) => n + (state.unlocked[a.id] ? 1 : 0),
    0,
  );
  const { inner, close } = drawModalPanel(
    ctx,
    w,
    h,
    'Achievements',
    footerLine([
      { kbd: '\u2191' },
      '/',
      { kbd: '\u2193' },
      ' scroll  ',
      { kbd: 'Esc' },
      ' / ',
      { kbd: 'Space' },
      ' to close',
    ]),
    {
      eyebrow: 'The Chronicles',
      meta: { label: 'Earned', value: `${unlockedCount} / ${total}` },
      panelW: 760,
      panelH: 600,
    },
  );

  // Sort unlocked-first (by earned time), then locked in authored order.
  const sorted = [...ACHIEVEMENTS].sort((a, b) => {
    const ua = state.unlocked[a.id];
    const ub = state.unlocked[b.id];
    if (ua && ub) return ua - ub;
    if (ua && !ub) return -1;
    if (!ua && ub) return 1;
    return 0;
  });

  const rowH = 72;
  const listW = inner.w - 24;
  const listH = inner.h;
  const visibleCount = Math.max(1, Math.floor(listH / rowH));
  const maxScroll = Math.max(0, sorted.length - visibleCount);
  const scroll = Math.max(0, Math.min(maxScroll, state.scroll));

  ctx.save();
  ctx.beginPath();
  ctx.rect(inner.x, inner.y, listW, listH);
  ctx.clip();
  for (let i = 0; i < visibleCount + 1; i++) {
    const idx = scroll + i;
    if (idx >= sorted.length) break;
    const a = sorted[idx];
    const y = inner.y + i * rowH;
    if (y >= inner.y + listH) break;
    const unlockedAt = state.unlocked[a.id];
    drawAchievementRow(ctx, inner.x, y, listW, rowH, a.title, a.description, a.hint, unlockedAt);
  }
  ctx.restore();

  // Scroll arrows (when overflowing).
  let scrollUpBtn: Rect | null = null;
  let scrollDownBtn: Rect | null = null;
  if (maxScroll > 0) {
    const sbX = inner.x + inner.w - 26;
    scrollUpBtn = { x: sbX, y: inner.y + 4, w: 20, h: 20 };
    scrollDownBtn = { x: sbX, y: inner.y + inner.h - 24, w: 20, h: 20 };
    drawScrollArrow(ctx, scrollUpBtn, '\u25b2', rectContains(scrollUpBtn, mouseX, mouseY), scroll === 0);
    drawScrollArrow(ctx, scrollDownBtn, '\u25bc', rectContains(scrollDownBtn, mouseX, mouseY), scroll === maxScroll);
  }

  return { closeBtn: close, scrollUpBtn, scrollDownBtn };
}

function drawAchievementRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  description: string,
  hint: string,
  unlockedAt: number | undefined,
) {
  const unlocked = unlockedAt != null;
  ctx.save();
  // Row wash for unlocked.
  if (unlocked) {
    ctx.fillStyle = 'rgba(242,201,76,0.08)';
    ctx.fillRect(x, y, w, h);
  }
  // Dashed bottom divider.
  ctx.strokeStyle = 'rgba(232,226,212,0.14)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(x + 22, y + h - 0.5);
  ctx.lineTo(x + w - 22, y + h - 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sigil — 40px, vertically centred.
  drawSigil(ctx, x + 22 + 20, y + h / 2, 40, unlocked);

  // Title + body block.
  const textX = x + 22 + 40 + 14;
  const rightBlockW = 100;
  const bodyMaxW = w - (textX - x) - rightBlockW - 12;

  if (unlocked) {
    ctx.fillStyle = INK;
    ctx.font = `700 20px ${UI_FONTS.serif}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(title, textX, y + 14);
  } else {
    drawCipherTitle(ctx, title, textX, y + 14, 20);
  }

  // Description or hint.
  ctx.fillStyle = unlocked ? 'rgba(232,226,212,0.75)' : 'rgba(232,226,212,0.55)';
  ctx.font = unlocked
    ? `italic 500 14px ${UI_FONTS.serif}`
    : `500 12px ${UI_FONTS.ui}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  wrapText(ctx, unlocked ? description : hint, textX, y + 41, bodyMaxW, 16);

  // Right block: date or "— to earn —".
  const rightX = x + w - 14;
  if (unlocked) {
    const d = new Date(unlockedAt as number);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    ctx.fillStyle = INK_DIM;
    ctx.font = `500 11px ${UI_FONTS.mono}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(iso, rightX, y + h / 2);
  } else {
    ctx.fillStyle = 'rgba(232,226,212,0.35)';
    ctx.font = `600 9.5px ${UI_FONTS.ui}`;
    ctx.textBaseline = 'middle';
    drawSmallCapsRight(ctx, '\u2014 to earn \u2014', rightX, y + h / 2, 0.22);
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawScrollArrow(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  glyph: string,
  hover: boolean,
  dim: boolean,
) {
  ctx.save();
  ctx.fillStyle = hover ? 'rgba(255,245,220,0.7)' : 'rgba(255,245,220,0.5)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(232,226,212,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = dim ? 'rgba(232,226,212,0.25)' : 'rgba(232,226,212,0.6)';
  ctx.font = `500 9px ${UI_FONTS.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, r.x + r.w / 2, r.y + r.h / 2 + 1);
  ctx.restore();
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export interface AchievementsAction {
  kind: 'scroll' | 'close';
  scrollDelta?: number;
}

export function hitTestAchievements(
  layout: AchievementsLayout,
  x: number,
  y: number,
): AchievementsAction | null {
  if (rectContains(layout.closeBtn, x, y)) return { kind: 'close' };
  if (layout.scrollUpBtn && rectContains(layout.scrollUpBtn, x, y)) {
    return { kind: 'scroll', scrollDelta: -1 };
  }
  if (layout.scrollDownBtn && rectContains(layout.scrollDownBtn, x, y)) {
    return { kind: 'scroll', scrollDelta: 1 };
  }
  return null;
}
