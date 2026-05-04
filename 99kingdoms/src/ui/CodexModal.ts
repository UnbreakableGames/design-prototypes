// Codex modal — 860×600 panel, split 220-left / rest-right.
// Left rail: four italic-serif category buttons, each with a mono count
// and a 2px progress rule; active category has a 3px ink bar to its left
// and a subtle wash. A quiet italic-serif quote sits at the bottom of
// the rail.
// Right: scrolling list of entry cards. Unlocked cards are warm-washed
// with solid rules; locked cards carry a pin-hole + star-silhouette
// title and a dashed rule top/bottom.

import {
  CODEX_ENTRIES,
  CodexCategory,
  CodexEntry,
  codexEntriesByCategory,
  codexTotalByCategory,
} from '../game/Narrative';
import {
  Rect,
  drawModalPanel,
  drawPinHole,
  drawCipherTitle,
  rectContains,
  wrapText,
  footerLine,
  INK,
  INK_DIM,
  PAPER_RULE,
  PAPER_HIGHLIGHT,
  PAPER_WASH,
  UI_FONTS,
} from './MenuUI';

export const CODEX_CATEGORIES: CodexCategory[] = ['diary', 'figure', 'portal', 'child'];
const CATEGORY_LABEL: Record<CodexCategory, string> = {
  diary: 'Diary',
  figure: 'Figures',
  portal: 'Portals',
  child: 'Lost children',
};

export interface CodexState {
  category: CodexCategory;
  unlocked: Record<string, number>;
  scroll: number;
}

export interface CodexLayout {
  categoryBtns: Array<{ category: CodexCategory; rect: Rect }>;
  closeBtn: Rect;
  scrollUpBtn: Rect | null;
  scrollDownBtn: Rect | null;
}

