import { describe, expect, it } from 'vitest';
import {
  BRIDGE_TILE,
  CAMPFIRE_TILE,
  FISHING_TILE,
  HOBGOBLIN_SPAWNS,
  OAK_TILES,
  SPAWN_TILE,
  TRADER_TILE,
} from './map';
import { bfsPath } from './path';
import {
  DEFAULT_AWAY_PLAN,
  GRAVESTONE_TICKS,
  HOBGOBLIN_DROP_MAX,
  HOBGOBLIN_DROP_MIN,
  HOBGOBLIN_MAX_HP,
  INVENTORY_SIZE,
  LOG_PRICE,
  MudwickSim,
  OAK_PRICE,
  xpForLevel,
  type SimCharacter,
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

function makeCharacter(patch: Partial<SimCharacter> = {}): SimCharacter {
  return {
    coins: 0,
    xp: { woodcutting: 0, attack: 0, foraging: 0, fishing: 0 },
    bridgePass: false,
    ...patch,
  };
}

/** Drain pending events and flatten types for quick contains-checks. */
function drainTypes(sim: MudwickSim): string[] {
  return sim.drainEvents().map((e) => e.type);
}

describe('zone 2 map', () => {
  it('adds 3 oaks and 2 hobgoblin spawns across the river', () => {
    expect(OAK_TILES).toHaveLength(3);
    expect(HOBGOBLIN_SPAWNS).toHaveLength(2);
    for (const p of [...OAK_TILES, ...HOBGOBLIN_SPAWNS]) {
      expect(p.x).toBeGreaterThan(BRIDGE_TILE.x);
    }
  });
});

describe('the bridge and its toll', () => {
  it('blocks pathing east without a pass', () => {
    const sim = new MudwickSim(7);
    expect(sim.walkable(BRIDGE_TILE.x, BRIDGE_TILE.y)).toBe(false);
    const path = bfsPath(SPAWN_TILE, { x: BRIDGE_TILE.x + 3, y: BRIDGE_TILE.y }, sim.walkable);
    expect(path).toBeNull();
  });

  it('refuses the crossing when the player cannot afford it', () => {
    const sim = new MudwickSim(7);
    sim.player.pos = { x: BRIDGE_TILE.x - 1, y: BRIDGE_TILE.y };
    const cross = sim.optionsAt(BRIDGE_TILE.x, BRIDGE_TILE.y)[0];
    expect(cross?.label).toContain('Cross bridge');
    if (cross) sim.invoke(cross);
    sim.step();
    expect(drainTypes(sim)).toContain('tooPoor');
    expect(sim.bridgePass).toBe(false);
  });

  it('charges the toll once, then the bridge is free forever', () => {
    const sim = new MudwickSim(7);
    sim.player.coins = 25;
    sim.player.pos = { x: BRIDGE_TILE.x - 1, y: BRIDGE_TILE.y };
    const cross = sim.optionsAt(BRIDGE_TILE.x, BRIDGE_TILE.y)[0];
    if (cross) sim.invoke(cross);
    sim.step();
    const events = sim.drainEvents();
    expect(events.some((e) => e.type === 'tollPaid')).toBe(true);
    expect(events.some((e) => e.type === 'milestone' && e.id === 'tollPaid')).toBe(true);
    expect(sim.player.coins).toBe(15);
    expect(sim.bridgePass).toBe(true);
    expect(sim.walkable(BRIDGE_TILE.x, BRIDGE_TILE.y)).toBe(true);
    // No crossing option remains — it is just a walkable tile now.
    const after = sim.optionsAt(BRIDGE_TILE.x, BRIDGE_TILE.y);
    expect(after.some((o) => o.label.includes('Cross bridge'))).toBe(false);
  });

  it('honours a career bridge pass from construction', () => {
    const sim = new MudwickSim({ seed: 7, character: makeCharacter({ bridgePass: true }) });
    expect(sim.walkable(BRIDGE_TILE.x, BRIDGE_TILE.y)).toBe(true);
    const path = bfsPath(SPAWN_TILE, { x: BRIDGE_TILE.x + 3, y: BRIDGE_TILE.y }, sim.walkable);
    expect(path).not.toBeNull();
  });
});

describe('oaks', () => {
  it('turns away under-levelled woodcutters', () => {
    const sim = new MudwickSim({ seed: 9, character: makeCharacter({ bridgePass: true }) });
    const oak = sim.trees.find((t) => t.kind === 'oak');
    if (!oak) throw new Error('no oak');
    sim.player.pos = { x: oak.pos.x - 1, y: oak.pos.y };
    const chop = sim.optionsAt(oak.pos.x, oak.pos.y)[0];
    expect(chop?.label).toBe('Chop Oak');
    if (chop) sim.invoke(chop);
    sim.step();
    expect(drainTypes(sim)).toContain('levelTooLow');
    expect(sim.invCount('oakLog')).toBe(0);
  });

  it('yields oak logs worth 15gp for level-5 woodcutters', () => {
    const sim = new MudwickSim({
      seed: 9,
      character: makeCharacter({
        bridgePass: true,
        xp: { woodcutting: xpForLevel(5), attack: 0, foraging: 0, fishing: 0 },
      }),
    });
    const oak = sim.trees.find((t) => t.kind === 'oak');
    if (!oak) throw new Error('no oak');
    sim.player.pos = { x: oak.pos.x - 1, y: oak.pos.y };
    const chop = sim.optionsAt(oak.pos.x, oak.pos.y)[0];
    if (chop) sim.invoke(chop);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'log'), 60);
    expect(sim.invCount('oakLog')).toBe(1);
    sim.player.pos = { x: TRADER_TILE.x + 1, y: TRADER_TILE.y };
    const { gained } = sim.sell('oakLog');
    expect(gained).toBe(OAK_PRICE);
    expect(sim.stats.oakLogsSold).toBe(1);
  });

  it('reports the woodcutting XP granted for normal and oak logs', () => {
    const cases = [
      { kind: 'normal', seed: 5, startingXp: 0, bridgePass: false, amount: 25 },
      { kind: 'oak', seed: 9, startingXp: xpForLevel(5), bridgePass: true, amount: 40 },
    ] as const;

    for (const testCase of cases) {
      const sim = new MudwickSim({
        seed: testCase.seed,
        character: makeCharacter({
          bridgePass: testCase.bridgePass,
          xp: { woodcutting: testCase.startingXp, attack: 0, foraging: 0, fishing: 0 },
        }),
      });
      const tree = sim.trees.find((candidate) => candidate.kind === testCase.kind);
      if (!tree) throw new Error(`no ${testCase.kind} tree`);
      sim.player.pos = { x: tree.pos.x - 1, y: tree.pos.y };
      const chop = sim.optionsAt(tree.pos.x, tree.pos.y)[0];
      if (!chop) throw new Error('no chop option');
      sim.invoke(chop);

      const events = stepUntil(sim, (batch) => batch.some((event) => event.type === 'log'));
      const log = events.find((event) => event.type === 'log');
      if (log?.type !== 'log') throw new Error('no log event');
      expect(log.amount).toBe(testCase.amount);
      expect(sim.player.skills.woodcutting - testCase.startingXp).toBe(log.amount);
    }
  });
});

