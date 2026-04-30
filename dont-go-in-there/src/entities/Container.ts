import { CONTAINER_DURATION, type ContainerSpec } from '../systems/Procgen';
import { rect, text } from '../systems/Render';

export class Container {
  spec: ContainerSpec;
  openProgress = 0;
  isOpen = false;

  constructor(spec: ContainerSpec) {
    this.spec = spec;
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
  duration() {
    return CONTAINER_DURATION[this.spec.kind];
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

  renderProgressBar(ctx: CanvasRenderingContext2D): void {
    if (this.isOpen || this.openProgress <= 0) return;
    const bw = this.spec.w + 8;
    const bx = this.spec.x - 4;
    const by = this.spec.y - 8;
    rect(ctx, bx, by, bw, 4, '#1a1218', '#3a2c1a');
    const pct = Math.min(1, this.openProgress / this.duration());
    rect(ctx, bx + 1, by + 1, (bw - 2) * pct, 2, '#ffd76a');
  }
}

function drawToolbox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: boolean) {
  rect(ctx, x, y, w, h, '#3a2820', '#0a0608');
  rect(ctx, x + 2, y + 2, w - 4, h - 4, '#5b3a28', '#1a120a');
  // metal lid strip
  rect(ctx, x + 2, y + 2, w - 4, 6, '#3a3a3e', '#1a1218');
  // latch
  ctx.fillStyle = open ? '#7a3030' : '#c9a14a';
  ctx.fillRect(x + w / 2 - 3, y + 4, 6, 6);
  // handle
  ctx.strokeStyle = '#0a0608';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x + w / 2, y + (open ? -2 : 1), 5, Math.PI, 0);
  ctx.stroke();
  if (open) {
    // cracked open lid line
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
  // vent slats at top
  ctx.fillStyle = '#0a0608';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + 6, y + 6 + i * 4, w - 12, 1);
  // door divider line
  ctx.strokeStyle = '#0a0608';
  ctx.lineWidth = 1;
  // handle/lock
  ctx.fillStyle = open ? '#7a3030' : '#c9a14a';
  ctx.fillRect(x + w - 8, y + h / 2 - 4, 4, 8);
  if (open) {
    // ajar door
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(x + 4, y + 22, w - 16, h - 28);
  }
}

function drawCabinet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: boolean) {
  rect(ctx, x, y, w, h, '#2a1c1a', '#0a0608');
  rect(ctx, x + 2, y + 2, w - 4, h - 4, '#3a2820', '#1a120a');
  // two-door divider
  ctx.fillStyle = '#0a0608';
  ctx.fillRect(x + w / 2 - 0.5, y + 2, 1, h - 4);
  // handles
  ctx.fillStyle = open ? '#7a3030' : '#c9a14a';
  ctx.fillRect(x + w / 2 - 7, y + h / 2 - 1, 4, 2);
  ctx.fillRect(x + w / 2 + 3, y + h / 2 - 1, 4, 2);
  if (open) {
    // dark interior
    ctx.fillStyle = '#0a0608';
    ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    ctx.strokeStyle = '#3a2820';
    ctx.strokeRect(x + 4 + 0.5, y + 4 + 0.5, w - 9, h - 9);
  }
}
