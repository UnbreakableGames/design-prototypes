import type {
  Inventory,
  SlimeVariant,
  SlimeVariantId,
  SlotType,
  VariantState,
} from '../game/types';
import {
  levelMul,
  RARITY_COLORS,
  RARITY_NAMES,
  SLIME_VARIANTS,
  SLOT_LIMITS,
  WORLD,
  xpForNextLevel,
} from '../game/types';
import { getIcon, type IconId } from './icons';

export interface SpinButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Dice is intentionally ~20% larger than the skill-tree button icon (60px) so
// the primary action — rolling — visually dominates the top-center cluster.
const DIE_SIZE = 72;
export const SPIN_BTN: SpinButtonRect = {
  x: Math.round(WORLD.width / 2 - DIE_SIZE / 2),
  y: 14,
  w: DIE_SIZE,
  h: DIE_SIZE,
};
/** Base cooldown between rolls in seconds. Rolls are free (Sol's-style) — the
 *  rate-limiter is time, reduced by ECONOMY-branch perks. */
export const SPIN_BASE_COOLDOWN = 6;

const SLOT_W = 92;
const SLOT_ROW = 36;
const SLOT_ROWS_VISIBLE = 3;
const SLOT_H = SLOT_ROW * SLOT_ROWS_VISIBLE + 12;

// Collection panel layout
const PANEL_H = WORLD.collectionPanelH;
const PANEL_Y = WORLD.height - PANEL_H;
const CELL_SIZE = 48;
const CELL_PAD = 8;
const CELL_TOP = PANEL_Y + 6;
const PANEL_LABEL_W = 100;
// Cells live in a horizontal viewport between VIEWPORT_X and VIEWPORT_RIGHT.
// Drag/wheel scrolls them; edge fades + scrollbar hint at offscreen content.
const VIEWPORT_X = PANEL_LABEL_W + 10;
const VIEWPORT_RIGHT = WORLD.width - 10;
const VIEWPORT_W = VIEWPORT_RIGHT - VIEWPORT_X;
const COL_STRIDE = CELL_SIZE + CELL_PAD;
const SCROLLBAR_H = 4;
const SCROLLBAR_Y = PANEL_Y + PANEL_H - SCROLLBAR_H - 4;

/** One tile on the slot machine reel — either a slime variant or a bonus
 *  multiplier symbol. Visible to the player as it scrolls past, so they can
 *  *see* the BONUS land mid-window instead of just reading a flash banner. */
export type ReelTile =
  | { kind: 'slime'; id: SlimeVariantId }
  | { kind: 'bonus'; mul: 2 | 4 | 8 };

export interface HudState {
  inv: Inventory;
  hoveredSpin: boolean;
  /** True if the spin cooldown is at zero (ready to roll). */
  canSpin: boolean;
  /** Current cooldown remaining in seconds (0 = ready). */
  spinCooldown: number;
  /** Cooldown duration of the most recent roll (for progress-bar normalization). */
  spinCooldownMax: number;
  spinning: boolean;
  spinResult: { id: SlimeVariantId; count: number; bonusMul: number; t: number } | null;
  dieFace: number;
  dieAngle: number;
  slotReel: ReelTile[];
  /** Second slot machine — populated only after the main reel lands on a
   *  bonus tile. Renders to the right of the primary reel. */
  bonusReel: ReelTile[];
  /** Scroll position of the bonus reel (0 if inactive). */
  bonusScrollFloat: number;
  /** True while the bonus reel is actively scrolling. */
  bonusActive: boolean;
  slotScrollFloat: number;
  /** Stack inventory. One entry per owned variant — sorted by lifetime
   *  timesRolled descending so the most-rolled variants appear first. */
  collection: VariantState[];
  spitterSlots: SlimeVariantId[];
  runnerSlots: SlimeVariantId[];
  selectedVariantId: SlimeVariantId | null;
  /** Horizontal scroll offset of the collection panel (px). */
  collectionScroll: number;
  /** Total effective luck (inventory.luck + perks). Shown in the counter panel. */
  luck: number;
  /** Essence earned during the current run, NOT yet spendable. Released into
   *  `inv.essence` on rebirth. The HUD shows it as `+N` next to essence. */
  pendingEssence: number;
  /** Rebirth state */
  rebirthUnlocked: boolean;
  rebirthPreview: number;
  rebirthHovered: boolean;
  rebirthModalOpen: boolean;
}

/** Slim status of an active boss bee, fed to drawBossBanner. Kept as a
 *  separate ad-hoc shape rather than threaded through HudState because the
 *  banner only renders when a boss is alive — most frames it's a no-op. */
export interface BossBannerData {
  name: string;
  hpFrac: number;          // 0..1
  timeLeft: number;        // seconds
  timeLimit: number;       // seconds
  weaknessLabel: string;
  accentColor: string;
}

/** Top-center banner shown while a boss bee is alive. Mirrors the
 *  spin-bonus banner aesthetic (centered, glow, thick outline) so it reads
 *  as a "this is the event right now" UI element. Sits beneath the SETTINGS
 *  row so it doesn't collide with the corner buttons. */
export function drawBossBanner(
  ctx: CanvasRenderingContext2D,
  data: BossBannerData,
  time: number
) {
  const w = 340;
  const h = 64;
  const x = Math.round((WORLD.width - w) / 2);
  // Sits below the top button row (SETTINGS / dice / BAG O BEES) which ends
  // around y=86, and below the transient toast bubble at y=96 (h=30) so it
  // doesn't fight the spawn-warning toast on the first frame of the fight.
  const y = 130;

  ctx.save();
  // Background.
  ctx.fillStyle = 'rgba(14, 10, 18, 0.92)';
  ctx.fillRect(x, y, w, h);
  // Pulsing outline in the boss's accent color.
  const pulse = 0.6 + 0.4 * Math.sin(time * 4);
  ctx.strokeStyle = data.accentColor;
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 14 + pulse * 6;
  ctx.shadowColor = data.accentColor;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.shadowBlur = 0;

  // Title row — "BOSS BEE" tag + name.
  ctx.fillStyle = '#ff6060';
  ctx.font = '700 11px Inter Tight, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚠ BOSS BEE', x + 12, y + 16);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 16px Inter Tight, system-ui, sans-serif';
  ctx.fillText(data.name, x + 12, y + 33);

  // Right side: countdown — flashes red under 15 s.
  const lowTime = data.timeLeft < 15;
  ctx.font = '700 22px Inter Tight, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = lowTime ? `rgba(255, 70, 70, ${0.6 + 0.4 * Math.sin(time * 10)})` : '#fff2b0';
  ctx.fillText(`${Math.ceil(Math.max(0, data.timeLeft))}s`, x + w - 12, y + 28);
  ctx.font = '600 10px Inter Tight, system-ui, sans-serif';
  ctx.fillStyle = '#7a8090';
  ctx.fillText(`/ ${Math.ceil(data.timeLimit)}s`, x + w - 12, y + 42);

  // HP bar across the bottom.
  const barX = x + 12;
  const barY = y + h - 22;
  const barW = w - 24;
  const barH = 8;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = '#d24a4a';
  ctx.fillRect(barX, barY, barW * Math.max(0, Math.min(1, data.hpFrac)), barH);
  ctx.strokeStyle = '#3a2030';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX + 0.5, barY + 0.5, barW - 1, barH - 1);

  // Weakness hint just below the HP bar.
  ctx.font = '600 11px Inter Tight, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(`⚑ Weak to: ${data.weaknessLabel}`, barX, barY + barH + 11);

  ctx.restore();
}

