import { Rng } from './rng';
import {
  allSkillsAt99,
  COIN_OBJECTIVE,
  levelOf,
  MAX_COINS,
} from './osrs';
import {
  BREAD_TILE,
  BRIDGE_TILE,
  CAMPFIRE_TILE,
  EXAMINE_TEXTS,
  FISHING_TILE,
  FLAX_TILES,
  GOBLIN_SPAWNS,
  HOBGOBLIN_SPAWNS,
  OAK_TILES,
  SPAWN_TILE,
  TRADER_TILE,
  TREE_TILES,
  isBridgeTile,
  isTreeTile,
  staticBlocked,
  tileChar,
} from './map';
import { adjacent, bfsPath, chebyshev, nearestApproach } from './path';
import type {
  AwayPlan,
  Goblin,
  GoblinTier,
  Gravestone,
  Intent,
  ItemKind,
  MenuOption,
  MilestoneId,
  PlayerState,
  Point,
  Quest,
  QuestKind,
  SimEvent,
  SimStats,
  SkillName,
  TileThing,
  Tree,
  TreeKind,
} from './types';

export const INVENTORY_SIZE = 28;
export const GOBLIN_MAX_HP = 3;
export const HOBGOBLIN_MAX_HP = 5;
export const PLAYER_MAX_HP = 10;
export const GOBLIN_RESPAWN_TICKS = 10;
export const TREE_REGROW_TICKS = 8;
export const LOG_PRICE = 7;
export const FLAX_PRICE = 2;
export const OAK_PRICE = 15;
export const SHRIMP_PRICE = 5;
export const SHRIMP_RAW_PRICE = 1;
export const BREAD_PRICE = 3;
export const BREAD_HEAL = 4;
export const SHRIMP_HEAL = 3;
export const TOLL_COST = 10;
export const GRAVESTONE_TICKS = 100;
export const OAK_LEVEL = 5;
export const COOK_SUCCESS = 0.75;
export {
  COIN_OBJECTIVE,
  levelOf,
  MAX_COINS,
  MAX_LEVEL,
  SESSION_COIN_TARGET,
  xpForLevel,
} from './osrs';
export const GOBLIN_DROP_MIN = 4;
export const GOBLIN_DROP_MAX = 9;
export const HOBGOBLIN_DROP_MIN = 8;
export const HOBGOBLIN_DROP_MAX = 15;
const GOBLIN_DEAGGRO_DIST = 7;
/** Hobgoblins pick fights: they aggro on their own within this range. */
const HOBGOBLIN_AGGRO_DIST = 2;
const BASE_CHOP_CHANCE = 0.42;
const BASE_FISH_CHANCE = 0.55;

/**
 * All standing orders start OFF: the 2004 default is that your character
 * blindly finishes the last thing you clicked, and walking away mid-combat
 * remains a personal choice. Turning these on is the strategy.
 */
export const DEFAULT_AWAY_PLAN: AwayPlan = {
  keepWorking: false,
  eatBread: false,
  runHome: false,
  autoSell: false,
};

export const ITEM_PRICES: Readonly<Record<ItemKind, number>> = {
  log: LOG_PRICE,
  flax: FLAX_PRICE,
  oakLog: OAK_PRICE,
  shrimpCooked: SHRIMP_PRICE,
  shrimpRaw: SHRIMP_RAW_PRICE,
  shrimpBurnt: 0,
  bread: 0,
};

function chopChance(wcLevel: number, kind: TreeKind): number {
  const base = kind === 'oak' ? BASE_CHOP_CHANCE - 0.18 : BASE_CHOP_CHANCE;
  return Math.min(0.88, base + (wcLevel - 1) * 0.045);
}

function fishChance(fishLevel: number): number {
  return Math.min(0.9, BASE_FISH_CHANCE + (fishLevel - 1) * 0.015);
}

function playerMaxHit(atkLevel: number): number {
  return Math.min(6, 2 + Math.floor((atkLevel - 1) / 2));
}

const TIER_STATS: Record<GoblinTier, { maxHp: number; maxHit: number; dropMin: number; dropMax: number; killXp: number }> = {
  goblin: { maxHp: GOBLIN_MAX_HP, maxHit: 1, dropMin: GOBLIN_DROP_MIN, dropMax: GOBLIN_DROP_MAX, killXp: 12 },
  hobgoblin: { maxHp: HOBGOBLIN_MAX_HP, maxHit: 2, dropMin: HOBGOBLIN_DROP_MIN, dropMax: HOBGOBLIN_DROP_MAX, killXp: 20 },
};

/** The kind of work "keep working" re-acquires while away. */
type WorkKind = 'attack' | 'chop' | 'fish' | 'pick';

export interface SimCharacter {
  coins: number;
  xp: Record<SkillName, number>;
  bridgePass: boolean;
}

export interface SimOpts {
  seed?: number;
  character?: SimCharacter;
  doubleXp?: boolean;
}

export class MudwickSim {
  readonly player: PlayerState;
  readonly goblins: Goblin[];
  readonly trees: Tree[];
  readonly stats: SimStats;
  /** Trader Wyn's rotating side contract — bonus gp for grinding. */
  quest: Quest;
  tick = 0;
  gravestone: Gravestone | null = null;
  awayPlan: AwayPlan = { ...DEFAULT_AWAY_PLAN };

