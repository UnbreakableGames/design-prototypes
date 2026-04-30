import type { Game } from '../game/Game';
import { ALL_PARTS, ITEM_LABEL, PART_LABEL, PART_REQUIRES, ITEM_COLOR, type PartKey } from '../types';
import { rect, text, pointInRect, W, H } from '../systems/Render';

export class RepairPanel {
  open = false;
  private rowRects: { part: PartKey; rect: { x: number; y: number; w: number; h: number } }[] = [];
  private closeRect = { x: 0, y: 0, w: 0, h: 0 };

  toggle() {
    this.open = !this.open;
  }

  close() {
    this.open = false;
  }

  render(ctx: CanvasRenderingContext2D, game: Game): void {
    if (!this.open) return;
    // backdrop
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);

    const pw = 460;
    const ph = 360;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    rect(ctx, px, py, pw, ph, '#15101a', '#3a2c1a');

    text(ctx, '"…thank you for coming back."', px + pw / 2, py + 18, {
      align: 'center',
      size: 14,
      color: '#a5526a',
      font: "'Special Elite', monospace",
    });
    text(ctx, 'REPAIR FRIEND', px + pw / 2, py + 44, {
      align: 'center',
      size: 18,
      color: '#c9b9a4',
    });

    this.rowRects = [];
    let y = py + 84;
    for (const p of ALL_PARTS) {
      const need = PART_REQUIRES[p];
      const have = game.save.banked[need];
      const repaired = game.save.parts[p];
      const r = { x: px + 24, y, w: pw - 48, h: 48 };
      const fill = repaired ? '#1a2418' : have > 0 ? '#1f1820' : '#150f17';
      rect(ctx, r.x, r.y, r.w, r.h, fill, '#2a232b');

      // color swatch for required item
      rect(ctx, r.x + 10, r.y + 12, 24, 24, ITEM_COLOR[need], '#0a0608');

      const status = repaired ? 'repaired' : have > 0 ? 'click to install' : 'need item';
      const statusColor = repaired ? '#7ea76b' : have > 0 ? '#c9b9a4' : '#7a4030';
      text(ctx, PART_LABEL[p], r.x + 44, r.y + 8, { color: '#c9b9a4', size: 14 });
      text(ctx, `requires ${ITEM_LABEL[need]} · banked: ${have}`, r.x + 44, r.y + 28, {
        color: '#7c6f5e',
        size: 11,
      });
      text(ctx, status, r.x + r.w - 12, r.y + 18, {
        align: 'right',
        size: 12,
        color: statusColor,
        font: "'Special Elite', monospace",
      });

      this.rowRects.push({ part: p, rect: r });
      y += 56;
    }

    this.closeRect = { x: px + pw - 92, y: py + ph - 38, w: 76, h: 26 };
    rect(ctx, this.closeRect.x, this.closeRect.y, this.closeRect.w, this.closeRect.h, '#2a1c20', '#3a2c1a');
    text(ctx, 'close [esc]', this.closeRect.x + this.closeRect.w / 2, this.closeRect.y + 7, {
      align: 'center',
      size: 11,
      color: '#c9b9a4',
      font: "'Special Elite', monospace",
    });
  }

  onClick(x: number, y: number, game: Game): boolean {
    if (!this.open) return false;
    if (pointInRect(x, y, this.closeRect.x, this.closeRect.y, this.closeRect.w, this.closeRect.h)) {
      this.close();
      return true;
    }
    for (const row of this.rowRects) {
      if (pointInRect(x, y, row.rect.x, row.rect.y, row.rect.w, row.rect.h)) {
        if (game.save.parts[row.part]) return true;
        const need = PART_REQUIRES[row.part];
        if (game.spend(need, 1)) {
          game.repair(row.part);
        }
        return true;
      }
    }
    return true; // swallow clicks while open
  }
}
