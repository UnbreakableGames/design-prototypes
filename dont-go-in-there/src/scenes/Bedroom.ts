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
import { CraftPanel } from '../ui/CraftPanel';
import { LoadoutPanel } from '../ui/LoadoutPanel';
import { JournalPanel } from '../ui/JournalPanel';
import { renderNotifications } from '../ui/NotificationOverlay';
import { rect, text, vignette, W, H, pointInRect, distToRect } from '../systems/Render';
import {
  ALL_PARTS,
  GENERIC_ITEMS,
  ITEM_COLOR,
  ITEM_LABEL,
  QUEST_TEXT,
  UNIQUE_ITEMS,
  totalItems,
  type PartKey,
} from '../types';

const ROOM: Rect = { x: 80, y: 80, w: W - 160, h: H - 160 };

export class Bedroom implements Scene {
  private player = new Player(ROOM.x + ROOM.w / 2, ROOM.y + ROOM.h - 60);
  // Friend now stands centered on the top wall — focal point of the room.
  private friend = new Friend(ROOM.x + (ROOM.w - 64) / 2, ROOM.y + 50);
  // Crafting table sits against the left wall, above the bed.
  private workbench = new Workbench(ROOM.x + 20, ROOM.y + 240);
  private chest = new Chest(ROOM.x + ROOM.w - 90, ROOM.y + ROOM.h - 80);
  private door = new BasementDoor(ROOM.x + ROOM.w - 110, ROOM.y + 38);
  private repair = new RepairPanel();
  private dialog = new DialogPanel();
  private craft = new CraftPanel();
  private loadout = new LoadoutPanel();
  private journal = new JournalPanel();
  private chestOpen = false;
  private resetConfirm = false;
  private resetTimer = 0;
  private hint = '';
  private flicker = 0;
  private resetBtnRect = { x: 0, y: 0, w: 0, h: 0 };

  enter(_game: Game): void {}
  exit(): void {}

  private walls(): Rect[] {
    return [this.friend.bounds(), this.workbench.bounds(), this.chest.bounds(), this.door.bounds()];
  }

