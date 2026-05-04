// Pre-run curse picker — styled as a page from a dark grimoire.
// The panel uses the `grimoire` variant of `drawModalPanel` (deep
// blood-maroon page, scorched corners, blood-red title), and each row
// is a hand-inked entry with a hollow-circle sigil that fills with a
// pentagram when the player binds themselves to the curse. The
// multiplier badge is a dark blood-red wax seal. The "Begin the
// night" button is obsidian with a red border; cancel is a bare outline.

import { MODIFIERS, ModifierId, combinedScoreMultiplier } from '../game/Modifiers';
import {
  Rect,
  drawModalPanel,
  drawPillButton,
  drawPentagram,
  rectContains,
  footerLine,
  UI_FONTS,
} from './MenuUI';

export interface ModifierPickerAction {
  kind: 'toggle' | 'start' | 'cancel';
  modifierId?: ModifierId;
}

export interface ModifierPickerLayout {
  rows: Array<{ id: ModifierId; rect: Rect }>;
  startBtn: Rect;
  cancelBtn: Rect;
  closeBtn: Rect;
}

// ── Grimoire palette (kept local; not shared with the other modals) ─
const BONE = '#e8d8c8';
const BONE_DIM = 'rgba(232, 216, 200, 0.75)';
const BONE_FAINT = 'rgba(232, 216, 200, 0.45)';
const BLOOD = '#c13030';
const BLOOD_DEEP = '#6a0c18';
const BLOOD_SOFT = 'rgba(160, 20, 40, 0.55)';
// Brighter blood ink for *text* — `BLOOD` (#c13030) only hits ~2.8:1 on
// charcoal black, which fails WCAG AA. Use `BLOOD_INK` for any text fill.
const BLOOD_INK = '#ed5454';
const BLOOD_WASH = 'rgba(160, 20, 40, 0.18)';