  private rng: Rng;
  private events: SimEvent[] = [];
  private bridgePassHeld: boolean;
  private readonly doubleXp: boolean;
  private loggedOut = false;
  private pendingLogout = false;
  private lastWork: WorkKind | null = null;
  private currentAway = false;
  private burntStreak = 0;
  private milestoneList: MilestoneId[] = [];
  private milestoneSet = new Set<MilestoneId>();

  constructor(opts: number | SimOpts = 0xc0ffee) {
    const options: SimOpts = typeof opts === 'number' ? { seed: opts } : opts;
    this.rng = new Rng(options.seed ?? 0xc0ffee);
    this.doubleXp = options.doubleXp ?? false;
    const character = options.character;
    this.bridgePassHeld = character?.bridgePass ?? false;
    this.player = {
      pos: { ...SPAWN_TILE },
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      coins: character?.coins ?? 0,
      inventory: [],
      path: [],
      intent: null,
      skills: {
        woodcutting: character?.xp.woodcutting ?? 0,
        attack: character?.xp.attack ?? 0,
        foraging: character?.xp.foraging ?? 0,
        fishing: character?.xp.fishing ?? 0,
      },
    };
    this.goblins = [
      ...GOBLIN_SPAWNS.map((p, i) => this.spawnGoblin(`goblin${i}`, 'goblin', p)),
      ...HOBGOBLIN_SPAWNS.map((p, i) => this.spawnGoblin(`hob${i}`, 'hobgoblin', p)),
    ];
    this.trees = [
      ...TREE_TILES.map((p, i): Tree => ({ id: `tree${i}`, kind: 'normal', pos: { ...p }, chopped: false, regrowTick: 0 })),
      ...OAK_TILES.map((p, i): Tree => ({ id: `oak${i}`, kind: 'oak', pos: { ...p }, chopped: false, regrowTick: 0 })),
    ];
    this.stats = {
      deaths: 0,
      deathsWhileAway: 0,
      kills: 0,
      hobKills: 0,
      logsSold: 0,
      flaxSold: 0,
      oakLogsSold: 0,
      shrimpSold: 0,
      coinsEarned: 0,
      shrimpCookedCount: 0,
      shrimpBurntCount: 0,
      shrimpBurnt3: false,
      objectiveHit: false,
      statsBonusHit: false,
      killStreak: 0,
      bestStreak: 0,
      contractsCompleted: 0,
      doubleBereavement: false,
    };
    this.quest = this.rollQuest();
  }

  private spawnGoblin(id: string, tier: GoblinTier, home: Point): Goblin {
    return {
      id,
      tier,
      home: { ...home },
      pos: { ...home },
      hp: TIER_STATS[tier].maxHp,
      alive: true,
      respawnTick: 0,
      aggro: false,
      nextAttacker: 'player',
    };
  }

  get bridgePass(): boolean {
    return this.bridgePassHeld;
  }

  get connected(): boolean {
    return !this.loggedOut && !this.pendingLogout;
  }

  get isLoggedOut(): boolean {
    return this.loggedOut;
  }

  get milestones(): readonly MilestoneId[] {
    return this.milestoneList;
  }

  private award(id: MilestoneId): void {
    if (this.milestoneSet.has(id)) return;
    this.milestoneSet.add(id);
    this.milestoneList.push(id);
    this.events.push({ type: 'milestone', id });
  }

  private rollQuest(): Quest {
    const kinds: QuestKind[] = ['logs', 'flax', 'goblins', 'shrimp'];
    if (this.bridgePassHeld) kinds.push('oakLogs', 'hobgoblins');
    const kind = kinds[this.rng.int(0, kinds.length - 1)] ?? 'logs';
    const defs: Record<QuestKind, { target: number; reward: number }> = {
      logs: { target: 4, reward: 22 },
      flax: { target: 6, reward: 16 },
      goblins: { target: 2, reward: 28 },
      shrimp: { target: 4, reward: 20 },
      oakLogs: { target: 3, reward: 30 },
      hobgoblins: { target: 2, reward: 40 },
    };
    const d = defs[kind];
    return { kind, target: d.target, progress: 0, reward: d.reward, claimed: false };
  }

  private assignQuest(): void {
    this.quest = this.rollQuest();
    this.events.push({
      type: 'questAssigned',
      kind: this.quest.kind,
      target: this.quest.target,
      reward: this.quest.reward,
    });
  }

  private grantSkillXp(skill: SkillName, amount: number): void {
    const gain = this.doubleXp ? amount * 2 : amount;
    const before = levelOf(this.player.skills[skill]);
    this.player.skills[skill] += gain;
    const after = levelOf(this.player.skills[skill]);
    if (after > before) {
      this.events.push({ type: 'levelUp', skill, level: after });
      if (after >= 5 && before < 5) {
        this.award('levelFive');
      }
    }
    this.checkStatsBonus();
  }

  private checkStatsBonus(): void {
    if (this.stats.statsBonusHit) return;
    if (!allSkillsAt99(this.player.skills)) return;
    this.stats.statsBonusHit = true;
    this.events.push({ type: 'allSkills99' });
  }

