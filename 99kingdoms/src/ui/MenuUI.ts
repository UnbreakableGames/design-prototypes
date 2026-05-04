// Shared chrome for the menu-screen modal family: Leaderboard, Codex,
// Achievements, Handle prompt, Modifier picker. Rewritten to match the
// Claude Design handoff ("Menu Screens") — a deckled parchment page with
// warm corner foxing, a faint paper grain, a "THE CHRONICLES" eyebrow
// ribbon, an italic-serif title, an optional right-aligned meta block,
// and a small-caps footer with inline keycap glyphs.
//
// Canvas 2D stand-ins for the reference's SVG flourishes:
//   * feTurbulence paper grain → a precomputed noise canvas drawn with
//     `multiply` composite at low alpha.
//   * radial foxing gradients → two radial gradients at top-left and
//     bottom-right.
//   * <kbd> keycaps → a small bordered pill of mono text.
//
// Every draw helper returns rects for hit-testing so the callers in Game.ts
// don't need to know a single thing about layout.

import { UI_COLORS, UI_FONTS } from './HUD';
import { handLine, handRect } from '../systems/HandDrawn';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function rectContains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

// ── Palette ────────────────────────────────────────────────────────────
// Charcoal-Ritual + Bloodletting Red. Names retained from the parchment
// era so each modal body (which references INK / PAPER_*) Just Works
// after this palette swap; only the values shift to bone-on-black.
export const INK = '#e8e2d4';                            // bone (was dark ink)
export const INK_D = '#cbc4b2';
export const INK_DIM = 'rgba(232,226,212,0.65)';
export const INK_FAINT = 'rgba(232,226,212,0.32)';
export const INK_WARN = '#ed5454';                       // brighter blood-red for validation errors (lifted from #c13030 for legibility)
export const PAPER = '#070605';                          // page = charcoal black
export const PAPER_HIGHLIGHT = 'rgba(199,154,58,0.10)';  // ember "found page" wash
export const PAPER_WASH = 'rgba(232,226,212,0.04)';      // bone-soft "locked page" wash
export const PAPER_RULE = 'rgba(232,226,212,0.18)';
export const PAPER_RULE_STRONG = 'rgba(232,226,212,0.32)';
export const GOLD = '#d68a3a';                           // ember (was bright gold)
export const GOLD_D = '#8a5a18';
export const CREAM = '#e8e2d4';
export const CREAM_DIM = 'rgba(232,226,212,0.6)';
export const CREAM_FAINT = 'rgba(232,226,212,0.32)';
export const BLOOD = '#b21e1e';
export const BLOOD_DEEP = '#7a0f0f';
export const BLOOD_SOFT = 'rgba(178,30,30,0.55)';
// Brighter blood for *text* — dried-blood `BLOOD` (#b21e1e) only hits
// ~2.3:1 contrast on charcoal black, far below WCAG AA. Use `BLOOD_INK`
// for any handText/fillText fill, keep `BLOOD` for strokes/decoration.
export const BLOOD_INK = '#ed5454';

// ── Panel (parchment with foxing and grain) ────────────────────────────

/** The warm multi-stop radial that gives the paper its aged look.
 *  Cached per-size so each modal doesn't rebuild it every frame. Keyed
 *  by both variant and size so the grimoire's dark page doesn't share a
 *  cached gradient with the parchment. */
const paperGradCache = new Map<string, CanvasGradient>();

function paperGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  variant: 'parchment' | 'grimoire' = 'parchment',
): CanvasGradient {
  const key = `${variant}:${w}x${h}`;
  const cached = paperGradCache.get(key);
  if (cached) return cached;
  const g = ctx.createRadialGradient(
    x + w / 2, y - h * 0.1, w * 0.2,
    x + w / 2, y + h * 1.3, Math.max(w, h) * 1.1,
  );
  if (variant === 'grimoire') {
    // Heavy blood-maroon vellum — kept for the curse picker.
    g.addColorStop(0, '#33131b');
    g.addColorStop(0.55, '#1a0a12');
    g.addColorStop(1, '#08030a');
  } else {
    // Charcoal page — solid black with a faint warm lift at the top so
    // the "candle on the table" feel comes through.
    g.addColorStop(0, '#0e0c0a');
    g.addColorStop(0.55, '#070605');
    g.addColorStop(1, '#040303');
  }
  paperGradCache.set(key, g);
  return g;
}

