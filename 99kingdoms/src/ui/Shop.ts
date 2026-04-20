import type { UpgradeOffer } from '../game/Upgrades';
import type { Resources } from '../game/Game';
import { UI_COLORS, UI_FONTS, drawSmallCaps, drawCoinIcon } from './HUD';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Layout {
  cards: Rect[];
  skip: Rect;
}

const CARD_W = 200;
const CARD_H = 200;
const CARD_GAP = 18;
const SKIP_W = 140;
const SKIP_H = 34;

export function shopLayout(w: number, h: number, count: number): Layout {
  const total = count * CARD_W + (count - 1) * CARD_GAP;
  const startX = (w - total) / 2;
  const cardY = h / 2 - CARD_H / 2 + 20;
  const cards: Rect[] = [];
  for (let i = 0; i < count; i++) {
    cards.push({ x: startX + i * (CARD_W + CARD_GAP), y: cardY, w: CARD_W, h: CARD_H });
  }
  const skip: Rect = {
    x: w / 2 - SKIP_W / 2,
    y: cardY + CARD_H + 24,
    w: SKIP_W,
    h: SKIP_H,
  };
  return { cards, skip };
}

export type ShopPick = number | 'skip' | null;

export function shopPickAt(
  mx: number,
  my: number,
  w: number,
  h: number,
  count: number,
): ShopPick {
  const layout = shopLayout(w, h, count);
  for (let i = 0; i < count; i++) {
    if (inRect(mx, my, layout.cards[i])) return i;
  }
  if (inRect(mx, my, layout.skip)) return 'skip';
  return null;
}

function inRect(px: number, py: number, r: Rect): boolean {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

const CARD_TONES = [UI_COLORS.gold, UI_COLORS.cyan, UI_COLORS.orange];
const CARD_KIND_LABELS = ['Economy', 'Hero', 'Defense'];

export function drawShop(
  ctx: CanvasRenderingContext2D,
  offers: UpgradeOffer[],
  resources: Resources,
  hoverPick: ShopPick,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(6, 7, 14, 0.88)';
  ctx.fillRect(0, 0, w, h);

  // Header stack.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = UI_COLORS.orange;
  ctx.font = `600 10px ${UI_FONTS.ui}`;
  drawSmallCapsCenteredUI(ctx, 'The sun clears the ridge', w / 2, 70, 1.6);

  ctx.fillStyle = UI_COLORS.gold;
  ctx.font = `italic 700 40px ${UI_FONTS.serif}`;
  ctx.fillText('Dawn', w / 2, 84);

  ctx.fillStyle = UI_COLORS.creamDim;
  ctx.font = `500 12px ${UI_FONTS.ui}`;
  ctx.fillText('Choose one upgrade, or skip.', w / 2, 136);

  const layout = shopLayout(w, h, offers.length);
  for (let i = 0; i < offers.length; i++) {
    drawCard(
      ctx,
      layout.cards[i],
      offers[i],
      resources.coin >= offers[i].cost,
      hoverPick === i,
      i,
    );
  }
  drawSkip(ctx, layout.skip, hoverPick === 'skip');

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  offer: UpgradeOffer,
  canAfford: boolean,
  hover: boolean,
  idx: number,
) {
  const tone = CARD_TONES[idx % CARD_TONES.length];
  const kindLabel = CARD_KIND_LABELS[idx % CARD_KIND_LABELS.length];
  const yLift = hover ? 3 : 0;
  const y = r.y - yLift;

  // Drop shadow.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(r.x + 2, y + 6, r.w, r.h);

  // Body.
  ctx.fillStyle = hover ? 'rgba(26, 20, 32, 0.98)' : 'rgba(18, 19, 31, 0.96)';
  ctx.fillRect(r.x, y, r.w, r.h);

  // Top stripe in tone.
  ctx.fillStyle = tone;
  ctx.fillRect(r.x, y, r.w, 3);

  // Border.
  ctx.strokeStyle = hover ? tone : 'rgba(234, 223, 196, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, y + 0.5, r.w - 1, r.h - 1);
  if (hover) {
    ctx.strokeStyle = tone;
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x - 0.5, y - 0.5, r.w + 1, r.h + 1);
  }

  const padX = 14;

  // Kind smallcaps.
  ctx.fillStyle = tone;
  ctx.font = `600 8.5px ${UI_FONTS.ui}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  drawSmallCaps(ctx, kindLabel, r.x + padX, y + 18, 1.4);

  // Title.
  ctx.fillStyle = canAfford ? UI_COLORS.cream : UI_COLORS.creamDim;
  ctx.font = `italic 700 19px ${UI_FONTS.serif}`;
  ctx.fillText(offer.name, r.x + padX, y + 32);

  // Description.
  ctx.fillStyle = canAfford ? UI_COLORS.inkDim : '#6a6459';
  ctx.font = `500 10.5px ${UI_FONTS.ui}`;
  wrapText(ctx, offer.description, r.x + padX, y + 66, r.w - padX * 2, 13);

  // Cost pill + "Pick" label.
  const pillY = y + r.h - 36;
  const pillW = 56;
  const pillH = 22;
  ctx.fillStyle = '#0a0b14';
  ctx.fillRect(r.x + padX, pillY, pillW, pillH);
  ctx.strokeStyle = 'rgba(242, 201, 76, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + padX + 0.5, pillY + 0.5, pillW - 1, pillH - 1);
  drawCoinIcon(ctx, r.x + padX + 12, pillY + pillH / 2, 5);
  ctx.fillStyle = canAfford ? UI_COLORS.gold : UI_COLORS.red;
  ctx.font = `700 12px ${UI_FONTS.mono}`;
  ctx.textBaseline = 'middle';
  ctx.fillText(String(offer.cost), r.x + padX + 24, pillY + pillH / 2);

  ctx.fillStyle = UI_COLORS.inkFaint;
  ctx.font = `600 9px ${UI_FONTS.ui}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  drawSmallCaps(
    ctx,
    hover ? 'Selected' : 'Pick',
    r.x + r.w - padX - (hover ? 45 : 22),
    pillY + pillH / 2,
    1.4,
  );
  ctx.textAlign = 'left';
}

function drawSkip(ctx: CanvasRenderingContext2D, r: Rect, hover: boolean) {
  ctx.fillStyle = hover ? 'rgba(26, 20, 32, 0.8)' : 'transparent';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = hover ? 'rgba(234, 223, 196, 0.5)' : 'rgba(234, 223, 196, 0.15)';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

  ctx.fillStyle = hover ? UI_COLORS.cream : UI_COLORS.inkDim;
  ctx.font = `500 11px ${UI_FONTS.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawSmallCapsCenteredUI(ctx, 'Skip', r.x + r.w / 2, r.y + r.h / 2 - 4, 2);
  ctx.textAlign = 'start';
}

function drawSmallCapsCenteredUI(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking = 1.2,
) {
  const upper = text.toUpperCase();
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = c.letterSpacing;
  c.letterSpacing = `${tracking}px`;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'center';
  ctx.fillText(upper, cx, y);
  ctx.textAlign = prevAlign;
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
  ctx.textAlign = 'left';
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
