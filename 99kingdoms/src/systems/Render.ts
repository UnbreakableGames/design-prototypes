import {
  Hero,
  HERO_SWING_ARC,
  HERO_SWING_FLASH,
} from '../entities/Hero';
import { WorldMap, Decoration } from '../world/Map';
import { ResourceNode } from '../entities/ResourceNode';
import { Campfire, CAMPFIRE_AURA_PULSE_PERIOD, CAMPFIRE_AURA_INTERVAL, CAMPFIRE_LEVELS } from '../entities/Campfire';
import { Clock } from '../game/Clock';
import { Enemy, ENEMY_STATS } from '../entities/Enemy';
import { Recruit, RECRUIT_RADIUS, RESCUE_COST } from '../entities/Recruit';
import { Station, StationKind, STATION_STATS, effectiveStats, nextUpgradeCost, MAX_STATION_LEVEL, hireAnchorOffset, upgradeAnchorOffset, prereqMet, stationUpgradeBlockReason, describeNextUpgrade, RelicsFoundFlags, PREREQS } from '../entities/Station';
import { Projectile } from '../entities/Projectile';
import { Coin } from '../entities/Coin';
import { FlyingCoin, flyingCoinPos } from '../entities/FlyingCoin';
import { Portal, PORTAL_RADIUS } from '../entities/Portal';
import { POI, POI_INTERACT_DURATION } from '../entities/POI';
import { poiInstance } from '../game/POIInstances';
import type { NoteCard } from '../game/Narrative';
import {
  ForgeState,
  ForgeTrack,
  FORGE_TRACKS,
  tierOf,
  anyTierUnlocked,
} from '../game/BlacksmithUpgrades';
import { UI_COLORS, UI_FONTS, drawSmallCaps, drawCoinIcon } from '../ui/HUD';
import { drawKbdDark } from '../ui/MenuUI';
import {
  CHARCOAL,
  CHARCOAL_FONTS,
  handLine,
  handRect,
  handCircle,
  crossHatch,
  handText,
  inkSplatter,
} from './HandDrawn';

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

/**
 * Renders the blacksmith's whetstone purchase indicator: a row of cost
 * pips above the building when the upgrade is unbought AND the hero is
 * settled near it. Once bought, no overlay is rendered (the focus
 * panel + lasting +damage stat is the proof). Mirrors the lantern-hook
 * pip pattern.
 */
export function drawWhetstoneOverlay(
  ctx: CanvasRenderingContext2D,
  smith: Station,
  hero: Hero,
  cost: number,
  paidProgress: number,
  bought: boolean,
  heroIsSettled: boolean,
) {
  if (bought) return;
  const dHero = Math.hypot(smith.x - hero.x, smith.y - hero.y);
  // 56 ≈ BUILD_PAY_RANGE + a little buffer.
  if (dHero >= 56 || !heroIsSettled) return;
  // Pip row above the blacksmith — same offset as upgrade pips.
  drawCostSlots(ctx, smith.x, smith.y - 50, paidProgress, cost);
}

/**
 * Renders the lantern hook beside the campfire. The hook holds the
 * lantern when extinguished (warm ember inside, ready to be re-lit),
 * and shows an empty iron loop when the player has carried it off.
 * The duration bar lives on the player while they carry it (see
 * `drawHeroLantern`).
 */
export function drawLanternHook(
  ctx: CanvasRenderingContext2D,
  fire: Campfire,
  hero: Hero,
  coin: number,
  cost: number,
  fullDuration: number,
  timeLeft: number,
  paidProgress: number,
  heroIsSettled: boolean,
  payRange: number,
) {
  const ax = fire.x + 28;
  const ay = fire.y + 14;
  const carrying = timeLeft > 0;

  // Small wooden post.
  ctx.save();
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(ax - 1.2, ay - 12, 2.4, 14);

  if (carrying) {
    // Hook is empty — just the bare iron loop where the lantern
    // hangs. A small dim "O" tells the player "the lantern is gone,
    // I'm carrying it."
    ctx.strokeStyle = 'rgba(140,130,114,0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(ax, ay - 14, 2.4, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Hook holds the lantern, waiting to be re-lit. Same iron-cage
    // sprite the player will see at their hip once paid.
    ctx.fillStyle = '#1a1410';
    ctx.fillRect(ax - 4, ay - 18, 8, 8);
    ctx.fillStyle = 'rgba(214, 138, 58, 0.22)';
    ctx.beginPath();
    ctx.arc(ax, ay - 14, 1.5, 0, Math.PI * 2);
    ctx.fill();
    handRect(ctx, ax - 4, ay - 18, 8, 8, {
      seed: 7780,
      jitter: 0.4,
      samplesPerSide: 6,
      stroke: 'rgba(232,226,212,0.6)',
      strokeWidth: 0.7,
      opacity: 0.9,
    });
  }
  ctx.restore();

  // Pip row renders when the hero is inside the lantern pay zone AND
  // the lantern is extinguished AND they've stopped to interact.
  const dCf = Math.hypot(fire.x - hero.x, fire.y - hero.y);
  if (dCf < payRange && heroIsSettled && !carrying) {
    drawCostSlots(ctx, ax, ay - 30, paidProgress, cost);
  }
  void coin;
  void fullDuration;
}

/**
 * Draws a small lit lantern at the hero's hip + a duration bar above
 * the hero's head, while `timeLeft > 0`. The lantern is on the player
 * now — its status reads where the player's eye already is.
 */