/** Offscreen noise tile used as the paper grain. Drawn once lazily. */
let grainPattern: CanvasPattern | null = null;
let grainOwner: CanvasRenderingContext2D | null = null;
function ensureGrain(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (grainPattern && grainOwner === ctx) return grainPattern;
  const size = 96;
  const off = document.createElement('canvas');
  off.width = size;
  off.height = size;
  const g = off.getContext('2d');
  if (!g) return null;
  // Cheap multi-octave noise — two passes of random dots at different
  // scales. Each dot is a warm brown with low alpha, which, when drawn
  // under `multiply`, darkens parchment just enough to look fibrous.
  const img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random();
    // Heavy weighting at low values so most pixels are neutral and only a
    // sparse speckle gets darkened.
    const v = n < 0.85 ? 0 : Math.floor((n - 0.85) * 255 * 1.5);
    img.data[i] = 50;
    img.data[i + 1] = 40;
    img.data[i + 2] = 25;
    img.data[i + 3] = v;
  }
  g.putImageData(img, 0, 0);
  grainPattern = ctx.createPattern(off, 'repeat');
  grainOwner = ctx;
  return grainPattern;
}

/** Palette for each modal panel skin. "parchment" is the default menu
 *  aesthetic (warm vellum, ink text, gold accents). "grimoire" is the
 *  dark evil-book variant used by the curse picker. */
interface PanelSkin {
  dimBackdrop: string;
  foxTopColor: string;   // top-left corner radial (the "warm" side)
  foxTopAlpha: number;
  foxBotColor: string;   // bottom-right corner radial (the "cold" side)
  foxBotAlpha: number;
  borderOuter: string;
  borderInner: string;
  ruleColor: string;
  eyebrowColor: string;
  titleColor: string;
  metaLabelColor: string;
  metaValueColor: string;
  closeBorder: string;
  closeFill: string;
  footerColor: string;
  grainAlpha: number;
}

const PARCHMENT_SKIN: PanelSkin = {
  dimBackdrop: 'rgba(0,0,0,0.82)',
  // Dried-blood stain bleeding in from the top-left "spine" corner.
  foxTopColor: 'rgba(178,30,30,1)',
  foxTopAlpha: 0.18,
  // Charred void at bottom-right.
  foxBotColor: 'rgba(0,0,0,1)',
  foxBotAlpha: 0.55,
  borderOuter: 'rgba(0,0,0,0.85)',
  borderInner: 'rgba(232,226,212,0.10)',
  ruleColor: PAPER_RULE,
  // Eyebrow + meta label use the brighter `BLOOD_INK` so the modal's
  // "THE CHRONICLES" / "FOUND" / "TODAY'S SEED" labels stay legible on
  // charcoal black. Foxing + close-button borders stay deep dried blood.
  eyebrowColor: 'rgba(237, 84, 84, 0.92)',
  titleColor: INK,
  metaLabelColor: 'rgba(237, 84, 84, 0.85)',
  metaValueColor: INK,
  closeBorder: 'rgba(178,30,30,0.55)',
  closeFill: 'rgba(232,226,212,0.85)',
  footerColor: 'rgba(232,226,212,0.55)',
  grainAlpha: 0.18,
};

const GRIMOIRE_SKIN: PanelSkin = {
  dimBackdrop: 'rgba(2,0,2,0.85)',
  // Scorch + blood bleed at the corners.
  foxTopColor: 'rgba(160, 20, 40, 1)',
  foxTopAlpha: 0.28,
  foxBotColor: 'rgba(0,0,0,1)',
  foxBotAlpha: 0.55,
  borderOuter: 'rgba(0,0,0,0.8)',
  borderInner: 'rgba(160, 30, 40, 0.25)',
  ruleColor: 'rgba(160, 30, 40, 0.35)',
  // Brighter blood-red for grimoire eyebrows + title — the curse picker
  // is the loudest modal but its labels were the hardest to read.
  eyebrowColor: 'rgba(237, 84, 84, 0.95)',
  titleColor: '#ed5454',
  metaLabelColor: 'rgba(237, 84, 84, 0.85)',
  metaValueColor: '#e8d8c8',
  closeBorder: 'rgba(160, 30, 40, 0.55)',
  closeFill: 'rgba(200, 60, 70, 0.85)',
  footerColor: 'rgba(200, 180, 160, 0.55)',
  grainAlpha: 0.45,
};

