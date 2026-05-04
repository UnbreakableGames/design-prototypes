// Charcoal-Ritual HUD. All chrome is drawn with the hand-drawn primitives
// from `systems/HandDrawn.ts` so the player feels like they're staring at
// an inked field journal — bone strokes, dried-blood accents, no crisp
// system-rendered rectangles anywhere.
//
// Layout matches the legacy HUD's footprint (top-left, ~210×140) so the
// rest of the game's positioning still lines up. Every shape is drawn
// from a stable seed, so strokes don't shimmer between frames.

import { Resources } from '../game/Game';
import { Clock } from '../game/Clock';
import { Campfire } from '../entities/Campfire';
import { Recruit } from '../entities/Recruit';
import { Hero, HERO_SWING_COOLDOWN } from '../entities/Hero';
import { QUESTS } from '../game/Quests';
import {
  CHARCOAL,
  CHARCOAL_FONTS,
  handLine,
  handRect,
  handCircle,
  crossHatch,
  handText,
} from '../systems/HandDrawn';

const UI_FONT = "'Inter Tight', system-ui, sans-serif";
const SERIF_FONT = CHARCOAL_FONTS.serif;
const MONO_FONT = CHARCOAL_FONTS.mono;

const COLORS = {
  bg: CHARCOAL.bg,
  paper: CHARCOAL.paper,
  ink: CHARCOAL.ink,
  inkDim: CHARCOAL.inkDim,
  inkFaint: CHARCOAL.inkFaint,
  accent: CHARCOAL.accent,
  accent2: CHARCOAL.accent2,
  // Brighter blood-red for *text* fills (eyebrows, quest label, "+N"
  // wanderer chip). `accent` stays for stroke roles where deep dried
  // blood reads as decorative texture.
  bloodInk: CHARCOAL.bloodInk,
  ember: CHARCOAL.ember,
  coin: CHARCOAL.coin,
  bone: CHARCOAL.ink2,
  // Aliases kept for the rest of the codebase that still imports UI_COLORS:
  surface: 'rgba(8, 6, 5, 0.92)',
  surfaceDim: 'rgba(12, 10, 9, 0.55)',
  stroke: 'rgba(232, 226, 212, 0.18)',
  gold: CHARCOAL.coin,
  goldDim: '#8a6a18',
  cyan: CHARCOAL.ember,
  orange: CHARCOAL.ember,
  cream: CHARCOAL.ink,
  creamDim: CHARCOAL.inkDim,
  purple: CHARCOAL.accent,
  red: CHARCOAL.danger,
  green: CHARCOAL.ember,
  hero: CHARCOAL.ink2,
  fire: CHARCOAL.accent,
};

// HUD geometry — charcoal version is slightly taller to accommodate
// the wobbly stroke + drag specks without clipping.
//
// Layout shift: the phase dial is no longer inside the top-left panel
// — it floats centered at the top of the canvas instead. The top-left
// panel shrank correspondingly and now only carries the coin readout +
// the campfire/hero HP rows. (Villagers row was removed; the count was
// just noise. Seed line was removed too — the seed is still tracked in
// Game state for the leaderboard but no longer surfaced in the HUD.)
const HUD_LEFT = 18;
const HUD_TOP = 18;
const PANEL_W = 226;
const PANEL_H_BASE = 92;

// Phase dial — centered horizontally along the top of the canvas. Its
// cy is fixed; cx is computed per-frame from the canvas width.
const DIAL_R = 28;
const DIAL_CY = 18 + DIAL_R + 8; // small top margin so the wobble doesn't clip

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  resources: Resources,
  clock: Clock,
  campfire: Campfire,
  recruits: Recruit[],
  hero: Hero,
  _seedLabel: string | undefined,
  coinCap: number,
) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  drawHudBackdrop(ctx);
  drawCoinReadout(ctx, resources.coin, coinCap);
  drawStatRows(ctx, hero, campfire, recruits);

  // Top-center floating dial — backdrop drawn first, then the dial +
  // its phase label sit on top of it.
  drawDialBackdrop(ctx);
  drawPhaseDial(ctx, clock);

  drawNightWarning(ctx, clock);
  ctx.restore();
}

// ── Backdrop ──────────────────────────────────────────────────────────

function drawHudBackdrop(ctx: CanvasRenderingContext2D) {
  const x = HUD_LEFT - 8;
  const y = HUD_TOP - 8;
  const w = PANEL_W;
  const h = PANEL_H_BASE;

  // Dark paper fill — solid black with a hint of warmth.
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x, y, w, h);

  // Charcoal frame.
  handRect(ctx, x, y, w, h, {
    seed: 7001,
    jitter: 1.4,
    strokeWidth: 1.1,
    stroke: CHARCOAL.ink,
    opacity: 0.7,
    samplesPerSide: 16,
    passes: 1,
  });
  // A faint blood drip running down the left edge — the Charcoal Ritual
  // signature.
  handLine(ctx, x + 2, y + 6, x + 2, y + h - 8, {
    seed: 7011,
    jitter: 0.9,
    samples: 14,
    stroke: CHARCOAL.accent,
    strokeWidth: 1.4,
    opacity: 0.55,
  });
}

