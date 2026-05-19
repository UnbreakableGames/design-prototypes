import type { SlimeVariantId } from '../game/types';

// Each slime keeps the standard half-dome body + standard eyes. Decorations
// layer on top to give each variant a distinct identity.

export interface DecoParams {
  ctx: CanvasRenderingContext2D;
  cx: number;         // body center x
  baseY: number;      // body foot y
  w: number;          // body half-width (after squash)
  h: number;          // body height (after squash)
  body: string;       // base body color
  highlight: string;  // body highlight color
  facing: 1 | -1;
  time: number;       // accumulated bobT for animations
}

export function drawSlimeDecoration(id: SlimeVariantId, p: DecoParams) {
  switch (id) {
    // ============ COMMON ============
    case 'green':   return; // plain — the honest baseline
    case 'sprout':  return drawSproutLeaf(p);
    case 'mudder':  return drawMudBlobs(p);
    case 'twig':    return drawTwig(p);
    case 'mossy':   return drawMossTufts(p);

    // ============ UNCOMMON ============
    case 'purple':  return drawAngryBrow(p);      // Heavy
    case 'amber':   return drawBackpack(p);       // Hauler
    case 'mint':    return drawWings(p);
    case 'cobalt':  return drawKnightHelm(p);

    // ============ RARE ============
    case 'frost':    return drawIceCrown(p);
    case 'magma':    return drawLavaCracks(p);
    case 'storm':    return drawLightningBolt(p);
    case 'sapphire': return drawGemSpikes(p, '#5aaaff');
    case 'emerald':  return drawCrystalFacets(p, '#7fffaa');
    case 'ruby':     return drawGemHorns(p, '#ff5878');

    // ============ EPIC ============
    case 'onyx':     return drawVoidParticles(p, '#9080a0');
    case 'quartz':   return drawPrismaticSparkles(p);
    case 'phantom':  return drawPhantomVeil(p);
    case 'titanium': return drawMetalPlates(p);

    // ============ LEGENDARY ============
    case 'diamond': return drawDiamondCrown(p);
    case 'void':    return drawVoidApex(p);
  }
}

// ===== Commons =====

function drawSproutLeaf({ ctx, cx, baseY, h }: DecoParams) {
  const ty = baseY - h - 1;
  ctx.fillStyle = '#3f8a3a';
  ctx.beginPath();
  ctx.moveTo(cx, ty);
  ctx.quadraticCurveTo(cx + 10, ty - 12, cx + 12, ty - 4);
  ctx.quadraticCurveTo(cx + 3, ty - 3, cx, ty);
  ctx.fill();
  ctx.strokeStyle = '#2a5a26';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx, ty);
  ctx.lineTo(cx + 8, ty - 6);
  ctx.stroke();
}

