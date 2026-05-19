import { SHOP_ITEMS, type ShopItem, type ShopItemId } from '../shop/items';
import { WORLD } from '../game/types';
import { getIcon } from './icons';
import { closeBtnContains, drawCloseBtn, drawIconBtn } from './HUD';

// Shop button lives in the right column, stacked between rebirth and essence.
// 25%-smaller scale to match those buttons.
export const SHOP_BTN = { x: WORLD.width - 45 - 12, y: WORLD.height / 2 - 130, w: 45, h: 58 };

export function shopBtnContains(px: number, py: number): boolean {
  const r = SHOP_BTN;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawShopButton(ctx: CanvasRenderingContext2D, hovered: boolean, open: boolean, time: number) {
  drawIconBtn(ctx, {
    rect: SHOP_BTN,
    iconId: 'gift',
    label: 'SHOP',
    hovered,
    active: open,
    glowColor: '#ffaa28',
    time,
  });
}

// === Overlay panel ===

const PANEL_W = 800;
const PANEL_H = 400;
const PANEL_X = Math.round((WORLD.width - PANEL_W) / 2);
const PANEL_Y = Math.round((WORLD.height - WORLD.collectionPanelH - PANEL_H) / 2);

// 5 cols × 2 rows fits all 10 items cleanly without overflow.
const CARD_COLS = 5;
const CARD_GAP = 10;
const CARD_W = Math.floor((PANEL_W - 32 - CARD_GAP * (CARD_COLS - 1)) / CARD_COLS);
const CARD_H = 145;
const GRID_X = PANEL_X + 16;
const GRID_Y = PANEL_Y + 64;

function cardRect(i: number) {
  const col = i % CARD_COLS;
  const row = Math.floor(i / CARD_COLS);
  return {
    x: GRID_X + col * (CARD_W + CARD_GAP),
    y: GRID_Y + row * (CARD_H + CARD_GAP),
    w: CARD_W,
    h: CARD_H,
  };
}

export function shopOverlayContains(px: number, py: number): boolean {
  return px >= PANEL_X && px <= PANEL_X + PANEL_W && py >= PANEL_Y && py <= PANEL_Y + PANEL_H;
}

export function hitShopItem(px: number, py: number, owned: Set<ShopItemId>): ShopItem | null {
  for (let i = 0; i < SHOP_ITEMS.length; i++) {
    const item = SHOP_ITEMS[i]!;
    if (item.oneTime && owned.has(item.id)) continue;
    const r = cardRect(i);
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return item;
  }
  return null;
}

export const SHOP_PANEL = { x: PANEL_X, y: PANEL_Y, w: PANEL_W, h: PANEL_H };

export function shopCloseBtnContains(px: number, py: number): boolean {
  return closeBtnContains(SHOP_PANEL, px, py);
}

export function drawShopOverlay(
  ctx: CanvasRenderingContext2D,
  owned: Set<ShopItemId>,
  hovered: ShopItem | null,
  closeHovered = false,
) {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Panel
  ctx.fillStyle = 'rgba(15, 12, 24, 0.97)';
  ctx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  ctx.strokeStyle = '#ffaa28';
  ctx.lineWidth = 2;
  ctx.strokeRect(PANEL_X + 1, PANEL_Y + 1, PANEL_W - 2, PANEL_H - 2);

  // Header
  ctx.fillStyle = '#ffd99a';
  ctx.font = 'bold 22px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SHOP', PANEL_X + PANEL_W / 2, PANEL_Y + 32);
  ctx.fillStyle = '#b6c2d1';
  ctx.font = '11px Inter Tight, sans-serif';
  ctx.fillText('paid in Robux · simulated for prototype', PANEL_X + PANEL_W / 2, PANEL_Y + 50);
  ctx.textAlign = 'start';

  for (let i = 0; i < SHOP_ITEMS.length; i++) {
    const item = SHOP_ITEMS[i]!;
    const r = cardRect(i);
    const isOwned = item.oneTime && owned.has(item.id);
    const isHover = !isOwned && hovered === item;
    drawCard(ctx, r, item, isOwned, isHover);
  }

  ctx.textAlign = 'start';

  drawCloseBtn(ctx, SHOP_PANEL, closeHovered);
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  item: ShopItem,
  owned: boolean,
  hovered: boolean,
) {
  // Card body
  ctx.fillStyle = owned ? 'rgba(40,40,50,0.3)' : hovered ? '#22252e' : 'rgba(30,32,40,0.95)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = owned ? '#3a4050' : hovered ? item.color : '#2a303a';
  ctx.lineWidth = hovered ? 2 : 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  // Tag badge (top-right)
  if (item.tag && !owned) {
    ctx.fillStyle = item.color;
    ctx.font = 'bold 8px Inter Tight, sans-serif';
    ctx.textAlign = 'end';
    ctx.fillText(item.tag, r.x + r.w - 6, r.y + 12);
  }

  // Icon
  const icon = getIcon(item.iconId);
  const iconSize = 48;
  if (icon) {
    ctx.save();
    if (owned) ctx.globalAlpha = 0.3;
    ctx.drawImage(icon, r.x + r.w / 2 - iconSize / 2, r.y + 14, iconSize, iconSize);
    ctx.restore();
  }

  // Name
  ctx.fillStyle = owned ? '#5a6070' : '#ffffff';
  ctx.font = 'bold 12px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(item.name, r.x + r.w / 2, r.y + 78);

  // Desc (wrap if too long)
  ctx.fillStyle = owned ? '#4a5060' : '#b6c2d1';
  ctx.font = '10px Inter Tight, sans-serif';
  wrapText(ctx, item.desc, r.x + r.w / 2, r.y + 94, r.w - 12, 12);

  // Buy / OWNED button
  const btnH = 26;
  const btnY = r.y + r.h - btnH - 8;
  const btnX = r.x + 10;
  const btnW = r.w - 20;
  if (owned) {
    ctx.fillStyle = 'rgba(80,90,110,0.18)';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.strokeStyle = '#3a4050';
    ctx.lineWidth = 1;
    ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);
    ctx.fillStyle = '#6a7080';
    ctx.font = 'bold 11px Inter Tight, sans-serif';
    ctx.fillText('OWNED', r.x + r.w / 2, btnY + 17);
  } else {
    // Robux-style green button
    ctx.fillStyle = hovered ? '#00d188' : '#00b06f';
    ctx.fillRect(btnX, btnY, btnW, btnH);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Inter Tight, sans-serif';
    // R$ glyph + price
    ctx.fillText(`R$ ${item.robux}`, r.x + r.w / 2, btnY + 17);
  }
  ctx.textAlign = 'start';
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  startY: number,
  maxW: number,
  lineH: number,
) {
  const words = text.split(' ');
  let line = '';
  let y = startY;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, y);
      y += lineH;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, y);
}