export function drawHUD(ctx: CanvasRenderingContext2D, s: HudState) {
  // Currencies stacked vertically on the left middle, no background panel.
  const rowH = 36;
  const iconSize = 28;
  const colX = 18;
  const stackY = Math.round(WORLD.height / 2 - (rowH * 5) / 2);
  const drawRow = (
    i: number,
    iconId: 'gold' | 'gem' | 'essenceCurrency' | 'luck' | 'dice',
    value: number,
    fallback: (cx: number, cy: number) => void,
  ) => {
    const cy = stackY + i * rowH + rowH / 2;
    const iconCx = colX + iconSize / 2;
    const icon = getIcon(iconId);
    if (icon) {
      ctx.drawImage(icon, colX, cy - iconSize / 2, iconSize, iconSize);
    } else {
      fallback(iconCx, cy);
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px Inter Tight, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText(String(Math.floor(value)), colX + iconSize + 8, cy + 6);
  };
  drawRow(0, 'gold', s.inv.gold, (cx, cy) => {
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
  });
  drawRow(1, 'gem', s.inv.gems, (cx, cy) => {
    ctx.fillStyle = '#5af0ff';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 8, cy);
    ctx.lineTo(cx, cy + 8);
    ctx.lineTo(cx - 8, cy);
    ctx.closePath();
    ctx.fill();
  });
  // Essence row shows ONLY the pending pool (essence earned this run that's
  // locked until rebirth). The spendable balance lives inside the Rebirth
  // Tree overlay — the HUD doesn't need to advertise it.
  drawRow(2, 'essenceCurrency', s.pendingEssence, (cx, cy) => {
    drawEssenceStar(ctx, cx, cy, 9, '#c170ff');
  });
  drawRow(3, 'luck', s.luck, (cx, cy) => {
    drawClover(ctx, cx, cy, 12);
  });
  drawRow(4, 'dice', s.inv.rolls, (cx, cy) => {
    ctx.fillStyle = '#a0a8b8';
    ctx.fillRect(cx - 7, cy - 7, 14, 14);
    ctx.fillStyle = '#0c1018';
    ctx.fillRect(cx - 3, cy - 3, 2, 2);
    ctx.fillRect(cx + 1, cy + 1, 2, 2);
  });

  // (Spin reel / die rendered separately by drawSpinReelOrDie so they paint
  // above the HUD buttons. See Game.render — it's called after button draws.)

  if (s.spinResult) {
    const variant = SLIME_VARIANTS[s.spinResult.id];
    const rarityCol = RARITY_COLORS[variant.rarity];
    const alpha = Math.max(0, Math.min(1, s.spinResult.t / 0.4));
    ctx.globalAlpha = alpha;
    const rw = 220;
    const rh = 40;
    const rx = Math.round(WORLD.width / 2 - rw / 2);
    const topRefH = s.spinning ? SLOT_H : SPIN_BTN.h + 18;
    const ry = SPIN_BTN.y + topRefH + 12;
    ctx.fillStyle = 'rgba(10,12,18,0.92)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = rarityCol;
    ctx.lineWidth = 2;
    ctx.strokeRect(rx + 1, ry + 1, rw - 2, rh - 2);
    ctx.fillStyle = variant.body;
    ctx.beginPath();
    ctx.arc(rx + 18, ry + 20, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e6ecf3';
    ctx.font = 'bold 13px Inter Tight, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText(`+ ${variant.name}`, rx + 36, ry + 18);
    ctx.font = 'bold 10px Inter Tight, sans-serif';
    ctx.fillStyle = rarityCol;
    const extra = s.spinResult.count > 1 ? `  +${s.spinResult.count - 1} more` : '';
    ctx.fillText(RARITY_NAMES[variant.rarity].toUpperCase() + extra, rx + 36, ry + 32);

    // BONUS flash — sits above the banner with a pulsing color when triggered.
    if (s.spinResult.bonusMul > 1) {
      const pulse = 0.7 + Math.sin(s.spinResult.t * 14) * 0.3;
      ctx.save();
      ctx.globalAlpha = alpha * pulse;
      ctx.fillStyle = '#ffd24a';
      ctx.font = 'bold 18px Inter Tight, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#ffd24a';
      ctx.fillText(`BONUS ×${s.spinResult.bonusMul}`, rx + rw / 2, ry - 6);
      ctx.restore();
    }
    // 1-in-N rarity display (right-aligned)
    ctx.textAlign = 'end';
    ctx.fillStyle = '#e6ecf3';
    ctx.font = 'bold 12px Inter Tight, sans-serif';
    ctx.fillText(`1 in ${variant.rollN.toLocaleString()}`, rx + rw - 10, ry + 18);
    ctx.textAlign = 'start';
    ctx.globalAlpha = 1;
  }

  drawCollectionPanel(ctx, s);

  // Detail card for the selected variant
  if (s.selectedVariantId !== null) {
    const v = s.collection.find((vs) => vs.variantId === s.selectedVariantId);
    if (v) drawSelectedDetail(ctx, s, v);
  }
}

function detailCardRect() {
  const w = 220;
  const h = 142;
  return { x: WORLD.width - w - 10, y: PANEL_Y - h - 8, w, h };
}

// Pretty labels and palette for projectile / damage / runner ability badges.
const PROJ_LABELS: Record<string, string> = {
  bullet: 'Bullet',
  spear: 'Spear · pierces 2',
  cannonball: 'Cannonball · heavy hit',
  lazer: 'Lazer Bolt · instant',
  cluster: 'Cluster · splits ×3',
  mortar: 'Mortar · AOE + frags',
  pinball: 'Pinball · 5 bounces',
  ricochet: 'Ricochet · 2nd hit',
  driller: 'Driller · embed + ticks',
  bouncer: 'Bouncer · 3 hits',
  boomerang: 'Boomerang · out & back',
  orbiter: 'Orbiter · parks & ticks',
  skip: 'Skipping Stone · ground bounces',
};
const DMG_COLORS: Record<string, string> = {
  physical: '#a8b0c0',
  burn: '#ff7048',
  frost: '#80c8ff',
  lightning: '#c0a0ff',
  void: '#b070ff',
};
const DMG_LABELS: Record<string, string> = {
  physical: 'Physical',
  burn: 'Burn · DoT',
  frost: 'Frost · slows respawn',
  lightning: 'Lightning · chain',
  void: 'Void · ignores armor',
};
const ABILITY_LABELS: Record<string, string> = {
  sprinter: 'Sprinter · +30% speed w/ cargo',
  sorter: 'Sorter · gems only, 2× value',
  magnet: 'Magnet · pulls nearby loot',
  vacuum: 'Vacuum · auto-collects in radius',
};

function drawSelectedDetail(ctx: CanvasRenderingContext2D, s: HudState, v: VariantState) {
  const variant = SLIME_VARIANTS[v.variantId];
  const slot = currentSlotOfVariant(s, v.variantId);
  const lvl = v.level;
  const mul = levelMul(lvl);
  const nextXp = xpForNextLevel(lvl);
  const { x, y, w, h } = detailCardRect();

  ctx.fillStyle = 'rgba(10,12,18,0.92)';
  roundedRect(ctx, x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = variant.body;
  ctx.lineWidth = 1.5;
  roundedRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6);
  ctx.stroke();

  drawMiniSlime(ctx, x + 22, y + 26, variant);

  ctx.fillStyle = '#e6ecf3';
  ctx.font = 'bold 13px Inter Tight, sans-serif';
  ctx.textAlign = 'start';
  ctx.fillText(variant.name, x + 44, y + 18);

  // Sub-line: Lv N · ×count (slot tag right-aligned same row)
  ctx.font = 'bold 10px Inter Tight, sans-serif';
  ctx.fillStyle = '#b6c2d1';
  ctx.fillText(`Lv ${lvl} · ×${v.count}${v.slotted ? ` (${v.slotted} slotted)` : ''}`, x + 44, y + 32);

  // 1-in-N rarity (right-aligned, top) + slot tag (below)
  ctx.textAlign = 'end';
  ctx.font = 'bold 10px Inter Tight, sans-serif';
  ctx.fillStyle = RARITY_COLORS[variant.rarity];
  ctx.fillText(`1-in-${variant.rollN.toLocaleString()}`, x + w - 10, y + 18);
  ctx.font = 'bold 9px Inter Tight, sans-serif';
  if (slot) {
    ctx.fillStyle = slot.type === 'spitter' ? '#ff8c5a' : '#5af0ff';
    ctx.fillText(`${slot.type === 'spitter' ? 'SPT' : 'RUN'} ${slot.index + 1}`, x + w - 10, y + 32);
  } else {
    ctx.fillStyle = '#6a7080';
    ctx.fillText(v.count > v.slotted ? 'Bench' : 'None', x + w - 10, y + 32);
  }
  ctx.textAlign = 'start';

  // Compact stats — all on two lines, no role headers. Spitter color on left,
  // runner color on right so the role split is still readable.
  ctx.font = 'bold 10px Inter Tight, sans-serif';
  ctx.fillStyle = '#ff8c5a';
  ctx.fillText(`${Math.round(variant.damage * mul)} dmg`, x + 10, y + 52);
  ctx.fillStyle = '#b6c2d1';
  ctx.fillText(`${variant.fireRate}/s`, x + 60, y + 52);
  ctx.fillStyle = '#9aa4b4';
  ctx.fillText(`${variant.projectileSpeed} psp`, x + 105, y + 52);

  ctx.fillStyle = '#5af0ff';
  ctx.fillText(`${variant.moveSpeed} spd`, x + 10, y + 66);
  ctx.fillStyle = '#b6c2d1';
  ctx.fillText(`×${Math.floor(variant.carryCapacity * mul)} cap`, x + 60, y + 66);
  ctx.fillStyle = '#9aa4b4';
  ctx.fillText(`${variant.pickupTime}/${variant.dropoffTime}s`, x + 105, y + 66);

  // Ability badges row (pills wrap themselves).
  drawAbilityBadges(ctx, variant, x + 10, y + 76, w - 20);

  // XP progress bar
  const barX = x + 10;
  const barY = y + h - 20;
  const barW = w - 20;
  const barH = 11;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(barX, barY, barW, barH);
  const frac = Math.min(1, v.xp / nextXp);
  ctx.fillStyle = '#5af04a';
  ctx.fillRect(barX, barY, barW * frac, barH);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 9px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${v.xp} / ${nextXp} → Lv ${lvl + 1}`, barX + barW / 2, barY + 8);
  ctx.textAlign = 'start';
}

export function drawAbilityBadges(
  ctx: CanvasRenderingContext2D,
  variant: SlimeVariant,
  x: number,
  y: number,
  maxW: number
) {
  const badges: Array<{ label: string; color: string }> = [];
  const proj = variant.projectile ?? 'bullet';
  if (proj !== 'bullet') {
    badges.push({ label: PROJ_LABELS[proj] ?? proj, color: '#ff8c5a' });
  }
  const dmg = variant.damageType ?? 'physical';
  if (dmg !== 'physical') {
    badges.push({ label: DMG_LABELS[dmg] ?? dmg, color: DMG_COLORS[dmg] ?? '#a8b0c0' });
  }
  if (variant.critChance && variant.critChance > 0) {
    badges.push({ label: `+${Math.round(variant.critChance * 100)}% Crit ×2`, color: '#ffd24a' });
  }
  if (variant.runnerAbility) {
    badges.push({
      label: ABILITY_LABELS[variant.runnerAbility] ?? variant.runnerAbility,
      color: '#5af0ff',
    });
  }
  if (variant.antiGoon) {
    badges.push({ label: 'Goon Hunter · aims at goons, 2× dmg', color: '#d24a4a' });
  }

  if (badges.length === 0) {
    ctx.fillStyle = '#5a6070';
    ctx.font = 'italic 10px Inter Tight, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText('No special mechanics — straight stats.', x, y + 12);
    return;
  }

  // Layout badges as wrapping pills.
  ctx.font = 'bold 10px Inter Tight, sans-serif';
  ctx.textAlign = 'start';
  const padX = 6;
  const padY = 3;
  const lineH = 18;
  let curX = x;
  let curY = y;
  for (const b of badges) {
    const w = ctx.measureText(b.label).width + padX * 2;
    if (curX - x + w > maxW) {
      curX = x;
      curY += lineH + 2;
    }
    ctx.fillStyle = b.color;
    roundedRect(ctx, curX, curY, w, lineH, 4);
    ctx.fill();
    ctx.fillStyle = '#0c1018';
    ctx.fillText(b.label, curX + padX, curY + lineH - padY - 1);
    curX += w + 5;
  }
}

// drawFuseButton removed — fusion was replaced by variant leveling.

function drawCollectionPanel(ctx: CanvasRenderingContext2D, s: HudState) {
  // Background strip
  ctx.fillStyle = 'rgba(10,12,18,0.88)';
  ctx.fillRect(0, PANEL_Y, WORLD.width, PANEL_H);
  ctx.strokeStyle = '#1f2533';
  ctx.beginPath();
  ctx.moveTo(0, PANEL_Y + 0.5);
  ctx.lineTo(WORLD.width, PANEL_Y + 0.5);
  ctx.stroke();

  // Label — backpack icon if supplied, then text "COLLECTION" + count
  const bag = getIcon('collection');
  if (bag) {
    const s2 = 28;
    ctx.drawImage(bag, 8, PANEL_Y + 4, s2, s2);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Inter Tight, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText(`${s.collection.length}`, 8 + s2 + 4, PANEL_Y + 22);
  } else {
    ctx.fillStyle = '#b6c2d1';
    ctx.font = 'bold 11px Inter Tight, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText('COLLECTION', 12, PANEL_Y + 14);
    ctx.fillStyle = '#6a7080';
    ctx.font = '10px Inter Tight, sans-serif';
    ctx.fillText(`${s.collection.length} owned`, 12, PANEL_Y + 28);
  }

  // "Equip Best" button — fills slots with the top damage / haul-rate slimes.
  drawEquipBestButton(ctx, s);

  // Clip cells to the scroll viewport so partial cells don't bleed out.
  const scroll = s.collectionScroll;
  ctx.save();
  ctx.beginPath();
  ctx.rect(VIEWPORT_X, PANEL_Y, VIEWPORT_W, PANEL_H);
  ctx.clip();

  for (let i = 0; i < s.collection.length; i++) {
    const v = s.collection[i]!;
    const rect = cellRectAt(i, scroll);
    if (rect.x + rect.w < VIEWPORT_X || rect.x > VIEWPORT_RIGHT) continue;
    const variant = SLIME_VARIANTS[v.variantId];
    const selected = s.selectedVariantId === v.variantId;
    const slotted = v.slotted > 0;

    ctx.fillStyle = selected ? '#3a2e22' : 'rgba(255,255,255,0.04)';
    roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffd24a' : slotted ? variant.body : '#2a3040';
    ctx.lineWidth = selected ? 2 : 1;
    roundedRect(ctx, rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1, 6);
    ctx.stroke();

    drawMiniSlime(ctx, rect.x + rect.w / 2, rect.y + rect.h / 2 + 4, variant);

    // Stack count (top-right). Show even when count is 1 — clearer at a glance.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Inter Tight, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`×${v.count}`, rect.x + rect.w - 4, rect.y + 12);

    // Level badge (top-left) — only show once leveled past 1.
    if (v.level > 1) {
      ctx.fillStyle = '#5af04a';
      ctx.font = 'bold 9px Inter Tight, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`Lv${v.level}`, rect.x + 4, rect.y + 11);
    }

    // Slotted indicator (bottom strip). Show "Sx/y" when partially slotted.
    if (slotted) {
      ctx.fillStyle = '#5af0ff';
      ctx.font = 'bold 9px Inter Tight, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${v.slotted}/${v.count}`, rect.x + 4, rect.y + rect.h - 4);
    }
  }
  ctx.restore();

  // Edge fade gradients — only show when there's content past that edge.
  const maxScroll = collectionMaxScroll(s);
  const fadeW = 18;
  if (scroll > 1) {
    const grad = ctx.createLinearGradient(VIEWPORT_X, 0, VIEWPORT_X + fadeW, 0);
    grad.addColorStop(0, 'rgba(10,12,18,0.92)');
    grad.addColorStop(1, 'rgba(10,12,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(VIEWPORT_X, PANEL_Y + 2, fadeW, PANEL_H - 4);
  }
  if (scroll < maxScroll - 1) {
    const grad = ctx.createLinearGradient(VIEWPORT_RIGHT - fadeW, 0, VIEWPORT_RIGHT, 0);
    grad.addColorStop(0, 'rgba(10,12,18,0)');
    grad.addColorStop(1, 'rgba(10,12,18,0.92)');
    ctx.fillStyle = grad;
    ctx.fillRect(VIEWPORT_RIGHT - fadeW, PANEL_Y + 2, fadeW, PANEL_H - 4);
  }

  // Mini scrollbar at the bottom of the viewport (only if there's overflow).
  if (maxScroll > 0) {
    const contentW = collectionContentWidth(s);
    const thumbW = Math.max(20, (VIEWPORT_W * VIEWPORT_W) / contentW);
    const trackW = VIEWPORT_W - thumbW;
    const thumbX = VIEWPORT_X + (scroll / maxScroll) * trackW;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(VIEWPORT_X, SCROLLBAR_Y, VIEWPORT_W, SCROLLBAR_H);
    ctx.fillStyle = 'rgba(182, 194, 209, 0.55)';
    roundedRect(ctx, thumbX, SCROLLBAR_Y, thumbW, SCROLLBAR_H, SCROLLBAR_H / 2);
    ctx.fill();
  }
}