  update(dt: number, input: Input, game: Game): void {
    this.flicker += dt;
    this.friend.update(dt);
    this.door.update(dt);
    if (this.resetConfirm) {
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) this.resetConfirm = false;
    }
    if (input.pressed('Escape')) {
      this.repair.close();
      this.dialog.close();
      this.craft.close();
      this.loadout.close();
      this.journal.close();
      this.chestOpen = false;
      this.resetConfirm = false;
    }
    // Journal toggle works whenever no other panel has focus.
    if (
      input.pressed('KeyJ') &&
      !this.dialog.open &&
      !this.repair.open &&
      !this.craft.open &&
      !this.loadout.open &&
      !this.chestOpen
    ) {
      this.journal.toggle();
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
    if (this.loadout.consumeDescendRequest()) {
      game.switchScene('basement');
      return;
    }
    if (this.repair.open || this.craft.open || this.loadout.open || this.chestOpen || this.journal.open) return;

    this.player.update(dt, input, this.walls(), ROOM);

    // proximity hints + interactions
    this.hint = '';
    // Distance-to-bounding-box check: works equally well from any side of the
    // entity, so tall/wide items can be approached from any direction.
    const interactPad = 24;
    const nearOf = (b: Rect) =>
      distToRect(this.player.x, this.player.y, b.x, b.y, b.w, b.h) < interactPad;
    const nearFriend = nearOf(this.friend.bounds());
    const nearChest = nearOf(this.chest.bounds());
    const nearDoor = nearOf(this.door.bounds());
    const nearWorkbench = nearOf(this.workbench.bounds());

    // Interaction gates — what the player can use right now.
    const tutorial = game.save.tutorialStep;
    const friendOnly = tutorial === 'talk_to_friend';
    const friendAndDoorOnly =
      tutorial === 'install_eyes' ||
      tutorial === 'collect_reward' ||
      tutorial === 'continue_briefing';
    // Friend talkable always.
    const canFriend = true;
    // Door open after first conversation, but locked again until each
    // tutorial conversation that requires the player to stay home wraps up.
    const canDoor =
      tutorial !== 'talk_to_friend' &&
      tutorial !== 'install_eyes' &&
      tutorial !== 'collect_reward' &&
      tutorial !== 'continue_briefing';
    // Chest visible/usable post-FTUE.
    const canChest = tutorial === 'done';
    // Workbench locked until super_glue is found.
    const canWorkbench = tutorial === 'done' && game.save.craftingUnlocked;

    if (nearFriend && canFriend) {
      const wantsToTalk = !game.save.metFriend || game.save.pendingReturn || tutorial !== 'done';
      this.hint = wantsToTalk ? '[space] talk to "friend" (...)' : '[space] talk to "friend"';
    } else if (nearWorkbench) {
      this.hint = canWorkbench
        ? '[space] craft tools at the table'
        : '...the table is broken. you need glue.';
    } else if (nearChest) {
      this.hint = canChest ? '[space] open chest' : '...the chest is locked.';
    } else if (nearDoor) {
      if (friendOnly) this.hint = '...the "friend" wants to talk to you first.';
      else if (tutorial === 'install_eyes') this.hint = '...install the eyes first.';
      else if (tutorial === 'collect_reward') this.hint = '...the "friend" has something for you.';
      else if (tutorial === 'continue_briefing') this.hint = '...the "friend" has more to say.';
      else if (friendAndDoorOnly) this.hint = '...not yet.';
      else this.hint = '[space] go to the basement';
    }

    if (input.pressed('Space')) {
      if (nearFriend && canFriend) this.dialog.begin(game);
      else if (nearWorkbench && canWorkbench) this.craft.open = true;
      else if (nearWorkbench && !canWorkbench && game.save.tutorialStep === 'done') {
        // First time the player tries to use the locked table — discover the
        // super-glue quest. Idempotent, so subsequent presses are silent.
        game.discoverQuest('super_glue', 'Find Super Glue');
      } else if (nearChest && canChest) this.chestOpen = true;
      else if (nearDoor && canDoor) {
        // Skip the loadout panel during the FTUE — first descent is rails-on.
        if (game.isTutorialActive()) {
          game.advanceTutorial('enter_basement', 'find_eyes');
          game.switchScene('basement');
        } else {
          this.loadout.begin();
        }
      }
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
    // wall outline + crayon-y wallpaper border (small ticks)
    rect(ctx, ROOM.x - 4, ROOM.y - 4, ROOM.w + 8, ROOM.h + 8, 'transparent', '#3a2c1a');
    ctx.fillStyle = '#2a1f28';
    for (let bx = ROOM.x + 12; bx < ROOM.x + ROOM.w - 12; bx += 24) {
      ctx.fillRect(bx, ROOM.y + 4, 8, 2);
      ctx.fillRect(bx, ROOM.y + ROOM.h - 6, 8, 2);
    }

    // Wall drawings — taped-up kid scribbles along the upper wall.
    this.renderWallDrawings(ctx);

    // Rug in the middle of the floor (so toys + entities sit on top of it).
    this.renderRug(ctx);

    // Bed — base + plush blanket + pillow + teddy bear.
    const bedX = ROOM.x + 30;
    const bedY = ROOM.y + ROOM.h - 130;
    const bedW = 80;
    const bedH = 110;
    rect(ctx, bedX, bedY, bedW, bedH, '#2a1c28', '#1a1218');
    rect(ctx, bedX + 4, bedY + 4, bedW - 8, bedH - 8, '#3b2a44', '#1a1218');
    // pillow at the head of the bed
    rect(ctx, bedX + 8, bedY + 8, bedW - 16, 18, '#e8d9b8', '#7a5a3a');
    // patterned blanket (stripes)
    const blanketY = bedY + 32;
    rect(ctx, bedX + 4, blanketY, bedW - 8, bedH - 36, '#5b3a52', '#1a1218');
    ctx.fillStyle = '#7a4a6a';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(bedX + 4, blanketY + 8 + i * 16, bedW - 8, 4);
    }
    // teddy bear sitting on the pillow
    this.renderTeddy(ctx, bedX + bedW / 2, bedY + 16);

    text(ctx, 'bed', bedX + bedW / 2, bedY - 14, {
      align: 'center',
      size: 10,
      color: '#5a4836',
      font: "'Special Elite', monospace",
    });

    // Scattered toys — blocks + a ball.
    this.renderToys(ctx);

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
    text(ctx, `"friend" repaired: ${repaired}/4   ·   deepest reached: ${game.save.deepestReached}`, 16, 40, {
      size: 11,
      color: '#7c6f5e',
      font: "'Special Elite', monospace",
    });
    // FTUE: scripted directive overrides the standard "what's needed" line.
    const tutorialStep = game.save.tutorialStep;
    if (tutorialStep !== 'done') {
      const questText = QUEST_TEXT[tutorialStep];
      // Glowing quest banner at the top, centered.
      rect(ctx, W / 2 - 200, 14, 400, 28, 'rgba(40,10,20,0.85)', '#7a3030');
      text(ctx, '› ' + questText, W / 2, 22, {
        align: 'center',
        size: 13,
        color: '#ffd76a',
        font: "'Special Elite', monospace",
      });
    }

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
    this.craft.render(ctx, game);
    this.loadout.render(ctx, game);
    this.journal.render(ctx, game);
    this.dialog.render(ctx, game);
    renderNotifications(ctx, game);
  }