// Backdrop just for the floating dial. Sized to wrap the dial circle
// + the phase-label cluster that sits to its right, with the same
// charcoal-frame chrome as the left HUD so the two read as siblings.
const DIAL_PANEL_W = 184;
const DIAL_PANEL_H = 80;
const DIAL_PANEL_INSET = 14;

/** Single source of truth for the dial panel + dial layout. The panel
 *  itself is centered on the canvas's horizontal midline; the dial
 *  circle sits inset from the panel's left edge and the phase label
 *  fills the right half. drawDialBackdrop and drawPhaseDial both call
 *  this so they always agree. */
function dialPanelGeometry(canvasW: number) {
  const panelX = Math.round((canvasW - DIAL_PANEL_W) / 2);
  const dialCx = panelX + DIAL_PANEL_INSET + DIAL_R;
  return { panelX, dialCx };
}

function drawDialBackdrop(ctx: CanvasRenderingContext2D) {
  const { panelX } = dialPanelGeometry(ctx.canvas.width);
  const x = panelX;
  const y = DIAL_CY - DIAL_R - 12;
  const w = DIAL_PANEL_W;
  const h = DIAL_PANEL_H;

  // Dark paper fill.
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x, y, w, h);

  // Charcoal frame — same recipe as the left panel for visual rhyme.
  handRect(ctx, x, y, w, h, {
    seed: 7050,
    jitter: 1.4,
    strokeWidth: 1.1,
    stroke: CHARCOAL.ink,
    opacity: 0.7,
    samplesPerSide: 14,
    passes: 1,
  });
  // Same blood drip down the left edge — keeps the Ritual signature.
  handLine(ctx, x + 2, y + 6, x + 2, y + h - 8, {
    seed: 7060,
    jitter: 0.9,
    samples: 12,
    stroke: CHARCOAL.accent,
    strokeWidth: 1.4,
    opacity: 0.55,
  });
}

// ── Phase Dial ────────────────────────────────────────────────────────

function drawPhaseDial(ctx: CanvasRenderingContext2D, clock: Clock) {
  // The dial sits inside its backdrop panel, which is centered on the
  // canvas. The dial circle goes in the panel's left half; the phase
  // label fills the right half. dialPanelGeometry() is the shared
  // truth so the dial + backdrop never drift apart.
  const r = DIAL_R;
  const cy = DIAL_CY;
  const { dialCx: cx } = dialPanelGeometry(ctx.canvas.width);
  const progress = Math.max(0, Math.min(1, clock.progress()));
  const { color, label, night } = phaseStyle(clock);

  // Outer faint wobbly ring — sets up the dial as a hand-inked compass.
  handCircle(ctx, cx, cy, r + 5, {
    seed: 7100,
    jitter: 1.6,
    samples: 32,
    stroke: CHARCOAL.ink,
    strokeWidth: 0.6,
    opacity: 0.5,
  });
  // Main wobbly ring.
  handCircle(ctx, cx, cy, r, {
    seed: 7101,
    jitter: 1.1,
    samples: 32,
    stroke: CHARCOAL.ink,
    strokeWidth: 1.1,
    opacity: 0.85,
    passes: 2,
  });

  // 12 tick marks (cardinal-like).
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r1 = r + 4;
    const r2 = r + 8;
    handLine(
      ctx,
      cx + Math.cos(a) * r1,
      cy + Math.sin(a) * r1,
      cx + Math.cos(a) * r2,
      cy + Math.sin(a) * r2,
      {
        seed: 7200 + i,
        jitter: 0.4,
        samples: 3,
        stroke: CHARCOAL.ink,
        strokeWidth: 0.7,
        opacity: 0.5,
        charcoal: false,
      },
    );
  }

  // Phase progress arc — drawn as a series of short hand-lines so it
  // reads as multiple ink strokes laid over each other.
  if (progress > 0) {
    const segs = 28;
    const segCount = Math.max(1, Math.floor(segs * progress));
    for (let i = 0; i < segCount; i++) {
      const a1 = -Math.PI / 2 + (i / segs) * Math.PI * 2;
      const a2 = -Math.PI / 2 + ((i + 1) / segs) * Math.PI * 2;
      handLine(
        ctx,
        cx + Math.cos(a1) * r,
        cy + Math.sin(a1) * r,
        cx + Math.cos(a2) * r,
        cy + Math.sin(a2) * r,
        {
          seed: 7300 + i,
          jitter: 0.9,
          samples: 3,
          stroke: color,
          strokeWidth: 2,
          opacity: 0.95,
        },
      );
    }
  }

  // Centre glyph — moon for night, sun rays for day, partial sun for dawn.
  if (clock.phase === 'night') {
    handCircle(ctx, cx, cy, 11, {
      seed: 7400,
      jitter: 0.8,
      samples: 18,
      stroke: CHARCOAL.ink,
      strokeWidth: 0.9,
      fill: CHARCOAL.bg,
      passes: 2,
    });
    // Crescent — a smaller circle in bg color clipped over.
    handCircle(ctx, cx + 4, cy - 2, 11, {
      seed: 7401,
      jitter: 0.7,
      samples: 18,
      stroke: 'transparent',
      strokeWidth: 0,
      fill: CHARCOAL.bg,
    });
  } else if (clock.phase === 'dawn') {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      handLine(
        ctx,
        cx + Math.cos(a) * 8,
        cy + Math.sin(a) * 8,
        cx + Math.cos(a) * 13,
        cy + Math.sin(a) * 13,
        {
          seed: 7500 + i,
          jitter: 0.5,
          samples: 3,
          stroke: color,
          strokeWidth: 1.2,
        },
      );
    }
    handCircle(ctx, cx, cy, 6, {
      seed: 7510,
      jitter: 0.6,
      samples: 14,
      stroke: color,
      strokeWidth: 1.1,
      passes: 2,
    });
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      handLine(
        ctx,
        cx + Math.cos(a) * 7,
        cy + Math.sin(a) * 7,
        cx + Math.cos(a) * 13,
        cy + Math.sin(a) * 13,
        {
          seed: 7600 + i,
          jitter: 0.5,
          samples: 3,
          stroke: color,
          strokeWidth: 1.3,
        },
      );
    }
    handCircle(ctx, cx, cy, 5, {
      seed: 7610,
      jitter: 0.5,
      samples: 14,
      stroke: color,
      strokeWidth: 1.2,
      fill: color,
      passes: 2,
      opacity: 0.6,
    });
  }

  // Single-line "Day 01" / "Night 03" / "Dawn" beat to the right of
  // the dial — chronicle-italic serif so it reads as part of the
  // hand-drawn field-journal voice.
  const tx = cx + r + 12;
  const labelText = `${label} ${String(night).padStart(2, '0')}`;
  handText(ctx, labelText, tx, cy + 6, {
    seed: 7700,
    jitter: 0.4,
    fontSize: 16,
    font: SERIF_FONT,
    fill: COLORS.ink,
    weight: 700,
    italic: true,
  });
  // Underline runs under the whole line in the phase tone.
  ctx.font = `italic 700 16px ${SERIF_FONT}`;
  const labelW = ctx.measureText(labelText).width;
  handLine(ctx, tx, cy + 12, tx + Math.max(70, labelW + 6), cy + 12, {
    seed: 7702,
    jitter: 0.9,
    samples: 14,
    stroke: color,
    strokeWidth: 0.7,
    opacity: 0.6,
  });
}

