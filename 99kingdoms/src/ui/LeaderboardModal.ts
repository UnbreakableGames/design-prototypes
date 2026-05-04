// Leaderboard modal — matches the Claude Design "Menu Screens" handoff.
// Tabs are underline-styled (no pill chrome); rows are a 5-column grid
// with zero-padded ranks, italic-serif player names, and a YOU pill for
// the current player's rows (highlighted with a gold wash + left rule).
//
// Four states: populated, loading, empty, offline. Each draws its own
// body content inside the panel's inner rect.

import { ScoreRow } from '../game/Leaderboard';
import { modifierById, ModifierId } from '../game/Modifiers';
import {
  Rect,
  drawModalPanel,
  rectContains,
  footerLine,
  drawSmallCapsLeft,
  drawSmallCapsCentered,
  INK,
  INK_DIM,
  INK_FAINT,
  PAPER_RULE,
  PAPER_RULE_STRONG,
  GOLD_D,
  UI_FONTS,
} from './MenuUI';

export type LeaderboardTab = 'today' | 'all' | 'clean';
export const LEADERBOARD_TABS: LeaderboardTab[] = ['today', 'all', 'clean'];

export interface LeaderboardState {
  tab: LeaderboardTab;
  rows: Record<LeaderboardTab, ScoreRow[] | undefined>;
  ownIds: Set<number>;
  seedLabel: string;
  enabled: boolean;
}

export interface LeaderboardLayout {
  tabRects: Rect[];
  closeBtn: Rect;
}

const TAB_LABELS: Record<LeaderboardTab, string> = {
  today: 'Today',
  all: 'All-time',
  clean: 'Clean runs',
};

export function drawLeaderboardModal(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: LeaderboardState,
  mouseX: number,
  mouseY: number,
): LeaderboardLayout {
  const { inner, close } = drawModalPanel(
    ctx,
    w,
    h,
    'Leaderboard',
    footerLine([
      'Click a tab to switch  ',
      { kbd: 'Esc' },
      ' / ',
      { kbd: 'Space' },
      ' to close',
    ]),
    {
      eyebrow: 'The Chronicles',
      meta: { label: "Today's seed", value: state.seedLabel },
      panelW: 760,
      panelH: 560,
    },
  );

  // Tab strip: 42px tall, 1px bottom border, flush with inner.x.
  const tabsY = inner.y;
  const tabsH = 42;
  const tabRects = drawUnderlineTabs(
    ctx,
    inner.x + 24,
    tabsY,
    inner.w - 48,
    tabsH,
    LEADERBOARD_TABS.map((t) => ({
      label: TAB_LABELS[t],
      count: tabCount(state, t),
    })),
    LEADERBOARD_TABS.indexOf(state.tab),
    mouseX,
    mouseY,
  );
  // Bottom rule of the tab strip.
  ctx.strokeStyle = PAPER_RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(inner.x, tabsY + tabsH);
  ctx.lineTo(inner.x + inner.w, tabsY + tabsH);
  ctx.stroke();

  const bodyTop = tabsY + tabsH;
  const bodyH = inner.h - tabsH;

  if (!state.enabled) {
    drawOfflineState(ctx, inner.x, bodyTop, inner.w, bodyH);
    return { tabRects, closeBtn: close };
  }
  const rows = state.rows[state.tab];
  if (rows === undefined) {
    drawLoadingState(ctx, inner.x, bodyTop, inner.w, bodyH);
    return { tabRects, closeBtn: close };
  }
  if (rows.length === 0) {
    drawEmptyState(ctx, inner.x, bodyTop, inner.w, bodyH);
    return { tabRects, closeBtn: close };
  }

  drawHeaderRow(ctx, inner.x, bodyTop, inner.w);
  drawRows(ctx, inner.x, bodyTop + 34, inner.w, bodyH - 34, rows, state.ownIds);
  return { tabRects, closeBtn: close };
}