/** Draw the full modal chrome: dimmed backdrop, parchment panel, title
 *  ribbon with eyebrow + meta + close, footer with small-caps hint.
 *  Returns the inner content rect plus the close button rect. */
export function drawModalPanel(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  title: string,
  footer: FooterChunk[],
  options?: {
    eyebrow?: string;                // small-caps text above the title ("THE CHRONICLES")
    meta?: { label: string; value: string };   // top-right block
    panelW?: number;                 // override panel dimensions
    panelH?: number;
    variant?: 'parchment' | 'grimoire';
  },
): { inner: Rect; close: Rect; panel: Rect } {
  const eyebrow = options?.eyebrow ?? 'The Chronicles';
  const panelW = Math.min(options?.panelW ?? 720, w - 60);
  const panelH = Math.min(options?.panelH ?? 520, h - 60);
  const panelX = (w - panelW) / 2;
  const panelY = (h - panelH) / 2;
  const variant = options?.variant ?? 'parchment';
  const skin = variant === 'grimoire' ? GRIMOIRE_SKIN : PARCHMENT_SKIN;

  ctx.save();

  // Dimmed backdrop.
  ctx.fillStyle = skin.dimBackdrop;
  ctx.fillRect(0, 0, w, h);

  // Deep drop shadow under the panel.
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#0a0b14';
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.restore();

  // Page body — variant-specific radial.
  ctx.fillStyle = paperGradient(ctx, panelX, panelY, panelW, panelH, variant);
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // Corner foxing (parchment) / scorching (grimoire) at top-left and
  // bottom-right.
  const topFox = ctx.createRadialGradient(panelX, panelY, 0, panelX, panelY, 180);
  topFox.addColorStop(0, withAlpha(skin.foxTopColor, skin.foxTopAlpha));
  topFox.addColorStop(1, withAlpha(skin.foxTopColor, 0));
  ctx.fillStyle = topFox;
  ctx.fillRect(panelX, panelY, 180, 180);

  const botFox = ctx.createRadialGradient(
    panelX + panelW, panelY + panelH, 0,
    panelX + panelW, panelY + panelH, 220,
  );
  botFox.addColorStop(0, withAlpha(skin.foxBotColor, skin.foxBotAlpha));
  botFox.addColorStop(1, withAlpha(skin.foxBotColor, 0));
  ctx.fillStyle = botFox;
  ctx.fillRect(panelX + panelW - 220, panelY + panelH - 220, 220, 220);

  // Grain multiplied over the page.
  const grain = ensureGrain(ctx);
  if (grain) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = skin.grainAlpha;
    ctx.fillStyle = grain;
    ctx.fillRect(panelX, panelY, panelW, panelH);
    ctx.restore();
  }

  // Charcoal hand-drawn panel border (parchment variant) or grimoire-style
  // multi-pass border. The grimoire keeps a single math border because its
  // page already has scorched corners doing the work.
  if (variant === 'grimoire') {
    ctx.strokeStyle = skin.borderOuter;
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
    ctx.strokeStyle = skin.borderInner;
    ctx.strokeRect(panelX + 1.5, panelY + 1.5, panelW - 3, panelH - 3);
  } else {
    handRect(ctx, panelX, panelY, panelW, panelH, {
      seed: 9501,
      jitter: 1.4,
      samplesPerSide: 22,
      stroke: 'rgba(232,226,212,0.85)',
      strokeWidth: 1.1,
      passes: 1,
      opacity: 0.85,
    });
    // Faint dried-blood drip down the spine — matches the in-run HUD's
    // signature accent so menus and HUD feel like the same notebook.
    handLine(
      ctx,
      panelX + 3,
      panelY + 8,
      panelX + 3,
      panelY + panelH - 8,
      {
        seed: 9510,
        jitter: 0.9,
        samples: 18,
        stroke: '#b21e1e',
        strokeWidth: 1.4,
        opacity: 0.55,
      },
    );
    // Corner ritual marks for the parchment variant — small red elbow
    // strokes at each corner like the lore note card.
    const marks: Array<[number, number, number, number]> = [
      [panelX, panelY, 14, 14],
      [panelX + panelW, panelY, -14, 14],
      [panelX, panelY + panelH, 14, -14],
      [panelX + panelW, panelY + panelH, -14, -14],
    ];
    for (let i = 0; i < marks.length; i++) {
      const [cx, cy, dx, dy] = marks[i];
      handLine(ctx, cx, cy, cx + dx, cy, {
        seed: 9520 + i * 2,
        jitter: 0.4,
        samples: 4,
        stroke: '#b21e1e',
        strokeWidth: 0.9,
        opacity: 0.55,
      });
      handLine(ctx, cx, cy, cx, cy + dy, {
        seed: 9521 + i * 2,
        jitter: 0.4,
        samples: 4,
        stroke: '#b21e1e',
        strokeWidth: 0.9,
        opacity: 0.55,
      });
    }
  }

  // ── Title ribbon (top 84px) ───────────────────────────────────────
  const ribbonH = 84;
  if (variant === 'grimoire') {
    ctx.strokeStyle = skin.ruleColor;
    ctx.beginPath();
    ctx.moveTo(panelX, panelY + ribbonH);
    ctx.lineTo(panelX + panelW, panelY + ribbonH);
    ctx.stroke();
  } else {
    handLine(ctx, panelX + 12, panelY + ribbonH, panelX + panelW - 12, panelY + ribbonH, {
      seed: 9530,
      jitter: 0.9,
      samples: 28,
      stroke: 'rgba(232,226,212,0.45)',
      strokeWidth: 0.7,
    });
  }

  // Eyebrow.
  ctx.fillStyle = skin.eyebrowColor;
  ctx.font = `600 9.5px ${UI_FONTS.ui}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  drawSmallCaps(ctx, eyebrow, panelX + 24, panelY + 20, 0.32);
  (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = '0px';

  // Title.
  ctx.fillStyle = skin.titleColor;
  ctx.font = `italic 700 32px ${UI_FONTS.serif}`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, panelX + 24, panelY + 66);

  // Meta block on the right (optional).
  const closeSize = 22;
  const closeX = panelX + panelW - 24 - closeSize;
  const closeY = panelY + 24;
  if (options?.meta) {
    ctx.fillStyle = skin.metaLabelColor;
    ctx.font = `600 9.5px ${UI_FONTS.ui}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    drawSmallCapsRight(ctx, options.meta.label, closeX - 12, panelY + 26, 0.22);
    ctx.fillStyle = skin.metaValueColor;
    ctx.font = `700 15px ${UI_FONTS.mono}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(options.meta.value, closeX - 12, panelY + 62);
  }

  // Close × in a thin bordered square.
  ctx.save();
  ctx.strokeStyle = skin.closeBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(closeX + 0.5, closeY + 0.5, closeSize - 1, closeSize - 1);
  ctx.fillStyle = skin.closeFill;
  ctx.font = `500 16px ${UI_FONTS.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u00d7', closeX + closeSize / 2, closeY + closeSize / 2 + 1);
  ctx.restore();

  // ── Footer (bottom 36px) ──────────────────────────────────────────
  const footerH = 36;
  if (variant === 'grimoire') {
    ctx.strokeStyle = skin.ruleColor;
    ctx.beginPath();
    ctx.moveTo(panelX, panelY + panelH - footerH);
    ctx.lineTo(panelX + panelW, panelY + panelH - footerH);
    ctx.stroke();
  } else {
    handLine(
      ctx,
      panelX + 12,
      panelY + panelH - footerH,
      panelX + panelW - 12,
      panelY + panelH - footerH,
      {
        seed: 9540,
        jitter: 0.8,
        samples: 28,
        stroke: 'rgba(232,226,212,0.32)',
        strokeWidth: 0.6,
      },
    );
  }
  drawFooterChunks(
    ctx,
    panelX + 24,
    panelY + panelH - footerH / 2,
    footer,
    skin.footerColor,
  );

  ctx.restore();

  const inner: Rect = {
    x: panelX,
    y: panelY + ribbonH,
    w: panelW,
    h: panelH - ribbonH - footerH,
  };
  return {
    inner,
    close: { x: closeX, y: closeY, w: closeSize, h: closeSize },
    panel: { x: panelX, y: panelY, w: panelW, h: panelH },
  };
}

