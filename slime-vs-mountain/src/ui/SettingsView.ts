import { WORLD } from '../game/types';
import { closeBtnContains, drawCloseBtn, drawIconBtn } from './HUD';
import { getIcon } from './icons';

// Top-left corner — same slot where the AI Autoplay button used to live.
export const SETTINGS_BTN = { x: 12, y: 12, w: 45, h: 58 };

export function settingsBtnContains(px: number, py: number): boolean {
  const r = SETTINGS_BTN;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawSettingsButton(ctx: CanvasRenderingContext2D, hovered: boolean, open: boolean, time: number) {
  drawIconBtn(ctx, {
    rect: SETTINGS_BTN,
    iconId: 'settings',
    label: 'SETTINGS',
    hovered,
    active: open,
    glowColor: '#a0c0ff',
    time,
  });
}

// === Settings overlay panel ===

const PANEL_W = 460;
const PANEL_H = 400;
const PANEL_X = Math.round((WORLD.width - PANEL_W) / 2);
const PANEL_Y = Math.round((WORLD.height - WORLD.collectionPanelH - PANEL_H) / 2);

export const SETTINGS_PANEL = { x: PANEL_X, y: PANEL_Y, w: PANEL_W, h: PANEL_H };

export function settingsCloseBtnContains(px: number, py: number): boolean {
  return closeBtnContains(SETTINGS_PANEL, px, py);
}

// Two rows of action items inside the settings panel.
const ROW_H = 70;
const ROW_Y0 = PANEL_Y + 80;
const ROW_INSET = 24;

function rowRect(i: number) {
  return {
    x: PANEL_X + ROW_INSET,
    y: ROW_Y0 + i * (ROW_H + 10),
    w: PANEL_W - ROW_INSET * 2,
    h: ROW_H,
  };
}

// Action-button rect inside a row (right-aligned, ~110px wide).
function actionBtnRect(rowIdx: number) {
  const r = rowRect(rowIdx);
  const w = 130;
  const h = 36;
  return { x: r.x + r.w - w - 12, y: r.y + (r.h - h) / 2, w, h };
}

// Row 0 = AI Autoplay toggle, Row 1 = Cheat (grant resources), Row 2 = Reset Progress
export function autoplayActionRectInSettings() { return actionBtnRect(0); }
export function cheatActionRectInSettings()    { return actionBtnRect(1); }
export function resetActionRectInSettings()    { return actionBtnRect(2); }

export function settingsAutoplayHit(px: number, py: number): boolean {
  const r = actionBtnRect(0);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function settingsCheatHit(px: number, py: number): boolean {
  const r = actionBtnRect(1);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function settingsResetHit(px: number, py: number): boolean {
  const r = actionBtnRect(2);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawSettingsOverlay(
  ctx: CanvasRenderingContext2D,
  autoplayOn: boolean,
  closeHovered: boolean,
  autoplayHovered: boolean,
  cheatHovered: boolean,
  resetHovered: boolean,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  ctx.fillStyle = 'rgba(15, 18, 28, 0.97)';
  ctx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  ctx.strokeStyle = '#a0c0ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(PANEL_X + 1, PANEL_Y + 1, PANEL_W - 2, PANEL_H - 2);

  ctx.fillStyle = '#e6ecf3';
  ctx.font = 'bold 22px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SETTINGS', PANEL_X + PANEL_W / 2, PANEL_Y + 38);
  ctx.fillStyle = '#b6c2d1';
  ctx.font = '12px Inter Tight, sans-serif';
  ctx.fillText('AI helpers + dev cheats + save management', PANEL_X + PANEL_W / 2, PANEL_Y + 58);
  ctx.textAlign = 'start';

  // Row 0 — AI Autoplay toggle
  drawSettingsRow(
    ctx,
    0,
    'autoplay',
    'AI Autoplay',
    autoplayOn ? 'Running — playing for you' : 'AI plays the game for you',
    autoplayOn ? 'TURN OFF' : 'TURN ON',
    autoplayOn ? '#d24a4a' : '#00b06f',
    autoplayHovered,
  );

  // Row 1 — Grant resources cheat (for testing the skill tree)
  drawSettingsRow(
    ctx,
    1,
    'gift',
    'Cheat: Grant Resources',
    '+100k pollen · +10k gems · +50 essence · +1k rolls',
    'GIVE ME LOOT',
    '#7a4ad2',
    cheatHovered,
  );

  // Row 2 — Reset progress
  drawSettingsRow(
    ctx,
    2,
    'reset',
    'Reset Progress',
    'Wipe the save and restart from scratch',
    'WIPE & RESTART',
    '#a83a3a',
    resetHovered,
  );

  drawCloseBtn(ctx, SETTINGS_PANEL, closeHovered);
}

function drawSettingsRow(
  ctx: CanvasRenderingContext2D,
  i: number,
  iconId: 'autoplay' | 'reset' | 'gift',
  name: string,
  desc: string,
  btnLabel: string,
  btnColor: string,
  btnHovered: boolean,
) {
  const r = rowRect(i);
  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = '#2a303a';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  // Icon
  const icon = getIcon(iconId);
  const size = 44;
  if (icon) {
    ctx.drawImage(icon, r.x + 14, r.y + (r.h - size) / 2, size, size);
  }

  // Name + desc
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Inter Tight, sans-serif';
  ctx.textAlign = 'start';
  ctx.fillText(name, r.x + 14 + size + 14, r.y + 28);
  ctx.fillStyle = '#b6c2d1';
  ctx.font = '11px Inter Tight, sans-serif';
  ctx.fillText(desc, r.x + 14 + size + 14, r.y + 46);

  // Action button (right-aligned)
  const btn = actionBtnRect(i);
  ctx.fillStyle = btnHovered ? brighten(btnColor) : btnColor;
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(btnLabel, btn.x + btn.w / 2, btn.y + btn.h / 2 + 4);
  ctx.textAlign = 'start';
}

/** Tiny helper — lift each rgb channel ~15% for hover state. */
function brighten(hex: string): string {
  const h = hex.replace('#', '');
  const r = Math.min(255, parseInt(h.slice(0, 2), 16) + 35);
  const g = Math.min(255, parseInt(h.slice(2, 4), 16) + 35);
  const b = Math.min(255, parseInt(h.slice(4, 6), 16) + 35);
  return `rgb(${r},${g},${b})`;
}
