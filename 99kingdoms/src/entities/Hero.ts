import { Input } from '../systems/Input';
import { WorldMap } from '../world/Map';
import { ResourceNode } from './ResourceNode';

const HERO_SPEED = 140;
const HERO_RADIUS = 10;
const INTERACT_RADIUS = 28;
const CHOP_INTERVAL = 0.4;

export const HERO_SWING_COOLDOWN = 0.35;
export const HERO_SWING_FLASH = 0.12;
export const HERO_SWING_RANGE = 34;
export const HERO_SWING_ARC = Math.PI * 0.45;
export const HERO_SWING_DAMAGE = 2;
export const HERO_MAX_HP = 20;
export const HERO_RESPAWN_INVULN = 1.6;
export const HERO_RESPAWN_DELAY = 3.0;
export const HERO_HIT_FLASH = 0.18;

export class Hero {
  x: number;
  y: number;
  facing = 0;
  chopTarget: number | null = null;
  chopTimer = 0;
  attackCooldown = 0;
  attackFlash = 0;
  maxHp = HERO_MAX_HP;
  hp = HERO_MAX_HP;
  invulnTimer = 0;
  hitFlash = 0;
  respawnTimer = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get isDead(): boolean {
    return this.respawnTimer > 0 || this.hp <= 0;
  }

  takeDamage(amount: number): boolean {
    if (this.invulnTimer > 0 || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.hitFlash = HERO_HIT_FLASH;
    if (this.hp <= 0) this.respawnTimer = HERO_RESPAWN_DELAY;
    return true;
  }

  respawnAt(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.hp = this.maxHp;
    this.invulnTimer = HERO_RESPAWN_INVULN;
    this.respawnTimer = 0;
    this.chopTarget = null;
    this.chopTimer = 0;
    this.attackCooldown = 0;
    this.attackFlash = 0;
    this.hitFlash = 0;
  }

  update(
    dt: number,
    input: Input,
    map: WorldMap,
    onNodeHit: (node: ResourceNode) => void,
    chopBlocked = false,
  ) {
    if (this.attackCooldown > 0) this.attackCooldown -= dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.respawnTimer > 0) {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      this.chopTarget = null;
      this.chopTimer = 0;
      return;
    }

    let dx = 0;
    let dy = 0;
    if (input.held('KeyW') || input.held('ArrowUp')) dy -= 1;
    if (input.held('KeyS') || input.held('ArrowDown')) dy += 1;
    if (input.held('KeyA') || input.held('ArrowLeft')) dx -= 1;
    if (input.held('KeyD') || input.held('ArrowRight')) dx += 1;

    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      this.x += dx * HERO_SPEED * dt;
      this.y += dy * HERO_SPEED * dt;
      this.facing = Math.atan2(dy, dx);
    }

    this.x = Math.max(HERO_RADIUS, Math.min(map.width - HERO_RADIUS, this.x));
    this.y = Math.max(HERO_RADIUS, Math.min(map.height - HERO_RADIUS, this.y));

    const gathering = input.held('Space') && !chopBlocked;
    if (!gathering) {
      this.chopTarget = null;
      this.chopTimer = 0;
      return;
    }

    const target = this.resolveTarget(map);
    if (!target) {
      this.chopTarget = null;
      this.chopTimer = 0;
      return;
    }

    this.chopTarget = target.id;
    if (!moving) {
      this.facing = Math.atan2(target.y - this.y, target.x - this.x);
    }
    this.chopTimer += dt;
    if (this.chopTimer >= CHOP_INTERVAL) {
      this.chopTimer -= CHOP_INTERVAL;
      target.hp -= 1;
      onNodeHit(target);
      if (target.hp <= 0) {
        map.removeNode(target.id);
        this.chopTarget = null;
        this.chopTimer = 0;
      }
    }
  }

  canSwing(): boolean {
    return this.attackCooldown <= 0;
  }

  triggerSwing() {
    this.attackCooldown = HERO_SWING_COOLDOWN;
    this.attackFlash = HERO_SWING_FLASH;
  }

  private resolveTarget(map: WorldMap): ResourceNode | undefined {
    if (this.chopTarget !== null) {
      const existing = map.nodes.find((n) => n.id === this.chopTarget);
      if (existing && dist(this, existing) <= INTERACT_RADIUS + 8) {
        return existing;
      }
    }

    let best: ResourceNode | undefined;
    let bestD = INTERACT_RADIUS;
    for (const n of map.nodes) {
      const d = dist(this, n);
      if (d < bestD) {
        best = n;
        bestD = d;
      }
    }
    if (best) this.chopTimer = 0;
    return best;
  }

  get radius() {
    return HERO_RADIUS;
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
