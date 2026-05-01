import { CONTAINER_DURATION, type ContainerSpec } from '../systems/Procgen';
import { rect, text } from '../systems/Render';

export type ArrowKey = 'up' | 'down' | 'left' | 'right';

// Safe-only QTE tuning. Other container kinds use hold-Space and ignore these.
// The timer is one budget for the whole sequence — correct presses advance
// the index but do NOT refill the clock.
const SAFE_QTE_LENGTH = 5;
const SAFE_QTE_TOTAL_TIME = 17.5;

export const QTE_FAIL_COOLDOWN = 1.5;

export class Container {
  spec: ContainerSpec;
  isOpen = false;

  // Hold-Space state (regular kinds: toolbox, cabinet, locker).
  openProgress = 0;

  // QTE state (safe only).
  qteActive = false;
  qteSequence: ArrowKey[] = [];
  qteIndex = 0;
  qteTimeLeft = 0;
  qteFailFlash = 0;
  failCooldown = 0;

  constructor(spec: ContainerSpec) {
    this.spec = spec;
  }

  isSafe(): boolean {
    return this.spec.kind === 'safe';
  }

  // Hold-Space duration for regular kinds.
  duration(): number {
    return CONTAINER_DURATION[this.spec.kind];
  }

  get x() {
    return this.spec.x;
  }
  get y() {
    return this.spec.y;
  }
  get w() {
    return this.spec.w;
  }
  get h() {
    return this.spec.h;
  }
  cx() {
    return this.spec.x + this.spec.w / 2;
  }
  cy() {
    return this.spec.y + this.spec.h / 2;
  }
  qteTotalDuration(): number {
    return SAFE_QTE_TOTAL_TIME;
  }

  startQTE(): void {
    if (this.isOpen || this.qteActive || this.failCooldown > 0) return;
    if (!this.isSafe()) return; // QTE is safe-only
    const len = SAFE_QTE_LENGTH;
    const arrows: ArrowKey[] = ['up', 'down', 'left', 'right'];
    this.qteSequence = [];
    let last: ArrowKey | null = null;
    for (let i = 0; i < len; i++) {
      // Avoid two of the same arrow back-to-back so reading the sequence
      // doesn't get confusing.
      let next: ArrowKey;
      do {
        next = arrows[Math.floor(Math.random() * arrows.length)]!;
      } while (next === last);
      this.qteSequence.push(next);
      last = next;
    }
    this.qteIndex = 0;
    this.qteTimeLeft = this.qteTotalDuration();
    this.qteActive = true;
    this.qteFailFlash = 0;
  }

  // Returns 'pending' while in progress, 'success' on completed sequence,
  // 'fail' on wrong key. Caller handles the resulting effects.
  onArrowKey(key: ArrowKey): 'pending' | 'success' | 'fail' {
    if (!this.qteActive) return 'pending';
    const expected = this.qteSequence[this.qteIndex];
    if (key !== expected) {
      this.qteFailFlash = 0.45;
      this.qteActive = false;
      this.failCooldown = QTE_FAIL_COOLDOWN;
      return 'fail';
    }
    this.qteIndex += 1;
    if (this.qteIndex >= this.qteSequence.length) {
      this.qteActive = false;
      this.qteFailFlash = 0;
      return 'success';
    }
    // Note: timer is intentionally NOT reset on a correct press — the player
    // has one fixed budget to clear the whole sequence.
    return 'pending';
  }