describe('hobgoblins', () => {
  it('picks a fight when the player wanders close', () => {
    const sim = new MudwickSim({ seed: 11, character: makeCharacter({ bridgePass: true }) });
    const hob = sim.goblins.find((g) => g.tier === 'hobgoblin');
    if (!hob) throw new Error('no hobgoblin');
    sim.player.pos = { x: hob.pos.x - 2, y: hob.pos.y };
    sim.step();
    expect(hob.aggro).toBe(true);
  });

  it('hits harder and drops more than a goblin', () => {
    const sim = new MudwickSim({
      seed: 11,
      character: makeCharacter({
        bridgePass: true,
        xp: { woodcutting: 0, attack: xpForLevel(10), foraging: 0, fishing: 0 },
      }),
    });
    const hob = sim.goblins.find((g) => g.tier === 'hobgoblin');
    if (!hob) throw new Error('no hobgoblin');
    expect(hob.hp).toBe(HOBGOBLIN_MAX_HP);
    sim.player.pos = { x: hob.pos.x - 1, y: hob.pos.y };
    const attack = sim.optionsAt(hob.pos.x, hob.pos.y)[0];
    expect(attack?.label).toBe('Attack Hobgoblin');
    if (attack) sim.invoke(attack);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'goblinDied'), 200);
    const died = events.find((e) => e.type === 'goblinDied');
    if (died?.type !== 'goblinDied') throw new Error('no kill event');
    expect(died.coins).toBeGreaterThanOrEqual(HOBGOBLIN_DROP_MIN);
    expect(died.coins).toBeLessThanOrEqual(HOBGOBLIN_DROP_MAX);
    expect(sim.stats.hobKills).toBe(1);
    expect(sim.milestones).toContain('bullyTheBully');
  });
});

