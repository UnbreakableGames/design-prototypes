import type { Inventory } from '../game/types';
import { WORLD } from '../game/types';
import { closeBtnContains, drawCloseBtn, drawIconBtn } from './HUD';
import { getIcon, type IconId } from './icons';

/** Best-guess perk → icon mapping. Tiered luck/dice perks get colored upgrade
 *  variants (gold/purple/rainbow) so the tree visually reads as a progression. */
function iconForPerk(id: PerkId): IconId | null {
  if (id.startsWith('spitterSlot')) return 'spitter';
  if (id.startsWith('spitterDmg')) return 'exclamation';
  if (id.startsWith('spitterCrit')) return 'star';
  // PLAYER-branch leading nodes — avatar carry pockets + click-to-shoot.
  if (id.startsWith('playerCarry')) return 'backpack';
  if (id === 'shootUnlock') return 'attack';
  if (id === 'shootDmg1') return 'star';
  if (id === 'runnerUnlock') return 'runner';
  if (id.startsWith('runnerSlot')) return 'runner';
  if (id.startsWith('carryCap')) return 'backpack';
  if (id.startsWith('fasterDrop')) return 'star';
  if (id.startsWith('fasterPickup')) return 'backpack';
  if (id.startsWith('runnerSpeed')) return 'runner';
  if (id.startsWith('reclaimReduce')) return 'exclamation';
  if (id.startsWith('floorMax')) return 'backpack';
  if (id.startsWith('dropChance')) return 'gift';
  if (id.startsWith('biggerCoins')) return 'gold';
  if (id.startsWith('heavyDrops')) return 'gift';
  if (id.startsWith('biggerGems')) return 'gem';
  // Luck tiers: base green → gold → rainbow as the row gets chunkier
  if (id === 'luckyFoot' || id === 'fourLeaf' || id === 'horseshoe') return 'luck';
  if (id === 'lucky4') return 'luckGold';
  if (id === 'lucky5' || id === 'lucky6') return 'luckRainbow';
  // Economy tiers
  if (id === 'cheaperSpin1' || id === 'cheaperSpin2' || id === 'cheaperSpin3') return 'dice';
  if (id.startsWith('cheaperSpin')) return 'diceGold';
  if (id === 'autoSpin') return 'autoRoll';
  if (id === 'rollMul2') return 'diceGold';
  if (id === 'rollMul4' || id === 'rollMul8') return 'diceRainbow';
  if (id === 'luxurySpin') return 'diceGold';
  if (id === 'royalSpin') return 'diceRainbow';
  return null;
}
import {
  BRANCH_COLORS,
  BRANCH_DIR,
  BRANCH_NAMES,
  SKILL_TREE,
  isVisible,
  isMystery,
  isUnlockable,
  canAfford,
  type Branch,
  type PerkId,
  type SkillNode,
} from '../skills/tree';

// Sits left of the (larger) dice. Dice half-width 36, gap 24 so the spinning
// slot reel (SLOT_W=92, ends ~10px past dice each side) doesn't cover the
// "SKILL TREE" label during a spin.
export const TREE_BTN = { x: WORLD.width / 2 - 36 - 24 - 60, y: 14, w: 60, h: 78 };

// Smaller hex size now that the tree has 12 nodes per branch (radial depth).
// Players can pan the overlay (drag) if they want to inspect the outer reaches.
const HEX_SIZE = 22;
const HEX_W = Math.sqrt(3) * HEX_SIZE;
const ROW_STEP = (3 / 2) * HEX_SIZE;
export const CENTER_X = WORLD.width / 2;
export const CENTER_Y = (WORLD.height - WORLD.collectionPanelH) / 2 + 10;