export function drawModifierPicker(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  picked: Set<ModifierId>,
  mouseX: number,
  mouseY: number,
): ModifierPickerLayout {
  const { inner, close } = drawModalPanel(
    ctx,
    w,
    h,
    'Choose your curses.',
    footerLine([
      'Click a curse to bind it  ',
      { kbd: 'Space' },
      ' / ',
      { kbd: 'Enter' },
      ' begins  ',
      { kbd: 'Esc' },
      ' cancels',
    ]),
    {
      eyebrow: 'The grimoire',
      panelW: 760,
      panelH: 580,
      variant: 'grimoire',
    },
  );

  // Lead line — a whispered warning under the title.
  ctx.save();
  ctx.fillStyle = BONE_DIM;
  ctx.font = `italic 500 14px ${UI_FONTS.serif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    'Each curse feeds the dark \u2014 and pays in score.',
    inner.x + inner.w / 2,
    inner.y + 8,
  );
  ctx.restore();

  const rowsTop = inner.y + 34;
  const rowH = 40;
  const rowGap = 4;
  const listX = inner.x + 24;
  const listW = inner.w - 48;

  const rows: Array<{ id: ModifierId; rect: Rect }> = [];
  for (let i = 0; i < MODIFIERS.length; i++) {
    const m = MODIFIERS[i];
    const rx = listX;
    const ry = rowsTop + i * (rowH + rowGap);
    const rect: Rect = { x: rx, y: ry, w: listW, h: rowH };
    const hover = rectContains(rect, mouseX, mouseY);
    const on = picked.has(m.id);
    drawCurseRow(ctx, rect, m.label, m.description, m.scoreMultiplier, on, hover);
    rows.push({ id: m.id, rect });
  }

  // Summary line — running count + combined multiplier.
  const summaryY = rowsTop + MODIFIERS.length * (rowH + rowGap) + 4;
  const mult = combinedScoreMultiplier([...picked]);
  ctx.save();
  ctx.fillStyle = BONE_DIM;
  ctx.font = `500 12px ${UI_FONTS.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const summary =
    picked.size === 0
      ? 'No curses bound  \u00b7  score \u00d7 1.00'
      : `${picked.size} curse${picked.size === 1 ? '' : 's'}  \u00b7  score \u00d7 ${mult.toFixed(2)}`;
  ctx.fillText(summary, inner.x + inner.w / 2, summaryY);
  ctx.restore();

  // Bottom buttons.
  const cancelW = 180;
  const startW = 200;
  const btnH = 38;
  const gap = 14;
  const totalBtnsW = cancelW + gap + startW;
  const btnsLeft = inner.x + (inner.w - totalBtnsW) / 2;
  const btnY = inner.y + inner.h - btnH - 10;

  const cancelBtn = drawPillButton(
    ctx,
    btnsLeft,
    btnY,
    cancelW,
    btnH,
    'Close the book',
    {
      tone: 'grim-ghost',
      hover: rectContains(
        { x: btnsLeft, y: btnY, w: cancelW, h: btnH },
        mouseX,
        mouseY,
      ),
    },
  );
  const startX = btnsLeft + cancelW + gap;
  const startBtn = drawPillButton(ctx, startX, btnY, startW, btnH, 'Begin the night', {
    tone: 'grim-primary',
    active: true,
    hover: rectContains({ x: startX, y: btnY, w: startW, h: btnH }, mouseX, mouseY),
  });

  return { rows, startBtn, cancelBtn, closeBtn: close };
}

function drawCurseRow(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  label: string,
  description: string,
  scoreMult: number,
  on: boolean,
  hover: boolean,
) {
  ctx.save();
  // Background wash. Selected curses bleed blood-red from the left; hover
  // is a faint charcoal highlight; unselected rows are flat.
  if (on) {
    const wash = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y);
    wash.addColorStop(0, 'rgba(160, 20, 40, 0.42)');
    wash.addColorStop(0.35, BLOOD_WASH);
    wash.addColorStop(1, 'rgba(160, 20, 40, 0.02)');
    ctx.fillStyle = wash;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    // Blood-red accent bar on the left edge.
    ctx.fillStyle = BLOOD;
    ctx.fillRect(r.x, r.y, 2, r.h);
  } else if (hover) {
    ctx.fillStyle = 'rgba(232, 216, 200, 0.05)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  // Hairline divider below each row — blood-red when the row is bound,
  // bone-dim otherwise. Dashed to read as "torn through the page."
  ctx.strokeStyle = on ? BLOOD_SOFT : 'rgba(232, 216, 200, 0.08)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(r.x, r.y + r.h - 0.5);
  ctx.lineTo(r.x + r.w, r.y + r.h - 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  // Sigil circle on the left. Unbound: hollow blood ring with a small
  // centre dot. Bound: deeper blood-red fill with a pentagram stroke.
  const sigilR = 10;
  const sigilX = r.x + 20 + sigilR;
  const sigilY = r.y + r.h / 2;
  ctx.save();
  // Outer ring.
  ctx.strokeStyle = on ? BLOOD : BLOOD_SOFT;
  ctx.lineWidth = on ? 1.5 : 1;
  ctx.beginPath();
  ctx.arc(sigilX, sigilY, sigilR, 0, Math.PI * 2);
  ctx.stroke();
  if (on) {
    // Fill disc.
    ctx.fillStyle = BLOOD_DEEP;
    ctx.beginPath();
    ctx.arc(sigilX, sigilY, sigilR - 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Pentagram inside.
    drawPentagram(ctx, sigilX, sigilY, sigilR - 3, '#ffc8a8', null, 1);
  } else {
    // Tiny centre dot.
    ctx.fillStyle = BLOOD_SOFT;
    ctx.beginPath();
    ctx.arc(sigilX, sigilY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Label + description.
  const textX = sigilX + sigilR + 14;
  ctx.fillStyle = on ? BLOOD_INK : BONE;
  ctx.font = `italic 700 17px ${UI_FONTS.serif}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, textX, r.y + 5);

  ctx.fillStyle = on ? 'rgba(255, 200, 180, 0.75)' : BONE_DIM;
  ctx.font = `500 11px ${UI_FONTS.ui}`;
  ctx.fillText(description, textX, r.y + r.h - 16);

  // Wax-seal multiplier badge on the right — dark blood when bound, a
  // dimmer blood shadow otherwise. Mono text for the number.
  const badgeW = 68;
  const badgeH = 22;
  const badgeX = r.x + r.w - badgeW - 14;
  const badgeY = r.y + (r.h - badgeH) / 2;
  const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeH);
  badgeGrad.addColorStop(0, on ? '#8a1824' : '#3a0a12');
  badgeGrad.addColorStop(1, on ? '#4a0810' : '#1a0408');
  ctx.fillStyle = badgeGrad;
  ctx.fillRect(badgeX, badgeY, badgeW, badgeH);
  ctx.strokeStyle = on ? '#c13030' : 'rgba(160, 30, 40, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(badgeX + 0.5, badgeY + 0.5, badgeW - 1, badgeH - 1);
  // Inner highlight line under the top edge to make it feel pressed into
  // wax.
  ctx.fillStyle = on ? 'rgba(255, 200, 180, 0.2)' : 'rgba(255, 200, 180, 0.08)';
  ctx.fillRect(badgeX + 2, badgeY + 2, badgeW - 4, 2);
  ctx.fillStyle = on ? '#ffd8c0' : 'rgba(232, 216, 200, 0.55)';
  ctx.font = `700 12.5px ${UI_FONTS.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`\u00d7 ${scoreMult.toFixed(2)}`, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

export function hitTestModifierPicker(
  layout: ModifierPickerLayout,
  x: number,
  y: number,
): ModifierPickerAction | null {
  if (rectContains(layout.closeBtn, x, y)) return { kind: 'cancel' };
  if (rectContains(layout.cancelBtn, x, y)) return { kind: 'cancel' };
  if (rectContains(layout.startBtn, x, y)) return { kind: 'start' };
  for (const row of layout.rows) {
    if (rectContains(row.rect, x, y)) {
      return { kind: 'toggle', modifierId: row.id };
    }
  }
  return null;
}

// Keep the stray exports referenced so strict mode doesn't warn about the
// bone/blood palette constants that happen to be declared but only used
// inside functions above.
void BONE_FAINT;