describe('fishing and cooking', () => {
  function fisherAtSpot(seed = 13): MudwickSim {
    const sim = new MudwickSim(seed);
    sim.player.pos = { x: FISHING_TILE.x - 1, y: FISHING_TILE.y };
    const fish = sim.optionsAt(FISHING_TILE.x, FISHING_TILE.y)[0];
    if (!fish || fish.label !== 'Fish Shrimp') throw new Error('expected fishing option');
    sim.invoke(fish);
    return sim;
  }

  it('catches raw shrimp and keeps fishing — the spot never depletes', () => {
    const sim = fisherAtSpot();
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'fishCaught'), 60);
    expect(sim.invCount('shrimpRaw')).toBe(1);
    expect(sim.player.intent?.kind).toBe('fish');
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'fishCaught'), 60);
    expect(sim.invCount('shrimpRaw')).toBe(2);
    expect(sim.player.skills.fishing).toBeGreaterThanOrEqual(20);
  });

  it('cooks the lot at the campfire with both outcomes possible', () => {
    const sim = new MudwickSim(13);
    sim.player.inventory.push(...Array<'shrimpRaw'>(12).fill('shrimpRaw'));
    sim.player.pos = { x: CAMPFIRE_TILE.x + 1, y: CAMPFIRE_TILE.y };
    const cook = sim.optionsAt(CAMPFIRE_TILE.x, CAMPFIRE_TILE.y)[0];
    expect(cook?.label).toBe('Cook shrimp');
    if (cook) sim.invoke(cook);
    stepUntil(sim, () => sim.invCount('shrimpRaw') === 0, 40);
    expect(sim.stats.shrimpCookedCount + sim.stats.shrimpBurntCount).toBe(12);
    expect(sim.stats.shrimpCookedCount).toBeGreaterThan(0);
    expect(sim.milestones).toContain('chefActually');
    sim.step(); // the empty-handed attempt clears the intent
    expect(sim.player.intent).toBeNull();
  });

  it('flags three consecutive burns somewhere across seeds', () => {
    // Deterministic per seed; at 25% burn odds a triple appears quickly.
    let flagged = false;
    for (let seed = 1; seed <= 40 && !flagged; seed++) {
      const sim = new MudwickSim(seed);
      sim.player.inventory.push(...Array<'shrimpRaw'>(20).fill('shrimpRaw'));
      sim.player.pos = { x: CAMPFIRE_TILE.x + 1, y: CAMPFIRE_TILE.y };
      const cook = sim.optionsAt(CAMPFIRE_TILE.x, CAMPFIRE_TILE.y)[0];
      if (cook) sim.invoke(cook);
      stepUntil(sim, () => sim.invCount('shrimpRaw') === 0, 60);
      flagged = sim.stats.shrimpBurnt3;
    }
    expect(flagged).toBe(true);
  });

  it('cooked shrimp heal 3 from the inventory', () => {
    const sim = new MudwickSim(13);
    sim.player.inventory.push('shrimpCooked');
    sim.player.hp = 5;
    expect(sim.eatFromInventory('shrimpCooked')).toBe(true);
    expect(sim.player.hp).toBe(8);
    expect(sim.invCount('shrimpCooked')).toBe(0);
  });
});

describe('bread economy', () => {
  it('sells bread into the inventory for 3gp', () => {
    const sim = new MudwickSim(17);
    sim.player.coins = 10;
    expect(sim.buyBread()).toBe(true);
    expect(sim.player.coins).toBe(7);
    expect(sim.invCount('bread')).toBe(1);
    sim.player.hp = 4;
    expect(sim.eatFromInventory('bread')).toBe(true);
    expect(sim.player.hp).toBe(8);
  });

  it('refuses when broke', () => {
    const sim = new MudwickSim(17);
    sim.player.coins = 2;
    expect(sim.buyBread()).toBe(false);
  });
});

