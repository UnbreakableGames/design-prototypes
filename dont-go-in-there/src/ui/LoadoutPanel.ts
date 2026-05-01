import type { Game } from '../game/Game';
import {
  ALL_TOOLS,
  TOOL_BENEFIT,
  TOOL_COLOR,
  TOOL_LABEL,
  type ToolKind,
} from '../types';
import { rect, text, pointInRect, W, H } from '../systems/Render';

type Btn = { kind: ToolKind; sign: -1 | 1; rect: { x: number; y: number; w: number; h: number } };

// Pre-raid loadout selection. Choose how many of each crafted tool to take
// into the basement. Tools left behind stay safe in the workshop; tools
// taken are at risk if you die.
export class LoadoutPanel {
  open = false;
  private buttons: Btn[] = [];
  private descendRect = { x: 0, y: 0, w: 0, h: 0 };
  private cancelRect = { x: 0, y: 0, w: 0, h: 0 };
  private wantsDescend = false;

  begin(): void {
    this.open = true;
    this.wantsDescend = false;
  }

  close(): void {
    this.open = false;
  }

  consumeDescendRequest(): boolean {
    if (this.wantsDescend) {
      this.wantsDescend = false;
      return true;
    }
    return false;
  }

  render(ctx: CanvasRenderingContext2D, game: Game): void {
    if (!this.open) return;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    const pw = 600;
    const ph = 460;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    rect(ctx, px, py, pw, ph, '#15101a', '#3a2c1a');

    text(ctx, 'LOAD UP', px + pw / 2, py + 18, {
      align: 'center',
      size: 18,
      color: '#c9b9a4',
    });
    text(ctx, 'choose what to take. anything you bring is lost if you die.', px + pw / 2, py + 44, {
      align: 'center',
      size: 11,
      color: '#7c6f5e',
      font: "'Special Elite', monospace",
    });

    this.buttons = [];
    let y = py + 72;
    const rowH = 64;
    const rowGap = 6;
    const padX = 20;
    const ownsAny = ALL_TOOLS.some((k) => game.save.equipped[k] > 0);

    if (!ownsAny) {
      text(ctx, 'no tools crafted yet.', px + pw / 2, py + 130, {
        align: 'center',
        size: 13,
        color: '#5a4836',
        font: "'Special Elite', monospace",
      });
      text(ctx, 'craft tools at the table to bring them on a run.', px + pw / 2, py + 152, {
        align: 'center',
        size: 11,
        color: '#5a4836',
        font: "'Special Elite', monospace",
      });
    } else {
      for (const tool of ALL_TOOLS) {
        const owned = game.save.equipped[tool];
        if (owned <= 0) continue; // hide tools you don't own
        const loaded = game.save.loadout[tool];

        const fill = loaded > 0 ? '#1a2418' : '#1a1218';
        const stroke = loaded > 0 ? '#5a7a4a' : '#2a232b';
        rect(ctx, px + padX, y, pw - padX * 2, rowH, fill, stroke);

        // color swatch
        rect(ctx, px + padX + 12, y + 12, 22, 22, TOOL_COLOR[tool], '#0a0608');

        // title + benefit
        text(ctx, TOOL_LABEL[tool], px + padX + 44, y + 8, {
          size: 14,
          color: '#c9b9a4',
        });
        text(ctx, `→ ${TOOL_BENEFIT[tool]}`, px + padX + 44, y + 26, {
          size: 10,
          color: loaded > 0 ? '#9ed79a' : '#7c6f5e',
          font: "'Special Elite', monospace",
        });
        text(ctx, `workshop: ${owned}`, px + padX + 44, y + 44, {
          size: 10,
          color: '#7c6f5e',
          font: "'Special Elite', monospace",
        });

        // − count + counter on the right
        const stepW = 26;
        const counterW = 36;
        const stepRight = px + pw - padX - 12;
        const plusX = stepRight - stepW;
        const counterX = plusX - counterW;
        const minusX = counterX - stepW;
        const stepY = y + 18;

        rect(ctx, minusX, stepY, stepW, stepW, loaded > 0 ? '#3a2c1a' : '#1a1218', '#3a2c1a');
        text(ctx, '−', minusX + stepW / 2, stepY + 5, {
          align: 'center',
          size: 16,
          color: loaded > 0 ? '#c9b9a4' : '#5a4836',
        });

        rect(ctx, counterX, stepY, counterW, stepW, '#1f1820', '#3a2c1a');
        text(ctx, `${loaded}/${owned}`, counterX + counterW / 2, stepY + 7, {
          align: 'center',
          size: 12,
          color: loaded > 0 ? '#9ed79a' : '#c9b9a4',
          font: "'Special Elite', monospace",
        });

        rect(ctx, plusX, stepY, stepW, stepW, loaded < owned ? '#3a2c1a' : '#1a1218', '#3a2c1a');
        text(ctx, '+', plusX + stepW / 2, stepY + 5, {
          align: 'center',
          size: 16,
          color: loaded < owned ? '#c9b9a4' : '#5a4836',
        });

        this.buttons.push({ kind: tool, sign: -1, rect: { x: minusX, y: stepY, w: stepW, h: stepW } });
        this.buttons.push({ kind: tool, sign: 1, rect: { x: plusX, y: stepY, w: stepW, h: stepW } });

        y += rowH + rowGap;
      }
    }

    // Bottom: descend + cancel
    const btnH = 32;
    const btnW = 130;
    const btnY = py + ph - btnH - 16;
    this.descendRect = { x: px + pw - padX - btnW, y: btnY, w: btnW, h: btnH };
    rect(ctx, this.descendRect.x, this.descendRect.y, this.descendRect.w, this.descendRect.h, '#3a1418', '#7a1c20');
    text(ctx, 'DESCEND →', this.descendRect.x + btnW / 2, btnY + 9, {
      align: 'center',
      size: 13,
      color: '#ff9aa0',
      font: "'Special Elite', monospace",
    });

    this.cancelRect = { x: px + padX, y: btnY, w: 90, h: btnH };
    rect(ctx, this.cancelRect.x, this.cancelRect.y, this.cancelRect.w, this.cancelRect.h, '#1a1218', '#3a2c1a');
    text(ctx, 'cancel [esc]', this.cancelRect.x + this.cancelRect.w / 2, btnY + 10, {
      align: 'center',
      size: 11,
      color: '#c9b9a4',
      font: "'Special Elite', monospace",
    });
  }

  onClick(x: number, y: number, game: Game): boolean {
    if (!this.open) return false;
    if (pointInRect(x, y, this.descendRect.x, this.descendRect.y, this.descendRect.w, this.descendRect.h)) {
      this.wantsDescend = true;
      this.close();
      return true;
    }
    if (pointInRect(x, y, this.cancelRect.x, this.cancelRect.y, this.cancelRect.w, this.cancelRect.h)) {
      this.close();
      return true;
    }
    for (const b of this.buttons) {
      if (pointInRect(x, y, b.rect.x, b.rect.y, b.rect.w, b.rect.h)) {
        const cur = game.save.loadout[b.kind];
        game.setLoadoutCount(b.kind, cur + b.sign);
        return true;
      }
    }
    return true;
  }
}