function cellRectAt(i: number, scroll: number) {
  return {
    x: VIEWPORT_X + i * COL_STRIDE - scroll,
    y: CELL_TOP,
    w: CELL_SIZE,
    h: CELL_SIZE,
  };
}

export function collectionContentWidth(s: HudState): number {
  if (s.collection.length === 0) return 0;
  return s.collection.length * COL_STRIDE - CELL_PAD;
}

export function collectionMaxScroll(s: HudState): number {
  return Math.max(0, collectionContentWidth(s) - VIEWPORT_W);
}

export function collectionCellRect(s: HudState, i: number) {
  return cellRectAt(i, s.collectionScroll);
}

export function hitCollectionCell(s: HudState, px: number, py: number): SlimeVariantId | null {
  if (py < CELL_TOP || py > CELL_TOP + CELL_SIZE) return null;
  if (px < VIEWPORT_X || px > VIEWPORT_RIGHT) return null;
  for (let i = 0; i < s.collection.length; i++) {
    const r = cellRectAt(i, s.collectionScroll);
    if (r.x + r.w < VIEWPORT_X || r.x > VIEWPORT_RIGHT) continue;
    if (px >= r.x && px <= r.x + r.w) return s.collection[i]!.variantId;
  }
  return null;
}

/** True if the point is inside the cell viewport (used by Game.ts to know
 *  whether to start a scroll-drag vs. some other interaction). */