// ── Footer chunks (text + inline keycaps) ──────────────────────────────

export type FooterChunk =
  | { kind: 'text'; text: string }
  | { kind: 'kbd'; text: string };

/** Shortcut for the common "text · <kbd>K</kbd> / <kbd>L</kbd> to close" hint. */
export function footerLine(parts: (string | { kbd: string })[]): FooterChunk[] {
  return parts.map((p) =>
    typeof p === 'string'
      ? { kind: 'text' as const, text: p }
      : { kind: 'kbd' as const, text: p.kbd },
  );
}

function drawFooterChunks(
  ctx: CanvasRenderingContext2D,
  x: number,
  yMid: number,
  chunks: FooterChunk[],
  color = 'rgba(232,226,212,0.6)',
) {
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  let cx = x;
  ctx.fillStyle = color;
  ctx.font = `500 10.5px ${UI_FONTS.ui}`;
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  for (const chunk of chunks) {
    if (chunk.kind === 'text') {
      c.letterSpacing = '0.08em';
      const upper = chunk.text;
      ctx.fillStyle = color;
      ctx.fillText(upper, cx, yMid);
      cx += ctx.measureText(upper).width + 2;
    } else {
      c.letterSpacing = '0px';
      cx = drawKbd(ctx, cx, yMid, chunk.text) + 2;
    }
  }
  c.letterSpacing = '0px';
  ctx.restore();
}

