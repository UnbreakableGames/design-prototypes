import { ESSENCE_TREE, essenceUnlockable, essenceVisible, type EssenceId, type EssenceNode } from '../skills/essence';
import type { Inventory } from '../game/types';
import { WORLD } from '../game/types';
import { closeBtnContains, drawCloseBtn, drawIconBtn } from './HUD';

const NODE_R = 28;
const PANEL_W = 620;
const PANEL_H = 380;
const PANEL_X = Math.round((WORLD.width - PANEL_W) / 2);
const PANEL_Y = Math.round((WORLD.height - PANEL_H) / 2);
const CENTER_X = PANEL_X + PANEL_W / 2;
const CENTER_Y = PANEL_Y + PANEL_H / 2 - 10;

// Right edge, just below the rebirth button. 25% smaller than the top-cluster buttons.
export const ESSENCE_TREE_BTN = { x: WORLD.width - 45 - 12, y: WORLD.height / 2 + 2, w: 45, h: 58 };

export function essenceTreeBtnContains(px: number, py: number): boolean {
  const b = ESSENCE_TREE_BTN;
  return px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h;
}

export function drawEssenceTreeButton(ctx: CanvasRenderingContext2D, hovered: boolean, open: boolean, time: number) {
  drawIconBtn(ctx, {
    rect: ESSENCE_TREE_BTN,
    iconId: 'essence',
    label: 'REBIRTH TREE',
    hovered,
    active: open,
    glowColor: '#c170ff',
    time,
    fallback: (c, cx, cy, r) => {
      c.fillStyle = open || hovered ? '#f0d8ff' : '#c170ff';
      c.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI / 6) * i - Math.PI / 2;
        const rr = i % 2 === 0 ? r : r * 0.45;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.closePath();
      c.fill();
    },
  });
}

function nodeCenter(node: EssenceNode): { x: number; y: number } {
  return { x: CENTER_X + node.x, y: CENTER_Y + node.y };
}

export function hitEssenceNode(px: number, py: number, unlocked: Set<EssenceId>): EssenceNode | null {
  for (const node of ESSENCE_TREE) {
    if (!essenceVisible(node, unlocked)) continue;
    const c = nodeCenter(node);
    const dx = px - c.x;
    const dy = py - c.y;
    if (dx * dx + dy * dy <= NODE_R * NODE_R) return node;
  }
  return null;
}

export function essenceOverlayContains(px: number, py: number): boolean {
  return px >= PANEL_X && px <= PANEL_X + PANEL_W && py >= PANEL_Y && py <= PANEL_Y + PANEL_H;
}

export const ESSENCE_PANEL = { x: PANEL_X, y: PANEL_Y, w: PANEL_W, h: PANEL_H };

export function essenceCloseBtnContains(px: number, py: number): boolean {
  return closeBtnContains(ESSENCE_PANEL, px, py);
}