describe('gravestones', () => {
  /** Stand the player by a goblin with loot and 1hp, and let it finish the job. */
  function dieWithLoot(seed: number): { sim: MudwickSim; deathPos: { x: number; y: number } } {
    const sim = new MudwickSim(seed);
    const goblin = sim.goblins.find((g) => g.tier === 'goblin');
    if (!goblin) throw new Error('no goblin');
    sim.player.inventory.push('log', 'flax', 'flax');
    sim.player.pos = { x: goblin.pos.x - 1, y: goblin.pos.y };
    const deathPos = { ...sim.player.pos };
    sim.player.hp = 1;
    const attack = sim.optionsAt(goblin.pos.x, goblin.pos.y)[0];
    if (attack) sim.invoke(attack);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'playerDied'), 300);
    return { sim, deathPos };
  }

  it('drops the inventory into a gravestone on death', () => {
    const { sim } = dieWithLoot(19);
    expect(sim.gravestone).not.toBeNull();
    expect(sim.gravestone?.items).toEqual(['log', 'flax', 'flax']);
    expect(sim.player.inventory).toEqual([]);
    expect(sim.player.pos).toEqual(SPAWN_TILE);
  });

  it('reclaims by walking onto the stone', () => {
    const { sim, deathPos } = dieWithLoot(19);
    sim.commandWalk(deathPos);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'gravestoneReclaimed'), 120);
    expect(sim.gravestone).toBeNull();
    expect(sim.player.inventory).toEqual(['log', 'flax', 'flax']);
    expect(sim.milestones).toContain('undertaker');
  });

  it('reclaims through the default gravestone action', () => {
    const { sim, deathPos } = dieWithLoot(19);
    const opt = sim.optionsAt(deathPos.x, deathPos.y)[0];
    expect(opt?.label).toBe('Reclaim items');
    if (!opt) throw new Error('no reclaim option');
    sim.invoke(opt);
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'gravestoneReclaimed'), 150);
    expect(events.some((e) => e.type === 'gravestoneReclaimed')).toBe(true);
    expect(sim.gravestone).toBeNull();
    expect(sim.player.inventory).toEqual(['log', 'flax', 'flax']);
  });

  it('expires after its ticks run out', () => {
    const { sim } = dieWithLoot(19);
    let lost = false;
    for (let i = 0; i <= GRAVESTONE_TICKS + 2 && !lost; i++) {
      sim.step();
      lost = sim.drainEvents().some((e) => e.type === 'gravestoneLost');
    }
    expect(lost).toBe(true);
    expect(sim.gravestone).toBeNull();
  });

  it('a second death replaces the stone and files it under double bereavement', () => {
    const { sim } = dieWithLoot(19);
    expect(sim.gravestone).not.toBeNull();
    // Die again with fresh loot before reclaiming the first stone.
    const goblin = sim.goblins.find((g) => g.tier === 'goblin' && g.alive);
    if (!goblin) throw new Error('no live goblin');
    sim.player.inventory.push('log');
    sim.player.pos = { x: goblin.pos.x - 1, y: goblin.pos.y };
    sim.player.hp = 1;
    const attack = sim.optionsAt(goblin.pos.x, goblin.pos.y)[0];
    if (attack) sim.invoke(attack);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'playerDied'), 300);
    expect(sim.stats.doubleBereavement).toBe(true);
    expect(sim.gravestone?.items).toEqual(['log']);
  });
});

describe('standing orders (the away plan)', () => {
  it('does nothing by default — walking away mid-combat stays lethal', () => {
    const sim = new MudwickSim(23);
    expect(sim.awayPlan).toEqual(DEFAULT_AWAY_PLAN);
    expect(
      DEFAULT_AWAY_PLAN.keepWorking
      || DEFAULT_AWAY_PLAN.eatBread
      || DEFAULT_AWAY_PLAN.runHome
      || DEFAULT_AWAY_PLAN.autoSell,
    ).toBe(false);
  });

  it('runs home under 3hp when told to', () => {
    const sim = new MudwickSim(23);
    sim.awayPlan = { ...DEFAULT_AWAY_PLAN, runHome: true };
    sim.player.pos = { x: 14, y: 9 }; // in the pen
    sim.player.hp = 2;
    for (let i = 0; i < 40; i++) sim.step({ playerAway: true });
    expect(sim.player.pos).toEqual(SPAWN_TILE);
  });

  it('eats carried food at low hp when told to', () => {
    const sim = new MudwickSim(23);
    sim.awayPlan = { ...DEFAULT_AWAY_PLAN, eatBread: true };
    sim.player.inventory.push('bread');
    sim.player.hp = 3;
    sim.step({ playerAway: true });
    expect(sim.player.hp).toBe(7);
    expect(sim.invCount('bread')).toBe(0);
  });

  it('sells a full inventory at Wyn when told to', () => {
    const sim = new MudwickSim(23);
    sim.awayPlan = { ...DEFAULT_AWAY_PLAN, autoSell: true };
    sim.player.inventory.push(...Array<'log'>(INVENTORY_SIZE).fill('log'));
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'trade'), 120, { playerAway: true });
    expect(sim.player.inventory).toEqual([]);
    expect(sim.player.coins).toBe(INVENTORY_SIZE * LOG_PRICE);
  });

  it('re-acquires the nearest tree after a chop when told to keep working', () => {
    const sim = new MudwickSim(23);
    sim.awayPlan = { ...DEFAULT_AWAY_PLAN, keepWorking: true };
    const tree = sim.trees.find((t) => t.kind === 'normal');
    if (!tree) throw new Error('no tree');
    sim.player.pos = { x: tree.pos.x - 1, y: tree.pos.y };
    const chop = sim.optionsAt(tree.pos.x, tree.pos.y)[0];
    if (chop) sim.invoke(chop);
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'log'), 60, { playerAway: true });
    // After the successful chop the intent clears; the plan re-acquires.
    stepUntil(sim, (ev) => ev.some((e) => e.type === 'log'), 200, { playerAway: true });
    expect(sim.invCount('log')).toBe(2);
  });
});

