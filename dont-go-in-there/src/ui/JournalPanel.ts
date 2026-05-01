import type { Game } from '../game/Game';
import { getJournalEntries } from '../types';
import { rect, text, pointInRect, W, H } from '../systems/Render';

export class JournalPanel {
  open = false;
  private closeRect = { x: 0, y: 0, w: 0, h: 0 };

  toggle(): void {
    this.open = !this.open;
  }

  close(): void {
    this.open = false;
  }

  render(ctx: CanvasRenderingContext2D, game: Game): void {
    if (!this.open) return;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    const pw = 560;
    const ph = 540;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    rect(ctx, px, py, pw, ph, '#15101a', '#3a2c1a');

    text(ctx, 'JOURNAL', px + pw / 2, py + 20, {
      align: 'center',
      size: 18,
      color: '#c9b9a4',
      font: "'Special Elite', monospace",
    });
    text(ctx, '"my list. so i don\'t forget."', px + pw / 2, py + 44, {
      align: 'center',
      size: 11,
      color: '#7a3030',
      font: "'Special Elite', monospace",
    });

    const entries = getJournalEntries(game.save);
    const active = entries.filter((e) => e.status === 'active');
    const done = entries.filter((e) => e.status === 'done');

    let y = py + 76;
    const padX = 24;
    const innerW = pw - padX * 2;
    const entryGap = 6;
    const checklistRowH = 14;

    // Layout heuristic: title row ~22px, description row ~18px (only shown
    // when there's no checklist), then checklist rows + padding.
    const heightOf = (entry: (typeof entries)[number]): number => {
      const rows = entry.checklist?.length ?? 0;
      const titleH = 22;
      const descH = rows > 0 ? 0 : 22;
      const listH = rows * checklistRowH + (rows > 0 ? 8 : 0);
      return Math.max(34, titleH + descH + listH + 8);
    };

    const renderEntry = (
      entry: (typeof entries)[number],
      yPos: number,
    ): void => {
      const isDone = entry.status === 'done';
      const fill = isDone ? '#1a2418' : '#1a1218';
      const stroke = isDone ? '#5a7a4a' : '#2a232b';
      const h = heightOf(entry);
      rect(ctx, px + padX, yPos, innerW, h, fill, stroke);
      // Status pip on the left
      const pipColor = isDone ? '#9ed79a' : '#ffd76a';
      ctx.fillStyle = pipColor;
      ctx.beginPath();
      ctx.arc(px + padX + 10, yPos + 14, 3, 0, Math.PI * 2);
      ctx.fill();
      // Title
      text(ctx, entry.title, px + padX + 22, yPos + 6, {
        size: 12,
        color: isDone ? '#9ed79a' : '#c9b9a4',
        font: "'Special Elite', monospace",
      });
      // Description — only when there's no checklist (otherwise the list IS
      // the description, and the panel runs out of room).
      const hasChecklist = !!entry.checklist && entry.checklist.length > 0;
      if (!hasChecklist) {
        text(ctx, entry.description, px + padX + 22, yPos + 22, {
          size: 11,
          color: isDone ? '#7c8f70' : '#a5526a',
          font: "'Special Elite', monospace",
        });
      } else {
        let cy = yPos + 28;
        for (const item of entry.checklist!) {
          const glyph = item.done ? '[x]' : '[ ]';
          const glyphColor = item.done ? '#9ed79a' : '#c9b9a4';
          text(ctx, glyph, px + padX + 22, cy, {
            size: 11,
            color: glyphColor,
            font: "'Special Elite', monospace",
          });
          text(ctx, item.text, px + padX + 50, cy, {
            size: 11,
            color: item.done ? '#7c8f70' : '#a5526a',
            font: "'Special Elite', monospace",
          });
          cy += checklistRowH;
        }
      }
    };

    if (active.length > 0) {
      text(ctx, 'ACTIVE', px + padX, y, {
        size: 10,
        color: '#7c6f5e',
        font: "'Special Elite', monospace",
      });
      y += 16;
      for (const e of active) {
        renderEntry(e, y);
        y += heightOf(e) + entryGap;
      }
      y += 8;
    }

    if (done.length > 0) {
      text(ctx, 'COMPLETED', px + padX, y, {
        size: 10,
        color: '#7c6f5e',
        font: "'Special Elite', monospace",
      });
      y += 16;
      for (const e of done) {
        renderEntry(e, y);
        y += heightOf(e) + entryGap;
      }
    }

    if (entries.length === 0) {
      text(ctx, '...nothing to do yet.', px + pw / 2, py + ph / 2, {
        align: 'center',
        size: 12,
        color: '#7c6f5e',
        font: "'Special Elite', monospace",
      });
    }

    this.closeRect = { x: px + pw - 92, y: py + ph - 38, w: 76, h: 26 };
    rect(ctx, this.closeRect.x, this.closeRect.y, this.closeRect.w, this.closeRect.h, '#2a1c20', '#3a2c1a');
    text(ctx, 'close [j]', this.closeRect.x + this.closeRect.w / 2, this.closeRect.y + 7, {
      align: 'center',
      size: 11,
      color: '#c9b9a4',
      font: "'Special Elite', monospace",
    });
  }

  onClick(x: number, y: number): boolean {
    if (!this.open) return false;
    if (pointInRect(x, y, this.closeRect.x, this.closeRect.y, this.closeRect.w, this.closeRect.h)) {
      this.close();
      return true;
    }
    return true; // swallow clicks while open
  }
}