function tabCount(state: LeaderboardState, tab: LeaderboardTab): string | undefined {
  const rows = state.rows[tab];
  if (rows === undefined) return undefined;
  return tab === 'all' ? String(rows.length || 0) : String(rows.length);
}

// ── Underline tabs ────────────────────────────────────────────────────

function drawUnderlineTabs(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  _w: number,
  h: number,
  tabs: { label: string; count?: string }[],
  activeIdx: number,
  mouseX: number,
  mouseY: number,
): Rect[] {
  const rects: Rect[] = [];
  let cx = x;
  const gap = 6;
  ctx.save();
  ctx.textBaseline = 'middle';
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    const active = i === activeIdx;
    // Measure.
    ctx.font = `700 11px ${UI_FONTS.ui}`;
    const labelW = measureSmallCaps(ctx, tab.label, 0.18);
    const countW = tab.count
      ? (() => {
          ctx.font = `400 9px ${UI_FONTS.mono}`;
          return ctx.measureText(tab.count).width + 6;
        })()
      : 0;
    const totalW = labelW + countW + 24;
    const tr: Rect = { x: cx, y, w: totalW, h };
    const hover = rectContains(tr, mouseX, mouseY);
    // Text.
    ctx.fillStyle = active
      ? INK
      : hover
        ? 'rgba(232,226,212,0.75)'
        : 'rgba(232,226,212,0.55)';
    ctx.font = `700 11px ${UI_FONTS.ui}`;
    drawSmallCapsLeft(ctx, tab.label, cx + 12, y + h / 2, 0.18);
    if (tab.count) {
      ctx.font = `400 9px ${UI_FONTS.mono}`;
      ctx.fillStyle = active
        ? 'rgba(232,226,212,0.7)'
        : 'rgba(232,226,212,0.45)';
      ctx.fillText(tab.count, cx + 12 + labelW + 6, y + h / 2);
    }
    // Active underline: 2px ink bar flush with the tab strip's bottom rule.
    if (active) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + 6, y + h - 1);
      ctx.lineTo(cx + totalW - 6, y + h - 1);
      ctx.stroke();
    }
    rects.push(tr);
    cx += totalW + gap;
  }
  ctx.restore();
  return rects;
}

function measureSmallCaps(
  ctx: CanvasRenderingContext2D,
  text: string,
  tracking: number,
): number {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = c.letterSpacing;
  c.letterSpacing = `${tracking}em`;
  const tw = ctx.measureText(text.toUpperCase()).width;
  c.letterSpacing = prev ?? '0px';
  return tw;
}

// ── Header / rows ─────────────────────────────────────────────────────

function columnLayout(x: number, w: number) {
  // Match the reference grid: 36 rank | 1fr player | 80 score | 58 nights | 1fr curses
  const left = x + 20;
  const rankW = 36;
  const scoreRight = x + w - 80 - 58 - Math.max(120, w * 0.25) - 20;
  // Simpler: allocate: rank(36) + gap(10) + player(flex) + score(80) + nights(58) + curses(flex).
  // Total flex share ≈ 2 units; curses gets the same as player.
  const rankX = left;
  const playerX = rankX + rankW + 10;
  const totalFixed = rankW + 10 + 80 + 58;
  const flex = Math.max(0, w - 40 - totalFixed);
  const playerW = flex * 0.55;
  const scoreRightEdge = playerX + playerW + 80;
  const nightsRightEdge = scoreRightEdge + 58;
  const cursesX = nightsRightEdge + 16;
  void scoreRight;
  return { rankX, playerX, playerW, scoreRightEdge, nightsRightEdge, cursesX };
}

function drawHeaderRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
) {
  const cols = columnLayout(x, w);
  ctx.save();
  ctx.fillStyle = 'rgba(232,226,212,0.5)';
  ctx.font = `600 9.5px ${UI_FONTS.ui}`;
  ctx.textBaseline = 'middle';
  drawSmallCapsLeft(ctx, '#', cols.rankX, y + 18, 0.22);
  drawSmallCapsLeft(ctx, 'Player', cols.playerX, y + 18, 0.22);
  // Right-align: use measure.
  ctx.textAlign = 'right';
  drawSmallCapsRight(ctx, 'Score', cols.scoreRightEdge - 4, y + 18, 0.22);
  drawSmallCapsRight(ctx, 'Nights', cols.nightsRightEdge - 4, y + 18, 0.22);
  ctx.textAlign = 'left';
  drawSmallCapsLeft(ctx, 'Curses', cols.cursesX, y + 18, 0.22);
  // Bottom rule on the header.
  ctx.strokeStyle = PAPER_RULE_STRONG;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + 34);
  ctx.lineTo(x + w, y + 34);
  ctx.stroke();
  ctx.restore();
}

function drawSmallCapsRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
) {
  const upper = text.toUpperCase();
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = c.letterSpacing;
  c.letterSpacing = `${tracking}em`;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'right';
  ctx.fillText(upper, x, y);
  ctx.textAlign = prevAlign;
  c.letterSpacing = prev ?? '0px';
}