// ── Coin readout ──────────────────────────────────────────────────────

function drawCoinReadout(ctx: CanvasRenderingContext2D, coin: number, cap: number) {
  // Top of the (now smaller, dial-less) panel — sits at the upper-left
  // with a bit of inset for the wobbly stroke + ritual dot affordance.
  const x = HUD_LEFT + 14;
  const y = HUD_TOP + 22;

  const atCap = coin >= cap;
  const sigilColor = atCap ? COLORS.bloodInk : COLORS.coin;
  const numColor = atCap ? COLORS.bloodInk : COLORS.coin;

  // Hand-drawn coin sigil. Turns blood-red when the purse is full so
  // the player notices that further pickups will scatter.
  handCircle(ctx, x, y, 9, {
    seed: 7800,
    jitter: 0.8,
    samples: 16,
    stroke: sigilColor,
    strokeWidth: 1.1,
    passes: 2,
  });
  handCircle(ctx, x, y, 5, {
    seed: 7801,
    jitter: 0.6,
    samples: 12,
    stroke: sigilColor,
    strokeWidth: 0.8,
    opacity: 0.6,
  });

  // Coin value + cap fraction. Both are rendered with handText so the
  // strokes match the rest of the HUD's chronicle voice. Spacing is
  // measured against the value's actual rendered font (was previously
  // measured with the wrong font, which shoved the cap too close).
  const valueText = `${coin}`;
  const capText = `/ ${cap}`;
  const valueFontSize = 17;
  const valueLetterSpacing = 1;
  const capFontSize = 10;
  const valueX = x + 16;
  const baselineY = y + 6;

  handText(ctx, valueText, valueX, baselineY, {
    seed: 7802,
    jitter: 0.4,
    fontSize: valueFontSize,
    font: MONO_FONT,
    fill: numColor,
    weight: 700,
    letterSpacing: valueLetterSpacing,
  });

  // Measure the value with the SAME font + letter-spacing it was
  // rendered at, so the cap suffix sits at a known offset.
  ctx.save();
  ctx.font = `700 ${valueFontSize}px ${MONO_FONT}`;
  let valueW = 0;
  for (const ch of valueText) valueW += ctx.measureText(ch).width + valueLetterSpacing;
  if (valueText.length > 0) valueW -= valueLetterSpacing; // no trailing kerning
  ctx.restore();

  // 6px breathing room between the value and the "/ NN" suffix.
  handText(ctx, capText, valueX + valueW + 6, baselineY, {
    seed: 7803,
    jitter: 0.3,
    fontSize: capFontSize,
    font: MONO_FONT,
    fill: COLORS.inkDim,
    weight: 500,
    letterSpacing: 1,
  });
}

// ── Stat rows: Campfire, Hero ─────────────────────────────────────────
//
// The villagers row was removed — the count alone wasn't actionable
// information, and the workers/villagers panel near each station already
// surfaces the per-job context the player actually decides on.