  // Returns true if QTE timed out (treated as failure).
  tickQTE(dt: number): boolean {
    if (this.qteFailFlash > 0) this.qteFailFlash = Math.max(0, this.qteFailFlash - dt);
    if (this.failCooldown > 0) this.failCooldown = Math.max(0, this.failCooldown - dt);
    if (!this.qteActive) return false;
    this.qteTimeLeft -= dt;
    if (this.qteTimeLeft <= 0) {
      this.qteFailFlash = 0.45;
      this.qteActive = false;
      this.failCooldown = QTE_FAIL_COOLDOWN;
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D): void {
    const open = this.isOpen;
    switch (this.spec.kind) {
      case 'toolbox':
        drawToolbox(ctx, this.spec.x, this.spec.y, this.spec.w, this.spec.h, open);
        break;
      case 'locker':
        drawLocker(ctx, this.spec.x, this.spec.y, this.spec.w, this.spec.h, open);
        break;
      case 'cabinet':
        drawCabinet(ctx, this.spec.x, this.spec.y, this.spec.w, this.spec.h, open);
        break;
      case 'safe':
        drawSafe(ctx, this.spec.x, this.spec.y, this.spec.w, this.spec.h, open);
        break;
    }
    if (!open) {
      text(ctx, this.spec.kind, this.cx(), this.spec.y - 12, {
        align: 'center',
        size: 9,
        color: '#7a3030',
        font: "'Special Elite', monospace",
      });
    }
  }

  // Hold-Space progress bar (regular containers only).
  renderProgressBar(ctx: CanvasRenderingContext2D): void {
    if (this.isOpen || this.isSafe() || this.openProgress <= 0) return;
    const bw = this.spec.w + 8;
    const bx = this.spec.x - 4;
    const by = this.spec.y - 8;
    rect(ctx, bx, by, bw, 4, '#1a1218', '#3a2c1a');
    const pct = Math.min(1, this.openProgress / this.duration());
    rect(ctx, bx + 1, by + 1, (bw - 2) * pct, 2, '#ffd76a');
  }

  // Renders the safe's QTE prompt + per-step timer above the container.
  renderQTE(ctx: CanvasRenderingContext2D): void {
    if (this.isOpen) return;
    if (!this.qteActive && this.qteFailFlash <= 0) return;

    const cellW = 26;
    const cellH = 26;
    const gap = 6;
    const totalW = this.qteSequence.length * cellW + (this.qteSequence.length - 1) * gap;
    const startX = this.cx() - totalW / 2;
    const baseY = this.spec.y - 56;

    for (let i = 0; i < this.qteSequence.length; i++) {
      const x = startX + i * (cellW + gap);
      const isCurrent = i === this.qteIndex && this.qteActive;
      const isPast = i < this.qteIndex;
      const isFlashFail = this.qteFailFlash > 0 && i === this.qteIndex;

      let fill = '#15101a';
      let stroke = '#3a2c1a';
      let arrowColor = '#7c6f5e';
      if (isPast) {
        fill = '#1a2418';
        stroke = '#5a7a4a';
        arrowColor = '#9ed79a';
      } else if (isFlashFail) {
        fill = '#3a1418';
        stroke = '#a5526a';
        arrowColor = '#e8a0b0';
      } else if (isCurrent) {
        fill = '#1f1820';
        stroke = '#c9a14a';
        arrowColor = '#ffd76a';
      }

      rect(ctx, x, baseY, cellW, cellH, fill, stroke);
      drawArrow(ctx, this.qteSequence[i]!, x + cellW / 2, baseY + cellH / 2, arrowColor);
    }

    // Per-step timer bar — only while active
    if (this.qteActive) {
      const timerW = totalW;
      const timerY = baseY + cellH + 4;
      rect(ctx, startX, timerY, timerW, 3, '#1a1218', '#3a2c1a');
      const pct = Math.max(0, Math.min(1, this.qteTimeLeft / this.qteTotalDuration()));
      const color = pct > 0.5 ? '#9ed79a' : pct > 0.25 ? '#c9a14a' : '#a5526a';
      rect(ctx, startX + 1, timerY + 1, Math.max(0, (timerW - 2) * pct), 1, color);
    }
  }
}

function drawArrow(ctx: CanvasRenderingContext2D, dir: ArrowKey, cx: number, cy: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  switch (dir) {
    case 'up':
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx - 6, cy + 4);
      ctx.lineTo(cx + 6, cy + 4);
      break;
    case 'down':
      ctx.moveTo(cx, cy + 7);
      ctx.lineTo(cx - 6, cy - 4);
      ctx.lineTo(cx + 6, cy - 4);
      break;
    case 'left':
      ctx.moveTo(cx - 7, cy);
      ctx.lineTo(cx + 4, cy - 6);
      ctx.lineTo(cx + 4, cy + 6);
      break;
    case 'right':
      ctx.moveTo(cx + 7, cy);
      ctx.lineTo(cx - 4, cy - 6);
      ctx.lineTo(cx - 4, cy + 6);
      break;
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawToolbox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: boolean) {
  rect(ctx, x, y, w, h, '#3a2820', '#0a0608');
  rect(ctx, x + 2, y + 2, w - 4, h - 4, '#5b3a28', '#1a120a');
  rect(ctx, x + 2, y + 2, w - 4, 6, '#3a3a3e', '#1a1218');
  ctx.fillStyle = open ? '#7a3030' : '#c9a14a';
  ctx.fillRect(x + w / 2 - 3, y + 4, 6, 6);
  ctx.strokeStyle = '#0a0608';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + (open ? -2 : 1), 5, Math.PI, 0);
  ctx.stroke();
  if (open) {
    ctx.strokeStyle = '#0a0608';
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 8);
    ctx.lineTo(x + w - 4, y + 8);
    ctx.stroke();
  }
}

