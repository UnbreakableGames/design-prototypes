import {
  RARITIES,
  RARITY_COLORS,
  RARITY_NAMES,
  SLIME_VARIANTS,
  VARIANTS_BY_RARITY,
  WORLD,
  type Rarity,
  type SlimeVariantId,
  type VariantState,
} from '../game/types';
import { FUSION_INPUT_COUNT, nextRarity } from '../skills/crafting';
import { closeBtnContains, drawCloseBtn, drawIconBtn, drawMiniSlime } from './HUD';

// Right-edge button — sits below the Rebirth Tree button.
export const CRAFT_BTN = { x: WORLD.width - 45 - 12, y: WORLD.height / 2 + 70, w: 45, h: 58 };

export function craftBtnContains(px: number, py: number): boolean {
  const r = CRAFT_BTN;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawCraftButton(ctx: CanvasRenderingContext2D, hovered: boolean, open: boolean, time: number) {
  drawIconBtn(ctx, {
    rect: CRAFT_BTN,
    iconId: 'craft',
    label: 'CRAFT',
    hovered,
    active: open,
    glowColor: '#80f0c0',
    time,
    fallback: (c, cx, cy, r) => {
      // Crucible silhouette — beaker-ish outline that reads as "fuse / craft".
      c.fillStyle = open || hovered ? '#d8ffe8' : '#80f0c0';
      c.strokeStyle = open || hovered ? '#d8ffe8' : '#80f0c0';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx - r * 0.7, cy - r * 0.7);
      c.lineTo(cx - r * 0.7, cy + r * 0.2);
      c.lineTo(cx - r * 0.95, cy + r * 0.85);
      c.lineTo(cx + r * 0.95, cy + r * 0.85);
      c.lineTo(cx + r * 0.7, cy + r * 0.2);
      c.lineTo(cx + r * 0.7, cy - r * 0.7);
      c.closePath();
      c.stroke();
      // Liquid line
      c.fillRect(cx - r * 0.6, cy + r * 0.05, r * 1.2, r * 0.15);
    },
  });
}

// === Overlay panel ===
const PANEL_W = 720;
const PANEL_H = 420;
const PANEL_X = Math.round((WORLD.width - PANEL_W) / 2);
const PANEL_Y = Math.round((WORLD.height - WORLD.collectionPanelH - PANEL_H) / 2);

export const CRAFT_PANEL = { x: PANEL_X, y: PANEL_Y, w: PANEL_W, h: PANEL_H };

// Tier strip: 17 fusable rarities (stellar excluded — top of ladder).
const TIER_RARITIES: Rarity[] = RARITIES.filter((r) => Number.isFinite(FUSION_INPUT_COUNT[r]));
const TIER_GAP = 4;
const TIER_W = Math.floor((PANEL_W - 32 - TIER_GAP * (TIER_RARITIES.length - 1)) / TIER_RARITIES.length);
const TIER_H = 32;
const TIER_Y = PANEL_Y + 60;
const TIER_X0 = PANEL_X + 16;

function tierRect(i: number) {
  return { x: TIER_X0 + i * (TIER_W + TIER_GAP), y: TIER_Y, w: TIER_W, h: TIER_H };
}

// Variant grid: shows variants in the selected rarity. Up to 6 per row (max
// variants any rarity holds is 6, in 'rare'). Cards are sized to fit.
const CARDS_PER_ROW = 6;
const CARD_GAP = 8;
const CARD_W = Math.floor((PANEL_W - 32 - CARD_GAP * (CARDS_PER_ROW - 1)) / CARDS_PER_ROW);
const CARD_H = 96;
const GRID_X = PANEL_X + 16;
const GRID_Y = TIER_Y + TIER_H + 16;

function cardRect(i: number) {
  const col = i % CARDS_PER_ROW;
  const row = Math.floor(i / CARDS_PER_ROW);
  return { x: GRID_X + col * (CARD_W + CARD_GAP), y: GRID_Y + row * (CARD_H + CARD_GAP), w: CARD_W, h: CARD_H };
}

// Output strip + fuse button live at the bottom.
const FUSE_BTN = { x: PANEL_X + PANEL_W / 2 - 120, y: PANEL_Y + PANEL_H - 56, w: 240, h: 40 };

export function craftCloseBtnContains(px: number, py: number): boolean {
  return closeBtnContains(CRAFT_PANEL, px, py);
}