function drawStatRows(
  ctx: CanvasRenderingContext2D,
  hero: Hero,
  campfire: Campfire,
  _recruits: Recruit[],
) {
  const x = HUD_LEFT + 6;
  let y = HUD_TOP + 56;
  const rowSpacing = 16;
  // Bars used to start 64px in (after the "CAMPFIRE" text label).
  // With glyphs the icon column only needs ~22px, freeing the bar to
  // stretch most of the panel width.
  const barLeft = x + 22;
  const barW = PANEL_W - (barLeft - HUD_LEFT) - 22;
  const barH = 7;

  // Icon column anchor. Each row gets a small hand-drawn glyph in
  // place of a "CAMPFIRE" / "HERO" label — the icons are short enough
  // that we can drop the label entirely and let the bar speak.
  const iconCx = x + 10;

  // Campfire row — segmented hand-drawn bar.
  drawCampfireIcon(ctx, iconCx, y - 4, COLORS.accent);
  drawSegmentedHandBar(ctx, barLeft, y - 5, barW, barH, campfire.hp / Math.max(1, campfire.maxHp), COLORS.accent, 7900);
  y += rowSpacing;

  // Hero row — single bar.
  drawHeroIcon(ctx, iconCx, y - 4, COLORS.bone);
  drawHandBar(ctx, barLeft, y - 5, barW, barH, hero.hp / Math.max(1, hero.maxHp), COLORS.bone, 7920);
}

/** Tiny hand-drawn flame glyph — a flickering teardrop body with a
 *  thin centre line for the wick, sized to fit the HUD row. */
function drawCampfireIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
) {
  // Outer flame teardrop — handCircle with a slight upward shift.
  handCircle(ctx, cx, cy, 5.2, {
    seed: 7980,
    jitter: 0.6,
    samples: 16,
    stroke: color,
    strokeWidth: 1.0,
    opacity: 0.85,
    passes: 2,
  });
  // Tall flame tongue — a single curved hand-line above the body.
  handLine(ctx, cx, cy - 2, cx, cy - 9, {
    seed: 7981,
    jitter: 0.7,
    samples: 6,
    stroke: color,
    strokeWidth: 1.1,
    opacity: 0.9,
  });
  // Two side flicks for the flame "shoulders".
  handLine(ctx, cx - 3, cy - 1, cx - 5, cy - 5, {
    seed: 7982,
    jitter: 0.5,
    samples: 4,
    stroke: color,
    strokeWidth: 0.8,
    opacity: 0.7,
  });
  handLine(ctx, cx + 3, cy - 1, cx + 5, cy - 5, {
    seed: 7983,
    jitter: 0.5,
    samples: 4,
    stroke: color,
    strokeWidth: 0.8,
    opacity: 0.7,
  });
  // Ember dot in the centre — fills the body so the flame reads as
  // having a hot core, not just an outline.
  handCircle(ctx, cx, cy + 1, 2.0, {
    seed: 7984,
    jitter: 0.3,
    samples: 10,
    stroke: color,
    strokeWidth: 0.5,
    fill: color,
    opacity: 0.6,
  });
}

/** Tiny hand-drawn hero glyph — head + shoulders + torso, like the
 *  silhouettes that orbit the campfire in the world. */
function drawHeroIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  color: string,
) {
  // Head — small circle at the top of the icon.
  handCircle(ctx, cx, cy - 4, 2.3, {
    seed: 7990,
    jitter: 0.3,
    samples: 12,
    stroke: color,
    strokeWidth: 1.0,
    opacity: 0.9,
    passes: 2,
  });
  // Shoulders / torso — a downward triangle silhouette.
  handLine(ctx, cx - 4, cy + 5, cx, cy - 1, {
    seed: 7991,
    jitter: 0.5,
    samples: 5,
    stroke: color,
    strokeWidth: 1.0,
    opacity: 0.85,
  });
  handLine(ctx, cx + 4, cy + 5, cx, cy - 1, {
    seed: 7992,
    jitter: 0.5,
    samples: 5,
    stroke: color,
    strokeWidth: 1.0,
    opacity: 0.85,
  });
  // Bottom of the torso — a short arc to close the V into a wedge.
  handLine(ctx, cx - 4, cy + 5, cx + 4, cy + 5, {
    seed: 7993,
    jitter: 0.4,
    samples: 4,
    stroke: color,
    strokeWidth: 0.8,
    opacity: 0.7,
  });
}

/** A single hand-drawn HP bar with a crosshatch fill. */
function drawHandBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  fillColor: string,
  seed: number,
) {
  const clamped = Math.max(0, Math.min(1, pct));
  // Outline.
  handRect(ctx, x, y, w, h, {
    seed,
    jitter: 0.7,
    samplesPerSide: 12,
    stroke: COLORS.ink,
    strokeWidth: 0.9,
    opacity: 0.6,
  });
  // Crosshatch fill clipped to filled portion.
  if (clamped > 0.03) {
    crossHatch(ctx, x + 1, y + 1, (w - 2) * clamped, h - 2, {
      seed: seed + 17,
      spacing: 2.2,
      angle: 45,
      jitter: 0.3,
      stroke: fillColor,
      strokeWidth: 0.5,
      opacity: 0.95,
    });
  }
}