// === Purchase confirmation modal ===

export const SHOP_MODAL_BUY = { x: 0, y: 0, w: 110, h: 32 };
export const SHOP_MODAL_CANCEL = { x: 0, y: 0, w: 110, h: 32 };

export function shopModalBuyContains(px: number, py: number): boolean {
  const r = SHOP_MODAL_BUY;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function shopModalCancelContains(px: number, py: number): boolean {
  const r = SHOP_MODAL_CANCEL;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawShopPurchaseModal(ctx: CanvasRenderingContext2D, item: ShopItem) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const w = 380;
  const h = 220;
  const x = Math.round((WORLD.width - w) / 2);
  const y = Math.round((WORLD.height - h) / 2);
  ctx.fillStyle = '#15181f';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#00b06f';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Title bar (Roblox-style)
  ctx.fillStyle = '#00b06f';
  ctx.fillRect(x, y, w, 32);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Inter Tight, sans-serif';
  ctx.textAlign = 'start';
  ctx.fillText('Confirm Purchase', x + 12, y + 21);

  // Item icon + name
  const icon = getIcon(item.iconId);
  if (icon) ctx.drawImage(icon, x + 24, y + 50, 60, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px Inter Tight, sans-serif';
  ctx.fillText(item.name, x + 100, y + 72);
  ctx.fillStyle = '#b6c2d1';
  ctx.font = '12px Inter Tight, sans-serif';
  ctx.fillText(item.desc, x + 100, y + 92);

  ctx.fillStyle = '#00b06f';
  ctx.font = 'bold 18px Inter Tight, sans-serif';
  ctx.fillText(`R$ ${item.robux}`, x + 100, y + 118);

  ctx.fillStyle = '#6a7080';
  ctx.font = '10px Inter Tight, sans-serif';
  ctx.fillText('Simulated — no actual Robux charged.', x + 24, y + 148);

  // Buttons
  const btnY = y + h - 50;
  SHOP_MODAL_BUY.x = x + w / 2 - SHOP_MODAL_BUY.w - 8;
  SHOP_MODAL_BUY.y = btnY;
  SHOP_MODAL_CANCEL.x = x + w / 2 + 8;
  SHOP_MODAL_CANCEL.y = btnY;

  ctx.fillStyle = '#00b06f';
  ctx.fillRect(SHOP_MODAL_BUY.x, SHOP_MODAL_BUY.y, SHOP_MODAL_BUY.w, SHOP_MODAL_BUY.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`BUY R$ ${item.robux}`, SHOP_MODAL_BUY.x + SHOP_MODAL_BUY.w / 2, SHOP_MODAL_BUY.y + 21);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(SHOP_MODAL_CANCEL.x, SHOP_MODAL_CANCEL.y, SHOP_MODAL_CANCEL.w, SHOP_MODAL_CANCEL.h);
  ctx.strokeStyle = '#3a4050';
  ctx.lineWidth = 1;
  ctx.strokeRect(SHOP_MODAL_CANCEL.x + 0.5, SHOP_MODAL_CANCEL.y + 0.5, SHOP_MODAL_CANCEL.w - 1, SHOP_MODAL_CANCEL.h - 1);
  ctx.fillStyle = '#b6c2d1';
  ctx.fillText('Cancel', SHOP_MODAL_CANCEL.x + SHOP_MODAL_CANCEL.w / 2, SHOP_MODAL_CANCEL.y + 21);
  ctx.textAlign = 'start';
}