export function collectionViewportContains(px: number, py: number): boolean {
  return px >= VIEWPORT_X && px <= VIEWPORT_RIGHT && py >= PANEL_Y && py <= PANEL_Y + PANEL_H;
}

const EQUIP_BTN = { x: 8, w: 88, h: 18 };
function equipBestBtnRect() {
  return { x: EQUIP_BTN.x, y: PANEL_Y + PANEL_H - EQUIP_BTN.h - 6, w: EQUIP_BTN.w, h: EQUIP_BTN.h };
}

export function equipBestBtnContains(s: HudState, px: number, py: number): boolean {
  if (s.collection.length === 0) return false;
  const r = equipBestBtnRect();
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

function drawEquipBestButton(ctx: CanvasRenderingContext2D, s: HudState) {
  if (s.collection.length === 0) return;
  const r = equipBestBtnRect();
  ctx.fillStyle = 'rgba(90, 240, 255, 0.10)';
  roundedRect(ctx, r.x, r.y, r.w, r.h, 4);
  ctx.fill();
  ctx.strokeStyle = '#5af0ff';
  ctx.lineWidth = 1;
  roundedRect(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 4);
  ctx.stroke();
  ctx.fillStyle = '#5af0ff';
  ctx.font = 'bold 10px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Equip Best', r.x + r.w / 2, r.y + 13);
  ctx.textAlign = 'start';
}

/** First slot occupied by the given variant. Returns null if no copy of
 *  this variant is slotted. */