/** A 10-segment hand-drawn bar — used for campfire HP so it visually
 *  echoes the Hero Roster artboard from the design. */
function drawSegmentedHandBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  fillColor: string,
  seed: number,
) {
  const clamped = Math.max(0, Math.min(1, pct));
  const segs = 10;
  const gap = 1.2;
  const segW = (w - gap * (segs - 1)) / segs;
  const filled = Math.round(clamped * segs);
  for (let i = 0; i < segs; i++) {
    const sx = x + i * (segW + gap);
    const segSeed = seed + i * 7;
    handRect(ctx, sx, y, segW, h, {
      seed: segSeed,
      jitter: 0.5,
      samplesPerSide: 5,
      stroke: COLORS.ink,
      strokeWidth: 0.7,
      opacity: i < filled ? 0.85 : 0.32,
    });
    if (i < filled) {
      crossHatch(ctx, sx + 1, y + 1, segW - 2, h - 2, {
        seed: segSeed + 31,
        spacing: 2,
        angle: 45,
        jitter: 0.3,
        stroke: fillColor,
        strokeWidth: 0.45,
        opacity: 0.95,
      });
    }
  }
}

// ── Phase / countdown banner (top-centre warning) ─────────────────────

function drawNightWarning(ctx: CanvasRenderingContext2D, clock: Clock) {
  if (clock.phase === 'day') {
    const r = clock.remaining();
    if (r > 12) return;
    const alpha = Math.min(1, (12 - r) / 3);
    drawCharcoalMiniBanner(ctx, alpha, {
      headline: `NIGHT ${clock.night} IN`,
      countdown: `${Math.ceil(r)}s`,
      footer: 'GET TO THE FIRE',
      tone: 'blood',
      shake: true,
    });
    return;
  }
  if (clock.phase === 'night') {
    const r = clock.remaining();
    if (clock.heldAtPhaseEnd) {
      drawCharcoalMiniBanner(ctx, 1, {
        headline: 'THE SUN WAITS',
        countdown: '\u2014',
        footer: 'CLEAR THE FIELD',
        tone: 'blood',
        breathe: true,
      });
      return;
    }
    if (r > 12) return;
    const alpha = Math.min(1, (12 - r) / 3);
    drawCharcoalMiniBanner(ctx, alpha, {
      headline: 'DAWN IN',
      countdown: `${Math.ceil(r)}s`,
      footer: 'HOLD THE LINE',
      tone: 'ember',
      breathe: true,
    });
  }
}

