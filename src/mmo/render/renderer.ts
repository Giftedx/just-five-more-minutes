import { CAMPFIRE_TILE, MAP_H, MAP_W, TILE, TRADER_TILE, tileChar } from '../sim/map';
import {
  bonusProgressLabel,
  formatGpShort,
  objectiveProgressLabel,
} from '../sim/osrs';
import {
  BREAD_PRICE,
  ITEM_PRICES,
  levelOf,
  MudwickSim,
  MAX_LEVEL,
  PLAYER_MAX_HP,
  xpForLevel,
} from '../sim/sim';
import { Rng } from '../sim/rng';
import type {
  AwayPlan,
  ItemKind,
  MenuOption,
  MilestoneId,
  Point,
  QuestKind,
  SimEvent,
  SkillName,
} from '../sim/types';

export type TradeAction =
  | { kind: 'quest' }
  | { kind: 'sell'; item: ItemKind }
  | { kind: 'bread' }
  | { kind: 'done' };

export const MILESTONE_LABELS: Readonly<Record<MilestoneId, string>> = {
  firstBlood: 'First blood!',
  pocketMoney: 'Pocket money: 25gp earned tonight.',
  twoDinnersAhead: 'Two dinners ahead: 60gp earned.',
  dinnerFund: 'DINNER FUND BANKED — 100gp earned tonight!',
  theThousandaire: 'The Thousandaire. In one evening.',
  contractor: 'Contractor: first Wyn job done.',
  levelFive: 'Level five! The grind is grinding.',
  tollPaid: 'Toll paid. The far bank is yours.',
  bullyTheBully: 'Hobgoblin down. Bully the bully.',
  undertaker: 'Undertaker: gravestone reclaimed.',
  chefActually: 'A chef, actually: shrimp cooked.',
};
import {
  attackDirectionForDelta,
  drawSprite,
  GOBLIN_ANGRY_SPRITE,
  GOBLIN_SPRITE,
  HOB_ANGRY_SPRITE,
  HOB_SPRITE,
  HP_EMPTY_SPRITE,
  HP_FULL_SPRITE,
  PLAYER_ATTACK_SPRITES,
  PLAYER_SPRITE,
  TRADER_SPRITE,
  type AttackDirection,
  type Sprite,
} from './sprites';

export const CANVAS_W = 320;
export const CANVAS_H = 240;
export const VIEW_W = 240; // world viewport width; right 80px is the side panel
export const PANEL_W = CANVAS_W - VIEW_W;
export const DISCONNECT_COLORS = {
  failure: '#981818',
  footer: '#c0c0c0',
} as const;
export const DOUBLE_XP_COLORS = {
  backdrop: '#161008',
  gold: '#f2c94c',
  parchment: '#fff0a8',
  ember: '#c76b2a',
  moss: '#6e8f45',
} as const;
export const DOUBLE_XP_COPY = {
  badge: '2×',
  label: 'DOUBLE XP',
  detail: 'FRIDAY EVENT',
} as const;
export const AWAY_PLAN_COLORS = {
  plate: '#172012',
  plateBorder: '#6f7f54',
  caption: '#e8c33f',
  offBg: '#303328',
  offBorder: '#8a8f78',
  offText: '#f0ead8',
  onBg: '#315a2c',
  onBorder: '#8be86b',
  onText: '#f0ffe8',
  hover: '#fff4d0',
  stateBar: '#8be86b',
} as const;

export const AWAY_PLAN_UI = {
  plate: { x: 131, y: 1, w: 108, h: 22 },
  caption: 'AWAY PLAN',
  chips: [
    { key: 'keepWorking', label: 'WORK', x: 135, y: 10, w: 24, h: 11 },
    { key: 'eatBread', label: 'EAT', x: 161, y: 10, w: 24, h: 11 },
    { key: 'runHome', label: 'HOME', x: 187, y: 10, w: 24, h: 11 },
    { key: 'autoSell', label: 'SELL', x: 213, y: 10, w: 24, h: 11 },
  ],
} as const satisfies {
  plate: { x: number; y: number; w: number; h: number };
  caption: string;
  chips: readonly {
    key: keyof AwayPlan;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }[];
};

export interface DisconnectFrame {
  retryLabel: string;
  activeSegments: number;
}

/** Pure presentation state: animation follows the renderer clock and needs no timer. */
export function disconnectFrame(now: number): DisconnectFrame {
  return {
    retryLabel: `Retrying${'.'.repeat(1 + (Math.floor(now / 400) % 3))}`,
    activeSegments: 1 + (Math.floor(now / 200) % 6),
  };
}

interface Hitsplat {
  x: number;
  y: number;
  dmg: number;
  until: number;
}

interface ChatLine {
  text: string;
  color: string;
  until: number;
}

/** Rising "+25 Woodcutting" toast, top-right of the viewport. */
interface XpDrop {
  text: string;
  until: number;
}

/**
 * Cosmetic "other players": they wander, they chat nonsense, they cannot be
 * interacted with in any way. The most authentic MMO experience available.
 */
interface Ghost {
  id: string;
  name: string;
  pos: Point;
  sprite: Sprite;
  nextMoveAt: number;
  say: string | null;
  sayUntil: number;
  nextSayAt: number;
}

const GHOST_CHATTER: readonly string[] = [
  'selling flax 3gp',
  'free stuff pls',
  'anyone else hear their mum',
  'grats',
  'how do u sit',
  'buying gf 100gp',
  'dinner in 10 they said',
  'wc lvl 4!!!',
  'goblin pen is NOT safe',
  'trader wyn scammed me',
  'f',
  'nice logs bro',
  'streak bonus is real',
  'just 5 more mins',
  'wyn quest op',
  'lag??',
  'brb chores',
  'ironman btw',
  'nice hit splat',
  'where r u goblins',
];

function recolorPlayer(tunic: string, shade: string, hair: string): Sprite {
  return {
    rows: PLAYER_SPRITE.rows,
    palette: { ...PLAYER_SPRITE.palette, b: tunic, d: shade, h: hair },
  };
}

/** XP needed scales quadratically — close enough to feel like the real grind. */
function skillLabel(skill: SkillName): string {
  switch (skill) {
    case 'woodcutting':
      return 'Woodcutting';
    case 'attack':
      return 'Attack';
    case 'foraging':
      return 'Foraging';
    case 'fishing':
      return 'Fishing';
  }
}

export function xpDropLabel(baseAmount: number, skill: SkillName, multiplier: 1 | 2): string {
  const suffix = multiplier === 2 ? ' · 2×' : '';
  return `+${baseAmount * multiplier} ${skillLabel(skill)}${suffix}`;
}

interface MenuState {
  x: number;
  y: number;
  w: number;
  h: number;
  options: MenuOption[];
  hover: number;
}

interface ClickMarker {
  x: number;
  y: number;
  until: number;
  red: boolean;
}

/** Rising reward text, e.g. "+9gp" over a dead goblin. */
interface CoinPop {
  x: number;
  y: number;
  text: string;
  until: number;
}

/** 2x2 pixel particle with simple ballistics (wood chips, poofs, petals). */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  until: number;
}

