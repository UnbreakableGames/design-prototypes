import {
  Hero,
  HERO_SWING_ARC,
  HERO_SWING_FLASH,
} from '../entities/Hero';
import { WorldMap, Decoration } from '../world/Map';
import { ResourceNode } from '../entities/ResourceNode';
import { Campfire } from '../entities/Campfire';
import { Clock } from '../game/Clock';
import { Enemy, ENEMY_STATS } from '../entities/Enemy';
import { Recruit, RECRUIT_RADIUS, RESCUE_COST } from '../entities/Recruit';
import { Station, StationKind, STATION_STATS, effectiveStats, nextUpgradeCost, MAX_STATION_LEVEL, hireAnchorOffset, upgradeAnchorOffset, prereqMet, stationUpgradeBlockReason, describeNextUpgrade } from '../entities/Station';
import { Projectile } from '../entities/Projectile';
import { Coin } from '../entities/Coin';
import { FlyingCoin, flyingCoinPos } from '../entities/FlyingCoin';
import { Portal, PORTAL_RADIUS } from '../entities/Portal';
import { POI, POI_INTERACT_DURATION, POI_LABELS, POI_HINTS } from '../entities/POI';
import { UI_COLORS, UI_FONTS, drawSmallCaps, drawCoinIcon } from '../ui/HUD';

export function drawWorld(ctx: CanvasRenderingContext2D, map: WorldMap, hero: Hero) {
  ctx.fillStyle = '#7bc96f';
  ctx.fillRect(0, 0, map.width, map.height);

  for (const d of map.decorations) drawDecoration(ctx, d);
  for (const n of map.nodes) drawNode(ctx, n, n.id === hero.chopTarget);
}