/** Force a color literal to a given alpha, tolerating both `#RRGGBB` and
 *  `rgba(r,g,b,a)` inputs. Used by the foxing radials so both parchment
 *  and grimoire panels can express their "soft to fully transparent"
 *  stops through the same API. */
function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('rgba(')) {
    // Replace the existing alpha component.
    const match = color.match(/^rgba\(([^)]+)\)$/);
    if (!match) return color;
    const parts = match[1].split(',').map((s) => s.trim());
    if (parts.length < 3) return color;
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

/** Tiny keycap pill rendered inline with text. Returns the x after the
 *  keycap so the caller can continue typesetting. */
export function drawKbd(
  ctx: CanvasRenderingContext2D,
  x: number,
  yMid: number,
  label: string,
): number {
  const prevFont = ctx.font;
  const prevFill = ctx.fillStyle;
  ctx.font = `500 10px ${UI_FONTS.mono}`;
  const tw = ctx.measureText(label).width;
  const padX = 5;
  const padY = 3;
  const w = Math.max(14, Math.ceil(tw) + padX * 2);
  const h = 16;
  const y = yMid - h / 2;
  // Dark-tinted keycap for charcoal modals.
  ctx.fillStyle = 'rgba(232,226,212,0.06)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(232,226,212,0.32)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, yMid + 0.5);
  ctx.textAlign = 'left';
  ctx.font = prevFont;
  ctx.fillStyle = prevFill;
  void padY;
  return x + w;
}

/** Dark-theme keycap for use on the title screen (cream on night). */
export function drawKbdDark(
  ctx: CanvasRenderingContext2D,
  x: number,
  yMid: number,
  label: string,
): number {
  const prevFont = ctx.font;
  const prevFill = ctx.fillStyle;
  ctx.font = `500 11px ${UI_FONTS.mono}`;
  const tw = ctx.measureText(label).width;
  const w = Math.max(18, Math.ceil(tw) + 12);
  const h = 18;
  const y = yMid - h / 2;
  ctx.fillStyle = 'rgba(234,223,196,0.08)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(234,223,196,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = CREAM;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, yMid + 0.5);
  ctx.textAlign = 'left';
  ctx.font = prevFont;
  ctx.fillStyle = prevFill;
  return x + w;
}

