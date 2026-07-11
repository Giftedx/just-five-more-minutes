import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_ROWS, MAP_W, SPAWN_TILE, TREE_TILES, GOBLIN_SPAWNS } from './map';
import { bfsPath } from './path';
import {
  COIN_OBJECTIVE,
  FLAX_PRICE,
  GOBLIN_RESPAWN_TICKS,
  INVENTORY_SIZE,
  LOG_PRICE,
  MAX_COINS,
  MudwickSim,
  PLAYER_MAX_HP,
  TREE_REGROW_TICKS,
} from './sim';
import type { SimEvent } from './types';

function stepUntil(
  sim: MudwickSim,
  pred: (events: SimEvent[]) => boolean,
  maxTicks = 500,
  opts: { playerAway?: boolean } = {},
): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxTicks; i++) {
    sim.step(opts);
    const ev = sim.drainEvents();
    all.push(...ev);
    if (pred(ev)) return all;
  }
  throw new Error(`predicate not satisfied within ${maxTicks} ticks`);
}

describe('map integrity', () => {
  it('matches its declared dimensions with consistent row lengths', () => {
    expect(MAP_ROWS).toHaveLength(MAP_H);
    for (const row of MAP_ROWS) expect(row).toHaveLength(MAP_W);
  });

  it('has exactly 4 choppable trees and 3 goblin spawns on the west side', () => {
    expect(TREE_TILES).toHaveLength(4);
    expect(GOBLIN_SPAWNS).toHaveLength(3);
  });
});

describe('movement', () => {
  it('walks one tile per tick along a BFS path', () => {
    const sim = new MudwickSim(1);
    const start = { ...sim.player.pos };
    sim.commandWalk({ x: start.x + 3, y: start.y });
    sim.step();
    expect(sim.player.pos).toEqual({ x: start.x + 1, y: start.y });
    sim.step();
    sim.step();
    expect(sim.player.pos).toEqual({ x: start.x + 3, y: start.y });
  });

  it('refuses to path into blocked tiles', () => {
    const sim = new MudwickSim(1);
    const before = { ...sim.player.pos };
    sim.commandWalk({ x: 0, y: 0 }); // border tree
    sim.step();
    expect(sim.player.pos).toEqual(before);
  });

  it('BFS finds a route into the goblin pen through the gateway', () => {
    const sim = new MudwickSim(1);
    const path = bfsPath(SPAWN_TILE, { x: 14, y: 9 }, sim.walkable);
    expect(path).not.toBeNull();
    expect(path).toContainEqual({ x: 12, y: 10 }); // the gap
  });
});