function drawDecoration(ctx: CanvasRenderingContext2D, d: Decoration) {
  if (d.kind === 'rock') {
    ctx.fillStyle = '#8a8a8a';
    ctx.beginPath();
    ctx.arc(d.x, d.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a8a8a8';
    ctx.beginPath();
    ctx.arc(d.x - 2, d.y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawNode(ctx: CanvasRenderingContext2D, n: ResourceNode, active: boolean) {
  const shakeX = active ? (Math.random() - 0.5) * 1.8 : 0;
  const shakeY = active ? (Math.random() - 0.5) * 1.8 : 0;
  const x = n.x + shakeX;
  const y = n.y + shakeY;

  if (n.kind === 'tree') {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x - 3, y - 4, 6, 10);
    ctx.fillStyle = '#3f7a3f';
    ctx.beginPath();
    ctx.arc(x, y - 8, 14, 0, Math.PI * 2);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#4da857';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    if (active) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(x - 3, y - 1, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 2.5, y + 2, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 1, y - 3, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (n.hp < n.maxHp) {
    const barW = 20;
    const barH = 3;
    const bx = n.x - barW / 2;
    const by = n.y - (n.kind === 'tree' ? 28 : 14);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#9acb56';
    ctx.fillRect(bx, by, barW * (n.hp / n.maxHp), barH);
  }
}

export function drawHero(ctx: CanvasRenderingContext2D, hero: Hero) {
  ctx.save();
  if (hero.invulnTimer > 0) {
    // Fast flicker during respawn invulnerability.
    const visible = Math.floor(hero.invulnTimer * 12) % 2 === 0;
    ctx.globalAlpha = visible ? 0.85 : 0.35;
  }
  const hit = hero.hitFlash > 0;
  ctx.fillStyle = hit ? '#ffb0b0' : '#4da6ff';
  ctx.beginPath();
  ctx.arc(hero.x, hero.y, hero.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hit ? '#5a1a1a' : '#1e3a5f';
  ctx.lineWidth = 2;
  ctx.stroke();

  const fx = hero.x + Math.cos(hero.facing) * (hero.radius + 4);
  const fy = hero.y + Math.sin(hero.facing) * (hero.radius + 4);
  ctx.fillStyle = '#1e3a5f';
  ctx.beginPath();
  ctx.arc(fx, fy, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawAttackFlash(ctx: CanvasRenderingContext2D, hero: Hero, range: number) {
  if (hero.attackFlash <= 0) return;
  const alpha = hero.attackFlash / HERO_SWING_FLASH;
  ctx.save();
  ctx.translate(hero.x, hero.y);
  ctx.rotate(hero.facing);
  ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * alpha})`;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, range, -HERO_SWING_ARC / 2, HERO_SWING_ARC / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * alpha})`;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

// Small strip of consumable buttons shown just below the campfire when the
// hero is close enough to buy one. Each button shows its hotkey, cost, and an
// affordability state. Active effects (flare / rally) render their own status
// chip above the campfire.
export function drawConsumableChips(
  ctx: CanvasRenderingContext2D,
  consumables: Array<{
    id: string;
    label: string;
    cost: number;
    keyHint: string;
    tint: string;
  }>,
  fire: { x: number; y: number },
  hero: { x: number; y: number },
  coin: number,
  showRadius: number,
  flareTime: number,
  rallyTime: number,
) {
  const d = Math.hypot(fire.x - hero.x, fire.y - hero.y);
  if (d > showRadius) return;

  const gap = 6;
  const chipW = 84;
  const chipH = 34;
  const totalW = consumables.length * chipW + (consumables.length - 1) * gap;
  const startX = fire.x - totalW / 2;
  const y = fire.y + 28;

  for (let i = 0; i < consumables.length; i++) {
    const c = consumables[i];
    const x = startX + i * (chipW + gap);
    const isActive =
      (c.id === 'flare' && flareTime > 0) ||
      (c.id === 'rally' && rallyTime > 0);
    const affordable = coin >= c.cost && !isActive;

    ctx.save();
    if (isActive) ctx.globalAlpha = 0.55;
    ctx.fillStyle = affordable ? 'rgba(12, 14, 22, 0.92)' : 'rgba(12, 14, 22, 0.7)';
    ctx.fillRect(x, y, chipW, chipH);
    ctx.fillStyle = affordable ? c.tint : 'rgba(154, 149, 137, 0.6)';
    ctx.fillRect(x, y, chipW, 2);

    // Keybind box.
    ctx.fillStyle = affordable ? 'rgba(39, 42, 61, 0.9)' : 'rgba(20, 22, 34, 0.8)';
    ctx.fillRect(x + 6, y + 6, 14, 14);
    ctx.strokeStyle = affordable
      ? 'rgba(234, 223, 196, 0.3)'
      : 'rgba(154, 149, 137, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 6.5, y + 6.5, 13, 13);
    ctx.fillStyle = affordable ? UI_COLORS.cream : UI_COLORS.inkDim;
    ctx.font = `700 10px ${UI_FONTS.mono}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.keyHint, x + 13, y + 14);

    // Label.
    ctx.fillStyle = affordable ? c.tint : UI_COLORS.inkDim;
    ctx.font = `italic 700 12px ${UI_FONTS.serif}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(c.label, x + 24, y + 16);

    // Cost or "active" status row.
    ctx.fillStyle = isActive
      ? c.tint
      : affordable
      ? UI_COLORS.gold
      : UI_COLORS.red;
    ctx.font = `700 9px ${UI_FONTS.mono}`;
    ctx.fillText(isActive ? 'ACTIVE' : `${c.cost}c`, x + 24, y + 28);

    ctx.restore();
  }
}

export function drawActiveConsumableStatus(
  ctx: CanvasRenderingContext2D,
  fire: { x: number; y: number },
  flareTime: number,
  rallyTime: number,
) {
  const active: Array<{ label: string; remaining: number; tint: string }> = [];
  if (flareTime > 0) active.push({ label: 'Flare', remaining: flareTime, tint: '#ffe082' });
  if (rallyTime > 0) active.push({ label: 'Rally', remaining: rallyTime, tint: '#4da6ff' });
  if (active.length === 0) return;

  const chipW = 82;
  const chipH = 18;
  const gap = 6;
  const totalW = active.length * chipW + (active.length - 1) * gap;
  const startX = fire.x - totalW / 2;
  const y = fire.y - 56;

  for (let i = 0; i < active.length; i++) {
    const a = active[i];
    const x = startX + i * (chipW + gap);
    ctx.save();
    ctx.fillStyle = 'rgba(12, 14, 22, 0.92)';
    ctx.fillRect(x, y, chipW, chipH);
    ctx.fillStyle = a.tint;
    ctx.fillRect(x, y, 2, chipH);
    ctx.fillStyle = a.tint;
    ctx.font = `italic 700 11px ${UI_FONTS.serif}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(a.label, x + 8, y + chipH / 2);
    ctx.fillStyle = UI_COLORS.creamDim;
    ctx.font = `500 9.5px ${UI_FONTS.mono}`;
    ctx.textAlign = 'right';
    ctx.fillText(`${a.remaining.toFixed(1)}s`, x + chipW - 6, y + chipH / 2);
    ctx.restore();
  }
}

export function drawBurnFx(
  ctx: CanvasRenderingContext2D,
  fire: { x: number; y: number },
  time: number,
  duration: number,
  radius: number,
) {
  const t = 1 - time / duration;
  const alpha = Math.max(0, 1 - t);
  ctx.save();
  ctx.strokeStyle = `rgba(255, 90, 90, ${0.85 * alpha})`;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(fire.x, fire.y, radius * t, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = `rgba(255, 154, 85, ${0.5 * alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(fire.x, fire.y, radius * t * 0.85, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawCampfireUpgradeHint(
  ctx: CanvasRenderingContext2D,
  fire: Campfire,
  hero: Hero,
  stations: Station[],
  isNight: boolean,
) {
  const nextCost = fire.nextUpgradeCost();
  if (nextCost === null) return;
  if (isNight) return;
  if (fire.upgradeBlockReason(stations) !== null) return;
  if (fire.readyTimer > 0) return;
  const d = Math.hypot(fire.x - hero.x, fire.y - hero.y);
  if (d > INDICATOR_RADIUS) return;
  drawUpgradeSlots(ctx, fire.x, fire.y - 38, fire.upgradeProgress, nextCost, fire.level + 1);
}

export function drawCampfire(ctx: CanvasRenderingContext2D, fire: Campfire) {
  const glowR = 34 + Math.sin(fire.flicker) * 2;
  const glow = ctx.createRadialGradient(fire.x, fire.y, 4, fire.x, fire.y, glowR);
  glow.addColorStop(0, 'rgba(255, 180, 80, 0.65)');
  glow.addColorStop(1, 'rgba(255, 140, 40, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(fire.x - glowR, fire.y - glowR, glowR * 2, glowR * 2);

  ctx.fillStyle = '#4a2f1a';
  ctx.fillRect(fire.x - 12, fire.y + 3, 24, 4);
  ctx.save();
  ctx.translate(fire.x, fire.y + 5);
  ctx.rotate(Math.PI / 3);
  ctx.fillStyle = '#4a2f1a';
  ctx.fillRect(-12, -2, 24, 4);
  ctx.restore();

  const f = 1 + Math.sin(fire.flicker) * 0.15;
  ctx.fillStyle = '#ffb940';
  ctx.beginPath();
  ctx.ellipse(fire.x, fire.y - 4, 6 * f, 11 * f, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff6b40';
  ctx.beginPath();
  ctx.ellipse(fire.x, fire.y - 2, 3.5 * f, 7 * f, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.ellipse(fire.x, fire.y - 5, 1.8 * f, 3.5 * f, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function drawEnemies(ctx: CanvasRenderingContext2D, enemies: Enemy[]) {
  for (const e of enemies) drawEnemy(ctx, e);
}

function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
  const stats = ENEMY_STATS[e.kind];
  const flash = e.hitFlash > 0;
  const body = bodyColor(e.kind, flash);
  const outline = flash ? '#fff' : '#3a1410';

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(e.x, e.y, stats.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = outline;
  ctx.lineWidth = e.kind === 'boss' ? 2.5 : 1.5;
  ctx.stroke();

  // Bosses get horns + glowing red eyes for extra menace.
  if (e.kind === 'boss') {
    const r = stats.radius;
    ctx.fillStyle = flash ? '#fff' : '#1a0303';
    ctx.beginPath();
    ctx.moveTo(e.x - 10, e.y - r + 2);
    ctx.lineTo(e.x - 6, e.y - r - 10);
    ctx.lineTo(e.x - 3, e.y - r + 4);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(e.x + 10, e.y - r + 2);
    ctx.lineTo(e.x + 6, e.y - r - 10);
    ctx.lineTo(e.x + 3, e.y - r + 4);
    ctx.closePath();
    ctx.fill();
    // Fanged mouth
    ctx.strokeStyle = flash ? '#000' : '#ff4a4a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(e.x - 6, e.y + 6);
    ctx.lineTo(e.x - 3, e.y + 10);
    ctx.lineTo(e.x, e.y + 6);
    ctx.lineTo(e.x + 3, e.y + 10);
    ctx.lineTo(e.x + 6, e.y + 6);
    ctx.stroke();
    // Glowing eyes
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.arc(e.x - 5, e.y - 2, 2.5, 0, Math.PI * 2);
    ctx.arc(e.x + 5, e.y - 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(e.x - 5, e.y - 2, 1.1, 0, Math.PI * 2);
    ctx.arc(e.x + 5, e.y - 2, 1.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.x - 2.5, e.y - 1, 1.6, 0, Math.PI * 2);
    ctx.arc(e.x + 2.5, e.y - 1, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(e.x - 2.5, e.y - 1, 0.8, 0, Math.PI * 2);
    ctx.arc(e.x + 2.5, e.y - 1, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (e.hp < e.maxHp) {
    const bw = 22;
    const bh = 3;
    const bx = e.x - bw / 2;
    const by = e.y - stats.radius - 8;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), bh);
  }
}

function bodyColor(kind: Enemy['kind'], flash: boolean): string {
  if (flash) return '#fff';
  switch (kind) {
    case 'runner': return '#c0392b';
    case 'brute': return '#6b2b1a';
    case 'flyer': return '#a43cff';
    case 'boss': return '#2a0606';
  }
}

export function drawRecruits(ctx: CanvasRenderingContext2D, recruits: Recruit[]) {
  for (const r of recruits) drawRecruit(ctx, r);
}

export function drawWandererSlots(
  ctx: CanvasRenderingContext2D,
  recruits: Recruit[],
  hero: Hero,
) {
  for (const r of recruits) {
    if (r.status !== 'wandering') continue;
    if (Math.hypot(r.x - hero.x, r.y - hero.y) > INDICATOR_RADIUS) continue;
    drawCostSlots(ctx, r.x, r.y - RECRUIT_RADIUS - 14, r.rescueProgress, RESCUE_COST);
  }
}

function drawRecruit(ctx: CanvasRenderingContext2D, r: Recruit) {
  const wandering = r.status === 'wandering';
  ctx.fillStyle = wandering ? '#d8cbb4' : '#ffe9a8';
  ctx.beginPath();
  ctx.arc(r.x, r.y, RECRUIT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = wandering ? '#7a6a4f' : '#2a1a0a';
  ctx.lineWidth = 1.2;
  ctx.stroke();

  ctx.fillStyle = wandering ? '#7a6a4f' : '#6b4a2b';
  ctx.beginPath();
  ctx.ellipse(r.x, r.y - RECRUIT_RADIUS, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(r.x - 1.8, r.y, 0.8, 0, Math.PI * 2);
  ctx.arc(r.x + 1.8, r.y, 0.8, 0, Math.PI * 2);
  ctx.fill();

  if (wandering) {
    ctx.fillStyle = 'rgba(255, 230, 120, 0.9)';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('?', r.x, r.y - RECRUIT_RADIUS - 5);
    ctx.textAlign = 'start';
  }

  if (r.carriedCoins > 0) {
    const cy = r.y - RECRUIT_RADIUS - 12;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.beginPath();
    const pw = 26;
    const ph = 14;
    if (ctx.roundRect) {
      ctx.roundRect(r.x - pw / 2, cy - ph / 2, pw, ph, 7);
    } else {
      ctx.rect(r.x - pw / 2, cy - ph / 2, pw, ph);
    }
    ctx.fill();

    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(r.x - 6, cy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a88314';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(r.carriedCoins), r.x - 1, cy);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}

const INDICATOR_RADIUS = 130;

export function drawStations(
  ctx: CanvasRenderingContext2D,
  stations: Station[],
  payTargetId: number | null,
  hero: Hero,
  campfireLevel: number,
  isNight: boolean,
) {
  for (const s of stations) {
    if (!prereqMet(s.kind, stations, campfireLevel)) continue;
    drawStation(ctx, s.kind, s.x, s.y, !s.active);
  }
  for (const s of stations) {
    if (!prereqMet(s.kind, stations, campfireLevel)) continue;
    const nearEnough =
      Math.hypot(s.x - hero.x, s.y - hero.y) < INDICATOR_RADIUS;

    if (!s.active) {
      const isFresh = s.readyTimer > 0;
      // Builds are paused at night — hide the cost pips and show a soft "paused"
      // glyph above the ghost so the player knows why nothing is happening.
      // Freshly-spawned ghosts (respawn or first-built) also hold off briefly
      // before showing cost pips.
      if (nearEnough && !isNight && !isFresh) {
        const total = STATION_STATS[s.kind].cost;
        const yOffset = s.kind === 'wall' ? -22 : -40;
        drawCostSlots(ctx, s.x, s.y + yOffset, total - s.buildRemaining, total);
      }
      if (nearEnough && isNight) {
        drawNightLock(ctx, s.x, s.y + (s.kind === 'wall' ? -22 : -36));
      }
      if (isFresh) drawSettlingPulse(ctx, s);
      if (s.id === payTargetId) drawPayTargetRing(ctx, s, '#ffd95a');
      continue;
    }
    const eff = effectiveStats(s);
    const committed = s.recruitIds.length + s.paidSlots;
    const hasOpenSlot = eff.capacity > 0 && committed < eff.capacity;

    // Indicators are suppressed during the post-build/upgrade grace period so
    // the player doesn't accidentally continue dripping coins in.
    if (nearEnough && s.readyTimer <= 0) {
      if (hasOpenSlot) {
        const a = hireAnchorOffset(s.kind);
        if (a) {
          drawHireSlots(
            ctx,
            s.x + a.dx,
            s.y + a.dy,
            s.hireProgress,
            STATION_STATS[s.kind].hireCost,
            eff.capacity - committed,
          );
        }
      }
      const upCost = nextUpgradeCost(s, campfireLevel);
      if (upCost !== null && !isNight) {
        const a = upgradeAnchorOffset(s.kind);
        drawUpgradeSlots(
          ctx,
          s.x + a.dx,
          s.y + a.dy,
          s.upgradeProgress,
          upCost,
          s.level + 1,
        );
      }
    }
    if (s.readyTimer > 0) {
      drawSettlingPulse(ctx, s);
    }
    if (s.repairFx > 0) drawRepairFx(ctx, s);
    if (s.unpaidFx > 0) drawUnpaidMark(ctx, s);
    if (eff.capacity > 0 && s.paidSlots > 0) {
      drawPendingSlotDots(ctx, s.x, s.y - 26, s.paidSlots);
    }
    if (s.kind === 'wall' && s.hp < s.maxHp) {
      drawWallHp(ctx, s);
    }
    if (s.level > 1) {
      drawLevelPips(ctx, s);
    }
    if (s.id === payTargetId) drawPayTargetRing(ctx, s, '#f2c94c');
  }
}

function drawUpgradeSlots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  filled: number,
  total: number,
  nextLevel: number,
) {
  drawCostSlots(ctx, cx, cy, filled, total);
  ctx.save();
  ctx.fillStyle = 'rgba(255, 217, 90, 0.9)';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const rows = Math.ceil(total / SLOTS_PER_ROW);
  const rowH = SLOT_ROW_H;
  const slotsPerRow = Math.min(total, SLOTS_PER_ROW);
  const totalW = slotsPerRow * (SLOT_RADIUS * 2 + 2) - 2;
  const labelX = cx + totalW / 2 + 5;
  const topY = cy - ((rows - 1) / 2) * rowH;
  ctx.fillText(`\u21E7L${nextLevel}`, labelX, topY);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// Small crescent-moon chip shown above ghost buildings when it's night so the
// player can see why the cost pips aren't appearing.
function drawNightLock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
) {
  const r = 6;
  ctx.save();
  ctx.fillStyle = 'rgba(10, 11, 20, 0.8)';
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fill();

  // Crescent moon: full disc minus offset disc.
  ctx.fillStyle = '#b48cff';
  ctx.beginPath();
  ctx.arc(x, y, r - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(10, 11, 20, 0.95)';
  ctx.beginPath();
  ctx.arc(x + 2, y - 1, r - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawRepairFx(ctx: CanvasRenderingContext2D, s: Station) {
  const t = 1 - s.repairFx / 0.8;
  const alpha = Math.max(0, 1 - t);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = UI_COLORS.gold;
  ctx.font = `700 11px ${UI_FONTS.mono}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('-1', s.x, s.y - 34 - t * 16);
  ctx.restore();
}

function drawUnpaidMark(ctx: CanvasRenderingContext2D, s: Station) {
  const alpha = Math.min(1, s.unpaidFx * 2);
  ctx.save();
  const r = 7;
  ctx.fillStyle = `rgba(255, 90, 90, ${0.85 * alpha})`;
  ctx.beginPath();
  ctx.arc(s.x, s.y - 34, r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = `rgba(10, 11, 20, ${alpha})`;
  ctx.font = `700 10px ${UI_FONTS.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', s.x, s.y - 34 + 1);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawSettlingPulse(ctx: CanvasRenderingContext2D, s: Station) {
  const t = s.readyTimer;
  const alpha = Math.min(1, t * 2);
  const pulse = (1 - t) * 1.4;
  const baseR = STATION_STATS[s.kind].placementRadius + 8;
  ctx.save();
  // Outer expanding ring.
  ctx.strokeStyle = `rgba(242, 201, 76, ${0.7 * alpha * (1 - pulse % 1)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, baseR + (pulse % 1) * 14, 0, Math.PI * 2);
  ctx.stroke();

  // Label below.
  ctx.fillStyle = `rgba(242, 201, 76, ${alpha})`;
  ctx.font = `600 9px ${UI_FONTS.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  drawSmallCaps(ctx, 'Settling', s.x - 13, s.y + STATION_STATS[s.kind].placementRadius + 10, 1.2);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawLevelPips(ctx: CanvasRenderingContext2D, s: Station) {
  const baseY = s.kind === 'wall' ? s.y - 16 : s.y - 30;
  const r = 2.2;
  const gap = 2;
  const step = r * 2 + gap;
  const totalW = s.level * step - gap;
  const startX = s.x - totalW / 2 + r;
  ctx.save();
  for (let i = 0; i < s.level; i++) {
    ctx.fillStyle = '#ffd95a';
    ctx.beginPath();
    ctx.arc(startX + i * step, baseY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a88314';
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
  ctx.restore();
}

function drawPayTargetRing(
  ctx: CanvasRenderingContext2D,
  s: Station,
  color: string,
) {
  ctx.save();
  const r = STATION_STATS[s.kind].placementRadius + 14;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawPendingSlotDots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  count: number,
) {
  ctx.save();
  const r = 3;
  const gap = 2;
  const step = r * 2 + gap;
  const totalW = count * step - gap;
  const startX = cx - totalW / 2 + r;
  for (let i = 0; i < count; i++) {
    const x = startX + i * step;
    ctx.fillStyle = 'rgba(242, 201, 76, 0.85)';
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a88314';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawHireSlots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  filled: number,
  total: number,
  openCount: number,
) {
  drawCostSlots(ctx, cx, cy, filled, total);
  if (openCount > 1) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 233, 168, 0.85)';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const r = 4.5;
    const step = r * 2 + 2;
    const totalW = total * step - 2;
    ctx.fillText(`\u00D7${openCount}`, cx + totalW / 2 + 4, cy);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }
}

const TOOLTIP_RADIUS = 58;

export function drawFocusPanel(
  ctx: CanvasRenderingContext2D,
  stations: Station[],
  nodes: ResourceNode[],
  recruits: Recruit[],
  pois: POI[],
  portals: Portal[],
  campfire: Campfire,
  hero: Hero,
  coin: number,
  w: number,
  h: number,
  clock: Clock,
) {
  let nearestStation: Station | undefined;
  let nearestNode: ResourceNode | undefined;
  let nearestWanderer: Recruit | undefined;
  let nearestPOI: POI | undefined;
  let nearestPortal: Portal | undefined;
  let nearestCampfire: Campfire | undefined;
  let nearestD = TOOLTIP_RADIUS;

  const clearOthers = () => {
    nearestStation = undefined;
    nearestNode = undefined;
    nearestWanderer = undefined;
    nearestPOI = undefined;
    nearestPortal = undefined;
    nearestCampfire = undefined;
  };

  for (const s of stations) {
    // intentionally don't filter by prereq here — we want the tooltip.
    const d = Math.hypot(s.x - hero.x, s.y - hero.y);
    if (d < nearestD) {
      nearestD = d;
      clearOthers();
      nearestStation = s;
    }
  }
  for (const n of nodes) {
    const d = Math.hypot(n.x - hero.x, n.y - hero.y);
    if (d < nearestD) {
      nearestD = d;
      clearOthers();
      nearestNode = n;
    }
  }
  for (const r of recruits) {
    if (r.status !== 'wandering') continue;
    const d = Math.hypot(r.x - hero.x, r.y - hero.y);
    if (d < nearestD) {
      nearestD = d;
      clearOthers();
      nearestWanderer = r;
    }
  }
  for (const poi of pois) {
    if (poi.claimed || !poi.discovered) continue;
    const d = Math.hypot(poi.x - hero.x, poi.y - hero.y);
    if (d < nearestD) {
      nearestD = d;
      clearOthers();
      nearestPOI = poi;
    }
  }
  for (const portal of portals) {
    if (!portal.discovered) continue;
    const d = Math.hypot(portal.x - hero.x, portal.y - hero.y);
    if (d < nearestD) {
      nearestD = d;
      clearOthers();
      nearestPortal = portal;
    }
  }
  const dCf = Math.hypot(campfire.x - hero.x, campfire.y - hero.y);
  if (dCf < nearestD) {
    nearestD = dCf;
    clearOthers();
    nearestCampfire = campfire;
  }

  const isNight = clock.phase === 'night';

  if (nearestStation) {
    renderStationPanel(ctx, nearestStation, coin, w, h, hero, campfire.level, isNight);
  } else if (nearestNode) {
    renderNodePanel(ctx, nearestNode, w, h);
  } else if (nearestWanderer) {
    renderWandererPanel(ctx, coin, w, h);
  } else if (nearestPOI) {
    renderPOIPanel(ctx, nearestPOI, w, h);
  } else if (nearestPortal) {
    renderPortalPanel(ctx, nearestPortal, w, h);
  } else if (nearestCampfire) {
    renderCampfirePanel(ctx, nearestCampfire, coin, w, h, stations, isNight);
  }
}

function renderStationPanel(
  ctx: CanvasRenderingContext2D,
  station: Station,
  coin: number,
  w: number,
  h: number,
  hero: Hero,
  campfireLevel: number,
  isNight: boolean,
) {
  const stats = STATION_STATS[station.kind];
  const eff = effectiveStats(station);
  let title = station.active ? stats.name : `${stats.name} (building)`;
  if (station.active) title += ` \u00B7 L${station.level}`;

  let statusLine: string;
  let statusColor = '#cfcfcf';

  if (!station.active) {
    statusLine = roleBlurb(station.kind);
  } else if (eff.capacity > 0) {
    const staffed = station.recruitIds.length;
    const roleName = roleShortName(station.kind);
    statusLine = `${roleName} \u00B7 ${staffed}/${eff.capacity} working`;
    if (station.paidSlots > 0) statusLine += ` (+${station.paidSlots} paid)`;
  } else if (station.kind === 'wall') {
    statusLine = `HP ${station.hp}/${station.maxHp} \u00B7 blocks enemies`;
    if (station.hp < station.maxHp) statusColor = '#ff9a55';
  } else if (station.kind === 'farm') {
    statusLine = `Produces ${eff.power} coin${eff.power === 1 ? '' : 's'} every ${eff.workInterval.toFixed(1)}s`;
  } else {
    statusLine = roleBlurb(station.kind);
  }

  let actionLine: string | null = null;
  let actionColor = '#cfcfcf';

  if (!station.active) {
    const needed = station.buildRemaining;
    if (isNight) {
      actionLine = 'Construction paused — wait for dawn';
      actionColor = '#b48cff';
    } else {
      actionLine = `Hold Space to build \u00B7 ${needed}c`;
      actionColor = coin >= needed ? '#ffd95a' : '#ff7878';
    }
  } else if (station.active && station.readyTimer > 0) {
    actionLine = 'Settling…';
    actionColor = '#aac6ff';
  } else {
    // Pick whichever anchor (hire vs upgrade) the hero is closer to.
    const committed = station.recruitIds.length + station.paidSlots;
    const hasOpenSlot = eff.capacity > 0 && committed < eff.capacity;
    const upCost = nextUpgradeCost(station, campfireLevel);
    const upgradeBlock = stationUpgradeBlockReason(station, campfireLevel);

    let bestMode: 'hire' | 'upgrade' | null = null;
    let bestD = Infinity;
    if (hasOpenSlot) {
      const a = hireAnchorOffset(station.kind);
      if (a) {
        const d = Math.hypot(station.x + a.dx - hero.x, station.y + a.dy - hero.y);
        if (d < bestD) { bestD = d; bestMode = 'hire'; }
      }
    }
    if (upCost !== null) {
      const a = upgradeAnchorOffset(station.kind);
      const d = Math.hypot(station.x + a.dx - hero.x, station.y + a.dy - hero.y);
      if (d < bestD) { bestD = d; bestMode = 'upgrade'; }
    }

    if (bestMode === 'hire') {
      const hireRemaining = stats.hireCost - station.hireProgress;
      actionLine = `Stand at base \u00B7 Space to hire \u00B7 ${hireRemaining}c`;
      actionColor = coin >= hireRemaining ? '#ffd95a' : '#ff7878';
    } else if (bestMode === 'upgrade' && upCost !== null) {
      if (isNight) {
        actionLine = 'Upgrades paused — wait for dawn';
        actionColor = '#b48cff';
      } else {
        const upRemaining = upCost - station.upgradeProgress;
        actionLine = `Stand above \u00B7 Space to reach L${station.level + 1} \u00B7 ${upRemaining}c`;
        actionColor = coin >= upRemaining ? '#ffd95a' : '#ff7878';
      }
      // Replace the "X/Y working" status line with the upgrade details.
      const delta = describeNextUpgrade(station);
      if (delta) {
        statusLine = delta;
        statusColor = '#aac6ff';
      }
    } else if (station.level >= MAX_STATION_LEVEL) {
      actionLine = 'Fully upgraded';
      actionColor = '#aac6ff';
    } else if (upgradeBlock) {
      actionLine = upgradeBlock;
      actionColor = '#aac6ff';
    } else if (station.paidSlots > 0) {
      actionLine = 'Jobs paid \u00B7 waiting for villagers';
      actionColor = '#aac6ff';
    }
  }

  drawInfoPanel(ctx, w, h, title, statusLine, statusColor, actionLine, actionColor);
}

function renderCampfirePanel(
  ctx: CanvasRenderingContext2D,
  fire: Campfire,
  coin: number,
  w: number,
  h: number,
  stations: Station[],
  isNight: boolean,
) {
  const title = `Campfire \u00B7 L${fire.level}`;
  const upCostBase = fire.nextUpgradeCost();
  let statusLine: string;
  let statusColor = '#cfcfcf';
  if (upCostBase !== null && fire.upgradeBlockReason(stations) === null) {
    const nextIdx = fire.level; // 0-based into CAMPFIRE_LEVELS for next level
    const parts: string[] = [];
    const cur = fire.maxHp;
    const nxt = [100, 160, 240][nextIdx];
    if (nxt && cur) parts.push(`+${nxt - cur} HP`);
    const curLight = [150, 185, 220][fire.level - 1];
    const nxtLight = [150, 185, 220][nextIdx];
    if (nxtLight && curLight) parts.push(`+${nxtLight - curLight}px light`);
    statusLine = parts.join(' \u00B7 ');
    statusColor = '#aac6ff';
  } else {
    statusLine = `HP ${Math.ceil(fire.hp)}/${fire.maxHp} \u00B7 light ${Math.round(fire.lightRadius)}`;
  }
  let actionLine: string | null = null;
  let actionColor = '#cfcfcf';
  const upCost = fire.nextUpgradeCost();
  const block = fire.upgradeBlockReason(stations);
  if (upCost === null) {
    actionLine = 'Fully upgraded';
    actionColor = '#aac6ff';
  } else if (fire.readyTimer > 0) {
    actionLine = 'Settling…';
    actionColor = '#aac6ff';
  } else if (block) {
    actionLine = `${block} to unlock L${fire.level + 1}`;
    actionColor = '#aac6ff';
  } else if (isNight) {
    actionLine = 'Upgrades paused — wait for dawn';
    actionColor = '#b48cff';
  } else {
    const upRemaining = upCost - fire.upgradeProgress;
    actionLine = `Hold Space to upgrade to L${fire.level + 1} \u00B7 ${upRemaining}c`;
    actionColor = coin >= upRemaining ? '#ffd95a' : '#ff7878';
  }
  drawInfoPanel(ctx, w, h, title, statusLine, statusColor, actionLine, actionColor);
}

function renderNodePanel(
  ctx: CanvasRenderingContext2D,
  node: ResourceNode,
  w: number,
  h: number,
) {
  const title = node.kind === 'tree' ? 'Tree' : 'Berry bush';
  const statusLine = `${node.hp}/${node.maxHp} chops left \u00B7 drops 1 coin per hit`;
  const actionLine = 'Hold Space to chop';
  drawInfoPanel(ctx, w, h, title, statusLine, '#cfcfcf', actionLine, '#ffd95a');
}

function renderWandererPanel(
  ctx: CanvasRenderingContext2D,
  coin: number,
  w: number,
  h: number,
) {
  const title = 'Lost villager';
  const statusLine = 'Stranded outside the base, waiting for help';
  const actionLine = `Hold Space to rescue \u00B7 ${RESCUE_COST}c`;
  const actionColor = coin >= RESCUE_COST ? '#ffd95a' : '#ff7878';
  drawInfoPanel(ctx, w, h, title, statusLine, '#cfcfcf', actionLine, actionColor);
}

function poiBlurb(kind: POI['kind']): string {
  switch (kind) {
    case 'camp': return '3 villagers will join you';
    case 'chest': return 'Loose coins \u2014 15c';
    case 'shrine': return 'Grants one free upgrade';
    case 'graveyard': return 'Wakes 3 runners \u2014 leaves 20c behind';
    case 'cache': return 'Heavy chest \u2014 30c';
    case 'ruin': return 'Raises a free gather post with a worker';
  }
}

function renderPOIPanel(
  ctx: CanvasRenderingContext2D,
  poi: POI,
  w: number,
  h: number,
) {
  const title = POI_LABELS[poi.kind];
  const statusLine = poiBlurb(poi.kind);
  const actionLine = POI_HINTS[poi.kind];
  drawInfoPanel(ctx, w, h, title, statusLine, '#cfcfcf', actionLine, '#ffd95a');
}

function renderPortalPanel(
  ctx: CanvasRenderingContext2D,
  portal: Portal,
  w: number,
  h: number,
) {
  const title = 'Enemy portal';
  const statusLine = `HP ${Math.max(0, portal.hp)}/${portal.maxHp} \u00B7 spawns enemies at night`;
  const actionLine = 'Destroy to stop its spawns';
  drawInfoPanel(ctx, w, h, title, statusLine, '#d68aff', actionLine, '#ff8888');
}

function roleShortName(kind: StationKind): string {
  switch (kind) {
    case 'gather': return 'Gatherers';
    case 'tower': return 'Archers';
    case 'workshop': return 'Builders';
    case 'barracks': return 'Knights';
    case 'garrison': return 'Guards';
    case 'wall': return 'Wall';
    case 'farm': return 'Farm';
    case 'blacksmith': return 'Blacksmith';
  }
}

function roleBlurb(kind: StationKind): string {
  switch (kind) {
    case 'gather': return 'Gatherers chop nearby trees and bushes';
    case 'tower': return 'Archers defend at night — holds 3 villagers';
    case 'workshop': return 'Builders repair damaged walls';
    case 'barracks': return 'Knights roam and attack enemies at night';
    case 'garrison': return 'Guards take up wall posts and melee attackers';
    case 'wall': return 'Blocks enemies — destructible';
    case 'farm': return 'Passive coin income — no villager needed';
    case 'blacksmith': return 'Unlocks the dawn shop and night abilities';
  }
}

function drawInfoPanel(
  ctx: CanvasRenderingContext2D,
  _canvasW: number,
  canvasH: number,
  title: string,
  statusLine: string,
  _statusColor: string,
  actionLine: string | null,
  actionColor: string,
) {
  const panelW = 304;
  const panelH = actionLine ? 92 : 64;
  const panelX = 12;
  const panelY = canvasH - panelH - 60;

  ctx.save();

  ctx.fillStyle = UI_COLORS.surface;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // Left accent stripe matches the cream "focus" tone.
  ctx.fillStyle = UI_COLORS.cream;
  ctx.fillRect(panelX, panelY, 3, panelH);

  const padX = 14;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // Smallcaps "Focus" header.
  ctx.fillStyle = UI_COLORS.inkDim;
  ctx.font = `600 8.5px ${UI_FONTS.ui}`;
  drawSmallCaps(ctx, 'Focus', panelX + padX, panelY + 16, 1.4);

  // Serif italic title.
  ctx.fillStyle = UI_COLORS.cream;
  ctx.font = `italic 700 20px ${UI_FONTS.serif}`;
  ctx.fillText(title, panelX + padX, panelY + 38);

  // Italic dim sub-line.
  ctx.fillStyle = UI_COLORS.inkDim;
  ctx.font = `italic 500 10.5px ${UI_FONTS.ui}`;
  ctx.fillText(statusLine, panelX + padX, panelY + 54);

  if (actionLine) {
    // Dashed divider.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(panelX + padX, panelY + 66);
    ctx.lineTo(panelX + panelW - padX, panelY + 66);
    ctx.stroke();
    ctx.setLineDash([]);

    drawActionLine(ctx, panelX + padX, panelY + 77, panelW - padX * 2, actionLine, actionColor);
  }

  ctx.restore();
}

// Renders an action hint of the form "Hold Space to build · 10c". Picks out the
// Space kbd box and the trailing coin cost so they render as discrete widgets
// instead of plain text.
function drawActionLine(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  _maxW: number,
  line: string,
  actionColor: string,
) {
  const coinMatch = line.match(/·\s*(\d+)c\s*$/);
  const body = coinMatch ? line.slice(0, line.length - coinMatch[0].length).trim() : line;
  const cost = coinMatch ? coinMatch[1] : null;

  ctx.textBaseline = 'middle';
  ctx.font = `500 11px ${UI_FONTS.ui}`;

  let cx = x;
  const parts = body.split(/(Space|␣|Hold|Press)/);
  // Fallback to just drawing the whole body then the coin pill on the right.
  ctx.fillStyle = actionColor;
  ctx.font = `600 11px ${UI_FONTS.ui}`;
  ctx.fillText(body, cx, y);
  const bodyW = ctx.measureText(body).width;
  cx = x + bodyW + 10;

  // Suppress unused warning for parts; left for future keybind replacement.
  void parts;

  if (cost) {
    const pillX = x + 278 - 38;
    drawCoinPill(ctx, pillX, y - 7, cost);
  }
  ctx.textBaseline = 'alphabetic';
}

function drawCoinPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cost: string,
) {
  const w = 38;
  const h = 14;
  ctx.fillStyle = '#1b1d2c';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(242, 201, 76, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  drawCoinIcon(ctx, x + 8, y + h / 2, 4);
  ctx.fillStyle = UI_COLORS.gold;
  ctx.font = `700 10px ${UI_FONTS.mono}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(cost, x + 16, y + h / 2);
  ctx.textBaseline = 'alphabetic';
}

function drawWallHp(ctx: CanvasRenderingContext2D, s: Station) {
  const bw = 22;
  const bh = 3;
  const bx = s.x - bw / 2;
  const by = s.y - 14;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
  ctx.fillStyle = '#e74c3c';
  ctx.fillRect(bx, by, bw * (s.hp / s.maxHp), bh);
}

const SLOT_RADIUS = 4.5;
const SLOT_ROW_GAP = 3;
const SLOT_ROW_H = SLOT_RADIUS * 2 + SLOT_ROW_GAP;
const SLOTS_PER_ROW = 5;

function drawCostSlots(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  filled: number,
  total: number,
) {
  const gap = 3;
  const step = SLOT_RADIUS * 2 + gap;
  const rows = Math.ceil(total / SLOTS_PER_ROW);
  const startY = cy - ((rows - 1) / 2) * SLOT_ROW_H;

  ctx.save();
  for (let row = 0; row < rows; row++) {
    const perRow = Math.min(SLOTS_PER_ROW, total - row * SLOTS_PER_ROW);
    const rowW = perRow * step - gap;
    const startX = cx - rowW / 2 + SLOT_RADIUS;
    const y = startY + row * SLOT_ROW_H;
    for (let i = 0; i < perRow; i++) {
      const idx = row * SLOTS_PER_ROW + i;
      const x = startX + i * step;
      const isFilled = idx < filled;
      if (isFilled) {
        ctx.shadowColor = 'rgba(242, 201, 76, 0.9)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#f2c94c';
        ctx.beginPath();
        ctx.arc(x, y, SLOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#a88314';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = '#fff6c4';
        ctx.beginPath();
        ctx.arc(x - 1.2, y - 1.2, 1.3, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(10, 11, 20, 0.6)';
        ctx.beginPath();
        ctx.arc(x, y, SLOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#f2c94c';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}


function drawStation(
  ctx: CanvasRenderingContext2D,
  kind: StationKind,
  x: number,
  y: number,
  ghost: boolean,
) {
  const stats = STATION_STATS[kind];
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.55;

  const pr = stats.placementRadius;
  ctx.fillStyle = '#4a3a22';
  ctx.fillRect(x - pr, y - 3, pr * 2, 6);

  if (kind === 'tower') {
    ctx.fillStyle = '#6c6a7a';
    ctx.fillRect(x - 5, y - 24, 10, 22);
    ctx.fillStyle = stats.color;
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 24);
    ctx.lineTo(x + 10, y - 24);
    ctx.lineTo(x, y - 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2a2a35';
    ctx.fillRect(x - 2, y - 15, 4, 6);
  } else if (kind === 'workshop') {
    ctx.fillStyle = stats.color;
    ctx.fillRect(x - 14, y - 16, 28, 20);
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 14, y - 16, 28, 20);
    // Pitched roof
    ctx.fillStyle = '#6b3a24';
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 16);
    ctx.lineTo(x + 16, y - 16);
    ctx.lineTo(x, y - 26);
    ctx.closePath();
    ctx.fill();
    // Crossed hammer + saw on the door
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - 6, y - 10);
    ctx.lineTo(x + 6, y + 2);
    ctx.moveTo(x + 6, y - 10);
    ctx.lineTo(x - 6, y + 2);
    ctx.stroke();
  } else if (kind === 'barracks') {
    ctx.fillStyle = stats.color;
    ctx.fillRect(x - 15, y - 18, 30, 22);
    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - 15, y - 18, 30, 22);
    // Crenellations
    ctx.fillStyle = stats.color;
    for (const cx of [-12, -4, 4, 12]) {
      ctx.fillRect(x + cx - 2, y - 22, 4, 4);
    }
    // Shield
    ctx.fillStyle = '#aaa5b8';
    ctx.beginPath();
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x - 5, y - 8);
    ctx.lineTo(x - 5, y - 1);
    ctx.lineTo(x, y + 3);
    ctx.lineTo(x + 5, y - 1);
    ctx.lineTo(x + 5, y - 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a3040';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Cross
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x, y + 1);
    ctx.moveTo(x - 3, y - 5);
    ctx.lineTo(x + 3, y - 5);
    ctx.stroke();
  } else if (kind === 'garrison') {
    // Stone fortlet with a peaked roof and crossed swords on the face.
    ctx.fillStyle = stats.color;
    ctx.fillRect(x - 14, y - 16, 28, 20);
    ctx.strokeStyle = '#2f3340';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - 14, y - 16, 28, 20);
    ctx.fillStyle = '#6b3a24';
    ctx.beginPath();
    ctx.moveTo(x - 16, y - 16);
    ctx.lineTo(x + 16, y - 16);
    ctx.lineTo(x, y - 26);
    ctx.closePath();
    ctx.fill();
    // Crossed swords
    ctx.strokeStyle = '#e6e2d0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 10);
    ctx.lineTo(x + 7, y + 2);
    ctx.moveTo(x + 7, y - 10);
    ctx.lineTo(x - 7, y + 2);
    ctx.stroke();
    // Hilts
    ctx.fillStyle = '#caa861';
    ctx.fillRect(x - 9, y - 12, 3, 3);
    ctx.fillRect(x + 6, y - 12, 3, 3);
  } else if (kind === 'wall') {
    ctx.fillStyle = stats.color;
    ctx.fillRect(x - 13, y - 7, 26, 14);
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 13, y - 7, 26, 14);
    ctx.beginPath();
    for (let i = -8; i <= 8; i += 5) {
      ctx.moveTo(x + i, y - 7);
      ctx.lineTo(x + i, y + 7);
    }
    ctx.stroke();
    ctx.fillStyle = '#c99d6b';
    ctx.fillRect(x - 13, y - 9, 26, 2);
  } else if (kind === 'blacksmith') {
    // Forge: stone hut with a lit orange hearth and an anvil on top.
    ctx.fillStyle = '#4a4038';
    ctx.fillRect(x - 15, y - 16, 30, 20);
    ctx.strokeStyle = '#2a1f16';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x - 15, y - 16, 30, 20);
    // Stone-tiled roof.
    ctx.fillStyle = '#6b5a48';
    ctx.beginPath();
    ctx.moveTo(x - 17, y - 16);
    ctx.lineTo(x + 17, y - 16);
    ctx.lineTo(x, y - 26);
    ctx.closePath();
    ctx.fill();
    // Chimney with rising smoke glyph.
    ctx.fillStyle = '#2a1f16';
    ctx.fillRect(x + 9, y - 28, 4, 6);
    // Hearth glow.
    const glow = ctx.createRadialGradient(x, y - 5, 0, x, y - 5, 10);
    glow.addColorStop(0, 'rgba(255, 180, 90, 0.95)');
    glow.addColorStop(1, 'rgba(255, 90, 40, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 10, y - 15, 20, 20);
    ctx.fillStyle = stats.color;
    ctx.fillRect(x - 5, y - 8, 10, 6);
    // Anvil silhouette on the floor.
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(x - 6, y + 1, 12, 3);
    ctx.fillRect(x - 3, y - 2, 6, 3);
  } else if (kind === 'farm') {
    ctx.fillStyle = '#5a3f1e';
    ctx.fillRect(x - 13, y - 11, 26, 22);
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 13, y - 11, 26, 22);
    ctx.fillStyle = stats.color;
    for (const ox of [-8, -2, 4]) {
      for (const oy of [-6, 0, 6]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#f5d976';
    ctx.beginPath();
    ctx.arc(x - 8, y - 6, 1.1, 0, Math.PI * 2);
    ctx.arc(x + 4, y, 1.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(x - 11, y - 14, 22, 8);
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 11, y - 14, 22, 8);
    ctx.fillStyle = stats.color;
    ctx.fillRect(x - 8, y - 20, 16, 6);
    ctx.strokeStyle = '#3a2410';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 8, y - 20, 16, 6);
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.arc(x - 3, y - 17, 1.6, 0, Math.PI * 2);
    ctx.arc(x + 2, y - 17, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

export function drawBuildGhost(
  ctx: CanvasRenderingContext2D,
  kind: StationKind,
  mx: number,
  my: number,
  canAfford: boolean,
  validLocation: boolean,
) {
  const stats = STATION_STATS[kind];
  const ok = canAfford && validLocation;

  ctx.save();
  ctx.strokeStyle = ok ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 100, 100, 0.5)';
  ctx.setLineDash([6, 6]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(mx, my, stats.workRange, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  drawStation(ctx, kind, mx, my, true);

  if (!ok) {
    ctx.save();
    ctx.strokeStyle = '#ff6060';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 18, 0, Math.PI * 2);
    ctx.moveTo(mx - 12, my - 12);
    ctx.lineTo(mx + 12, my + 12);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawPortals(ctx: CanvasRenderingContext2D, portals: Portal[]) {
  for (const p of portals) {
    if (!p.discovered) continue;
    drawPortal(ctx, p);
  }
}

function drawPortal(ctx: CanvasRenderingContext2D, p: Portal) {
  const r = PORTAL_RADIUS;
  // Smoky ground halo
  const halo = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, r * 1.8);
  halo.addColorStop(0, 'rgba(120, 40, 140, 0.5)');
  halo.addColorStop(1, 'rgba(120, 40, 140, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(p.x - r * 2, p.y - r * 2, r * 4, r * 4);

  // Outer vortex ring
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.swirl);
  ctx.fillStyle = p.hitFlash > 0 ? '#fff' : '#2b0a2e';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6a1a70';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Swirl arms
  ctx.strokeStyle = 'rgba(200, 100, 220, 0.85)';
  ctx.lineWidth = 1.8;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const a0 = (i / 3) * Math.PI * 2;
    ctx.arc(0, 0, r * 0.55, a0, a0 + Math.PI * 0.65);
    ctx.stroke();
  }
  // Central eye
  ctx.fillStyle = '#ffb0f0';
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // HP bar when damaged
  if (p.hp < p.maxHp) {
    const bw = 30;
    const bh = 4;
    const bx = p.x - bw / 2;
    const by = p.y - r - 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#d147ff';
    ctx.fillRect(bx, by, bw * (p.hp / p.maxHp), bh);
  }
}

export function drawPOIs(ctx: CanvasRenderingContext2D, pois: POI[]) {
  for (const p of pois) {
    if (p.claimed) continue;
    if (!p.discovered) continue;
    drawPOI(ctx, p);
  }
}

function drawPOI(ctx: CanvasRenderingContext2D, p: POI) {
  if (p.kind === 'camp') {
    ctx.fillStyle = '#8c6a3b';
    ctx.beginPath();
    ctx.moveTo(p.x - 14, p.y + 2);
    ctx.lineTo(p.x - 2, p.y + 2);
    ctx.lineTo(p.x - 8, p.y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a3520';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#a37a44';
    ctx.beginPath();
    ctx.moveTo(p.x + 2, p.y + 2);
    ctx.lineTo(p.x + 14, p.y + 2);
    ctx.lineTo(p.x + 8, p.y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(p.x - 2, p.y + 2, 4, 2);
  } else if (p.kind === 'chest') {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(p.x - 10, p.y - 7, 20, 14);
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - 10, p.y - 7, 20, 14);
    ctx.fillStyle = '#caa861';
    ctx.fillRect(p.x - 11, p.y - 9, 22, 4);
    ctx.strokeRect(p.x - 11, p.y - 9, 22, 4);
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  } else if (p.kind === 'cache') {
    // Larger, gilded chest with a gem
    ctx.fillStyle = '#4c321a';
    ctx.fillRect(p.x - 14, p.y - 9, 28, 18);
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x - 14, p.y - 9, 28, 18);
    ctx.fillStyle = '#e0b940';
    ctx.fillRect(p.x - 15, p.y - 12, 30, 5);
    ctx.strokeRect(p.x - 15, p.y - 12, 30, 5);
    ctx.fillStyle = '#caa861';
    ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
    // Gem
    ctx.fillStyle = '#4ed8ff';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 15);
    ctx.lineTo(p.x - 3, p.y - 11);
    ctx.lineTo(p.x, p.y - 7);
    ctx.lineTo(p.x + 3, p.y - 11);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a5a7a';
    ctx.lineWidth = 1;
    ctx.stroke();
  } else if (p.kind === 'shrine') {
    ctx.fillStyle = '#888882';
    ctx.fillRect(p.x - 7, p.y - 14, 14, 16);
    ctx.strokeStyle = '#2f2f32';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - 7, p.y - 14, 14, 16);
    ctx.fillStyle = '#5a9a6a';
    ctx.fillRect(p.x - 7, p.y - 15, 14, 2);
    ctx.fillStyle = '#aaffd0';
    ctx.font = 'bold 10px serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2734', p.x, p.y - 6);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  } else if (p.kind === 'graveyard') {
    // Three tombstones
    ctx.fillStyle = '#7a7a78';
    ctx.strokeStyle = '#2f2f32';
    ctx.lineWidth = 1;
    const stone = (ox: number, oy: number, w: number, h: number) => {
      ctx.beginPath();
      ctx.moveTo(p.x + ox - w / 2, p.y + oy);
      ctx.lineTo(p.x + ox - w / 2, p.y + oy - h + w / 2);
      ctx.arc(p.x + ox, p.y + oy - h + w / 2, w / 2, Math.PI, 0);
      ctx.lineTo(p.x + ox + w / 2, p.y + oy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    stone(-8, 4, 8, 12);
    stone(8, 4, 7, 10);
    stone(0, 6, 9, 14);
    // Dirt patch
    ctx.fillStyle = 'rgba(60, 40, 20, 0.4)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 16, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.kind === 'ruin') {
    // Leaning wooden frame + rubble pile
    ctx.fillStyle = 'rgba(90, 75, 55, 0.8)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 6, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Broken beams
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(-0.25);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(-3, -16, 6, 20);
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 1;
    ctx.strokeRect(-3, -16, 6, 20);
    ctx.restore();
    ctx.save();
    ctx.translate(p.x + 6, p.y + 1);
    ctx.rotate(0.35);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(-2, -12, 4, 14);
    ctx.strokeRect(-2, -12, 4, 14);
    ctx.restore();
    // Rubble rocks
    ctx.fillStyle = '#888882';
    ctx.beginPath();
    ctx.arc(p.x - 8, p.y + 6, 3, 0, Math.PI * 2);
    ctx.arc(p.x + 9, p.y + 6, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hover label
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  const label = POI_LABELS[p.kind];
  ctx.font = 'bold 10px system-ui, sans-serif';
  const w = ctx.measureText(label).width + 10;
  ctx.fillRect(p.x - w / 2, p.y - 28, w, 14);
  ctx.fillStyle = '#f6ecc8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, p.x, p.y - 21);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();

  // Interaction progress arc
  if (p.interactProgress > 0) {
    const t = p.interactProgress / POI_INTERACT_DURATION;
    ctx.save();
    ctx.strokeStyle = '#ffd95a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
    ctx.stroke();
    ctx.restore();
  }
}

export function drawCoins(ctx: CanvasRenderingContext2D, coins: Coin[]) {
  for (const c of coins) {
    const fadeIn = c.age < 3 ? 1 : Math.max(0, (c.lifetime - c.age) / 3);
    const alpha = Math.min(1, fadeIn);
    const bob = Math.sin(c.age * 6) * 1.2;
    const y = c.y + bob;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(c.x, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a88314';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff6c4';
    ctx.beginPath();
    ctx.arc(c.x - 1.3, y - 1.3, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function drawNightBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  night: number,
  lifeFrac: number,
) {
  // lifeFrac is 1 when the banner first appears and decays to 0. Quick fade in,
  // long hold, fade out at the end.
  const clamped = Math.max(0, Math.min(1, lifeFrac));
  const elapsedFrac = 1 - clamped;
  const inT = Math.max(0, Math.min(1, elapsedFrac / 0.15));
  const outT = Math.max(0, Math.min(1, clamped / 0.25));
  const alpha = Math.min(inT, outT);
  ctx.save();

  // Red+purple inner vignette.
  const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
  vg.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vg.addColorStop(0.55, `rgba(107, 90, 163, ${0.2 * alpha})`);
  vg.addColorStop(1, `rgba(255, 90, 90, ${0.3 * alpha})`);
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Headline.
  ctx.fillStyle = `rgba(234, 223, 196, ${alpha})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = `rgba(0, 0, 0, ${0.9 * alpha})`;
  ctx.shadowBlur = 20;
  ctx.font = `italic 700 58px ${UI_FONTS.serif}`;
  ctx.fillText(`Night ${night}`, w / 2, 44);
  ctx.shadowBlur = 0;

  // Tagline smallcaps.
  ctx.fillStyle = `rgba(255, 90, 90, ${alpha})`;
  ctx.font = `600 10px ${UI_FONTS.ui}`;
  drawSmallCapsCentered(ctx, 'They arrive from the dark', w / 2, 112, 1.6);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

export function drawNoteCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  body: string,
) {
  // Backdrop — dims the world beneath the parchment.
  ctx.save();
  ctx.fillStyle = 'rgba(6, 7, 14, 0.75)';
  ctx.fillRect(0, 0, w, h);

  const cardW = Math.min(540, w - 80);
  const cardH = 260;
  const cardX = (w - cardW) / 2;
  const cardY = (h - cardH) / 2;

  // Parchment body — warm beige with a subtle vignette so it feels hand-aged.
  const grad = ctx.createRadialGradient(
    cardX + cardW / 2, cardY + cardH / 2, 20,
    cardX + cardW / 2, cardY + cardH / 2, Math.max(cardW, cardH) * 0.65,
  );
  grad.addColorStop(0, '#f2e5c2');
  grad.addColorStop(1, '#c9b386');
  ctx.fillStyle = grad;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Fraying edge — a thin dark border and a torn-top wax-seal ribbon.
  ctx.strokeStyle = 'rgba(60, 40, 16, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cardX + 0.5, cardY + 0.5, cardW - 1, cardH - 1);
  ctx.strokeStyle = 'rgba(60, 40, 16, 0.18)';
  ctx.setLineDash([2, 4]);
  ctx.strokeRect(cardX + 10, cardY + 10, cardW - 20, cardH - 20);
  ctx.setLineDash([]);

  // Title ribbon.
  ctx.fillStyle = 'rgba(90, 50, 20, 0.9)';
  ctx.fillRect(cardX, cardY + 22, cardW, 22);
  ctx.fillStyle = '#f2e5c2';
  ctx.font = `600 11px ${UI_FONTS.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawSmallCapsCentered(ctx, title, cardX + cardW / 2, cardY + 33, 1.4);

  // Body — handwritten-feeling italic serif.
  ctx.fillStyle = '#2a1810';
  ctx.font = `italic 500 17px ${UI_FONTS.serif}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const bodyPadX = 30;
  const bodyX = cardX + bodyPadX;
  const bodyW = cardW - bodyPadX * 2;
  wrapTextBlock(ctx, body, bodyX, cardY + 70, bodyW, 24);

  // Footer hint.
  ctx.fillStyle = 'rgba(60, 40, 16, 0.6)';
  ctx.font = `500 10px ${UI_FONTS.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  drawSmallCapsCentered(
    ctx,
    'Press space to continue',
    cardX + cardW / 2,
    cardY + cardH - 18,
    1.4,
  );

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function wrapTextBlock(
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

export function drawDawnBanner(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  night: number,
  lifeFrac: number,
) {
  const clamped = Math.max(0, Math.min(1, lifeFrac));
  const elapsedFrac = 1 - clamped;
  const inT = Math.max(0, Math.min(1, elapsedFrac / 0.15));
  const outT = Math.max(0, Math.min(1, clamped / 0.25));
  const alpha = Math.min(inT, outT);
  ctx.save();

  // Warm sunrise vignette — gold glow radiating from the bottom-centre like
  // the sun cresting the horizon.
  const vg = ctx.createRadialGradient(
    w / 2, h * 0.9,
    Math.min(w, h) * 0.05,
    w / 2, h * 0.4,
    Math.max(w, h) * 0.7,
  );
  vg.addColorStop(0, `rgba(255, 224, 130, ${0.35 * alpha})`);
  vg.addColorStop(0.45, `rgba(255, 154, 85, ${0.18 * alpha})`);
  vg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Sub-headline smallcaps.
  ctx.fillStyle = `rgba(255, 224, 130, ${alpha})`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.font = `600 10px ${UI_FONTS.ui}`;
  drawSmallCapsCentered(ctx, `You held night ${night}`, w / 2, 36, 1.6);

  // Headline.
  ctx.fillStyle = `rgba(255, 244, 210, ${alpha})`;
  ctx.shadowColor = `rgba(255, 180, 100, ${0.85 * alpha})`;
  ctx.shadowBlur = 28;
  ctx.font = `italic 700 58px ${UI_FONTS.serif}`;
  ctx.fillText('Dawn', w / 2, 54);
  ctx.shadowBlur = 0;

  // Tagline smallcaps.
  ctx.fillStyle = `rgba(255, 200, 140, ${alpha})`;
  ctx.font = `600 10px ${UI_FONTS.ui}`;
  drawSmallCapsCentered(ctx, 'The sun clears the ridge', w / 2, 122, 1.6);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

export function drawDownedMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  timeLeft: number,
) {
  ctx.save();
  const blink = 0.5 + 0.5 * Math.sin(timeLeft * 12);
  const alpha = 0.4 + 0.6 * blink;
  ctx.strokeStyle = `rgba(255, 90, 90, ${0.4 * blink})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 28, 0, Math.PI * 2);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = `rgba(255, 90, 90, ${alpha})`;
  ctx.font = `700 11px ${UI_FONTS.ui}`;
  drawSmallCaps(ctx, 'Respawn', x - 22, y - 48, 1.4);
  ctx.fillStyle = `rgba(255, 90, 90, ${alpha})`;
  ctx.font = `700 11px ${UI_FONTS.mono}`;
  ctx.fillText(`${Math.ceil(timeLeft)}s`, x + 28, y - 48);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

export function drawFlyingCoins(
  ctx: CanvasRenderingContext2D,
  coins: FlyingCoin[],
) {
  ctx.save();
  for (const c of coins) {
    const { x, y } = flyingCoinPos(c);
    const t = Math.min(1, c.age / c.duration);
    const scale = 1 + (1 - t) * 0.25;
    const r = 3.6 * scale;
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#a88314';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#fff6c4';
    ctx.beginPath();
    ctx.arc(x - 1.1, y - 1.1, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, ps: Projectile[]) {
  for (const p of ps) {
    const a = Math.atan2(p.vy, p.vx);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(a);
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(-6, -1, 12, 2);
    ctx.fillStyle = '#a8a8a8';
    ctx.fillRect(4, -1.5, 3, 3);
    ctx.restore();
  }
}

let nightMask: HTMLCanvasElement | null = null;

export function applyLighting(
  ctx: CanvasRenderingContext2D,
  clock: Clock,
  fire: Campfire,
  hero: Hero,
  stations: Station[],
  recruits: Recruit[],
  w: number,
  h: number,
  lightMult: number,
  cameraX: number,
  cameraY: number,
  flareTime = 0,
) {
  // Flare consumable briefly erases night darkness. Fade it back in over the
  // last second of the flare so the world doesn't snap back.
  const flareMask = Math.min(1, flareTime);
  const darkness = computeDarkness(clock) * (1 - flareMask);
  if (darkness <= 0.01) return;

  if (!nightMask || nightMask.width !== w || nightMask.height !== h) {
    nightMask = document.createElement('canvas');
    nightMask.width = w;
    nightMask.height = h;
  }
  const mctx = nightMask.getContext('2d');
  if (!mctx) return;

  mctx.globalCompositeOperation = 'source-over';
  mctx.fillStyle = `rgba(8, 14, 36, ${darkness})`;
  mctx.fillRect(0, 0, w, h);

  mctx.globalCompositeOperation = 'destination-out';

  // Lights are placed in SCREEN coordinates (world pos minus camera offset).
  const fr = fire.lightRadius * lightMult;
  const fx = fire.x - cameraX;
  const fy = fire.y - cameraY;
  const fireGrad = mctx.createRadialGradient(fx, fy, fr * 0.1, fx, fy, fr * 2.1);
  fireGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  fireGrad.addColorStop(0.22, 'rgba(0, 0, 0, 0.88)');
  fireGrad.addColorStop(0.42, 'rgba(0, 0, 0, 0.62)');
  fireGrad.addColorStop(0.62, 'rgba(0, 0, 0, 0.36)');
  fireGrad.addColorStop(0.82, 'rgba(0, 0, 0, 0.14)');
  fireGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  mctx.fillStyle = fireGrad;
  mctx.fillRect(0, 0, w, h);

  punchLight(mctx, hero.x - cameraX, hero.y - cameraY, 88, 0.85, w, h);

  for (const s of stations) {
    if (!s.active) continue;
    const r = stationLightRadius(s.kind);
    if (r <= 0) continue;
    punchLight(mctx, s.x - cameraX, s.y - cameraY, r, 0.8, w, h);
  }

  for (const r of recruits) {
    if (r.status === 'wandering') continue;
    punchLight(mctx, r.x - cameraX, r.y - cameraY, 48, 0.75, w, h);
  }

  // Skip the post-blur filter — `punchLight` already paints 6-stop radial
  // gradients, so the edges read soft. Canvas `filter: blur(...)` is a huge
  // perf cliff inside iframes (itch.io embeds the game this way) and was the
  // main cause of sluggish frames at night.
  ctx.drawImage(nightMask, 0, 0);
}

function stationLightRadius(kind: Station['kind']): number {
  switch (kind) {
    case 'tower': return 70;
    case 'gather': return 48;
    case 'farm': return 44;
    case 'wall': return 26;
    case 'workshop': return 50;
    case 'barracks': return 60;
    case 'garrison': return 58;
    case 'blacksmith': return 62;
  }
}

function punchLight(
  mctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  strength: number,
  w: number,
  h: number,
) {
  // Outer radius extends 1.8x the nominal light radius so the falloff tail is
  // long and gradual — the "darkness line" becomes a wide gradient.
  const outerR = r * 1.8;
  const grad = mctx.createRadialGradient(x, y, 0, x, y, outerR);
  grad.addColorStop(0, `rgba(0, 0, 0, ${strength})`);
  grad.addColorStop(0.2, `rgba(0, 0, 0, ${strength * 0.88})`);
  grad.addColorStop(0.4, `rgba(0, 0, 0, ${strength * 0.62})`);
  grad.addColorStop(0.6, `rgba(0, 0, 0, ${strength * 0.36})`);
  grad.addColorStop(0.8, `rgba(0, 0, 0, ${strength * 0.14})`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  mctx.fillStyle = grad;
  mctx.fillRect(0, 0, w, h);
}

function computeDarkness(clock: Clock): number {
  const NIGHT_MAX = 0.62;
  const NIGHT_FADE_IN = 3;    // first 3s of night ramp from day to full dark
  const DAWN_EASE = 0.55;     // dawn takes a larger % of its phase to ease out

  switch (clock.phase) {
    case 'day':
      return 0;
    case 'night': {
      const t = clock.phaseTime;
      if (t < NIGHT_FADE_IN) return NIGHT_MAX * (t / NIGHT_FADE_IN);
      return NIGHT_MAX;
    }
    case 'dawn': {
      const p = clock.progress();
      if (p < DAWN_EASE) return NIGHT_MAX;
      return NIGHT_MAX * (1 - (p - DAWN_EASE) / (1 - DAWN_EASE));
    }
  }
}

export function drawMenuScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seedLabel?: string,
) {
  ctx.save();

  // Night backdrop with a warm campfire halo at centre.
  const back = ctx.createRadialGradient(w / 2, h * 0.58, 10, w / 2, h * 0.5, Math.max(w, h) * 0.75);
  back.addColorStop(0, '#241825');
  back.addColorStop(0.45, '#12121e');
  back.addColorStop(1, '#05060c');
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, w, h);

  const glow = ctx.createRadialGradient(w / 2, h * 0.58, 0, w / 2, h * 0.58, 140);
  glow.addColorStop(0, 'rgba(255, 180, 90, 0.25)');
  glow.addColorStop(1, 'rgba(255, 140, 40, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Silhouette horizon to echo the end screen.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.95)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h - 100);
  const peaks = [
    [0.12, 0.85], [0.22, 0.72], [0.33, 0.8], [0.45, 0.66], [0.55, 0.72],
    [0.66, 0.58], [0.76, 0.7], [0.86, 0.6], [0.95, 0.72], [1, 0.82],
  ];
  for (const [fx, fy] of peaks) ctx.lineTo(fx * w, h - 100 + fy * 80);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  ctx.textAlign = 'center';

  // Sub-headline smallcaps.
  ctx.fillStyle = UI_COLORS.orange;
  ctx.textBaseline = 'top';
  ctx.font = `600 11px ${UI_FONTS.ui}`;
  drawSmallCapsCentered(ctx, 'A chronicle in ten nights', w / 2, 78, 1.8);

  // Title — huge italic serif.
  ctx.fillStyle = '#ffe082';
  ctx.font = `italic 700 72px ${UI_FONTS.serif}`;
  ctx.shadowColor = 'rgba(255, 154, 85, 0.5)';
  ctx.shadowBlur = 30;
  ctx.fillText('99 Kingdoms', w / 2, 96);
  ctx.shadowBlur = 0;

  // Intro paragraph.
  const intro = [
    'The portals opened at the equinox, and with them the children began to vanish.',
    'Keep the campfire burning, raise a base, and hold back the night.',
    'Survive ten nights — find out where they have gone.',
  ];
  ctx.fillStyle = UI_COLORS.creamDim;
  ctx.font = `italic 500 15px ${UI_FONTS.serif}`;
  let introY = 200;
  for (const line of intro) {
    ctx.fillText(line, w / 2, introY);
    introY += 22;
  }

  // Controls hint.
  ctx.fillStyle = UI_COLORS.inkDim;
  ctx.font = `500 11px ${UI_FONTS.ui}`;
  ctx.fillText(
    'WASD move  ·  Space chop / pay / unlock  ·  Click or Shift to attack  ·  1/2/3 abilities',
    w / 2,
    introY + 20,
  );

  // Start prompt.
  const btnY = h - 140;
  const btnW = 240;
  const btnH = 46;
  const btnX = (w - btnW) / 2;
  ctx.fillStyle = 'rgba(12, 14, 22, 0.85)';
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = UI_COLORS.gold;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);
  ctx.fillStyle = UI_COLORS.gold;
  ctx.font = `italic 700 22px ${UI_FONTS.serif}`;
  ctx.textBaseline = 'middle';
  ctx.fillText('Press Space to begin', w / 2, btnY + btnH / 2 + 1);

  // Seed.
  if (seedLabel) {
    ctx.fillStyle = UI_COLORS.inkFaint;
    ctx.font = `500 10px ${UI_FONTS.mono}`;
    ctx.textBaseline = 'top';
    ctx.fillText(`SEED ${seedLabel.toUpperCase()}`, w / 2, h - 56);
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

export function drawEndScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  victory: boolean,
  clock: Clock,
  stats: { kills: number; rescued: number; stationsBuilt: number; coinsSpent: number },
  seedLabel?: string,
) {
  ctx.save();

  // Scenic backdrop.
  const backGrad = ctx.createRadialGradient(w / 2, victory ? h * 0.9 : h * 0.55, 0, w / 2, h / 2, Math.max(w, h));
  if (victory) {
    backGrad.addColorStop(0, '#ff9a55');
    backGrad.addColorStop(0.25, '#8b3a12');
    backGrad.addColorStop(0.7, '#1c1420');
    backGrad.addColorStop(1, '#0a0b14');
  } else {
    backGrad.addColorStop(0, '#2a1418');
    backGrad.addColorStop(0.7, '#0a0811');
    backGrad.addColorStop(1, '#05060c');
  }
  ctx.fillStyle = backGrad;
  ctx.fillRect(0, 0, w, h);

  // Silhouette horizon.
  ctx.fillStyle = 'rgba(8, 10, 18, 0.95)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  ctx.lineTo(0, h - 120);
  const peaks = [
    [0.1, 0.85], [0.18, 0.72], [0.28, 0.78], [0.38, 0.64], [0.47, 0.7],
    [0.57, 0.56], [0.67, 0.66], [0.77, 0.58], [0.87, 0.7], [0.95, 0.6], [1, 0.72],
  ];
  for (const [fx, fy] of peaks) {
    ctx.lineTo(fx * w, h - 120 + fy * 90);
  }
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Sun / dead fire symbol.
  const symY = h * 0.62;
  if (victory) {
    const r = 42;
    const symGrad = ctx.createRadialGradient(w / 2, symY, 0, w / 2, symY, r);
    symGrad.addColorStop(0, '#ffe082');
    symGrad.addColorStop(0.4, '#f2c94c');
    symGrad.addColorStop(0.75, '#ff9a55');
    symGrad.addColorStop(1, 'rgba(255, 154, 85, 0)');
    ctx.fillStyle = symGrad;
    ctx.beginPath();
    ctx.arc(w / 2, symY, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(w / 2 - 11, symY - 3, 22, 6);
    ctx.fillStyle = '#1a0f0a';
    ctx.fillRect(w / 2 - 11, symY - 7, 22, 3);
  }

  ctx.textAlign = 'center';

  // Sub-header smallcaps.
  ctx.fillStyle = victory ? UI_COLORS.orange : UI_COLORS.purple;
  ctx.textBaseline = 'top';
  ctx.font = `600 10px ${UI_FONTS.ui}`;
  drawSmallCapsCentered(
    ctx,
    victory ? 'You held 10 nights' : 'The last ember died',
    w / 2,
    80,
    1.6,
  );

  // Big italic serif headline.
  ctx.fillStyle = victory ? '#ffe082' : UI_COLORS.cream;
  ctx.font = `italic 700 52px ${UI_FONTS.serif}`;
  ctx.textBaseline = 'top';
  ctx.shadowColor = victory ? 'rgba(255, 154, 85, 0.5)' : 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = victory ? 28 : 18;
  ctx.fillText(
    victory ? 'The sun rises again' : 'The fire went out',
    w / 2,
    102,
  );
  ctx.shadowBlur = 0;

  // Stats block.
  const statsBlockY = 180;
  const statsBlockW = 520;
  const statsBlockH = 84;
  const statsX = (w - statsBlockW) / 2;
  ctx.fillStyle = 'rgba(10, 11, 20, 0.7)';
  ctx.fillRect(statsX, statsBlockY, statsBlockW, statsBlockH);
  ctx.strokeStyle = UI_COLORS.stroke;
  ctx.lineWidth = 1;
  ctx.strokeRect(statsX + 0.5, statsBlockY + 0.5, statsBlockW - 1, statsBlockH - 1);

  const statEntries: Array<{ label: string; value: string; tint: string }> = [
    { label: 'Enemies slain', value: String(stats.kills), tint: UI_COLORS.red },
    { label: 'Villagers saved', value: String(stats.rescued), tint: UI_COLORS.cream },
    { label: 'Stations built', value: String(stats.stationsBuilt), tint: UI_COLORS.gold },
    { label: 'Coins spent', value: String(stats.coinsSpent), tint: UI_COLORS.gold },
  ];
  const colW = statsBlockW / statEntries.length;
  statEntries.forEach((s, i) => {
    const cx = statsX + colW * (i + 0.5);
    ctx.fillStyle = s.tint;
    ctx.font = `700 26px ${UI_FONTS.mono}`;
    ctx.textBaseline = 'top';
    ctx.fillText(s.value, cx, statsBlockY + 16);
    ctx.fillStyle = UI_COLORS.inkDim;
    ctx.font = `600 8.5px ${UI_FONTS.ui}`;
    drawSmallCapsCentered(ctx, s.label, cx, statsBlockY + 52, 1.4);
    if (i < statEntries.length - 1) {
      ctx.strokeStyle = UI_COLORS.stroke;
      ctx.beginPath();
      ctx.moveTo(statsX + colW * (i + 1), statsBlockY + 14);
      ctx.lineTo(statsX + colW * (i + 1), statsBlockY + statsBlockH - 14);
      ctx.stroke();
    }
  });

  // Seed line.
  if (seedLabel) {
    ctx.fillStyle = UI_COLORS.inkFaint;
    ctx.font = `500 9px ${UI_FONTS.mono}`;
    ctx.textBaseline = 'top';
    ctx.fillText(`SEED ${seedLabel.toUpperCase()}`, w / 2, statsBlockY + statsBlockH + 16);
  }

  // Survived-to line only on loss.
  if (!victory) {
    ctx.fillStyle = UI_COLORS.creamDim;
    ctx.font = `italic 500 13px ${UI_FONTS.serif}`;
    ctx.textBaseline = 'top';
    ctx.fillText(`You survived to night ${clock.night}`, w / 2, statsBlockY + statsBlockH + 38);
  }

  // Return-to-menu pill — Space, Enter, click or R all send the player back.
  const btnY = statsBlockY + statsBlockH + 66;
  const btnText = 'Press Space to return to menu';
  ctx.font = `500 11px ${UI_FONTS.ui}`;
  const btnW = ctx.measureText(btnText).width + 52;
  const btnH = 30;
  const btnX = (w - btnW) / 2;
  ctx.strokeStyle = 'rgba(234, 223, 196, 0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(btnX + 0.5, btnY + 0.5, btnW - 1, btnH - 1);
  ctx.fillStyle = UI_COLORS.cream;
  ctx.textBaseline = 'middle';
  ctx.fillText(btnText, w / 2, btnY + btnH / 2);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawSmallCapsCentered(
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
