import {
  ALL_ITEMS,
  ALL_TOOLS,
  ITEM_COLOR,
  ITEM_LABEL,
  TOOL_COLOR,
  TOOL_LABEL,
  type Equipped,
  type Inventory,
  totalItems,
} from '../types';
import { rect, text, W, H } from '../systems/Render';

// Bare-hands carry capacity. Game.carrySlots() raises this with the
// arm-repair bonus (+2) and/or the backpack tool (+1).
export const BASE_CARRY_SLOTS = 1;

export function renderRunHud(
  ctx: CanvasRenderingContext2D,
  carried: Inventory,
  panic: number,
  depth: number,
  slots: number,
  equipped: Equipped,
  message?: string,
): void {
  // top-left: depth
  rect(ctx, 12, 12, 130, 36, 'rgba(10,8,12,0.7)', '#3a2c1a');
  text(ctx, 'DEPTH', 22, 18, { size: 9, color: '#7a3030', font: "'Special Elite', monospace" });
  text(ctx, String(depth), 22, 28, { size: 18, color: '#c9b9a4' });

  // Equipped tools row, just below the depth box
  let toolY = 56;
  let anyTool = false;
  for (const t of ALL_TOOLS) {
    const n = equipped[t];
    if (n <= 0) continue;
    if (!anyTool) {
      text(ctx, 'TOOLS', 12, toolY, { size: 9, color: '#7a3030', font: "'Special Elite', monospace" });
      toolY += 12;
      anyTool = true;
    }
    rect(ctx, 12, toolY, 8, 8, TOOL_COLOR[t], '#0a0608');
    text(ctx, `${TOOL_LABEL[t]} × ${n}`, 24, toolY - 1, {
      size: 10,
      color: '#9ed79a',
      font: "'Special Elite', monospace",
    });
    toolY += 12;
  }

  // top-right: panic meter
  const pw = 220;
  const ph = 18;
  const px = W - pw - 12;
  const py = 14;
  text(ctx, 'PANIC', px, py - 12, { size: 9, color: '#7a3030', font: "'Special Elite', monospace" });
  rect(ctx, px, py, pw, ph, '#1a1218', '#3a2c1a');
  const pct = Math.max(0, Math.min(1, panic / 100));
  const fill = pct > 0.7 ? '#a5526a' : pct > 0.4 ? '#c9a14a' : '#7ea76b';
  rect(ctx, px + 1, py + 1, (pw - 2) * pct, ph - 2, fill);

  // bottom: carry slots — width scales with slot count so 4 vs 6 slots both fit
  const slotW = 56;
  const slotH = 56;
  const gap = 8;
  const totalW = slotW * slots + gap * Math.max(0, slots - 1);
  const startX = (W - totalW) / 2;
  const slotY = H - slotH - 14;

  // Build flat list of carried items in order
  const flat: { kind: keyof Inventory }[] = [];
  for (const k of ALL_ITEMS) {
    for (let i = 0; i < carried[k]; i++) flat.push({ kind: k });
  }

  for (let i = 0; i < slots; i++) {
    const x = startX + i * (slotW + gap);
    const item = flat[i];
    rect(ctx, x, slotY, slotW, slotH, item ? '#1f1820' : '#120e16', '#3a2c1a');
    if (item) {
      rect(ctx, x + 14, slotY + 14, slotW - 28, slotH - 28, ITEM_COLOR[item.kind], '#0a0608');
      text(ctx, ITEM_LABEL[item.kind], x + slotW / 2, slotY + slotH - 14, {
        align: 'center',
        size: 9,
        color: '#a59886',
        font: "'Special Elite', monospace",
      });
    }
  }
  text(ctx, `carried ${totalItems(carried)}/${slots}`, W / 2, slotY - 14, {
    align: 'center',
    size: 10,
    color: '#7c6f5e',
    font: "'Special Elite', monospace",
  });

  if (message) {
    text(ctx, message, W / 2, H / 2 - 10, {
      align: 'center',
      size: 18,
      color: '#a5526a',
      font: "'Special Elite', monospace",
    });
  }
}