export function drawEssenceTreeOverlay(
  ctx: CanvasRenderingContext2D,
  unlocked: Set<EssenceId>,
  inv: Inventory,
  hovered: EssenceNode | null,
  closeHovered = false,
) {
  // Dim backdrop.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);

  // Panel
  ctx.fillStyle = 'rgba(15, 10, 25, 0.96)';
  ctx.fillRect(PANEL_X, PANEL_Y, PANEL_W, PANEL_H);
  ctx.strokeStyle = '#c170ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(PANEL_X + 1, PANEL_Y + 1, PANEL_W - 2, PANEL_H - 2);

  // Header
  ctx.fillStyle = '#f0d8ff';
  ctx.font = 'bold 20px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('REBIRTH TREE', CENTER_X, PANEL_Y + 32);
  ctx.fillStyle = '#b6c2d1';
  ctx.font = '12px Inter Tight, sans-serif';
  ctx.fillText('permanent upgrades · paid in Essence ✦ · earn essence by rebirthing', CENTER_X, PANEL_Y + 52);

  // Essence balance
  ctx.fillStyle = '#c170ff';
  ctx.font = 'bold 14px Inter Tight, sans-serif';
  ctx.textAlign = 'end';
  ctx.fillText(`✦ ${Math.floor(inv.essence)}`, PANEL_X + PANEL_W - 16, PANEL_Y + 32);

  // Connection lines between prereqs
  ctx.strokeStyle = 'rgba(193, 112, 255, 0.35)';
  ctx.lineWidth = 2;
  for (const node of ESSENCE_TREE) {
    if (!node.prereq) continue;
    const prereqNode = ESSENCE_TREE.find((n) => n.id === node.prereq);
    if (!prereqNode || !essenceVisible(prereqNode, unlocked)) continue;
    if (!essenceVisible(node, unlocked)) continue;
    const a = nodeCenter(prereqNode);
    const b = nodeCenter(node);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Nodes
  for (const node of ESSENCE_TREE) {
    if (!essenceVisible(node, unlocked)) continue;
    const c = nodeCenter(node);
    const isUnlocked = unlocked.has(node.id);
    const canBuy = essenceUnlockable(node, unlocked, inv);

    ctx.save();
    if (isUnlocked || canBuy) {
      ctx.shadowBlur = 12;
      ctx.shadowColor = node.color;
    }
    ctx.fillStyle = isUnlocked ? `${node.color}33` : 'rgba(15,10,25,0.95)';
    // Pointy-top hexagon — matches the honeycomb arrangement of the nodes.
    drawHexPath(ctx, c.x, c.y, NODE_R);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = isUnlocked ? node.color : canBuy ? node.color : '#3a3040';
    ctx.lineWidth = isUnlocked ? 3 : 2;
    drawHexPath(ctx, c.x, c.y, NODE_R);
    ctx.stroke();

    // Name
    ctx.fillStyle = isUnlocked ? node.color : '#e6ecf3';
    ctx.font = 'bold 11px Inter Tight, sans-serif';
    ctx.textAlign = 'center';
    const nameLines = node.name.split(' ');
    if (nameLines.length === 2) {
      ctx.fillText(nameLines[0]!, c.x, c.y - 4);
      ctx.fillText(nameLines[1]!, c.x, c.y + 8);
    } else {
      ctx.fillText(node.name, c.x, c.y + 2);
    }

    // Cost / OWNED below
    ctx.font = '9px Inter Tight, sans-serif';
    if (isUnlocked) {
      ctx.fillStyle = '#7a6a3e';
      ctx.fillText('OWNED', c.x, c.y + 20);
    } else {
      ctx.fillStyle = canBuy ? '#c170ff' : '#5a5060';
      ctx.fillText(`✦ ${node.cost}`, c.x, c.y + 20);
    }
  }

  // Tooltip for hovered node
  if (hovered) {
    const c = nodeCenter(hovered);
    const tw = 240;
    const th = 56;
    let tx = Math.round(c.x - tw / 2);
    let ty = Math.round(c.y + NODE_R + 8);
    if (tx < PANEL_X + 8) tx = PANEL_X + 8;
    if (tx + tw > PANEL_X + PANEL_W - 8) tx = PANEL_X + PANEL_W - tw - 8;
    if (ty + th > PANEL_Y + PANEL_H - 8) ty = c.y - NODE_R - th - 8;

    ctx.fillStyle = 'rgba(10,5,18,0.96)';
    ctx.fillRect(tx, ty, tw, th);
    ctx.strokeStyle = hovered.color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);

    ctx.fillStyle = '#f0d8ff';
    ctx.font = 'bold 13px Inter Tight, sans-serif';
    ctx.textAlign = 'start';
    ctx.fillText(hovered.name, tx + 10, ty + 18);
    ctx.font = '11px Inter Tight, sans-serif';
    ctx.fillStyle = '#b6c2d1';
    ctx.fillText(hovered.desc, tx + 10, ty + 36);
    ctx.font = 'bold 11px Inter Tight, sans-serif';
    ctx.fillStyle = unlocked.has(hovered.id) ? '#7a6a3e' : '#c170ff';
    ctx.textAlign = 'end';
    ctx.fillText(
      unlocked.has(hovered.id) ? 'OWNED' : `✦ ${hovered.cost}`,
      tx + tw - 10,
      ty + 50,
    );
    ctx.textAlign = 'start';
  }

  ctx.textAlign = 'start';

  drawCloseBtn(ctx, ESSENCE_PANEL, closeHovered);
}

/** Trace a pointy-top hexagon path centered at (cx, cy) with circumradius r.
 *  Vertices at angles 90°, 150°, 210°, 270°, 330°, 30° (top first). */
function drawHexPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}