export function treeBtnContains(px: number, py: number) {
  const cx = TREE_BTN.x + TREE_BTN.w / 2;
  const cy = TREE_BTN.y + TREE_BTN.h / 2;
  const r = TREE_BTN.w / 2;
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

export function hexToPixel(q: number, r: number, panX = 0, panY = 0, zoom = 1) {
  return {
    x: CENTER_X + panX + HEX_W * (q + r / 2) * zoom,
    y: CENTER_Y + panY + ROW_STEP * r * zoom,
  };
}

export function hitVisibleHex(
  px: number,
  py: number,
  unlocked: Set<PerkId>,
  panX = 0,
  panY = 0,
  zoom = 1,
): SkillNode | null {
  const size = HEX_SIZE * zoom;
  for (const node of SKILL_TREE) {
    if (!isVisible(node, unlocked)) continue;
    const { x, y } = hexToPixel(node.q, node.r, panX, panY, zoom);
    const dx = px - x;
    const dy = py - y;
    if (dx * dx + dy * dy <= size * size * 0.95) return node;
  }
  return null;
}

export function drawTreeButton(
  ctx: CanvasRenderingContext2D,
  hovered: boolean,
  open: boolean,
  time: number,
  availableCount: number = 0,
) {
  drawIconBtn(ctx, {
    rect: TREE_BTN,
    iconId: 'tree',
    label: 'SKILL TREE',
    hovered,
    active: open,
    glowColor: '#ff5050',
    time,
    fallback: (c, cx, cy, r) => drawUpArrow(c, cx, cy, r, open || hovered, time),
  });
  // Plain pulsing dot when ANY single perk is buyable — no number, no count.
  // The badge is a "there's something here" hint; once it's lit, the player
  // can open the tree and decide what to spend on.
  if (availableCount > 0 && !open) {
    const r = TREE_BTN;
    const cx = r.x + r.w - 6;
    const cy = r.y + 6;
    const pulse = 1 + 0.18 * Math.sin(time * 6);
    ctx.fillStyle = '#ff5a5a';
    ctx.beginPath();
    ctx.arc(cx, cy, 6 * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawUpArrow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  active: boolean,
  time: number
) {
  // Bobbing nudge — the arrow gently lifts when idle to look alive
  const bob = !active ? Math.sin(time * 3) * 1.2 : 0;
  const headW = size * 0.85;
  const headH = size * 0.55;
  const stemW = size * 0.32;
  const stemH = size * 0.40;
  const topY = cy - size * 0.55 + bob;
  const headBaseY = topY + headH;
  const stemBaseY = headBaseY + stemH;

  ctx.beginPath();
  ctx.moveTo(cx, topY);                       // tip
  ctx.lineTo(cx + headW / 2, headBaseY);      // bottom-right of arrowhead
  ctx.lineTo(cx + stemW / 2, headBaseY);      // step in to stem
  ctx.lineTo(cx + stemW / 2, stemBaseY);      // stem bottom-right
  ctx.lineTo(cx - stemW / 2, stemBaseY);      // stem bottom-left
  ctx.lineTo(cx - stemW / 2, headBaseY);      // step out
  ctx.lineTo(cx - headW / 2, headBaseY);      // bottom-left of arrowhead
  ctx.closePath();

  // Fill with vertical gradient so it has a little dimension
  const grad = ctx.createLinearGradient(0, topY, 0, stemBaseY);
  grad.addColorStop(0, active ? '#ff9090' : '#ff6464');
  grad.addColorStop(1, active ? '#cc2424' : '#a02020');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#5a0808';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Sparkle on the tip
  const twinkle = 0.7 + 0.3 * Math.sin(time * 6);
  ctx.fillStyle = `rgba(255, 220, 220, ${twinkle})`;
  ctx.beginPath();
  ctx.arc(cx, topY + 2, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Bounds of the tree overlay — used to position the close button. */
export const TREE_PANEL = { x: 0, y: 0, w: WORLD.width, h: WORLD.height - WORLD.collectionPanelH };

export function treeCloseBtnContains(px: number, py: number): boolean {
  return closeBtnContains(TREE_PANEL, px, py);
}

export function drawSkillTreeOverlay(
  ctx: CanvasRenderingContext2D,
  unlocked: Set<PerkId>,
  inv: Inventory,
  hoveredNode: SkillNode | null,
  panX = 0,
  panY = 0,
  zoom = 1,
  closeHovered = false,
) {
  ctx.fillStyle = 'rgba(8,10,18,0.85)';
  ctx.fillRect(0, 0, WORLD.width, WORLD.height - WORLD.collectionPanelH);

  ctx.fillStyle = '#e6ecf3';
  ctx.font = 'bold 18px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BEE TREE', WORLD.width / 2, 36);
  ctx.font = '11px Inter Tight, sans-serif';
  ctx.fillStyle = '#6a7080';
  ctx.fillText(
    'drag to pan · scroll / pinch to zoom · click a hex to unlock · X to close',
    WORLD.width / 2,
    54
  );
  ctx.textAlign = 'start';

  drawBranchLabels(ctx, panX, panY, zoom);

  const size = HEX_SIZE * zoom;
  // Mystery hexes (one hop past the visible frontier) draw first, beneath the
  // real hexes — they show as faint "?" placeholders.
  for (const node of SKILL_TREE) {
    if (!isMystery(node, unlocked)) continue;
    const { x, y } = hexToPixel(node.q, node.r, panX, panY, zoom);
    if (x < -size * 2 || x > WORLD.width + size * 2) continue;
    if (y < -size * 2 || y > WORLD.height - WORLD.collectionPanelH - size * 0.5) continue;
    drawMysteryHex(ctx, x, y, size);
  }
  for (const node of SKILL_TREE) {
    if (!isVisible(node, unlocked)) continue;
    const { x, y } = hexToPixel(node.q, node.r, panX, panY, zoom);
    if (x < -size * 2 || x > WORLD.width + size * 2) continue;
    if (y < -size * 2 || y > WORLD.height - WORLD.collectionPanelH - size * 0.5) continue;
    const u = unlocked.has(node.id);
    const unlockable = isUnlockable(node, unlocked, inv);
    const affordable = canAfford(node, inv);
    drawHex(ctx, x, y, size, u, unlockable, affordable, node);
  }

  if (hoveredNode) {
    drawNodeTooltip(ctx, hoveredNode, panX, panY, zoom);
  }

  ctx.textAlign = 'start';

  drawCloseBtn(ctx, TREE_PANEL, closeHovered);
}

function drawBranchLabels(ctx: CanvasRenderingContext2D, panX: number, panY: number, zoom = 1) {
  const byBranch = new Map<Branch, SkillNode[]>();
  for (const n of SKILL_TREE) {
    if (n.branch === 'root') continue;
    const b = n.branch as Branch;
    if (!byBranch.has(b)) byBranch.set(b, []);
    byBranch.get(b)!.push(n);
  }
  ctx.font = 'bold 11px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  for (const [branch, nodes] of byBranch) {
    let tip = nodes[0]!;
    for (const n of nodes) {
      if (axialDist(n.q, n.r) > axialDist(tip.q, tip.r)) tip = n;
    }
    const [dq, dr] = BRANCH_DIR[branch];
    const labelQ = tip.q + dq;
    const labelR = tip.r + dr;
    const { x, y } = hexToPixel(labelQ, labelR, panX, panY, zoom);
    ctx.fillStyle = BRANCH_COLORS[branch];
    ctx.fillText(BRANCH_NAMES[branch], x, y + 4);
  }
  ctx.textAlign = 'start';
}

function axialDist(q: number, r: number) {
  return (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
}

/** Faint hex placeholder shown one hop past the unlocked frontier. Hints
 *  there's more to discover without revealing the perk's identity or cost. */
function drawMysteryHex(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + i * (Math.PI / 3);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(20, 24, 34, 0.6)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(80, 90, 110, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(140, 150, 170, 0.55)';
  ctx.font = `bold ${Math.round(size * 0.9)}px Inter Tight, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('?', cx, cy + size * 0.32);
  ctx.textAlign = 'start';
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  unlocked: boolean,
  unlockable: boolean,
  affordable: boolean,
  node: SkillNode
) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = Math.PI / 6 + i * (Math.PI / 3);
    const x = cx + size * Math.cos(angle);
    const y = cy + size * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();

  if (unlocked) {
    ctx.fillStyle = '#352a1c';
  } else if (unlockable) {
    ctx.fillStyle = '#16202e';
  } else if (affordable) {
    ctx.fillStyle = '#12161f';
  } else {
    ctx.fillStyle = '#0c0e15';
  }
  ctx.fill();

  const branchColor =
    node.branch !== 'root' ? BRANCH_COLORS[node.branch as Branch] : '#ffd24a';
  ctx.strokeStyle = unlocked
    ? branchColor
    : unlockable
    ? branchColor
    : affordable
    ? '#3a4050'
    : '#2a303a';
  ctx.lineWidth = unlocked ? 2.5 : unlockable ? 1.8 : 1.5;
  ctx.stroke();

  // Icon centered (PNG if mapped + loaded). Locked nodes desaturate via alpha.
  const iconId = node.branch === 'root' ? null : iconForPerk(node.id as PerkId);
  const icon = iconId ? getIcon(iconId) : null;
  if (icon) {
    const s = size * 1.05;
    ctx.save();
    if (!unlocked && !unlockable) ctx.globalAlpha = 0.35;
    ctx.drawImage(icon, cx - s / 2, cy - s / 2 - 4, s, s);
    ctx.restore();
  } else {
    // Fallback: short name label centered.
    ctx.fillStyle = unlocked ? '#ffd24a' : unlockable ? '#e6ecf3' : '#6a7080';
    ctx.font = 'bold 9px Inter Tight, sans-serif';
    ctx.textAlign = 'center';
    const name = node.name;
    const idx = name.indexOf(' ');
    if (idx > 0 && ctx.measureText(name).width > size * 1.6) {
      ctx.fillText(name.slice(0, idx), cx, cy - 4);
      ctx.fillText(name.slice(idx + 1), cx, cy + 8);
    } else {
      ctx.fillText(name, cx, cy + 2);
    }
  }

  // Cost / status below the icon
  ctx.font = '9px Inter Tight, sans-serif';
  ctx.textAlign = 'center';
  if (unlocked && !node.repeatable) {
    ctx.fillStyle = '#7a6a3e';
    ctx.fillText('OWNED', cx, cy + size * 0.7);
  } else {
    const parts: string[] = [];
    if (node.costGold !== undefined) parts.push(`${node.costGold}g`);
    if (node.costGems !== undefined) parts.push(`${node.costGems}◆`);
    if (node.costRolls !== undefined) parts.push(`${node.costRolls}🎲`);
    ctx.fillStyle = affordable ? '#ffd24a' : '#5a5060';
    ctx.fillText(parts.join(' · '), cx, cy + size * 0.7);
  }
  ctx.textAlign = 'start';
}

function drawNodeTooltip(ctx: CanvasRenderingContext2D, node: SkillNode, panX = 0, panY = 0, zoom = 1) {
  const w = 220;
  const h = 56;
  const size = HEX_SIZE * zoom;
  const { x: hx, y: hy } = hexToPixel(node.q, node.r, panX, panY, zoom);
  let x = Math.round(hx - w / 2);
  let y = Math.round(hy + size + 8);
  if (x < 10) x = 10;
  if (x + w > WORLD.width - 10) x = WORLD.width - w - 10;
  if (y + h > WORLD.height - WORLD.collectionPanelH - 10) {
    y = Math.round(hy - size - h - 8);
  }
  ctx.fillStyle = 'rgba(10,12,18,0.95)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd24a';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = '#e6ecf3';
  ctx.font = 'bold 12px Inter Tight, sans-serif';
  ctx.textAlign = 'start';
  ctx.fillText(node.name, x + 10, y + 18);
  ctx.font = '11px Inter Tight, sans-serif';
  ctx.fillStyle = '#b6c2d1';
  ctx.fillText(node.desc, x + 10, y + 36);
  // Cost line — combine gold + gems when both are required.
  ctx.font = 'bold 11px Inter Tight, sans-serif';
  ctx.textAlign = 'right';
  let costX = x + w - 10;
  if (node.costGems !== undefined) {
    ctx.fillStyle = '#5af0ff';
    const label = `${node.costGems} gems`;
    ctx.fillText(label, costX, y + 50);
    costX -= ctx.measureText(label).width + 8;
  }
  if (node.costGold !== undefined) {
    ctx.fillStyle = '#ffd24a';
    const label = `${node.costGold} pollen`;
    ctx.fillText(label, costX, y + 50);
    costX -= ctx.measureText(label).width + 8;
  }
  if (node.costRolls !== undefined) {
    ctx.fillStyle = '#cfd5e0';
    ctx.fillText(`${node.costRolls} rolls`, costX, y + 50);
  }
  ctx.textAlign = 'start';
}

// Returns true if the (px, py) falls within the tree overlay area (above the collection panel).
export function treeOverlayContains(_px: number, py: number) {
  return py < WORLD.height - WORLD.collectionPanelH;
}
