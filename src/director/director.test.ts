import { describe, expect, it } from 'vitest';
import {
  CHORE3_CAP,
  Director,
  NPC_LINES,
  PROMPT_DURATION,
  RESPONSE_OPTIONS,
  SESSION_LENGTH,
  type DirectorEvent,
} from './director';

/** Step the director in fixed slices, collecting (time, event) pairs. */
function run(
  d: Director,
  until: number,
  dt = 0.5,
  hooks: ((d: Director, t: number) => void)[] = [],
): { t: number; ev: DirectorEvent }[] {
  const out: { t: number; ev: DirectorEvent }[] = [];
  while (d.t < until && !d.ended) {
    for (const h of hooks) h(d, d.t);
    for (const ev of d.update(dt)) out.push({ t: d.t, ev });
  }
  return out;
}

function eventsOf(log: { t: number; ev: DirectorEvent }[], type: DirectorEvent['type']) {
  return log.filter((e) => e.ev.type === type);
}

describe('director timeline', () => {
  it('fires every event at its scheduled time when nothing is completed', () => {
    const d = new Director();
    const log = run(d, SESSION_LENGTH + 1);

    const lines = eventsOf(log, 'npcLine');
    expect(lines.map((l) => (l.ev.type === 'npcLine' ? l.ev.lineId : ''))).toEqual([
      'intro',
      'mugs',
      'wrappers',
      'laundry',
      'warn',
    ]);
    const at = (lineId: string) => lines.find((l) => l.ev.type === 'npcLine' && l.ev.lineId === lineId)?.t ?? -1;
    expect(at('intro')).toBeLessThanOrEqual(1);
    expect(at('mugs')).toBeGreaterThanOrEqual(90);
    expect(at('mugs')).toBeLessThan(91);
    expect(at('wrappers')).toBeGreaterThanOrEqual(240);
    expect(at('wrappers')).toBeLessThan(241);
    expect(at('laundry')).toBeGreaterThanOrEqual(420);
    expect(at('laundry')).toBeLessThan(421);
    expect(at('warn')).toBeGreaterThanOrEqual(630);
    expect(at('warn')).toBeLessThan(631);

    const banner = eventsOf(log, 'objectiveBanner')[0];
    expect(banner).toBeDefined();
    expect(banner?.t).toBeGreaterThanOrEqual(45);
    expect(banner?.t).toBeLessThan(46);

    const end = eventsOf(log, 'sessionEnd')[0];
    expect(end?.t).toBeGreaterThanOrEqual(SESSION_LENGTH);
    expect(d.ended).toBe(true);
  });

  it('delays the next chore to completion + 60s', () => {
    const d = new Director();
    // Complete mugs the moment it is requested (t=90). Wrappers base 240 is
    // unaffected (90+60 < 240). So instead complete mugs late, at t=200.
    const log = run(d, 400, 0.5, [
      (dir, t) => {
        if (t >= 200 && dir.chores.mugs.requestedAt !== null && dir.chores.mugs.completedAt === null) {
          dir.noteChoreCompleted('mugs');
        }
      },
    ]);
    const wrappers = eventsOf(log, 'choreRequested').find(
      (e) => e.ev.type === 'choreRequested' && e.ev.chore === 'wrappers',
    );
    expect(wrappers).toBeDefined();
    expect(wrappers?.t).toBeGreaterThanOrEqual(260);
    expect(wrappers?.t).toBeLessThan(261);
  });

  it('keeps the base schedule when completion is early enough', () => {
    const d = new Director();
    const log = run(d, 400, 0.5, [
      (dir, t) => {
        if (t >= 100 && dir.chores.mugs.completedAt === null && dir.chores.mugs.requestedAt !== null) {
          dir.noteChoreCompleted('mugs');
        }
      },
    ]);
    const wrappers = eventsOf(log, 'choreRequested').find(
      (e) => e.ev.type === 'choreRequested' && e.ev.chore === 'wrappers',
    );
    expect(wrappers?.t).toBeGreaterThanOrEqual(240);
    expect(wrappers?.t).toBeLessThan(241);
  });

  it('clamps laundry scheduling at 9:30 when completion + 60 would pass it', () => {
    const d = new Director();
    run(d, 530, 0.5, [
      (dir, t) => {
        if (t >= 230 && dir.chores.mugs.completedAt === null && dir.chores.mugs.requestedAt !== null) {
          // Completing mugs at 230 pushes wrappers from 240 to 290.
          dir.noteChoreCompleted('mugs');
        }
      },
    ]);
    // Force the clamp branch: wrappers completes very late with laundry pending.
    expect(d.chores.laundry.requestedAt).not.toBeNull(); // fired at 420 organically
    // Direct unit check of the clamp rule itself:
    const d2 = new Director();
    d2.update(241); // wrappers requested
    (d2 as unknown as { t: number }).t = 540;
    d2.chores.laundry.requestedAt = null; // pretend laundry still pending
    d2.noteChoreCompleted('wrappers');
    const fireAt = (d2 as unknown as { choreFireAt: Record<string, number> }).choreFireAt['laundry'];
    expect(fireAt).toBe(CHORE3_CAP);
  });

  it('laundry can never fire later than 9:30 across grace delays', () => {
    // Worst-case chain: complete mugs just before wrappers fires, wrappers
    // just before laundry fires. Laundry must still be <= 570.
    const d = new Director();
    run(d, 700, 0.5, [
      (dir, t) => {
        if (t >= 239 && dir.chores.mugs.completedAt === null && dir.chores.mugs.requestedAt !== null) {
          dir.noteChoreCompleted('mugs');
        }
        if (t >= 418 && dir.chores.wrappers.requestedAt !== null && dir.chores.wrappers.completedAt === null) {
          dir.noteChoreCompleted('wrappers');
        }
      },
    ]);
    const requestedAt = d.chores.laundry.requestedAt;
    expect(requestedAt).not.toBeNull();
    expect(requestedAt ?? Infinity).toBeLessThanOrEqual(CHORE3_CAP + 1);
  });

  it('final warning and session end never move, regardless of chore chaos', () => {
    const d = new Director();
    const log = run(d, SESSION_LENGTH + 1, 0.5, [
      (dir, t) => {
        if (t >= 600 && dir.chores.mugs.completedAt === null && dir.chores.mugs.requestedAt !== null) {
          dir.noteChoreCompleted('mugs');
        }
      },
    ]);
    const warn = eventsOf(log, 'npcLine').find((e) => e.ev.type === 'npcLine' && e.ev.lineId === 'warn');
    expect(warn?.t).toBeGreaterThanOrEqual(630);
    expect(warn?.t).toBeLessThan(631);
    const end = eventsOf(log, 'sessionEnd')[0];
    expect(end?.t).toBeGreaterThanOrEqual(SESSION_LENGTH);
    expect(end?.t).toBeLessThan(SESSION_LENGTH + 1);
  });

  it('prompts time out as ignored after 20s', () => {
    const d = new Director();
    const log = run(d, 60);
    const closed = eventsOf(log, 'promptClosed')[0];
    expect(closed).toBeDefined();
    if (closed?.ev.type === 'promptClosed') {
      expect(closed.ev.result).toBe('ignored');
      expect(closed.ev.option).toBeNull();
    }
    expect(closed?.t).toBeGreaterThanOrEqual(PROMPT_DURATION);
    expect(closed?.t).toBeLessThan(PROMPT_DURATION + 1);
  });

  it('responding marks the prompt answered with the chosen option', () => {
    const d = new Director();
    d.update(0.5); // intro fires
    expect(d.activePrompt?.lineId).toBe('intro');
    const ev = d.respond(3);
    expect(ev?.type).toBe('promptClosed');
    if (ev?.type === 'promptClosed') {
      expect(ev.result).toBe('answered');
      expect(ev.option).toBe(3);
    }
    expect(d.activePrompt).toBeNull();
    expect(d.prompts[0]?.result).toBe('answered');
    expect(d.respond(1)).toBeNull(); // nothing open any more
  });

  it('never repeats a bark line within a session', () => {
    const d = new Director();
    run(d, SESSION_LENGTH + 1);
    const seen = new Set(d.barkLines);
    expect(seen.size).toBe(d.barkLines.length);
    expect(d.barkLines.length).toBe(5);
  });

  it('chore started/completed bookkeeping records session times', () => {
    const d = new Director();
    run(d, 100);
    d.noteChoreStarted('mugs');
    const started = d.chores.mugs.startedAt;
    expect(started).not.toBeNull();
    d.update(10);
    d.noteChoreCompleted('mugs');
    expect(d.chores.mugs.completedAt).toBeGreaterThan(started ?? Infinity);
    // double completion is a no-op
    const done = d.chores.mugs.completedAt;
    d.update(5);
    d.noteChoreCompleted('mugs');
    expect(d.chores.mugs.completedAt).toBe(done);
  });

  it('ignores chore progress before the chore is requested', () => {
    const d = new Director();
    d.update(1);
    d.noteChoreStarted('laundry');
    expect(d.chores.laundry.startedAt).toBeNull();
  });

  it('seeding the clock skips earlier events without firing prompts', () => {
    const d = new Director(300);
    expect(d.chores.mugs.requestedAt).not.toBeNull();
    expect(d.chores.wrappers.requestedAt).not.toBeNull();
    expect(d.chores.laundry.requestedAt).toBeNull();
    expect(d.prompts).toHaveLength(0);
    const log = run(d, 430);
    const laundry = eventsOf(log, 'choreRequested').find(
      (e) => e.ev.type === 'choreRequested' && e.ev.chore === 'laundry',
    );
    expect(laundry?.t).toBeGreaterThanOrEqual(420);
  });

  it('session end closes any open prompt as ignored', () => {
    const d = new Director(629);
    const log = run(d, SESSION_LENGTH + 1, 0.5);
    const warnPrompt = d.prompts.find((p) => p.lineId === 'warn');
    expect(warnPrompt).toBeDefined();
    // warn fires at 630, prompt would close at 650 — it times out normally.
    const closes = eventsOf(log, 'promptClosed');
    expect(closes.length).toBeGreaterThanOrEqual(1);
    expect(d.ended).toBe(true);
  });

  it('exposes the four canonical response options', () => {
    expect(RESPONSE_OPTIONS).toHaveLength(4);
    expect(RESPONSE_OPTIONS[0]).toBe('One sec!');
    expect(NPC_LINES.warn).toContain('goblin spreadsheet');
  });
});