export function craftOverlayContains(px: number, py: number): boolean {
  return px >= PANEL_X && px <= PANEL_X + PANEL_W && py >= PANEL_Y && py <= PANEL_Y + PANEL_H;
}

export function hitCraftTier(px: number, py: number): Rarity | null {
  for (let i = 0; i < TIER_RARITIES.length; i++) {
    const r = tierRect(i);
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return TIER_RARITIES[i]!;
  }
  return null;
}

export function hitCraftVariant(px: number, py: number, rarity: Rarity): SlimeVariantId | null {
  const pool = VARIANTS_BY_RARITY[rarity] ?? [];
  for (let i = 0; i < pool.length; i++) {
    const r = cardRect(i);
    if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return pool[i]!;
  }
  return null;
}

export function craftFuseBtnContains(px: number, py: number): boolean {
  const r = FUSE_BTN;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** Pick a default rarity for the panel when it opens — the lowest tier where
 *  the player has at least one fusable variant. Falls back to 'common'. */
export function defaultCraftRarity(collection: Map<SlimeVariantId, VariantState>): Rarity {
  for (const r of TIER_RARITIES) {
    const need = FUSION_INPUT_COUNT[r];
    for (const id of VARIANTS_BY_RARITY[r]) {
      const st = collection.get(id);
      if (st && (st.count - st.slotted) >= need) return r;
    }
  }
  return 'common';
}

export interface CraftViewState {
  collection: Map<SlimeVariantId, VariantState>;
  selectedRarity: Rarity;
  selectedVariantId: SlimeVariantId | null;
  hoveredVariantId: SlimeVariantId | null;
  fuseHovered: boolean;
  closeHovered: boolean;
}

export function drawCraftOverlay(ctx: CanvasRenderingContext2D, s: CraftViewState) {
  // Dim backdrop
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Panel
  ctx.fillStyle = 'rgba(12, 18, 16, 0.97)';
  ctx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  ctx.strokeStyle = '#80f0c0';
  ctx.lineWidth = 2;
  ctx.strokeRect(PANEL_X + 1, PANEL_Y + 1, PANEL_W - 2, PANEL_H - 2);

  // Header
  ctx.fillStyle = '#d8ffe8';
  ctx.font = 'bold 22px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CRAFTING', PANEL_X + PANEL_W / 2, PANEL_Y + 32);
  ctx.fillStyle = '#b6c2d1';
  ctx.font = '11px Inter Tight, sans-serif';
  ctx.fillText('fuse duplicate bees into a random bee of the next rarity', PANEL_X + PANEL_W / 2, PANEL_Y + 50);
  ctx.textAlign = 'start';

  // === Tier strip ===
  for (let i = 0; i < TIER_RARITIES.length; i++) {
    const rarity = TIER_RARITIES[i]!;
    const r = tierRect(i);
    const isSelected = rarity === s.selectedRarity;
    const color = RARITY_COLORS[rarity];

    // Does the player have ANY fusable variant in this tier? Dim if not.
    const need = FUSION_INPUT_COUNT[rarity];
    let fusable = false;
    for (const id of VARIANTS_BY_RARITY[rarity]) {
      const st = s.collection.get(id);
      if (st && (st.count - st.slotted) >= need) { fusable = true; break; }
    }

    ctx.save();
    if (isSelected) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = color;
    }
    ctx.globalAlpha = fusable || isSelected ? 1 : 0.4;
    ctx.fillStyle = isSelected ? `${color}33` : 'rgba(20,28,26,0.95)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = color;
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.restore();

    ctx.fillStyle = isSelected ? color : fusable ? '#e6ecf3' : '#6a7080';
    ctx.font = 'bold 10px Inter Tight, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(RARITY_NAMES[rarity].toUpperCase(), r.x + r.w / 2, r.y + r.h / 2 + 4);
  }
  ctx.textAlign = 'start';

  // === Variant grid for the selected tier ===
  const pool = VARIANTS_BY_RARITY[s.selectedRarity] ?? [];
  const need = FUSION_INPUT_COUNT[s.selectedRarity];
  for (let i = 0; i < pool.length; i++) {
    const id = pool[i]!;
    const variant = SLIME_VARIANTS[id];
    const r = cardRect(i);
    const st = s.collection.get(id);
    const bench = st ? st.count - st.slotted : 0;
    const fusable = bench >= need;
    const isSelected = id === s.selectedVariantId;
    const isHovered = id === s.hoveredVariantId;

    ctx.save();
    ctx.globalAlpha = bench > 0 ? 1 : 0.35;
    ctx.fillStyle = isSelected ? 'rgba(128, 240, 192, 0.18)' : 'rgba(18, 26, 24, 0.95)';
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = isSelected ? '#80f0c0' : isHovered ? RARITY_COLORS[variant.rarity] : 'rgba(80,100,96,0.6)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    ctx.restore();

    drawMiniSlime(ctx, r.x + r.w / 2, r.y + 28, variant);

    ctx.fillStyle = '#e6ecf3';
    ctx.font = 'bold 11px Inter Tight, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(variant.name, r.x + r.w / 2, r.y + 54);

    // bench / needed
    ctx.font = '10px Inter Tight, sans-serif';
    ctx.fillStyle = fusable ? '#80f0c0' : bench > 0 ? '#ffaa28' : '#6a7080';
    ctx.fillText(`bench: ${bench} / ${need}`, r.x + r.w / 2, r.y + 72);

    // total owned (faint)
    if (st && st.count > 0) {
      ctx.fillStyle = '#7a8090';
      ctx.font = '9px Inter Tight, sans-serif';
      ctx.fillText(`owned: ${st.count}`, r.x + r.w / 2, r.y + 86);
    }
  }
  ctx.textAlign = 'start';

  // === Output preview + FUSE button ===
  const out = nextRarity(s.selectedRarity);
  const sel = s.selectedVariantId ? SLIME_VARIANTS[s.selectedVariantId] : null;
  const selSt = s.selectedVariantId ? s.collection.get(s.selectedVariantId) : undefined;
  const selBench = selSt ? selSt.count - selSt.slotted : 0;
  const canFuseNow = !!(sel && out && selBench >= need);

  // Preview line above the button
  const previewY = PANEL_Y + PANEL_H - 84;
  ctx.font = '12px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  if (sel && out) {
    ctx.fillStyle = '#b6c2d1';
    const fromColor = RARITY_COLORS[sel.rarity];
    const toColor = RARITY_COLORS[out];
    ctx.fillText(`spend `, PANEL_X + PANEL_W / 2 - 110, previewY);
    ctx.fillStyle = fromColor;
    ctx.fillText(`${need}× ${sel.name}`, PANEL_X + PANEL_W / 2 - 30, previewY);
    ctx.fillStyle = '#b6c2d1';
    ctx.fillText(`→`, PANEL_X + PANEL_W / 2 + 50, previewY);
    ctx.fillStyle = toColor;
    ctx.fillText(`1 random ${RARITY_NAMES[out]}`, PANEL_X + PANEL_W / 2 + 110, previewY);
  } else if (!out) {
    ctx.fillStyle = '#6a7080';
    ctx.fillText(`${RARITY_NAMES[s.selectedRarity]} is the top tier — nothing to fuse into`, PANEL_X + PANEL_W / 2, previewY);
  } else {
    ctx.fillStyle = '#6a7080';
    ctx.fillText('select a variant to fuse', PANEL_X + PANEL_W / 2, previewY);
  }
  ctx.textAlign = 'start';

  // FUSE button
  const btn = FUSE_BTN;
  ctx.save();
  if (canFuseNow) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#80f0c0';
  }
  ctx.globalAlpha = canFuseNow ? 1 : 0.45;
  ctx.fillStyle = s.fuseHovered && canFuseNow ? 'rgba(128, 240, 192, 0.28)' : 'rgba(20, 32, 28, 0.95)';
  ctx.fillRect(btn.x, btn.y, btn.w, btn.h);
  ctx.strokeStyle = '#80f0c0';
  ctx.lineWidth = 2;
  ctx.strokeRect(btn.x + 0.5, btn.y + 0.5, btn.w - 1, btn.h - 1);
  ctx.restore();

  ctx.fillStyle = canFuseNow ? '#d8ffe8' : '#7a8090';
  ctx.font = 'bold 14px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FUSE', btn.x + btn.w / 2, btn.y + btn.h / 2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  drawCloseBtn(ctx, CRAFT_PANEL, s.closeHovered);
}