  private bumpQuest(kind: QuestKind, amount = 1): void {
    const q = this.quest;
    if (q.claimed || q.kind !== kind || q.progress >= q.target) return;
    q.progress = Math.min(q.target, q.progress + amount);
    this.events.push({ type: 'questProgress', kind, progress: q.progress, target: q.target });
    if (q.progress >= q.target) this.events.push({ type: 'questReady' });
  }

  /** Claim Wyn's side contract at the trader stall. Returns false if not ready. */
  turnInQuest(): boolean {
    const q = this.quest;
    if (q.claimed || q.progress < q.target) return false;
    this.addCoins(q.reward);
    q.claimed = true;
    this.stats.contractsCompleted++;
    this.award('contractor');
    this.events.push({ type: 'questComplete', reward: q.reward, kind: q.kind });
    this.assignQuest();
    return true;
  }

  questReady(): boolean {
    return !this.quest.claimed && this.quest.progress >= this.quest.target;
  }

  questLabel(): string {
    const q = this.quest;
    const verbs: Record<QuestKind, string> = {
      logs: 'Gather logs',
      flax: 'Pick flax',
      goblins: 'Slay goblins',
      shrimp: 'Catch shrimp',
      oakLogs: 'Gather oak logs',
      hobgoblins: 'Slay hobgoblins',
    };
    return `${verbs[q.kind]} (${q.progress}/${q.target}) — ${q.reward}gp`;
  }

  // ----- queries -------------------------------------------------------

  walkable = (x: number, y: number): boolean => {
    if (isBridgeTile(x, y)) return this.bridgePassHeld;
    if (staticBlocked(x, y)) return false;
    if (isTreeTile(x, y)) {
      const tree = this.trees.find((t) => t.pos.x === x && t.pos.y === y);
      return tree ? tree.chopped : false;
    }
    return true;
  };

  isInCombat(): boolean {
    return this.goblins.some((g) => g.alive && g.aggro);
  }

  goblinById(id: string): Goblin | undefined {
    return this.goblins.find((g) => g.id === id);
  }

  treeById(id: string): Tree | undefined {
    return this.trees.find((t) => t.id === id);
  }

  invCount(kind: ItemKind): number {
    return this.player.inventory.filter((i) => i === kind).length;
  }

  thingAt(x: number, y: number): TileThing {
    const goblin = this.goblins.find((g) => g.alive && g.pos.x === x && g.pos.y === y);
    if (goblin) return { kind: 'goblin', goblin };
    const tree = this.trees.find((t) => t.pos.x === x && t.pos.y === y);
    if (tree) return tree.chopped ? { kind: 'stump', tree } : { kind: 'tree', tree };
    const pos = { x, y };
    if (this.gravestone && this.gravestone.pos.x === x && this.gravestone.pos.y === y) {
      return { kind: 'gravestone', pos };
    }
    const ch = tileChar(x, y);
    if (ch === 'f') return { kind: 'flax', pos };
    if (ch === 'Y') return { kind: 'trader', pos };
    if (ch === 'b') return { kind: 'bread', pos };
    if (ch === 'c') return { kind: 'campfire', pos };
    if (ch === 's') return { kind: 'sign', pos };
    if (ch === 'l') return { kind: 'toll', pos };
    if (ch === 'w') return { kind: 'water', pos };
    if (ch === 'B') return { kind: 'bridge', pos };
    if (ch === 'p') return { kind: 'fishingSpot', pos };
    if (ch === 'F' || ch === '#') return { kind: 'fence', pos };
    return { kind: 'ground', pos };
  }

  /** All context-menu options for a tile, default action first. */
  optionsAt(x: number, y: number): MenuOption[] {
    const thing = this.thingAt(x, y);
    const out: MenuOption[] = [];
    const approachFor = (target: Point): Point | null =>
      adjacent(this.player.pos, target) || chebyshev(this.player.pos, target) === 0
        ? this.player.pos
        : nearestApproach(this.player.pos, target, this.walkable);

    const intentOpt = (label: string, intent: Intent, target: Point): void => {
      const approach = approachFor(target);
      if (approach) out.push({ label, act: { kind: 'intent', intent, approach } });
    };

    switch (thing.kind) {
      case 'goblin':
        intentOpt(
          thing.goblin.tier === 'hobgoblin' ? 'Attack Hobgoblin' : 'Attack Goblin',
          { kind: 'attack', goblinId: thing.goblin.id },
          thing.goblin.pos,
        );
        break;
      case 'tree':
        intentOpt(
          thing.tree.kind === 'oak' ? 'Chop Oak' : 'Chop Tree',
          { kind: 'chop', treeId: thing.tree.id },
          thing.tree.pos,
        );
        break;
      case 'flax':
        intentOpt('Pick Flax', { kind: 'pick', pos: thing.pos }, thing.pos);
        break;
      case 'trader':
        intentOpt('Trade Trader Wyn', { kind: 'trade' }, thing.pos);
        break;
      case 'bread':
        intentOpt('Eat Bread', { kind: 'eat' }, thing.pos);
        break;
      case 'fishingSpot':
        intentOpt('Fish Shrimp', { kind: 'fish', pos: thing.pos }, thing.pos);
        break;
      case 'bridge':
        if (!this.bridgePassHeld) {
          intentOpt(`Cross bridge (${TOLL_COST}gp toll)`, { kind: 'cross' }, thing.pos);
        }
        break;
      case 'campfire':
        if (this.invCount('shrimpRaw') > 0) {
          intentOpt('Cook shrimp', { kind: 'cook' }, thing.pos);
        }
        break;
      case 'gravestone':
        intentOpt('Reclaim items', { kind: 'reclaim' }, thing.pos);
        break;
      case 'stump':
      case 'toll':
      case 'water':
      case 'sign':
      case 'fence':
      case 'ground':
        break;
    }

    if (this.walkable(x, y)) {
      out.push({ label: 'Walk here', act: { kind: 'walk', to: { x, y } } });
    }
    out.push({ label: `Examine ${thingName(thing)}`, act: { kind: 'examine', text: examineText(thing) } });
    out.push({ label: 'Cancel', act: { kind: 'none' } });
    return out;
  }

