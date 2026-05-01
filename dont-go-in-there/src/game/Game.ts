import { Input } from '../systems/Input';
import * as Persistence from '../systems/Persistence';
import { Bedroom } from '../scenes/Bedroom';
import { Basement } from '../scenes/Basement';
import type { Scene } from '../scenes/Scene';
import {
  ALL_PARTS,
  ALL_TOOLS,
  freshSave,
  isPartRepaired,
  PART_LABEL,
  PART_REQS,
  TOOL_RECIPE,
  type Inventory,
  type ItemKind,
  type PartKey,
  type SaveState,
  type ToolKind,
  type TutorialStep,
  emptyInventory,
} from '../types';

export type SceneName = 'bedroom' | 'basement';

export type NotificationKind = 'quest' | 'done' | 'info';
export interface Notification {
  id: string;
  text: string;
  kind: NotificationKind;
  createdAt: number;
  ttl: number;
}

const NOTIFICATION_TTL = 4500;

export class Game {
  readonly canvas: HTMLCanvasElement;
  readonly input: Input;
  save: SaveState;
  carried: Inventory = emptyInventory();
  scene: Scene;
  sceneName: SceneName = 'bedroom';
  private _notifications: Notification[] = [];
  private _notifSeq = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.input = new Input(canvas);
    this.save = Persistence.load();
    this.scene = new Bedroom();
    this.scene.enter(this);

    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) * canvas.width) / rect.width;
      const y = ((e.clientY - rect.top) * canvas.height) / rect.height;
      this.scene.onClick?.(x, y, this);
    });
  }

  update(dt: number): void {
    this.scene.update(dt, this.input, this);
    this.input.endFrame();
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.scene.render(ctx, this);
  }

  switchScene(name: SceneName): void {
    this.scene.exit();
    this.sceneName = name;
    this.scene = name === 'bedroom' ? new Bedroom() : new Basement();
    this.scene.enter(this);
  }

  bankCarried(): void {
    let bankedEyes = false;
    let bankedGlue = false;
    for (const k of Object.keys(this.carried) as ItemKind[]) {
      if (this.carried[k] > 0 && k === 'eyes') bankedEyes = true;
      if (this.carried[k] > 0 && k === 'super_glue') bankedGlue = true;
      this.save.banked[k] += this.carried[k];
      this.carried[k] = 0;
    }
    // Successful escape — friend will have something to say next time.
    // Loadout intentionally NOT cleared: tools came back, player keeps the
    // same loadout for the next run unless they tweak it at the door.
    this.save.pendingReturn = true;
    // FTUE: if the player came back with the eyes, they're ready to install.
    if (bankedEyes && this.save.tutorialStep === 'return_to_room') {
      this.save.tutorialStep = 'install_eyes';
    }
    // Banking Super Glue permanently unlocks the crafting table.
    if (bankedGlue) {
      this.save.craftingUnlocked = true;
      this.notifyQuestComplete('Find Super Glue');
    }
    this.persist();
  }

  markMet(): void {
    if (!this.save.metFriend) {
      this.save.metFriend = true;
      this.persist();
    }
  }

  ackReturn(): void {
    if (this.save.pendingReturn) {
      this.save.pendingReturn = false;
      this.persist();
    }
  }

  // Called from the basement when the player is caught or panic-killed. Only
  // arms the FIRST_DEATH dialog the very first time, so repeated deaths after
  // the friend has commented don't replay the same scene.
  markDeath(): void {
    if (!this.save.firstDeathSeen) {
      this.save.firstDeathPending = true;
      this.persist();
    }
  }

  ackFirstDeath(): void {
    this.save.firstDeathPending = false;
    this.save.firstDeathSeen = true;
    this.persist();
  }

  loseCarried(): void {
    this.carried = emptyInventory();
  }

  spend(kind: ItemKind, n = 1): boolean {
    if (this.save.banked[kind] < n) return false;
    this.save.banked[kind] -= n;
    return true;
  }

  // Install one item of `kind` toward `part`'s requirement. Returns true if
  // the install happened, false if the part is already at max for that kind
  // or there's nothing in the chest.
  installItem(part: PartKey, kind: ItemKind): boolean {
    const reqs = PART_REQS[part];
    const need = reqs[kind] ?? 0;
    if (need === 0) return false;
    const progress = this.save.partProgress[part];
    const have = progress[kind] ?? 0;
    if (have >= need) return false;
    if (this.save.banked[kind] < 1) return false;
    this.save.banked[kind] -= 1;
    progress[kind] = have + 1;
    // FTUE: installing the eyes triggers the reward dialog next.
    if (
      part === 'head' &&
      kind === 'eyes' &&
      this.save.tutorialStep === 'install_eyes'
    ) {
      this.save.tutorialStep = 'collect_reward';
    }
    // Part just finished — toast it, and if it was the head, fan out the
    // body-part quests so the player has a clear "what now" picture.
    if (isPartRepaired(progress, reqs)) {
      this.notifyQuestComplete(`Repair the ${PART_LABEL[part]}`);
      if (part === 'head') {
        for (const p of ALL_PARTS) {
          if (p === 'head') continue;
          this.discoverQuest(`repair_${p}`, `Repair the ${PART_LABEL[p]}`);
        }
      }
    }
    this.persist();
    return true;
  }

  isPartRepaired(part: PartKey): boolean {
    return isPartRepaired(this.save.partProgress[part], PART_REQS[part]);
  }

  // Passive benefits — combined from repaired parts AND equipped crafted
  // tools. Tools stack on top of part bonuses (e.g. flashlight + repaired
  // head both extend the light).
  lightRadiusBonus(): number {
    let bonus = this.isPartRepaired('head') ? 70 : 0;
    if (this.hasTool('flashlight')) bonus += 80;
    return bonus;
  }

  panicMultiplier(): number {
    let mult = this.isPartRepaired('chest') ? 0.6 : 1.0;
    if (this.hasTool('talisman')) mult *= 0.7;
    return mult;
  }

  carrySlots(): number {
    let n = 1; // bare-handed base capacity — kid pockets only
    if (this.isPartRepaired('arm')) n += 2;
    if (this.hasTool('backpack')) n += 1;
    return n;
  }

  climbDurationMultiplier(): number {
    return this.isPartRepaired('leg') ? 0.5 : 1.0;
  }

  // Tool helpers — only LOADED tools (loadout > 0) take effect during a run.
  // Tools sitting in the workshop (equipped only) are safe but inactive.
  hasTool(kind: ToolKind): boolean {
    return this.save.loadout[kind] > 0;
  }

  canCraftTool(kind: ToolKind): boolean {
    const recipe = TOOL_RECIPE[kind];
    for (const k of Object.keys(recipe) as ItemKind[]) {
      if (this.save.banked[k] < (recipe[k] ?? 0)) return false;
    }
    return true;
  }

  craftTool(kind: ToolKind): boolean {
    if (!this.canCraftTool(kind)) return false;
    const recipe = TOOL_RECIPE[kind];
    for (const k of Object.keys(recipe) as ItemKind[]) {
      this.save.banked[k] -= recipe[k] ?? 0;
    }
    this.save.equipped[kind] += 1;
    this.persist();
    return true;
  }

  // Consuming a tool (e.g. lockpick used) removes it from BOTH the workshop
  // and the loadout — it's gone from the world entirely.
  consumeTool(kind: ToolKind): boolean {
    if (this.save.loadout[kind] < 1) return false;
    this.save.loadout[kind] -= 1;
    this.save.equipped[kind] = Math.max(0, this.save.equipped[kind] - 1);
    this.persist();
    return true;
  }

  // Loadout management — adjust the count of a kind taken into the next raid.
  setLoadoutCount(kind: ToolKind, count: number): void {
    const max = this.save.equipped[kind];
    this.save.loadout[kind] = Math.max(0, Math.min(max, Math.floor(count)));
    this.persist();
  }

  // Auto-load every owned tool. Used after extract so the player doesn't have
  // to re-tick every tool they took with them.
  loadAllAvailable(): void {
    for (const k of ALL_TOOLS) this.save.loadout[k] = this.save.equipped[k];
    this.persist();
  }

  // Death: every loaded tool is lost. Workshop totals shrink by what was
  // taken; loadout zeroes out for the next run.
  loseEquipped(): void {
    for (const k of ALL_TOOLS) {
      this.save.equipped[k] = Math.max(0, this.save.equipped[k] - this.save.loadout[k]);
      this.save.loadout[k] = 0;
    }
    this.persist();
  }

  // Successful extract: tools came back to the workshop. Loadout is cleared
  // so the player consciously re-loads next time (or hits "load all").
  clearLoadout(): void {
    for (const k of ALL_TOOLS) this.save.loadout[k] = 0;
    this.persist();
  }

  recordDepth(d: number): void {
    if (d > this.save.deepestReached) {
      this.save.deepestReached = d;
      this.persist();
    }
  }

  persist(): void {
    Persistence.save(this.save);
  }

  resetSave(): void {
    Persistence.clear();
    this.save = freshSave();
    this.carried = emptyInventory();
    this._notifications = [];
  }

  // Notifications — short-lived toasts shown in the top-right corner of both
  // scenes. Pruned on read so the list never grows unbounded.
  notify(text: string, kind: NotificationKind = 'info'): void {
    this._notifications.push({
      id: `n${++this._notifSeq}`,
      text,
      kind,
      createdAt: performance.now(),
      ttl: NOTIFICATION_TTL,
    });
  }

  notifications(): Notification[] {
    const now = performance.now();
    this._notifications = this._notifications.filter((n) => now - n.createdAt < n.ttl);
    return this._notifications;
  }

  // Quest discovery — first time a quest is uncovered we add it to the save
  // and toast the player. Subsequent calls are no-ops, so it's safe to call
  // from proximity / interact handlers without guarding upstream.
  discoverQuest(id: string, title: string): void {
    if (this.save.discoveredQuests.includes(id)) return;
    this.save.discoveredQuests.push(id);
    this.notify(`NEW QUEST · ${title}`, 'quest');
    this.persist();
  }

  // Helper for reporting a status change. Doesn't mutate save — completion is
  // already encoded in partProgress / craftingUnlocked.
  notifyQuestComplete(title: string): void {
    this.notify(`QUEST COMPLETE · ${title}`, 'done');
  }

  // FTUE state machine. Each step transitions only on a specific player
  // action (talked to friend, looted eyes, extracted, installed eyes,
  // collected the reward dialog).
  isTutorialActive(): boolean {
    return this.save.tutorialStep !== 'done';
  }

  advanceTutorial(from: TutorialStep, to: TutorialStep): void {
    if (this.save.tutorialStep === from) {
      this.save.tutorialStep = to;
      this.persist();
    }
  }

  // FTUE reward — granted by the dialog onEnter effect after eyes installed.
  // The reward dialog gives the player their first backpack (+1 carry slot,
  // up from the bare-handed base of 1), but the friend has more to say
  // about the rest of his body, so we land on `continue_briefing` and let a
  // follow-up dialog finish the tutorial.
  grantTutorialReward(): void {
    if (this.save.equipped.backpack === 0) this.save.equipped.backpack = 1;
    this.save.tutorialStep = 'continue_briefing';
    this.save.metFriend = true;
    this.persist();
  }

  // Final FTUE step — the body-quest briefing wraps up. The friend's listing
  // of head pieces is the moment the player learns about the head-repair
  // quest, so discover it here.
  finishTutorialBriefing(): void {
    if (this.save.tutorialStep === 'continue_briefing') {
      this.save.tutorialStep = 'done';
      this.persist();
    }
    this.discoverQuest('repair_head', 'Repair the Head');
  }
}