export function drawCodexModal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: CodexState,
  mouseX: number,
  mouseY: number,
): CodexLayout {
  const totalUnlocked = Object.keys(state.unlocked).length;
  const { inner, close } = drawModalPanel(
    ctx,
    w,
    h,
    'Codex',
    footerLine([
      'Click a category  ',
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
      meta: { label: 'Found', value: `${totalUnlocked} / ${CODEX_ENTRIES.length}` },
      panelW: 860,
      panelH: 600,
    },
  );

  const leftW = 220;
  const left: Rect = { x: inner.x, y: inner.y, w: leftW, h: inner.h };
  const right: Rect = {
    x: inner.x + leftW,
    y: inner.y,
    w: inner.w - leftW,
    h: inner.h,
  };

  // Vertical divider between rail and entries.
  ctx.strokeStyle = PAPER_RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(right.x, left.y);
  ctx.lineTo(right.x, left.y + left.h);
  ctx.stroke();

  // ── Left rail (category buttons + quote) ─────────────────────────
  const totals = codexTotalByCategory();
  const categoryBtns: Array<{ category: CodexCategory; rect: Rect }> = [];
  const btnH = 58;
  let cy = left.y + 14;
  for (const cat of CODEX_CATEGORIES) {
    const rect: Rect = { x: left.x, y: cy, w: left.w, h: btnH };
    const hover = rectContains(rect, mouseX, mouseY);
    const active = cat === state.category;
    drawCategoryRow(
      ctx,
      rect,
      CATEGORY_LABEL[cat],
      countUnlockedInCategory(cat, state.unlocked),
      totals[cat],
      active,
      hover,
    );
    categoryBtns.push({ category: cat, rect });
    cy += btnH;
  }
  // Flavour quote at bottom of rail.
  ctx.save();
  ctx.fillStyle = 'rgba(232,226,212,0.55)';
  ctx.font = `italic 500 11px ${UI_FONTS.serif}`;
  ctx.textBaseline = 'top';
  wrapText(
    ctx,
    '\u201cA chronicle in ten nights, bound in what we could recover.\u201d',
    left.x + 14,
    left.y + left.h - 52,
    left.w - 28,
    14,
  );
  ctx.restore();

  // ── Right side: scrolling entry list ─────────────────────────────
  const entries = codexEntriesByCategory(state.category);
  const padX = 22;
  const listX = right.x + padX;
  const listY = right.y + 14;
  const listW = right.w - padX * 2 - 24; // room for scroll arrows
  const listH = right.h - 28;

  // Pre-compute card heights (they vary by body length).
  ctx.save();
  ctx.font = `italic 500 15px ${UI_FONTS.serif}`;
  const cardHeights: number[] = entries.map((e) => measureCard(ctx, e, state, listW));
  ctx.restore();

  // Determine visible entries for the current scroll offset.
  const maxScroll = Math.max(0, entries.length - 1);
  const scroll = Math.max(0, Math.min(maxScroll, state.scroll));

  ctx.save();
  ctx.beginPath();
  ctx.rect(listX, listY, listW, listH);
  ctx.clip();
  let y = listY;
  for (let i = scroll; i < entries.length; i++) {
    const e = entries[i];
    const ch = cardHeights[i];
    if (y + ch > listY + listH) break;
    drawCodexCard(ctx, listX, y, listW, ch, e, state);
    y += ch + 8;
  }
  ctx.restore();

  // Scroll arrows in the right gutter (shown only when overflowing).
  let scrollUpBtn: Rect | null = null;
  let scrollDownBtn: Rect | null = null;
  const visibleCount = countVisible(cardHeights, scroll, listH);
  if (entries.length > visibleCount) {
    const sbX = right.x + right.w - 26;
    scrollUpBtn = { x: sbX, y: listY + 4, w: 20, h: 20 };
    scrollDownBtn = { x: sbX, y: listY + listH - 24, w: 20, h: 20 };
    drawScrollArrow(ctx, scrollUpBtn, '\u25b2', rectContains(scrollUpBtn, mouseX, mouseY), scroll === 0);
    drawScrollArrow(ctx, scrollDownBtn, '\u25bc', rectContains(scrollDownBtn, mouseX, mouseY), scroll + visibleCount >= entries.length);
  }

  return { categoryBtns, closeBtn: close, scrollUpBtn, scrollDownBtn };
}

function countVisible(heights: number[], scroll: number, listH: number): number {
  let total = 0;
  let n = 0;
  for (let i = scroll; i < heights.length; i++) {
    const h = heights[i] + 8;
    if (total + h > listH) break;
    total += h;
    n++;
  }
  return n || 1;
}

function countUnlockedInCategory(
  cat: CodexCategory,
  unlocked: Record<string, number>,
): number {
  let n = 0;
  for (const e of codexEntriesByCategory(cat)) {
    if (unlocked[e.id] != null) n++;
  }
  return n;
}

// ── Category row ──────────────────────────────────────────────────────

function drawCategoryRow(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  unlocked: number,
  total: number,
  active: boolean,
  hover: boolean,
) {
  ctx.save();
  if (active) {
    ctx.fillStyle = 'rgba(232,226,212,0.08)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // 3px ink left bar.
    ctx.fillStyle = INK;
    ctx.fillRect(r.x, r.y, 3, r.h);
  } else if (hover) {
    ctx.fillStyle = 'rgba(232,226,212,0.04)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // Italic serif label.
  ctx.fillStyle = active ? INK : 'rgba(232,226,212,0.75)';
  ctx.font = `italic 700 20px ${UI_FONTS.serif}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, r.x + 14, r.y + 14);

  // Mono count on the right, vertically aligned to label baseline.
  ctx.fillStyle = active ? INK : 'rgba(232,226,212,0.5)';
  ctx.font = `600 11px ${UI_FONTS.mono}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`${unlocked}/${total}`, r.x + r.w - 14, r.y + 18);

  // Progress rule (2px) — full width, ink track on pct.
  const barY = r.y + 42;
  const barX = r.x + 14;
  const barW = r.w - 28;
  ctx.fillStyle = 'rgba(232,226,212,0.12)';
  ctx.fillRect(barX, barY, barW, 2);
  const pct = total > 0 ? unlocked / total : 0;
  ctx.fillStyle = active ? INK : 'rgba(232,226,212,0.45)';
  ctx.fillRect(barX, barY, barW * pct, 2);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ── Entry cards ────────────────────────────────────────────────────────

function measureCard(
  ctx: CanvasRenderingContext2D,
  entry: CodexEntry,
  state: CodexState,
  cardW: number,
): number {
  const unlocked = state.unlocked[entry.id] != null;
  if (!unlocked) {
    // Pin-hole + star title (top) + italic hint line (body). Fixed height.
    return 60;
  }
  // Title (18px serif) + wrapped italic serif body at 15px / 22px line.
  ctx.save();
  ctx.font = `italic 500 15px ${UI_FONTS.serif}`;
  const bodyLines = countWrapLines(ctx, entry.body, cardW - 36);
  ctx.restore();
  return 20 /* title row */ + 8 /* gap */ + bodyLines * 22 + 24 /* paddings */;
}

function countWrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): number {
  const words = text.split(/\s+/);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines++;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines++;
  return lines;
}

function drawCodexCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  entry: CodexEntry,
  state: CodexState,
) {
  const unlocked = state.unlocked[entry.id] != null;
  ctx.save();
  if (unlocked) {
    // Warm paper wash, solid rules on top and bottom.
    ctx.fillStyle = PAPER_HIGHLIGHT;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PAPER_RULE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.5);
    ctx.lineTo(x + w, y + 0.5);
    ctx.moveTo(x, y + h - 0.5);
    ctx.lineTo(x + w, y + h - 0.5);
    ctx.stroke();
    // Subtle inset highlight on the top rule.
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.moveTo(x, y + 1.5);
    ctx.lineTo(x + w, y + 1.5);
    ctx.stroke();

    // Title.
    ctx.fillStyle = INK;
    ctx.font = `700 18px ${UI_FONTS.serif}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(entry.title, x + 18, y + 14);

    // Body — italic serif, 15/22.
    ctx.fillStyle = 'rgba(232,226,212,0.88)';
    ctx.font = `italic 500 15px ${UI_FONTS.serif}`;
    wrapText(ctx, entry.body, x + 18, y + 42, w - 36, 22);
  } else {
    // Locked card: dashed rules, darker wash.
    ctx.fillStyle = PAPER_WASH;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(232,226,212,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, y + 0.5);
    ctx.lineTo(x + w, y + 0.5);
    ctx.moveTo(x, y + h - 0.5);
    ctx.lineTo(x + w, y + h - 0.5);
    ctx.stroke();
    ctx.setLineDash([]);
    // Pin-hole + star silhouette of real title.
    drawPinHole(ctx, x + 22, y + 24, 12);
    drawCipherTitle(ctx, entry.title, x + 38, y + 14, 22);
    // Hint: italic UI, left-aligned under the star row.
    ctx.fillStyle = 'rgba(232,226,212,0.6)';
    ctx.font = `italic 500 11.5px ${UI_FONTS.ui}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(entry.unlockHint, x + 38, y + h - 22);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ── Scroll arrows ─────────────────────────────────────────────────────

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

// ── Hit-testing ────────────────────────────────────────────────────────

export interface CodexAction {
  kind: 'switchCategory' | 'scroll' | 'close';
  category?: CodexCategory;
  scrollDelta?: number;
}

export function hitTestCodex(
  layout: CodexLayout,
  x: number,
  y: number,
): CodexAction | null {
  if (rectContains(layout.closeBtn, x, y)) return { kind: 'close' };
  if (layout.scrollUpBtn && rectContains(layout.scrollUpBtn, x, y)) {
    return { kind: 'scroll', scrollDelta: -1 };
  }
  if (layout.scrollDownBtn && rectContains(layout.scrollDownBtn, x, y)) {
    return { kind: 'scroll', scrollDelta: 1 };
  }
  for (const b of layout.categoryBtns) {
    if (rectContains(b.rect, x, y)) {
      return { kind: 'switchCategory', category: b.category };
    }
  }
  return null;
}

void INK_DIM;