// ── Small-caps helpers ────────────────────────────────────────────────

export function drawSmallCaps(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking = 0.22,
) {
  const upper = text.toUpperCase();
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = c.letterSpacing;
  c.letterSpacing = `${tracking}em`;
  ctx.fillText(upper, x, y);
  c.letterSpacing = prev ?? '0px';
}

export function drawSmallCapsCentered(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking = 0.22,
) {
  const prev = ctx.textAlign;
  ctx.textAlign = 'center';
  drawSmallCaps(ctx, text, cx, y, tracking);
  ctx.textAlign = prev;
}

export function drawSmallCapsRight(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking = 0.22,
) {
  const prev = ctx.textAlign;
  ctx.textAlign = 'right';
  drawSmallCaps(ctx, text, x, y, tracking);
  ctx.textAlign = prev;
}

export function drawSmallCapsLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking = 0.22,
) {
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  drawSmallCaps(ctx, text, x, y, tracking);
  ctx.textAlign = prev;
}

// ── Text wrap ──────────────────────────────────────────────────────────

export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxW: number,
  lineH: number,
): number {
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
  if (line) {
    ctx.fillText(line, x, cy);
    cy += lineH;
  }
  return cy;
}

// ── Pill button (used by ModifierPicker + HandlePrompt) ────────────────