/** Smoothly displayed entity positions, in world pixels. */
type DispMap = Map<string, { x: number; y: number }>;

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class MmoRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: MudwickSim;
  private disp: DispMap = new Map();
  private hitsplats: Hitsplat[] = [];
  private chat: ChatLine[] = [];
  private xpDrops: XpDrop[] = [];
  private ghosts: Ghost[] = [];
  private objectiveFlash = 0;
  private swingUntil = 0;
  private swingDirection: AttackDirection = 'east';
  private welcomed = false;
  menu: MenuState | null = null;
  tradeOpen = false;
  /** Mouse position in canvas pixels, or null when the cursor is elsewhere. */
  mouse: Point | null = null;
  private markers: ClickMarker[] = [];
  private coinPops: CoinPop[] = [];
  private particles: Particle[] = [];
  private vignette: HTMLCanvasElement | null = null;
  private camX = 0;
  private tickMs: number;
  private crowdRng: Rng;

  constructor(sim: MudwickSim, tickMs: number, crowdSeed = 0xc0ffee) {
    this.sim = sim;
    this.tickMs = tickMs;
    this.crowdRng = new Rng((crowdSeed ^ 0x5eed) >>> 0);
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
    this.buildVignette();

    this.ghosts = [
      {
        id: 'ghost0',
        name: 'xX_Dave_Xx',
        pos: { x: 6, y: 4 },
        sprite: recolorPlayer('#8a3c3c', '#66292c', '#2e2218'),
        nextMoveAt: 0,
        say: null,
        sayUntil: 0,
        nextSayAt: 6000,
      },
      {
        id: 'ghost1',
        name: 'Brenda1987',
        pos: { x: 10, y: 5 },
        sprite: recolorPlayer('#7a3b8f', '#5b2c6b', '#d8b46a'),
        nextMoveAt: 0,
        say: null,
        sayUntil: 0,
        nextSayAt: 16000,
      },
      {
        id: 'ghost2',
        name: 'lvl3pkr',
        pos: { x: 5, y: 10 },
        sprite: recolorPlayer('#3c6e4a', '#2a4f34', '#8a5a2b'),
        nextMoveAt: 0,
        say: null,
        sayUntil: 0,
        nextSayAt: 28000,
      },
      {
        id: 'ghost3',
        name: 'IronMum42',
        pos: { x: 8, y: 3 },
        sprite: recolorPlayer('#6a4a8a', '#4a3460', '#d8b46a'),
        nextMoveAt: 0,
        say: null,
        sayUntil: 0,
        nextSayAt: 22000,
      },
      {
        id: 'ghost4',
        name: 'GoblinFan99',
        pos: { x: 14, y: 4 },
        sprite: recolorPlayer('#8a6a3c', '#6a5028', '#2e2218'),
        nextMoveAt: 0,
        say: null,
        sayUntil: 0,
        nextSayAt: 34000,
      },
      {
        // Life on the far bank — visible proof the world doesn't need you.
        id: 'ghost5',
        name: 'oakl0rd',
        pos: { x: 26, y: 5 },
        sprite: recolorPlayer('#3c8a8a', '#2a6060', '#d8b46a'),
        nextMoveAt: 0,
        say: null,
        sayUntil: 0,
        nextSayAt: 44000,
      },
    ];
  }

  /** Pre-rendered soft dark corners for the world viewport (tube feel). */
  private buildVignette(): void {
    const v = document.createElement('canvas');
    v.width = VIEW_W;
    v.height = CANVAS_H;
    const vc = v.getContext('2d');
    if (!vc) return;
    const grad = vc.createRadialGradient(
      VIEW_W / 2, CANVAS_H / 2, CANVAS_H * 0.46,
      VIEW_W / 2, CANVAS_H / 2, CANVAS_H * 0.88,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.26)');
    vc.fillStyle = grad;
    vc.fillRect(0, 0, VIEW_W, CANVAS_H);
    this.vignette = v;
  }

  private spawnBurst(x: number, y: number, colors: string[], count: number, now: number, lifeMs: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.045,
        vy: -0.01 - Math.random() * 0.04,
        color: colors[i % colors.length] ?? '#fff',
        until: now + lifeMs * (0.7 + Math.random() * 0.5),
      });
    }
  }

  setTickMs(ms: number): void {
    this.tickMs = ms;
  }

  /** World-pixel position an entity is currently drawn at. */
  private displayed(id: string, tile: Point, dtMs: number): { x: number; y: number } {
    const target = { x: tile.x * TILE, y: tile.y * TILE };
    let d = this.disp.get(id);
    if (!d) {
      d = { ...target };
      this.disp.set(id, d);
    }
    const speed = (TILE / this.tickMs) * dtMs * 1.15;
    const dx = target.x - d.x;
    const dy = target.y - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist > TILE * 2.5) {
      // Teleport (respawn) — snap.
      d.x = target.x;
      d.y = target.y;
    } else if (dist > 0.01) {
      const move = Math.min(dist, speed);
      d.x += (dx / dist) * move;
      d.y += (dy / dist) * move;
    }
    return d;
  }

  consumeEvents(events: SimEvent[], now: number): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'playerSwing': {
          const g = this.sim.goblinById(ev.goblinId);
          if (g) {
            const direction = attackDirectionForDelta(
              g.pos.x - this.sim.player.pos.x,
              g.pos.y - this.sim.player.pos.y,
            );
            if (direction) this.swingDirection = direction;
            const d = this.disp.get(ev.goblinId) ?? { x: g.pos.x * TILE, y: g.pos.y * TILE };
            this.hitsplats.push({ x: d.x + 8, y: d.y + 8, dmg: ev.damage, until: now + 700 });
          }
          this.swingUntil = now + 220;
          if (ev.damage > 0) {
            this.xpDrops.push({
              text: xpDropLabel(ev.damage * 8, 'attack', this.sim.xpMultiplier),
              until: now + 1300,
            });
          }
          break;
        }
        case 'goblinSwing': {
          const d = this.disp.get('player') ?? {
            x: this.sim.player.pos.x * TILE,
            y: this.sim.player.pos.y * TILE,
          };
          this.hitsplats.push({ x: d.x + 8, y: d.y + 8, dmg: ev.damage, until: now + 700 });
          break;
        }
        case 'goblinDied': {
          const bonus = ev.streakBonus > 0 ? ` (+${ev.streakBonus}gp streak!)` : '';
          this.postMessage(`The goblin drops ${ev.coins} coins.${bonus}`, now);
          const g = this.sim.goblinById(ev.goblinId);
          const killXp = g?.tier === 'hobgoblin' ? 20 : 12;
          this.xpDrops.push({
            text: xpDropLabel(killXp, 'attack', this.sim.xpMultiplier),
            until: now + 1300,
          });
          if (g) {
            const d = this.disp.get(ev.goblinId) ?? { x: g.pos.x * TILE, y: g.pos.y * TILE };
            this.coinPops.push({
              x: d.x + 8,
              y: d.y + 2,
              text: `+${ev.coins + ev.streakBonus}gp`,
              until: now + 900,
            });
            this.spawnBurst(d.x + 8, d.y + 8, ['#5f8f3e', '#456b2c', '#9a9a9a'], 6, now, 450);
          }
          break;
        }
        case 'playerDied': {
          this.postMessage(
            ev.coinsLost > 0 ? `Oh dear, you are dead! (-${ev.coinsLost} coins)` : 'Oh dear, you are dead!',
            now,
          );
          const d = this.disp.get('player');
          if (d) this.spawnBurst(d.x + 8, d.y + 8, ['#c0c0c0', '#8a8a8a'], 8, now, 550);
          this.ghostReact(this.crowdRng.chance(0.5) ? 'lol' : 'F', now);
          break;
        }
        case 'invFull':
          this.postMessage("Your backpack is full.", now);
          break;
        case 'objectiveHit':
          this.objectiveFlash = now + 4000;
          this.postMessage('Max stack! 2,147,483,647 gp. The economy thanks you.', now);
          break;
        case 'allSkills99':
          this.objectiveFlash = now + 4000;
          this.postMessage('Level 99 in all stats. Mum is still waiting.', now, '#ffd23f');
          break;
        case 'trade':
          this.postMessage(`Sold ${ev.sold} ${ev.item}${ev.sold === 1 ? '' : 's'} for ${ev.gained}gp.`, now);
          break;
        case 'openTrade':
          this.tradeOpen = true;
          this.postMessage('"Show me the goods." — Wyn', now, '#9be8e0');
          break;
        case 'fishCaught': {
          const d = this.disp.get('player');
          if (d) this.spawnBurst(d.x + 8, d.y + 10, ['#d88a8a', '#cfe0ff'], 4, now, 500);
          this.xpDrops.push({
            text: xpDropLabel(10, 'fishing', this.sim.xpMultiplier),
            until: now + 1300,
          });
          this.postMessage('You catch some shrimp.', now);
          break;
        }
        case 'shrimpCooked':
          this.xpDrops.push({
            text: xpDropLabel(5, 'fishing', this.sim.xpMultiplier),
            until: now + 1300,
          });
          this.postMessage('You cook the shrimp. Nailed it.', now);
          break;
        case 'shrimpBurnt':
          this.postMessage('You accidentally burn the shrimp.', now, '#e88a6a');
          break;
        case 'tollPaid':
          this.postMessage(`You pay the ${ev.cost}gp toll. The far bank is yours, forever.`, now, '#ffd23f');
          break;
        case 'tooPoor':
          this.postMessage(`You need ${ev.need}gp for the toll. The troll is unmoved.`, now, '#e88a6a');
          break;
        case 'levelTooLow':
          this.postMessage(`You need ${skillLabel(ev.skill)} ${ev.need} for that.`, now, '#e88a6a');
          break;
        case 'breadBought':
          this.postMessage(`You buy a loaf for ${ev.cost}gp. Health insurance.`, now);
          break;
        case 'gravestoneCreated':
          this.postMessage(`Your things (${ev.itemCount}) wait at a gravestone. Sixty seconds.`, now, '#e88a6a');
          break;
        case 'gravestoneReclaimed':
          this.postMessage(`You reclaim your things (${ev.itemCount}). Dignity pending.`, now, '#8be86b');
          break;
        case 'gravestoneLost':
          this.postMessage(`The gravestone crumbles. ${ev.itemCount} items, gone to the mud.`, now, '#e88a6a');
          break;
        case 'loggedOut':
          this.ghostReact('gone?? lol', now);
          break;
        case 'loggedIn':
          this.postMessage('Welcome back to Mudwick Online.', now, '#ffd23f');
          break;
        case 'milestone':
          this.postMessage(MILESTONE_LABELS[ev.id], now, '#ffd23f');
          break;
        case 'chop': {
          // chips fly off the tree under the axe (intent still points at it)
          const intent = this.sim.player.intent;
          let cx = this.sim.player.pos.x;
          let cy = this.sim.player.pos.y;
          if (intent?.kind === 'chop') {
            const tree = this.sim.trees.find((t) => t.id === intent.treeId);
            if (tree) {
              cx = tree.pos.x;
              cy = tree.pos.y;
            }
          }
          this.spawnBurst(cx * TILE + 8, cy * TILE + 9, ['#caa86a', '#8a6a3a'], 6, now, 480);
          break;
        }
        case 'flax': {
          const d = this.disp.get('player');
          if (d) this.spawnBurst(d.x + 8, d.y + 10, ['#7fa8e8', '#cfe0ff'], 4, now, 500);
          this.xpDrops.push({
            text: xpDropLabel(9, 'foraging', this.sim.xpMultiplier),
            until: now + 1300,
          });
          break;
        }
        case 'log':
          this.xpDrops.push({
            text: xpDropLabel(25, 'woodcutting', this.sim.xpMultiplier),
            until: now + 1300,
          });
          this.postMessage('You get some logs.', now);
          break;
        case 'levelUp':
          this.postMessage(
            `Congratulations, you just advanced a ${skillLabel(ev.skill)} level (now ${ev.level}).`,
            now,
            '#ffd23f',
          );
          break;
        case 'questAssigned':
          this.postMessage(
            `Wyn's contract: ${this.questPhrase(ev.kind, ev.target)} for ${ev.reward}gp bonus.`,
            now,
            '#9be8e0',
          );
          break;
        case 'questProgress':
          if (ev.progress === ev.target) {
            this.postMessage('Contract complete — see Trader Wyn!', now, '#8be86b');
          }
          break;
        case 'questReady':
          break;
        case 'questComplete':
          this.postMessage(`Wyn pays ${ev.reward}gp. "Pleasure doing business."`, now, '#ffd23f');
          break;
        case 'eat':
          this.postMessage('You eat the bread. It heals some health.', now);
          break;
      }
    }
  }

  /** Push a line onto the chat log (game messages cream, chatter blue). */
  postMessage(text: string, now: number, color = '#e8e8e8'): void {
    this.chat.push({ text, color, until: now + 6000 });
    if (this.chat.length > 6) this.chat.shift();
  }

  private questPhrase(kind: QuestKind, count: number): string {
    switch (kind) {
      case 'logs':
        return `gather ${count} logs`;
      case 'flax':
        return `pick ${count} flax`;
      case 'goblins':
        return `slay ${count} goblins`;
      case 'shrimp':
        return `catch ${count} shrimp`;
      case 'oakLogs':
        return `gather ${count} oak logs`;
      case 'hobgoblins':
        return `slay ${count} hobgoblins`;
    }
  }

  private postWelcome(now: number): void {
    this.postMessage('Welcome to Mudwick Online.', now, '#ffd23f');
    this.postMessage('Left-click to act. Right-click for options.', now);
    this.postMessage('Dinner fund target: 100 gp.', now, '#9be8e0');
    this.postMessage('Max stack + 99 all: legendary goals.', now, '#9be8e0');
    const q = this.sim.quest;
    this.postMessage(
      `Active contract: ${this.questPhrase(q.kind, q.target)} (${q.reward}gp bonus).`,
      now,
      '#9be8e0',
    );
  }

  /** Wander + chatter for the cosmetic players. */
  /** A bystander comments. They always comment. */
  private ghostReact(line: string, now: number): void {
    const g = this.ghosts[this.crowdRng.int(0, this.ghosts.length - 1)];
    if (!g) return;
    g.say = line;
    g.sayUntil = now + 2600;
    this.postMessage(`${g.name}: ${line}`, now, '#8fb8ff');
  }

  private scamWhispered = false;

  private updateGhosts(now: number): void {
    // One scam whisper per session, as tradition demands.
    if (!this.scamWhispered && now > 90_000) {
      this.scamWhispered = true;
      this.postMessage('big_dave_2 whispers: free armour trimming meet me at bridge', now, '#d88ae8');
    }
    for (const g of this.ghosts) {
      if (now >= g.nextMoveAt) {
        g.nextMoveAt = now + 900 + this.crowdRng.next() * 1500;
        if (this.crowdRng.chance(0.7)) {
          const dirs = [
            { x: 0, y: -1 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: 0 },
          ];
          const d = dirs[this.crowdRng.int(0, dirs.length - 1)];
          if (d) {
            const nx = g.pos.x + d.x;
            const ny = g.pos.y + d.y;
            // stay out of the goblin pen — they're cosmetic, not suicidal
            const inPen = nx >= 12 && nx <= 17 && ny >= 7 && ny <= 12;
            if (!inPen && this.sim.walkable(nx, ny)) g.pos = { x: nx, y: ny };
          }
        }
      }
      if (now >= g.nextSayAt) {
        g.nextSayAt = now + 16000 + this.crowdRng.next() * 24000;
        const line = GHOST_CHATTER[this.crowdRng.int(0, GHOST_CHATTER.length - 1)] ?? 'grats';
        g.say = line;
        g.sayUntil = now + 3400;
        this.postMessage(`${g.name}: ${line}`, now, '#8fb8ff');
      }
      if (g.say && now > g.sayUntil) g.say = null;
    }
  }

  private drawGhosts(now: number, dtMs: number): void {
    const ctx = this.ctx;
    for (const g of this.ghosts) {
      const d = this.displayed(g.id, g.pos, dtMs);
      const moving = Math.abs(d.x - g.pos.x * TILE) > 0.5 || Math.abs(d.y - g.pos.y * TILE) > 0.5;
      const bob = moving && Math.floor(now / 150 + g.pos.x) % 2 === 0 ? 1 : 0;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(Math.round(d.x) + 3, Math.round(d.y) + 14, 10, 2);
      drawSprite(ctx, g.sprite, Math.round(d.x) + 2, Math.round(d.y) + 1 - bob);
      if (g.say) {
        // classic yellow overhead text
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        const cx = Math.round(d.x) + 8;
        const cy = Math.round(d.y) - 3;
        ctx.fillStyle = '#241a06';
        ctx.fillText(g.say, cx + 1, cy + 1);
        ctx.fillStyle = '#ffe96b';
        ctx.fillText(g.say, cx, cy);
        ctx.textAlign = 'left';
      }
    }
  }

  addClickMarker(canvasX: number, canvasY: number, red: boolean, now: number): void {
    this.markers.push({ x: canvasX + this.camX, y: canvasY, until: now + 450, red });
  }

  openMenu(canvasX: number, canvasY: number, options: MenuOption[]): void {
    const w = Math.max(90, ...options.map((o) => o.label.length * 5 + 10));
    const h = 11 + options.length * 10;
    const x = Math.min(Math.max(0, canvasX - w / 2), CANVAS_W - w);
    const y = Math.min(canvasY, CANVAS_H - h);
    this.menu = { x, y, w, h, options, hover: -1 };
  }

  /** Close trade sheet and context menu (e.g. when standing up from the PC). */
  dismissOverlays(): void {
    this.menu = null;
    this.tradeOpen = false;
  }

  /** Index of the menu row under a canvas point, or -1. */
  menuIndexAt(cx: number, cy: number): number {
    const m = this.menu;
    if (!m) return -1;
    if (cx < m.x || cx > m.x + m.w) return -1;
    const i = Math.floor((cy - m.y - 10) / 10);
    return i >= 0 && i < m.options.length ? i : -1;
  }

  /** Convert canvas coords to a world tile, or null if over the panel/UI. */
  tileAt(cx: number, cy: number): Point | null {
    if (cx >= VIEW_W) return null;
    const x = Math.floor((cx + this.camX) / TILE);
    const y = Math.floor(cy / TILE);
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
    return { x, y };
  }

  /** Trade dialog button under a canvas point: 'log' | 'flax' | 'quest' | 'done' | null. */
  tradeButtonAt(cx: number, cy: number): TradeAction | null {
    if (!this.tradeOpen) return null;
    const L = this.tradeDialogLayout();
    if (cx < L.btnX || cx > L.btnX + L.btnW) return null;
    const hit = (by: number) => cy >= by && cy < by + L.btnH;
    if (L.questBtnY !== null && hit(L.questBtnY)) return { kind: 'quest' };
    for (const row of L.sellRows) {
      if (hit(row.y)) return { kind: 'sell', item: row.item };
    }
    if (hit(L.breadY)) return { kind: 'bread' };
    if (hit(L.doneY)) return { kind: 'done' };
    return null;
  }

  /** Away-plan toggle under the crosshair, if any (viewport overlay row). */
  awayPlanButtonAt(cx: number, cy: number): keyof AwayPlan | null {
    for (const chip of AWAY_PLAN_UI.chips) {
      if (
        cx >= chip.x && cx < chip.x + chip.w
        && cy >= chip.y && cy < chip.y + chip.h
      ) return chip.key;
    }
    return null;
  }

  /** Shared trade-dialog geometry so draw + hit tests stay aligned. */
  private tradeDialogLayout(): {
    x: number;
    y: number;
    w: number;
    h: number;
    btnX: number;
    btnW: number;
    btnH: number;
    questBtnY: number | null;
    questTextY: number;
    sellRows: { item: ItemKind; y: number; label: string; count: number }[];
    breadY: number;
    doneY: number;
  } {
    const x = 40;
    const y = 34;
    const w = 200;
    const btnX = x + 10;
    const btnW = w - 20;
    const btnH = 14;
    const rowStep = 17;

    let rowY = y + 32;
    const questReady = this.sim.questReady();
    const questBtnY = questReady ? rowY : null;
    const questTextY = rowY + 4;
    rowY += questReady ? rowStep : 12;

    // One sell row per sellable kind currently carried (logs always shown so
    // the dialog never looks empty), then bread, then done.
    const sellable: { item: ItemKind; label: (n: number) => string }[] = [
      { item: 'log', label: (n) => `Sell all logs (${n}) - ${ITEM_PRICES.log}gp each` },
      { item: 'oakLog', label: (n) => `Sell oak logs (${n}) - ${ITEM_PRICES.oakLog}gp each` },
      { item: 'flax', label: (n) => `Sell all flax (${n}) - ${ITEM_PRICES.flax}gp each` },
      { item: 'shrimpCooked', label: (n) => `Sell shrimp (${n}) - ${ITEM_PRICES.shrimpCooked}gp each` },
      { item: 'shrimpRaw', label: (n) => `Sell raw shrimp (${n}) - ${ITEM_PRICES.shrimpRaw}gp each` },
    ];
    const sellRows: { item: ItemKind; y: number; label: string; count: number }[] = [];
    for (const s of sellable) {
      const count = this.sim.invCount(s.item);
      if (count === 0 && s.item !== 'log' && s.item !== 'flax') continue;
      sellRows.push({ item: s.item, y: rowY, label: s.label(count), count });
      rowY += rowStep;
    }
    const breadY = rowY;
    rowY += rowStep;
    const doneY = rowY;
    const h = doneY + btnH + 8 - y;

    return { x, y, w, h, btnX, btnW, btnH, questBtnY, questTextY, sellRows, breadY, doneY };
  }

  render(now: number, dtMs: number): void {
    if (!this.welcomed) {
      this.welcomed = true;
      this.postWelcome(now);
    }
    const ctx = this.ctx;
    const sim = this.sim;

    const pd = this.displayed('player', sim.player.pos, dtMs);
    this.camX = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, pd.x - VIEW_W / 2 + TILE / 2));

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, CANVAS_H);
    ctx.clip();
    ctx.translate(-Math.round(this.camX), 0);

    this.drawTerrain();
    this.drawStatics(now);
    this.updateGhosts(now);
    this.drawGhosts(now, dtMs);
    this.drawGoblins(now, dtMs);

    const pMoving =
      Math.abs(pd.x - sim.player.pos.x * TILE) > 0.5 || Math.abs(pd.y - sim.player.pos.y * TILE) > 0.5;
    const pBob = pMoving && Math.floor(now / 140) % 2 === 0 ? 1 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(Math.round(pd.x) + 3, Math.round(pd.y) + 14, 10, 2);
    const swinging = now < this.swingUntil;
    const playerSprite = swinging ? PLAYER_ATTACK_SPRITES[this.swingDirection] : PLAYER_SPRITE;
    drawSprite(
      ctx,
      playerSprite,
      Math.round(pd.x) + (swinging ? 0 : 2),
      Math.round(pd.y) + 1 - pBob,
    );

    this.drawTreeTops(now);
    this.drawMarkers(now);
    this.drawParticles(now, dtMs);
    this.drawCoinPops(now);
    this.drawHitsplats(now);
    ctx.restore();

    if (this.vignette) ctx.drawImage(this.vignette, 0, 0);
    this.drawObjectiveBanner(now);
    this.drawAwayPlanChips();
    this.drawChat(now);
    this.drawDoubleXpBanner();
    this.drawXpDrops(now);
    this.drawHoverText();
    // A disconnect owns the world viewport; stale menus must not leak into the stats panel.
    if (this.sim.isLoggedOut) this.dismissOverlays();
    this.drawPanel();
    if (this.tradeOpen) this.drawTradeDialog();
    if (this.menu) this.drawMenu();
    this.drawLowHpPulse(now);
    if (this.sim.isLoggedOut) this.drawDisconnected(now);
  }

  /** The landline has won. Period-perfect despair. */
  private drawDisconnected(now: number): void {
    const ctx = this.ctx;
    const frame = disconnectFrame(now);
    const x = 22;
    const y = 58;
    const w = 196;
    const h = 122;

    ctx.save();
    ctx.fillStyle = 'rgba(6,10,26,0.78)';
    ctx.fillRect(0, 0, VIEW_W, CANVAS_H);

    // Windows-classic shell and hard bevels: familiar in 2004, never web-card soft.
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x + 3, y + 3, w, h);
    ctx.fillStyle = '#d4d0c8';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, w - 1, 1);
    ctx.fillRect(x, y, 1, h - 1);
    ctx.fillStyle = '#808080';
    ctx.fillRect(x + 1, y + h - 2, w - 2, 1);
    ctx.fillRect(x + w - 2, y + 1, 1, h - 2);
    ctx.fillStyle = '#404040';
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x + w - 1, y, 1, h);

    // Application title bar.
    ctx.fillStyle = '#0a246a';
    ctx.fillRect(25, 61, 190, 15);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Mudwick Online', 29, 71);

    // A broken phone-line glyph rather than a generic alert triangle.
    ctx.fillStyle = DISCONNECT_COLORS.failure;
    ctx.fillRect(35, 88, 18, 18);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(38, 95, 6, 3);
    ctx.fillRect(41, 92, 3, 3);
    ctx.fillRect(46, 98, 4, 3);
    ctx.fillRect(46, 95, 3, 3);
    ctx.fillRect(43, 96, 1, 1);
    ctx.fillRect(49, 101, 2, 2);

    ctx.fillStyle = '#000000';
    ctx.font = '8px monospace';
    ctx.fillText('Connection to server lost.', 62, 93);
    ctx.fillStyle = '#404040';
    ctx.font = '6px monospace';
    ctx.fillText('Your character is safely logged out.', 62, 105);
    ctx.fillStyle = '#000000';
    ctx.font = '7px monospace';
    ctx.fillText(frame.retryLabel, 62, 119);

    // Recessed activity meter. It loops rather than pretending to show elapsed time.
    ctx.fillStyle = '#808080';
    ctx.fillRect(62, 125, 140, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(63, 126, 138, 8);
    ctx.fillStyle = '#404040';
    ctx.fillRect(64, 127, 136, 6);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i < frame.activeSegments ? '#0a246a' : '#a8a8a0';
      ctx.fillRect(66 + i * 22, 128, 19, 4);
    }

    // The footer makes the cause part of this bedroom's story, not generic networking.
    ctx.fillStyle = '#808080';
    ctx.fillRect(31, 143, 178, 31);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(32, 144, 176, 29);
    ctx.fillStyle = DISCONNECT_COLORS.footer;
    ctx.fillRect(33, 145, 174, 27);
    ctx.fillStyle = '#404040';
    ctx.font = 'bold 6px monospace';
    ctx.fillText('PHONE LINE', 38, 154);
    ctx.fillStyle = DISCONNECT_COLORS.failure;
    ctx.fillText('BUSY', 183, 154);
    ctx.fillStyle = '#000000';
    ctx.font = '7px monospace';
    ctx.fillText('Someone is on the phone.', 38, 166);
    ctx.restore();
  }

  /** Standing orders row, top-right of the world view. */
  private drawAwayPlanChips(): void {
    const ctx = this.ctx;
    const { plate, caption, chips } = AWAY_PLAN_UI;
    const colors = AWAY_PLAN_COLORS;

    ctx.save();
    ctx.fillStyle = colors.plate;
    ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
    ctx.strokeStyle = colors.plateBorder;
    ctx.strokeRect(plate.x + 0.5, plate.y + 0.5, plate.w - 1, plate.h - 1);
    ctx.font = 'bold 6px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = colors.caption;
    ctx.fillText(caption, plate.x + 4, plate.y + 6);

    ctx.textAlign = 'center';
    for (const chip of chips) {
      const on = this.sim.awayPlan[chip.key];
      const hovered = this.mouse !== null
        && this.awayPlanButtonAt(this.mouse.x, this.mouse.y) === chip.key;
      ctx.fillStyle = on ? colors.onBg : colors.offBg;
      ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
      ctx.strokeStyle = hovered ? colors.hover : on ? colors.onBorder : colors.offBorder;
      ctx.strokeRect(chip.x + 0.5, chip.y + 0.5, chip.w - 1, chip.h - 1);
      ctx.fillStyle = hovered ? colors.hover : on ? colors.onText : colors.offText;
      ctx.fillText(chip.label, chip.x + chip.w / 2, chip.y + 7);
      if (on) {
        ctx.fillStyle = colors.stateBar;
        ctx.fillRect(chip.x + 3, chip.y + chip.h - 3, chip.w - 6, 2);
      }
    }
    ctx.restore();
  }

  private drawTerrain(): void {
    const ctx = this.ctx;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = tileChar(x, y);
        const px = x * TILE;
        const py = y * TILE;
        const inPen = x >= 13 && x <= 16 && y >= 8 && y <= 11;
        const h = hash2(x, y);
        if (inPen || ch === '+') {
          ctx.fillStyle = h > 0.5 ? '#8a7250' : '#82694a';
        } else {
          ctx.fillStyle = h > 0.66 ? '#4e7a33' : h > 0.33 ? '#48732f' : '#52803a';
        }
        ctx.fillRect(px, py, TILE, TILE);
        // dither speckle
        if (h > 0.8) {
          ctx.fillStyle = inPen ? '#76603f' : '#3f6829';
          ctx.fillRect(px + Math.floor(h * 13), py + Math.floor(hash2(y, x) * 13), 2, 2);
        }
        // flora on plain grass: tufts, tiny flowers, the odd pebble
        if (!inPen && ch === '.') {
          const d = hash2(x * 7 + 3, y * 5 + 1);
          const ox = px + 3 + Math.floor(hash2(x + 11, y) * 9);
          const oy = py + 3 + Math.floor(hash2(x, y + 11) * 9);
          if (d > 0.94) {
            ctx.fillStyle = hash2(y, x) > 0.5 ? '#e8d44f' : '#e8e0f0';
            ctx.fillRect(ox, oy, 2, 2);
            ctx.fillStyle = '#3c7a2e';
            ctx.fillRect(ox, oy + 2, 1, 2);
          } else if (d > 0.87) {
            ctx.fillStyle = '#3f6829';
            ctx.fillRect(ox, oy, 1, 3);
            ctx.fillRect(ox + 2, oy + 1, 1, 2);
            ctx.fillRect(ox - 2, oy + 1, 1, 2);
          } else if (d < 0.035) {
            ctx.fillStyle = '#8a8a82';
            ctx.fillRect(ox, oy, 2, 2);
            ctx.fillStyle = '#a8a89e';
            ctx.fillRect(ox, oy, 1, 1);
          }
        }
      }
    }
  }

  private drawStatics(now: number): void {
    const ctx = this.ctx;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = tileChar(x, y);
        const px = x * TILE;
        const py = y * TILE;
        switch (ch) {
          case '#': {
            // border woods
            ctx.fillStyle = '#243d18';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#2e4d20';
            ctx.fillRect(px + 2, py + 2, 5, 5);
            ctx.fillRect(px + 9, py + 8, 5, 5);
            break;
          }
          case 'F': {
            ctx.fillStyle = '#6b4a26';
            ctx.fillRect(px, py + 5, TILE, 3);
            ctx.fillRect(px, py + 11, TILE, 3);
            ctx.fillStyle = '#54381c';
            ctx.fillRect(px + 2, py + 3, 3, 12);
            ctx.fillRect(px + 11, py + 3, 3, 12);
            break;
          }
          case 'f': {
            ctx.fillStyle = '#3f6829';
            ctx.fillRect(px, py, TILE, TILE);
            for (let i = 0; i < 4; i++) {
              const fx = px + 2 + (i % 2) * 7 + Math.floor(hash2(x + i, y) * 3);
              const fy = py + 2 + Math.floor(i / 2) * 7 + Math.floor(hash2(y, x + i) * 3);
              ctx.fillStyle = '#3c7a2e';
              ctx.fillRect(fx + 1, fy + 2, 1, 4);
              ctx.fillStyle = '#7fa8e8';
              ctx.fillRect(fx, fy, 3, 3);
              ctx.fillStyle = '#cfe0ff';
              ctx.fillRect(fx + 1, fy + 1, 1, 1);
            }
            break;
          }
          case 'c': {
            // campfire
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(px + 2, py + 10, 12, 4);
            ctx.fillStyle = '#6b4a26';
            ctx.fillRect(px + 3, py + 9, 10, 3);
            const flick = Math.floor(now / 120) % 2 === 0;
            ctx.fillStyle = flick ? '#e8762a' : '#d8601f';
            ctx.fillRect(px + 5, py + 4, 6, 6);
            ctx.fillStyle = flick ? '#f5c542' : '#f0a832';
            ctx.fillRect(px + 6, py + 2 + (flick ? 0 : 1), 4, 5);
            // drifting smoke
            for (let i = 0; i < 3; i++) {
              const ph = (now / 1600 + i / 3) % 1;
              const sy = py + 1 - ph * 12;
              const sx = px + 7 + Math.round(Math.sin((ph * 3 + i) * 4) * 2);
              ctx.fillStyle = `rgba(200,198,190,${(0.4 * (1 - ph)).toFixed(2)})`;
              ctx.fillRect(sx, Math.round(sy), 2, 2);
            }
            break;
          }
          case 'b': {
            // bread table
            ctx.fillStyle = '#7a5a30';
            ctx.fillRect(px + 1, py + 5, 14, 8);
            ctx.fillStyle = '#5c421f';
            ctx.fillRect(px + 2, py + 13, 2, 3);
            ctx.fillRect(px + 12, py + 13, 2, 3);
            ctx.fillStyle = '#d8a85a';
            ctx.fillRect(px + 4, py + 6, 8, 4);
            ctx.fillStyle = '#eac98a';
            ctx.fillRect(px + 5, py + 7, 6, 1);
            break;
          }
          case 'Y': {
            // trader stall + Wyn (striped awning, like a proper market stall)
            ctx.fillStyle = '#8a5a2e';
            ctx.fillRect(px - 2, py + 11, 20, 5);
            for (let i = 0; i < 5; i++) {
              ctx.fillStyle = i % 2 === 0 ? '#a04444' : '#d8cfc0';
              ctx.fillRect(px - 2 + i * 4, py - 3, 4, 3);
            }
            ctx.fillStyle = '#c8c0a0';
            ctx.fillRect(px - 2, py - 1, 20, 1);
            drawSprite(this.ctx, TRADER_SPRITE, px + 2, py - 1);
            ctx.fillStyle = '#e8c33f';
            ctx.fillRect(px + 1, py + 12, 3, 2);
            ctx.fillRect(px + 11, py + 12, 3, 2);
            break;
          }
          case 's': {
            // wooden signpost
            ctx.fillStyle = '#6b4a26';
            ctx.fillRect(px + 7, py + 4, 2, 12);
            ctx.fillStyle = '#8a6a3c';
            ctx.fillRect(px + 2, py + 2, 12, 7);
            ctx.fillStyle = '#5c421f';
            ctx.fillRect(px + 3, py + 4, 10, 1);
            ctx.fillRect(px + 3, py + 6, 8, 1);
            break;
          }
          case 'l': {
            // toll sign: same joinery, one gold coin painted on
            ctx.fillStyle = '#6b4a26';
            ctx.fillRect(px + 7, py + 4, 2, 12);
            ctx.fillStyle = '#8a6a3c';
            ctx.fillRect(px + 2, py + 2, 12, 7);
            ctx.fillStyle = '#e8c33f';
            ctx.fillRect(px + 5, py + 4, 3, 3);
            ctx.fillStyle = '#5c421f';
            ctx.fillRect(px + 9, py + 5, 4, 1);
            break;
          }
          case 'w': {
            // the River Mud: banded blues with a slow shimmer
            const band = (Math.floor(now / 700) + y) % 2 === 0;
            ctx.fillStyle = band ? '#2c4a72' : '#274268';
            ctx.fillRect(px, py, TILE, TILE);
            const s = hash2(x * 3 + 1, y * 5 + 2);
            if (s > 0.6) {
              ctx.fillStyle = 'rgba(160,190,230,0.35)';
              ctx.fillRect(px + Math.floor(s * 11), py + 4 + ((Math.floor(now / 900) + x) % 2) * 6, 4, 1);
            }
            break;
          }
          case 'B': {
            // bridge: planks over the water
            ctx.fillStyle = '#274268';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#8a6a3c';
            ctx.fillRect(px, py + 1, TILE, 14);
            ctx.fillStyle = '#6b4a26';
            for (let i = 0; i < 4; i++) ctx.fillRect(px, py + 2 + i * 4, TILE, 1);
            ctx.fillStyle = '#54381c';
            ctx.fillRect(px, py, TILE, 2);
            ctx.fillRect(px, py + 14, TILE, 2);
            break;
          }
          case 'p': {
            // fishing spot: water plus a shrimp congregation
            const band = (Math.floor(now / 700) + y) % 2 === 0;
            ctx.fillStyle = band ? '#2c4a72' : '#274268';
            ctx.fillRect(px, py, TILE, TILE);
            const ph = Math.floor(now / 500) % 3;
            ctx.strokeStyle = 'rgba(200,220,250,0.6)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px + 8, py + 8, 2 + ph * 2, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#d88a8a';
            ctx.fillRect(px + 7 + (ph === 1 ? 1 : 0), py + 7, 2, 2);
            break;
          }
          default:
            break;
        }
      }
    }
    // choppable trees / stumps (trunks at ground level)
    for (const t of this.sim.trees) {
      const px = t.pos.x * TILE;
      const py = t.pos.y * TILE;
      if (t.chopped) {
        this.ctx.fillStyle = '#7a5a30';
        this.ctx.fillRect(px + 5, py + 7, 6, 6);
        this.ctx.fillStyle = '#caa86a';
        this.ctx.fillRect(px + 6, py + 8, 4, 4);
      } else {
        this.ctx.fillStyle = '#5c421f';
        this.ctx.fillRect(px + 6, py + 8, 4, 7);
      }
    }
  }

  /** Tree canopies drawn after actors so they overlap a little (depth flavour). */
  private drawTreeTops(now: number): void {
    const ctx = this.ctx;
    for (const t of this.sim.trees) {
      if (t.chopped) continue;
      const px = t.pos.x * TILE;
      const py = t.pos.y * TILE;
      // each tree sways on its own slow phase
      const phase = Math.sin(now / 900 + hash2(t.pos.x, t.pos.y) * 6.28);
      const sway = phase > 0.6 ? 1 : phase < -0.6 ? -1 : 0;
      const oak = t.kind === 'oak';
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(px + 1, py + 13, 14, 3);
      if (oak) {
        // oaks are broader, darker, and clearly worth fifteen gold
        ctx.fillStyle = '#234a16';
        ctx.fillRect(px - 3 + sway, py - 6, 22, 14);
        ctx.fillStyle = '#2e5c1e';
        ctx.fillRect(px - 1 + sway, py - 8, 18, 12);
        ctx.fillStyle = '#3c7a2e';
        ctx.fillRect(px + 2 + sway, py - 7, 10, 6);
        ctx.fillStyle = '#8a6a3c';
        ctx.fillRect(px + 6, py + 6, 4, 8);
      } else {
        ctx.fillStyle = '#2e5c1e';
        ctx.fillRect(px - 1 + sway, py - 4, 18, 12);
        ctx.fillStyle = '#3c7a2e';
        ctx.fillRect(px + 1 + sway, py - 6, 14, 10);
        ctx.fillStyle = '#4d9438';
        ctx.fillRect(px + 3 + sway, py - 5, 7, 5);
      }
    }
    // The gravestone waits exactly where it happened.
    const grave = this.sim.gravestone;
    if (grave) {
      const gx = grave.pos.x * TILE;
      const gy = grave.pos.y * TILE;
      const expiring = grave.expiresAtTick - this.sim.tick <= 15;
      if (!expiring || Math.floor(now / 300) % 2 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(gx + 3, gy + 13, 10, 2);
        ctx.fillStyle = '#9a9a94';
        ctx.fillRect(gx + 4, gy + 4, 8, 10);
        ctx.fillRect(gx + 5, gy + 2, 6, 3);
        ctx.fillStyle = '#7a7a74';
        ctx.fillRect(gx + 7, gy + 5, 2, 5);
        ctx.fillRect(gx + 5, gy + 7, 6, 2);
      }
    }
  }

  private drawParticles(now: number, dtMs: number): void {
    this.particles = this.particles.filter((p) => p.until > now);
    const ctx = this.ctx;
    for (const p of this.particles) {
      p.x += p.vx * dtMs;
      p.y += p.vy * dtMs;
      p.vy += 0.00035 * dtMs;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }
  }

  private drawCoinPops(now: number): void {
    this.coinPops = this.coinPops.filter((c) => c.until > now);
    const ctx = this.ctx;
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const c of this.coinPops) {
      const t = 1 - (c.until - now) / 900;
      const y = c.y - t * 10;
      ctx.fillStyle = '#241a06';
      ctx.fillText(c.text, c.x + 1, y + 1);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText(c.text, c.x, y);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  private drawGoblins(now: number, dtMs: number): void {
    for (const g of this.sim.goblins) {
      if (!g.alive) continue;
      const d = this.displayed(g.id, g.pos, dtMs);
      const moving = Math.abs(d.x - g.pos.x * TILE) > 0.5 || Math.abs(d.y - g.pos.y * TILE) > 0.5;
      const bob = moving && Math.floor(now / 150 + g.home.x) % 2 === 0 ? 1 : 0;
      const hob = g.tier === 'hobgoblin';
      this.ctx.fillStyle = 'rgba(0,0,0,0.18)';
      this.ctx.fillRect(Math.round(d.x) + 3, Math.round(d.y) + 14, 10, 2);
      const sprite = hob
        ? g.aggro ? HOB_ANGRY_SPRITE : HOB_SPRITE
        : g.aggro ? GOBLIN_ANGRY_SPRITE : GOBLIN_SPRITE;
      drawSprite(this.ctx, sprite, Math.round(d.x) + 2, Math.round(d.y) + (hob ? 1 : 2) - bob);
      const maxHp = hob ? 5 : 3;
      if (g.hp < maxHp) {
        // tiny hp bar
        this.ctx.fillStyle = '#900';
        this.ctx.fillRect(Math.round(d.x) + 2, Math.round(d.y) - 2, 12, 2);
        this.ctx.fillStyle = '#0c0';
        this.ctx.fillRect(Math.round(d.x) + 2, Math.round(d.y) - 2, Math.max(0, (g.hp / maxHp) * 12), 2);
      }
    }
  }

  private drawMarkers(now: number): void {
    this.markers = this.markers.filter((m) => m.until > now);
    for (const m of this.markers) {
      const ctx = this.ctx;
      ctx.strokeStyle = m.red ? '#e84a4a' : '#e8d44f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.x - 3, m.y - 3);
      ctx.lineTo(m.x + 3, m.y + 3);
      ctx.moveTo(m.x + 3, m.y - 3);
      ctx.lineTo(m.x - 3, m.y + 3);
      ctx.stroke();
    }
  }

  private drawHitsplats(now: number): void {
    const ctx = this.ctx;
    this.hitsplats = this.hitsplats.filter((h) => h.until > now);
    for (const h of this.hitsplats) {
      // proper star-shaped splat: red for damage, blue for a miss
      ctx.fillStyle = h.dmg === 0 ? '#2a4a9c' : '#b02020';
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 6.5 : 4;
        const px = h.x + Math.cos(a) * r;
        const py = h.y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(h.dmg), h.x, h.y + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  private drawObjectiveBanner(now: number): void {
    const ctx = this.ctx;
    const coins = this.sim.player.coins;
    const hit = this.sim.stats.objectiveHit;
    const bonus = this.sim.stats.statsBonusHit;
    const flashing = this.objectiveFlash > now && Math.floor(now / 200) % 2 === 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, CANVAS_H - 11, VIEW_W, 11);
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = flashing ? '#ffe96b' : hit && bonus ? '#8be86b' : '#ffd23f';
    const streak = this.sim.stats.killStreak;
    const streakTxt = streak > 1 ? ` · ${streak} streak` : '';
    const gp = objectiveProgressLabel(coins, hit);
    const stats = bonusProgressLabel(this.sim.player.skills, bonus);
    const label =
      hit && bonus
        ? `Max stack & 99 all! ${formatGpShort(coins)} gp${streakTxt}`
        : `${gp} · ${stats}${streakTxt}`;
    ctx.fillText(label, 3, CANVAS_H - 9);
  }

  /** Chat log: up to five lines stacked above the objective banner. */
  private drawChat(now: number): void {
    this.chat = this.chat.filter((c) => c.until > now);
    if (this.chat.length === 0) return;
    const ctx = this.ctx;
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    const bannerOffset = this.sim.xpMultiplier === 2 ? 12 : 0;
    for (let i = 0; i < this.chat.length; i++) {
      const line = this.chat[this.chat.length - 1 - i];
      if (!line) continue;
      const y = CANVAS_H - 24 - bannerOffset - i * 10;
      const fade = Math.min(1, (line.until - now) / 700);
      const w = ctx.measureText(line.text).width + 6;
      ctx.globalAlpha = fade;
      ctx.fillStyle = 'rgba(0,0,0,0.62)';
      ctx.fillRect(0, y, w, 10);
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, 3, y + 2);
      ctx.globalAlpha = 1;
    }
  }

  /** Friday's server event owns one permanent line in Mudwick's chat chrome. */
  private drawDoubleXpBanner(): void {
    if (this.sim.xpMultiplier !== 2) return;
    const ctx = this.ctx;
    const y = CANVAS_H - 24;

    ctx.fillStyle = DOUBLE_XP_COLORS.backdrop;
    ctx.fillRect(0, y, VIEW_W, 11);
    ctx.fillStyle = DOUBLE_XP_COLORS.gold;
    ctx.fillRect(0, y, VIEW_W, 1);

    ctx.fillStyle = DOUBLE_XP_COLORS.ember;
    ctx.fillRect(3, y + 2, 17, 7);
    ctx.fillStyle = DOUBLE_XP_COLORS.parchment;
    ctx.fillRect(4, y + 3, 15, 5);
    ctx.fillStyle = DOUBLE_XP_COLORS.backdrop;
    ctx.font = 'bold 6px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText(DOUBLE_XP_COPY.badge, 7, y + 2);

    ctx.fillStyle = DOUBLE_XP_COLORS.gold;
    ctx.font = 'bold 7px monospace';
    ctx.fillText(DOUBLE_XP_COPY.label, 25, y + 3);
    ctx.fillStyle = DOUBLE_XP_COLORS.moss;
    ctx.fillRect(73, y + 2, 1, 7);
    ctx.fillStyle = DOUBLE_XP_COLORS.parchment;
    ctx.font = '6px monospace';
    ctx.fillText(DOUBLE_XP_COPY.detail, 79, y + 4);
  }

  /** XP drops rise from the top-right corner of the world viewport. */
  private drawXpDrops(now: number): void {
    this.xpDrops = this.xpDrops.filter((d) => d.until > now);
    if (this.xpDrops.length === 0) return;
    const ctx = this.ctx;
    ctx.font = '7px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    for (let i = 0; i < this.xpDrops.length; i++) {
      const d = this.xpDrops[i];
      if (!d) continue;
      const t = 1 - (d.until - now) / 1300;
      const stripClearY = AWAY_PLAN_UI.plate.y + AWAY_PLAN_UI.plate.h + 1;
      const y = stripClearY + (1 - t) * 8 + i * 9;
      ctx.globalAlpha = Math.min(1, (d.until - now) / 400);
      ctx.fillStyle = '#241a06';
      ctx.fillText(d.text, VIEW_W - 5, y + 1);
      ctx.fillStyle = '#e8e0f0';
      ctx.fillText(d.text, VIEW_W - 6, y);
      ctx.globalAlpha = 1;
    }
    ctx.textAlign = 'left';
  }

  /** "Attack Goblin" → ['Attack', 'Goblin'] — verb plain, target colored. */
  private static splitLabel(label: string): [string, string | null] {
    if (label === 'Walk here' || label === 'Cancel') return [label, null];
    const i = label.indexOf(' ');
    if (i < 0) return [label, null];
    return [label.slice(0, i), label.slice(i + 1)];
  }

  private drawHoverText(): void {
    if (this.menu || this.tradeOpen) return;
    const m = this.mouse;
    if (!m) return;
    const tile = this.tileAt(m.x, m.y);
    if (!tile) return;
    const opts = this.sim.optionsAt(tile.x, tile.y);
    const first = opts[0];
    if (!first) return;
    const extra = opts.length - 1;
    const [verb, target] = MmoRenderer.splitLabel(first.label);
    const suffix = extra > 0 ? ` / ${extra} more` : '';
    const ctx = this.ctx;
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    const verbW = ctx.measureText(`${verb} `).width;
    const targetW = target ? ctx.measureText(`${target}`).width : 0;
    const w = verbW + targetW + ctx.measureText(suffix).width + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, 11);
    ctx.fillStyle = '#e8e2d4';
    ctx.fillText(`${verb} `, 3, 2);
    if (target) {
      ctx.fillStyle = '#9be8e0';
      ctx.fillText(target, 3 + verbW, 2);
    }
    if (suffix) {
      ctx.fillStyle = '#a8a094';
      ctx.fillText(suffix, 3 + verbW + targetW, 2);
    }
  }

  private drawMinimap(): void {
    const ctx = this.ctx;
    const x0 = VIEW_W;
    const my = 4;
    const mw = 68;
    const mh = 38;
    const mx = x0 + Math.floor((PANEL_W - mw) / 2);
    const scaleX = mw / MAP_W;
    const scaleY = mh / MAP_H;
    ctx.fillStyle = '#3a2c18';
    ctx.fillRect(mx, my, mw, mh);
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = tileChar(x, y);
        const px = mx + x * scaleX;
        const py = my + y * scaleY;
        const inPen = x >= 13 && x <= 16 && y >= 8 && y <= 11;
        if (ch === '#') ctx.fillStyle = '#243d18';
        else if (ch === 'w' || ch === 'p') ctx.fillStyle = '#2c4a72';
        else if (ch === 'B') ctx.fillStyle = '#8a6a3c';
        else if (inPen || ch === '+') ctx.fillStyle = '#8a7250';
        else ctx.fillStyle = '#48732f';
        ctx.fillRect(px, py, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }
    const dot = (tx: number, ty: number, color: string, size = 2): void => {
      ctx.fillStyle = color;
      ctx.fillRect(mx + tx * scaleX + 1, my + ty * scaleY + 1, size, size);
    };
    // choppable trees (bright green — they matter for the grind)
    for (const t of this.sim.trees) {
      if (!t.chopped) dot(t.pos.x, t.pos.y, '#6ecf4a', 2);
    }
    // points of interest
    dot(CAMPFIRE_TILE.x, CAMPFIRE_TILE.y, '#e8762a', 2);
    dot(TRADER_TILE.x, TRADER_TILE.y, '#c060c0', 3);
    // other players (cosmetic ghosts)
    for (const g of this.ghosts) dot(g.pos.x, g.pos.y, '#8fb8ff', 2);
    // goblins (alive only — the real threat)
    for (const g of this.sim.goblins) {
      if (g.alive) dot(g.pos.x, g.pos.y, g.aggro ? '#ff6040' : '#5f8f3e', 2);
    }
    // player on top — larger yellow blip with a dark outline
    const p = this.sim.player.pos;
    const px = mx + p.x * scaleX;
    const py = my + p.y * scaleY;
    ctx.fillStyle = '#3a2c18';
    ctx.fillRect(px, py, 4, 4);
    ctx.fillStyle = '#ffe96b';
    ctx.fillRect(px + 1, py + 1, 2, 2);
    ctx.strokeStyle = '#3a2c18';
    ctx.strokeRect(mx - 0.5, my - 0.5, mw + 1, mh + 1);
  }

  private drawSkillBar(x: number, y: number, label: string, xp: number, w: number): void {
    const ctx = this.ctx;
    const lvl = levelOf(xp);
    let pct = 1;
    if (lvl < MAX_LEVEL) {
      const cur = xp - xpForLevel(lvl);
      const need = Math.max(1, xpForLevel(lvl + 1) - xpForLevel(lvl));
      pct = cur / need;
    }
    ctx.fillStyle = '#5a4a30';
    ctx.fillText(`${label} ${lvl}`, x, y);
    ctx.fillStyle = '#8a754f';
    ctx.fillRect(x, y + 7, w, 3);
    ctx.fillStyle = '#c8a040';
    ctx.fillRect(x, y + 7, Math.floor(w * pct), 3);
  }

  private drawPanel(): void {
    const ctx = this.ctx;
    const x0 = VIEW_W;
    ctx.fillStyle = '#5c4a32';
    ctx.fillRect(x0, 0, PANEL_W, CANVAS_H);
    ctx.fillStyle = '#c8b088';
    ctx.fillRect(x0 + 2, 2, PANEL_W - 4, CANVAS_H - 4);

    // fixed layout — every band owns its pixels, nothing overlaps
    const PL = {
      coinCy: 52,
      hpR1: 63,
      hpR2: 75,
      invY: 86,
      slot: 13,
      skillDiv: 178,
      wcY: 181,
      atkY: 193,
      frgY: 205,
      fshY: 217,
      questY: 230,
    } as const;

    const invCols = 4;
    const invGridW = (invCols - 1) * PL.slot + (PL.slot - 2);
    const invX = x0 + Math.floor((PANEL_W - invGridW) / 2);
    const hpPitch = 13;
    const hpSpan = 4 * hpPitch;
    const hpX = x0 + Math.floor((PANEL_W - hpSpan) / 2);
    const skillBarW = 58;
    const skillX = x0 + Math.floor((PANEL_W - skillBarW) / 2);

    this.drawMinimap();

    // dividers frame the status cluster (coin + HP)
    ctx.fillStyle = '#8a754f';
    ctx.fillRect(x0 + 8, 44, PANEL_W - 16, 1);
    ctx.fillRect(x0 + 8, 82, PANEL_W - 16, 1);

    // coin — icon + amount, centred as a pair
    ctx.font = '8px monospace';
    const coinStr = formatGpShort(this.sim.player.coins);
    const coinGroupW = 9 + ctx.measureText(coinStr).width;
    const coinIconX = x0 + Math.floor((PANEL_W - coinGroupW) / 2) + 5;
    ctx.fillStyle = '#e8c33f';
    ctx.beginPath();
    ctx.arc(coinIconX, PL.coinCy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8932a';
    ctx.beginPath();
    ctx.arc(coinIconX, PL.coinCy, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4c8';
    ctx.fillRect(coinIconX - 3, PL.coinCy - 3, 2, 1);
    ctx.fillStyle = '#3a2c18';
    ctx.textBaseline = 'middle';
    ctx.fillText(coinStr, coinIconX + 9, PL.coinCy);
    ctx.textBaseline = 'alphabetic';

    // HP — two rows of five, centred
    const hp = this.sim.player.hp;
    for (let i = 0; i < PLAYER_MAX_HP; i++) {
      const ox = hpX + (i % 5) * hpPitch;
      const oy = i < 5 ? PL.hpR1 : PL.hpR2;
      drawSprite(ctx, i < hp ? HP_FULL_SPRITE : HP_EMPTY_SPRITE, ox - 3, oy - 3);
    }

    // inventory 4×7
    const inv = this.sim.player.inventory;
    const { slot } = PL;
    const gx = invX;
    const gy = PL.invY;
    ctx.font = '6px monospace';
    for (let i = 0; i < 28; i++) {
      const sx = gx + (i % 4) * slot;
      const sy = gy + Math.floor(i / 4) * slot;
      ctx.fillStyle = '#b09a74';
      ctx.fillRect(sx, sy, slot - 2, slot - 2);
      ctx.strokeStyle = '#8a754f';
      ctx.strokeRect(sx + 0.5, sy + 0.5, slot - 3, slot - 3);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(sx + 1, sy + 1, slot - 4, 1);
      const item = inv[i];
      if (item !== undefined) this.drawItemGlyph(item, sx, sy);
    }
    // one stack count per distinct kind, drawn at its first occurrence
    const counted = new Set<ItemKind>();
    for (let i = 0; i < inv.length; i++) {
      const kind = inv[i];
      if (kind === undefined || counted.has(kind)) continue;
      counted.add(kind);
      const count = inv.filter((k) => k === kind).length;
      if (count <= 1) continue;
      const fx = gx + (i % 4) * slot;
      const fy = gy + Math.floor(i / 4) * slot;
      ctx.fillStyle = '#ffe96b';
      ctx.fillText(String(count), fx + slot - 8, fy + 9);
    }

    // skills (user said these are perfect — keep spacing)
    const skills = this.sim.player.skills;
    ctx.font = '6px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#8a754f';
    ctx.fillRect(x0 + 8, PL.skillDiv, PANEL_W - 16, 1);
    this.drawSkillBar(skillX, PL.wcY, 'Wc', skills.woodcutting, skillBarW);
    this.drawSkillBar(skillX, PL.atkY, 'Atk', skills.attack, skillBarW);
    this.drawSkillBar(skillX, PL.frgY, 'Frg', skills.foraging, skillBarW);
    this.drawSkillBar(skillX, PL.fshY, 'Fsh', skills.fishing, skillBarW);

    const q = this.sim.quest;
    ctx.fillStyle = q.progress >= q.target && !q.claimed ? '#8be86b' : '#5a4a30';
    const qLabel = this.sim.questLabel();
    const qText = qLabel.length > 20 ? `${qLabel.slice(0, 19)}…` : qLabel;
    ctx.textAlign = 'center';
    ctx.fillText(qText, x0 + PANEL_W / 2, PL.questY);
    ctx.textAlign = 'left';
  }

  /** 9x9-ish pixel icons per item kind, drawn inside an inventory slot. */
  private drawItemGlyph(item: ItemKind, sx: number, sy: number): void {
    const ctx = this.ctx;
    switch (item) {
      case 'log':
        ctx.fillStyle = '#7a5a30';
        ctx.fillRect(sx + 1, sy + 4, 8, 4);
        ctx.fillStyle = '#caa86a';
        ctx.fillRect(sx + 1, sy + 5, 8, 1);
        break;
      case 'oakLog':
        ctx.fillStyle = '#5c421f';
        ctx.fillRect(sx + 1, sy + 3, 9, 5);
        ctx.fillStyle = '#8a6a3c';
        ctx.fillRect(sx + 1, sy + 5, 9, 1);
        break;
      case 'flax':
        ctx.fillStyle = '#3c7a2e';
        ctx.fillRect(sx + 4, sy + 5, 2, 4);
        ctx.fillStyle = '#7fa8e8';
        ctx.fillRect(sx + 3, sy + 2, 5, 4);
        break;
      case 'shrimpRaw':
        ctx.fillStyle = '#d88a8a';
        ctx.fillRect(sx + 2, sy + 4, 6, 3);
        ctx.fillRect(sx + 7, sy + 3, 2, 2);
        break;
      case 'shrimpCooked':
        ctx.fillStyle = '#e8762a';
        ctx.fillRect(sx + 2, sy + 4, 6, 3);
        ctx.fillRect(sx + 7, sy + 3, 2, 2);
        break;
      case 'shrimpBurnt':
        ctx.fillStyle = '#3a3630';
        ctx.fillRect(sx + 2, sy + 4, 6, 3);
        ctx.fillRect(sx + 7, sy + 3, 2, 2);
        break;
      case 'bread':
        ctx.fillStyle = '#d8a860';
        ctx.fillRect(sx + 2, sy + 3, 7, 5);
        ctx.fillStyle = '#f0d0a0';
        ctx.fillRect(sx + 3, sy + 4, 5, 1);
        break;
    }
  }

  private drawTradeDialog(): void {
    const ctx = this.ctx;
    const L = this.tradeDialogLayout();
    const { x, y, w, h, btnX, btnW, btnH } = L;
    ctx.fillStyle = '#5c4a32';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c8b088';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#3a2c18';
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('Trader Wyn', x + 8, y + 8);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#5a4a30';
    ctx.fillText('"Coins talk. Logs walk."', x + 8, y + 20);

    const button = (by: number, label: string, enabled: boolean, highlight = false): void => {
      ctx.fillStyle = highlight ? '#a89060' : enabled ? '#8a754f' : '#a89878';
      ctx.fillRect(btnX, by, btnW, btnH);
      ctx.fillStyle = enabled ? '#ffe9b0' : '#cabfa6';
      ctx.fillText(label, btnX + 6, by + 3);
    };

    if (L.questBtnY !== null) {
      button(L.questBtnY, `Turn in contract (+${this.sim.quest.reward}gp)`, true, true);
    } else {
      ctx.fillStyle = '#7a6444';
      ctx.fillText(this.sim.questLabel(), x + 12, L.questTextY);
    }
    for (const row of L.sellRows) {
      button(row.y, row.label, row.count > 0);
    }
    button(L.breadY, `Buy bread (${BREAD_PRICE}gp) - heals 4`, this.sim.player.coins >= BREAD_PRICE);
    button(L.doneY, 'Done', true);
  }

  private drawMenu(): void {
    const m = this.menu;
    if (!m) return;
    const ctx = this.ctx;
    ctx.fillStyle = '#5c5040';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(m.x + 1, m.y + 1, m.w - 2, 9);
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#c8b088';
    ctx.fillText('Choose Option', m.x + 3, m.y + 2);
    ctx.fillStyle = '#c8b088';
    ctx.fillRect(m.x + 1, m.y + 10, m.w - 2, m.h - 11);
    m.options.forEach((opt, i) => {
      const oy = m.y + 11 + i * 10;
      if (i === m.hover) {
        ctx.fillStyle = '#a89060';
        ctx.fillRect(m.x + 1, oy - 1, m.w - 2, 10);
      }
      const [verb, target] = MmoRenderer.splitLabel(opt.label);
      ctx.fillStyle = '#2a2018';
      ctx.fillText(`${verb} `, m.x + 4, oy);
      if (target) {
        ctx.fillStyle = '#155c74';
        ctx.fillText(target, m.x + 4 + ctx.measureText(`${verb} `).width, oy);
      }
    });
  }

  private drawLowHpPulse(now: number): void {
    const hp = this.sim.player.hp;
    if (hp > 3) return;
    const a = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(now / 180));
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(200,20,20,${a.toFixed(3)})`;
    for (let i = 0; i < 6; i++) {
      ctx.lineWidth = 1;
      ctx.globalAlpha = a * (1 - i / 6);
      ctx.strokeStyle = '#c01414';
      ctx.strokeRect(i + 0.5, i + 0.5, CANVAS_W - 1 - i * 2, CANVAS_H - 1 - i * 2);
    }
    ctx.globalAlpha = 1;
  }
}