  private renderWallDrawings(ctx: CanvasRenderingContext2D) {
    // Posters, a polaroid, and a schematic blueprint pinned to the LEFT wall.
    // 12-year-old vibe: sci-fi/robot interest, music, photo with the friend.

    // 1) Sci-fi/robot poster
    const p1 = { x: ROOM.x + 128, y: ROOM.y + 6, w: 56, h: 70 };
    rect(ctx, p1.x, p1.y, p1.w, p1.h, '#1a1f3a', '#7a5a3a');
    rect(ctx, p1.x + 3, p1.y + 3, p1.w - 6, p1.h - 6, '#2a2f4a', '#1a1f3a');
    // robot silhouette
    ctx.fillStyle = '#c9a14a';
    ctx.fillRect(p1.x + p1.w / 2 - 6, p1.y + 14, 12, 10); // head
    ctx.fillRect(p1.x + p1.w / 2 - 9, p1.y + 26, 18, 16); // body
    ctx.fillRect(p1.x + p1.w / 2 - 4, p1.y + 44, 3, 10); // leg
    ctx.fillRect(p1.x + p1.w / 2 + 1, p1.y + 44, 3, 10); // leg
    // robot eyes
    ctx.fillStyle = '#a5526a';
    ctx.fillRect(p1.x + p1.w / 2 - 3, p1.y + 18, 2, 2);
    ctx.fillRect(p1.x + p1.w / 2 + 1, p1.y + 18, 2, 2);
    text(ctx, 'BOTS OF MARS', p1.x + p1.w / 2, p1.y + p1.h - 12, {
      align: 'center',
      size: 7,
      color: '#c9a14a',
      font: "'Special Elite', monospace",
    });

    // 2) Band poster — lightning bolt
    const p2 = { x: ROOM.x + 196, y: ROOM.y + 12, w: 48, h: 60 };
    rect(ctx, p2.x, p2.y, p2.w, p2.h, '#3a1418', '#7a5a3a');
    rect(ctx, p2.x + 3, p2.y + 3, p2.w - 6, p2.h - 6, '#5a1c20', '#3a1418');
    ctx.fillStyle = '#c9a14a';
    ctx.beginPath();
    ctx.moveTo(p2.x + 26, p2.y + 10);
    ctx.lineTo(p2.x + 18, p2.y + 30);
    ctx.lineTo(p2.x + 24, p2.y + 30);
    ctx.lineTo(p2.x + 18, p2.y + 46);
    ctx.lineTo(p2.x + 32, p2.y + 24);
    ctx.lineTo(p2.x + 24, p2.y + 24);
    ctx.closePath();
    ctx.fill();
    text(ctx, 'STORM BOY', p2.x + p2.w / 2, p2.y + p2.h - 12, {
      align: 'center',
      size: 8,
      color: '#c9a14a',
      font: "'Special Elite', monospace",
    });

    // 3) Polaroid — kid + the friend
    const ph = { x: ROOM.x + 256, y: ROOM.y + 14, w: 42, h: 50 };
    rect(ctx, ph.x, ph.y, ph.w, ph.h, '#e8d9b8', '#7a5a3a');
    rect(ctx, ph.x + 4, ph.y + 4, ph.w - 8, ph.h - 18, '#3a2820', '#1a120a');
    // tiny figures
    ctx.fillStyle = '#c9a14a';
    ctx.beginPath();
    ctx.arc(ph.x + 14, ph.y + 18, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(ph.x + 11, ph.y + 21, 6, 8);
    ctx.fillStyle = '#9aa3ad';
    ctx.beginPath();
    ctx.arc(ph.x + ph.w - 14, ph.y + 18, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(ph.x + ph.w - 17, ph.y + 21, 6, 8);
    text(ctx, 'me + "friend"', ph.x + ph.w / 2, ph.y + ph.h - 12, {
      align: 'center',
      size: 7,
      color: '#5a4836',
      font: "'Special Elite', monospace",
    });

    // 4) Schematic / blueprint pinned at an angle
    const p4 = { x: ROOM.x + 312, y: ROOM.y + 8, w: 50, h: 64 };
    rect(ctx, p4.x, p4.y, p4.w, p4.h, '#1a3a4a', '#7a5a3a');
    rect(ctx, p4.x + 3, p4.y + 3, p4.w - 6, p4.h - 6, '#1a4a5a', '#1a3a4a');
    ctx.strokeStyle = '#3a6a7a';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(p4.x + 3 + i * 9, p4.y + 3);
      ctx.lineTo(p4.x + 3 + i * 9, p4.y + p4.h - 3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p4.x + 3, p4.y + 3 + i * 11);
      ctx.lineTo(p4.x + p4.w - 3, p4.y + 3 + i * 11);
      ctx.stroke();
    }
    ctx.strokeStyle = '#7ec0ee';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p4.x + 8, p4.y + 14);
    ctx.lineTo(p4.x + p4.w - 8, p4.y + 14);
    ctx.lineTo(p4.x + p4.w - 8, p4.y + p4.h - 18);
    ctx.lineTo(p4.x + 8, p4.y + p4.h - 18);
    ctx.closePath();
    ctx.stroke();
    text(ctx, 'PROTO 7', p4.x + p4.w / 2, p4.y + p4.h - 12, {
      align: 'center',
      size: 7,
      color: '#7ec0ee',
      font: "'Special Elite', monospace",
    });

    // Pushpin / tape on each piece
    ctx.fillStyle = '#a5526a';
    for (const p of [p1, p2, ph, p4]) {
      ctx.beginPath();
      ctx.arc(p.x + p.w / 2, p.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private renderRug(ctx: CanvasRenderingContext2D) {
    const rx = ROOM.x + 280;
    const ry = ROOM.y + 220;
    const rw = 240;
    const rh = 130;
    // outer trim
    rect(ctx, rx, ry, rw, rh, '#6b3a4a', '#3a1c2a');
    rect(ctx, rx + 4, ry + 4, rw - 8, rh - 8, '#7e4a5a', '#3a1c2a');
    // diamond pattern in the center
    ctx.fillStyle = '#5a2c3a';
    ctx.beginPath();
    ctx.moveTo(rx + rw / 2, ry + 18);
    ctx.lineTo(rx + rw - 22, ry + rh / 2);
    ctx.lineTo(rx + rw / 2, ry + rh - 18);
    ctx.lineTo(rx + 22, ry + rh / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#9a5a6a';
    ctx.beginPath();
    ctx.moveTo(rx + rw / 2, ry + 32);
    ctx.lineTo(rx + rw - 38, ry + rh / 2);
    ctx.lineTo(rx + rw / 2, ry + rh - 32);
    ctx.lineTo(rx + 38, ry + rh / 2);
    ctx.closePath();
    ctx.fill();
    // tassel marks at edges
    ctx.fillStyle = '#5a2c3a';
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(rx - 4, ry + 12 + i * 14, 4, 6);
      ctx.fillRect(rx + rw, ry + 12 + i * 14, 4, 6);
    }
  }

  private renderTeddy(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    // Hoodie thrown casually on top of the bed — a 12-year-old's room signature.
    const w = 38;
    const h = 26;
    const x = cx - w / 2;
    const y = cy;
    // Hood (back of the hoodie sticks up a bit)
    ctx.fillStyle = '#2a3a4a';
    ctx.beginPath();
    ctx.arc(cx, y + 4, 9, Math.PI, 0, false);
    ctx.fill();
    // Body of the hoodie
    rect(ctx, x, y + 4, w, h - 4, '#3a4a5a', '#1a2a3a');
    // Front pocket
    rect(ctx, x + 8, y + 14, w - 16, 6, '#2a3a4a', '#1a2a3a');
    // Drawstrings hanging down
    ctx.strokeStyle = '#e8d9b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 4, y + 6);
    ctx.lineTo(cx - 4, y + 14);
    ctx.moveTo(cx + 4, y + 6);
    ctx.lineTo(cx + 4, y + 14);
    ctx.stroke();
    // Tiny printed logo on the chest
    ctx.fillStyle = '#c9a14a';
    ctx.fillRect(cx - 4, y + 10, 8, 2);
  }

  private renderToys(ctx: CanvasRenderingContext2D) {
    // Stacked comic books on the floor — three issues fanned slightly.
    const stackX = ROOM.x + 230;
    const stackY = ROOM.y + 392;
    const issues = [
      { dx: 0, dy: 12, fill: '#5a8aa5', accent: '#c9a14a' },
      { dx: 2, dy: 6, fill: '#7a3030', accent: '#e8d9b8' },
      { dx: 4, dy: 0, fill: '#3a3a3a', accent: '#a5526a' },
    ];
    for (const iss of issues) {
      const x = stackX + iss.dx;
      const y = stackY + iss.dy;
      rect(ctx, x, y, 44, 8, iss.fill, '#0a0608');
      // banner / spine accent
      ctx.fillStyle = iss.accent;
      ctx.fillRect(x + 2, y + 2, 6, 4);
    }
    text(ctx, 'COMIX', stackX + 26, stackY - 6, {
      align: 'center',
      size: 7,
      color: '#7c6f5e',
      font: "'Special Elite', monospace",
    });

    // Basketball next to the rug
    const ballX = ROOM.x + 590;
    const ballY = ROOM.y + 380;
    ctx.fillStyle = '#c97a3a';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0a0608';
    ctx.lineWidth = 1.2;
    // vertical seam
    ctx.beginPath();
    ctx.moveTo(ballX, ballY - 11);
    ctx.lineTo(ballX, ballY + 11);
    ctx.stroke();
    // horizontal seam
    ctx.beginPath();
    ctx.moveTo(ballX - 11, ballY);
    ctx.lineTo(ballX + 11, ballY);
    ctx.stroke();
    // curved seams
    ctx.beginPath();
    ctx.arc(ballX, ballY, 11, -Math.PI * 0.32, Math.PI * 0.32);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(ballX, ballY, 11, Math.PI * 0.68, Math.PI * 1.32);
    ctx.stroke();
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
    const pw = 520;
    const ph = 320;
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

    const total = totalItems(game.save.banked);
    if (total === 0) {
      text(ctx, 'empty.', px + pw / 2, py + 130, {
        align: 'center',
        size: 13,
        color: '#5a4836',
        font: "'Special Elite', monospace",
      });
    } else {
      // Two columns: GENERIC on the left, UNIQUE (friend parts) on the right.
      const colW = (pw - 56) / 2;
      const colGap = 12;
      const leftX = px + 20;
      const rightX = leftX + colW + colGap;
      const headerY = py + 76;
      const rowH = 28;
      const rowGap = 4;

      text(ctx, 'GENERIC', leftX + colW / 2, headerY, {
        align: 'center',
        size: 10,
        color: '#7a3030',
        font: "'Special Elite', monospace",
      });
      text(ctx, 'UNIQUE', rightX + colW / 2, headerY, {
        align: 'center',
        size: 10,
        color: '#7a3030',
        font: "'Special Elite', monospace",
      });

      const startY = headerY + 16;
      const renderRow = (k: typeof GENERIC_ITEMS[number], x: number, y: number) => {
        const n = game.save.banked[k];
        rect(ctx, x, y, colW, rowH, n > 0 ? '#1f1820' : '#150f17', '#2a232b');
        rect(ctx, x + 6, y + 6, 16, 16, ITEM_COLOR[k], '#0a0608');
        text(ctx, ITEM_LABEL[k], x + 28, y + 7, { color: '#c9b9a4', size: 12 });
        text(ctx, `× ${n}`, x + colW - 10, y + 7, {
          align: 'right',
          size: 12,
          color: n > 0 ? '#c9b9a4' : '#5a4836',
          font: "'Special Elite', monospace",
        });
      };

      for (let i = 0; i < GENERIC_ITEMS.length; i++) {
        renderRow(GENERIC_ITEMS[i]!, leftX, startY + i * (rowH + rowGap));
      }
      for (let i = 0; i < UNIQUE_ITEMS.length; i++) {
        renderRow(UNIQUE_ITEMS[i]!, rightX, startY + i * (rowH + rowGap));
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
    if (this.loadout.onClick(x, y, game)) return;
    if (this.craft.onClick(x, y, game)) return;
    if (this.repair.onClick(x, y, game)) return;
    if (this.journal.onClick(x, y)) return;
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
