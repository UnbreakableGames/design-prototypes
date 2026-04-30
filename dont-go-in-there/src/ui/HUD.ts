import { ALL_ITEMS, ITEM_COLOR, ITEM_LABEL, type Inventory, totalItems } from '../types';
import { rect, text, W, H } from '../systems/Render';

export const CARRY_SLOTS = 4;

export function renderRunHud(
  ctx: CanvasRenderingContext2D,
  carried: Inventory,
  panic: number,
  depth: number,
  message?: string,
): void {
  // top-left: depth
  rect(ctx, 12, 12, 130, 36, 'rgba(10,8,12,0.7)', '#3a2c1a');
  text(ctx, 'DEPTH', 22, 18, { size: 9, color: '#7a3030', font: "'Special Elite', monospace" });
  text(ctx, String(depth), 22, 28, { size: 18, color: '#c9b9a4' });

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

  // bottom: carry slots
  const slotW = 56;
  const slotH = 56;
  const gap = 8;
  const totalW = slotW * CARRY_SLOTS + gap * (CARRY_SLOTS - 1);
  const startX = (W - totalW) / 2;
  const slotY = H - slotH - 14;

  // Build flat list of carried items in order
  const flat: { kind: keyof Inventory }[] = [];
  for (const k of ALL_ITEMS) {
    for (let i = 0; i < carried[k]; i++) flat.push({ kind: k });
  }

  for (let i = 0; i < CARRY_SLOTS; i++) {
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
  text(ctx, `carried ${totalItems(carried)}/${CARRY_SLOTS}`, W / 2, slotY - 14, {
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