  /** Left-click behaviour: the first real option for the tile. */
  defaultOptionAt(x: number, y: number): MenuOption | null {
    const opts = this.optionsAt(x, y);
    const first = opts[0];
    if (!first) return null;
    if (first.act.kind === 'examine' || first.act.kind === 'none') return null;
    return first;
  }

  // ----- commands ------------------------------------------------------

  invoke(opt: MenuOption): void {
    switch (opt.act.kind) {
      case 'walk':
        this.commandWalk(opt.act.to);
        break;
      case 'intent':
        this.commandIntent(opt.act.intent, opt.act.approach);
        break;
      case 'examine':
      case 'none':
        break;
    }
  }

  commandWalk(to: Point): void {
    const path = bfsPath(this.player.pos, to, this.walkable);
    if (path) {
      this.player.path = path;
      this.player.intent = null;
    }
  }

  commandIntent(intent: Intent, approach: Point): void {
    this.player.intent = intent;
    if (intent.kind === 'attack' || intent.kind === 'chop' || intent.kind === 'fish' || intent.kind === 'pick') {
      this.lastWork = intent.kind;
    }
    if (approach.x === this.player.pos.x && approach.y === this.player.pos.y) {
      this.player.path = [];
    } else {
      this.player.path = bfsPath(this.player.pos, approach, this.walkable) ?? [];
    }
  }

  /** Sell every carried item of one kind to Trader Wyn. */
  sell(kind: ItemKind): { sold: number; gained: number } {
    const price = ITEM_PRICES[kind];
    if (price <= 0) return { sold: 0, gained: 0 };
    const sold = this.invCount(kind);
    if (sold === 0) return { sold: 0, gained: 0 };
    this.player.inventory = this.player.inventory.filter((i) => i !== kind);
    const gained = sold * price;
    this.addCoins(gained);
    if (kind === 'log') this.stats.logsSold += sold;
    else if (kind === 'flax') this.stats.flaxSold += sold;
    else if (kind === 'oakLog') this.stats.oakLogsSold += sold;
    else if (kind === 'shrimpCooked') this.stats.shrimpSold += sold;
    this.events.push({ type: 'trade', sold, gained, item: kind });
    return { sold, gained };
  }

  /** Sell everything Wyn will pay for. */
  sellAll(): void {
    const kinds: ItemKind[] = ['log', 'oakLog', 'flax', 'shrimpCooked', 'shrimpRaw'];
    for (const kind of kinds) this.sell(kind);
  }

  /** Buy a loaf into the inventory at Wyn's stall. */
  buyBread(): boolean {
    if (this.player.coins < BREAD_PRICE) return false;
    if (this.player.inventory.length >= INVENTORY_SIZE) {
      this.events.push({ type: 'invFull' });
      return false;
    }
    this.player.coins -= BREAD_PRICE;
    this.player.inventory.push('bread');
    this.events.push({ type: 'breadBought', cost: BREAD_PRICE });
    return true;
  }