function drawCharcoalMiniBanner(
  ctx: CanvasRenderingContext2D,
  alpha: number,
  options: {
    headline: string;
    countdown: string;
    footer: string;
    tone: 'blood' | 'ember';
    shake?: boolean;
    breathe?: boolean;
  },
) {
  const cx = ctx.canvas.width / 2;
  const panelW = 248;
  const panelH = 100;
  const panelY = 30;
  const panelX = cx - panelW / 2;
  // Split the tone into a stroke color (deep, decorative) and an ink
  // color (bright, legible). For ember both are the same; for blood the
  // ink lift is what makes the headline readable on charcoal black.
  const toneStroke = options.tone === 'ember' ? COLORS.ember : COLORS.accent;
  const toneInk = options.tone === 'ember' ? COLORS.ember : COLORS.bloodInk;
  const tone = toneStroke;

  ctx.save();
  ctx.globalAlpha *= alpha;

  if (options.shake) {
    const shake = Math.sin(performance.now() / 40) * 1.6 * alpha;
    ctx.translate(shake, 0);
  }
  if (options.breathe) {
    const s = 1 + Math.sin(performance.now() / 520) * 0.018 * alpha;
    ctx.translate(cx, panelY + panelH / 2);
    ctx.scale(s, s);
    ctx.translate(-cx, -(panelY + panelH / 2));
  }

  // Heavy black backdrop.
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // Charcoal frame in tone color.
  handRect(ctx, panelX, panelY, panelW, panelH, {
    seed: 8101,
    jitter: 1.4,
    samplesPerSide: 18,
    stroke: tone,
    strokeWidth: 1.4,
    passes: 2,
  });

  // Subtle hatch wash.
  crossHatch(ctx, panelX + 3, panelY + 3, panelW - 6, panelH - 6, {
    seed: 8102,
    spacing: 14,
    angle: 22,
    jitter: 0.6,
    stroke: tone,
    strokeWidth: 0.3,
    opacity: 0.12,
  });

  handText(ctx, options.headline, cx, panelY + 22, {
    seed: 8110,
    jitter: 0.3,
    fontSize: 11,
    font: MONO_FONT,
    fill: toneInk,
    weight: 700,
    letterSpacing: 4,
    align: 'center',
  });

  handText(ctx, options.countdown, cx, panelY + 60, {
    seed: 8111,
    jitter: 0.6,
    fontSize: 38,
    font: SERIF_FONT,
    fill: COLORS.ink,
    weight: 700,
    italic: true,
    align: 'center',
  });

  handText(ctx, options.footer, cx, panelY + 86, {
    seed: 8112,
    jitter: 0.2,
    fontSize: 9,
    font: MONO_FONT,
    fill: COLORS.inkDim,
    weight: 600,
    letterSpacing: 3,
    align: 'center',
  });

  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────────
// Action bar (bottom-center)
//
// Hand-drawn slots for the player's primary abilities. The shape +
// positioning is deliberately Roblox-port-friendly: each slot is a
// touch-target-sized 56x56 hand-drawn rect with a hotkey label, an
// icon, and a state ring. On Roblox these become ScreenGui buttons
// with the same icons + ImageButton hit-areas.
//
// Initial slots:
//   Attack    — sword glyph        — Click / Shift
//   Interact  — open-palm glyph    — Space (context: chop, pay, build,
//                                            hire, upgrade, rescue,
//                                            light lantern, claim POI)
//   Lantern   — flame glyph        — passive (active when lanternTimeLeft > 0)

interface ActionSlot {
  hotkey: string;
  icon: 'attack' | 'interact' | 'lantern';
  state: 'ready' | 'active' | 'dim';
  /** 0..1 progress for the ring overlay. For lantern this is timeLeft / max. */
  progress?: number;
}

const ACTION_SLOT_W = 56;
const ACTION_SLOT_H = 56;
const ACTION_SLOT_GAP = 14;
const ACTION_BAR_BOTTOM_MARGIN = 22;

export function drawActionBar(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  hero: Hero,
  lanternTimeLeft: number,
  lanternMaxDuration: number,
) {
  const slots: ActionSlot[] = [
    {
      hotkey: 'LMB',
      icon: 'attack',
      // Hero swing has a 0.35s cooldown (HERO_SWING_COOLDOWN). The slot
      // dims briefly during the cooldown so the player can read recovery
      // visually — same affordance Roblox would use with a button tint.
      state: hero.attackCooldown > 0 ? 'dim' : 'ready',
      progress: hero.attackCooldown > 0
        ? 1 - hero.attackCooldown / HERO_SWING_COOLDOWN
        : 0,
    },
    {
      hotkey: 'SPACE',
      icon: 'interact',
      state: 'ready',
    },
    {
      hotkey: 'PASSIVE',
      icon: 'lantern',
      state: lanternTimeLeft > 0 ? 'active' : 'dim',
      progress: lanternTimeLeft > 0
        ? lanternTimeLeft / Math.max(1, lanternMaxDuration)
        : 0,
    },
  ];

  const totalW = slots.length * ACTION_SLOT_W + (slots.length - 1) * ACTION_SLOT_GAP;
  const startX = Math.round((canvasW - totalW) / 2);
  const y = canvasH - ACTION_SLOT_H - ACTION_BAR_BOTTOM_MARGIN;

  ctx.save();
  for (let i = 0; i < slots.length; i++) {
    drawActionSlot(ctx, startX + i * (ACTION_SLOT_W + ACTION_SLOT_GAP), y, slots[i], i);
  }
  ctx.restore();
}

function drawActionSlot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  slot: ActionSlot,
  index: number,
) {
  const w = ACTION_SLOT_W;
  const h = ACTION_SLOT_H;
  const seedBase = 8200 + index * 50;
  const dim = slot.state === 'dim';
  const active = slot.state === 'active';

  // Charcoal page body.
  ctx.save();
  ctx.globalAlpha = dim ? 0.55 : 1;
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  // Hand-drawn outer rect.
  handRect(ctx, x, y, w, h, {
    seed: seedBase,
    jitter: 1.2,
    samplesPerSide: 12,
    stroke: CHARCOAL.ink,
    strokeWidth: 1.0,
    opacity: dim ? 0.45 : 0.75,
  });

  // Active glow — ember accent stroke pass when the ability is firing
  // (e.g. lantern lit).
  if (active) {
    handRect(ctx, x - 1, y - 1, w + 2, h + 2, {
      seed: seedBase + 1,
      jitter: 1.0,
      samplesPerSide: 12,
      stroke: CHARCOAL.ember,
      strokeWidth: 1.4,
      opacity: 0.55,
    });
  }

  // Dried-blood spine on the left edge — same signature as other panels.
  handLine(ctx, x + 2, y + 5, x + 2, y + h - 5, {
    seed: seedBase + 2,
    jitter: 0.7,
    samples: 10,
    stroke: CHARCOAL.accent,
    strokeWidth: 1.2,
    opacity: dim ? 0.3 : 0.5,
  });

  // Icon centered above the hotkey label.
  const iconCx = x + w / 2;
  const iconCy = y + 22;
  if (slot.icon === 'attack') drawSwordIcon(ctx, iconCx, iconCy, dim ? COLORS.inkDim : COLORS.bone);
  else if (slot.icon === 'interact') drawInteractIcon(ctx, iconCx, iconCy, dim ? COLORS.inkDim : COLORS.bone);
  else if (slot.icon === 'lantern') drawLanternIcon(ctx, iconCx, iconCy, active ? COLORS.ember : (dim ? COLORS.inkDim : COLORS.bone));

  // Hotkey label at the bottom of the slot.
  handText(ctx, slot.hotkey, iconCx, y + h - 8, {
    seed: seedBase + 3,
    jitter: 0.2,
    fontSize: 8,
    font: MONO_FONT,
    fill: dim ? COLORS.inkFaint : COLORS.inkDim,
    weight: 700,
    letterSpacing: 1.6,
    align: 'center',
  });

  // Progress ring along the bottom of the slot — for the lantern's
  // remaining-burn timer or the swing's cooldown decay. A horizontal
  // hand-line whose length is proportional to `progress`.
  if (slot.progress !== undefined && slot.progress > 0 && slot.progress < 1) {
    const ringX1 = x + 6;
    const ringX2 = x + w - 6;
    const ringY = y + h - 17;
    const fill = ringX1 + (ringX2 - ringX1) * slot.progress;
    handLine(ctx, ringX1, ringY, fill, ringY, {
      seed: seedBase + 4,
      jitter: 0.3,
      samples: 8,
      stroke: active ? CHARCOAL.ember : COLORS.bone,
      strokeWidth: 1.2,
      opacity: 0.85,
    });
  }
}

