import { Game } from '../game/Game';
import { Station, STATION_STATS, nextUpgradeCost, prereqMet, effectiveStats, hireAnchorOffset, upgradeAnchorOffset } from '../entities/Station';

// Lightweight debug autoplay. It drives the hero by writing into the Input
// held-keys set each frame. All downstream logic (chop, pay, hire, attack)
// runs through the normal game code paths — so it actually exercises the real
// economy loop, not a shadow simulation.

// A Task is a committed goal + a predicate that says "I'm done". The hero
// stays on the task until isDone() returns true or a hard timeout elapses.
// Using a predicate (rather than "arrived within stopDist") is what stops the
// hero flipping between pay-at-X and pay-at-Y each frame.
interface Task {
  kind: string;
  // Dynamic target position — recomputed each frame so it can track moving
  // villagers etc. Returns null when the target no longer exists.
  pos: () => { x: number; y: number } | null;
  stopDist: number;
  hold: boolean;
  isDone: (game: Game) => boolean;
  // Seconds before we give up if the task never completes (safety valve).
  timeout?: number;
}

export class Autoplay {
  enabled = false;
  log: Array<{
    t: number;
    coin: number;
    spent: number;
    earned: number;
    built: number;
    rescued: number;
    kills: number;
    night: number;
    phase: string;
    idle: number;
    working: number;
    activeStations: number;
    cfHp: number;
  }> = [];
  // Per-transition trace of what task the autoplay switched to and why.
  // Used to diagnose "flipping back and forth" — flips appear as alternating
  // kinds in quick succession (<0.5s apart).
  taskTrace: Array<{ t: number; kind: string | null; reason: string; age: number }> = [];
  // Windows where the hero wanted to move but didn't — each pause gets logged
  // with the task in progress, its age, and where we think the hero was
  // blocked.
  pauseEvents: Array<{ t: number; task: string; age: number; dur: number; hx: number; hy: number; gx: number; gy: number }> = [];
  private pauseStart = 0;
  private t = 0;
  private lastSampleT = 0;
  private stuckTimer = 0;
  private lastX = 0;
  private lastY = 0;
  private task: Task | null = null;
  private taskStart = 0;
  // Hysteresis: once we've arrived at a goal, stay "arrived" until we drift
  // meaningfully outside stopDist. Without this, hero thrashes at the
  // stopDist boundary — dist flickers from 28 → 31 → 28 each frame.
  private arrived = false;

  start() {
    this.enabled = true;
    this.log = [];
    this.taskTrace = [];
    this.pauseEvents = [];
    this.t = 0;
    this.lastSampleT = 0;
    this.task = null;
    this.taskStart = 0;
    this.stuckTimer = 0;
    this.pauseStart = 0;
  }

  stop() {
    this.enabled = false;
  }