function drawRows(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  rows: ScoreRow[],
  ownIds: Set<number>,
) {
  const rowH = 36;
  const maxRows = Math.min(rows.length, Math.floor(h / rowH));
  const cols = columnLayout(x, w);
  ctx.save();
  // Clip to the visible area so overflow doesn't bleed into the footer.
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = 0; i < maxRows; i++) {
    const row = rows[i];
    const own = ownIds.has(row.id);
    const ry = y + i * rowH;

    // Gold wash + gold-d left rule for your own rows.
    if (own) {
      ctx.fillStyle = 'rgba(242,201,76,0.22)';
      ctx.fillRect(x, ry, w, rowH);
      ctx.fillStyle = GOLD_D;
      ctx.fillRect(x + 2, ry, 2, rowH);
    }

    // Rank: zero-padded mono, faint.
    ctx.fillStyle = own ? 'rgba(232,226,212,0.65)' : 'rgba(232,226,212,0.5)';
    ctx.font = `500 13px ${UI_FONTS.mono}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(String(i + 1).padStart(2, '0'), cols.rankX, ry + rowH / 2 + 1);

    // Player: italic serif, bigger. Clip long names.
    ctx.fillStyle = INK;
    ctx.font = `600 19px ${UI_FONTS.serif}`;
    const name = clip(ctx, row.name, cols.playerW - (own ? 48 : 0));
    ctx.fillText(name, cols.playerX, ry + rowH / 2 + 1);
    if (own) {
      // "YOU" pill after the name.
      const nameW = ctx.measureText(name).width;
      drawYouPill(ctx, cols.playerX + nameW + 8, ry + rowH / 2);
    }

    // Score: mono, right-aligned, bold.
    ctx.fillStyle = INK;
    ctx.font = `700 15px ${UI_FONTS.mono}`;
    ctx.textAlign = 'right';
    ctx.fillText(row.score.toLocaleString(), cols.scoreRightEdge - 4, ry + rowH / 2 + 1);

    // Nights: mono, right-aligned, faint.
    ctx.fillStyle = INK_DIM;
    ctx.font = `500 13px ${UI_FONTS.mono}`;
    ctx.fillText(String(row.nights), cols.nightsRightEdge - 4, ry + rowH / 2 + 1);

    // Curses: mono, left-aligned, dim.
    ctx.fillStyle = 'rgba(232,226,212,0.55)';
    ctx.font = `500 11px ${UI_FONTS.mono}`;
    ctx.textAlign = 'left';
    const curses = row.modifiers.length
      ? row.modifiers.slice(0, 4).map((id) => abbrev(id as ModifierId)).join(' \u00b7 ')
      : '\u2014';
    ctx.fillText(curses, cols.cursesX, ry + rowH / 2 + 1);

    // Dashed row divider.
    ctx.save();
    ctx.strokeStyle = 'rgba(232,226,212,0.14)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.moveTo(x + 12, ry + rowH - 0.5);
    ctx.lineTo(x + w - 12, ry + rowH - 0.5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawYouPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  yMid: number,
) {
  const label = 'YOU';
  ctx.save();
  ctx.font = `700 10px ${UI_FONTS.ui}`;
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  c.letterSpacing = '0.2em';
  const tw = ctx.measureText(label).width;
  const padX = 6;
  const padY = 2;
  const w = Math.ceil(tw) + padX * 2;
  const h = 14;
  const y = yMid - h / 2;
  // Transparent fill, gold-d text only — a flat label, no chip.
  ctx.fillStyle = GOLD_D;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + padX, yMid + 1);
  c.letterSpacing = '0px';
  void padY;
  void w;
  void h;
  void y;
  ctx.restore();
}

function clip(ctx: CanvasRenderingContext2D, s: string, maxW: number): string {
  if (ctx.measureText(s).width <= maxW) return s;
  let out = s;
  while (out.length > 2 && ctx.measureText(out + '\u2026').width > maxW) {
    out = out.slice(0, -1);
  }
  return out + '\u2026';
}

function abbrev(id: ModifierId): string {
  const m = modifierById(id);
  if (!m) return id;
  const parts = m.label.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.map((p) => p[0] ?? '').join('').slice(0, 3).toUpperCase();
}

// ── Non-populated states ───────────────────────────────────────────────

function drawLoadingState(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  // Flickering dashed ring.
  ctx.strokeStyle = 'rgba(232,226,212,0.25)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 12, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = GOLD_D;
  ctx.lineWidth = 2;
  ctx.setLineDash([30, 80]);
  ctx.beginPath();
  ctx.arc(cx, cy - 12, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  ctx.font = `italic 600 20px ${UI_FONTS.serif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Reading the chronicles\u2026', cx, cy + 14);
  ctx.restore();
}

function drawEmptyState(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  // Dashed ring with a solid centre dot.
  ctx.strokeStyle = 'rgba(232,226,212,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(232,226,212,0.45)';
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 3, 0, Math.PI * 2);
  ctx.fill();
  // Text.
  ctx.fillStyle = INK;
  ctx.font = `italic 700 24px ${UI_FONTS.serif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('No entries yet.', cx, cy + 6);
  ctx.fillStyle = 'rgba(232,226,212,0.65)';
  ctx.font = `500 13px ${UI_FONTS.ui}`;
  ctx.fillText('Be the first to hold the campfire.', cx, cy + 38);
  ctx.restore();
}

function drawOfflineState(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  const cx = x + w / 2;
  const cy = y + h / 2;
  // X inside a dashed ring.
  ctx.strokeStyle = 'rgba(232,226,212,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 28);
  ctx.lineTo(cx + 10, cy - 8);
  ctx.moveTo(cx + 10, cy - 28);
  ctx.lineTo(cx - 10, cy - 8);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,226,212,0.3)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.arc(cx, cy - 18, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  ctx.font = `italic 700 22px ${UI_FONTS.serif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('The leaderboard is offline in this build.', cx, cy + 8);
  ctx.fillStyle = 'rgba(232,226,212,0.6)';
  ctx.font = `500 12.5px ${UI_FONTS.ui}`;
  ctx.fillText('The chronicler cannot reach the archive.', cx, cy + 38);
  ctx.fillText('Credentials are missing from this prototype.', cx, cy + 58);
  ctx.restore();
}

// ── Hit-testing ────────────────────────────────────────────────────────

export interface LeaderboardAction {
  kind: 'switchTab' | 'close';
  tab?: LeaderboardTab;
}

export function hitTestLeaderboard(
  layout: LeaderboardLayout,
  x: number,
  y: number,
): LeaderboardAction | null {
  if (rectContains(layout.closeBtn, x, y)) return { kind: 'close' };
  for (let i = 0; i < layout.tabRects.length; i++) {
    if (rectContains(layout.tabRects[i], x, y)) {
      return { kind: 'switchTab', tab: LEADERBOARD_TABS[i] };
    }
  }
  return null;
}

// Silence unused imports the linter would warn about in strict mode.
void drawSmallCapsCentered;
void INK_FAINT;