/** Diagonal sword glyph — handle at lower-left, blade at upper-right. */
function drawSwordIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // Blade.
  handLine(ctx, cx - 7, cy + 7, cx + 7, cy - 7, {
    seed: 8260,
    jitter: 0.4,
    samples: 8,
    stroke: color,
    strokeWidth: 1.4,
    opacity: 0.9,
  });
  // Crossguard (perpendicular to blade).
  handLine(ctx, cx - 5, cy + 1, cx + 1, cy + 5, {
    seed: 8261,
    jitter: 0.3,
    samples: 5,
    stroke: color,
    strokeWidth: 1.0,
    opacity: 0.85,
  });
  // Pommel — small dot at the handle base.
  handCircle(ctx, cx - 6, cy + 6, 1.4, {
    seed: 8262,
    jitter: 0.3,
    samples: 8,
    stroke: color,
    strokeWidth: 0.7,
    fill: color,
    opacity: 0.7,
  });
}

/** Open-palm "interact" glyph — a small hand outline. */
function drawInteractIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // Palm circle.
  handCircle(ctx, cx, cy + 1, 5, {
    seed: 8270,
    jitter: 0.6,
    samples: 16,
    stroke: color,
    strokeWidth: 1.0,
    opacity: 0.85,
    passes: 2,
  });
  // Three short finger lines reaching upward.
  for (let i = 0; i < 3; i++) {
    const dx = (i - 1) * 3;
    handLine(ctx, cx + dx, cy - 4, cx + dx, cy - 9, {
      seed: 8271 + i,
      jitter: 0.4,
      samples: 4,
      stroke: color,
      strokeWidth: 0.9,
      opacity: 0.8,
    });
  }
}

/** Lantern flame glyph — same flame shape as the campfire HUD icon
 *  but slightly larger. */
function drawLanternIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, color: string) {
  // Outer flame teardrop.
  handCircle(ctx, cx, cy + 1, 6.5, {
    seed: 8280,
    jitter: 0.7,
    samples: 18,
    stroke: color,
    strokeWidth: 1.1,
    opacity: 0.85,
    passes: 2,
  });
  // Tall flame tongue.
  handLine(ctx, cx, cy - 3, cx, cy - 11, {
    seed: 8281,
    jitter: 0.7,
    samples: 7,
    stroke: color,
    strokeWidth: 1.1,
    opacity: 0.9,
  });
  // Side flicks.
  handLine(ctx, cx - 4, cy - 1, cx - 6, cy - 6, {
    seed: 8282,
    jitter: 0.5,
    samples: 5,
    stroke: color,
    strokeWidth: 0.9,
    opacity: 0.7,
  });
  handLine(ctx, cx + 4, cy - 1, cx + 6, cy - 6, {
    seed: 8283,
    jitter: 0.5,
    samples: 5,
    stroke: color,
    strokeWidth: 0.9,
    opacity: 0.7,
  });
  // Ember dot in the body.
  handCircle(ctx, cx, cy + 2, 2.4, {
    seed: 8284,
    jitter: 0.3,
    samples: 10,
    stroke: color,
    strokeWidth: 0.6,
    fill: color,
    opacity: 0.6,
  });
}

// ──────────────────────────────────────────────────────────────────────
// Quest panel (top-right)

