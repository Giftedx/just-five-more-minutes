import { describe, expect, it } from 'vitest';
import {
  BANNER_AT,
  CHORE3_CAP,
  CHORE_BASE_TIMES,
  CHORE_GRACE,
  Director,
  NPC_LINES,
  PROMPT_DURATION,
  RESPONSE_OPTIONS,
  SESSION_LENGTH,
  WARN_AT,
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

function near(t: number, target: number): boolean {
  return t >= target && t < target + 1;
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
    expect(near(at('mugs'), CHORE_BASE_TIMES.mugs)).toBe(true);
    expect(near(at('wrappers'), CHORE_BASE_TIMES.wrappers)).toBe(true);
    expect(near(at('laundry'), CHORE_BASE_TIMES.laundry)).toBe(true);
    expect(near(at('warn'), WARN_AT)).toBe(true);

    const banner = eventsOf(log, 'objectiveBanner')[0];
    expect(banner).toBeDefined();
    expect(near(banner?.t ?? -1, BANNER_AT)).toBe(true);

    const end = eventsOf(log, 'sessionEnd')[0];
    expect(end?.t).toBeGreaterThanOrEqual(SESSION_LENGTH);
    expect(d.ended).toBe(true);
  });

  it('delays the next chore to completion + 60s', () => {
    const d = new Director();
    const late = CHORE_BASE_TIMES.mugs + 45;
    const log = run(d, CHORE_BASE_TIMES.wrappers + 80, 0.5, [
      (dir, t) => {
        if (t >= late && dir.chores.mugs.requestedAt !== null && dir.chores.mugs.completedAt === null) {
          dir.noteChoreCompleted('mugs');
        }
      },
    ]);
    const wrappers = eventsOf(log, 'choreRequested').find(
      (e) => e.ev.type === 'choreRequested' && e.ev.chore === 'wrappers',
    );
    expect(wrappers).toBeDefined();
    expect(near(wrappers?.t ?? -1, late + CHORE_GRACE)).toBe(true);
  });

  it('keeps the base schedule when completion is early enough', () => {
    const d = new Director();
    const early = CHORE_BASE_TIMES.mugs + 1;
    const log = run(d, CHORE_BASE_TIMES.wrappers + 20, 0.5, [
      (dir, t) => {
        if (t >= early && dir.chores.mugs.completedAt === null && dir.chores.mugs.requestedAt !== null) {
          dir.noteChoreCompleted('mugs');
        }
      },
    ]);
    const wrappers = eventsOf(log, 'choreRequested').find(
      (e) => e.ev.type === 'choreRequested' && e.ev.chore === 'wrappers',
    );
    expect(near(wrappers?.t ?? -1, CHORE_BASE_TIMES.wrappers)).toBe(true);
  });

  it('clamps laundry scheduling at CHORE3_CAP when completion + 60 would pass it', () => {
    const d = new Director();
    const mugsLate = CHORE_BASE_TIMES.mugs + 58;
    run(d, CHORE_BASE_TIMES.laundry + 50, 0.5, [
      (dir, t) => {
        if (t >= mugsLate && dir.chores.mugs.completedAt === null && dir.chores.mugs.requestedAt !== null) {
          dir.noteChoreCompleted('mugs');
        }
      },
    ]);
    expect(d.chores.laundry.requestedAt).not.toBeNull();
    const d2 = new Director();
    d2.update(CHORE_BASE_TIMES.wrappers + 1);
    (d2 as unknown as { t: number }).t = CHORE3_CAP + 2;
    d2.chores.laundry.requestedAt = null;
    d2.noteChoreCompleted('wrappers');
    const fireAt = (d2 as unknown as { choreFireAt: Record<string, number> }).choreFireAt['laundry'];
    expect(fireAt).toBe(CHORE3_CAP);
  });

  it('laundry can never fire later than CHORE3_CAP across grace delays', () => {
    const d = new Director();
    run(d, SESSION_LENGTH - 20, 0.5, [
      (dir, t) => {
        if (
          t >= CHORE_BASE_TIMES.wrappers - 1 &&
          dir.chores.mugs.completedAt === null &&
          dir.chores.mugs.requestedAt !== null
        ) {
          dir.noteChoreCompleted('mugs');
        }
        if (
          t >= CHORE_BASE_TIMES.laundry - 1 &&
          dir.chores.wrappers.requestedAt !== null &&
          dir.chores.wrappers.completedAt === null
        ) {
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
        if (t >= WARN_AT - 10 && dir.chores.mugs.completedAt === null && dir.chores.mugs.requestedAt !== null) {
          dir.noteChoreCompleted('mugs');
        }
      },
    ]);
    const warn = eventsOf(log, 'npcLine').find((e) => e.ev.type === 'npcLine' && e.ev.lineId === 'warn');
    expect(near(warn?.t ?? -1, WARN_AT)).toBe(true);
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
    d.update(0.5);
    expect(d.activePrompt?.lineId).toBe('intro');
    const ev = d.respond(3);
    expect(ev?.type).toBe('promptClosed');
    if (ev?.type === 'promptClosed') {
      expect(ev.result).toBe('answered');
      expect(ev.option).toBe(3);
    }
    expect(d.activePrompt).toBeNull();
    expect(d.prompts[0]?.result).toBe('answered');
    expect(d.respond(1)).toBeNull();
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
    run(d, CHORE_BASE_TIMES.mugs + 20);
    d.noteChoreStarted('mugs');
    const started = d.chores.mugs.startedAt;
    expect(started).not.toBeNull();
    d.update(10);
    d.noteChoreCompleted('mugs');
    expect(d.chores.mugs.completedAt).toBeGreaterThan(started ?? Infinity);
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
    const seedAt = CHORE_BASE_TIMES.wrappers + 25;
    const d = new Director(seedAt);
    expect(d.chores.mugs.requestedAt).not.toBeNull();
    expect(d.chores.wrappers.requestedAt).not.toBeNull();
    expect(d.chores.laundry.requestedAt).toBeNull();
    expect(d.prompts).toHaveLength(0);
    const log = run(d, CHORE_BASE_TIMES.laundry + 20);
    const laundry = eventsOf(log, 'choreRequested').find(
      (e) => e.ev.type === 'choreRequested' && e.ev.chore === 'laundry',
    );
    expect(laundry?.t).toBeGreaterThanOrEqual(CHORE_BASE_TIMES.laundry);
  });

  it('session end closes any open prompt as ignored', () => {
    const d = new Director(WARN_AT - 1);
    const log = run(d, SESSION_LENGTH + 1, 0.5);
    const warnPrompt = d.prompts.find((p) => p.lineId === 'warn');
    expect(warnPrompt).toBeDefined();
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
