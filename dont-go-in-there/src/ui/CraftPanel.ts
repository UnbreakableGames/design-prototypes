import type { Game } from '../game/Game';
import {
  ALL_TOOLS,
  ITEM_COLOR,
  ITEM_LABEL,
  TOOL_BENEFIT,
  TOOL_COLOR,
  TOOL_LABEL,
  TOOL_RECIPE,
  type ItemKind,
  type ToolKind,
} from '../types';
import { rect, text, pointInRect, W, H } from '../systems/Render';

type CraftRect = { kind: ToolKind; rect: { x: number; y: number; w: number; h: number } };

export class CraftPanel {
  open = false;
  private craftRects: CraftRect[] = [];
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

    const pw = 600;
    const ph = 480;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    rect(ctx, px, py, pw, ph, '#15101a', '#3a2c1a');

    text(ctx, 'WORKBENCH', px + pw / 2, py + 18, {
      align: 'center',
      size: 18,
      color: '#c9b9a4',
    });
    text(ctx, 'craft tools — kept until you die in the basement', px + pw / 2, py + 44, {
      align: 'center',
      size: 11,
      color: '#7c6f5e',
      font: "'Special Elite', monospace",
    });

    this.craftRects = [];
    const rowH = 80;
    const rowGap = 6;
    const padX = 20;
    let y = py + 72;

    for (const tool of ALL_TOOLS) {
      const crafted = game.save.equipped[tool];
      const canCraft = game.canCraftTool(tool);
      const recipe = TOOL_RECIPE[tool];

      const fill = crafted > 0 ? '#1a2418' : '#1a1218';
      const stroke = crafted > 0 ? '#5a7a4a' : '#2a232b';
      rect(ctx, px + padX, y, pw - padX * 2, rowH, fill, stroke);

      // Color swatch
      rect(ctx, px + padX + 12, y + 10, 22, 22, TOOL_COLOR[tool], '#0a0608');

      // Title + benefit + crafted count
      text(ctx, TOOL_LABEL[tool], px + padX + 44, y + 8, {
        size: 14,
        color: '#c9b9a4',
      });
      text(ctx, `→ ${TOOL_BENEFIT[tool]}`, px + padX + 44, y + 26, {
        size: 10,
        color: '#9ed79a',
        font: "'Special Elite', monospace",
      });
      text(ctx, `crafted × ${crafted}`, px + pw - padX - 12, y + 10, {
        align: 'right',
        size: 11,
        color: crafted > 0 ? '#9ed79a' : '#7c6f5e',
        font: "'Special Elite', monospace",
      });

      // Recipe row + craft button (right-aligned)
      const ry = y + 46;
      const btnW = 88;
      const btnH = 26;
      const btnX = px + pw - padX - btnW - 8;
      const cw = 88;
      const ch = 26;
      const recipeKinds = Object.keys(recipe) as ItemKind[];
      let rx = px + padX + 12;
      for (const k of recipeKinds) {
        const need = recipe[k] ?? 0;
        const have = game.save.banked[k];
        const ok = have >= need;
        rect(ctx, rx, ry, cw, ch, ok ? `${ITEM_COLOR[k]}55` : `${ITEM_COLOR[k]}22`, '#2a232b');
        text(ctx, `${ITEM_LABEL[k]} ${have}/${need}`, rx + cw / 2, ry + 7, {
          align: 'center',
          size: 11,
          color: ok ? '#e8d9b8' : '#7a4030',
          font: "'Special Elite', monospace",
        });
        rx += cw + 6;
      }

      const btnFill = canCraft ? '#3a2c1a' : '#1a1218';
      const btnStroke = canCraft ? '#c9a14a' : '#3a2c1a';
      rect(ctx, btnX, ry, btnW, btnH, btnFill, btnStroke);
      text(ctx, canCraft ? 'CRAFT' : 'no items', btnX + btnW / 2, ry + 7, {
        align: 'center',
        size: 11,
        color: canCraft ? '#ffd76a' : '#5a4836',
        font: "'Special Elite', monospace",
      });
      this.craftRects.push({ kind: tool, rect: { x: btnX, y: ry, w: btnW, h: btnH } });

      y += rowH + rowGap;
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
    for (const c of this.craftRects) {
      if (pointInRect(x, y, c.rect.x, c.rect.y, c.rect.w, c.rect.h)) {
        game.craftTool(c.kind);
        return true;
      }
    }
    return true;
  }
}
