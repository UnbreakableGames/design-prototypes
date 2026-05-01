import type { Scene } from './Scene';
import type { Game } from '../game/Game';
import type { Input } from '../systems/Input';
import { Player, type Rect } from '../entities/Player';
import { Friend } from '../entities/Friend';
import { Workbench } from '../entities/Workbench';
import { Chest } from '../entities/Chest';
import { BasementDoor } from '../entities/BasementDoor';
import { RepairPanel } from '../ui/RepairPanel';
import { DialogPanel } from '../ui/DialogPanel';
import { rect, text, vignette, W, H, pointInRect } from '../systems/Render';
import { ALL_ITEMS, ALL_PARTS, ITEM_COLOR, ITEM_LABEL, totalItems, type PartKey } from '../types';

const ROOM: Rect = { x: 80, y: 80, w: W - 160, h: H - 160 };

export class Bedroom implements Scene {
  private player = new Player(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h - 60);
  private friend = new Friend(ROOM.x + 60, ROOM.y + 50);
  private workbench = new Workbench(ROOM.x + 150, ROOM.y + 70);
  private chest = new Chest(ROOM.x + ROOM.w - 90, ROOM.y + ROOM.h - 80);
  private door = new BasementDoor(ROOM.x + ROOM.w - 70, ROOM.y + 30);
  private repair = new RepairPanel();
  private dialog = new DialogPanel();
  private chestOpen = false;
  private resetConfirm = false;
  private resetTimer = 0;
  private hint = '';
  private flicker = 0;
  private resetBtnRect = { x: 0, y: 0, w: 0, h: 0 };

  enter(): void {}
  exit(): void {}

  private walls(): Rect[] {
    return [this.friend.bounds(), this.workbench.bounds(), this.chest.bounds(), this.door.bounds()];
  }

  update(dt: number, input: Input, game: Game): void {
    this.flicker += dt;
    this.friend.update(dt);
    if (this.resetConfirm) {
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) this.resetConfirm = false;
    }
    if (input.pressed('Escape')) {
      this.repair.close();
      this.dialog.close();
      this.chestOpen = false;
      this.resetConfirm = false;
    }

    // Dialog has priority for input — number keys pick choices.
    if (this.dialog.open) {
      for (let i = 1; i <= 9; i++) {
        if (input.pressed(`Digit${i}`)) {
          this.dialog.pickChoiceByIndex(i - 1, game);
          break;
        }
      }
      if (this.dialog.consumeRepairRequest()) this.repair.open = true;
      return;
    }
    if (this.dialog.consumeRepairRequest()) this.repair.open = true;
    if (this.repair.open || this.chestOpen) return;

    this.player.update(dt, input, this.walls(), ROOM);

    // proximity hints + interactions
    this.hint = '';
    const nearFriend = this.player.near(this.friend.x + this.friend.w / 2, this.friend.y + this.friend.h / 2, 60);
    const nearChest = this.player.near(this.chest.x + this.chest.w / 2, this.chest.y + this.chest.h / 2, 50);
    const nearDoor = this.player.near(this.door.x + this.door.w / 2, this.door.y + this.door.h / 2, 60);

    if (nearFriend) {
      const wantsToTalk = !game.save.metFriend || game.save.pendingReturn;
      this.hint = wantsToTalk ? '[space] talk to friend (...)' : '[space] talk to friend';
    } else if (nearChest) this.hint = '[space] open chest';
    else if (nearDoor) this.hint = '[space] go to the basement';

