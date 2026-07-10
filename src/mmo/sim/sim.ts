import { Rng } from './rng';
import {
  allSkillsAt99,
  COIN_OBJECTIVE,
  levelOf,
  MAX_COINS,
} from './osrs';
import {
  BREAD_TILE,
  CAMPFIRE_TILE,
  EXAMINE_TEXTS,
  GOBLIN_SPAWNS,
  SPAWN_TILE,
  TRADER_TILE,
  TREE_TILES,
  isTreeTile,
  staticBlocked,
  tileChar,
} from './map';
import { adjacent, bfsPath, chebyshev, nearestApproach } from './path';
import type {
  Goblin,
  Intent,
  ItemKind,
  MenuOption,
  PlayerState,
  Point,
  Quest,
  QuestKind,
  SimEvent,
  SimStats,
  SkillName,
  TileThing,
  Tree,
} from './types';

export const INVENTORY_SIZE = 28;
export const GOBLIN_MAX_HP = 3;
export const PLAYER_MAX_HP = 10;
export const GOBLIN_RESPAWN_TICKS = 10;
export const TREE_REGROW_TICKS = 8;
export const LOG_PRICE = 7;
export const FLAX_PRICE = 2;
export const BREAD_HEAL = 4;
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
const GOBLIN_DEAGGRO_DIST = 7;
const BASE_CHOP_CHANCE = 0.42;

function chopChance(wcLevel: number): number {
  return Math.min(0.88, BASE_CHOP_CHANCE + (wcLevel - 1) * 0.045);
}

function playerMaxHit(atkLevel: number): number {
  return Math.min(6, 2 + Math.floor((atkLevel - 1) / 2));
}

export class MudwickSim {
  readonly player: PlayerState;
  readonly goblins: Goblin[];
  readonly trees: Tree[];
  readonly stats: SimStats;
  /** Trader Wyn's rotating side contract — bonus gp for grinding. */
  quest: Quest;
  tick = 0;

  private rng: Rng;
  private events: SimEvent[] = [];

  constructor(seed = 0xc0ffee) {
    this.rng = new Rng(seed);
    this.player = {
      pos: { ...SPAWN_TILE },
      hp: PLAYER_MAX_HP,
      maxHp: PLAYER_MAX_HP,
      coins: 0,
      inventory: [],
      path: [],
      intent: null,
      skills: { woodcutting: 0, attack: 0, foraging: 0 },
    };
    this.goblins = GOBLIN_SPAWNS.map((p, i) => ({
      id: `goblin${i}`,
      home: { ...p },
      pos: { ...p },
      hp: GOBLIN_MAX_HP,
      alive: true,
      respawnTick: 0,
      aggro: false,
      nextAttacker: 'player',
    }));
    this.trees = TREE_TILES.map((p, i) => ({
      id: `tree${i}`,
      pos: { ...p },
      chopped: false,
      regrowTick: 0,
    }));
    this.stats = {
      deaths: 0,
      deathsWhileAway: 0,
      kills: 0,
      logsSold: 0,
      flaxSold: 0,
      objectiveHit: false,
      statsBonusHit: false,
      killStreak: 0,
      bestStreak: 0,
      contractsCompleted: 0,
    };
    this.quest = this.rollQuest();
  }