export function drawHeroLantern(
  ctx: CanvasRenderingContext2D,
  hero: Hero,
  timeLeft: number,
  fullDuration: number,
) {
  if (timeLeft <= 0) return;
  if (hero.respawnTimer > 0) return;
  const litT = Math.min(1, timeLeft / fullDuration);

  // Hip-side lantern: small iron cage with a strap from the hero's
  // body. Ember inside whose intensity tracks remaining duration.
  const hx = hero.x + 9;
  const hy = hero.y + 4;
  ctx.save();
  ctx.strokeStyle = 'rgba(58, 42, 24, 0.85)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hero.x + 4, hero.y + 1);
  ctx.lineTo(hx, hy - 4);
  ctx.stroke();
  // Iron cage body.
  ctx.fillStyle = '#1a1410';
  ctx.fillRect(hx - 3, hy - 4, 6, 6);
  // Ember inside — bright halo around it.
  ctx.shadowColor = `rgba(255, 200, 110, ${0.7 + litT * 0.3})`;
  ctx.shadowBlur = 6 + litT * 4;
  ctx.fillStyle = `rgba(255, 210, 120, ${0.75 + litT * 0.25})`;
  ctx.beginPath();
  ctx.arc(hx, hy - 1, 1.3 + litT * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Hand-drawn outline.
  ctx.strokeStyle = 'rgba(232,226,212,0.7)';
  ctx.lineWidth = 0.7;
  ctx.strokeRect(hx - 3 + 0.5, hy - 4 + 0.5, 5, 5);
  ctx.restore();

  // Duration bar above the head.
  const barW = 18;
  const barH = 2;
  const bx = hero.x - barW / 2;
  const by = hero.y - hero.radius - 7;
  ctx.save();
  ctx.fillStyle = 'rgba(8, 6, 5, 0.9)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  ctx.fillStyle = 'rgba(232,226,212,0.18)';
  ctx.fillRect(bx, by, barW, barH);
  ctx.fillStyle = '#d68a3a';
  ctx.fillRect(bx, by, barW * litT, barH);
  ctx.restore();
}

/**
 * Draws a beacon over every undiscovered relic POI. Two layers:
 *
 *   1. **Always-visible distant star** — a small pulsing dot at the
 *      relic's screen position, visible from anywhere on the map.
 *      Lets the player see "something is out there" without needing
 *      to wander into proximity range first.
 *
 *   2. **Close-range halo** — once the hero is within `HINT_RANGE`,
 *      a warm radial gradient grows brighter as the player approaches.
 *      This is the "you're getting warmer" tell.
 *
 * Both layers render AFTER the fog overlay so they punch through
 * unexplored darkness — relics are special enough to be seen from
 * far away.
 */
export function drawRelicHints(
  ctx: CanvasRenderingContext2D,
  pois: POI[],
  hero: Hero,
  cameraX: number,
  cameraY: number,
  viewW: number,
  viewH: number,
) {
  const HINT_RANGE = 700;
  const HINT_RANGE_2 = HINT_RANGE * HINT_RANGE;
  ctx.save();
  for (const poi of pois) {
    if (poi.claimed) continue;
    const inst = poiInstance(poi.instanceId);
    if (!inst || inst.category !== 'relic') continue;
    const sx = poi.x - cameraX;
    const sy = poi.y - cameraY;
    const onScreen =
      sx >= -120 && sx <= viewW + 120 && sy >= -120 && sy <= viewH + 120;
    const pulse = 0.6 + Math.sin(performance.now() / 400) * 0.4;

    // Off-screen: render an edge-pip on the screen border in the
    // direction of the relic. Lets the player see "a relic is that
    // way" from spawn even if it's 1000+ units off-screen.
    if (!onScreen) {
      drawRelicEdgePip(ctx, sx, sy, viewW, viewH, pulse);
      continue;
    }

    const dx = poi.x - hero.x;
    const dy = poi.y - hero.y;
    const d2 = dx * dx + dy * dy;

    // Layer 1: always-visible distant star. Tiny, slow pulse, visible
    // regardless of distance so the player can see relics from across
    // the map. The brightness floor gives "there's a relic over there"
    // even from spawn.
    {
      const farAlpha = 0.5 * pulse;
      ctx.fillStyle = `rgba(255, 220, 140, ${farAlpha})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.0 + 0.9 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    // Layer 2: close-range halo, only inside HINT_RANGE.
    if (d2 <= HINT_RANGE_2) {
      const t = 1 - d2 / HINT_RANGE_2;
      const alpha = 0.32 * t * pulse;
      const r = 84;
      const grad = ctx.createRadialGradient(sx, sy, 6, sx, sy, r);
      grad.addColorStop(0, `rgba(255, 200, 110, ${alpha * 1.4})`);
      grad.addColorStop(0.5, `rgba(214, 138, 58, ${alpha * 0.55})`);
      grad.addColorStop(1, 'rgba(214, 138, 58, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
      // Brighter centre ember when close — replaces the distant star
      // so it doesn't double-render at the same spot.
      ctx.fillStyle = `rgba(255, 230, 150, ${Math.min(1, 0.55 + alpha * 2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.6 + 1.5 * pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Render a small ember chevron at the screen edge pointing toward an
 *  off-screen relic. Computes the intersection of the line from screen
 *  center to the relic's screen position with the canvas border. */
function drawRelicEdgePip(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  viewW: number,
  viewH: number,
  pulse: number,
) {
  const cx = viewW / 2;
  const cy = viewH / 2;
  const dx = sx - cx;
  const dy = sy - cy;
  if (dx === 0 && dy === 0) return;
  // Inset from the canvas edge so the pip isn't clipped by the body
  // bezel + so it visually reads as "in the world."
  const padX = 18;
  const padY = 18;
  // Find the t along [center → relic] where the ray exits the inset
  // rectangle. The smallest positive t along x or y is our exit edge.
  const tx = dx > 0 ? (viewW - padX - cx) / dx : dx < 0 ? (padX - cx) / dx : Infinity;
  const ty = dy > 0 ? (viewH - padY - cy) / dy : dy < 0 ? (padY - cy) / dy : Infinity;
  const t = Math.min(tx, ty);
  const ex = cx + dx * t;
  const ey = cy + dy * t;
  const angle = Math.atan2(dy, dx);

  ctx.save();
  // Soft halo behind the pip so it's legible against any background.
  const haloAlpha = 0.45 * pulse;
  const haloGrad = ctx.createRadialGradient(ex, ey, 2, ex, ey, 18);
  haloGrad.addColorStop(0, `rgba(255, 200, 110, ${haloAlpha})`);
  haloGrad.addColorStop(1, 'rgba(214, 138, 58, 0)');
  ctx.fillStyle = haloGrad;
  ctx.beginPath();
  ctx.arc(ex, ey, 18, 0, Math.PI * 2);
  ctx.fill();

  // Bright ember dot at the screen-edge anchor.
  ctx.fillStyle = `rgba(255, 220, 140, ${0.85 * pulse})`;
  ctx.beginPath();
  ctx.arc(ex, ey, 3 + 1.2 * pulse, 0, Math.PI * 2);
  ctx.fill();

  // Chevron pointing in the relic's direction.
  ctx.translate(ex, ey);
  ctx.rotate(angle);
  ctx.fillStyle = `rgba(255, 230, 150, ${0.7 * pulse})`;
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(0, -4);
  ctx.lineTo(2, 0);
  ctx.lineTo(0, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** While the lantern is lit the hero gets a soft ember halo, pulsing
 *  slightly with the remaining duration so the player feels it ticking
 *  down. Drawn at world position so it follows the hero through the
 *  camera transform. */
export function drawLanternHalo(
  ctx: CanvasRenderingContext2D,
  hero: Hero,
  timeLeft: number,
  fullDuration: number,
  radius: number,
) {
  if (timeLeft <= 0) return;
  if (hero.respawnTimer > 0) return;
  const t = timeLeft / fullDuration;
  const pulse = 0.85 + Math.sin(performance.now() / 220) * 0.06;
  ctx.save();
  // Outer ring — bright at full charge, dimmer near out.
  const grad = ctx.createRadialGradient(hero.x, hero.y, radius * 0.2, hero.x, hero.y, radius);
  grad.addColorStop(0, `rgba(255, 200, 110, ${0.18 * t * pulse})`);
  grad.addColorStop(0.6, `rgba(214, 138, 58, ${0.10 * t * pulse})`);
  grad.addColorStop(1, 'rgba(214, 138, 58, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(hero.x, hero.y, radius, 0, Math.PI * 2);
  ctx.fill();
  // Crisp ring at the edge — the kill-zone boundary.
  ctx.strokeStyle = `rgba(255, 200, 110, ${0.45 * t})`;
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.arc(hero.x, hero.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawCampfireUpgradeHint(
  ctx: CanvasRenderingContext2D,
  fire: Campfire,
  hero: Hero,
  stations: Station[],
  isNight: boolean,
  relicsFound: { l2: boolean; l3: boolean },
  heroIsSettled: boolean,
) {
  if (!heroIsSettled) return;
  const nextCost = fire.nextUpgradeCost();
  if (nextCost === null) return;
  if (isNight) return;
  if (fire.upgradeBlockReason(stations, relicsFound) !== null) return;
  if (fire.readyTimer > 0) return;
  const d = Math.hypot(fire.x - hero.x, fire.y - hero.y);
  if (d > INDICATOR_RADIUS) return;
  drawUpgradeSlots(ctx, fire.x, fire.y - 38, fire.upgradeProgress, nextCost, fire.level + 1);
}

/**
 * Renders the three-track forge overlay above an active blacksmith:
 *
 *     1·ARCHERS   ▲ ▲ ▽            (selected)
 *     2·SOLDIERS  ▲ ▽ ▽
 *     3·KNIGHTS   ▽ ▽ ▽
 *
 * Each row shows three chevron slots — filled (ember) for tiers bought,
 * hollow (bone-dim) for tiers locked. The currently-selected track gets
 * a brighter row + a small pip strip showing in-progress coins paid
 * toward the next tier. When the player isn't near, the overlay fades
 * to a hint-level alpha so it stays present without being noisy.
 */
export function drawForgeOverlay(
  ctx: CanvasRenderingContext2D,
  smith: Station,
  forge: ForgeState,
  hero: Hero,
  heroIsSettled: boolean,
) {
  // Hide entirely until the player has unlocked their first tier via a
  // POI. The blacksmith stands as a building from the moment it's
  // placed, but its chevron status board only appears after the player
  // has earned something to display. This keeps the mechanic a
  // surprise that reveals on first claim.
  if (!anyTierUnlocked(forge)) return;
  void heroIsSettled;

  const dx = smith.x - hero.x;
  const dy = smith.y - hero.y;
  const d = Math.hypot(dx, dy);
  const closeness = d > 130 ? 0 : 1 - Math.min(1, Math.max(0, (d - 50) / 80));
  const baseAlpha = 0.55 + closeness * 0.45;

  const ax = smith.x;
  const topY = smith.y - 50;
  const rowH = 13;

  const tracks: ForgeTrack[] = ['archer', 'soldier', 'knight'];
  ctx.save();
  ctx.globalAlpha *= baseAlpha;

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const spec = FORGE_TRACKS[track];
    const tier = tierOf(forge, track);
    const y = topY + i * rowH;

    // Track label (no hotkey now — tracks aren't selectable). Show in
    // ember if this track has any tier earned, dim if zero.
    const earned = tier > 0;
    handText(ctx, spec.label.toUpperCase(), ax - 12, y + 4, {
      seed: 7400 + i * 17,
      jitter: 0.2,
      fontSize: 7.5,
      font: CHARCOAL_FONTS.mono,
      fill: earned ? CHARCOAL.ember : 'rgba(232,226,212,0.5)',
      weight: 700,
      letterSpacing: 1.2,
      align: 'right',
    });

    // Three chevron slots representing tiers 1/2/3 — filled if earned.
    const chevX0 = ax - 6;
    for (let t = 0; t < 3; t++) {
      const cx = chevX0 + t * 9;
      const filled = tier > t;
      drawForgeChevron(
        ctx,
        cx,
        y,
        filled,
        filled,
        CHARCOAL.ember,
        7400 + i * 17 + t,
      );
    }
  }
  ctx.restore();
}

function drawForgeChevron(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  filled: boolean,
  highlight: boolean,
  pulseColor: string,
  seed: number,
) {
  ctx.save();
  if (filled) {
    if (highlight) {
      ctx.shadowColor = pulseColor;
      ctx.shadowBlur = 4;
    }
    ctx.fillStyle = pulseColor;
  } else {
    ctx.fillStyle = 'rgba(232,226,212,0.20)';
  }
  // Hand-drawn upward chevron — three points with a tiny jitter.
  const jx = ((seed * 9301 + 49297) % 233280) / 233280 - 0.5;
  ctx.beginPath();
  ctx.moveTo(cx - 3 + jx * 0.6, cy + 2);
  ctx.lineTo(cx + jx * 0.4, cy - 2.5);
  ctx.lineTo(cx + 3 + jx * 0.6, cy + 2);
  ctx.closePath();
  ctx.fill();
  if (filled && highlight) ctx.shadowBlur = 0;
  ctx.restore();
}

export function drawCampfire(ctx: CanvasRenderingContext2D, fire: Campfire) {
  // ── Aura visualisation ────────────────────────────────────────────
  // The campfire damages any enemy inside its aura radius. The boundary
  // is always legible — a persistent bright dashed warm ring marks the
  // damage zone. A slow ~10-second sine pulse adds a warmer overlay on
  // the same ring so the fire reads as "breathing." The pulse is
  // intentionally decoupled from the damage tick cadence — ticks happen
  // a few times a second, but that'd strobe; this breathes.
  const auraR = fire.auraRadius + Math.sin(fire.flicker) * 1.5;
  // Smooth sine from 0 → 1 → 0 over the pulse period. Using `(1-cos)/2`
  // lands at 0 at phase 0 and 1 at phase period/2, both ends continuous.
  const pulseFrac =
    0.5 * (1 - Math.cos((2 * Math.PI * fire.auraPulsePhase) / CAMPFIRE_AURA_PULSE_PERIOD));
  ctx.save();
  // Faint warm disc that leaks outward toward the aura radius.
  const auraFill = ctx.createRadialGradient(fire.x, fire.y, auraR * 0.55, fire.x, fire.y, auraR);
  auraFill.addColorStop(0, 'rgba(255, 180, 90, 0)');
  auraFill.addColorStop(0.85, 'rgba(255, 170, 80, 0.06)');
  auraFill.addColorStop(1, 'rgba(255, 140, 60, 0)');
  ctx.fillStyle = auraFill;
  ctx.fillRect(fire.x - auraR, fire.y - auraR, auraR * 2, auraR * 2);
  // 1) Persistent baseline ring — bright enough to read clearly at a
  //    glance, so the player never has to squint for the damage zone.
  ctx.strokeStyle = 'rgba(255, 195, 110, 0.65)';
  ctx.lineWidth = 1.25;
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  ctx.arc(fire.x, fire.y, auraR, 0, Math.PI * 2);
  ctx.stroke();
  // 2) Slow warm overlay — same ring, alpha driven by the 10s sine
  //    pulse. Sits on top of the baseline so the ring gently breathes
  //    in and out of full brightness.
  ctx.strokeStyle = `rgba(255, 220, 150, ${pulseFrac * 0.5})`;
  ctx.lineWidth = 1.75;
  ctx.beginPath();
  ctx.arc(fire.x, fire.y, auraR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

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

export function drawRecruits(
  ctx: CanvasRenderingContext2D,
  recruits: Recruit[],
  stations: Station[],
) {
  // Build a quick lookup so the per-recruit draw can reflect the
  // assigned station's kind without an O(n*m) scan.
  const stationById = new Map<number, Station>();
  for (const s of stations) stationById.set(s.id, s);
  for (const r of recruits) {
    const station = r.stationId !== null ? stationById.get(r.stationId) : undefined;
    drawRecruit(ctx, r, station ? station.kind : null);
  }
}

/**
 * Per-job visual config for recruits. Each entry tweaks the body fill,
 * outline, head color, and an optional small glyph that hints at the
 * villager's role (axe / bow / sword / shield + sword / hammer). The
 * "wandering" + "idle" states fall back to neutral palettes.
 */
type RecruitJob =
  | 'wandering'
  | 'idle'
  | 'gather'
  | 'tower'
  | 'barracks'
  | 'garrison'
  | 'workshop';

interface RecruitJobLook {
  body: string;
  outline: string;
  hair: string;
  /** Drawn at the recruit's right shoulder/hip after the body. */
  drawTool?: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
}

const RECRUIT_LOOKS: Record<RecruitJob, RecruitJobLook> = {
  // Drab grey-tan, looks underfed. The "?" callout above already says
  // "rescue me"; the body just confirms they're still wild.
  wandering: { body: '#d8cbb4', outline: '#7a6a4f', hair: '#7a6a4f' },
  // Warm cream — they've been brought in, fed, are loitering at camp.
  idle:      { body: '#ffe9a8', outline: '#2a1a0a', hair: '#6b4a2b' },
  // Earth brown — foresters wear hard-wearing canvas; the axe over
  // the shoulder is for clearing space, not chopping for coin.
  gather: {
    body: '#c2956a', outline: '#3a2310', hair: '#5a3a1c',
    drawTool: drawAxeOnShoulder,
  },
  // Forest green — archers wear dark cloth so the bow doesn't catch
  // the eye of the thing they're aiming at.
  tower: {
    body: '#7a8c5a', outline: '#2a3210', hair: '#4a3818',
    drawTool: drawBowOnBack,
  },
  // Steel blue — barracks soldiers are the camp's mid-line; they
  // chase enemies into range and trade hits.
  barracks: {
    body: '#6a7c98', outline: '#1a2030', hair: '#2a2418',
    drawTool: drawSwordAtHip,
  },
  // Iron grey + mail dots — knights stand the wall.
  garrison: {
    body: '#9aa0a8', outline: '#1a1c20', hair: '#3a3018',
    drawTool: drawShieldAndSword,
  },
  // Rust orange — workshop builders carry the dirty toolwork.
  workshop: {
    body: '#c2774a', outline: '#3a1a08', hair: '#4a2a18',
    drawTool: drawHammerAtHip,
  },
};

function recruitJobFor(r: Recruit, stationKind: StationKind | null): RecruitJob {
  if (r.status === 'wandering') return 'wandering';
  if (!stationKind) return 'idle';
  switch (stationKind) {
    case 'gather': return 'gather';
    case 'tower': return 'tower';
    case 'barracks': return 'barracks';
    case 'garrison': return 'garrison';
    case 'workshop': return 'workshop';
    default: return 'idle';
  }
}

// ── Tool overlay sprites (tiny hand-drawn glyphs) ─────────────────────

function drawAxeOnShoulder(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Haft over the right shoulder, head poking up.
  ctx.save();
  ctx.strokeStyle = '#3a2310';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 4, y - 4);
  ctx.lineTo(x + 8, y - 12);
  ctx.stroke();
  ctx.fillStyle = '#a8a8a8';
  ctx.beginPath();
  ctx.moveTo(x + 7, y - 13);
  ctx.lineTo(x + 11, y - 11);
  ctx.lineTo(x + 9, y - 9);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.6;
  ctx.stroke();
  ctx.restore();
}

function drawBowOnBack(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Bow curve diagonal across the back, plus a tiny string.
  ctx.save();
  ctx.strokeStyle = '#5a3a1c';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(x + 1, y - 4, 7, -0.7, 0.7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(232,226,212,0.7)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + 6.5, y - 8);
  ctx.lineTo(x + 6.5, y);
  ctx.stroke();
  ctx.restore();
}

function drawSwordAtHip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Sword pommel + scabbard on the right hip.
  ctx.save();
  ctx.fillStyle = '#1a1c20';
  ctx.fillRect(x + 5, y + 1, 1.4, 8);
  ctx.fillStyle = '#c0c0c8';
  ctx.beginPath();
  ctx.arc(x + 5.7, y + 1, 1.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a1c20';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
}

function drawShieldAndSword(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Sword on right hip + small round shield on left arm.
  drawSwordAtHip(ctx, x, y);
  ctx.save();
  ctx.fillStyle = '#5a3018';
  ctx.beginPath();
  ctx.arc(x - 6, y + 2, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1a0e08';
  ctx.lineWidth = 0.8;
  ctx.stroke();
  // Shield boss.
  ctx.fillStyle = '#c0c0c8';
  ctx.beginPath();
  ctx.arc(x - 6, y + 2, 1.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawHammerAtHip(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Wooden haft, square iron head.
  ctx.save();
  ctx.fillStyle = '#5a3a1c';
  ctx.fillRect(x + 4.5, y + 1, 1.4, 7);
  ctx.fillStyle = '#7a7a82';
  ctx.fillRect(x + 4, y - 1, 3, 3);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.6;
  ctx.strokeRect(x + 4, y - 1, 3, 3);
  ctx.restore();
}

export function drawWandererSlots(
  ctx: CanvasRenderingContext2D,
  recruits: Recruit[],
  hero: Hero,
  heroIsSettled: boolean,
) {
  if (!heroIsSettled) return;
  for (const r of recruits) {
    if (r.status !== 'wandering') continue;
    if (Math.hypot(r.x - hero.x, r.y - hero.y) > INDICATOR_RADIUS) continue;
    drawCostSlots(ctx, r.x, r.y - RECRUIT_RADIUS - 14, r.rescueProgress, RESCUE_COST);
  }
}

function drawRecruit(
  ctx: CanvasRenderingContext2D,
  r: Recruit,
  stationKind: StationKind | null,
) {
  const wandering = r.status === 'wandering';
  const job = recruitJobFor(r, stationKind);
  const look = RECRUIT_LOOKS[job];

  ctx.fillStyle = look.body;
  ctx.beginPath();
  ctx.arc(r.x, r.y, RECRUIT_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = look.outline;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Hair / hat strip — sits on top of the head.
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  ctx.ellipse(r.x, r.y - RECRUIT_RADIUS, 6, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // Mail dots for knights — three small grey dots across the chest.
  if (job === 'garrison') {
    ctx.fillStyle = '#c0c0c8';
    ctx.beginPath();
    ctx.arc(r.x - 2, r.y + 1, 0.7, 0, Math.PI * 2);
    ctx.arc(r.x, r.y + 1.5, 0.7, 0, Math.PI * 2);
    ctx.arc(r.x + 2, r.y + 1, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.arc(r.x - 1.8, r.y, 0.8, 0, Math.PI * 2);
  ctx.arc(r.x + 1.8, r.y, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // Tool overlay (axe, bow, sword, shield, hammer) — only for jobs.
  if (look.drawTool) look.drawTool(ctx, r.x, r.y);

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

/** Whether the station's footprint should appear in the layout at all.
 *  Hidden until the campfire-level requirement is met — that gate is
 *  the "this part of the base exists" tier marker. The relic and
 *  station-chain gates leave the footprint visible-but-dimmed once
 *  visibility kicks in, so the player can see what they're working
 *  toward. */
function isStationFootprintVisible(
  kind: StationKind,
  campfireLevel: number,
): boolean {
  return PREREQS[kind].campfireLevel <= campfireLevel;
}

export function drawStations(
  ctx: CanvasRenderingContext2D,
  stations: Station[],
  payTargetId: number | null,
  hero: Hero,
  campfireLevel: number,
  isNight: boolean,
  heroIsSettled: boolean,
  relicsFound: RelicsFoundFlags,
) {
  // Body pass — render every station whose campfire-level requirement
  // is met. Stations gated above the current campfire tier are hidden
  // entirely (no footprint, no focus panel). Stations that meet the
  // tier but fail another gate (relic missing, chain prereq missing)
  // appear at 0.4 alpha so the player can see what they're working
  // toward.
  for (const s of stations) {
    if (!isStationFootprintVisible(s.kind, campfireLevel)) continue;
    const met = prereqMet(s.kind, stations, campfireLevel, relicsFound);
    ctx.save();
    if (!met) ctx.globalAlpha *= 0.4;
    drawStation(ctx, s.kind, s.x, s.y, !s.active);
    ctx.restore();
  }
  // Overlay pass — pip rows, hire dots, settling pulses, etc. only
  // render when the prereq is met (otherwise the player would see
  // payment surfaces for a station they can't build).
  for (const s of stations) {
    if (!prereqMet(s.kind, stations, campfireLevel, relicsFound)) continue;
    const nearEnough =
      Math.hypot(s.x - hero.x, s.y - hero.y) < INDICATOR_RADIUS;
    // Coin pips (build / hire / upgrade) only render when the player
    // has actually stopped near the building — keeps the screen clean
    // during traversal. The pay-target ring + settling pulse + repair
    // FX still render unconditionally because they're feedback for an
    // action already in flight, not "you can spend here" hints.
    const showPips = nearEnough && heroIsSettled;

    if (!s.active) {
      const isFresh = s.readyTimer > 0;
      if (showPips && !isNight && !isFresh) {
        const total = STATION_STATS[s.kind].cost;
        const yOffset = s.kind === 'wall' ? -22 : -40;
        drawCostSlots(ctx, s.x, s.y + yOffset, total - s.buildRemaining, total);
      }
      if (showPips && isNight) {
        drawNightLock(ctx, s.x, s.y + (s.kind === 'wall' ? -22 : -36));
      }
      if (isFresh) drawSettlingPulse(ctx, s);
      if (s.id === payTargetId) drawPayTargetRing(ctx, s, '#ffd95a');
      continue;
    }
    const eff = effectiveStats(s);
    const committed = s.recruitIds.length + s.paidSlots;
    const hasOpenSlot = eff.capacity > 0 && committed < eff.capacity;

    if (showPips && s.readyTimer <= 0) {
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
  ctx.globalAlpha *= alpha;
  // Hand-drawn dried-blood disc with a bone "!" inside.
  handCircle(ctx, s.x, s.y - 34, 8, {
    seed: 9770 + Math.round(s.x) * 13,
    jitter: 0.5,
    samples: 14,
    stroke: '#7a0f0f',
    strokeWidth: 1.1,
    fill: CHARCOAL.accent,
  });
  ctx.fillStyle = CHARCOAL.ink2;
  ctx.font = `700 11px ${CHARCOAL_FONTS.serif}`;
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
  // Expanding ember ring — warm gold to match dawn/upgrade feel.
  ctx.strokeStyle = `rgba(214, 138, 58, ${0.7 * alpha * (1 - pulse % 1)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s.x, s.y, baseR + (pulse % 1) * 14, 0, Math.PI * 2);
  ctx.stroke();

  // Label below.
  ctx.fillStyle = `rgba(214, 138, 58, ${alpha})`;
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
  const r = 2.4;
  const gap = 2;
  const step = r * 2 + gap;
  const totalW = s.level * step - gap;
  const startX = s.x - totalW / 2 + r;
  ctx.save();
  for (let i = 0; i < s.level; i++) {
    // Hand-drawn ember pip — small filled circle with a brief stroke jitter.
    handCircle(ctx, startX + i * step, baseY, r, {
      seed: 9750 + Math.round(s.x) * 17 + i,
      jitter: 0.3,
      samples: 10,
      stroke: '#8a5a18',
      strokeWidth: 0.8,
      fill: CHARCOAL.ember,
      opacity: 0.95,
    });
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
    // Bone disc — IOU mark for paid-but-unfilled hire slots.
    handCircle(ctx, x, cy, r, {
      seed: 9760 + Math.round(cx) * 11 + i,
      jitter: 0.3,
      samples: 10,
      stroke: 'rgba(232,226,212,0.7)',
      strokeWidth: 0.9,
      fill: 'rgba(232,226,212,0.85)',
    });
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
  relicsFound: RelicsFoundFlags,
  forge: ForgeState,
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
    // Skip stations whose campfire-tier gate hasn't been met yet —
    // those ghosts aren't visible on the map and their focus panel
    // would be a phantom popping up over empty grass.
    if (!isStationFootprintVisible(s.kind, campfire.level)) continue;
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
    if (nearestStation.kind === 'blacksmith' && nearestStation.active) {
      renderForgePanel(ctx, forge, w, h);
    } else {
      renderStationPanel(ctx, nearestStation, coin, w, h, hero, campfire.level, isNight, stations, relicsFound);
    }
  } else if (nearestNode) {
    renderNodePanel(ctx, nearestNode, w, h);
  } else if (nearestWanderer) {
    renderWandererPanel(ctx, coin, w, h);
  } else if (nearestPOI) {
    renderPOIPanel(ctx, nearestPOI, w, h);
  } else if (nearestPortal) {
    renderPortalPanel(ctx, nearestPortal, w, h);
  } else if (nearestCampfire) {
    renderCampfirePanel(ctx, nearestCampfire, coin, w, h, stations, isNight, relicsFound);
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
  stations: Station[],
  relicsFound: RelicsFoundFlags,
) {
  const stats = STATION_STATS[station.kind];
  const eff = effectiveStats(station);
  // Bare station name — the "(building)" suffix was dropped (the action
  // line already says "Hold Space to build" so the inactive state is
  // already clear). Level moves to its own row via drawInfoPanel.
  const title = stats.name;
  const level = station.active ? `L${station.level}` : null;

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
    const prereqOk = prereqMet(station.kind, stations, campfireLevel, relicsFound);
    if (!prereqOk) {
      const reason = missingRelicHint(station.kind, relicsFound, campfireLevel, stations);
      actionLine = reason ?? 'Locked — prereq missing';
      actionColor = reason ? '#d6c25a' : '#aac6ff';
    } else if (isNight) {
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

  drawInfoPanel(ctx, w, h, title, statusLine, statusColor, actionLine, actionColor, level);
}

/** Bottom-left focus panel for the active blacksmith. Lists all three
 *  forge tracks: current tier name (or "—" if untouched), next tier
 *  cost + blurb. The currently-selected track is highlighted in ember;
 *  hotkeys are rendered as tiny keycap-shaped boxes. */
function renderForgePanel(
  ctx: CanvasRenderingContext2D,
  forge: ForgeState,
  _canvasW: number,
  canvasH: number,
) {
  const panelW = 360;
  const panelH = 142;
  const panelX = 14;
  // Bottom-aligned with the action bar (which sits 22 px above the
  // canvas bottom edge — see ACTION_BAR_BOTTOM_MARGIN in HUD.ts).
  const panelY = canvasH - panelH - 22;

  ctx.save();

  // Charcoal page + border + spine drip — same chrome as other focus panels.
  ctx.fillStyle = CHARCOAL.bg;
  ctx.fillRect(panelX, panelY, panelW, panelH);
  handRect(ctx, panelX, panelY, panelW, panelH, {
    seed: 7900,
    jitter: 1.0,
    samplesPerSide: 18,
    stroke: CHARCOAL.ink,
    strokeWidth: 1,
    opacity: 0.7,
  });
  handLine(ctx, panelX + 3, panelY + 6, panelX + 3, panelY + panelH - 6, {
    seed: 7901,
    jitter: 0.7,
    samples: 14,
    stroke: CHARCOAL.accent,
    strokeWidth: 1.4,
    opacity: 0.55,
  });

  const padX = 18;

  handText(ctx, 'THE FORGE', panelX + padX, panelY + 22, {
    seed: 7910,
    jitter: 0.2,
    fontSize: 10,
    font: CHARCOAL_FONTS.mono,
    fill: CHARCOAL.bloodInk,
    weight: 700,
    letterSpacing: 3,
  });
  handText(ctx, 'What the relics taught', panelX + padX, panelY + 46, {
    seed: 7911,
    jitter: 0.4,
    fontSize: 19,
    font: CHARCOAL_FONTS.serif,
    fill: CHARCOAL.ink,
    weight: 700,
    italic: true,
  });

  // Three track rows. Status only — tier earned via POI claims, no
  // payment surface here.
  const tracks: ForgeTrack[] = ['archer', 'soldier', 'knight'];
  const rowY0 = panelY + 66;
  const rowH = 22;
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const spec = FORGE_TRACKS[track];
    const tier = tierOf(forge, track);
    const earned = tier > 0;
    const y = rowY0 + i * rowH;

    // Track label.
    const labelX = panelX + padX;
    handText(ctx, spec.label.toUpperCase(), labelX, y + 1, {
      seed: 7930 + i,
      jitter: 0.2,
      fontSize: 10,
      font: CHARCOAL_FONTS.mono,
      fill: earned ? CHARCOAL.ember : CHARCOAL.ink,
      weight: 700,
      letterSpacing: 2,
    });

    // Three chevrons showing tier completion.
    const chevX0 = labelX + 88;
    for (let t = 0; t < 3; t++) {
      const cx = chevX0 + t * 11;
      drawForgeChevron(
        ctx,
        cx,
        y - 3,
        tier > t,
        earned,
        CHARCOAL.ember,
        7940 + i * 3 + t,
      );
    }

    // Most recent earned tier blurb (or "Untouched" when zero).
    const next2X = chevX0 + 36;
    if (tier === 0) {
      handText(ctx, 'Untouched. Find a relic.', next2X, y + 1, {
        seed: 7960 + i,
        jitter: 0.2,
        fontSize: 10,
        font: UI_FONTS.ui,
        fill: CHARCOAL.inkDim,
        italic: true,
      });
    } else if (tier >= 3) {
      handText(ctx, 'Fully forged.', next2X, y + 1, {
        seed: 7970 + i,
        jitter: 0.2,
        fontSize: 10,
        font: UI_FONTS.ui,
        fill: CHARCOAL.inkDim,
        italic: true,
      });
    } else {
      const tierSpec = spec.tiers[tier - 1];
      handText(ctx, tierSpec.name, next2X, y + 1, {
        seed: 7960 + i,
        jitter: 0.2,
        fontSize: 10,
        font: UI_FONTS.ui,
        fill: CHARCOAL.ink,
        italic: true,
      });
    }
  }

  ctx.restore();
}

function renderCampfirePanel(
  ctx: CanvasRenderingContext2D,
  fire: Campfire,
  coin: number,
  w: number,
  h: number,
  stations: Station[],
  isNight: boolean,
  relicsFound: { l2: boolean; l3: boolean },
) {
  const title = `Campfire`;
  const level = `L${fire.level}`;
  const upCostBase = fire.nextUpgradeCost();
  let statusLine: string;
  let statusColor = '#cfcfcf';
  // Aura DPS — the campfire passively burns enemies inside its aura
  // ring. Damage is per-tick (auraDamage every CAMPFIRE_AURA_INTERVAL
  // seconds); we display it as damage-per-second so the player can read
  // the aura at the same scale as their own DPS.
  const auraDpsCurrent = fire.auraDamage / CAMPFIRE_AURA_INTERVAL;
  const fmtDps = (v: number) =>
    Number.isInteger(v * 10) ? v.toFixed(1) : v.toFixed(2);

  if (upCostBase !== null && fire.upgradeBlockReason(stations, relicsFound) === null) {
    // Upgrade preview — HP delta + aura damage delta. The light-radius
    // gain reads visibly on the map so we don't call it out numerically.
    const nextIdx = fire.level; // 0-based into CAMPFIRE_LEVELS for next level
    const cur = fire.maxHp;
    const nxt = CAMPFIRE_LEVELS[nextIdx]?.maxHp;
    const auraDpsNext = (CAMPFIRE_LEVELS[nextIdx]?.auraDamage ?? 0) / CAMPFIRE_AURA_INTERVAL;
    const parts: string[] = [];
    if (nxt && cur) parts.push(`+${nxt - cur} HP`);
    if (auraDpsNext > 0) parts.push(`+${fmtDps(auraDpsNext - auraDpsCurrent)} dmg/s aura`);
    statusLine = parts.join(' · ');
    statusColor = '#aac6ff';
  } else {
    statusLine = `HP ${Math.ceil(fire.hp)}/${fire.maxHp} · ${fmtDps(auraDpsCurrent)} dmg/s aura`;
  }
  let actionLine: string | null = null;
  let actionColor = '#cfcfcf';
  const upCost = fire.nextUpgradeCost();
  const block = fire.upgradeBlockReason(stations, relicsFound);
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
  drawInfoPanel(ctx, w, h, title, statusLine, statusColor, actionLine, actionColor, level);
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

/** Short atmospheric blurb for the focus panel — a few words that
 *  describe the POI without disclosing what claiming it gives the
 *  player. The full payoff arrives on the claim's lore card; until
 *  then the player is moving toward something they only half-know. */
function poiBlurb(poi: POI): string {
  const inst = poiInstance(poi.instanceId);
  if (!inst) return '';
  switch (inst.category) {
    case 'relic':
      return 'Older than ash';
    case 'settlement':
      return 'Smoke once rose here';
    case 'lore':
      return 'Something somebody dropped';
    case 'upgrade':
      return 'A lesson the iron remembers';
    case 'night':
      return 'A bargain offered in the dark';
  }
}

function renderPOIPanel(
  ctx: CanvasRenderingContext2D,
  poi: POI,
  w: number,
  h: number,
) {
  const inst = poiInstance(poi.instanceId);
  const title = inst?.label ?? '';
  const statusLine = poiBlurb(poi);
  const actionLine = inst?.hint ?? '';
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
    case 'gather': return 'Foresters';
    case 'tower': return 'Archers';
    case 'workshop': return 'Builders';
    case 'barracks': return 'Knights';
    case 'garrison': return 'Soldiers';
    case 'wall': return 'Wall';
    case 'farm': return 'Farm';
    case 'blacksmith': return 'Blacksmith';
  }
}

/** Returns the most informative reason a build is blocked, or null if
 *  the prereq is fully satisfied. Hint priority: relic missing →
 *  campfire-level too low → station-chain prereq missing → null
 *  (means it's actually buildable). The relic gate goes first because
 *  it's the explorable gate the player has the most agency over. */
function missingRelicHint(
  kind: StationKind,
  relicsFound: RelicsFoundFlags,
  campfireLevel: number,
  stations: Station[],
): string | null {
  // Relic gate (when applicable).
  if (kind === 'workshop' && !relicsFound.workshop)
    return "Find the mason's blueprint in the wilds";
  if (kind === 'blacksmith' && !relicsFound.blacksmith)
    return 'Find the anvil that remembers in the wilds';
  // Internal kind 'barracks' is the patrol building (display "Stables").
  if (kind === 'barracks' && !relicsFound.stables)
    return 'Find the bridle of the last horse in the wilds';

  // Campfire-level gate.
  const reqLevel =
    kind === 'workshop' || kind === 'blacksmith' || kind === 'barracks' ? 2 : 1;
  if (campfireLevel < reqLevel) {
    return `Feed the fire to Campfire L${reqLevel} first`;
  }

  // Station-chain gate (e.g. workshop needs an active tower).
  // Watchtower + forester's hut both have no chain prereq — they're
  // open from the start, so neither appears here.
  const chainMap: Partial<Record<StationKind, { req: StationKind; label: string }>> = {
    workshop:   { req: 'tower',    label: 'Watchtower' },
    farm:       { req: 'tower',    label: 'Watchtower' },
    garrison:   { req: 'tower',    label: 'Watchtower' },
    blacksmith: { req: 'tower',    label: 'Watchtower' },
    barracks:   { req: 'garrison', label: 'Barracks' },
  };
  const chain = chainMap[kind];
  if (chain && !stations.some((s) => s.kind === chain.req && s.active)) {
    return `Build a ${chain.label} first`;
  }

  return null;
}

function roleBlurb(kind: StationKind): string {
  switch (kind) {
    case 'gather': return 'Foresters plant trees and bushes you can chop';
    case 'tower': return 'Archers defend at night — holds 3 villagers';
    case 'workshop': return 'Builders repair damaged walls';
    case 'barracks': return 'Knights patrol and chase enemies at night';
    case 'garrison': return 'Soldiers take up wall posts and melee attackers';
    case 'wall': return 'Blocks enemies — destructible';
    case 'farm': return 'Passive coin income — no villager needed';
    case 'blacksmith': return 'Houses the whetstone — sharpens the hero blade';
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
  level: string | null = null,
) {
  // The FOCUS eyebrow was dropped — the panel only appears when the
  // hero is near something, so the chrome itself signals "this is your
  // focus." `level` (when supplied) renders right-aligned on the same
  // row as the title — no extra height needed.
  const panelW = 304;
  const panelH = actionLine ? 78 : 50;
  const panelX = 14;
  // Bottom-aligned with the action bar (which sits 22 px above the
  // canvas bottom edge — see ACTION_BAR_BOTTOM_MARGIN in HUD.ts).
  const panelY = canvasH - panelH - 22;

  ctx.save();

  // Charcoal page body.
  ctx.fillStyle = CHARCOAL.bg;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // Hand-drawn charcoal border.
  handRect(ctx, panelX, panelY, panelW, panelH, {
    seed: 7700,
    jitter: 1.0,
    samplesPerSide: 16,
    stroke: CHARCOAL.ink,
    strokeWidth: 1,
    opacity: 0.7,
  });

  // Dried-blood spine drip — same signature as HUD/menus.
  handLine(ctx, panelX + 3, panelY + 6, panelX + 3, panelY + panelH - 6, {
    seed: 7701,
    jitter: 0.7,
    samples: 12,
    stroke: CHARCOAL.accent,
    strokeWidth: 1.4,
    opacity: 0.55,
  });

  const padX = 18;

  // Italic-serif title in bone.
  handText(ctx, title, panelX + padX, panelY + 26, {
    seed: 7711,
    jitter: 0.4,
    fontSize: 19,
    font: CHARCOAL_FONTS.serif,
    fill: CHARCOAL.ink,
    weight: 700,
    italic: true,
  });

  // Optional level — small mono accent, right-aligned on the same row
  // as the italic-serif title. Used for stations + campfire (e.g. "L1").
  if (level) {
    handText(ctx, level, panelX + panelW - padX, panelY + 26, {
      seed: 7713,
      jitter: 0.25,
      fontSize: 10,
      font: CHARCOAL_FONTS.mono,
      fill: CHARCOAL.bloodInk,
      weight: 700,
      letterSpacing: 2.5,
      align: 'right',
    });
  }

  // Status line in dim bone.
  handText(ctx, statusLine, panelX + padX, panelY + 44, {
    seed: 7712,
    jitter: 0.3,
    fontSize: 11,
    font: UI_FONTS.ui,
    fill: CHARCOAL.inkDim,
    italic: true,
  });

  if (actionLine) {
    // Hand-drawn dashed divider.
    handLine(
      ctx,
      panelX + padX,
      panelY + 56,
      panelX + panelW - padX,
      panelY + 56,
      {
        seed: 7720,
        jitter: 0.4,
        samples: 18,
        stroke: 'rgba(232,226,212,0.18)',
        strokeWidth: 0.6,
        dash: [2, 3],
        charcoal: false,
      },
    );

    drawActionLine(ctx, panelX + padX, panelY + 66, panelW - padX * 2, actionLine, actionColor);
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
      const seed = 9700 + Math.round(cx) * 31 + idx * 7;
      if (isFilled) {
        // Blood-red disc with bone outline + glow.
        ctx.shadowColor = 'rgba(178, 30, 30, 0.9)';
        ctx.shadowBlur = 4;
        handCircle(ctx, x, y, SLOT_RADIUS, {
          seed,
          jitter: 0.4,
          samples: 12,
          stroke: CHARCOAL.ink2,
          strokeWidth: 1,
          fill: CHARCOAL.accent,
          opacity: 1,
        });
        ctx.shadowBlur = 0;
      } else {
        // Hollow bone ring with a faint pinpoint dot.
        handCircle(ctx, x, y, SLOT_RADIUS, {
          seed,
          jitter: 0.5,
          samples: 12,
          stroke: 'rgba(232,226,212,0.7)',
          strokeWidth: 1.2,
          opacity: 0.9,
        });
        ctx.fillStyle = 'rgba(232,226,212,0.32)';
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
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
  if (p.kind === 'wild') {
    // Wild portals — muted bone/charcoal swirl with a faint blood core.
    // Reads as "old, lichen-covered, a permanent fixture of the wilds."
    const halo = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, r * 1.8);
    halo.addColorStop(0, 'rgba(80, 60, 70, 0.45)');
    halo.addColorStop(1, 'rgba(40, 30, 35, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(p.x - r * 2, p.y - r * 2, r * 4, r * 4);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.swirl * 0.6);
    // Disc fill — dark vellum with a faint blood core.
    ctx.fillStyle = p.hitFlash > 0 ? '#fff' : '#1a0a0a';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Hand-drawn charcoal ring + faint dried-blood inner arc.
    handCircle(ctx, p.x, p.y, r, {
      seed: 6100 + p.id * 31,
      jitter: 1.4,
      samples: 28,
      stroke: 'rgba(232,226,212,0.55)',
      strokeWidth: 1.2,
      passes: 2,
      opacity: 0.85,
    });
    handCircle(ctx, p.x, p.y, r * 0.62, {
      seed: 6101 + p.id * 31,
      jitter: 1,
      samples: 22,
      stroke: 'rgba(178,30,30,0.55)',
      strokeWidth: 1,
      passes: 1,
      opacity: 0.7,
    });
    // Tiny lichen specks scattered around the rim.
    inkSplatter(ctx, p.x, p.y, {
      seed: 6110 + p.id * 7,
      count: 10,
      spread: r * 1.1,
      color: 'rgba(232,226,212,0.45)',
      opacity: 0.45,
      sizeMin: 0.4,
      sizeMax: 1.4,
    });
  } else {
    // Siege portals — dramatic dried-blood swirl with bright ember sparks.
    // Reads as "the dark is delivering tonight."
    const halo = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, r * 2.4);
    halo.addColorStop(0, 'rgba(178, 30, 30, 0.55)');
    halo.addColorStop(0.6, 'rgba(122, 15, 15, 0.18)');
    halo.addColorStop(1, 'rgba(122, 15, 15, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(p.x - r * 2.4, p.y - r * 2.4, r * 4.8, r * 4.8);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.swirl);
    ctx.fillStyle = p.hitFlash > 0 ? '#fff' : '#2a060a';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Hand-drawn swirl arms.
    ctx.strokeStyle = 'rgba(214, 138, 58, 0.85)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      const a0 = (i / 3) * Math.PI * 2;
      ctx.arc(0, 0, r * 0.55, a0, a0 + Math.PI * 0.65);
      ctx.stroke();
    }
    // Bright central spark.
    ctx.fillStyle = '#ffd28a';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    handCircle(ctx, p.x, p.y, r, {
      seed: 6200 + p.id * 31,
      jitter: 1.4,
      samples: 28,
      stroke: '#b21e1e',
      strokeWidth: 1.4,
      passes: 2,
      opacity: 0.95,
    });
    inkSplatter(ctx, p.x, p.y, {
      seed: 6210 + p.id * 11,
      count: 14,
      spread: r * 1.5,
      color: '#7a0f0f',
      opacity: 0.5,
      sizeMin: 0.6,
      sizeMax: 2.4,
    });
  }

  // HP bar when damaged
  if (p.hp < p.maxHp) {
    const bw = 32;
    const bh = 4;
    const bx = p.x - bw / 2;
    const by = p.y - r - 12;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = p.kind === 'wild' ? '#e8e2d4' : '#d68a3a';
    ctx.fillRect(bx, by, bw * (p.hp / p.maxHp), bh);
  }
}

/** Pulsing red glyph on the ground at a map edge — telegraphs where a
 *  siege portal will open at night-start. Pulses at ~1.4 Hz. */
export function drawWarlights(ctx: CanvasRenderingContext2D, warlights: Array<{ x: number; y: number; age: number; id: number }>) {
  for (const w of warlights) {
    const pulse = 0.5 + 0.5 * Math.sin(w.age * 9);
    ctx.save();
    // Soft red ground halo.
    const halo = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, 28);
    halo.addColorStop(0, `rgba(178, 30, 30, ${0.35 + pulse * 0.25})`);
    halo.addColorStop(1, 'rgba(178, 30, 30, 0)');
    ctx.fillStyle = halo;
    ctx.fillRect(w.x - 28, w.y - 28, 56, 56);
    // Hand-drawn dashed red ring at the warlight position.
    handCircle(ctx, w.x, w.y, 14, {
      seed: 6300 + w.id * 11,
      jitter: 1.0,
      samples: 22,
      stroke: '#b21e1e',
      strokeWidth: 1.3,
      opacity: 0.55 + pulse * 0.4,
    });
    // Red splatter at the centre — ember of what's about to open.
    inkSplatter(ctx, w.x, w.y, {
      seed: 6310 + w.id * 7,
      count: 8,
      spread: 8,
      color: '#7a0f0f',
      opacity: 0.65,
      sizeMin: 0.6,
      sizeMax: 2.0,
    });
    ctx.restore();
  }
}

export function drawPOIs(ctx: CanvasRenderingContext2D, pois: POI[]) {
  for (const p of pois) {
    if (p.claimed) continue;
    if (!p.discovered) continue;
    drawPOI(ctx, p);
  }
}

/** Renders a sickly yellow + dried-blood halo over every undiscovered
 *  night POI. Drawn in screen space AFTER the lighting overlay so the
 *  beacon punches through the night darkness — these POIs are
 *  meant to be visible from far away as bargains the dark is
 *  offering you. Symmetric counterpart to `drawRelicHints` for the
 *  day-side discovery system. */
export function drawNightPoiBeacons(
  ctx: CanvasRenderingContext2D,
  pois: POI[],
  cameraX: number,
  cameraY: number,
  viewW: number,
  viewH: number,
) {
  ctx.save();
  for (const p of pois) {
    if (p.claimed) continue;
    const inst = poiInstance(p.instanceId);
    if (!inst || inst.category !== 'night') continue;
    const sx = p.x - cameraX;
    const sy = p.y - cameraY;
    if (sx < -80 || sx > viewW + 80 || sy < -80 || sy > viewH + 80) continue;
    const pulse = 0.7 + Math.sin(performance.now() / 380) * 0.3;
    // Outer sickly-yellow + dried-blood halo.
    const grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, 46);
    grad.addColorStop(0, `rgba(214, 194, 80, ${0.55 * pulse})`);
    grad.addColorStop(0.55, `rgba(178, 30, 30, ${0.32 * pulse})`);
    grad.addColorStop(1, 'rgba(178, 30, 30, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, 46, 0, Math.PI * 2);
    ctx.fill();
    // Tighter inner ring — the sigil under the bargain. Dashed,
    // sickly yellow so it reads as ritual not safety.
    ctx.strokeStyle = `rgba(232, 210, 90, ${0.7 * pulse})`;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.arc(sx, sy, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawPOI(ctx: CanvasRenderingContext2D, p: POI) {
  if (p.sprite === 'camp') {
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
  } else if (p.sprite === 'chest') {
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(p.x - 10, p.y - 7, 20, 14);
    ctx.strokeStyle = '#2a1a0a';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x - 10, p.y - 7, 20, 14);
    ctx.fillStyle = '#caa861';
    ctx.fillRect(p.x - 11, p.y - 9, 22, 4);
    ctx.strokeRect(p.x - 11, p.y - 9, 22, 4);
    ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  } else if (p.sprite === 'cache') {
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
  } else if (p.sprite === 'shrine') {
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
  } else if (p.sprite === 'graveyard') {
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
  } else if (p.sprite === 'ruin') {
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
  const inst = poiInstance(p.instanceId);
  const label = inst?.label ?? '';
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
  ctx.globalAlpha *= alpha;

  // Heavy black wash + dried-blood vignette.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h * 0.4, 40, w / 2, h * 0.4, Math.max(w, h) * 0.7);
  vg.addColorStop(0, 'rgba(122, 15, 15, 0.18)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Dripping red drips down from the top edge.
  const drips = [80, 220, 360, 500, 640, 780];
  for (let i = 0; i < drips.length; i++) {
    const px = drips[i] * (w / 880);
    handLine(ctx, px, 100, px + (i % 2 === 0 ? 3 : -3), 118 + i * 4, {
      seed: 8420 + i,
      jitter: 0.6,
      samples: 8,
      stroke: CHARCOAL.accent,
      strokeWidth: 1.5,
      opacity: 0.7,
    });
  }
  inkSplatter(ctx, w / 2, 118, {
    seed: 8430,
    count: 24,
    spread: w * 0.4,
    color: CHARCOAL.accent2,
    opacity: 0.5,
    sizeMin: 0.6,
    sizeMax: 3,
  });

  // "— NIGHT NN —" preamble.
  handText(ctx, `\u2014 NIGHT ${String(night).padStart(2, '0')} \u2014`, w / 2, 154, {
    seed: 8440,
    jitter: 0.4,
    fontSize: 13,
    font: CHARCOAL_FONTS.mono,
    fill: CHARCOAL.bloodInk,
    weight: 700,
    letterSpacing: 6,
    align: 'center',
  });
  // Decorative rule under preamble.
  handLine(ctx, w / 2 - 90, 164, w / 2 + 90, 164, {
    seed: 8441,
    jitter: 1.2,
    samples: 18,
    stroke: CHARCOAL.accent,
    strokeWidth: 0.8,
  });

  // Big "NIGHT" headline.
  handText(ctx, 'NIGHT', w / 2, 232, {
    seed: 8450,
    jitter: 1.4,
    fontSize: 88,
    font: CHARCOAL_FONTS.serif,
    fill: CHARCOAL.ink,
    weight: 700,
    italic: true,
    letterSpacing: 8,
    align: 'center',
  });
  handLine(ctx, w / 2 - 220, 254, w / 2 + 220, 254, {
    seed: 8451,
    jitter: 2.5,
    samples: 36,
    stroke: CHARCOAL.accent,
    strokeWidth: 1.6,
  });
  handLine(ctx, w / 2 - 200, 260, w / 2 + 200, 260, {
    seed: 8452,
    jitter: 2,
    samples: 30,
    stroke: CHARCOAL.accent2,
    strokeWidth: 1,
    opacity: 0.7,
  });

  handText(ctx, 'They arrive from the dark.', w / 2, 298, {
    seed: 8460,
    jitter: 0.5,
    fontSize: 18,
    font: CHARCOAL_FONTS.serif,
    fill: CHARCOAL.ink,
    italic: true,
    align: 'center',
    opacity: 0.85,
  });

  ctx.restore();
}

// ── Note card typewriter timings (tunable) ───────────────────────────
// Each char's reveal animation overlaps with its neighbors — cadence
// (when the next char's reveal STARTS) is shorter than the per-char
// duration (how long each char animates), producing a flowing wave.
const NOTE_TITLE_CHAR_CADENCE = 22 / 1000;
const NOTE_BODY_CHAR_CADENCE = 28 / 1000;
const NOTE_CTA_CHAR_CADENCE = 22 / 1000;
const NOTE_CHAR_REVEAL_DURATION = 200 / 1000;
/** Pause between sections (title→body, body→cta) — gives the eye a
 *  beat between blocks of text instead of one continuous typewriter. */
const NOTE_SECTION_PAUSE = 120 / 1000;
/** Total animation duration for the card. After this, every char is
 *  fully landed (shaking words still shake forever). Used by the
 *  Game's two-press dismissal: first Space jumps to this duration,
 *  second Space dismisses. */
export function noteCardRevealDuration(note: NoteCard): number {
  const titleLen = note.title.length;
  const bodyLen = note.body.length;
  const ctaLen = note.cta ? note.cta.length : 0;
  let t = titleLen * NOTE_TITLE_CHAR_CADENCE + NOTE_CHAR_REVEAL_DURATION;
  t += NOTE_SECTION_PAUSE;
  t += bodyLen * NOTE_BODY_CHAR_CADENCE + NOTE_CHAR_REVEAL_DURATION;
  if (note.cta) {
    t += NOTE_SECTION_PAUSE;
    t += ctaLen * NOTE_CTA_CHAR_CADENCE + NOTE_CHAR_REVEAL_DURATION;
  }
  return t;
}

/**
 * Render the parchment card with a typewriter-style reveal: each char
 * starts large + above its target + transparent, then settles into
 * place with a 200ms scale+drop+fade curve. Important words (matched
 * against `note.shake`) keep a tiny sinusoidal jitter forever after.
 *
 * `revealTime` is seconds since this card was promoted to active.
 * Owner (Game) bumps it past `noteCardRevealDuration(note)` on the
 * player's first dismissal-key press to instantly complete the reveal.
 */
export function drawNoteCard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  note: NoteCard,
  revealTime: number,
) {
  const { title, body } = note;
  const accent = note.accent ?? 'blood';
  const cta = note.cta;
  const accentStroke = accent === 'ember' ? CHARCOAL.ember : CHARCOAL.accent;
  const accentInk = accent === 'ember' ? CHARCOAL.ember : CHARCOAL.bloodInk;

  // Lowercased shake-word set, with punctuation stripped on lookup so
  // "stay." and "stay," and "Stay" all match a `shake: ['stay']` entry.
  const shakeSet = new Set((note.shake ?? []).map((s) => s.toLowerCase()));
  const isImportantWord = (word: string) => {
    if (shakeSet.size === 0) return false;
    const stripped = word.toLowerCase().replace(/[^a-z0-9]/g, '');
    return shakeSet.has(stripped);
  };

  ctx.save();
  // Heavy black wash dims the world beneath.
  ctx.fillStyle = 'rgba(2, 0, 2, 0.78)';
  ctx.fillRect(0, 0, w, h);

  const cardW = Math.min(560, w - 80);
  const ctaBlockH = cta ? 56 : 0;
  const cardH = 280 + ctaBlockH;
  const cardX = (w - cardW) / 2;
  const cardY = (h - cardH) / 2;

  // Charcoal vellum.
  ctx.fillStyle = CHARCOAL.bg;
  ctx.fillRect(cardX, cardY, cardW, cardH);

  // Outer charcoal frame.
  handRect(ctx, cardX, cardY, cardW, cardH, {
    seed: 9101,
    jitter: 1.6,
    samplesPerSide: 22,
    stroke: CHARCOAL.ink,
    strokeWidth: 1.4,
    opacity: 0.85,
    passes: 2,
  });

  // Faint hatch wash.
  crossHatch(ctx, cardX + 6, cardY + 6, cardW - 12, cardH - 12, {
    seed: 9102,
    spacing: 18,
    angle: 22,
    jitter: 0.8,
    stroke: CHARCOAL.ink,
    strokeWidth: 0.3,
    opacity: 0.05,
    double: true,
  });

  // Corner ritual marks.
  const cornerOffsets: Array<[number, number, number, number]> = [
    [cardX, cardY, 16, 16],
    [cardX + cardW, cardY, -16, 16],
    [cardX, cardY + cardH, 16, -16],
    [cardX + cardW, cardY + cardH, -16, -16],
  ];
  for (let i = 0; i < cornerOffsets.length; i++) {
    const [cx, cy, dx, dy] = cornerOffsets[i];
    handLine(ctx, cx, cy, cx + dx, cy, {
      seed: 9110 + i * 2,
      jitter: 0.4,
      samples: 4,
      stroke: accentStroke,
      strokeWidth: 1,
      opacity: 0.6,
    });
    handLine(ctx, cx, cy, cx, cy + dy, {
      seed: 9111 + i * 2,
      jitter: 0.4,
      samples: 4,
      stroke: accentStroke,
      strokeWidth: 1,
      opacity: 0.6,
    });
  }

  // ── Title — animated mono small caps in accent ink ──────────────
  const titleStr = title.toUpperCase();
  const titleFontSize = 12;
  const titleFontStr = `700 ${titleFontSize}px ${CHARCOAL_FONTS.mono}`;
  const titleLetterSpacing = 4;
  const titleY = cardY + 36;
  drawAnimatedTextLineCentered(ctx, {
    text: titleStr,
    centerX: cardX + cardW / 2,
    y: titleY,
    fontSize: titleFontSize,
    fontStr: titleFontStr,
    letterSpacing: titleLetterSpacing,
    color: accentInk,
    revealStart: 0,
    cadence: NOTE_TITLE_CHAR_CADENCE,
    revealTime,
    isImportantWord,
  });
  // Title divider — fades in once the title has finished.
  const titleEndT = titleStr.length * NOTE_TITLE_CHAR_CADENCE + NOTE_CHAR_REVEAL_DURATION;
  const titleDivAlpha = clamp01((revealTime - titleEndT) / 0.18);
  if (titleDivAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= titleDivAlpha;
    handLine(ctx, cardX + 32, cardY + 50, cardX + cardW - 32, cardY + 50, {
      seed: 9121,
      jitter: 1.0,
      samples: 24,
      stroke: accentStroke,
      strokeWidth: 0.7,
      opacity: 0.7,
    });
    ctx.restore();
  }

  // ── Body — animated bone-cream italic serif ─────────────────────
  const bodyStartT = titleEndT + NOTE_SECTION_PAUSE;
  const bodyFontSize = 17;
  const bodyFontStr = `italic 500 ${bodyFontSize}px ${CHARCOAL_FONTS.serif}`;
  const bodyPadX = 30;
  const bodyX = cardX + bodyPadX;
  const bodyW = cardW - bodyPadX * 2;
  const bodyY = cardY + 76;
  drawAnimatedTextWrapped(ctx, {
    text: body,
    x: bodyX,
    y: bodyY,
    maxW: bodyW,
    lineH: 24,
    fontSize: bodyFontSize,
    fontStr: bodyFontStr,
    color: CHARCOAL.ink,
    revealStart: bodyStartT,
    cadence: NOTE_BODY_CHAR_CADENCE,
    revealTime,
    isImportantWord,
  });

  // ── CTA — animated mono small caps ──────────────────────────────
  if (cta) {
    const bodyEndT = bodyStartT + body.length * NOTE_BODY_CHAR_CADENCE + NOTE_CHAR_REVEAL_DURATION;
    const ctaStartT = bodyEndT + NOTE_SECTION_PAUSE;
    const ctaY = cardY + cardH - 56;
    // CTA divider fades in just before the CTA chars start landing.
    const ctaDivAlpha = clamp01((revealTime - ctaStartT + 0.05) / 0.18);
    if (ctaDivAlpha > 0) {
      ctx.save();
      ctx.globalAlpha *= ctaDivAlpha;
      handLine(ctx, cardX + 60, ctaY - 10, cardX + cardW - 60, ctaY - 10, {
        seed: 9125,
        jitter: 0.8,
        samples: 22,
        stroke: accentStroke,
        strokeWidth: 0.6,
        opacity: 0.55,
      });
      ctx.restore();
    }
    const ctaStr = cta.toUpperCase();
    drawAnimatedTextLineCentered(ctx, {
      text: ctaStr,
      centerX: cardX + cardW / 2,
      y: ctaY + 4,
      fontSize: 11,
      fontStr: `700 11px ${CHARCOAL_FONTS.mono}`,
      letterSpacing: 3,
      color: accentInk,
      revealStart: ctaStartT,
      cadence: NOTE_CTA_CHAR_CADENCE,
      revealTime,
      isImportantWord,
    });
  }

  // Footer hint — static, but only fades in once the typewriter
  // is fully done so it doesn't compete for attention mid-reveal.
  const totalDur = noteCardRevealDuration(note);
  const footerAlpha = clamp01((revealTime - totalDur + 0.1) / 0.25);
  if (footerAlpha > 0) {
    ctx.save();
    ctx.globalAlpha *= footerAlpha;
    if (note.prompt) {
      // Two-prompt footer: confirm on the left in accent ink, decline
      // on the right in dim ink. Same y-line as the standard hint.
      const footerY = cardY + cardH - 22;
      const confirmStr =
        `[SPACE] ${note.prompt.confirmLabel.toUpperCase()}`;
      const cancelStr =
        `[ESC] ${note.prompt.cancelLabel.toUpperCase()}`;
      handText(ctx, confirmStr, cardX + cardW / 2 - 14, footerY, {
        seed: 9130,
        jitter: 0.2,
        fontSize: 10,
        font: CHARCOAL_FONTS.mono,
        fill: accentInk,
        weight: 700,
        letterSpacing: 2.4,
        align: 'right',
      });
      handText(ctx, cancelStr, cardX + cardW / 2 + 14, footerY, {
        seed: 9131,
        jitter: 0.2,
        fontSize: 10,
        font: CHARCOAL_FONTS.mono,
        fill: CHARCOAL.inkDim,
        weight: 600,
        letterSpacing: 2.4,
        align: 'left',
      });
      // Thin separator pip between the two options.
      handText(ctx, '·', cardX + cardW / 2, footerY, {
        seed: 9132,
        jitter: 0,
        fontSize: 12,
        font: CHARCOAL_FONTS.mono,
        fill: CHARCOAL.inkDim,
        weight: 600,
        letterSpacing: 0,
        align: 'center',
      });
    } else {
      handText(ctx, 'PRESS SPACE TO CONTINUE', cardX + cardW / 2, cardY + cardH - 22, {
        seed: 9130,
        jitter: 0.2,
        fontSize: 10,
        font: CHARCOAL_FONTS.mono,
        fill: CHARCOAL.inkDim,
        weight: 600,
        letterSpacing: 3,
        align: 'center',
      });
    }
    ctx.restore();
  }

  ctx.restore();
}

// ── Animated text helpers ────────────────────────────────────────────

interface AnimatedLineOpts {
  text: string;
  centerX: number;
  y: number;
  fontSize: number;
  fontStr: string;
  letterSpacing: number;
  color: string;
  revealStart: number;
  cadence: number;
  revealTime: number;
  isImportantWord: (word: string) => boolean;
}

/** Single-line, centered. Used for the title + the CTA. */
function drawAnimatedTextLineCentered(
  ctx: CanvasRenderingContext2D,
  o: AnimatedLineOpts,
) {
  ctx.save();
  ctx.font = o.fontStr;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // Measure each char's advance + letter spacing to get per-char x positions.
  const advances: number[] = [];
  let totalW = 0;
  for (let i = 0; i < o.text.length; i++) {
    const w = ctx.measureText(o.text[i]).width;
    advances.push(w);
    totalW += w + (i < o.text.length - 1 ? o.letterSpacing : 0);
  }
  // Per-char "is this char part of an important word?" flag, computed
  // once via a single tokenizer pass over the text.
  const charImportant = new Array<boolean>(o.text.length).fill(false);
  let ws = 0;
  for (let i = 0; i <= o.text.length; i++) {
    if (i === o.text.length || /\s/.test(o.text[i])) {
      const word = o.text.slice(ws, i);
      const imp = word.length > 0 && o.isImportantWord(word);
      if (imp) for (let j = ws; j < i; j++) charImportant[j] = true;
      ws = i + 1;
    }
  }

  let xCursor = o.centerX - totalW / 2;
  for (let i = 0; i < o.text.length; i++) {
    const ch = o.text[i];
    const advance = advances[i];
    const charRevealStart = o.revealStart + i * o.cadence;
    drawAnimatedChar(
      ctx,
      ch,
      xCursor,
      o.y,
      i,
      charRevealStart,
      o.revealTime,
      charImportant[i],
      o.color,
    );
    xCursor += advance + o.letterSpacing;
  }
  ctx.restore();
}

interface AnimatedWrappedOpts {
  text: string;
  x: number;
  y: number;
  maxW: number;
  lineH: number;
  fontSize: number;
  fontStr: string;
  color: string;
  revealStart: number;
  cadence: number;
  revealTime: number;
  isImportantWord: (word: string) => boolean;
}

/** Multi-line wrapped body. Lays out word-by-word, then animates char-
 *  by-char. Each char gets a global index so the reveal cadence flows
 *  smoothly across line breaks. */
function drawAnimatedTextWrapped(
  ctx: CanvasRenderingContext2D,
  o: AnimatedWrappedOpts,
) {
  ctx.save();
  ctx.font = o.fontStr;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Build a list of laid-out chars: { ch, x, y, globalIdx, important }.
  const words = o.text.split(/(\s+)/); // keep whitespace tokens
  type LaidChar = {
    ch: string;
    x: number;
    y: number;
    globalIdx: number;
    important: boolean;
  };
  const laidChars: LaidChar[] = [];
  let lineX = o.x;
  let lineY = o.y;
  let globalIdx = 0;
  for (const word of words) {
    if (/^\s+$/.test(word)) {
      // Whitespace: account for it in layout but no glyphs to draw.
      const wsW = ctx.measureText(word).width;
      lineX += wsW;
      globalIdx += word.length;
      continue;
    }
    const wordW = ctx.measureText(word).width;
    if (lineX + wordW > o.x + o.maxW && lineX > o.x) {
      lineX = o.x;
      lineY += o.lineH;
    }
    const important = o.isImportantWord(word);
    for (const ch of word) {
      const chW = ctx.measureText(ch).width;
      laidChars.push({
        ch,
        x: lineX,
        y: lineY,
        globalIdx,
        important,
      });
      lineX += chW;
      globalIdx += 1;
    }
  }

  for (const lc of laidChars) {
    const charRevealStart = o.revealStart + lc.globalIdx * o.cadence;
    drawAnimatedChar(
      ctx,
      lc.ch,
      lc.x,
      lc.y,
      lc.globalIdx,
      charRevealStart,
      o.revealTime,
      lc.important,
      o.color,
    );
  }
  ctx.restore();
}

/**
 * Animate a single character: scale 2.0 → 1.0, alpha 0 → 1, y-offset
 * −10 → 0 over `NOTE_CHAR_REVEAL_DURATION` seconds. After landing,
 * `isImportant` chars get a tiny sinusoidal jitter forever; others
 * are static.
 *
 * The font on the context must already be set by the caller (we don't
 * re-set it on every char to avoid the cost). Color is set per call.
 *
 * Caller is expected to be inside an outer `ctx.save()/restore()`.
 */
function drawAnimatedChar(
  ctx: CanvasRenderingContext2D,
  ch: string,
  baseX: number,
  baseY: number,
  charIdx: number,
  revealStart: number,
  revealTime: number,
  isImportant: boolean,
  color: string,
) {
  const localT = revealTime - revealStart;
  if (localT <= 0) return;

  let scale = 1;
  let alpha = 1;
  let dx = 0;
  let dy = 0;

  if (localT < NOTE_CHAR_REVEAL_DURATION) {
    const u = localT / NOTE_CHAR_REVEAL_DURATION;
    // Ease-out (1 - (1-u)^2) — letter "lands" decisively at the end.
    const eased = 1 - (1 - u) * (1 - u);
    scale = 2.0 - 1.0 * eased;
    alpha = Math.min(1, eased * 1.5);
    dy = -10 * (1 - eased);
  } else if (isImportant) {
    // Post-landing shake. Two sin curves at slightly mismatched
    // frequencies so neighbouring chars don't synchronise.
    const phase = revealTime * 14 + charIdx * 1.3;
    dx = Math.sin(phase) * 0.7;
    dy = Math.cos(phase * 0.78 + 0.4) * 0.55;
  }

  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  // Translate to baseline, scale around that point, draw at origin.
  ctx.translate(baseX + dx, baseY + dy);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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
  ctx.globalAlpha *= alpha;

  // Warm ember vignette — sunrise behind a black sky.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, w, h);
  const vg = ctx.createRadialGradient(w / 2, h * 0.9, 40, w / 2, h * 0.4, Math.max(w, h) * 0.7);
  vg.addColorStop(0, 'rgba(214, 138, 58, 0.32)');
  vg.addColorStop(0.45, 'rgba(199, 154, 58, 0.16)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // "— YOU HELD NIGHT NN —" preamble in ember.
  handText(ctx, `\u2014 YOU HELD NIGHT ${String(night).padStart(2, '0')} \u2014`, w / 2, 154, {
    seed: 8540,
    jitter: 0.4,
    fontSize: 12,
    font: CHARCOAL_FONTS.mono,
    fill: CHARCOAL.ember,
    weight: 700,
    letterSpacing: 6,
    align: 'center',
  });
  handLine(ctx, w / 2 - 110, 164, w / 2 + 110, 164, {
    seed: 8541,
    jitter: 1.2,
    samples: 20,
    stroke: CHARCOAL.ember,
    strokeWidth: 0.8,
  });

  // Big "DAWN" headline.
  handText(ctx, 'DAWN', w / 2, 232, {
    seed: 8550,
    jitter: 1.4,
    fontSize: 88,
    font: CHARCOAL_FONTS.serif,
    fill: CHARCOAL.ink,
    weight: 700,
    italic: true,
    letterSpacing: 10,
    align: 'center',
  });
  handLine(ctx, w / 2 - 200, 254, w / 2 + 200, 254, {
    seed: 8551,
    jitter: 2.4,
    samples: 32,
    stroke: CHARCOAL.ember,
    strokeWidth: 1.6,
  });
  handLine(ctx, w / 2 - 180, 260, w / 2 + 180, 260, {
    seed: 8552,
    jitter: 1.8,
    samples: 28,
    stroke: '#8a5a18',
    strokeWidth: 1,
    opacity: 0.7,
  });

  handText(ctx, 'The sun clears the ridge.', w / 2, 298, {
    seed: 8560,
    jitter: 0.5,
    fontSize: 18,
    font: CHARCOAL_FONTS.serif,
    fill: CHARCOAL.ink,
    italic: true,
    align: 'center',
    opacity: 0.85,
  });

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

export interface MenuScreenRects {
  startBtn: { x: number; y: number; w: number; h: number };
  leaderboardBtn: { x: number; y: number; w: number; h: number };
  codexBtn: { x: number; y: number; w: number; h: number };
  achievementsBtn: { x: number; y: number; w: number; h: number };
}

export interface MenuScreenStats {
  /** Codex "unlocked / total" — shown next to the Codex button. */
  codexUnlocked: number;
  codexTotal: number;
  /** Achievements "unlocked / total" — shown next to the Achievements button. */
  achievementsUnlocked: number;
  achievementsTotal: number;
}

export function drawMenuScreen(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  seedLabel?: string,
  stats?: MenuScreenStats,
  mouseX = -1,
  mouseY = -1,
): MenuScreenRects {
  ctx.save();

  // Charcoal night backdrop with a dried-blood vignette behind the title.
  ctx.fillStyle = CHARCOAL.bg;
  ctx.fillRect(0, 0, w, h);
  const back = ctx.createRadialGradient(w / 2, h * 0.55, 30, w / 2, h * 0.55, Math.max(w, h) * 0.8);
  back.addColorStop(0, 'rgba(122, 15, 15, 0.18)');
  back.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, w, h);

  // Campfire halo — single warm ember disc above the horizon.
  const glow = ctx.createRadialGradient(w / 2, h * 0.62, 0, w / 2, h * 0.62, 220);
  glow.addColorStop(0, 'rgba(214, 138, 58, 0.16)');
  glow.addColorStop(0.4, 'rgba(214, 138, 58, 0.05)');
  glow.addColorStop(1, 'rgba(214, 138, 58, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // Faint hatch wash across the whole screen for the field-journal feel.
  crossHatch(ctx, 0, 0, w, h, {
    seed: 9801,
    spacing: 28,
    angle: 22,
    jitter: 1.4,
    stroke: CHARCOAL.ink,
    strokeWidth: 0.3,
    opacity: 0.04,
    double: true,
  });

  // Scattered red ink specks across the top — like the night banner.
  inkSplatter(ctx, w / 2, 30, {
    seed: 9810,
    count: 16,
    spread: w * 0.45,
    color: CHARCOAL.accent2,
    opacity: 0.25,
    sizeMin: 0.6,
    sizeMax: 2.4,
  });

  // Two-layer silhouette horizon, far mountains + near hills, matching the
  // handoff SVG paths (scaled from 960 to current width).
  const hBase = h;
  const farPeaks: [number, number][] = [
    [0, hBase - 90], [0.0625, hBase - 110], [0.125, hBase - 80],
    [0.2083, hBase - 130], [0.2917, hBase - 95], [0.375, hBase - 135],
    [0.4583, hBase - 100], [0.5417, hBase - 125], [0.625, hBase - 90],
    [0.7083, hBase - 120], [0.7917, hBase - 80], [0.875, hBase - 115],
    [0.9583, hBase - 85], [1, hBase - 105],
  ];
  ctx.fillStyle = 'rgba(6, 7, 14, 0.95)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (const [fx, fy] of farPeaks) ctx.lineTo(fx * w, fy);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();
  const nearPeaks: [number, number][] = [
    [0, hBase - 50], [0.0833, hBase - 65], [0.1667, hBase - 42],
    [0.25, hBase - 70], [0.3542, hBase - 50], [0.4375, hBase - 75],
    [0.5417, hBase - 52], [0.6458, hBase - 72], [0.75, hBase - 48],
    [0.854, hBase - 68], [0.9375, hBase - 48], [1, hBase - 62],
  ];
  ctx.fillStyle = 'rgba(6, 7, 14, 0.98)';
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (const [fx, fy] of nearPeaks) ctx.lineTo(fx * w, fy);
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fill();

  // Tiny fire ember dot at centre of the halo.
  ctx.save();
  ctx.fillStyle = '#ff9a55';
  ctx.shadowColor = 'rgba(255, 154, 85, 0.7)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(w / 2, h * 0.62, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';

  // Eyebrow above the title — dried-blood mono, wide tracking.
  handText(ctx, '\u2014 HOLD THE FIRE UNTIL DAWN \u2014', w / 2, 90, {
    seed: 9820,
    jitter: 0.3,
    fontSize: 12,
    font: CHARCOAL_FONTS.mono,
    fill: CHARCOAL.bloodInk,
    weight: 700,
    letterSpacing: 5,
    align: 'center',
  });
  // Decorative rule under eyebrow.
  handLine(ctx, w / 2 - 110, 102, w / 2 + 110, 102, {
    seed: 9821,
    jitter: 1,
    samples: 18,
    stroke: CHARCOAL.accent,
    strokeWidth: 0.7,
    opacity: 0.7,
  });

  // Title — hand-drawn italic serif in bone, just like the night banner.
  handText(ctx, 'WHAT THE DARK KNOWS', w / 2, 174, {
    seed: 9830,
    jitter: 1.2,
    fontSize: 56,
    font: CHARCOAL_FONTS.serif,
    fill: CHARCOAL.ink,
    weight: 700,
    italic: true,
    letterSpacing: 4,
    align: 'center',
  });
  handLine(ctx, w / 2 - 200, 192, w / 2 + 200, 192, {
    seed: 9831,
    jitter: 2.4,
    samples: 32,
    stroke: CHARCOAL.accent,
    strokeWidth: 1.4,
    opacity: 0.85,
  });

  // "Press [Space] to begin" — small-caps with an inline keycap. Centred
  // as a group.
  const promptY = 224;
  const promptFont = `600 13px ${UI_FONTS.ui}`;
  ctx.font = promptFont;
  ctx.fillStyle = 'rgba(234,223,196,0.75)';
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prevLS = c.letterSpacing;
  c.letterSpacing = '0.32em';
  const prefix = 'PRESS';
  const suffix = 'TO BEGIN';
  const prefixW = ctx.measureText(prefix).width;
  const suffixW = ctx.measureText(suffix).width;
  // Measure the keycap width using a dummy draw:
  ctx.font = `500 11px ${UI_FONTS.mono}`;
  const kbdLabel = 'Space';
  const kbdTextW = ctx.measureText(kbdLabel).width;
  const kbdW = Math.max(18, Math.ceil(kbdTextW) + 12);
  const gap = 9;
  const groupW = prefixW + gap + kbdW + gap + suffixW;
  let gx = (w - groupW) / 2;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = promptFont;
  c.letterSpacing = '0.32em';
  ctx.fillText(prefix, gx, promptY);
  gx += prefixW + gap;
  c.letterSpacing = '0px';
  gx = drawKbdDark(ctx, gx, promptY, kbdLabel);
  gx += gap;
  ctx.font = promptFont;
  c.letterSpacing = '0.32em';
  ctx.fillText(suffix, gx, promptY);
  c.letterSpacing = prevLS ?? '0px';

  // Sub-buttons row: Leaderboard / Codex / Achievements.
  // Each button auto-sizes to its label so italic-serif glyphs + handText
  // jitter (which both extend past `measureText`'s advance width) never
  // bleed out of the frame.
  const subBtnY = 288;
  const subBtnH = 60;
  const subBtnGap = 12;
  const subBtnPadX = 22;
  const subBtnMinW = 132;
  const subBtns: Array<{ label: string; sub?: string }> = [
    { label: 'Leaderboard' },
    {
      label: 'Codex',
      sub: stats ? `${stats.codexUnlocked} / ${stats.codexTotal}` : undefined,
    },
    {
      label: 'Achievements',
      sub: stats
        ? `${stats.achievementsUnlocked} / ${stats.achievementsTotal}`
        : undefined,
    },
  ];
  // Measure label widths under their actual rendering font, then add
  // generous slack for italic slope + handText jitter that measureText
  // doesn't see.
  ctx.save();
  ctx.font = `italic 700 18px ${CHARCOAL_FONTS.serif}`;
  const subBtnWidths = subBtns.map((b) => {
    const measured = ctx.measureText(b.label).width;
    return Math.max(subBtnMinW, Math.ceil(measured + subBtnPadX * 2 + 14));
  });
  ctx.restore();
  const totalSubW =
    subBtnWidths.reduce((a, b) => a + b, 0) + subBtnGap * (subBtns.length - 1);
  const subLeft = (w - totalSubW) / 2;
  const subRects: Array<{ x: number; y: number; w: number; h: number }> = [];
  let sxRunning = subLeft;
  for (let i = 0; i < subBtns.length; i++) {
    const subBtnW = subBtnWidths[i];
    const sx = sxRunning;
    sxRunning += subBtnW + subBtnGap;
    const sr = { x: sx, y: subBtnY, w: subBtnW, h: subBtnH };
    const hover =
      mouseX >= sr.x && mouseX <= sr.x + sr.w && mouseY >= sr.y && mouseY <= sr.y + sr.h;
    // Charcoal panel body.
    ctx.fillStyle = hover ? 'rgba(214,138,58,0.10)' : 'transparent';
    ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
    handRect(ctx, sr.x, sr.y, sr.w, sr.h, {
      seed: 9840 + i * 17,
      jitter: 1,
      samplesPerSide: 14,
      stroke: hover ? CHARCOAL.ember : CHARCOAL.ink,
      strokeWidth: hover ? 1.4 : 1,
      passes: hover ? 2 : 1,
      opacity: hover ? 1 : 0.75,
    });
    // Dried-blood spine drip on the left edge — same signature as panels.
    handLine(ctx, sr.x + 3, sr.y + 6, sr.x + 3, sr.y + sr.h - 6, {
      seed: 9850 + i,
      jitter: 0.7,
      samples: 12,
      stroke: CHARCOAL.accent,
      strokeWidth: 1.4,
      opacity: hover ? 0.85 : 0.55,
    });

    const item = subBtns[i];
    // Italic serif label \u2014 center-aligned so longer labels look intentional
    // rather than crammed against the spine drip.
    handText(ctx, item.label, sr.x + sr.w / 2, sr.y + 30, {
      seed: 9860 + i * 11,
      jitter: 0.4,
      fontSize: 18,
      font: CHARCOAL_FONTS.serif,
      fill: CHARCOAL.ink,
      weight: 700,
      italic: true,
      align: 'center',
    });
    // Mono sub-line \u2014 same center alignment.
    handText(ctx, item.sub ?? '\u2014', sr.x + sr.w / 2, sr.y + sr.h - 14, {
      seed: 9870 + i * 11,
      jitter: 0.2,
      fontSize: 10,
      font: CHARCOAL_FONTS.mono,
      fill: CHARCOAL.ember,
      weight: 600,
      letterSpacing: 1,
      align: 'center',
    });

    subRects.push(sr);
  }

  // Invisible "start" hit-box — the "Press Space to begin" row acts as the
  // click target. Keeps the hit-test interface consistent with the old
  // design where a visible Start button existed.
  const startBtn = {
    x: (w - 260) / 2,
    y: promptY - 16,
    w: 260,
    h: 32,
  };

  // Seed at the very bottom — small mono small-caps inscription.
  if (seedLabel) {
    handText(ctx, `SEED ${seedLabel}`, w / 2, h - 28, {
      seed: 9880,
      jitter: 0.2,
      fontSize: 9,
      font: CHARCOAL_FONTS.mono,
      fill: CHARCOAL.inkFaint,
      letterSpacing: 3,
      align: 'center',
    });
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();

  return {
    startBtn,
    leaderboardBtn: subRects[0],
    codexBtn: subRects[1],
    achievementsBtn: subRects[2],
  };
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

  // Heavy black backdrop with a faint colored vignette under the title.
  ctx.fillStyle = CHARCOAL.bg;
  ctx.fillRect(0, 0, w, h);
  const titleColor = victory ? CHARCOAL.ember : CHARCOAL.accent;
  const vg = ctx.createRadialGradient(w / 2, h * 0.5, 30, w / 2, h * 0.5, Math.max(w, h) * 0.7);
  vg.addColorStop(0, victory ? 'rgba(214, 138, 58, 0.18)' : 'rgba(122, 15, 15, 0.22)');
  vg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);

  // Heavy splatter for defeat — the ground is wet.
  if (!victory) {
    inkSplatter(ctx, w / 2, h * 0.55, {
      seed: 9201,
      count: 60,
      spread: w * 0.5,
      color: CHARCOAL.accent2,
      opacity: 0.25,
      sizeMin: 1,
      sizeMax: 6,
    });
  } else {
    inkSplatter(ctx, w / 2, h * 0.4, {
      seed: 9202,
      count: 30,
      spread: w * 0.35,
      color: CHARCOAL.ember,
      opacity: 0.18,
      sizeMin: 0.6,
      sizeMax: 3,
    });
  }

  // Hatch wash for the field-journal mood.
  crossHatch(ctx, 0, 0, w, h, {
    seed: 9210,
    spacing: 24,
    angle: 22,
    jitter: 1.4,
    stroke: CHARCOAL.ink,
    strokeWidth: 0.4,
    opacity: 0.05,
    double: true,
  });

  // Preamble.
  handText(ctx, '\u2014 RUN ENDED \u2014', w / 2, 84, {
    seed: 9220,
    jitter: 0.4,
    fontSize: 13,
    font: CHARCOAL_FONTS.mono,
    fill: titleColor,
    weight: 700,
    letterSpacing: 7,
    align: 'center',
  });

  // Big italic serif headline — DAWN for victory, ASHES for defeat.
  handText(ctx, victory ? 'DAWN' : 'ASHES', w / 2, 168, {
    seed: 9230,
    jitter: 1.6,
    fontSize: 86,
    font: CHARCOAL_FONTS.serif,
    fill: titleColor,
    weight: 700,
    italic: true,
    letterSpacing: 12,
    align: 'center',
  });
  handLine(ctx, w / 2 - 200, 188, w / 2 + 200, 188, {
    seed: 9231,
    jitter: 2.5,
    samples: 36,
    stroke: titleColor,
    strokeWidth: 1.6,
  });

  // Subtitle.
  handText(
    ctx,
    victory ? 'You held the line until first light.' : 'The fire went out before dawn.',
    w / 2,
    222,
    {
      seed: 9240,
      jitter: 0.5,
      fontSize: 18,
      font: CHARCOAL_FONTS.serif,
      fill: CHARCOAL.ink,
      italic: true,
      align: 'center',
      opacity: 0.85,
    },
  );

  // Stats list — left-aligned key, right-aligned value, dashed connector.
  const statRows: Array<[string, string]> = [
    ['NIGHTS SURVIVED', String(clock.night)],
    ['VILLAGERS SAVED', String(stats.rescued)],
    ['STATIONS BUILT', String(stats.stationsBuilt)],
    ['COINS SPENT', String(stats.coinsSpent)],
    ['ENEMIES SLAIN', String(stats.kills)],
  ];
  const statBlockW = 480;
  const statX = w / 2 - statBlockW / 2;
  const statTop = 274;
  const statRowH = 26;
  for (let i = 0; i < statRows.length; i++) {
    const [k, v] = statRows[i];
    const ry = statTop + i * statRowH;
    handText(ctx, k, statX, ry, {
      seed: 9300 + i * 2,
      jitter: 0.3,
      fontSize: 11,
      font: CHARCOAL_FONTS.mono,
      fill: CHARCOAL.ink,
      weight: 600,
      letterSpacing: 3,
      opacity: 0.7,
    });
    handLine(ctx, statX + 180, ry - 4, statX + statBlockW - 80, ry - 4, {
      seed: 9300 + i * 2 + 1,
      jitter: 1,
      samples: 20,
      stroke: CHARCOAL.ink,
      strokeWidth: 0.4,
      opacity: 0.4,
      dash: [2, 3],
      charcoal: false,
    });
    handText(ctx, v, statX + statBlockW, ry, {
      seed: 9320 + i,
      jitter: 0.4,
      fontSize: 16,
      font: CHARCOAL_FONTS.serif,
      fill: titleColor,
      weight: 600,
      align: 'right',
    });
  }

  // Seed line.
  if (seedLabel) {
    handText(ctx, `SEED ${seedLabel.toUpperCase()}`, w / 2, statTop + statRows.length * statRowH + 18, {
      seed: 9340,
      jitter: 0.2,
      fontSize: 9,
      font: CHARCOAL_FONTS.mono,
      fill: CHARCOAL.inkFaint,
      letterSpacing: 3,
      align: 'center',
    });
  }

  // Hand-drawn return button.
  const btnW = 280;
  const btnH = 40;
  const btnX = (w - btnW) / 2;
  const btnY = statTop + statRows.length * statRowH + 50;
  handRect(ctx, btnX, btnY, btnW, btnH, {
    seed: 9350,
    jitter: 1.3,
    samplesPerSide: 18,
    stroke: titleColor,
    strokeWidth: 1.4,
    passes: 2,
  });
  handText(ctx, 'PRESS SPACE TO RETURN', w / 2, btnY + btnH / 2 + 5, {
    seed: 9351,
    jitter: 0.3,
    fontSize: 12,
    font: CHARCOAL_FONTS.mono,
    fill: titleColor,
    weight: 700,
    letterSpacing: 4,
    align: 'center',
  });

  ctx.restore();
}