describe('combat', () => {
  function engage(sim: MudwickSim): void {
    const goblin = sim.goblins[0];
    if (!goblin) throw new Error('no goblin');
    const opt = sim.optionsAt(goblin.pos.x, goblin.pos.y)[0];
    if (!opt || !opt.label.startsWith('Attack')) throw new Error('expected attack option');
    sim.invoke(opt);
  }

  it('kills a goblin, pays out 4-9 coins, and tracks the kill', () => {
    const sim = new MudwickSim(7);
    engage(sim);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'goblinDied'));
    const death = events.find((e) => e.type === 'goblinDied');
    expect(death).toBeDefined();
    if (death?.type === 'goblinDied') {
      expect(death.coins).toBeGreaterThanOrEqual(4);
      expect(death.coins).toBeLessThanOrEqual(9);
      expect(sim.player.coins).toBe(death.coins);
    }
    expect(sim.stats.kills).toBe(1);
  });

  it('alternates swings: never two player swings without a goblin turn between', () => {
    const sim = new MudwickSim(3);
    engage(sim);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'goblinDied'));
    const swings = events.filter((e) => e.type === 'playerSwing' || e.type === 'goblinSwing');
    for (let i = 1; i < swings.length; i++) {
      expect(swings[i]?.type).not.toBe(swings[i - 1]?.type);
    }
  });

  it('goblin keeps swinging at an idle player and eventually kills them', () => {
    const sim = new MudwickSim(11);
    engage(sim);
    // Walk in, then go idle: clear intent as soon as we are adjacent by
    // letting combat start, then cancelling our own swings.
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'playerSwing' || e.type === 'goblinSwing'));
    sim.player.intent = null; // player wandered off to think about chores
    const events = stepUntil(
      sim,
      (ev) => ev.some((e) => e.type === 'playerDied'),
      2000,
      { playerAway: true },
    );
    expect(events.some((e) => e.type === 'playerSwing')).toBe(false);
    expect(sim.stats.deaths).toBe(1);
    expect(sim.stats.deathsWhileAway).toBe(1);
  });

  it('death loses 25% of carried coins (floored) and respawns at the campfire', () => {
    const sim = new MudwickSim(11);
    sim.player.coins = 103;
    sim.player.hp = 1;
    const goblin = sim.goblins[0];
    if (!goblin) throw new Error('no goblin');
    goblin.aggro = true;
    goblin.nextAttacker = 'goblin';
    goblin.pos = { x: sim.player.pos.x + 1, y: sim.player.pos.y };
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'playerDied'), 50);
    const death = events.find((e) => e.type === 'playerDied');
    expect(death).toBeDefined();
    if (death?.type === 'playerDied') expect(death.coinsLost).toBe(Math.floor(103 * 0.25));
    expect(sim.player.coins).toBe(103 - 25);
    expect(sim.player.hp).toBe(PLAYER_MAX_HP);
    expect(sim.player.pos).toEqual(SPAWN_TILE);
  });

  it('a de-aggroed goblin walks back toward its home tile', () => {
    const sim = new MudwickSim(7);
    const goblin = sim.goblins[0];
    if (!goblin) throw new Error('no goblin');
    goblin.pos = { x: 6, y: 6 }; // stranded mid-map, far outside the pen
    expect(goblin.aggro).toBe(false);
    for (let i = 0; i < 40; i++) sim.step();
    expect(Math.max(Math.abs(goblin.pos.x - goblin.home.x), Math.abs(goblin.pos.y - goblin.home.y))).toBeLessThanOrEqual(2);
  });

  it('dead goblins respawn at home after the respawn delay', () => {
    const sim = new MudwickSim(7);
    engage(sim);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'goblinDied'));
    const dead = sim.goblins.find((g) => !g.alive);
    expect(dead).toBeDefined();
    if (!dead) return;
    const deathTick = sim.tick;
    for (let i = 0; i < GOBLIN_RESPAWN_TICKS + 1; i++) sim.step();
    expect(sim.tick).toBeGreaterThanOrEqual(deathTick + GOBLIN_RESPAWN_TICKS);
    expect(dead.alive).toBe(true);
    expect(dead.hp).toBe(3);
    expect(dead.pos).toEqual(dead.home);
  });
});

describe('woodcutting and flax', () => {
  it('chops a tree, gets a log, and the tree regrows later', () => {
    const sim = new MudwickSim(5);
    const tree = sim.trees[0];
    if (!tree) throw new Error('no tree');
    const opt = sim.optionsAt(tree.pos.x, tree.pos.y)[0];
    if (!opt) throw new Error('no option');
    expect(opt.label).toBe('Chop Tree');
    sim.invoke(opt);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'log'));
    expect(sim.invCount('log')).toBe(1);
    expect(tree.chopped).toBe(true);
    for (let i = 0; i < TREE_REGROW_TICKS + 1; i++) sim.step();
    expect(tree.chopped).toBe(false);
  });

  it('picks exactly one flax per click', () => {
    const sim = new MudwickSim(5);
    const opt = sim.optionsAt(3, 9)[0];
    if (!opt) throw new Error('no option');
    expect(opt.label).toBe('Pick Flax');
    sim.invoke(opt);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'flax'));
    expect(sim.invCount('flax')).toBe(1);
    // No further picks without another click.
    for (let i = 0; i < 5; i++) sim.step();
    expect(sim.invCount('flax')).toBe(1);
  });

  it('rejects picks when the inventory is full', () => {
    const sim = new MudwickSim(5);
    sim.player.inventory = Array.from({ length: INVENTORY_SIZE }, () => 'flax' as const);
    const opt = sim.optionsAt(3, 9)[0];
    if (!opt) throw new Error('no option');
    sim.invoke(opt);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'invFull'));
    expect(events.some((e) => e.type === 'flax')).toBe(false);
    expect(sim.player.inventory).toHaveLength(INVENTORY_SIZE);
  });
});

