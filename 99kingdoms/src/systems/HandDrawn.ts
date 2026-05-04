// Charcoal-brush hand-drawn primitives, ported from the design package.
// Every line, rect, and circle is built from a stable per-element `seed`
// so it doesn't shimmer between frames — geometric jitter is deterministic.
//
// Style notes:
//   * Lines are rendered as a heavy base stroke + 1–2 thinner offset
//     overlays + scattered short "drag" specks for charcoal grit.
//   * Rectangles render their four sides as separate hand lines, so
//     corners feel placed by hand rather than mathematically square.
//   * Circles sample wobbly polar coordinates and add radial drag specks.
//   * CrossHatch fills a rect with diagonal hand-drawn hatching, clipped.
//   * HandText jitters per-character rotation/y so glyphs feel inked.
//
// Performance: each call walks a few dozen sample points and draws ~3–5
// path strokes. Fine for the HUD which redraws once per frame.

// ── Charcoal Ritual + Bloodletting palette ────────────────────────────
export const CHARCOAL = {
  bg: '#070605',
  paper: '#0c0a09',
  ink: '#e8e2d4',
  ink2: '#fff8e8',
  inkDim: 'rgba(232, 226, 212, 0.55)',
  inkFaint: 'rgba(232, 226, 212, 0.32)',
  accent: '#b21e1e',
  accent2: '#7a0f0f',
  accentSoft: 'rgba(178, 30, 30, 0.55)',
  // Brighter blood red specifically for *text* — `accent` (#b21e1e) only
  // hits ~2.3:1 contrast on charcoal black, well below WCAG AA (4.5:1).
  // `bloodInk` brings text up to ~5:1 while still reading as blood
  // rather than fire. Use for handText fills; keep `accent` for strokes
  // (corner marks, dividers, drips, splatters) where the eye reads it
  // as decorative texture, not language.
  bloodInk: '#ed5454',
  ember: '#d68a3a',
  coin: '#c79a3a',
  danger: '#ff2a1f',
} as const;

export const CHARCOAL_FONTS = {
  serif: "'Cormorant Garamond', 'Iowan Old Style', Georgia, serif",
  mono: "'Special Elite', 'JetBrains Mono', ui-monospace, monospace",
};

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    let t = (s += 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Wobbly path samplers ──────────────────────────────────────────────
function sampleWobblyLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  jitter: number,
  samples: number,
  rng: () => number,
): Array<[number, number]> {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const pts: Array<[number, number]> = [[x1, y1]];
  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const ox = x1 + dx * t;
    const oy = y1 + dy * t;
    // Taper the jitter at the endpoints so corners stay aligned.
    const taper = Math.sin(t * Math.PI);
    const j = (rng() - 0.5) * 2 * jitter * taper;
    pts.push([ox + nx * j, oy + ny * j]);
  }
  return pts;
}

function strokePoly(
  ctx: CanvasRenderingContext2D,
  pts: Array<[number, number]>,
): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

// ── HandLine ──────────────────────────────────────────────────────────
export interface HandLineOptions {
  jitter?: number;
  samples?: number;
  seed?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  dash?: [number, number] | null;
  charcoal?: boolean;
}

/** Charcoal-brush line. Heavy base stroke + thin offset overlays + drag
 *  fragment specks. Set `charcoal: false` for a single clean wobbly line
 *  (used for dashed dividers). */
