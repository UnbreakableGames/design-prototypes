// New-variant discovery celebration. Plays a one-shot animation when a slime
// the player has never owned before lands. The reveal fades in a dim backdrop,
// zooms the slime up from the center with a tier-colored aura + sparkles, then
// slides in the name banner. Rarer tiers play longer and bigger.

import type { SlimeVariantId } from '../game/types';
import { RARITIES, RARITY_COLORS, RARITY_NAMES, SLIME_VARIANTS, WORLD } from '../game/types';
import { drawAbilityBadges, drawMiniSlime } from './HUD';

export interface DiscoveryRevealState {
  variantId: SlimeVariantId;
  /** Elapsed time in seconds since reveal started. */
  t: number;
  /** Total duration. Scales with rarity tier so legendaries/mythics hold longer. */
  duration: number;
}

/** Pick a reveal duration appropriate for the tier of the variant. */
export function durationFor(variantId: SlimeVariantId): number {
  const idx = RARITIES.indexOf(SLIME_VARIANTS[variantId].rarity);
  if (idx <= 1) return 2.5;          // common / uncommon
  if (idx <= 3) return 3.0;          // rare / epic
  if (idx <= 5) return 3.6;          // legendary / mythic
  if (idx <= 8) return 4.0;          // divine / prismatic / transcendent
  return 4.6;                        // ethereal+
}

export function drawDiscoveryReveal(
  ctx: CanvasRenderingContext2D,
  state: DiscoveryRevealState,
) {
  const v = SLIME_VARIANTS[state.variantId];
  if (!v) return;
  const frac = Math.min(1, state.t / state.duration);
  // Phase shape: 0-15% fade in, 15-40% zoom, 40-80% hold, 80-100% fade out.
  const fadeIn = Math.min(1, frac / 0.15);
  const fadeOut = frac > 0.8 ? 1 - (frac - 0.8) / 0.2 : 1;
  const alpha = Math.min(fadeIn, fadeOut);
  const zoomT = Math.min(1, Math.max(0, (frac - 0.15) / 0.25));
  const zoom = easeOutBack(zoomT);
  const time = state.t;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Dim backdrop — clicks on this trigger the skip handler in Game.ts.
  ctx.fillStyle = 'rgba(6, 8, 14, 0.82)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  const tierColor = RARITY_COLORS[v.rarity];
  const cx = WORLD.width / 2;
  const cy = WORLD.height / 2 - 16;

  // Radial tier-color aura behind the slime. Rotates subtly for life.
  const auraR = 130 + Math.sin(time * 1.4) * 6;
  const aura = ctx.createRadialGradient(cx, cy, 0, cx, cy, auraR);
  aura.addColorStop(0, hexA(tierColor, 0.55));
  aura.addColorStop(0.6, hexA(tierColor, 0.18));
  aura.addColorStop(1, hexA(tierColor, 0));
  ctx.fillStyle = aura;
  ctx.beginPath();
  ctx.arc(cx, cy, auraR * zoom, 0, Math.PI * 2);
  ctx.fill();

  // Rotating starburst rays (8 rays of soft tier color).
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 0.4);
  ctx.fillStyle = hexA(tierColor, 0.10 + 0.05 * Math.sin(time * 3));
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    const len = (90 + 30 * Math.sin(time * 2 + i)) * zoom;
    ctx.moveTo(0, 0);
    ctx.lineTo(len, -10);
    ctx.lineTo(len + 14, 0);
    ctx.lineTo(len, 10);
    ctx.closePath();
    ctx.fill();
    ctx.rotate(Math.PI / 4);
  }
  ctx.restore();

  // Sparkle particles spiraling around the slime.
  const sparkleCount = 14;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < sparkleCount; i++) {
    const a = time * 2 + (i * Math.PI * 2) / sparkleCount;
    const r = (60 + 18 * Math.sin(time * 1.5 + i * 0.7)) * zoom;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a * 1.2) * r * 0.6;
    const s = 1.2 + 0.8 * Math.sin(time * 4 + i);
    ctx.globalAlpha = alpha * (0.6 + 0.4 * Math.sin(time * 3 + i));
    ctx.beginPath();
    ctx.arc(x, y, s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = alpha;

  // The slime itself — drawn via drawMiniSlime but scaled up dramatically.
  ctx.save();
  ctx.translate(cx, cy + 14);
  const scale = 4 * zoom;
  ctx.scale(scale, scale);
  drawMiniSlime(ctx, 0, 0, v);
  ctx.restore();

  // "NEW DISCOVERY" header at top — slides down from above.
  const headerT = Math.min(1, Math.max(0, (frac - 0.2) / 0.2));
  const headerY = 70 + (1 - easeOutCubic(headerT)) * -40;
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 28px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha * headerT;
  ctx.fillText('NEW DISCOVERY!', cx, headerY);
  ctx.globalAlpha = alpha;

  // Variant name — slides up from below + tier label below it.
  const nameT = Math.min(1, Math.max(0, (frac - 0.3) / 0.2));
  const baseNameY = cy + 110;
  const nameY = baseNameY + (1 - easeOutCubic(nameT)) * 30;
  ctx.globalAlpha = alpha * nameT;
  ctx.fillStyle = '#f0f4f8';
  ctx.font = '700 32px system-ui, sans-serif';
  ctx.fillText(v.name, cx, nameY);
  // Tier + rarity line
  ctx.fillStyle = tierColor;
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillText(`${RARITY_NAMES[v.rarity].toUpperCase()} · 1-in-${v.rollN.toLocaleString()}`, cx, nameY + 28);
  ctx.globalAlpha = alpha;

  // Ability badges — only fade in once the variant name has finished sliding.
  // Centered horizontally below the rarity line; skipped entirely when the
  // bee has nothing special to advertise.
  const badgeT = Math.min(1, Math.max(0, (frac - 0.4) / 0.2));
  if (badgeT > 0.05) {
    ctx.globalAlpha = alpha * badgeT;
    const BADGE_AREA_W = 360;
    drawAbilityBadges(ctx, v, cx - BADGE_AREA_W / 2, nameY + 44, BADGE_AREA_W);
    ctx.globalAlpha = alpha;
  }

  // Bottom hint (only after the reveal has settled).
  if (frac > 0.5 && frac < 0.85) {
    const hintAlpha = (frac > 0.7 ? (1 - (frac - 0.7) / 0.15) : (frac - 0.5) / 0.2);
    ctx.globalAlpha = alpha * Math.max(0, Math.min(1, hintAlpha)) * 0.7;
    ctx.fillStyle = '#a8b4c0';
    ctx.font = '500 12px system-ui, sans-serif';
    ctx.fillText('click to continue', cx, WORLD.height - 56);
  }

  ctx.restore();
}

function easeOutBack(t: number): number {
  // Slight overshoot for the zoom-in — feels punchy.
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}