function currentSlotOfVariant(s: HudState, variantId: SlimeVariantId): { type: SlotType; index: number } | null {
  const spIdx = s.spitterSlots.indexOf(variantId);
  if (spIdx >= 0) return { type: 'spitter', index: spIdx };
  const rnIdx = s.runnerSlots.indexOf(variantId);
  if (rnIdx >= 0) return { type: 'runner', index: rnIdx };
  return null;
}

// Draw a ghost outline of a slime for empty slots.
export function drawSlotGhost(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  size: number,
  type: SlotType,
  highlight: boolean
) {
  const r = size;
  ctx.save();
  ctx.strokeStyle = highlight
    ? type === 'spitter' ? '#ff8c5a' : '#5af0ff'
    : 'rgba(255,255,255,0.18)';
  ctx.lineWidth = highlight ? 2 : 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - r, baseY);
  ctx.quadraticCurveTo(cx - r, baseY - r * 1.4, cx, baseY - r * 1.4);
  ctx.quadraticCurveTo(cx + r, baseY - r * 1.4, cx + r, baseY);
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
  // small + glyph in the middle
  ctx.fillStyle = highlight ? (type === 'spitter' ? '#ff8c5a' : '#5af0ff') : 'rgba(255,255,255,0.3)';
  ctx.font = `bold ${Math.round(r * 0.9)}px Inter Tight, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('+', cx, baseY - r * 0.5);
  ctx.textAlign = 'start';
  ctx.restore();
}

/** Render either the spin reel(s) or the idle die, in that priority. Pulled
 *  out of `drawHUD` so it can paint AFTER the HUD button cluster (skill tree,
 *  auto roll, etc.) — the spinning reel needs to layer over buttons so it
 *  doesn't get clipped by them. */
export function drawSpinReelOrDie(ctx: CanvasRenderingContext2D, s: HudState) {
  if (s.spinning || s.bonusActive) {
    drawSlotMachine(ctx, s.slotReel, s.slotScrollFloat);
    if (s.bonusActive) {
      drawSlotMachine(ctx, s.bonusReel, s.bonusScrollFloat, SLOT_W + 12);
    }
  } else {
    drawDie(ctx, s.hoveredSpin, s.canSpin, s.spinCooldown, s.spinCooldownMax, s.dieFace, s.dieAngle);
  }
}

function drawDie(
  ctx: CanvasRenderingContext2D,
  hovered: boolean,
  canSpin: boolean,
  cooldown: number,
  _cooldownMax: number,
  face: number,
  baseAngle: number
) {
  const b = SPIN_BTN;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const scale = hovered ? 1.06 : 1;
  const size = b.w * scale;
  const half = size / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(baseAngle);
  if (hovered) {
    ctx.shadowBlur = 12;
    ctx.shadowColor = canSpin ? '#ffd24a' : '#6a6478';
  }

  const r = 10;
  const diceIcon = getIcon('dice');
  if (diceIcon) {
    // PNG die replaces the vector face + pips entirely. Dim it when on cooldown.
    if (!canSpin) ctx.globalAlpha = 0.45;
    ctx.drawImage(diceIcon, -half, -half, size, size);
    ctx.globalAlpha = 1;
  } else {
    const faceFill = !canSpin ? '#3a3640' : '#f3ead4';
    const pipColor = '#1a1620';
    ctx.fillStyle = faceFill;
    roundedRect(ctx, -half, -half, size, size, r);
    ctx.fill();
    const grad = ctx.createLinearGradient(-half, -half, half, half);
    grad.addColorStop(0, 'rgba(255,255,255,0.4)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.05)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad;
    roundedRect(ctx, -half, -half, size, size, r);
    ctx.fill();
    ctx.strokeStyle = !canSpin ? '#6a6478' : '#1a1620';
    ctx.lineWidth = 2;
    roundedRect(ctx, -half + 1, -half + 1, size - 2, size - 2, r - 1);
    ctx.stroke();
    drawPips(ctx, face, half * 0.7, pipColor);
  }
  ctx.restore();

  // "ROLL" / countdown label below the die. (The progress bar that used to
  // live here was removed — the reel-spin animation conveys the cooldown
  // visually, and the AutoRoll badge sits in the dice corner.)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(canSpin ? 'ROLL' : `${cooldown.toFixed(1)}s`, cx, b.y + b.h + 16);
  ctx.textAlign = 'start';
}

function drawBonusTile(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  mul: 2 | 4 | 8,
) {
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#ffd24a';
  ctx.fillStyle = '#ffd24a';
  ctx.font = 'bold 14px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`×${mul}`, cx, cy + 5);
  ctx.font = 'bold 7px Inter Tight, sans-serif';
  ctx.fillText('BONUS', cx, cy + 14);
  ctx.restore();
  ctx.textAlign = 'start';
}

function drawSlotMachine(
  ctx: CanvasRenderingContext2D,
  reel: ReelTile[],
  scrollFloat: number,
  offsetX = 0,
) {
  const b = SPIN_BTN;
  const cx = b.x + b.w / 2 + offsetX;
  const x = Math.round(cx - SLOT_W / 2);
  const y = b.y;

  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = '#ffd24a';
  ctx.fillStyle = '#1a1620';
  roundedRect(ctx, x, y, SLOT_W, SLOT_H, 8);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 2;
  roundedRect(ctx, x + 1, y + 1, SLOT_W - 2, SLOT_H - 2, 7);
  ctx.stroke();

  const winX = x + 6;
  const winY = y + 6;
  const winW = SLOT_W - 12;
  const winH = SLOT_H - 12;
  ctx.fillStyle = '#0c1018';
  roundedRect(ctx, winX, winY, winW, winH, 4);
  ctx.fill();

  ctx.save();
  roundedRect(ctx, winX, winY, winW, winH, 4);
  ctx.clip();

  const centerY = winY + winH / 2;
  for (let i = 0; i < reel.length; i++) {
    const itemY = centerY + (i - scrollFloat) * SLOT_ROW;
    if (itemY < winY - SLOT_ROW || itemY > winY + winH + SLOT_ROW) continue;
    const tile = reel[i]!;
    if (tile.kind === 'slime') {
      drawMiniSlime(ctx, cx, itemY, SLIME_VARIANTS[tile.id]);
    } else {
      drawBonusTile(ctx, cx, itemY, tile.mul);
    }
  }
  ctx.restore();

  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 1.5;
  roundedRect(ctx, winX, centerY - SLOT_ROW / 2, winW, SLOT_ROW, 2);
  ctx.stroke();

  ctx.fillStyle = '#ffd24a';
  ctx.beginPath();
  ctx.moveTo(x - 4, centerY);
  ctx.lineTo(x + 4, centerY - 6);
  ctx.lineTo(x + 4, centerY + 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + SLOT_W + 4, centerY);
  ctx.lineTo(x + SLOT_W - 4, centerY - 6);
  ctx.lineTo(x + SLOT_W - 4, centerY + 6);
  ctx.closePath();
  ctx.fill();
}

export function drawMiniSlime(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  v: SlimeVariant
) {
  // Bee-themed mini icon — oval body with stripes, two wings, antennae.
  // Keeps the variant body color so each tier is still color-coded at a
  // glance in the collection grid / discovery reveal.
  const r = 14;
  const bodyW = r;
  const bodyH = r * 0.75;
  // Wings (behind body)
  ctx.save();
  ctx.fillStyle = 'rgba(245, 250, 255, 0.55)';
  ctx.strokeStyle = 'rgba(110, 120, 145, 0.5)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.55, r * 0.6, r * 0.35, -0.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + r * 0.05, cy - r * 0.55, r * 0.55, r * 0.32, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Body (oval)
  ctx.fillStyle = v.body;
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Stripes
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, bodyW, bodyH, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(20, 14, 8, 0.85)';
  const sH = bodyH * 0.28;
  ctx.fillRect(cx - bodyW, cy - sH * 1.4, bodyW * 2, sH);
  ctx.fillRect(cx - bodyW, cy + sH * 0.4, bodyW * 2, sH);
  ctx.restore();

  // Highlight glint
  ctx.fillStyle = v.highlight;
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.35, cy - r * 0.35, r * 0.16, r * 0.22, -0.4, 0, Math.PI * 2);
  ctx.fill();

  // Antennae
  ctx.save();
  ctx.strokeStyle = '#1a120c';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.35, cy - bodyH * 0.85);
  ctx.quadraticCurveTo(cx - r * 0.5, cy - bodyH - r * 0.2, cx - r * 0.55, cy - bodyH - r * 0.45);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + r * 0.35, cy - bodyH * 0.85);
  ctx.quadraticCurveTo(cx + r * 0.5, cy - bodyH - r * 0.2, cx + r * 0.55, cy - bodyH - r * 0.45);
  ctx.stroke();
  ctx.fillStyle = '#1a120c';
  ctx.beginPath();
  ctx.arc(cx - r * 0.55, cy - bodyH - r * 0.45, 1.3, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.55, cy - bodyH - r * 0.45, 1.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Eyes (same placement)
  ctx.fillStyle = '#0c1018';
  ctx.beginPath();
  ctx.arc(cx - r * 0.22, cy - r * 0.1, 1.8, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.22, cy - r * 0.1, 1.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawPips(ctx: CanvasRenderingContext2D, face: number, reach: number, color: string) {
  ctx.fillStyle = color;
  const pipR = reach * 0.16;
  const a = reach * 0.55;
  const positions: Array<[number, number]> = [];
  switch (face) {
    case 1:
      positions.push([0, 0]);
      break;
    case 2:
      positions.push([-a, -a], [a, a]);
      break;
    case 3:
      positions.push([-a, -a], [0, 0], [a, a]);
      break;
    case 4:
      positions.push([-a, -a], [a, -a], [-a, a], [a, a]);
      break;
    case 5:
      positions.push([-a, -a], [a, -a], [0, 0], [-a, a], [a, a]);
      break;
    case 6:
      positions.push([-a, -a], [a, -a], [-a, 0], [a, 0], [-a, a], [a, a]);
      break;
    default:
      positions.push([0, 0]);
  }
  for (const [px, py] of positions) {
    ctx.beginPath();
    ctx.arc(px, py, pipR, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const LUCK_BADGE = { x: 18, y: 124, w: 50, h: 50 };

export function drawLuckBadge(ctx: CanvasRenderingContext2D, luck: number, time: number) {
  const b = LUCK_BADGE;
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  // Gentle bob like the tree button so it feels lively.
  const breath = 1 + Math.sin(time * 2.0 + 1.4) * 0.03;
  const r = (b.w / 2) * breath;

  ctx.save();
  ctx.shadowBlur = 10;
  ctx.shadowColor = 'rgba(90, 240, 74, 0.45)';
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 2, cx, cy, r);
  grad.addColorStop(0, '#23302a');
  grad.addColorStop(1, '#0f1818');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Ring
  ctx.strokeStyle = '#3a5a3a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.stroke();

  // Clover icon — PNG if supplied, else vector clover.
  const luckIcon = getIcon('luck');
  if (luckIcon) {
    const s = r * 1.1;
    ctx.drawImage(luckIcon, cx - 9 - s / 2, cy - 1 - s / 2, s, s);
  } else {
    drawClover(ctx, cx - 9, cy - 1, 10);
  }

  // Number (right side)
  ctx.fillStyle = '#e6ecf3';
  ctx.font = 'bold 14px Inter Tight, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(Math.floor(luck)), cx + 4, cy + 5);
  ctx.textAlign = 'start';

  // Tiny LUCK label below
  ctx.fillStyle = '#5af04a';
  ctx.font = 'bold 8px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('LUCK', cx, b.y + b.h + 10);
  ctx.textAlign = 'start';
}

function drawClover(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  // Four heart-shaped leaves arranged in a plus
  ctx.fillStyle = '#5af04a';
  const r = size * 0.62;
  const offset = size * 0.55;
  for (let i = 0; i < 4; i++) {
    const angle = Math.PI / 4 + i * (Math.PI / 2);
    const lx = cx + Math.cos(angle) * offset;
    const ly = cy + Math.sin(angle) * offset;
    ctx.beginPath();
    ctx.arc(lx, ly, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // Center darker so the four leaves read
  ctx.fillStyle = '#2a6024';
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.22, 0, Math.PI * 2);
  ctx.fill();
}

/** Six-pointed star used as the Essence-currency glyph. */
function drawEssenceStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  ctx.save();
  ctx.shadowBlur = 6;
  ctx.shadowColor = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (Math.PI / 6) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// === Reset Progress button + modal ===

// Tucked below the autoplay button on the top-left so it's reachable but
// doesn't dominate. Small + red so it reads as a destructive action.
export const RESET_BTN = { x: 12, y: 78, w: 45, h: 38 };

export function resetBtnContains(px: number, py: number): boolean {
  const r = RESET_BTN;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawResetButton(ctx: CanvasRenderingContext2D, hovered: boolean) {
  const r = RESET_BTN;
  ctx.save();
  if (hovered) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#d24a4a';
  }
  ctx.fillStyle = hovered ? 'rgba(80, 30, 30, 0.85)' : 'rgba(40, 20, 20, 0.7)';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  ctx.strokeStyle = hovered ? '#d24a4a' : '#5a3a40';
  ctx.lineWidth = 1;
  ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
  ctx.fillStyle = hovered ? '#ffb0b0' : '#a8838a';
  ctx.font = 'bold 10px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RESET', r.x + r.w / 2, r.y + 16);
  ctx.font = '8px Inter Tight, sans-serif';
  ctx.fillStyle = '#6a4a50';
  ctx.fillText('wipe save', r.x + r.w / 2, r.y + 28);
  ctx.textAlign = 'start';
}

export const RESET_MODAL_OK = { x: 0, y: 0, w: 130, h: 32 };
export const RESET_MODAL_CANCEL = { x: 0, y: 0, w: 110, h: 32 };

export function resetModalConfirmContains(px: number, py: number): boolean {
  const r = RESET_MODAL_OK;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
export function resetModalCancelContains(px: number, py: number): boolean {
  const r = RESET_MODAL_CANCEL;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawResetModal(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const w = 380;
  const h = 200;
  const x = Math.round((WORLD.width - w) / 2);
  const y = Math.round((WORLD.height - h) / 2);
  ctx.fillStyle = 'rgba(20, 12, 12, 0.97)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#d24a4a';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  ctx.fillStyle = '#ffb0b0';
  ctx.font = 'bold 20px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Wipe All Progress?', x + w / 2, y + 38);

  ctx.fillStyle = '#b6c2d1';
  ctx.font = '12px Inter Tight, sans-serif';
  ctx.fillText('This deletes your saved game permanently:', x + w / 2, y + 70);
  ctx.fillText('bees, currencies, perks, Essence, shop items.', x + w / 2, y + 88);
  ctx.fillText('No undo.', x + w / 2, y + 106);

  const btnY = y + h - 50;
  RESET_MODAL_OK.x = x + w / 2 - RESET_MODAL_OK.w - 8;
  RESET_MODAL_OK.y = btnY;
  RESET_MODAL_CANCEL.x = x + w / 2 + 8;
  RESET_MODAL_CANCEL.y = btnY;

  ctx.fillStyle = '#a83a3a';
  ctx.fillRect(RESET_MODAL_OK.x, RESET_MODAL_OK.y, RESET_MODAL_OK.w, RESET_MODAL_OK.h);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px Inter Tight, sans-serif';
  ctx.fillText('Wipe & Restart', RESET_MODAL_OK.x + RESET_MODAL_OK.w / 2, RESET_MODAL_OK.y + 21);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(RESET_MODAL_CANCEL.x, RESET_MODAL_CANCEL.y, RESET_MODAL_CANCEL.w, RESET_MODAL_CANCEL.h);
  ctx.strokeStyle = '#3a4050';
  ctx.lineWidth = 1;
  ctx.strokeRect(RESET_MODAL_CANCEL.x + 0.5, RESET_MODAL_CANCEL.y + 0.5, RESET_MODAL_CANCEL.w - 1, RESET_MODAL_CANCEL.h - 1);
  ctx.fillStyle = '#b6c2d1';
  ctx.fillText('Cancel', RESET_MODAL_CANCEL.x + RESET_MODAL_CANCEL.w / 2, RESET_MODAL_CANCEL.y + 21);
  ctx.textAlign = 'start';
}

// === Auto-Roll toggle ===

// Mirrors the SKILL TREE button on the other side of the dice. Visible only
// when the autoSpin perk is unlocked; clicking toggles auto-rolling.
// Mirrors TREE_BTN with a 24px gap from the dice so the spinning slot reel
// doesn't cover the "AUTO ROLL" label.
// Auto-roll icon tucked just to the right of the dice. Square so the icon
// reads cleanly. Renders ABOVE the idle dice but BEHIND the spinning reel
// (Game.ts inserts it on whichever side of the reel render is appropriate).
const AUTOROLL_SIZE = 36;
const AUTOROLL_OVERLAP_X = 23;   // overlap into the dice from the right
const AUTOROLL_OVERLAP_Y = 23;   // overlap into the dice from the bottom
export const AUTOROLL_BTN = {
  x: SPIN_BTN.x + SPIN_BTN.w - AUTOROLL_OVERLAP_X,
  y: SPIN_BTN.y + SPIN_BTN.h - AUTOROLL_OVERLAP_Y,
  w: AUTOROLL_SIZE,
  h: AUTOROLL_SIZE,
};

export function autoRollBtnContains(px: number, py: number): boolean {
  const r = AUTOROLL_BTN;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawAutoRollButton(
  ctx: CanvasRenderingContext2D,
  unlocked: boolean,
  on: boolean,
  hovered: boolean,
  time: number,
) {
  const r = AUTOROLL_BTN;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  if (!unlocked) ctx.globalAlpha = 0.45;
  // Background pill so the icon reads against the dice corner.
  // Soft pulse glow on the icon when active (no background rect / border).
  if (on) {
    const pulse = 0.4 + 0.4 * Math.sin(time * 4);
    ctx.shadowBlur = 10;
    ctx.shadowColor = `rgba(110, 255, 110, ${pulse})`;
  }
  // Icon — fills the full button rect. The 'autoRoll' icon is the circular-
  // arrow image; falls back to a glyph if the PNG didn't load.
  const icon = getIcon('autoRoll');
  if (icon) {
    ctx.drawImage(icon, r.x, r.y, r.w, r.h);
  } else {
    ctx.strokeStyle = on ? '#aaffaa' : (hovered ? '#ffffff' : '#cfd5e0');
    ctx.lineWidth = 2;
    const ir = Math.min(r.w, r.h) * 0.35;
    ctx.beginPath();
    ctx.arc(cx, cy, ir, 0.3 * Math.PI, 1.7 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.moveTo(cx + ir + 1.5, cy - ir * 0.55);
    ctx.lineTo(cx + ir + 1.5, cy + ir * 0.55);
    ctx.lineTo(cx + ir * 0.3, cy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  void hovered;
}

// === Rebirth button + modal ===

// Right edge, vertically centered. Stacked above the essence-tree button.
// Each is 25% smaller than the main top-cluster buttons (45×58 vs 60×78).
export const REBIRTH_BTN = { x: WORLD.width - 45 - 12, y: WORLD.height / 2 - 64, w: 45, h: 58 };

export function rebirthBtnContains(px: number, py: number): boolean {
  const r = REBIRTH_BTN;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawRebirthButton(ctx: CanvasRenderingContext2D, s: HudState, time: number) {
  drawIconBtn(ctx, {
    rect: REBIRTH_BTN,
    iconId: 'rebirth',
    label: 'REBIRTH',
    subLabel: s.rebirthUnlocked ? `+${s.rebirthPreview} ✦` : 'kill a mt.',
    hovered: s.rebirthHovered,
    active: s.rebirthUnlocked,
    glowColor: '#c170ff',
    time,
    dimmed: !s.rebirthUnlocked,
  });
}

export const REBIRTH_MODAL_OK = { x: 0, y: 0, w: 110, h: 32 };
export const REBIRTH_MODAL_CANCEL = { x: 0, y: 0, w: 110, h: 32 };

export function drawRebirthModal(ctx: CanvasRenderingContext2D, s: HudState) {
  // Dim everything behind the modal.
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const w = 360;
  const h = 200;
  const x = Math.round((WORLD.width - w) / 2);
  const y = Math.round((WORLD.height - h) / 2);
  ctx.fillStyle = 'rgba(15, 10, 25, 0.96)';
  roundedRect(ctx, x, y, w, h, 8);
  ctx.fill();
  ctx.strokeStyle = '#c170ff';
  ctx.lineWidth = 2;
  roundedRect(ctx, x + 1, y + 1, w - 2, h - 2, 8);
  ctx.stroke();

  ctx.fillStyle = '#f0d8ff';
  ctx.font = 'bold 20px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Rebirth?', x + w / 2, y + 30);

  ctx.fillStyle = '#b6c2d1';
  ctx.font = '12px Inter Tight, sans-serif';
  ctx.fillText('Resets pollen, gems, mountain level, and skill tree.', x + w / 2, y + 56);
  ctx.fillText('Bees, Essence, and Essence-tree upgrades persist.', x + w / 2, y + 74);

  // Payout preview
  ctx.font = 'bold 24px Inter Tight, sans-serif';
  drawEssenceStar(ctx, x + w / 2 - 50, y + 110, 10, '#c170ff');
  ctx.fillStyle = '#f0d8ff';
  ctx.fillText(`+${s.rebirthPreview}`, x + w / 2 + 8, y + 117);

  // Buttons — positioned and stored so the click handler can hit-test them
  const btnY = y + h - 50;
  REBIRTH_MODAL_OK.x = x + w / 2 - REBIRTH_MODAL_OK.w - 8;
  REBIRTH_MODAL_OK.y = btnY;
  REBIRTH_MODAL_CANCEL.x = x + w / 2 + 8;
  REBIRTH_MODAL_CANCEL.y = btnY;

  ctx.fillStyle = '#3a2855';
  roundedRect(ctx, REBIRTH_MODAL_OK.x, REBIRTH_MODAL_OK.y, REBIRTH_MODAL_OK.w, REBIRTH_MODAL_OK.h, 4);
  ctx.fill();
  ctx.strokeStyle = '#c170ff';
  ctx.lineWidth = 1.5;
  roundedRect(ctx, REBIRTH_MODAL_OK.x + 0.5, REBIRTH_MODAL_OK.y + 0.5, REBIRTH_MODAL_OK.w - 1, REBIRTH_MODAL_OK.h - 1, 4);
  ctx.stroke();
  ctx.fillStyle = '#f0d8ff';
  ctx.font = 'bold 13px Inter Tight, sans-serif';
  ctx.fillText('Confirm', REBIRTH_MODAL_OK.x + REBIRTH_MODAL_OK.w / 2, REBIRTH_MODAL_OK.y + 20);

  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  roundedRect(ctx, REBIRTH_MODAL_CANCEL.x, REBIRTH_MODAL_CANCEL.y, REBIRTH_MODAL_CANCEL.w, REBIRTH_MODAL_CANCEL.h, 4);
  ctx.fill();
  ctx.strokeStyle = '#3a4050';
  roundedRect(ctx, REBIRTH_MODAL_CANCEL.x + 0.5, REBIRTH_MODAL_CANCEL.y + 0.5, REBIRTH_MODAL_CANCEL.w - 1, REBIRTH_MODAL_CANCEL.h - 1, 4);
  ctx.stroke();
  ctx.fillStyle = '#b6c2d1';
  ctx.fillText('Cancel', REBIRTH_MODAL_CANCEL.x + REBIRTH_MODAL_CANCEL.w / 2, REBIRTH_MODAL_CANCEL.y + 20);

  ctx.textAlign = 'start';
}

export function rebirthModalConfirmContains(px: number, py: number): boolean {
  const r = REBIRTH_MODAL_OK;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}
export function rebirthModalCancelContains(px: number, py: number): boolean {
  const r = REBIRTH_MODAL_CANCEL;
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

/** Uniform "floating icon + white label below" button style used by all HUD
 *  buttons. No chrome — just the icon, scaled to fill, with the label centered
 *  underneath. Hovered → mild scale-up; active → soft glow. Falls back to
 *  `fallback(ctx, cx, cy, r)` when the PNG isn't present. */
export interface IconBtnOpts {
  rect: { x: number; y: number; w: number; h: number };
  iconId: IconId;
  label: string;
  subLabel?: string;
  hovered: boolean;
  active: boolean;
  /** Color used for the activation glow + label highlight when active. */
  glowColor?: string;
  /** Vector glyph to draw when the PNG is missing. */
  fallback?: (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => void;
  /** Time in seconds — used for subtle breathing on active buttons. */
  time?: number;
  /** Visually dim the whole button (e.g. rebirth before unlock). */
  dimmed?: boolean;
}

export function drawIconBtn(ctx: CanvasRenderingContext2D, o: IconBtnOpts) {
  const { rect: r, iconId, label, subLabel, hovered, active, glowColor, fallback, dimmed } = o;
  const iconArea = Math.min(r.w, r.h - 18); // leave room for label
  const cx = r.x + r.w / 2;
  const cy = r.y + iconArea / 2;
  const breath = active && o.time !== undefined ? 1 + Math.sin(o.time * 3) * 0.04 : 1;
  const scale = (hovered ? 1.08 : 1) * breath;
  const s = iconArea * scale;

  ctx.save();
  if (dimmed) ctx.globalAlpha = 0.4;
  if (active && glowColor) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = glowColor;
  }
  const icon = getIcon(iconId);
  if (icon) {
    ctx.drawImage(icon, cx - s / 2, cy - s / 2, s, s);
  } else if (fallback) {
    fallback(ctx, cx, cy, s * 0.5);
  }
  ctx.restore();

  // Always-white label underneath (per design spec).
  ctx.fillStyle = dimmed ? '#6a7080' : '#ffffff';
  ctx.font = 'bold 11px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, r.y + iconArea + 10);
  if (subLabel) {
    ctx.fillStyle = dimmed ? '#5a6070' : '#ffffff';
    ctx.font = '9px Inter Tight, sans-serif';
    ctx.fillText(subLabel, cx, r.y + iconArea + 22);
  }
  ctx.textAlign = 'start';
}

// === Shared close button for full-screen overlays =======================
const CLOSE_BTN_SIZE = 32;

/** Returns the rect for an overlay's close button — top-right corner of the
 *  overlay panel, inset so it stays inside the canvas. */
export function closeBtnRect(panel: { x: number; y: number; w: number; h: number }) {
  return {
    x: panel.x + panel.w - CLOSE_BTN_SIZE - 10,
    y: panel.y + 10,
    w: CLOSE_BTN_SIZE,
    h: CLOSE_BTN_SIZE,
  };
}

export function closeBtnContains(panel: { x: number; y: number; w: number; h: number }, px: number, py: number): boolean {
  const r = closeBtnRect(panel);
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function drawCloseBtn(ctx: CanvasRenderingContext2D, panel: { x: number; y: number; w: number; h: number }, hovered: boolean) {
  const r = closeBtnRect(panel);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  ctx.save();
  if (hovered) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#ff5050';
  }
  const icon = getIcon('close');
  if (icon) {
    const s = hovered ? r.w + 4 : r.w;
    ctx.drawImage(icon, cx - s / 2, cy - s / 2, s, s);
  } else {
    // Vector fallback: red circle with a white X.
    ctx.fillStyle = hovered ? '#d24a4a' : '#a83a3a';
    ctx.beginPath();
    ctx.arc(cx, cy, r.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    const off = r.w * 0.22;
    ctx.beginPath();
    ctx.moveTo(cx - off, cy - off);
    ctx.lineTo(cx + off, cy + off);
    ctx.moveTo(cx + off, cy - off);
    ctx.lineTo(cx - off, cy + off);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function spinBtnContains(px: number, py: number) {
  const b = SPIN_BTN;
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

// Returns true if the point is inside the collection panel area (so callers know
// it's not a world click).
export function panelContains(_px: number, py: number) {
  return py >= PANEL_Y;
}

export { SLOT_LIMITS };