export function handLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: HandLineOptions = {},
): void {
  const {
    jitter = 1.5,
    samples = 12,
    seed = 1,
    stroke = '#fff',
    strokeWidth = 1.5,
    opacity = 1,
    dash = null,
    charcoal = true,
  } = options;

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.strokeStyle = stroke;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const basePts = sampleWobblyLine(x1, y1, x2, y2, jitter, samples, mulberry32(seed));

  if (!charcoal || dash) {
    if (dash) ctx.setLineDash(dash);
    ctx.lineWidth = strokeWidth;
    strokePoly(ctx, basePts);
    if (dash) ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  // Heavy base.
  ctx.lineWidth = strokeWidth;
  ctx.globalAlpha *= 0.92;
  strokePoly(ctx, basePts);

  // Two thinner overlay strokes with shifted seeds.
  ctx.globalAlpha = opacity * 0.5;
  ctx.lineWidth = strokeWidth * 0.55;
  strokePoly(ctx, sampleWobblyLine(x1, y1, x2, y2, jitter * 0.6, samples, mulberry32(seed + 17)));

  ctx.globalAlpha = opacity * 0.35;
  ctx.lineWidth = strokeWidth * 0.35;
  strokePoly(ctx, sampleWobblyLine(x1, y1, x2, y2, jitter * 1.1, samples, mulberry32(seed + 41)));

  // Scattered drag fragments along the path — short broken specks.
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const fragRng = mulberry32(seed + 7919);
  const fragCount = Math.max(2, Math.floor(len / 16));
  for (let i = 0; i < fragCount; i++) {
    if (fragRng() > 0.6) continue;
    const t = fragRng();
    const fx = x1 + dx * t;
    const fy = y1 + dy * t;
    const fl = 1 + fragRng() * 4;
    const off = (fragRng() - 0.5) * jitter * 1.4;
    const sx = fx + nx * off;
    const sy = fy + ny * off;
    const ex = sx + (dx / len) * fl;
    const ey = sy + (dy / len) * fl;
    ctx.globalAlpha = opacity * (0.25 + fragRng() * 0.4);
    ctx.lineWidth = strokeWidth * (0.2 + fragRng() * 0.4);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }

  ctx.restore();
}

// ── HandRect ──────────────────────────────────────────────────────────
export interface HandRectOptions extends HandLineOptions {
  fill?: string | null;
  passes?: number;
  samplesPerSide?: number;
}

/** Charcoal-stroked rectangle. Each side is rendered as a HandLine, so
 *  corners look hand-placed. Optional fill is drawn first as a single
 *  closed wobbly path. */
export function handRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  options: HandRectOptions = {},
): void {
  const {
    jitter = 1.5,
    seed = 1,
    stroke = '#fff',
    strokeWidth = 1.5,
    opacity = 1,
    fill = null,
    passes = 1,
    samplesPerSide = 10,
    dash = null,
    charcoal = true,
  } = options;

  ctx.save();
  ctx.globalAlpha *= opacity;

  if (fill) {
    // Wobbly closed path for the fill — one rng walk over all four sides.
    const rng = mulberry32(seed);
    const sides: Array<[number, number, number, number]> = [
      [x, y, x + w, y],
      [x + w, y, x + w, y + h],
      [x + w, y + h, x, y + h],
      [x, y + h, x, y],
    ];
    ctx.beginPath();
    let started = false;
    for (const [sx, sy, ex, ey] of sides) {
      const pts = sampleWobblyLine(sx, sy, ex, ey, jitter, samplesPerSide, rng);
      for (const [px, py] of pts) {
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
      }
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= opacity;

  // Stroke each side as a HandLine for the brush feel.
  const sides: Array<[number, number, number, number, number]> = [
    [x, y, x + w, y, 1],
    [x + w, y, x + w, y + h, 2],
    [x + w, y + h, x, y + h, 3],
    [x, y + h, x, y, 4],
  ];
  for (let p = 0; p < passes; p++) {
    const passOpacity = p === 0 ? 1 : 0.5;
    const passJitter = jitter * (p === 0 ? 1 : 1.2);
    const passWidth = strokeWidth * (p === 0 ? 1 : 0.7);
    for (const [x1, y1, x2, y2, sIdx] of sides) {
      handLine(ctx, x1, y1, x2, y2, {
        jitter: passJitter,
        samples: samplesPerSide,
        seed: seed + p * 1337 + sIdx * 71,
        stroke,
        strokeWidth: passWidth,
        opacity: passOpacity,
        dash,
        charcoal,
      });
    }
  }
  ctx.restore();
}

// ── HandCircle ────────────────────────────────────────────────────────
export interface HandCircleOptions {
  jitter?: number;
  samples?: number;
  seed?: number;
  stroke?: string;
  strokeWidth?: number;
  opacity?: number;
  fill?: string | null;
  passes?: number;
  charcoal?: boolean;
}

export function handCircle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  options: HandCircleOptions = {},
): void {
  const {
    jitter = 1.5,
    samples = 28,
    seed = 1,
    stroke = '#fff',
    strokeWidth = 1.5,
    opacity = 1,
    fill = null,
    passes = 1,
    charcoal = true,
  } = options;

  const buildPoly = (s: number, jit: number): Array<[number, number]> => {
    const rng = mulberry32(s);
    const pts: Array<[number, number]> = [];
    for (let i = 0; i <= samples; i++) {
      const a = (i / samples) * Math.PI * 2;
      const rj = r + (rng() - 0.5) * 2 * jit;
      pts.push([cx + Math.cos(a) * rj, cy + Math.sin(a) * rj]);
    }
    return pts;
  };

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke;

  const basePts = buildPoly(seed, jitter);
  if (fill) {
    ctx.beginPath();
    ctx.moveTo(basePts[0][0], basePts[0][1]);
    for (let i = 1; i < basePts.length; i++) ctx.lineTo(basePts[i][0], basePts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  if (!charcoal) {
    ctx.lineWidth = strokeWidth;
    strokePoly(ctx, basePts);
    for (let p = 1; p < passes; p++) {
      ctx.globalAlpha = opacity * 0.6;
      strokePoly(ctx, buildPoly(seed + p * 977, jitter));
    }
    ctx.restore();
    return;
  }

  // Heavy base + 2 overlay arcs + radial drag specks.
  ctx.globalAlpha = opacity * 0.92;
  ctx.lineWidth = strokeWidth;
  strokePoly(ctx, basePts);

  ctx.globalAlpha = opacity * 0.55;
  ctx.lineWidth = strokeWidth * 0.55;
  strokePoly(ctx, buildPoly(seed + 17, jitter * 0.7));

  ctx.globalAlpha = opacity * 0.35;
  ctx.lineWidth = strokeWidth * 0.35;
  strokePoly(ctx, buildPoly(seed + 41, jitter * 1.2));

  for (let p = 1; p < passes; p++) {
    ctx.globalAlpha = opacity * 0.4;
    ctx.lineWidth = strokeWidth * 0.5;
    strokePoly(ctx, buildPoly(seed + (p + 1) * 977, jitter * 1.1));
  }

  // Radial drag specks.
  const fragRng = mulberry32(seed + 99);
  const fragCount = Math.max(6, Math.floor(r * 0.6));
  for (let i = 0; i < fragCount; i++) {
    if (fragRng() > 0.55) continue;
    const a = fragRng() * Math.PI * 2;
    const off = (fragRng() - 0.5) * jitter * 1.6;
    const rr = r + off;
    const len = 1 + fragRng() * 3;
    const sx = cx + Math.cos(a) * rr;
    const sy = cy + Math.sin(a) * rr;
    const tx = -Math.sin(a) * len;
    const ty = Math.cos(a) * len;
    ctx.globalAlpha = opacity * (0.25 + fragRng() * 0.4);
    ctx.lineWidth = strokeWidth * (0.2 + fragRng() * 0.4);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + tx, sy + ty);
    ctx.stroke();
  }

  ctx.restore();
}

// ── CrossHatch ────────────────────────────────────────────────────────

/** Diagonal hand-drawn hatching clipped to a rect. Used to fill HP bars,
 *  progress bars, and shaded card panels. Each line is wobbly and
 *  charcoal-thin so the fill reads as "shaded by hand", not solid. */
export function crossHatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  options: {
    spacing?: number;
    angle?: number;
    jitter?: number;
    seed?: number;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    double?: boolean;
  } = {},
): void {
  const {
    spacing = 6,
    angle = 35,
    jitter = 1,
    seed = 1,
    stroke = '#fff',
    strokeWidth = 0.8,
    opacity = 0.6,
    double = false,
  } = options;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();

  ctx.globalAlpha *= opacity;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = 'round';

  const rad = (angle * Math.PI) / 180;
  const diag = Math.hypot(w, h) + spacing * 2;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const passes: Array<{ axisCos: number; axisSin: number; alpha: number }> = [
    { axisCos: cos, axisSin: sin, alpha: 1 },
  ];
  if (double) passes.push({ axisCos: -sin, axisSin: cos, alpha: 0.7 });

  const rng = mulberry32(seed);
  for (const pass of passes) {
    ctx.globalAlpha = opacity * pass.alpha;
    for (let off = -diag / 2; off <= diag / 2; off += spacing) {
      const x1 = cx + pass.axisCos * off - pass.axisSin * (diag / 2);
      const y1 = cy + pass.axisSin * off + pass.axisCos * (diag / 2);
      const x2 = cx + pass.axisCos * off + pass.axisSin * (diag / 2);
      const y2 = cy + pass.axisSin * off - pass.axisCos * (diag / 2);
      const pts = sampleWobblyLine(x1, y1, x2, y2, jitter, 8, rng);
      strokePoly(ctx, pts);
    }
  }

  ctx.restore();
}

// ── HandText ──────────────────────────────────────────────────────────

/** Per-character rotation/y jitter so a text line feels inked by hand.
 *  Use for headings, labels, and big phase callouts — anywhere the
 *  static crispness of system text would feel out of place. */
export function handText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    seed?: number;
    jitter?: number;
    fontSize?: number;
    font?: string;
    fill?: string;
    opacity?: number;
    align?: CanvasTextAlign;
    weight?: number;
    italic?: boolean;
    letterSpacing?: number;
  } = {},
): void {
  const {
    seed = 1,
    jitter = 0.6,
    fontSize = 12,
    font = CHARCOAL_FONTS.mono,
    fill = CHARCOAL.ink,
    opacity = 1,
    align = 'start',
    weight = 500,
    italic = false,
    letterSpacing = 0,
  } = options;

  ctx.save();
  ctx.globalAlpha *= opacity;
  ctx.fillStyle = fill;
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${fontSize}px ${font}`;
  ctx.textBaseline = 'alphabetic';

  // Measure the full string with letter-spacing applied so we can offset
  // for centre / right alignment.
  let totalW = 0;
  const charWidths: number[] = [];
  for (const ch of text) {
    const w = ctx.measureText(ch).width + letterSpacing;
    charWidths.push(w);
    totalW += w;
  }

  let cursorX = x;
  if (align === 'center') cursorX = x - totalW / 2;
  else if (align === 'right' || align === 'end') cursorX = x - totalW;

  const rng = mulberry32(seed);
  ctx.textAlign = 'start';
  let i = 0;
  for (const ch of text) {
    const dy = (rng() - 0.5) * 2 * jitter;
    const rot = (rng() - 0.5) * 2 * jitter * 0.04; // small rotation
    const cw = charWidths[i++];
    const cxChar = cursorX + cw / 2;
    const cyChar = y;
    if (rot !== 0) {
      ctx.save();
      ctx.translate(cxChar, cyChar);
      ctx.rotate(rot);
      ctx.fillText(ch, -cw / 2 + letterSpacing / 2, dy);
      ctx.restore();
    } else {
      ctx.fillText(ch, cursorX, cyChar + dy);
    }
    cursorX += cw;
  }

  ctx.restore();
}

// ── InkSplatter ───────────────────────────────────────────────────────

/** Random irregular blobs scattered around a centre point. Used for
 *  impact fx and dark-ritual decoration around banners. */
export function inkSplatter(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  options: {
    count?: number;
    spread?: number;
    seed?: number;
    color?: string;
    opacity?: number;
    sizeMin?: number;
    sizeMax?: number;
  } = {},
): void {
  const {
    count = 12,
    spread = 30,
    seed = 1,
    color = '#000',
    opacity = 1,
    sizeMin = 0.5,
    sizeMax = 3,
  } = options;
  const rng = mulberry32(seed);
  ctx.save();
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.pow(rng(), 1.6) * spread;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const sz = sizeMin + rng() * (sizeMax - sizeMin);
    const pts = 5 + Math.floor(rng() * 4);
    ctx.globalAlpha = opacity * (0.4 + rng() * 0.6);
    ctx.beginPath();
    for (let k = 0; k <= pts; k++) {
      const aa = (k / pts) * Math.PI * 2;
      const rj = sz * (0.6 + rng() * 0.6);
      const bx = px + Math.cos(aa) * rj;
      const by = py + Math.sin(aa) * rj;
      if (k === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}
