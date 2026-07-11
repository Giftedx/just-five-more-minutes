import { describe, expect, it } from 'vitest';
import {
  DEFAULT_AWAY_PLAN,
  freshCareer,
  loadCareer,
  recordNight,
  completeWeek,
  saveCareer,
  weekComplete,
  type NightReportSummary,
} from './career';
import { SKILL_NAMES } from '../mmo/sim/osrs';
import type { ReportHistoryStorage } from './history';

function memoryStorage(initial: Record<string, string> = {}): ReportHistoryStorage & {
  data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

function report(total: number): NightReportSummary {
  return {
    total,
    rows: [0, 30, 20, 4],
    endingTitle: 'Employee of the Month (This House)',
    seed: 12648430,
    milestones: ['pocketMoney'],
    choresDone: 3,
  };
}

describe('freshCareer', () => {
  it('starts on Monday with a clean slate and default away plan', () => {
    const c = freshCareer();
    expect(c.week.night).toBe(0);
    expect(c.week.reports).toEqual([]);
    expect(c.week.suspicionCarry).toBe(0);
    expect(c.week.lieDebt).toBe(0);
    expect(c.character.coins).toBe(0);
    expect(c.character.bridgePass).toBe(false);
    expect(c.character.awayPlan).toEqual(DEFAULT_AWAY_PLAN);
    for (const skill of SKILL_NAMES) expect(c.character.xp[skill]).toBe(0);
  });
});

describe('save / load round trip', () => {
  it('persists and restores a career', () => {
    const storage = memoryStorage();
    const c = freshCareer();
    c.character.coins = 137;
    c.character.xp.woodcutting = 512;
    c.character.bridgePass = true;
    c.gallery.push('timeWizard');
    expect(saveCareer(storage, c)).toBe(true);
    expect(loadCareer(storage)).toEqual(c);
  });

  it('returns a fresh career when nothing is stored', () => {
    expect(loadCareer(memoryStorage())).toEqual(freshCareer());
  });

  it.each([
    ['not json', 'garbage'],
    ['wrong version', JSON.stringify({ ...freshCareer(), version: 2 })],
    ['negative coins', JSON.stringify(withCharacter({ coins: -1 }))],
    ['non-finite xp', JSON.stringify(withXp(Number.POSITIVE_INFINITY))],
    ['night out of range', JSON.stringify(withWeek({ night: 5 }))],
    [
      'report count mismatch',
      JSON.stringify(withWeek({ night: 2, reports: [report(50)] })),
    ],
    ['suspicion out of range', JSON.stringify(withWeek({ suspicionCarry: 11 }))],
  ])('rejects malformed careers (%s) with a fresh one', (_name, raw) => {
    const storage = memoryStorage({ 'j5mm-career-v1': raw });
    expect(loadCareer(storage)).toEqual(freshCareer());
  });

  it('tolerates a throwing storage on save', () => {
    const storage: ReportHistoryStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(saveCareer(storage, freshCareer())).toBe(false);
  });
});

describe('recordNight', () => {
  it('advances the night, halves suspicion (rounded), and appends the report', () => {
    const c = freshCareer();
    const next = recordNight(c, report(54), 7, 1);
    expect(next.week.night).toBe(1);
    expect(next.week.suspicionCarry).toBe(4);
    expect(next.week.lieDebt).toBe(1);
    expect(next.week.reports).toHaveLength(1);
    expect(c.week.night).toBe(0); // pure — original untouched
  });

  it('remembers the archivist line for the rest of the week', () => {
    const c = freshCareer();
    const spent = recordNight(c, report(50), 0, 0, true);
    expect(spent.week.archivistUsed).toBe(true);
    const later = recordNight(spent, report(50), 0, 0, false);
    expect(later.week.archivistUsed).toBe(true); // sticky within the week
    let done = later;
    for (let n = later.week.night; n < 5; n++) done = recordNight(done, report(50), 0, 0);
    expect(completeWeek(done, 'lostWeek', 250).week.archivistUsed).toBe(false);
  });

  it('clamps out-of-domain suspicion into 0..10 before halving', () => {
    const c = freshCareer();
    expect(recordNight(c, report(10), 25, 0).week.suspicionCarry).toBe(5);
    expect(recordNight(c, report(10), -3, 0).week.suspicionCarry).toBe(0);
  });
});

describe('completeWeek', () => {
  it('archives the week, resets to Monday, keeps character and gallery', () => {
    let c = freshCareer();
    c.character.coins = 500;
    for (let night = 0; night < 5; night++) c = recordNight(c, report(60 + night), 4, 0);
    expect(c.week.night).toBe(4);
    expect(c.week.reports).toHaveLength(5);

    const done = completeWeek(c, 'timeWizard', 320);
    expect(done.week.night).toBe(0);
    expect(done.week.reports).toEqual([]);
    expect(done.week.lieDebt).toBe(0);
    expect(done.week.suspicionCarry).toBe(0);
    expect(done.character.coins).toBe(500);
    expect(done.gallery).toContain('timeWizard');
    expect(done.weeksCompleted).toEqual([{ endingId: 'timeWizard', total: 320 }]);
  });

  it('does not duplicate gallery entries', () => {
    const c = completeWeek(completeWeek(freshCareer(), 'lostWeek', 90), 'lostWeek', 95);
    expect(c.gallery).toEqual(['lostWeek']);
    expect(c.weeksCompleted).toHaveLength(2);
  });

  it('round-trips the Friday-complete verdict-pending state', () => {
    let c = freshCareer();
    for (let night = 0; night < 5; night++) c = recordNight(c, report(60), 4, 0);
    expect(weekComplete(c)).toBe(true);
    expect(c.week.night).toBe(4);

    const storage = memoryStorage();
    expect(saveCareer(storage, c)).toBe(true);
    expect(loadCareer(storage)).toEqual(c);
    expect(weekComplete(freshCareer())).toBe(false);
  });
});

// Fixture builders for deliberately-malformed payloads: loose records, not
// Career, so invalid values (night: 5, xp: Infinity) can be expressed.
function withCharacter(patch: Record<string, unknown>): Record<string, unknown> {
  const c = freshCareer();
  return { ...c, character: { ...c.character, ...patch } };
}

function withXp(value: number): Record<string, unknown> {
  const c = freshCareer();
  return withCharacter({ xp: { ...c.character.xp, woodcutting: value } });
}

function withWeek(patch: Record<string, unknown>): Record<string, unknown> {
  const c = freshCareer();
  return { ...c, week: { ...c.week, ...patch } };
}
