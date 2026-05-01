import type { Game } from '../game/Game';
import { rect, text, pointInRect, W, H } from '../systems/Render';
import { ALL_PARTS } from '../types';
import {
  pickScene,
  type DialogScene,
} from '../dialog/Scripts';

type ChoiceRect = { rect: { x: number; y: number; w: number; h: number }; nextId: string };

export class DialogPanel {
  open = false;
  private scene: DialogScene | null = null;
  private nodeId = 'open';
  private choiceRects: ChoiceRect[] = [];
  private wantsRepair = false;

  begin(game: Game): void {
    const fullyRepaired = ALL_PARTS.every((p) => game.isPartRepaired(p));
    this.scene = pickScene(
      game.save.metFriend,
      game.save.pendingReturn,
      fullyRepaired,
      game.save.tutorialStep,
      game.save.craftingUnlocked,
      game.isPartRepaired('head'),
      game.save.firstDeathPending,
    );
    this.nodeId = 'open';
    this.open = true;
    this.wantsRepair = false;
    this.applyOnEnter(game);
  }

  close(): void {
    this.open = false;
    this.scene = null;
  }

  consumeRepairRequest(): boolean {
    if (this.wantsRepair) {
      this.wantsRepair = false;
      return true;
    }
    return false;
  }

  private applyOnEnter(game: Game): void {
    if (!this.scene) return;
    const node = this.scene[this.nodeId];
    if (!node) return;
    if (node.onEnter === 'markMet') game.markMet();
    if (node.onEnter === 'ackReturn') game.ackReturn();
    if (node.onEnter === 'ackFirstDeath') game.ackFirstDeath();
    if (node.onEnter === 'tutorialEnterBasement') {
      game.advanceTutorial('talk_to_friend', 'enter_basement');
    }
    if (node.onEnter === 'tutorialFinishReward') game.grantTutorialReward();
    if (node.onEnter === 'tutorialFinishBriefing') game.finishTutorialBriefing();
  }

  private advance(nextId: string, game: Game): void {
    if (nextId === '_end') {
      this.close();
      return;
    }
    if (nextId === '_tinker') {
      this.wantsRepair = true;
      this.close();
      return;
    }
    this.nodeId = nextId;
    this.applyOnEnter(game);
  }

  pickChoiceByIndex(i: number, game: Game): boolean {
    if (!this.open || !this.scene) return false;
    const node = this.scene[this.nodeId];
    if (!node || !node.choices) return false;
    const c = node.choices[i];
    if (!c) return false;
    this.advance(c.next, game);
    return true;
  }

  onClick(x: number, y: number, game: Game): boolean {
    if (!this.open) return false;
    for (const c of this.choiceRects) {
      if (pointInRect(x, y, c.rect.x, c.rect.y, c.rect.w, c.rect.h)) {
        this.advance(c.nextId, game);
        return true;
      }
    }
    return true; // swallow clicks while open
  }

  render(ctx: CanvasRenderingContext2D, _game: Game): void {
    if (!this.open || !this.scene) return;
    const node = this.scene[this.nodeId];
    if (!node) return;

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, W, H);

    const pw = 600;
    const ph = 360;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    rect(ctx, px, py, pw, ph, '#15101a', '#3a2c1a');

    text(ctx, '"FRIEND"', px + pw / 2, py + 18, {
      align: 'center',
      size: 11,
      color: '#7a3030',
      font: "'Special Elite', monospace",
    });

    // Friend's line — wrap to fit the panel width.
    const lines = wrapLines(ctx, node.text, pw - 80, 17, "'Special Elite', monospace");
    let ty = py + 64;
    for (const line of lines) {
      text(ctx, line, px + pw / 2, ty, {
        align: 'center',
        size: 17,
        color: '#a5526a',
        font: "'Special Elite', monospace",
      });
      ty += 26;
    }

    // Choices stacked at the bottom
    this.choiceRects = [];
    const choices = node.choices ?? [];
    const choiceH = 32;
    const choiceGap = 6;
    const choicesH = choices.length * choiceH + Math.max(0, choices.length - 1) * choiceGap;
    const startY = py + ph - 28 - choicesH;
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i]!;
      const y = startY + i * (choiceH + choiceGap);
      const r = { x: px + 30, y, w: pw - 60, h: choiceH };
      const fill = c.next === '_end' || c.next === '_tinker' ? '#1a1218' : '#1f1820';
      rect(ctx, r.x, r.y, r.w, r.h, fill, '#3a2c1a');
      text(ctx, `${i + 1}.  ${c.text}`, r.x + 14, r.y + 10, {
        size: 12,
        color: '#c9b9a4',
        font: "'Special Elite', monospace",
      });
      this.choiceRects.push({ rect: r, nextId: c.next });
    }
  }
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  s: string,
  maxWidth: number,
  size: number,
  font: string,
): string[] {
  ctx.save();
  ctx.font = `${size}px ${font}`;
  const words = s.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  ctx.restore();
  return lines;
}
