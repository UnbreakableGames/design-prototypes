import {
  SLIME_VARIANTS,
  ALL_VARIANT_IDS,
  WORLD,
  INDEX_MILESTONES,
  levelMul,
} from '../game/types';
import type { SlimeVariantId, VariantState, MilestoneReward } from '../game/types';
import {
  closeBtnContains,
  drawCloseBtn,
  drawIconBtn,
  drawMiniSlime,
} from './HUD';

// Sits to the right of the dice (the old AutoRoll slot). AutoRoll moved
// down to a small badge tucked into the dice's bottom-left corner.
export const INDEX_BTN = { x: WORLD.width / 2 + 36 + 24, y: 14, w: 60, h: 78 };

export function indexBtnContains(px: number, py: number): boolean {
  const r = INDEX_BTN;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export const INDEX_PANEL = { x: 0, y: 0, w: WORLD.width, h: WORLD.height - WORLD.collectionPanelH };

export function indexOverlayContains(_px: number, py: number): boolean {
  return py >= 0 && py <= INDEX_PANEL.h;
}

export function indexCloseBtnContains(px: number, py: number): boolean {
  return closeBtnContains(INDEX_PANEL, px, py);
}

/** Number of milestones the player has actually crossed (cell-based, ignores
 *  what's "claimed" — that's tracked separately so future iterations can require
 *  a click-to-claim). */
export function reachedMilestoneCount(discovered: number): number {
  let n = 0;
  for (const m of INDEX_MILESTONES) if (discovered >= m.threshold) n++;
  return n;
}

export function nextMilestone(discovered: number) {
  return INDEX_MILESTONES.find((m) => discovered < m.threshold) ?? null;
}

/** Highest threshold the player has already claimed (0 if none). Used by the
 *  endless progress bar so each segment runs from the last claim to the
 *  next pending instead of from 0 to a static total. */
export function lastClaimedThreshold(claimed: Set<number>): number {
  let max = 0;
  for (const t of claimed) if (t > max) max = t;
  return max;
}

export function drawIndexButton(
  ctx: CanvasRenderingContext2D,
  hovered: boolean,
  open: boolean,
  time: number,
  unclaimedCount: number,
) {
  drawIconBtn(ctx, {
    rect: INDEX_BTN,
    iconId: 'collection',
    label: 'BAG O BEES',
    hovered,
    active: open,
    glowColor: '#7fe39d',
    time,
  });
  // Notification dot when there are unclaimed milestones (pulses to draw the eye).
  if (unclaimedCount > 0) {
    const r = INDEX_BTN;
    const cx = r.x + r.w - 6;
    const cy = r.y + 6;
    const pulse = 1 + 0.18 * Math.sin(time * 6);
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(cx, cy, 8 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(unclaimedCount), cx, cy + 0.5);
  }
}

function rewardLabel(r: MilestoneReward): string {
  switch (r.kind) {
    case 'gold':    return `+${r.amount} Pollen`;
    case 'gems':    return `+${r.amount} ${r.amount === 1 ? 'Gem' : 'Gems'}`;
    case 'essence': return `+${r.amount} Essence`;
    case 'luck':    return `+${r.amount} Luck`;
  }
}

// === Grid (scrollable) ===
// Wider, fewer cells per row + vertical scrolling so the Index uses less
// vertical real estate at a glance. 6 cols × N rows where N is computed from
// the actual variant count (so adding slimes auto-grows the scroll range).
const GRID_COLS = 6;
const CELL_W = 120;
const CELL_H = 110;
const CELL_GAP = 6;
const GRID_TOP = 102;
// Visible viewport: 3 rows × cell height ≈ 348px. The grid clips to this area.
const GRID_VIEWPORT_H = 348;
const GRID_LEFT = Math.round((WORLD.width - (GRID_COLS * CELL_W + (GRID_COLS - 1) * CELL_GAP)) / 2);
const GRID_TOTAL_H = (() => {
  const rows = Math.ceil(ALL_VARIANT_IDS.length / GRID_COLS);
  return rows * CELL_H + (rows - 1) * CELL_GAP;
})();

export function indexMaxScroll(): number {
  return Math.max(0, GRID_TOTAL_H - GRID_VIEWPORT_H);
}

function cellRect(i: number, scroll: number) {
  const col = i % GRID_COLS;
  const row = Math.floor(i / GRID_COLS);
  return {
    x: GRID_LEFT + col * (CELL_W + CELL_GAP),
    y: GRID_TOP + row * (CELL_H + CELL_GAP) - scroll,
    w: CELL_W,
    h: CELL_H,
  };
}

/** True if (px, py) is over the scrollable grid viewport. Used by the wheel
 *  handler so wheel events outside the Index don't move the scroll. */
export function indexGridViewportContains(px: number, py: number): boolean {
  return (
    px >= GRID_LEFT && px <= GRID_LEFT + GRID_COLS * (CELL_W + CELL_GAP) &&
    py >= GRID_TOP && py <= GRID_TOP + GRID_VIEWPORT_H
  );
}

// Milestone bar + claim button share a single row above the grid. The button
// is right-of the bar; clicking it claims the lowest pending threshold.
const BAR_Y = 74;
const BAR_H = 12;
const BAR_X = 60;
const BAR_W = 520;
const CLAIM_BTN = { x: BAR_X + BAR_W + 16, y: 66, w: 280, h: 28 };

/** Hit-test the claim button. Returns the lowest pending threshold (the one
 *  the button currently represents), or null if not pending. */
export function indexClaimBtnAt(
  px: number, py: number,
  pending: Set<number>,
): number | null {
  if (pending.size === 0) return null;
  const r = CLAIM_BTN;
  if (px < r.x || px > r.x + r.w || py < r.y || py > r.y + r.h) return null;
  return Math.min(...pending);
}

// Cell outline + locked-silhouette tag color per tier. Deliberately darker than
// the global RARITY_COLORS palette in types.ts so the cells read as containers
// (not the slime body itself).
const RARITY_COLORS: Record<string, string> = {
  common:       '#5d6f5d',
  uncommon:     '#3d7aa8',
  rare:         '#9050d8',
  epic:         '#d05098',
  legendary:    '#e8a020',
  mythic:       '#c83838',
  divine:       '#d8b860',
  prismatic:    '#5ab0c8',
  transcendent: '#7878c8',
  ethereal:     '#b878c8',
  secret:       '#303048',
  celestial:    '#d8c880',
  astral:       '#3868c8',
  nova:         '#c85838',
  solar:        '#d8a820',
  lunar:        '#a0a0b8',
  galactic:     '#683098',
  stellar:      '#c8c8c8',
};

export function drawIndexOverlay(
  ctx: CanvasRenderingContext2D,
  collection: Map<SlimeVariantId, VariantState>,
  claimed: Set<number>,
  pending: Set<number>,
  scroll: number,
  time: number,
  closeHovered: boolean,
  bagProgress: number,
) {
  // Dim backdrop
  ctx.fillStyle = 'rgba(8, 10, 14, 0.86)';
  ctx.fillRect(INDEX_PANEL.x, INDEX_PANEL.y, INDEX_PANEL.w, INDEX_PANEL.h);

  // Compressed header: title + discovery counter.
  const total = ALL_VARIANT_IDS.length;
  const discovered = collection.size;
  ctx.fillStyle = '#f0f4f8';
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('BAG O BEES', WORLD.width / 2, 16);

  // Sub-line: discovery count alongside the running bag progress.
  ctx.fillStyle = '#a8b4c0';
  ctx.font = '600 12px system-ui, sans-serif';
  const next = nextMilestone(bagProgress);
  const progressLabel = next
    ? `${discovered}/${total} bees  ·  Bag ${bagProgress} / ${next.threshold}`
    : `${discovered}/${total} bees  ·  Bag ${bagProgress}`;
  ctx.fillText(progressLabel, WORLD.width / 2, 30);

  // Milestone bar — segmented from current claimed milestone to next pending,
  // since the ladder is endless and there's no static "total" to scale to.
  {
    ctx.fillStyle = '#1a2030';
    ctx.fillRect(BAR_X, BAR_Y, BAR_W, BAR_H);
    // The bar represents progress toward the NEXT milestone, not the full
    // (endless) ladder. Reset baseline = the last claimed threshold.
    const prev = lastClaimedThreshold(claimed);
    const goal = next ? next.threshold : bagProgress;
    const span = Math.max(1, goal - prev);
    const frac = Math.min(1, (bagProgress - prev) / span);
    ctx.fillStyle = '#3a82c8';
    ctx.fillRect(BAR_X, BAR_Y, Math.round(BAR_W * frac), BAR_H);
    // Pending milestones glow on the bar's right tip.
    if (next && pending.has(next.threshold)) {
      const pulse = 1 + 0.25 * Math.sin(time * 6);
      ctx.fillStyle = '#ffd24a';
      ctx.fillRect(BAR_X + BAR_W - 1.5, BAR_Y - 4, 3, BAR_H + 8);
      ctx.fillStyle = `rgba(255, 210, 74, ${0.35 + 0.25 * pulse})`;
      ctx.fillRect(BAR_X + BAR_W - 3, BAR_Y - 6, 6, BAR_H + 12);
    }

    // Claim button slot — to the right of the bar. Shows the lowest pending
    // milestone when one exists, the next upcoming when not.
    const lowestPending = pending.size > 0 ? Math.min(...pending) : null;
    if (lowestPending !== null) {
      const m = INDEX_MILESTONES.find((x) => x.threshold === lowestPending);
      if (m) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 6);
        const r = CLAIM_BTN;
        ctx.fillStyle = `rgba(255, 210, 74, ${0.6 + 0.2 * pulse})`;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.strokeStyle = '#ffd24a';
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
        ctx.fillStyle = '#0c1018';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`CLAIM ${lowestPending}: ${rewardLabel(m.reward)}`, r.x + r.w / 2, r.y + r.h / 2);
      }
    } else if (next) {
      const r = CLAIM_BTN;
      ctx.fillStyle = 'rgba(80, 90, 110, 0.25)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#3a4252';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.fillStyle = '#cdd6e0';
      ctx.font = '600 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const remaining = next.threshold - bagProgress;
      ctx.fillText(`Next: ${rewardLabel(next.reward)} in ${remaining}`, r.x + r.w / 2, r.y + r.h / 2);
    } else {
      const r = CLAIM_BTN;
      ctx.fillStyle = 'rgba(127, 227, 157, 0.18)';
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#7fe39d';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      ctx.fillStyle = '#7fe39d';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BAG FULL', r.x + r.w / 2, r.y + r.h / 2);
    }
  }

  // Grid clip — only the viewport is visible; rows above/below are scrolled in.
  ctx.save();
  ctx.beginPath();
  ctx.rect(GRID_LEFT - 2, GRID_TOP, GRID_COLS * (CELL_W + CELL_GAP) - CELL_GAP + 4, GRID_VIEWPORT_H);
  ctx.clip();

  for (let i = 0; i < ALL_VARIANT_IDS.length; i++) {
    const id = ALL_VARIANT_IDS[i];
    const v = SLIME_VARIANTS[id];
    const state = collection.get(id);
    const owned = !!state && state.count > 0;
    const r = cellRect(i, scroll);
    // Skip rows fully outside the viewport — cheap perf win for big grids.
    if (r.y + r.h < GRID_TOP || r.y > GRID_TOP + GRID_VIEWPORT_H) continue;

    // Cell background
    ctx.fillStyle = owned ? '#1a2230' : '#10141c';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = RARITY_COLORS[v.rarity] ?? '#3a4252';
    ctx.lineWidth = owned ? 2 : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

    if (owned) {
      drawMiniSlime(ctx, r.x + r.w / 2, r.y + 26, v);
      // Name
      ctx.fillStyle = '#f0f4f8';
      ctx.font = '700 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(v.name, r.x + r.w / 2, r.y + 50);
      // Stats line: Lv X · ×N
      const lvl = state!.level;
      ctx.fillStyle = '#a8b4c0';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.fillText(`Lv ${lvl} · ×${state!.count}`, r.x + r.w / 2, r.y + 64);
      ctx.fillStyle = '#7fe39d';
      ctx.font = '500 9px system-ui, sans-serif';
      ctx.fillText(`pwr ×${levelMul(lvl).toFixed(2)}`, r.x + r.w / 2, r.y + 78);
      // Lifetime rolled across all tiers — invariant per variant.
      ctx.fillStyle = '#5a6878';
      ctx.font = '500 9px system-ui, sans-serif';
      ctx.fillText(`rolled ${state!.timesRolled}`, r.x + r.w / 2, r.y + 90);
    } else {
      // Silhouette: solid dark slime + "?"
      ctx.fillStyle = '#252b38';
      const cx = r.x + r.w / 2;
      const cy = r.y + 28;
      const rr = 14;
      ctx.beginPath();
      ctx.moveTo(cx - rr, cy + rr * 0.45);
      ctx.quadraticCurveTo(cx - rr, cy - rr * 0.95, cx, cy - rr * 0.95);
      ctx.quadraticCurveTo(cx + rr, cy - rr * 0.95, cx + rr, cy + rr * 0.45);
      ctx.lineTo(cx - rr, cy + rr * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#3a4252';
      ctx.font = '800 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', cx, cy);
      // Rarity tag at bottom (so players can plan)
      ctx.fillStyle = RARITY_COLORS[v.rarity] ?? '#5a6878';
      ctx.font = '700 9px system-ui, sans-serif';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(v.rarity.toUpperCase(), cx, r.y + r.h - 22);
      ctx.fillStyle = '#5a6878';
      ctx.font = '500 9px system-ui, sans-serif';
      ctx.fillText(`1-in-${v.rollN.toLocaleString()}`, cx, r.y + r.h - 8);
    }
  }

  ctx.restore(); // end clip

  // Scrollbar — vertical rail on the right edge of the grid viewport.
  const maxScroll = indexMaxScroll();
  if (maxScroll > 0) {
    const railX = GRID_LEFT + GRID_COLS * (CELL_W + CELL_GAP) - CELL_GAP + 4;
    const railW = 4;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(railX, GRID_TOP, railW, GRID_VIEWPORT_H);
    const thumbH = Math.max(28, (GRID_VIEWPORT_H / GRID_TOTAL_H) * GRID_VIEWPORT_H);
    const thumbY = GRID_TOP + (scroll / maxScroll) * (GRID_VIEWPORT_H - thumbH);
    ctx.fillStyle = '#5a6878';
    ctx.fillRect(railX, thumbY, railW, thumbH);
  }

  drawCloseBtn(ctx, INDEX_PANEL, closeHovered);
}