  /** Eat a carried consumable (bread or cooked shrimp). */
  eatFromInventory(kind: ItemKind): boolean {
    const heal = kind === 'bread' ? BREAD_HEAL : kind === 'shrimpCooked' ? SHRIMP_HEAL : 0;
    if (heal === 0) return false;
    const index = this.player.inventory.indexOf(kind);
    if (index === -1) return false;
    this.player.inventory.splice(index, 1);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + heal);
    this.events.push({ type: 'eat' });
    return true;
  }

  /**
   * Modem control. Disconnecting mid-combat is not allowed (2004 rules): the
   * fight resolves away-style first, then the character logs out safely.
   */
  setConnected(value: boolean): void {
    if (value) {
      if (this.loggedOut) this.events.push({ type: 'loggedIn' });
      this.loggedOut = false;
      this.pendingLogout = false;
      return;
    }
    if (this.loggedOut || this.pendingLogout) return;
    if (this.isInCombat()) {
      this.pendingLogout = true;
    } else {
      this.loggedOut = true;
      this.events.push({ type: 'loggedOut' });
    }
  }

  /** Events accumulated since the last drain (steps, sells, deaths…). */
  drainEvents(): SimEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  // ----- tick ----------------------------------------------------------

  step(opts: { playerAway?: boolean } = {}): void {
    this.tick++;
    const away = opts.playerAway ?? false;
    this.currentAway = away;

    if (this.pendingLogout && !this.isInCombat()) {
      this.pendingLogout = false;
      this.loggedOut = true;
      this.events.push({ type: 'loggedOut' });
    }

    if (!this.loggedOut) {
      if (away) this.runAwayPlan();
      this.stepPlayer();
      this.stepGoblins(away);
    } else {
      this.stepGoblinsLoggedOut();
    }
    this.stepRespawns();
    this.checkCoinMilestones();
  }

  /** Standing orders, spec priority order. Runs only while away and online. */
  private runAwayPlan(): void {
    const plan = this.awayPlan;
    const p = this.player;

    if (plan.runHome && p.hp < 3) {
      const atCamp = p.pos.x === SPAWN_TILE.x && p.pos.y === SPAWN_TILE.y;
      if (!atCamp) {
        if (p.intent !== null || p.path.length === 0) this.commandWalk(SPAWN_TILE);
        return;
      }
    }

    if (plan.eatBread && p.hp <= 4) {
      if (!this.eatFromInventory('bread')) this.eatFromInventory('shrimpCooked');
    }

    if (plan.autoSell && p.inventory.length >= INVENTORY_SIZE) {
      const hasSellable = p.inventory.some((i) => ITEM_PRICES[i] > 0);
      if (hasSellable) {
        if (adjacent(p.pos, TRADER_TILE)) {
          this.sellAll();
        } else if (p.intent?.kind !== 'trade') {
          const approach = nearestApproach(p.pos, TRADER_TILE, this.walkable);
          if (approach) this.commandIntent({ kind: 'trade' }, approach);
        }
        return;
      }
    }

    if (plan.keepWorking && p.intent === null && p.path.length === 0) {
      this.reacquireWork();
    }
  }

  /** Nearest-target re-acquisition for "keep working". Deterministic: no rng. */
  private reacquireWork(): void {
    const p = this.player;
    const byDistance = <T>(items: T[], posOf: (t: T) => Point): T | undefined => {
      let best: T | undefined;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const item of items) {
        const d = chebyshev(p.pos, posOf(item));
        if (d < bestDist) {
          best = item;
          bestDist = d;
        }
      }
      return best;
    };

    switch (this.lastWork) {
      case 'attack': {
        const target = byDistance(this.goblins.filter((g) => g.alive), (g) => g.pos);
        if (target) {
          const approach = nearestApproach(p.pos, target.pos, this.walkable) ?? p.pos;
          this.commandIntent({ kind: 'attack', goblinId: target.id }, approach);
        }
        return;
      }
      case 'chop': {
        const wc = levelOf(p.skills.woodcutting);
        const target = byDistance(
          this.trees.filter((t) => !t.chopped && (t.kind === 'normal' || wc >= OAK_LEVEL)),
          (t) => t.pos,
        );
        if (target) {
          const approach = nearestApproach(p.pos, target.pos, this.walkable) ?? p.pos;
          this.commandIntent({ kind: 'chop', treeId: target.id }, approach);
        }
        return;
      }
      case 'fish': {
        const approach = nearestApproach(p.pos, FISHING_TILE, this.walkable) ?? p.pos;
        this.commandIntent({ kind: 'fish', pos: { ...FISHING_TILE } }, approach);
        return;
      }
      case 'pick': {
        // Flax tiles are static; the nearest one is always pickable.
        const flax = byDistance(flaxTiles(), (t) => t);
        if (flax) {
          const approach = nearestApproach(p.pos, flax, this.walkable) ?? p.pos;
          this.commandIntent({ kind: 'pick', pos: { ...flax } }, approach);
        }
        return;
      }
      case null:
        return;
    }
  }

  private stepPlayer(): void {
    const p = this.player;
    const intent = p.intent;

    if (intent) {
      const target = this.intentTarget(intent);
      if (target === null) {
        p.intent = null;
        p.path = [];
        return;
      }
      const within =
        intent.kind === 'pick' || intent.kind === 'trade' || intent.kind === 'eat'
        || intent.kind === 'chop' || intent.kind === 'fish' || intent.kind === 'cook'
        || intent.kind === 'cross'
          ? adjacent(p.pos, target)
          : intent.kind === 'reclaim'
            ? chebyshev(p.pos, target) === 0
            : chebyshev(p.pos, target) <= 1;
      if (within) {
        p.path = [];
        this.performIntent(intent, target);
        return;
      }
      // Re-path every tick — goblins move; static targets just keep the path.
      if (intent.kind === 'attack' || p.path.length === 0) {
        const approach = nearestApproach(p.pos, target, this.walkable);
        p.path = approach ? (bfsPath(p.pos, approach, this.walkable) ?? []) : [];
        if (p.path.length === 0 && !adjacent(p.pos, target)) {
          p.intent = null; // unreachable, give up
          return;
        }
      }
    }

    const next = p.path.shift();
    if (next && this.walkable(next.x, next.y)) {
      p.pos = { ...next };
      this.maybeReclaimGravestone();
    } else if (next) {
      // A tree regrew into our path — recompute next tick.
      p.path = [];
    }
  }

  private maybeReclaimGravestone(): void {
    const grave = this.gravestone;
    const p = this.player;
    if (!grave || grave.pos.x !== p.pos.x || grave.pos.y !== p.pos.y) return;
    const room = INVENTORY_SIZE - p.inventory.length;
    const taken = grave.items.splice(0, Math.max(0, room));
    p.inventory.push(...taken);
    if (grave.items.length === 0) {
      this.gravestone = null;
    }
    if (taken.length > 0) {
      this.events.push({ type: 'gravestoneReclaimed', itemCount: taken.length });
      this.award('undertaker');
    }
  }

  private intentTarget(intent: Intent): Point | null {
    switch (intent.kind) {
      case 'attack': {
        const g = this.goblinById(intent.goblinId);
        return g && g.alive ? g.pos : null;
      }
      case 'chop': {
        const t = this.treeById(intent.treeId);
        return t && !t.chopped ? t.pos : null;
      }
      case 'pick':
        return intent.pos;
      case 'trade':
        return TRADER_TILE;
      case 'eat':
        return BREAD_TILE;
      case 'fish':
        return intent.pos;
      case 'cook':
        return CAMPFIRE_TILE;
      case 'cross':
        return this.bridgePassHeld ? null : BRIDGE_TILE;
      case 'reclaim':
        return this.gravestone ? this.gravestone.pos : null;
    }
  }

  private performIntent(intent: Intent, _target: Point): void {
    const p = this.player;
    switch (intent.kind) {
      case 'attack': {
        const g = this.goblinById(intent.goblinId);
        if (!g || !g.alive) {
          p.intent = null;
          return;
        }
        if (!g.aggro) {
          g.aggro = true;
          g.nextAttacker = 'player';
        }
        // Swings resolve in stepGoblins so turn order is in one place.
        return;
      }
      case 'chop': {
        const t = this.treeById(intent.treeId);
        if (!t || t.chopped) {
          p.intent = null;
          return;
        }
        if (t.kind === 'oak' && levelOf(p.skills.woodcutting) < OAK_LEVEL) {
          this.events.push({ type: 'levelTooLow', skill: 'woodcutting', need: OAK_LEVEL });
          p.intent = null;
          return;
        }
        if (p.inventory.length >= INVENTORY_SIZE) {
          this.events.push({ type: 'invFull' });
          p.intent = null;
          return;
        }
        this.events.push({ type: 'chop' });
        const wc = levelOf(p.skills.woodcutting);
        if (this.rng.chance(chopChance(wc, t.kind))) {
          p.inventory.push(t.kind === 'oak' ? 'oakLog' : 'log');
          t.chopped = true;
          t.regrowTick = this.tick + TREE_REGROW_TICKS;
          this.grantSkillXp('woodcutting', t.kind === 'oak' ? 40 : 25);
          this.bumpQuest(t.kind === 'oak' ? 'oakLogs' : 'logs');
          this.events.push({ type: 'log' });
          p.intent = null;
        }
        return;
      }
      case 'pick': {
        if (p.inventory.length >= INVENTORY_SIZE) {
          this.events.push({ type: 'invFull' });
        } else {
          p.inventory.push('flax');
          this.grantSkillXp('foraging', 9);
          this.bumpQuest('flax');
          this.events.push({ type: 'flax' });
        }
        p.intent = null;
        return;
      }
      case 'trade': {
        if (this.currentAway) {
          // Standing order: no trade window to click, just sell the lot.
          this.sellAll();
        } else {
          this.events.push({ type: 'openTrade' });
        }
        p.intent = null;
        return;
      }
      case 'eat': {
        p.hp = Math.min(p.maxHp, p.hp + BREAD_HEAL);
        this.events.push({ type: 'eat' });
        p.intent = null;
        return;
      }
      case 'fish': {
        if (p.inventory.length >= INVENTORY_SIZE) {
          this.events.push({ type: 'invFull' });
          p.intent = null;
          return;
        }
        const level = levelOf(p.skills.fishing);
        if (this.rng.chance(fishChance(level))) {
          p.inventory.push('shrimpRaw');
          this.grantSkillXp('fishing', 10);
          this.bumpQuest('shrimp');
          this.events.push({ type: 'fishCaught' });
        }
        // The spot never depletes; the intent persists like a patient angler.
        return;
      }
      case 'cook': {
        const index = p.inventory.indexOf('shrimpRaw');
        if (index === -1) {
          p.intent = null;
          return;
        }
        p.inventory.splice(index, 1);
        if (this.rng.chance(COOK_SUCCESS)) {
          p.inventory.push('shrimpCooked');
          this.stats.shrimpCookedCount++;
          this.burntStreak = 0;
          this.grantSkillXp('fishing', 5);
          this.events.push({ type: 'shrimpCooked' });
          this.award('chefActually');
        } else {
          p.inventory.push('shrimpBurnt');
          this.stats.shrimpBurntCount++;
          this.burntStreak++;
          if (this.burntStreak >= 3) this.stats.shrimpBurnt3 = true;
          this.events.push({ type: 'shrimpBurnt' });
        }
        // Keep cooking while raw shrimp remain.
        return;
      }
      case 'cross': {
        if (this.bridgePassHeld) {
          p.intent = null;
          return;
        }
        if (p.coins < TOLL_COST) {
          this.events.push({ type: 'tooPoor', need: TOLL_COST });
          p.intent = null;
          return;
        }
        p.coins -= TOLL_COST;
        this.bridgePassHeld = true;
        p.pos = { ...BRIDGE_TILE };
        p.path = [];
        p.intent = null;
        this.events.push({ type: 'tollPaid', cost: TOLL_COST });
        this.award('tollPaid');
        return;
      }
      case 'reclaim': {
        // Arrival on the tile reclaims via maybeReclaimGravestone.
        this.maybeReclaimGravestone();
        p.intent = null;
        return;
      }
    }
  }

  private stepGoblins(away: boolean): void {
    for (const g of this.goblins) {
      if (!g.alive) continue;

      if (g.aggro && chebyshev(g.pos, this.player.pos) > GOBLIN_DEAGGRO_DIST) {
        g.aggro = false;
      }

      // Hobgoblins pick fights on their own — the far bank is not a safe idle.
      if (!g.aggro && g.tier === 'hobgoblin'
        && chebyshev(g.pos, this.player.pos) <= HOBGOBLIN_AGGRO_DIST) {
        g.aggro = true;
        g.nextAttacker = 'goblin';
      }

      if (g.aggro) {
        if (adjacent(g.pos, this.player.pos)) {
          this.resolveCombatTurn(g, away);
        } else {
          // Chase: one BFS step toward a tile adjacent to the player.
          const approach = nearestApproach(g.pos, this.player.pos, this.walkable);
          if (approach) {
            const path = bfsPath(g.pos, approach, this.walkable);
            const next = path?.[0];
            if (next) g.pos = { ...next };
          }
        }
      } else {
        this.wanderGoblin(g);
      }
    }
  }

  /** While logged out the character is elsewhere: no aggro, no combat. */
  private stepGoblinsLoggedOut(): void {
    for (const g of this.goblins) {
      if (!g.alive) continue;
      g.aggro = false;
      this.wanderGoblin(g);
    }
  }

  private wanderGoblin(g: Goblin): void {
    if (chebyshev(g.pos, g.home) > 2) {
      // De-aggro can strand a goblin far from home (e.g. the player died
      // mid-chase); walk back rather than freezing in place forever.
      const path = bfsPath(g.pos, g.home, this.walkable);
      const next = path?.[0];
      if (next) g.pos = { ...next };
    } else if (this.rng.chance(0.15)) {
      // Idle wander near home.
      const dirs = [
        { x: 0, y: -1 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
      ];
      const d = dirs[this.rng.int(0, 3)];
      if (d) {
        const nx = g.pos.x + d.x;
        const ny = g.pos.y + d.y;
        if (this.walkable(nx, ny) && chebyshev({ x: nx, y: ny }, g.home) <= 2) {
          g.pos = { x: nx, y: ny };
        }
      }
    }
  }

  private resolveCombatTurn(g: Goblin, away: boolean): void {
    const p = this.player;
    if (g.nextAttacker === 'player') {
      const attacking = p.intent?.kind === 'attack' && p.intent.goblinId === g.id;
      if (attacking) {
        const atk = levelOf(this.player.skills.attack);
        const dmg = this.rng.int(0, playerMaxHit(atk));
        if (dmg > 0) this.grantSkillXp('attack', dmg * 8);
        this.events.push({ type: 'playerSwing', damage: dmg, goblinId: g.id });
        g.hp -= dmg;
        if (g.hp <= 0) {
          this.killGoblin(g);
          return;
        }
      }
      g.nextAttacker = 'goblin';
    } else {
      const dmg = this.rng.int(0, TIER_STATS[g.tier].maxHit);
      this.events.push({ type: 'goblinSwing', damage: dmg, goblinId: g.id });
      p.hp -= dmg;
      if (p.hp <= 0) {
        this.killPlayer(away);
        return;
      }
      g.nextAttacker = 'player';
    }
  }

  private killGoblin(g: Goblin): void {
    const tier = TIER_STATS[g.tier];
    g.alive = false;
    g.aggro = false;
    g.respawnTick = this.tick + GOBLIN_RESPAWN_TICKS;
    const drop = this.rng.int(tier.dropMin, tier.dropMax);
    this.stats.kills++;
    if (g.tier === 'hobgoblin') {
      this.stats.hobKills++;
      this.award('bullyTheBully');
    }
    this.award('firstBlood');
    this.stats.killStreak++;
    if (this.stats.killStreak > this.stats.bestStreak) this.stats.bestStreak = this.stats.killStreak;
    const streakBonus = Math.min(5, Math.max(0, this.stats.killStreak - 1)) * 2;
    this.grantSkillXp('attack', tier.killXp);
    this.bumpQuest(g.tier === 'hobgoblin' ? 'hobgoblins' : 'goblins');
    this.events.push({ type: 'goblinDied', goblinId: g.id, coins: drop, streakBonus });
    this.addCoins(drop + streakBonus);
    if (this.player.intent?.kind === 'attack' && this.player.intent.goblinId === g.id) {
      this.player.intent = null;
    }
  }

  private killPlayer(away: boolean): void {
    const p = this.player;
    const deathPos = { ...p.pos };
    const lost = Math.floor(p.coins * 0.25);
    p.coins -= lost;

    if (p.inventory.length > 0) {
      if (this.gravestone) {
        this.stats.doubleBereavement = true;
        this.events.push({ type: 'gravestoneLost', itemCount: this.gravestone.items.length });
      }
      this.gravestone = {
        pos: deathPos,
        items: p.inventory.slice(),
        expiresAtTick: this.tick + GRAVESTONE_TICKS,
      };
      this.events.push({ type: 'gravestoneCreated', itemCount: p.inventory.length });
      p.inventory = [];
    }

    p.hp = p.maxHp;
    p.pos = { ...SPAWN_TILE };
    p.path = [];
    p.intent = null;
    this.stats.deaths++;
    this.stats.killStreak = 0;
    if (away) this.stats.deathsWhileAway++;
    for (const g of this.goblins) g.aggro = false;
    this.events.push({ type: 'playerDied', coinsLost: lost, whileAway: away });
  }

  private stepRespawns(): void {
    for (const g of this.goblins) {
      if (!g.alive && this.tick >= g.respawnTick) {
        g.alive = true;
        g.hp = TIER_STATS[g.tier].maxHp;
        g.pos = { ...g.home };
        g.aggro = false;
        g.nextAttacker = 'player';
      }
    }
    for (const t of this.trees) {
      if (t.chopped && this.tick >= t.regrowTick) {
        // Don't regrow under the player's feet.
        if (this.player.pos.x === t.pos.x && this.player.pos.y === t.pos.y) continue;
        t.chopped = false;
      }
    }
    if (this.gravestone && this.tick >= this.gravestone.expiresAtTick) {
      this.events.push({ type: 'gravestoneLost', itemCount: this.gravestone.items.length });
      this.gravestone = null;
    }
  }

  private addCoins(n: number): void {
    if (n <= 0) return;
    const room = MAX_COINS - this.player.coins;
    if (room <= 0) return;
    const added = Math.min(n, room);
    this.player.coins += added;
    this.stats.coinsEarned += added;
    if (!this.stats.objectiveHit && this.player.coins >= COIN_OBJECTIVE) {
      this.stats.objectiveHit = true;
      this.events.push({ type: 'objectiveHit' });
    }
  }

  /** Session-earned coin milestones (spec §2 ladder). */
  private checkCoinMilestones(): void {
    const earned = this.stats.coinsEarned;
    if (earned >= 25) this.award('pocketMoney');
    if (earned >= 60) this.award('twoDinnersAhead');
    if (earned >= 100) this.award('dinnerFund');
    if (earned >= 1000) this.award('theThousandaire');
  }
}