function drawLocker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: boolean) {
  rect(ctx, x, y, w, h, '#2c2c30', '#0a0608');
  rect(ctx, x + 2, y + 2, w - 4, h - 4, '#3a3a3e', '#1a1218');
  ctx.fillStyle = '#0a0608';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 6, y + 6 + i * 4, w - 12, 1);
  ctx.strokeStyle = '#0a0608';
  ctx.lineWidth = 1;
  ctx.fillStyle = open ? '#7a3030' : '#c9a14a';
  ctx.fillRect(x + w - 8, y + h / 2 - 4, 4, 8);
  if (open) {
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(x + 4, y + 22, w - 16, h - 28);
  }
}

function drawCabinet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: boolean) {
  rect(ctx, x, y, w, h, '#2a1c1a', '#0a0608');
  rect(ctx, x + 2, y + 2, w - 4, h - 4, '#3a2820', '#1a120a');
  ctx.fillStyle = '#0a0608';
  ctx.fillRect(x + w / 2 - 0.5, y + 2, 1, h - 4);
  ctx.fillStyle = open ? '#7a3030' : '#c9a14a';
  ctx.fillRect(x + w / 2 - 7, y + h / 2 - 1, 4, 2);
  ctx.fillRect(x + w / 2 + 3, y + h / 2 - 1, 4, 2);
  if (open) {
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.strokeStyle = '#3a2820';
    ctx.strokeRect(x + 4 + 0.5, y + 4 + 0.5, w - 9, h - 9);
  }
}

function drawSafe(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: boolean) {
  // Heavy black metal box.
  rect(ctx, x, y, w, h, '#0a0a0e', '#000');
  rect(ctx, x + 2, y + 2, w - 4, h - 4, '#1c1c22', '#0a0a0e');
  // Bolted corners
  ctx.fillStyle = '#3a3a3e';
  for (const [dx, dy] of [
    [4, 4],
    [w - 8, 4],
    [4, h - 8],
    [w - 8, h - 8],
  ]) {
    ctx.fillRect(x + dx, y + dy, 4, 4);
  }
  if (open) {
    // ajar door + dark interior
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(x + 6, y + 8, w - 12, h - 16);
    ctx.strokeStyle = '#5a2a2a';
    ctx.strokeRect(x + 6 + 0.5, y + 8 + 0.5, w - 13, h - 17);
  } else {
    // Combination dial: outer ring + inner pointer
    const cx = x + w / 2;
    const cy = y + h / 2;
    ctx.fillStyle = '#2a2a2e';
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) / 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a5a60';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // tick marks
    ctx.strokeStyle = '#9a9aa0';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r1 = Math.min(w, h) / 3.5;
      const r2 = r1 - 3;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    // Pointer
    ctx.strokeStyle = '#c9a14a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.min(w, h) / 5, cy - 2);
    ctx.stroke();
  }
}