    if (input.pressed('Space')) {
      if (nearFriend) this.dialog.begin(game);
      else if (nearChest) this.chestOpen = true;
      else if (nearDoor) game.switchScene('basement');
    }
  }

  render(ctx: CanvasRenderingContext2D, game: Game): void {
    // floor
    rect(ctx, 0, 0, W, H, '#0e0c10');
    rect(ctx, ROOM.x, ROOM.y, ROOM.w, ROOM.h, '#1a1620');
    // floorboards
    ctx.strokeStyle = '#120e16';
    ctx.lineWidth = 1;
    for (let y = ROOM.y + 32; y < ROOM.y + ROOM.h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(ROOM.x, y + 0.5);
      ctx.lineTo(ROOM.x + ROOM.w, y + 0.5);
      ctx.stroke();
    }
    // wall outline
    rect(ctx, ROOM.x - 4, ROOM.y - 4, ROOM.w + 8, ROOM.h + 8, 'transparent', '#3a2c1a');

    // bed (visual flavor in opposite corner)
    rect(ctx, ROOM.x + 30, ROOM.y + ROOM.h - 130, 80, 110, '#2a1c28', '#1a1218');
    rect(ctx, ROOM.x + 38, ROOM.y + ROOM.h - 120, 64, 28, '#5b3a52', '#1a1218');
    text(ctx, 'bed', ROOM.x + 70, ROOM.y + ROOM.h - 144, {
      align: 'center',
      size: 10,
      color: '#5a4836',
      font: "'Special Elite', monospace",
    });

    this.workbench.render(ctx);
    const repairedFlags = {} as Record<PartKey, boolean>;
    for (const p of ALL_PARTS) repairedFlags[p] = game.isPartRepaired(p);
    this.friend.render(ctx, repairedFlags);
    this.chest.render(ctx);
    this.door.render(ctx);
    this.player.render(ctx);

    // Ambient floating text from the friend — suppressed while any panel is up.
    const panelOpen = this.repair.open || this.dialog.open || this.chestOpen;
    this.friend.renderAmbient(ctx, panelOpen);

    // soft vignette + flicker
    const flickerAmt = 0.5 + Math.sin(this.flicker * 8) * 0.04 + Math.sin(this.flicker * 1.7) * 0.03;
    vignette(ctx, flickerAmt);

    // title strip
    text(ctx, "DON'T GO IN THERE", 16, 16, {
      size: 18,
      color: '#7a3030',
      font: "'Special Elite', monospace",
    });
    const repaired = ALL_PARTS.filter((p) => game.isPartRepaired(p)).length;
    text(ctx, `friend repaired: ${repaired}/4   ·   deepest reached: ${game.save.deepestReached}`, 16, 40, {
      size: 11,
      color: '#7c6f5e',
      font: "'Special Elite', monospace",
    });

    if (this.hint) {
      text(ctx, this.hint, W / 2, H - 36, {
        align: 'center',
        size: 13,
        color: '#c9b9a4',
        font: "'Special Elite', monospace",
      });
    }

    this.renderResetButton(ctx);

    if (this.chestOpen) this.renderChest(ctx, game);
    this.repair.render(ctx, game);
    this.dialog.render(ctx, game);
  }

  private renderResetButton(ctx: CanvasRenderingContext2D) {
    const w = this.resetConfirm ? 180 : 110;
    const h = 22;
    const x = 16;
    const y = H - 30;
    this.resetBtnRect = { x, y, w, h };
    const fill = this.resetConfirm ? '#3a1418' : '#1a1218';
    const stroke = this.resetConfirm ? '#a5526a' : '#3a2c1a';
    rect(ctx, x, y, w, h, fill, stroke);
    text(
      ctx,
      this.resetConfirm ? 'click again to confirm' : 'reset progress',
      x + w / 2,
      y + 5,
      {
        align: 'center',
        size: 11,
        color: this.resetConfirm ? '#e8a0b0' : '#7c6f5e',
        font: "'Special Elite', monospace",
      },
    );
  }

  private renderChest(ctx: CanvasRenderingContext2D, game: Game) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(0, 0, W, H);
    const pw = 380;
    const ph = 280;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    rect(ctx, px, py, pw, ph, '#15101a', '#3a2c1a');
    text(ctx, 'CHEST', px + pw / 2, py + 18, {
      align: 'center',
      size: 18,
      color: '#c9b9a4',
    });
    text(ctx, 'banked items — safe from the basement', px + pw / 2, py + 42, {
      align: 'center',
      size: 11,
      color: '#7c6f5e',
      font: "'Special Elite', monospace",
    });

    let y = py + 74;
    const total = totalItems(game.save.banked);
    if (total === 0) {
      text(ctx, 'empty.', px + pw / 2, y + 40, {
        align: 'center',
        size: 13,
        color: '#5a4836',
        font: "'Special Elite', monospace",
      });
    } else {
      for (const k of ALL_ITEMS) {
        const n = game.save.banked[k];
        const r = { x: px + 24, y, w: pw - 48, h: 32 };
        rect(ctx, r.x, r.y, r.w, r.h, n > 0 ? '#1f1820' : '#150f17', '#2a232b');
        rect(ctx, r.x + 8, r.y + 8, 16, 16, ITEM_COLOR[k], '#0a0608');
        text(ctx, ITEM_LABEL[k], r.x + 32, r.y + 8, { color: '#c9b9a4', size: 13 });
        text(ctx, `× ${n}`, r.x + r.w - 12, r.y + 8, {
          align: 'right',
          size: 13,
          color: n > 0 ? '#c9b9a4' : '#5a4836',
          font: "'Special Elite', monospace",
        });
        y += 38;
      }
    }
    this.closeButton(ctx, px + pw - 92, py + ph - 38);
  }

  private closeButton(ctx: CanvasRenderingContext2D, x: number, y: number) {
    rect(ctx, x, y, 76, 26, '#2a1c20', '#3a2c1a');
    text(ctx, 'close [esc]', x + 38, y + 7, {
      align: 'center',
      size: 11,
      color: '#c9b9a4',
      font: "'Special Elite', monospace",
    });
    this.lastCloseRect = { x, y, w: 76, h: 26 };
  }

  private lastCloseRect = { x: 0, y: 0, w: 0, h: 0 };

  onClick(x: number, y: number, game: Game): void {
    if (this.dialog.onClick(x, y, game)) {
      if (this.dialog.consumeRepairRequest()) this.repair.open = true;
      return;
    }
    if (this.repair.onClick(x, y, game)) return;
    if (this.chestOpen) {
      if (pointInRect(x, y, this.lastCloseRect.x, this.lastCloseRect.y, this.lastCloseRect.w, this.lastCloseRect.h)) {
        this.chestOpen = false;
      }
      return;
    }
    if (
      pointInRect(x, y, this.resetBtnRect.x, this.resetBtnRect.y, this.resetBtnRect.w, this.resetBtnRect.h)
    ) {
      if (this.resetConfirm) {
        game.resetSave();
        this.resetConfirm = false;
        this.resetTimer = 0;
      } else {
        this.resetConfirm = true;
        this.resetTimer = 3;
      }
    }
  }
}
