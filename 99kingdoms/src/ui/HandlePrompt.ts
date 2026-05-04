// Handle prompt — 640×460 parchment panel, single inscribed text field
// flanked by thin rule lines. Value is 48px italic serif; "anon" renders
// as a dim placeholder. A 3px ink caret blinks at the end of the
// drafted text. A small-caps validation counter sits beneath the field.
// Bottom: ghost Cancel + gold Save name buttons.

import {
  Rect,
  drawModalPanel,
  drawPillButton,
  rectContains,
  footerLine,
  drawSmallCapsCentered,
  INK,
  INK_DIM,
  INK_FAINT,
  INK_WARN,
  PAPER_RULE,
  UI_FONTS,
} from './MenuUI';

export interface HandlePromptState {
  value: string;
  blinkOn: boolean;
}

export interface HandlePromptLayout {
  saveBtn: Rect;
  cancelBtn: Rect;
  closeBtn: Rect;
  fieldRect: Rect;
}

export interface HandlePromptCopy {
  eyebrow: string;
  title: string;
  lead: string;
  saveLabel: string;
  cancelLabel: string;
}

export const DEFAULT_COPY: HandlePromptCopy = {
  eyebrow: 'The Chronicles',
  title: 'Your name in the chronicles.',
  lead: 'Three to twelve characters. Shown beside every score you post.',
  saveLabel: 'Save name',
  cancelLabel: 'Cancel',
};

export const END_OF_RUN_COPY: HandlePromptCopy = {
  eyebrow: 'The chronicles, signed',
  title: 'Your name in the chronicles.',
  lead: 'This run, and every one after it, will be posted under the name you choose. Leave it blank to stay anonymous forever.',
  saveLabel: 'Sign and post',
  cancelLabel: 'Stay anonymous',
};