  private rollQuest(): Quest {
    const kinds: QuestKind[] = ['logs', 'flax', 'goblins'];
    const kind = kinds[this.rng.int(0, kinds.length - 1)] ?? 'logs';
    const defs: Record<QuestKind, { target: number; reward: number }> = {
      logs: { target: 4, reward: 22 },
      flax: { target: 6, reward: 16 },
      goblins: { target: 2, reward: 28 },
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
    const before = levelOf(this.player.skills[skill]);
    this.player.skills[skill] += amount;
    const after = levelOf(this.player.skills[skill]);
    if (after > before) {
      this.events.push({ type: 'levelUp', skill, level: after });
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
    };
    return `${verbs[q.kind]} (${q.progress}/${q.target}) — ${q.reward}gp`;
  }

  // ----- queries -------------------------------------------------------

  walkable = (x: number, y: number): boolean => {
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
    const ch = tileChar(x, y);
    const pos = { x, y };
    if (ch === 'f') return { kind: 'flax', pos };
    if (ch === 'Y') return { kind: 'trader', pos };
    if (ch === 'b') return { kind: 'bread', pos };
    if (ch === 'c') return { kind: 'campfire', pos };
    if (ch === 's') return { kind: 'sign', pos };
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
        intentOpt('Attack Goblin', { kind: 'attack', goblinId: thing.goblin.id }, thing.goblin.pos);
        break;
      case 'tree':
        intentOpt('Chop Tree', { kind: 'chop', treeId: thing.tree.id }, thing.tree.pos);
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
      case 'stump':
      case 'campfire':
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
    if (approach.x === this.player.pos.x && approach.y === this.player.pos.y) {
      this.player.path = [];
    } else {
      this.player.path = bfsPath(this.player.pos, approach, this.walkable) ?? [];
    }
  }

  /** Sell every carried item of one kind to Trader Wyn. */
  sell(kind: ItemKind): { sold: number; gained: number } {
    const price = kind === 'log' ? LOG_PRICE : FLAX_PRICE;
    const sold = this.invCount(kind);
    if (sold === 0) return { sold: 0, gained: 0 };
    this.player.inventory = this.player.inventory.filter((i) => i !== kind);
    const gained = sold * price;
    this.addCoins(gained);
    if (kind === 'log') this.stats.logsSold += sold;
    else this.stats.flaxSold += sold;
    this.events.push({ type: 'trade', sold, gained, item: kind });
    return { sold, gained };
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

    this.stepPlayer();
    this.stepGoblins(away);
    this.stepRespawns();
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
      const within = intent.kind === 'pick' || intent.kind === 'trade' || intent.kind === 'eat' || intent.kind === 'chop'
        ? adjacent(p.pos, target)
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
    } else if (next) {
      // A tree regrew into our path — recompute next tick.
      p.path = [];
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
        if (p.inventory.length >= INVENTORY_SIZE) {
          this.events.push({ type: 'invFull' });
          p.intent = null;
          return;
        }
        this.events.push({ type: 'chop' });
        const wc = levelOf(this.player.skills.woodcutting);
        if (this.rng.chance(chopChance(wc))) {
          p.inventory.push('log');
          t.chopped = true;
          t.regrowTick = this.tick + TREE_REGROW_TICKS;
          this.grantSkillXp('woodcutting', 25);
          this.bumpQuest('logs');
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
        this.events.push({ type: 'openTrade' });
        p.intent = null;
        return;
      }
      case 'eat': {
        p.hp = Math.min(p.maxHp, p.hp + BREAD_HEAL);
        this.events.push({ type: 'eat' });
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
      } else if (chebyshev(g.pos, g.home) > 2) {
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
      const dmg = this.rng.int(0, 1);
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
    g.alive = false;
    g.aggro = false;
    g.respawnTick = this.tick + GOBLIN_RESPAWN_TICKS;
    const drop = this.rng.int(GOBLIN_DROP_MIN, GOBLIN_DROP_MAX);
    this.stats.kills++;
    this.stats.killStreak++;
    if (this.stats.killStreak > this.stats.bestStreak) this.stats.bestStreak = this.stats.killStreak;
    const streakBonus = Math.min(5, Math.max(0, this.stats.killStreak - 1)) * 2;
    this.grantSkillXp('attack', 12);
    this.bumpQuest('goblins');
    this.events.push({ type: 'goblinDied', goblinId: g.id, coins: drop, streakBonus });
    this.addCoins(drop + streakBonus);
    if (this.player.intent?.kind === 'attack' && this.player.intent.goblinId === g.id) {
      this.player.intent = null;
    }
  }

  private killPlayer(away: boolean): void {
    const p = this.player;
    const lost = Math.floor(p.coins * 0.25);
    p.coins -= lost;
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
        g.hp = GOBLIN_MAX_HP;
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
  }

  private addCoins(n: number): void {
    if (n <= 0) return;
    const room = MAX_COINS - this.player.coins;
    if (room <= 0) return;
    this.player.coins += Math.min(n, room);
    if (!this.stats.objectiveHit && this.player.coins >= COIN_OBJECTIVE) {
      this.stats.objectiveHit = true;
      this.events.push({ type: 'objectiveHit' });
    }
  }
}

export function thingName(thing: TileThing): string {
  switch (thing.kind) {
    case 'goblin':
      return 'Goblin';
    case 'tree':
      return 'Tree';
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
    case 'fence':
      return 'Fence';
    case 'ground':
      return 'Ground';
  }
}

export function examineText(thing: TileThing): string {
  switch (thing.kind) {
    case 'goblin':
      return EXAMINE_TEXTS.goblin;
    case 'tree':
      return EXAMINE_TEXTS.tree;
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
    case 'fence':
      return EXAMINE_TEXTS.fence;
    case 'ground':
      return EXAMINE_TEXTS.ground;
  }
}

export { CAMPFIRE_TILE };