function drawMudBlobs({ ctx, cx, baseY, w, h, body }: DecoParams) {
  ctx.fillStyle = shade(body, -0.25);
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.4, baseY - h * 0.25, 5, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.25, baseY - h * 0.7, 4, 2.5, -0.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawTwig({ ctx, cx, baseY, h }: DecoParams) {
  const ty = baseY - h - 2;
  ctx.strokeStyle = '#7a5a32';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 2, ty);
  ctx.lineTo(cx + 4, ty - 12);
  ctx.stroke();
  // small branch
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx + 2, ty - 7);
  ctx.lineTo(cx + 8, ty - 9);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawMossTufts({ ctx, cx, baseY, w, h }: DecoParams) {
  ctx.fillStyle = '#5fa64d';
  for (const [dx, dy, r] of [
    [-0.5, -0.85, 4],
    [-0.05, -0.92, 3.2],
    [0.4, -0.78, 3.5],
  ] as Array<[number, number, number]>) {
    ctx.beginPath();
    ctx.arc(cx + w * dx, baseY - h * -dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Uncommons =====

function drawAngryBrow({ ctx, cx, baseY, w, h }: DecoParams) {
  ctx.strokeStyle = '#1a1620';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  const ey = baseY - h * 0.55;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.35, ey - 1);
  ctx.lineTo(cx - w * 0.1, ey + 3);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.35, ey - 1);
  ctx.lineTo(cx + w * 0.1, ey + 3);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

function drawBackpack({ ctx, cx, baseY, w, h }: DecoParams) {
  ctx.fillStyle = '#8a4828';
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.55, baseY - h * 0.4, 7, 9, 0.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a2818';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.55 - 3, baseY - h * 0.55);
  ctx.lineTo(cx - w * 0.55 + 3, baseY - h * 0.55);
  ctx.stroke();
}

function drawWings({ ctx, cx, baseY, w, h, time }: DecoParams) {
  const flap = Math.sin(time * 10) * 0.4 + 0.6;
  ctx.fillStyle = '#e0fff0';
  ctx.strokeStyle = '#5fcfa0';
  ctx.lineWidth = 1.2;
  // left wing
  ctx.beginPath();
  ctx.ellipse(cx - w * 0.85, baseY - h * 0.55, 6, 4 * flap, -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // right wing
  ctx.beginPath();
  ctx.ellipse(cx + w * 0.85, baseY - h * 0.55, 6, 4 * flap, 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function drawKnightHelm({ ctx, cx, baseY, w, h }: DecoParams) {
  const ty = baseY - h;
  // dome
  ctx.fillStyle = '#5a6a82';
  ctx.beginPath();
  ctx.ellipse(cx, ty + 2, w * 0.85, 11, 0, Math.PI, 0);
  ctx.fill();
  ctx.strokeStyle = '#2a3040';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // visor slit
  ctx.fillStyle = '#1a1620';
  ctx.fillRect(cx - w * 0.5, ty + 4, w, 2);
  // plume
  ctx.fillStyle = '#ff5a5a';
  ctx.beginPath();
  ctx.moveTo(cx, ty - 6);
  ctx.quadraticCurveTo(cx + 8, ty - 10, cx + 10, ty - 4);
  ctx.quadraticCurveTo(cx + 4, ty - 4, cx, ty - 6);
  ctx.fill();
}

// ===== Rares =====

function drawIceCrown({ ctx, cx, baseY, h, time }: DecoParams) {
  const ty = baseY - h - 1;
  ctx.fillStyle = '#d4f0ff';
  ctx.strokeStyle = '#7fb8e0';
  ctx.lineWidth = 1.2;
  for (let i = -1; i <= 1; i++) {
    const dx = i * 7;
    const peakY = ty - 12 - Math.abs(i) * 2;
    ctx.beginPath();
    ctx.moveTo(cx + dx - 3, ty);
    ctx.lineTo(cx + dx, peakY);
    ctx.lineTo(cx + dx + 3, ty);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // breath puff
  const pulse = (Math.sin(time * 2) + 1) * 0.5;
  ctx.fillStyle = `rgba(220, 240, 255, ${0.25 + pulse * 0.2})`;
  ctx.beginPath();
  ctx.arc(cx + 10, baseY - h * 0.4, 4 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawLavaCracks({ ctx, cx, baseY, w, h, time }: DecoParams) {
  const glow = (Math.sin(time * 6) + 1) * 0.5;
  ctx.strokeStyle = `rgba(255, 180, 80, ${0.5 + glow * 0.4})`;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.4, baseY - h * 0.3);
  ctx.lineTo(cx - w * 0.1, baseY - h * 0.55);
  ctx.lineTo(cx + w * 0.15, baseY - h * 0.45);
  ctx.lineTo(cx + w * 0.4, baseY - h * 0.7);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.2, baseY - h * 0.8);
  ctx.lineTo(cx + w * 0.05, baseY - h * 0.65);
  ctx.stroke();
  // flame on top — flicker between orange and pale yellow
  const ty = baseY - h - 1;
  const flick = 1 + Math.sin(time * 12) * 0.15;
  ctx.fillStyle = '#ff7048';
  ctx.beginPath();
  ctx.moveTo(cx, ty - 14 * flick);
  ctx.quadraticCurveTo(cx + 6, ty - 6, cx + 4, ty);
  ctx.quadraticCurveTo(cx, ty - 4, cx - 4, ty);
  ctx.quadraticCurveTo(cx - 6, ty - 6, cx, ty - 14 * flick);
  ctx.fill();
  ctx.fillStyle = '#ffe080';
  ctx.beginPath();
  ctx.moveTo(cx, ty - 9 * flick);
  ctx.quadraticCurveTo(cx + 3, ty - 4, cx + 2, ty - 1);
  ctx.quadraticCurveTo(cx, ty - 3, cx - 2, ty - 1);
  ctx.quadraticCurveTo(cx - 3, ty - 4, cx, ty - 9 * flick);
  ctx.fill();
}

function drawLightningBolt({ ctx, cx, baseY, h, time }: DecoParams) {
  const flash = Math.sin(time * 18) > 0.6;
  const ty = baseY - h - 2;
  ctx.strokeStyle = flash ? '#ffffe0' : '#a0a8ff';
  ctx.fillStyle = flash ? '#ffffe0' : '#a0a8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx + 1, ty - 13);
  ctx.lineTo(cx - 3, ty - 6);
  ctx.lineTo(cx + 1, ty - 5);
  ctx.lineTo(cx - 2, ty + 1);
  ctx.stroke();
  // glow eye overlay
  if (flash) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 6, baseY - h * 0.45, 2, 0, Math.PI * 2);
    ctx.arc(cx + 6, baseY - h * 0.45, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawGemSpikes({ ctx, cx, baseY, w, h }: DecoParams, color: string) {
  ctx.fillStyle = color;
  ctx.strokeStyle = '#0c1018';
  ctx.lineWidth = 1;
  // 3 small spikes on top
  for (let i = -1; i <= 1; i++) {
    const dx = i * 7;
    const ty = baseY - h + (i === 0 ? -2 : 2);
    ctx.beginPath();
    ctx.moveTo(cx + dx - 3, ty);
    ctx.lineTo(cx + dx, ty - 9);
    ctx.lineTo(cx + dx + 3, ty);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // side gem facets
  ctx.fillStyle = `rgba(255,255,255,0.18)`;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.5, baseY - h * 0.4);
  ctx.lineTo(cx - w * 0.2, baseY - h * 0.6);
  ctx.lineTo(cx - w * 0.3, baseY - h * 0.2);
  ctx.closePath();
  ctx.fill();
}

function drawCrystalFacets({ ctx, cx, baseY, w, h }: DecoParams, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  // diamond facet lines across body
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.6, baseY - h * 0.5);
  ctx.lineTo(cx, baseY - h * 0.9);
  ctx.lineTo(cx + w * 0.6, baseY - h * 0.5);
  ctx.moveTo(cx - w * 0.3, baseY - h * 0.2);
  ctx.lineTo(cx, baseY - h * 0.5);
  ctx.lineTo(cx + w * 0.3, baseY - h * 0.2);
  ctx.stroke();
  // small gem on back
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.55, baseY - h * 0.6);
  ctx.lineTo(cx - w * 0.45, baseY - h * 0.75);
  ctx.lineTo(cx - w * 0.35, baseY - h * 0.6);
  ctx.lineTo(cx - w * 0.45, baseY - h * 0.55);
  ctx.closePath();
  ctx.fill();
}

function drawGemHorns({ ctx, cx, baseY, w, h }: DecoParams, color: string) {
  const ty = baseY - h;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#0c1018';
  ctx.lineWidth = 1;
  // two big horn-spikes
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.35, ty + 2);
  ctx.lineTo(cx - w * 0.55, ty - 12);
  ctx.lineTo(cx - w * 0.15, ty);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + w * 0.35, ty + 2);
  ctx.lineTo(cx + w * 0.55, ty - 12);
  ctx.lineTo(cx + w * 0.15, ty);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

// ===== Epics =====

function drawVoidParticles({ ctx, cx, baseY, w, h, time }: DecoParams, color: string) {
  // small particles drifting upward around the body
  ctx.fillStyle = color;
  for (let i = 0; i < 4; i++) {
    const a = time * 0.8 + i * 1.5;
    const ox = Math.cos(a) * w * 1.0;
    const oy = -((time * 14 + i * 6) % 22);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(cx + ox, baseY - h * 0.4 + oy, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPrismaticSparkles({ ctx, cx, baseY, w, h, time }: DecoParams) {
  const colors = ['#ff80c8', '#80c8ff', '#80ffc8', '#fff080'];
  for (let i = 0; i < 5; i++) {
    const phase = (time * 1.4 + i * 0.7) % 1;
    const dx = (Math.sin(i * 2.1 + time) * 0.5) * w;
    const dy = -(0.2 + (i / 5) * 0.7) * h;
    const alpha = Math.sin(phase * Math.PI);
    if (alpha <= 0) continue;
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.globalAlpha = alpha * 0.85;
    drawSparkle(ctx, cx + dx, baseY + dy, 2.5);
  }
  ctx.globalAlpha = 1;
}

function drawSparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r * 0.35, cy - r * 0.35);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx + r * 0.35, cy + r * 0.35);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r * 0.35, cy + r * 0.35);
  ctx.lineTo(cx - r, cy);
  ctx.lineTo(cx - r * 0.35, cy - r * 0.35);
  ctx.closePath();
  ctx.fill();
}

function drawPhantomVeil({ ctx, cx, baseY, w, h, body, time }: DecoParams) {
  // Translucent "second body" outline drifting around — ghostly aura
  const drift = Math.sin(time * 2) * 2;
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.moveTo(cx - w - 2 + drift, baseY);
  ctx.quadraticCurveTo(cx - w - 2 + drift, baseY - h - 4, cx + drift, baseY - h - 4);
  ctx.quadraticCurveTo(cx + w + 2 + drift, baseY - h - 4, cx + w + 2 + drift, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Hollow glowing eyes
  ctx.save();
  ctx.shadowBlur = 8;
  ctx.shadowColor = '#e0c8ff';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx - w * 0.22, baseY - h * 0.45, 2, 0, Math.PI * 2);
  ctx.arc(cx + w * 0.22, baseY - h * 0.45, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMetalPlates({ ctx, cx, baseY, w, h }: DecoParams) {
  ctx.strokeStyle = '#5a626e';
  ctx.lineWidth = 1.2;
  // horizontal plate seam across middle
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.85, baseY - h * 0.5);
  ctx.lineTo(cx + w * 0.85, baseY - h * 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.6, baseY - h * 0.8);
  ctx.lineTo(cx + w * 0.6, baseY - h * 0.8);
  ctx.stroke();
  // rivets
  ctx.fillStyle = '#5a626e';
  for (const [dx, dy] of [
    [-0.6, -0.5], [0.6, -0.5], [-0.4, -0.8], [0.4, -0.8],
  ] as Array<[number, number]>) {
    ctx.beginPath();
    ctx.arc(cx + w * dx, baseY - h * -dy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== Legendaries =====

function drawDiamondCrown({ ctx, cx, baseY, w, h, time }: DecoParams) {
  const ty = baseY - h;
  // crown
  ctx.fillStyle = '#ffd24a';
  ctx.strokeStyle = '#a07020';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.55, ty + 2);
  ctx.lineTo(cx - w * 0.35, ty - 6);
  ctx.lineTo(cx - w * 0.1, ty);
  ctx.lineTo(cx, ty - 9);
  ctx.lineTo(cx + w * 0.1, ty);
  ctx.lineTo(cx + w * 0.35, ty - 6);
  ctx.lineTo(cx + w * 0.55, ty + 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // gems on crown
  ctx.fillStyle = '#80e8ff';
  for (const dx of [-w * 0.35, 0, w * 0.35]) {
    ctx.beginPath();
    ctx.arc(cx + dx, ty - 2, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // star eyes — paint over default eyes
  ctx.fillStyle = '#0c1018';
  ctx.beginPath();
  ctx.arc(cx - w * 0.22, baseY - h * 0.45, 3.5, 0, Math.PI * 2);
  ctx.arc(cx + w * 0.22, baseY - h * 0.45, 3.5, 0, Math.PI * 2);
  ctx.fill();
  const twinkle = 0.7 + Math.sin(time * 6) * 0.3;
  ctx.fillStyle = `rgba(255, 255, 220, ${twinkle})`;
  drawSparkle(ctx, cx - w * 0.22, baseY - h * 0.45, 2.4);
  drawSparkle(ctx, cx + w * 0.22, baseY - h * 0.45, 2.4);
}

function drawVoidApex({ ctx, cx, baseY, w, h, time }: DecoParams) {
  // dark halo behind
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.shadowBlur = 14;
  ctx.shadowColor = '#9050c8';
  ctx.fillStyle = '#3a1a5a';
  ctx.beginPath();
  ctx.ellipse(cx, baseY - h * 0.7, w + 6, h * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // 4 eyes — repaint area first
  const body = '#6020a0';
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(cx, baseY - h * 0.45, w * 0.6, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  const pulse = 0.7 + Math.sin(time * 5) * 0.3;
  ctx.globalAlpha = pulse;
  for (const dx of [-w * 0.35, -w * 0.12, w * 0.12, w * 0.35]) {
    ctx.beginPath();
    ctx.arc(cx + dx, baseY - h * 0.45, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // tiny floating void specks
  for (let i = 0; i < 5; i++) {
    const a = time * 1.2 + i * 1.3;
    const r = w + 4;
    ctx.fillStyle = '#1a0a2a';
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * r, baseY - h * 0.5 + Math.sin(a) * h * 0.45, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ===== utility =====

function shade(hex: string, amt: number): string {
  // amt: -1..+1
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const f = (v: number) => {
    const out = Math.round(v + amt * (amt > 0 ? 255 - v : v));
    return Math.max(0, Math.min(255, out));
  };
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}