export function drawPillButton(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  options?: {
    active?: boolean;
    dim?: boolean;
    hover?: boolean;
    tone?: 'primary' | 'ghost' | 'grim-primary' | 'grim-ghost';
  },
): Rect {
  ctx.save();
  const active = options?.active ?? false;
  const hover = options?.hover ?? false;
  const dim = options?.dim ?? false;
  const tone = options?.tone ?? (active ? 'primary' : 'ghost');
  if (tone === 'primary' && !dim) {
    // Charcoal slab with a dried-blood border and warm ember inner glow.
    // Replaces the previous gold fill so primary buttons match the
    // overall charcoal-on-black aesthetic.
    const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
    bodyGrad.addColorStop(0, hover ? '#1a0e08' : '#120a06');
    bodyGrad.addColorStop(1, '#050302');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = hover ? 'rgba(214,138,58,0.3)' : 'rgba(214,138,58,0.16)';
    ctx.fillRect(x + 2, y + 2, w - 4, 4);
    handRect(ctx, x, y, w, h, {
      seed: Math.round(x * 13 + y * 7),
      jitter: 0.7,
      samplesPerSide: 12,
      stroke: hover ? '#d68a3a' : '#8a5a18',
      strokeWidth: 1.3,
      passes: 1,
    });
    ctx.fillStyle = '#ffd9a6';
  } else if (tone === 'grim-primary' && !dim) {
    // Obsidian slab with a blood-red border and a subtle inner glow —
    // the grimoire's way of saying "commit to the curse."
    const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
    bodyGrad.addColorStop(0, hover ? '#1a0208' : '#120106');
    bodyGrad.addColorStop(1, '#050002');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x, y, w, h);
    // Inner warm red glow just under the top edge.
    ctx.fillStyle = hover ? 'rgba(200, 30, 40, 0.25)' : 'rgba(200, 30, 40, 0.12)';
    ctx.fillRect(x + 2, y + 2, w - 4, 4);
    // Blood-red border.
    ctx.strokeStyle = hover ? '#c13030' : '#7a1a20';
    ctx.lineWidth = 1.25;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = '#f2b090';
  } else if (tone === 'grim-ghost') {
    // Hollow button on the grimoire page — faint blood outline.
    ctx.fillStyle = hover ? 'rgba(120, 20, 30, 0.25)' : 'transparent';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = dim ? 'rgba(120, 20, 30, 0.25)' : 'rgba(160, 30, 40, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = dim ? 'rgba(200, 160, 140, 0.35)' : 'rgba(232, 200, 180, 0.8)';
  } else {
    // Ghost / neutral button on charcoal page — bone outline, hover wash.
    ctx.fillStyle = hover ? 'rgba(232,226,212,0.08)' : 'transparent';
    ctx.fillRect(x, y, w, h);
    handRect(ctx, x, y, w, h, {
      seed: Math.round(x * 11 + y * 5),
      jitter: 0.6,
      samplesPerSide: 12,
      stroke: dim ? 'rgba(232,226,212,0.2)' : 'rgba(232,226,212,0.5)',
      strokeWidth: 1,
      passes: 1,
    });
    ctx.fillStyle = dim ? 'rgba(232,226,212,0.3)' : 'rgba(232,226,212,0.85)';
  }
  const isPrimary = tone === 'primary' || tone === 'grim-primary';
  ctx.font = `${isPrimary ? 700 : 600} 11.5px ${UI_FONTS.ui}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  drawSmallCapsCentered(ctx, label, x + w / 2, y + h / 2 + 1, 0.22);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
  return { x, y, w, h };
}

/** Small five-point star (pentagram) traced along its circumscribed
 *  circle. Used as the grimoire's "selected curse" sigil. */
export function drawPentagram(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  stroke: string,
  fill: string | null = null,
  lineWidth = 1.2,
) {
  const pts: [number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const theta = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    pts.push([cx + Math.cos(theta) * r, cy + Math.sin(theta) * r]);
  }
  // Draw a star polygon by connecting every other vertex.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= 5; i++) {
    const n = (i * 2) % 5;
    ctx.lineTo(pts[n][0], pts[n][1]);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill('evenodd');
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

// ── Cipher title (encrypted-looking runes for locked entries) ─────────

/** A curated set of "hieroglyph-ish" glyphs. Runes dominate the pool so
 *  the whole string reads as a single ciphered inscription; a handful
 *  of alchemical and arcane marks break up the repetition. */
const CIPHER_GLYPHS = [
  '\u16A0', '\u16A2', '\u16A6', '\u16A8', '\u16B1', '\u16B2', '\u16B7', '\u16B9',
  '\u16BA', '\u16BE', '\u16C1', '\u16C3', '\u16C7', '\u16C8', '\u16C9', '\u16CA',
  '\u16CF', '\u16D2', '\u16D6', '\u16D7', '\u16DA', '\u16DC', '\u16DF', '\u16DE',
  '\u263F', '\u2644', '\u269A', '\u269C', '\u27D0', '\u27C1',
];

/** Deterministic hash so the same real title always produces the same
 *  cipher. Avoids a locked entry "scrambling itself" every frame. */
function stableHash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

/** Build a short, variable-length cipher string from the real title.
 *  Length scales with the real text (longer name → longer rune string)
 *  but is capped at 9 so diary titles like "The Scribe's diary · Night
 *  3" don't banner-fill the row. Minimum 3 so even one-word names
 *  read as "a word." */
function cipherGlyphs(text: string): string {
  const len = Math.max(3, Math.min(9, Math.round(text.replace(/\s+/g, '').length / 3)));
  let h = stableHash(text);
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    // xorshift step so each glyph feels independent.
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h = h >>> 0;
    out.push(CIPHER_GLYPHS[h % CIPHER_GLYPHS.length]);
  }
  return out.join(' ');
}

/** Draw a ciphered placeholder for a locked title. Same call signature
 *  as the old star-based version — callers don't change. */
export function drawCipherTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size = 22,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(214,138,58,0.45)';
  ctx.font = `600 ${size}px ${UI_FONTS.serif}`;
  ctx.textBaseline = 'top';
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  const prev = c.letterSpacing;
  c.letterSpacing = '0.14em';
  ctx.fillText(cipherGlyphs(text), x, y);
  c.letterSpacing = prev ?? '0px';
  ctx.restore();
}

// ── Sigil (Achievements medallion) ─────────────────────────────────────

/** Filled sigil: gold disc with four-point star inlay. Locked sigil:
 *  dashed ring with a small ink dot in the centre. */
export function drawSigil(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  filled: boolean,
) {
  const r = size / 2;
  if (filled) {
    // Outer ring.
    ctx.save();
    ctx.strokeStyle = GOLD_D;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();

    // Filled disc with radial highlight.
    const g = ctx.createRadialGradient(cx - r * 0.25, cy - r * 0.2, 0, cx, cy, r - 3);
    g.addColorStop(0, '#ffe082');
    g.addColorStop(0.6, GOLD);
    g.addColorStop(1, GOLD_D);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    ctx.fill();

    // Four-point star in warm ink.
    ctx.fillStyle = 'rgba(107,74,26,0.7)';
    ctx.beginPath();
    const s = r - 5;
    ctx.moveTo(cx, cy - s);
    ctx.lineTo(cx + s * 0.22, cy - s * 0.22);
    ctx.lineTo(cx + s, cy);
    ctx.lineTo(cx + s * 0.22, cy + s * 0.22);
    ctx.lineTo(cx, cy + s);
    ctx.lineTo(cx - s * 0.22, cy + s * 0.22);
    ctx.lineTo(cx - s, cy);
    ctx.lineTo(cx - s * 0.22, cy - s * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else {
    ctx.save();
    ctx.strokeStyle = 'rgba(232,226,212,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Pinpoint.
    ctx.fillStyle = 'rgba(232,226,212,0.25)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Pin-hole (Codex locked card marker) ────────────────────────────────

export function drawPinHole(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size = 12,
) {
  const r = size / 2;
  ctx.save();
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  g.addColorStop(0, '#4a3a22');
  g.addColorStop(0.5, '#2a2012');
  g.addColorStop(1, '#1a140a');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(111,78,36,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

// ── Endless-mode victory choice ────────────────────────────────────────

export function drawEndlessChoiceOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mouseX: number,
  mouseY: number,
): { returnBtn: Rect; continueBtn: Rect } {
  // Soft vignette behind the card.
  ctx.save();
  const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7);
  bg.addColorStop(0, 'rgba(6,7,14,0.25)');
  bg.addColorStop(0.6, 'rgba(6,7,14,0.75)');
  bg.addColorStop(1, 'rgba(6,7,14,0.9)');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  const { inner, close } = drawModalPanel(
    ctx,
    w,
    h,
    'The tenth sun has risen.',
    footerLine(['\u2190 to return', '  ', '\u2192 to press on']),
    { eyebrow: 'Victory', panelW: 560, panelH: 260 },
  );

  // Prompt body centred in the inner region.
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `italic 600 18px ${UI_FONTS.serif}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    'Return to the menu — or press into the dark?',
    inner.x + inner.w / 2,
    inner.y + 18,
  );

  ctx.fillStyle = INK_DIM;
  ctx.font = `italic 500 13px ${UI_FONTS.serif}`;
  ctx.fillText(
    'Choosing endless forsakes the win. The campfire stops counting.',
    inner.x + inner.w / 2,
    inner.y + 46,
  );
  ctx.restore();

  // Two buttons at the bottom of the inner rect.
  const btnW = 200;
  const btnH = 40;
  const btnY = inner.y + inner.h - btnH - 14;
  const returnX = inner.x + 18;
  const continueX = inner.x + inner.w - btnW - 18;
  const returnHover =
    mouseX >= returnX && mouseX <= returnX + btnW && mouseY >= btnY && mouseY <= btnY + btnH;
  const contHover =
    mouseX >= continueX && mouseX <= continueX + btnW && mouseY >= btnY && mouseY <= btnY + btnH;
  drawPillButton(ctx, returnX, btnY, btnW, btnH, 'Return to menu', {
    hover: returnHover,
  });
  drawPillButton(ctx, continueX, btnY, btnW, btnH, 'Press into the dark', {
    active: true,
    tone: 'primary',
    hover: contHover,
  });

  // `close` rect is exposed from drawModalPanel but we also render it on
  // behalf of the caller: clicking it counts as "return to menu".
  void close;
  return {
    returnBtn: { x: returnX, y: btnY, w: btnW, h: btnH },
    continueBtn: { x: continueX, y: btnY, w: btnW, h: btnH },
  };
}

// Re-export so individual modals import from one place.
export { UI_COLORS, UI_FONTS };