describe('the modem (connection control)', () => {
  it('logs out instantly when idle and back in on reconnect', () => {
    const sim = new MudwickSim(29);
    sim.setConnected(false);
    expect(drainTypes(sim)).toContain('loggedOut');
    expect(sim.isLoggedOut).toBe(true);
    const before = { ...sim.player.pos };
    sim.commandWalk({ x: before.x + 2, y: before.y });
    for (let i = 0; i < 5; i++) sim.step();
    expect(sim.player.pos).toEqual(before); // nobody home
    sim.setConnected(true);
    expect(drainTypes(sim)).toContain('loggedIn');
    expect(sim.isLoggedOut).toBe(false);
  });

  it('cannot log out in combat — the fight resolves first, 2004 rules', () => {
    const sim = new MudwickSim(29);
    const goblin = sim.goblins.find((g) => g.tier === 'goblin');
    if (!goblin) throw new Error('no goblin');
    sim.player.pos = { x: goblin.pos.x - 1, y: goblin.pos.y };
    const attack = sim.optionsAt(goblin.pos.x, goblin.pos.y)[0];
    if (attack) sim.invoke(attack);
    sim.step({ playerAway: true });
    expect(sim.isInCombat()).toBe(true);
    sim.setConnected(false);
    expect(sim.isLoggedOut).toBe(false); // pending, not out
    const events = stepUntil(sim, (ev) => ev.some((e) => e.type === 'loggedOut'), 400, {
      playerAway: true,
    });
    // The fight really happened while the logout was pending.
    expect(events.some((e) => e.type === 'playerSwing' || e.type === 'goblinSwing')).toBe(true);
  });
});

describe('career character injection', () => {
  it('starts from carried coins, xp, and pass', () => {
    const sim = new MudwickSim({
      seed: 31,
      character: makeCharacter({
        coins: 500,
        bridgePass: true,
        xp: { woodcutting: xpForLevel(7), attack: xpForLevel(3), foraging: 0, fishing: 0 },
      }),
    });
    expect(sim.player.coins).toBe(500);
    expect(sim.bridgePass).toBe(true);
    expect(sim.stats.coinsEarned).toBe(0);
  });

  it('coin milestones measure the session, not the fortune', () => {
    const sim = new MudwickSim({ seed: 31, character: makeCharacter({ coins: 500 }) });
    sim.step();
    expect(sim.milestones).not.toContain('pocketMoney');
    expect(sim.milestones).not.toContain('dinnerFund');
  });

  it('doubles xp on double-xp nights', () => {
    const plain = new MudwickSim({ seed: 33 });
    const double = new MudwickSim({ seed: 33, doubleXp: true });
    expect(plain.xpMultiplier).toBe(1);
    expect(double.xpMultiplier).toBe(2);
    for (const sim of [plain, double]) {
      const tree = sim.trees.find((t) => t.kind === 'normal');
      if (!tree) throw new Error('no tree');
      sim.player.pos = { x: tree.pos.x - 1, y: tree.pos.y };
      const chop = sim.optionsAt(tree.pos.x, tree.pos.y)[0];
      if (chop) sim.invoke(chop);
      stepUntil(sim, (ev) => ev.some((e) => e.type === 'log'), 60);
    }
    expect(double.player.skills.woodcutting).toBe(plain.player.skills.woodcutting * 2);
  });
});

describe('determinism', () => {
  it('two sims with identical seed and inputs march in lockstep', () => {
    const a = new MudwickSim(0xc0ffee);
    const b = new MudwickSim(0xc0ffee);
    for (let i = 0; i < 300; i++) {
      const away = i % 3 === 0;
      a.step({ playerAway: away });
      b.step({ playerAway: away });
    }
    a.drainEvents();
    b.drainEvents();
    expect(JSON.stringify({ p: a.player, g: a.goblins, t: a.trees, s: a.stats }))
      .toBe(JSON.stringify({ p: b.player, g: b.goblins, t: b.trees, s: b.stats }));
  });
});