export function drawHandlePrompt(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  state: HandlePromptState,
  mouseX: number,
  mouseY: number,
  copy: HandlePromptCopy = DEFAULT_COPY,
): HandlePromptLayout {
  const { inner, close } = drawModalPanel(
    ctx,
    w,
    h,
    copy.title,
    footerLine([
      'Type a name  ',
      { kbd: 'Enter' },
      ' saves  ',
      { kbd: 'Esc' },
      ' cancels',
    ]),
    { eyebrow: copy.eyebrow, panelW: 640, panelH: 460 },
  );

  // Lead paragraph — italic serif, left-aligned inside the inner region.
  ctx.save();
  ctx.fillStyle = 'rgba(232,226,212,0.75)';
  ctx.font = `italic 500 16px ${UI_FONTS.serif}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // The lead can run long, so wrap instead of a single line.
  const leadMaxW = inner.w - 88;
  wrapLead(ctx, copy.lead, inner.x + 44, inner.y + 22, leadMaxW, 20);
  ctx.restore();

  // ── Inscribed field ─────────────────────────────────────────────
  const fieldW = 420;
  const fieldX = inner.x + (inner.w - fieldW) / 2;
  const fieldTop = inner.y + 80;
  const fieldH = 68;

  // Top rule (strong), underline rule (stronger), bottom rule (light).
  ctx.save();
  ctx.strokeStyle = PAPER_RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(fieldX, fieldTop);
  ctx.lineTo(fieldX + fieldW, fieldTop);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(232,226,212,0.55)';
  ctx.beginPath();
  ctx.moveTo(fieldX, fieldTop + fieldH - 8);
  ctx.lineTo(fieldX + fieldW, fieldTop + fieldH - 8);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(232,226,212,0.18)';
  ctx.beginPath();
  ctx.moveTo(fieldX, fieldTop + fieldH + 8);
  ctx.lineTo(fieldX + fieldW, fieldTop + fieldH + 8);
  ctx.stroke();
  ctx.restore();

  // Centre-aligned inscribed value.
  const clamped = state.value.slice(0, 12);
  const isEmpty = clamped.length === 0;
  const valueFont = `italic ${isEmpty ? 500 : 600} 48px ${UI_FONTS.serif}`;
  ctx.save();
  ctx.font = valueFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = isEmpty ? 'rgba(232,226,212,0.3)' : INK;
  // The design uses slight letter-spacing on the value.
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prevLS = c.letterSpacing;
  c.letterSpacing = '0.5px';
  const display = isEmpty ? 'anon' : clamped;
  const textW = ctx.measureText(display).width;
  const cy = fieldTop + fieldH / 2 - 4;
  // Draw value; caret appears only when there's real content.
  const textX = fieldX + fieldW / 2 - textW / 2 + textW / 2; // center
  void textX;
  ctx.fillText(display, fieldX + fieldW / 2, cy);
  c.letterSpacing = prevLS ?? '0px';

  if (!isEmpty && state.blinkOn) {
    // Caret — 3×44 ink rectangle hugging the right edge of the drawn text.
    const caretX = fieldX + fieldW / 2 + textW / 2 + 3;
    ctx.fillStyle = INK;
    ctx.fillRect(caretX, cy - 22, 3, 44);
  }
  ctx.restore();

  // Counter line.
  const trimmed = state.value.trim();
  let msg: string;
  let warn = false;
  if (trimmed.length === 0) {
    msg = "Leave blank to keep the default 'anon'.";
  } else if (trimmed.length < 3) {
    msg = 'Minimum three characters.';
    warn = true;
  } else if (state.value.length > 12) {
    msg = 'Maximum twelve characters.';
    warn = true;
  } else {
    msg = `${trimmed.length} / 12 characters`;
  }
  ctx.save();
  ctx.fillStyle = warn ? INK_WARN : 'rgba(232,226,212,0.6)';
  ctx.font = `600 11.5px ${UI_FONTS.ui}`;
  ctx.textBaseline = 'top';
  drawSmallCapsCentered(ctx, msg, inner.x + inner.w / 2, fieldTop + fieldH + 22, 0.12);
  ctx.restore();

  // Buttons — ghost Cancel + gold Save name, centred with 14px gap.
  const cancelW = 140;
  const saveW = 160;
  const btnH = 36;
  const gap = 14;
  const totalBtnsW = cancelW + gap + saveW;
  const btnsLeft = inner.x + (inner.w - totalBtnsW) / 2;
  const btnY = inner.y + inner.h - btnH - 14;
  const canSave = trimmed.length === 0 || (trimmed.length >= 3 && state.value.length <= 12);
  const cancelBtn = drawPillButton(
    ctx,
    btnsLeft,
    btnY,
    cancelW,
    btnH,
    copy.cancelLabel,
    {
      tone: 'ghost',
      hover: rectContains(
        { x: btnsLeft, y: btnY, w: cancelW, h: btnH },
        mouseX,
        mouseY,
      ),
    },
  );
  const saveX = btnsLeft + cancelW + gap;
  const saveBtn = drawPillButton(ctx, saveX, btnY, saveW, btnH, copy.saveLabel, {
    tone: 'primary',
    active: true,
    dim: !canSave,
    hover: rectContains({ x: saveX, y: btnY, w: saveW, h: btnH }, mouseX, mouseY),
  });

  return {
    saveBtn,
    cancelBtn,
    closeBtn: close,
    fieldRect: { x: fieldX, y: fieldTop, w: fieldW, h: fieldH + 16 },
  };
}

export interface HandlePromptAction {
  kind: 'save' | 'cancel' | 'focusField';
}

export function hitTestHandlePrompt(
  layout: HandlePromptLayout,
  x: number,
  y: number,
): HandlePromptAction | null {
  if (rectContains(layout.closeBtn, x, y)) return { kind: 'cancel' };
  if (rectContains(layout.cancelBtn, x, y)) return { kind: 'cancel' };
  if (rectContains(layout.saveBtn, x, y)) return { kind: 'save' };
  if (rectContains(layout.fieldRect, x, y)) return { kind: 'focusField' };
  return null;
}

void INK_DIM;
void INK_FAINT;

/** Simple word-wrap for the lead paragraph. Kept local so the module doesn't
 *  import wrapText from MenuUI just for this one site. */
function wrapLead(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): void {
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
