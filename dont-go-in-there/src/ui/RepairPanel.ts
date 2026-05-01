import type { Game } from '../game/Game';
import {
  ALL_ITEMS,
  ALL_PARTS,
  ITEM_COLOR,
  ITEM_LABEL,
  PART_BENEFIT,
  PART_LABEL,
  PART_REQS,
  type ItemKind,
  type PartKey,
} from '../types';
import { rect, text, pointInRect, W, H } from '../systems/Render';

type ChipRect = { part: PartKey; kind: ItemKind; rect: { x: number; y: number; w: number; h: number } };

export class RepairPanel {
  open = false;
  private chipRects: ChipRect[] = [];
  private closeRect = { x: 0, y: 0, w: 0, h: 0 };

  toggle() {
    this.open = !this.open;
  }

  close() {
    this.open = false;
  }

  render(ctx: CanvasRenderingContext2D, game: Game): void {
    if (!this.open) return;
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);

    const pw = 540;
    const ph = 460;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    rect(ctx, px, py, pw, ph, '#15101a', '#3a2c1a');

    text(ctx, '"…thank you for coming back."', px + pw / 2, py + 18, {
      align: 'center',
      size: 14,
      color: '#a5526a',
      font: "'Special Elite', monospace",
    });
    text(ctx, 'REPAIR "FRIEND"', px + pw / 2, py + 44, {
      align: 'center',
      size: 18,
      color: '#c9b9a4',
    });
    text(ctx, 'click a requirement chip to install one item from the chest', px + pw / 2, py + 68, {
      align: 'center',
      size: 11,
      color: '#7c6f5e',
      font: "'Special Elite', monospace",
    });

    this.chipRects = [];
    let y = py + 92;
    const partH = 76;
    const chipW = 100;
    const chipH = 30;
    const chipGap = 8;
    const sectionPadX = 20;

    // Show only the head until it's fully repaired — body parts unlock after.
    const headRepaired = game.isPartRepaired('head');
    for (const part of ALL_PARTS) {
      if (part !== 'head' && !headRepaired) continue;
      const reqs = PART_REQS[part];
      const progress = game.save.partProgress[part];
      const repaired = game.isPartRepaired(part);

      // Section background
      const sectionFill = repaired ? '#1a2418' : '#1a1218';
      const sectionStroke = repaired ? '#5a7a4a' : '#2a232b';
      rect(ctx, px + sectionPadX, y, pw - sectionPadX * 2, partH, sectionFill, sectionStroke);

      // Header — part name + the passive benefit it unlocks
      text(ctx, PART_LABEL[part], px + sectionPadX + 12, y + 6, {
        size: 14,
        color: '#c9b9a4',
      });
      text(ctx, `→ ${PART_BENEFIT[part]}`, px + sectionPadX + 12, y + 22, {
        size: 10,
        color: repaired ? '#9ed79a' : '#7c6f5e',
        font: "'Special Elite', monospace",
      });
      text(ctx, repaired ? '✓ repaired' : 'incomplete', px + pw - sectionPadX - 12, y + 10, {
        align: 'right',
        size: 11,
        color: repaired ? '#9ed79a' : '#7a4030',
        font: "'Special Elite', monospace",
      });

      // Chips for each required kind
      let cx = px + sectionPadX + 12;
      const cy = y + 36;
      for (const kind of ALL_ITEMS) {
        const need = reqs[kind] ?? 0;
        if (need === 0) continue;
        // Voice box is pre-installed and not lootable — hide its chip entirely.
        if (kind === 'voice_box') continue;
        const have = progress[kind] ?? 0;
        const banked = game.save.banked[kind];
        const isMet = have >= need;
        const canInstall = !isMet && banked > 0;

        // Chip body
        const baseColor = ITEM_COLOR[kind];
        const fill = isMet
          ? baseColor
          : canInstall
            ? `${baseColor}55`
            : `${baseColor}22`;
        const stroke = canInstall ? baseColor : '#2a232b';
        rect(ctx, cx, cy, chipW, chipH, fill, stroke);

        // Kind label + count
        const labelColor = isMet ? '#0a0608' : canInstall ? '#e8d9b8' : '#5a4836';
        text(ctx, ITEM_LABEL[kind], cx + 8, cy + 5, {
          size: 11,
          color: labelColor,
          font: "'Special Elite', monospace",
        });
        text(ctx, `${have}/${need}`, cx + chipW - 8, cy + 5, {
          align: 'right',
          size: 11,
          color: labelColor,
          font: "'Special Elite', monospace",
        });
        // Banked count below (only when relevant)
        if (!isMet) {
          text(ctx, `chest ${banked}`, cx + chipW / 2, cy + 18, {
            align: 'center',
            size: 9,
            color: canInstall ? '#c9b9a4' : '#5a4836',
            font: "'Special Elite', monospace",
          });
        } else {
          text(ctx, 'installed', cx + chipW / 2, cy + 18, {
            align: 'center',
            size: 9,
            color: '#0a0608',
            font: "'Special Elite', monospace",
          });
        }

        this.chipRects.push({ part, kind, rect: { x: cx, y: cy, w: chipW, h: chipH } });
        cx += chipW + chipGap;
      }

      y += partH + 8;
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
    for (const chip of this.chipRects) {
      if (pointInRect(x, y, chip.rect.x, chip.rect.y, chip.rect.w, chip.rect.h)) {
        game.installItem(chip.part, chip.kind);
        return true;
      }
    }
    return true; // swallow clicks while open
  }
}