function flaxTiles(): Point[] {
  return FLAX_TILES.map((p) => ({ ...p }));
}

export function thingName(thing: TileThing): string {
  switch (thing.kind) {
    case 'goblin':
      return thing.goblin.tier === 'hobgoblin' ? 'Hobgoblin' : 'Goblin';
    case 'tree':
      return thing.tree.kind === 'oak' ? 'Oak' : 'Tree';
    case 'stump':
      return 'Stump';
    case 'flax':
      return 'Flax';
    case 'trader':
      return 'Trader Wyn';
    case 'bread':
      return 'Bread';
    case 'campfire':
      return 'Campfire';
    case 'sign':
      return 'Signpost';
    case 'toll':
      return 'Toll Sign';
    case 'water':
      return 'River Mud';
    case 'bridge':
      return 'Bridge';
    case 'fishingSpot':
      return 'Fishing Spot';
    case 'gravestone':
      return 'Gravestone';
    case 'fence':
      return 'Fence';
    case 'ground':
      return 'Ground';
  }
}

export function examineText(thing: TileThing): string {
  switch (thing.kind) {
    case 'goblin':
      return thing.goblin.tier === 'hobgoblin' ? EXAMINE_TEXTS.hobgoblin : EXAMINE_TEXTS.goblin;
    case 'tree':
      return thing.tree.kind === 'oak' ? EXAMINE_TEXTS.oak : EXAMINE_TEXTS.tree;
    case 'stump':
      return EXAMINE_TEXTS.stump;
    case 'flax':
      return EXAMINE_TEXTS.flax;
    case 'trader':
      return EXAMINE_TEXTS.trader;
    case 'bread':
      return EXAMINE_TEXTS.bread;
    case 'campfire':
      return EXAMINE_TEXTS.campfire;
    case 'sign':
      return EXAMINE_TEXTS.sign;
    case 'toll':
      return EXAMINE_TEXTS.toll;
    case 'water':
      return EXAMINE_TEXTS.water;
    case 'bridge':
      return EXAMINE_TEXTS.bridge;
    case 'fishingSpot':
      return EXAMINE_TEXTS.fishingSpot;
    case 'gravestone':
      return EXAMINE_TEXTS.gravestone;
    case 'fence':
      return EXAMINE_TEXTS.fence;
    case 'ground':
      return EXAMINE_TEXTS.ground;
  }
}

export { CAMPFIRE_TILE };