export function drawQuestPanel(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  questIndex: number,
  completeFlashTime: number,
) {
  const panelW = 308;
  const panelX = canvasW - panelW - 12;
  const panelY = 14;

  const flashing = completeFlashTime > 0;
  const done = questIndex >= QUESTS.length;
  const q = done ? null : QUESTS[questIndex];

  // Measure the goal text in the same font we'll draw it with so the
  // panel can grow to fit multi-line goals (e.g. "Walk to the Forester's
  // hut ghost and hold Space to build it — its worker plants fresh
  // trees you can chop." wraps to 3 lines).
  const padX = 14;
  const goalLineH = 13;
  const goalY = 62;
  let goalLines: string[] = [];
  if (q) {
    ctx.save();
    ctx.font = `500 10.5px ${UI_FONT}`;
    goalLines = wrapTextLines(ctx, q.goal, panelW - padX * 2);
    ctx.restore();
  }
  const goalBlockH = goalLines.length * goalLineH;
  const goalBottomY = goalY + Math.max(0, goalBlockH - goalLineH) + 6;
  const panelH = done ? 56 : Math.max(80, goalBottomY + 6);

  ctx.save();
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  handRect(ctx, panelX, panelY, panelW, panelH, {
    seed: 8201,
    jitter: 1.2,
    samplesPerSide: 18,
    stroke: COLORS.ink,
    strokeWidth: 1.0,
    opacity: 0.7,
    passes: 1,
  });

  // Left accent stroke — flashing gold on completion, dried-blood otherwise.
  handLine(
    ctx,
    panelX + 2,
    panelY + 6,
    panelX + 2,
    panelY + panelH - 6,
    {
      seed: 8202,
      jitter: 0.8,
      samples: 14,
      stroke: flashing ? COLORS.coin : COLORS.accent,
      strokeWidth: 1.6,
      opacity: 0.85,
    },
  );

  if (flashing) {
    // Gold wash overlay.
    const t = Math.min(1, completeFlashTime / 2.5);
    const alpha = 0.18 * t;
    ctx.fillStyle = `rgba(199, 154, 58, ${alpha})`;
    ctx.fillRect(panelX, panelY, panelW, panelH);
  }

  if (done) {
    handText(ctx, 'QUEST COMPLETE', panelX + padX, panelY + 20, {
      seed: 8210,
      jitter: 0.2,
      fontSize: 10,
      font: MONO_FONT,
      fill: flashing ? COLORS.coin : COLORS.bloodInk,
      weight: 600,
      letterSpacing: 3,
    });
    handText(ctx, 'Now survive 10 nights', panelX + padX, panelY + 42, {
      seed: 8211,
      jitter: 0.4,
      fontSize: 17,
      font: SERIF_FONT,
      fill: COLORS.ink,
      weight: 700,
      italic: true,
    });
  } else if (q) {
    // Step pip indicator.
    handText(ctx, `QUEST ${String(questIndex + 1).padStart(2, '0')} / ${String(QUESTS.length).padStart(2, '0')}`, panelX + padX, panelY + 20, {
      seed: 8220,
      jitter: 0.2,
      fontSize: 10,
      font: MONO_FONT,
      fill: COLORS.bloodInk,
      weight: 600,
      letterSpacing: 3,
    });
    // Title.
    handText(ctx, q.title, panelX + padX, panelY + 42, {
      seed: 8221,
      jitter: 0.4,
      fontSize: 17,
      font: SERIF_FONT,
      fill: COLORS.ink,
      weight: 700,
      italic: true,
    });
    // Goal — render the pre-computed wrapped lines so the panel
    // height we picked above lines up with what's drawn.
    ctx.font = `500 10.5px ${UI_FONT}`;
    ctx.fillStyle = COLORS.inkDim;
    ctx.textBaseline = 'alphabetic';
    drawWrappedLines(ctx, goalLines, panelX + padX, panelY + goalY, goalLineH);
  }

  ctx.restore();
}

// ──────────────────────────────────────────────────────────────────────
// Helpers retained for the rest of the codebase

export const UI_COLORS = COLORS;
export const UI_FONTS = {
  ui: UI_FONT,
  serif: SERIF_FONT,
  mono: MONO_FONT,
};

export function drawSmallCaps(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking = 1.2,
): void {
  const upper = text.toUpperCase();
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = c.letterSpacing;
  c.letterSpacing = `${tracking}px`;
  ctx.fillText(upper, x, y);
  c.letterSpacing = prev ?? '0px';
}

export function drawCoinIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
): void {
  // Hand-drawn coin glyph used by station / shop / world panels.
  handCircle(ctx, cx, cy, r, {
    seed: 9000 + Math.round(cx) + Math.round(cy),
    jitter: 0.6,
    samples: 14,
    stroke: COLORS.coin,
    strokeWidth: 1,
    fill: 'rgba(199, 154, 58, 0.15)',
    passes: 2,
  });
}

/** Layout-only pass: returns the lines the text would wrap into for
 *  the given width using the current `ctx.font`. Use this to size a
 *  panel before drawing, then pass the same lines to `drawWrappedLines`
 *  to render them. */
function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedLines(
  ctx: CanvasRenderingContext2D,
  lines: string[],
  x: number,
  y: number,
  lineH: number,
): void {
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineH);
  }
}

// ── Phase style ───────────────────────────────────────────────────────

function phaseStyle(clock: Clock): { color: string; label: string; night: number } {
  // Title-case labels so they read cleanly inline with the night number
  // ("Day 01") instead of as small-caps mono ("DAY").
  switch (clock.phase) {
    case 'day':
      return { color: COLORS.bone, label: 'Day', night: clock.night };
    case 'night':
      return { color: COLORS.accent, label: 'Night', night: clock.night };
    case 'dawn':
      return { color: COLORS.ember, label: 'Dawn', night: clock.night };
  }
}