  update(game: Game, dt: number) {
    if (!game || !this.enabled || game.gameOver) return;
    this._bindGame(game);
    this.t += dt;

    if (game.shopOpen) {
      this.autoPickShop(game);
      return;
    }

    const keys = (game.input as unknown as { keys: Set<string> }).keys;
    const justDown = (game.input as unknown as { justDown: Set<string> }).justDown;
    ['KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((k) => keys.delete(k));
    keys.delete('Space');
    justDown.delete('Space');

    // Drop task if it's resolved or timed out.
    if (this.task) {
      const age = this.t - this.taskStart;
      const prev = this.task;
      let reason: string | null = null;
      if (prev.isDone(game)) reason = 'done';
      else if (prev.timeout && age > prev.timeout) reason = 'timeout';
      else if (!prev.pos()) reason = 'target-gone';
      // Preempt: if any enemy is threatening the campfire — day, dusk, night,
      // whatever — drop the current economy task and go fight. Portal guards
      // can chew through walls in broad daylight.
      if (!reason && prev.kind !== 'defend') {
        if (this.hasUrgentThreat(game)) reason = 'preempt:threat';
      }
      if (reason) {
        this.traceTransition(null, `release:${prev.kind}:${reason}`, age);
        this.task = null;
        this.stuckTimer = 0;
        this.arrived = false;
      }
    }

    // Pick a new task if we don't have one.
    if (!this.task) {
      const picked = this.pickTask(game);
      const pickedKind = picked ? picked.kind : null;
      this.traceTransition(pickedKind, 'pick', 0);
      this.task = picked;
      this.taskStart = this.t;
      this.arrived = false;
    }

    let intendsToMove = false;
    if (this.task) {
      const p = this.task.pos();
      if (p) {
        const ddx = p.x - game.hero.x;
        const ddy = p.y - game.hero.y;
        const dist = Math.hypot(ddx, ddy);

        // Hysteresis: the band between stopDist and stopDist+8 is the
        // "holding" zone. Once we enter stopDist we latch into arrived mode
        // and only break out past the outer threshold.
        const outer = this.task.stopDist + 8;
        const inner = this.task.stopDist;
        if (!this.arrived && dist <= inner) this.arrived = true;
        if (this.arrived && dist > outer) this.arrived = false;

        if (!this.arrived) {
          intendsToMove = true;
          if (this.stuckTimer > 1.5) {
            // Perturb: step orthogonally for ~0.3s, then clear so straight-line
            // travel resumes. Without resetting, the perturb direction sticks
            // forever and the hero jitters in place.
            const dirX = Math.abs(ddx) > Math.abs(ddy);
            const sign = Math.random() < 0.5 ? 1 : -1;
            keys.add(dirX ? (sign > 0 ? 'KeyS' : 'KeyW') : (sign > 0 ? 'KeyD' : 'KeyA'));
            if (this.stuckTimer > 2.5) {
              // Long-stuck → abandon the task entirely.
              this.traceTransition(null, `release:${this.task.kind}:stuck`, this.t - this.taskStart);
              this.task = null;
              this.stuckTimer = 0;
              this.arrived = false;
            }
          } else {
            if (ddx > 4) keys.add('KeyD');
            else if (ddx < -4) keys.add('KeyA');
            if (ddy > 4) keys.add('KeyS');
            else if (ddy < -4) keys.add('KeyW');
          }
        } else {
          // Arrived — hold Space if the task wants it, and sit still.
          if (this.task.hold) keys.add('Space');
        }
      }
    }

    const moved = Math.hypot(game.hero.x - this.lastX, game.hero.y - this.lastY);
    // HERO_SPEED * dt @ 60fps ≈ 2.24 px — so a 2px threshold false-positives
    // every dropped frame. 0.8 is well under normal movement but still fires
    // on a true freeze.
    if (intendsToMove && moved < 0.8) {
      if (this.stuckTimer === 0) this.pauseStart = this.t;
      this.stuckTimer += dt;
    } else {
      // If we were in a >= 0.3s pause, log it before clearing.
      if (this.stuckTimer > 0.3 && this.task) {
        const p = this.task.pos();
        this.pauseEvents.push({
          t: +this.pauseStart.toFixed(2),
          task: this.task.kind,
          age: +(this.t - this.taskStart).toFixed(2),
          dur: +this.stuckTimer.toFixed(2),
          hx: Math.round(game.hero.x),
          hy: Math.round(game.hero.y),
          gx: p ? Math.round(p.x) : -1,
          gy: p ? Math.round(p.y) : -1,
        });
        if (this.pauseEvents.length > 200) this.pauseEvents.shift();
      }
      this.stuckTimer = 0;
    }
    this.lastX = game.hero.x;
    this.lastY = game.hero.y;

    // Auto-attack whenever an enemy is in swing range — day or night.
    const nearestEnemy = this.nearestEnemy(game);
    (game.input as unknown as { mouseDown: boolean }).mouseDown = !!(
      nearestEnemy &&
      Math.hypot(nearestEnemy.x - game.hero.x, nearestEnemy.y - game.hero.y) < 60
    );

    if (this.t - this.lastSampleT >= 1) {
      this.lastSampleT = this.t;
      let idle = 0;
      let working = 0;
      for (const r of game.recruits) {
        if (r.status === 'wandering') continue;
        if (r.status === 'idle') idle++;
        else working++;
      }
      this.log.push({
        t: +this.t.toFixed(1),
        coin: game.resources.coin,
        spent: game.stats.coinsSpent,
        earned: game.stats.coinsCollected,
        built: game.stats.stationsBuilt,
        rescued: game.stats.rescued,
        kills: game.stats.kills,
        night: game.clock.night,
        phase: game.clock.phase,
        idle,
        working,
        activeStations: game.stations.filter((s) => s.active).length,
        cfHp: Math.ceil(game.campfire.hp),
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────
  // Task construction. Each helper returns a Task with an isDone predicate
  // that watches the specific piece of game state the task was set up to
  // change. "Arrived at a position" is not a completion criterion.

  private pickTask(game: Game): Task | null {
    const isDay = game.clock.phase === 'day';
    const isNight = game.clock.phase === 'night';

    // 0. DEFEND — highest priority regardless of phase. Portal retaliation can
    // send enemies chasing the campfire during the day too, and ignoring them
    // is how we lost night 1 in testing.
    const defend = this.pickDefenseTask(game);
    if (defend) return defend;
    // Prevent TS "unused" warning on the now-redundant isNight for this block.
    void isNight;

    // Rescue wanderers
    if (game.resources.coin >= 2) {
      let best: { id: number; d: number } | null = null;
      for (const r of game.recruits) {
        if (r.status !== 'wandering') continue;
        const d = Math.hypot(r.x - game.hero.x, r.y - game.hero.y);
        if (d > 400) continue;
        if (!best || d < best.d) best = { id: r.id, d };
      }
      if (best) return this.taskRescue(best.id);
    }

    // Retreat to campfire at night
    if (isNight) {
      const dFire = Math.hypot(game.campfire.x - game.hero.x, game.campfire.y - game.hero.y);
      if (dFire > 220) {
        return {
          kind: 'retreat',
          pos: () => ({ x: game.campfire.x, y: game.campfire.y }),
          stopDist: 60,
          hold: false,
          isDone: (g) => Math.hypot(g.campfire.x - g.hero.x, g.campfire.y - g.hero.y) < 120,
          timeout: 10,
        };
      }
    }

    // Daytime spend
    if (isDay) {
      const spend = this.pickSpendTask(game);
      if (spend) return spend;
    }

    // Night hire
    if (isNight) {
      const hire = this.pickHireTask(game);
      if (hire) return hire;
    }

    // Pick up a cluster of coins. The target is the nearest coin actually in
    // the cluster (so the hero sweeps from coin to coin), not a static
    // centroid — parking at the centroid leaves coins on the ground outside
    // the hero's pickup radius.
    const cluster = this.nearestCoinCluster(game, 260, 90);
    if (cluster) {
      const cx = cluster.x;
      const cy = cluster.y;
      const clearR = cluster.radius + 14;
      return {
        kind: 'pickup',
        pos: () => {
          let best: { x: number; y: number } | null = null;
          let bestD = Infinity;
          for (const c of game.coins) {
            if (c.age < 0.4) continue;
            if (Math.hypot(c.x - cx, c.y - cy) > clearR) continue;
            const d = Math.hypot(c.x - game.hero.x, c.y - game.hero.y);
            if (d < bestD) {
              bestD = d;
              best = { x: c.x, y: c.y };
            }
          }
          return best ?? { x: cx, y: cy };
        },
        stopDist: 6,
        hold: false,
        isDone: (g2) => {
          for (const c of g2.coins) {
            if (c.age < 0.4) continue;
            if (Math.hypot(c.x - cx, c.y - cy) < clearR) return false;
          }
          return true;
        },
        timeout: 5,
      };
    }

    // Chop
    const node = this.nearestNode(game, 1000);
    if (node) {
      const nodeId = node.id;
      return {
        kind: 'chop',
        pos: () => {
          const n = game.map.nodes.find((x) => x.id === nodeId);
          return n ? { x: n.x, y: n.y } : null;
        },
        stopDist: 22,
        hold: true,
        isDone: (g) => !g.map.nodes.find((x) => x.id === nodeId),
        timeout: 12,
      };
    }

    // Fallback: hang by the campfire (no hold).
    return {
      kind: 'idle',
      pos: () => ({ x: game.campfire.x, y: game.campfire.y }),
      stopDist: 60,
      hold: false,
      isDone: () => false,
      timeout: 2,
    };
  }

  private static BUILD_PRIORITY: Record<string, number> = {
    gather: 1,
    tower: 2,
    garrison: 3,
    blacksmith: 4,
    barracks: 5,
    workshop: 6,
    farm: 7,
    wall: 9,
  };

  private pickSpendTask(game: Game): Task | null {
    const coin = game.resources.coin;

    // 1. Fill open slots on active stations first — a built-but-unstaffed
    // station is pure waste (towers don't shoot, gather posts don't gather).
    const hireTask = this.pickHireTask(game);
    if (hireTask) return hireTask;

    // 2. Non-wall build — raise the next tier of buildings.
    let bestBuild: Station | null = null;
    let bestPrio = Infinity;
    for (const s of game.stations) {
      if (s.active) continue;
      if (s.kind === 'wall') continue;
      if (!prereqMet(s.kind, game.stations, game.campfire.level)) continue;
      if (coin < STATION_STATS[s.kind].cost) continue;
      const prio = Autoplay.BUILD_PRIORITY[s.kind] ?? 10;
      if (prio < bestPrio) {
        bestPrio = prio;
        bestBuild = s;
      }
    }
    if (bestBuild) return this.taskBuild(bestBuild.id);

    // 3. Walls — cheap filler once the core base is staffed and growing.
    for (const s of game.stations) {
      if (s.active) continue;
      if (s.kind !== 'wall') continue;
      if (coin < STATION_STATS.wall.cost) continue;
      return this.taskBuild(s.id);
    }

    // Campfire upgrade.
    const cfCost = game.campfire.nextUpgradeCost();
    if (cfCost !== null && !game.campfire.upgradeBlockReason(game.stations) && coin >= cfCost && game.campfire.readyTimer <= 0) {
      const targetLevel = game.campfire.level + 1;
      return {
        kind: 'upgrade-cf',
        pos: () => ({ x: game.campfire.x, y: game.campfire.y - 38 }),
        stopDist: 20,
        hold: true,
        isDone: (g) => g.campfire.level >= targetLevel,
        timeout: 20,
      };
    }

    // Station upgrade.
    for (const s of game.stations) {
      if (!s.active) continue;
      const upCost = nextUpgradeCost(s, game.campfire.level);
      if (upCost === null) continue;
      if (coin < upCost) continue;
      return this.taskUpgrade(s.id);
    }

    return null;
  }

  /**
   * Return a chase-and-attack task targeting the most dangerous enemy near the
   * campfire or the hero. "Dangerous" ≈ closest to the fire, since that's what
   * we lose the run on.
   */
  private pickDefenseTask(game: Game): Task | null {
    const cfx = game.campfire.x;
    const cfy = game.campfire.y;
    const ENGAGE_RADIUS = 260; // enemies within this of fire are a threat
    const HERO_DANGER = 80;    // enemies within this of hero are also urgent

    let threat: { id: number; x: number; y: number } | null = null;
    let bestScore = Infinity;
    for (const e of game.enemies) {
      const dFire = Math.hypot(e.x - cfx, e.y - cfy);
      const dHero = Math.hypot(e.x - game.hero.x, e.y - game.hero.y);
      const inRange = dFire < ENGAGE_RADIUS || dHero < HERO_DANGER;
      if (!inRange) continue;
      // Prefer fire-threat distance so the hero intercepts on approach rather
      // than chasing the hero's tail.
      const score = dFire;
      if (score < bestScore) {
        bestScore = score;
        threat = { id: e.id, x: e.x, y: e.y };
      }
    }
    if (!threat) return null;

    const threatId = threat.id;
    return {
      kind: 'defend',
      pos: () => {
        const e = game.enemies.find((x) => x.id === threatId);
        return e ? { x: e.x, y: e.y } : null;
      },
      stopDist: 28, // close enough for the hero's swing arc to hit
      hold: false,
      isDone: (g) => {
        const e = g.enemies.find((x) => x.id === threatId);
        if (!e || e.hp <= 0) return true;
        // Also release if the threat has wandered far from the fire — we can
        // re-pick a closer one next frame.
        const d = Math.hypot(e.x - g.campfire.x, e.y - g.campfire.y);
        return d > ENGAGE_RADIUS + 60;
      },
      timeout: 6,
    };
  }

  /**
   * True if an enemy is close enough to the campfire (or the hero) that it
   * warrants abandoning the current task.
   */
  private hasUrgentThreat(game: Game): boolean {
    const cfx = game.campfire.x;
    const cfy = game.campfire.y;
    const FIRE_THREAT_R = 260;
    const HERO_THREAT_R = 80;
    for (const e of game.enemies) {
      const dFire = Math.hypot(e.x - cfx, e.y - cfy);
      if (dFire < FIRE_THREAT_R) return true;
      const dHero = Math.hypot(e.x - game.hero.x, e.y - game.hero.y);
      if (dHero < HERO_THREAT_R) return true;
    }
    return false;
  }

  private pickHireTask(game: Game): Task | null {
    const coin = game.resources.coin;
    for (const s of game.stations) {
      if (!s.active) continue;
      const eff = effectiveStats(s);
      if (eff.capacity <= 0) continue;
      const committed = s.recruitIds.length + s.paidSlots;
      if (committed >= eff.capacity) continue;
      const remaining = STATION_STATS[s.kind].hireCost - s.hireProgress;
      if (coin < remaining) continue;
      if (!hireAnchorOffset(s.kind)) continue;
      return this.taskHire(s.id);
    }
    return null;
  }

  private taskBuild(stationId: number): Task {
    return {
      kind: 'build',
      pos: () => {
        const s = this.station(stationId);
        return s ? { x: s.x, y: s.y } : null;
      },
      stopDist: 30,
      hold: true,
      isDone: (g) => {
        const s = g.stations.find((x) => x.id === stationId);
        // Completed if activated, or gone.
        return !s || s.active;
      },
      timeout: 20,
    };
  }

  private taskHire(stationId: number): Task {
    // Snapshot how many slots were already committed so we know when THIS
    // hire finishes (rather than waiting for the station to be fully staffed).
    const station = this.stationFromMap(stationId);
    const initialCommitted = station
      ? station.recruitIds.length + station.paidSlots
      : 0;
    return {
      kind: 'hire',
      pos: () => {
        const s = this.station(stationId);
        if (!s) return null;
        const a = hireAnchorOffset(s.kind);
        return a ? { x: s.x + a.dx, y: s.y + a.dy } : null;
      },
      stopDist: 16,
      hold: true,
      isDone: (g) => {
        const s = g.stations.find((x) => x.id === stationId);
        if (!s) return true;
        const committed = s.recruitIds.length + s.paidSlots;
        return committed > initialCommitted;
      },
      timeout: 12,
    };
  }

  private taskUpgrade(stationId: number): Task {
    const s0 = this.stationFromMap(stationId);
    const startLevel = s0 ? s0.level : 0;
    return {
      kind: 'upgrade',
      pos: () => {
        const s = this.station(stationId);
        if (!s) return null;
        const a = upgradeAnchorOffset(s.kind);
        return { x: s.x + a.dx, y: s.y + a.dy };
      },
      stopDist: 18,
      hold: true,
      isDone: (g) => {
        const s = g.stations.find((x) => x.id === stationId);
        return !s || s.level > startLevel;
      },
      timeout: 20,
    };
  }

  private taskRescue(recruitId: number): Task {
    return {
      kind: 'rescue',
      pos: () => {
        const r = this.#game?.recruits.find((x) => x.id === recruitId);
        return r ? { x: r.x, y: r.y } : null;
      },
      stopDist: 20,
      hold: true,
      isDone: (g) => {
        const r = g.recruits.find((x) => x.id === recruitId);
        return !r || r.status !== 'wandering';
      },
      timeout: 10,
    };
  }

  // Weak cache of the current game so inner arrows (rescue) can look up by id.
  #game: Game | null = null;
  private station(stationId: number): Station | undefined {
    return this.#game?.stations.find((s) => s.id === stationId);
  }
  private stationFromMap(stationId: number): Station | undefined {
    return this.station(stationId);
  }

  private autoPickShop(game: Game) {
    if (!game.shopOpen) return;
    const offers = game.shopOffers;
    let cheapestIdx = -1;
    let cheapestCost = Infinity;
    for (let i = 0; i < offers.length; i++) {
      if (offers[i].cost <= game.resources.coin && offers[i].cost < cheapestCost) {
        cheapestCost = offers[i].cost;
        cheapestIdx = i;
      }
    }
    const anyGame = game as unknown as { closeShop: () => void };
    if (cheapestIdx >= 0) {
      game.resources.coin -= offers[cheapestIdx].cost;
      offers[cheapestIdx].apply(game);
    }
    anyGame.closeShop();
  }

  /**
   * Find a cluster of coins to collect as one unit. We pick the closest coin,
   * then grow a cluster around it of every other coin within `radius`, and
   * return the cluster's centroid + bounding radius.
   */
  private nearestCoinCluster(
    game: Game,
    searchRange: number,
    radius: number,
  ): { x: number; y: number; radius: number } | null {
    let seed: { x: number; y: number } | null = null;
    let seedD = searchRange;
    for (const c of game.coins) {
      if (c.age < 0.4) continue;
      const d = Math.hypot(c.x - game.hero.x, c.y - game.hero.y);
      if (d < seedD) {
        seedD = d;
        seed = { x: c.x, y: c.y };
      }
    }
    if (!seed) return null;

    let sx = 0;
    let sy = 0;
    let n = 0;
    let maxR = 0;
    for (const c of game.coins) {
      if (c.age < 0.4) continue;
      const d = Math.hypot(c.x - seed.x, c.y - seed.y);
      if (d > radius) continue;
      sx += c.x;
      sy += c.y;
      n++;
      if (d > maxR) maxR = d;
    }
    if (n === 0) return null;
    return { x: sx / n, y: sy / n, radius: maxR };
  }

  private nearestNode(game: Game, range: number): { x: number; y: number; id: number } | null {
    let best: { x: number; y: number; id: number } | null = null;
    let bestD = range;
    for (const n of game.map.nodes) {
      const d = Math.hypot(n.x - game.hero.x, n.y - game.hero.y);
      if (d < bestD) {
        bestD = d;
        best = { x: n.x, y: n.y, id: n.id };
      }
    }
    return best;
  }

  private nearestEnemy(game: Game): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const e of game.enemies) {
      const d = Math.hypot(e.x - game.hero.x, e.y - game.hero.y);
      if (d < bestD) {
        bestD = d;
        best = { x: e.x, y: e.y };
      }
    }
    return best;
  }

  /**
   * Append to the transition trace and keep it bounded so it doesn't grow
   * without bound during long runs.
   */
  private traceTransition(kind: string | null, reason: string, age: number) {
    this.taskTrace.push({ t: +this.t.toFixed(2), kind, reason, age: +age.toFixed(2) });
    if (this.taskTrace.length > 500) this.taskTrace.shift();
  }

  /**
   * One-call diagnosis that returns the data most useful for finding
   * pauses / flips without paging through the full trace. Counts transitions
   * by kind, counts flips by pair, and returns the longest pause events.
   */
  diagnose(): {
    totalTransitions: number;
    flipPairs: Record<string, number>;
    pauseCount: number;
    longestPauses: Array<{ t: number; task: string; dur: number; hxy: string; gxy: string }>;
    releaseReasons: Record<string, number>;
  } {
    const flipPairs: Record<string, number> = {};
    for (const f of this.flips(0.5)) {
      const k = `${f.from}→${f.to}`;
      flipPairs[k] = (flipPairs[k] ?? 0) + 1;
    }
    const releaseReasons: Record<string, number> = {};
    for (const e of this.taskTrace) {
      if (!e.reason.startsWith('release:')) continue;
      const reason = e.reason.split(':').slice(1).join(':');
      releaseReasons[reason] = (releaseReasons[reason] ?? 0) + 1;
    }
    const sorted = [...this.pauseEvents]
      .sort((a, b) => b.dur - a.dur)
      .slice(0, 10)
      .map((p) => ({
        t: p.t,
        task: p.task,
        dur: p.dur,
        hxy: `(${p.hx},${p.hy})`,
        gxy: `(${p.gx},${p.gy})`,
      }));
    return {
      totalTransitions: this.taskTrace.length,
      flipPairs,
      pauseCount: this.pauseEvents.length,
      longestPauses: sorted,
      releaseReasons,
    };
  }

  /** Pull out any suspiciously fast task flips for quick diagnosis. */
  flips(windowSec = 0.4): Array<{ at: number; from: string; to: string; gap: number }> {
    const out: Array<{ at: number; from: string; to: string; gap: number }> = [];
    const trace = this.taskTrace;
    // Look at release→pick pairs and flag cases where a new task starts
    // within `windowSec` of the previous release — that's the signature of a
    // back-and-forth.
    for (let i = 1; i < trace.length; i++) {
      const prev = trace[i - 1];
      const cur = trace[i];
      if (!prev.reason.startsWith('release:')) continue;
      if (cur.reason !== 'pick') continue;
      const gap = cur.t - prev.t;
      if (gap > windowSec) continue;
      const from = prev.reason.split(':')[1];
      out.push({ at: cur.t, from, to: cur.kind ?? '-', gap: +gap.toFixed(3) });
    }
    return out;
  }

  report(): string {
    const header = 't(s)\tphase\tnight\tcoin\tspent\tearned\tbuilt\trescued\tkills';
    const rows = this.log.map((r) =>
      `${r.t}\t${r.phase}\t${r.night}\t${r.coin}\t${r.spent}\t${r.earned}\t${r.built}\t${r.rescued}\t${r.kills}`
    );
    return [header, ...rows].join('\n');
  }

  /** Internal: keep a reference so tasks can close over the latest game. */
  _bindGame(game: Game) {
    this.#game = game;
  }
}