describe('trading and economy', () => {
  it('sells logs at 7gp and flax at 2gp', () => {
    const sim = new MudwickSim(5);
    sim.player.inventory = ['log', 'log', 'flax', 'flax', 'flax'];
    const logs = sim.sell('log');
    expect(logs).toEqual({ sold: 2, gained: 2 * LOG_PRICE });
    const flax = sim.sell('flax');
    expect(flax).toEqual({ sold: 3, gained: 3 * FLAX_PRICE });
    expect(sim.player.coins).toBe(2 * LOG_PRICE + 3 * FLAX_PRICE);
    expect(sim.player.inventory).toHaveLength(0);
    expect(sim.stats.logsSold).toBe(2);
    expect(sim.stats.flaxSold).toBe(3);
  });

  it('walking to the trader opens the trade dialog', () => {
    const sim = new MudwickSim(5);
    const opt = sim.optionsAt(2, 3)[0];
    if (!opt) throw new Error('no option');
    expect(opt.label).toBe('Trade Trader Wyn');
    sim.invoke(opt);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'openTrade'));
  });

  it('counts each claimed Wyn contract exactly once', () => {
    const sim = new MudwickSim(7);
    sim.quest = { kind: 'logs', target: 1, progress: 1, reward: 22, claimed: false };
    expect(sim.turnInQuest()).toBe(true);
    expect(sim.stats.contractsCompleted).toBe(1);
    expect(sim.turnInQuest()).toBe(false);
    expect(sim.stats.contractsCompleted).toBe(1);
  });

  it('latches the coin objective exactly once at max stack', () => {
    const sim = new MudwickSim(5);
    sim.player.coins = MAX_COINS - 3;
    sim.player.inventory = ['log'];
    sim.sell('log'); // +7, capped at MAX_COINS
    expect(sim.player.coins).toBe(MAX_COINS);
    expect(sim.stats.objectiveHit).toBe(true);
    expect(sim.drainEvents().filter((e) => e.type === 'objectiveHit')).toHaveLength(1);
    sim.player.inventory = ['log'];
    sim.sell('log');
    expect(sim.player.coins).toBe(MAX_COINS);
    expect(sim.drainEvents().filter((e) => e.type === 'objectiveHit')).toHaveLength(0);
    expect(COIN_OBJECTIVE).toBe(MAX_COINS);
  });

  it('does not exceed OSRS max coin stack', () => {
    const sim = new MudwickSim(5);
    sim.player.coins = MAX_COINS - 1;
    sim.player.inventory = ['log', 'log'];
    sim.sell('log');
    expect(sim.player.coins).toBe(MAX_COINS);
  });
});

describe('bread', () => {
  it('heals 4 HP capped at max', () => {
    const sim = new MudwickSim(5);
    sim.player.hp = 3;
    const opt = sim.optionsAt(3, 13)[0];
    if (!opt) throw new Error('no option');
    expect(opt.label).toBe('Eat Bread');
    sim.invoke(opt);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'eat'));
    expect(sim.player.hp).toBe(7);
    sim.invoke(opt);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'eat'));
    expect(sim.player.hp).toBe(PLAYER_MAX_HP);
  });
});

describe('context menus', () => {
  it('every menu ends with Examine + Cancel and has deadpan examine text', () => {
    const sim = new MudwickSim(5);
    const goblin = sim.goblins[0];
    if (!goblin) throw new Error('no goblin');
    const opts = sim.optionsAt(goblin.pos.x, goblin.pos.y);
    const labels = opts.map((o) => o.label);
    expect(labels[0]).toBe('Attack Goblin');
    expect(labels).toContain('Examine Goblin');
    expect(labels[labels.length - 1]).toBe('Cancel');
    const examine = opts.find((o) => o.act.kind === 'examine');
    if (examine?.act.kind === 'examine') {
      expect(examine.act.text).toBe('It has a five-year plan. And poor impulse control.');
    }
  });

  it('tree examine text exists, and stumps lose the Chop option', () => {
    const sim = new MudwickSim(5);
    const tree = sim.trees[0];
    if (!tree) throw new Error('no tree');
    const grown = sim.optionsAt(tree.pos.x, tree.pos.y);
    expect(grown.some((o) => o.label === 'Chop Tree')).toBe(true);
    const ex = grown.find((o) => o.act.kind === 'examine');
    if (ex?.act.kind === 'examine') expect(ex.act.text).toBe('Contains wood, allegedly. The economy runs on allegedly.');
    tree.chopped = true;
    const stump = sim.optionsAt(tree.pos.x, tree.pos.y);
    expect(stump.some((o) => o.label === 'Chop Tree')).toBe(false);
    expect(stump.some((o) => o.label === 'Examine Stump')).toBe(true);
  });

  it('ground default action is Walk here', () => {
    const sim = new MudwickSim(5);
    const opt = sim.defaultOptionAt(6, 12);
    expect(opt?.label).toBe('Walk here');
  });
});
