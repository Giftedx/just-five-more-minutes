import { describe, expect, it } from 'vitest';
import type { NightReportSummary } from './career';
import { ENDING_ARCHIVE, endingGallery, gradeFor, weekVerdict } from './week';

function night(
  mmo: number,
  household: number,
  opts: { choresDone?: number; milestones?: string[]; total?: number } = {},
): NightReportSummary {
  const vibe = 15;
  const comedy = 4;
  return {
    total: opts.total ?? mmo + household + vibe + comedy,
    rows: [mmo, household, vibe, comedy],
    endingTitle: 'x',
    seed: 1,
    milestones: opts.milestones ?? [],
    choresDone: opts.choresDone ?? Math.min(3, Math.floor(household / 8)),
  };
}

function week(mmo: number, household: number, opts: Parameters<typeof night>[2] = {}): NightReportSummary[] {
  return Array.from({ length: 5 }, () => night(mmo, household, opts));
}

describe('gradeFor', () => {
  it('maps totals onto the report-card scale', () => {
    expect(gradeFor(85)).toBe('A');
    expect(gradeFor(70)).toBe('B');
    expect(gradeFor(55)).toBe('C');
    expect(gradeFor(40)).toBe('D');
    expect(gradeFor(39)).toBe('F');
  });
});

describe('weekVerdict matrix', () => {
  it.each([
    [5, 8, 'lostWeek'],
    [15, 8, 'goblinWidow'],
    [30, 8, 'groundedWorthIt'],
    [5, 20, 'quietDecline'],
    [15, 20, 'negotiator'],
    [30, 20, 'doubleAgent'],
    [5, 28, 'employeeOfTheMonth'],
    [15, 28, 'responsibleOne'],
    [30, 28, 'timeWizard'],
  ])('mudwick %i / house %i -> %s', (mmo, household, endingId) => {
    const verdict = weekVerdict(week(mmo, household), 0, 0);
    expect(verdict.endingId).toBe(endingId);
  });

  it('high Friday suspicion grounds you — worth it only if Mudwick paid', () => {
    expect(weekVerdict(week(30, 28), 0, 8).endingId).toBe('groundedWorthIt');
    expect(weekVerdict(week(5, 28), 0, 9).endingId).toBe('groundedForNothing');
  });

  it('stamps stack on the winning ending', () => {
    const reports = week(30, 28, { choresDone: 3, milestones: ['dinnerFund'] });
    const verdict = weekVerdict(reports, 3, 0);
    expect(verdict.endingId).toBe('timeWizard');
    expect(verdict.stamps).toEqual([
      'EVERY CHORE, EVERY NIGHT',
      'RELIABLE ECONOMY',
      'IT WAS NEVER ONE SEC',
    ]);
  });

  it('reports grades and the week total', () => {
    const verdict = weekVerdict(week(10, 24, { total: 70 }), 0, 0);
    expect(verdict.grades).toEqual(['B', 'B', 'B', 'B', 'B']);
    expect(verdict.weekTotal).toBe(350);
  });
});

describe('ending archive', () => {
  it('keeps every ending in one stable unique archive', () => {
    expect(ENDING_ARCHIVE.map((ending) => ending.endingId)).toEqual([
      'lostWeek',
      'goblinWidow',
      'groundedWorthIt',
      'quietDecline',
      'negotiator',
      'doubleAgent',
      'employeeOfTheMonth',
      'responsibleOne',
      'timeWizard',
      'groundedForNothing',
    ]);
    expect(new Set(ENDING_ARCHIVE.map((ending) => ending.endingId)).size).toBe(ENDING_ARCHIVE.length);
    expect(ENDING_ARCHIVE.every((ending) => ending.title.length > 0 && ending.blurb.length > 0)).toBe(true);
  });

  it('projects known endings once and ignores unknown persisted ids', () => {
    const gallery = endingGallery(['timeWizard', 'timeWizard', 'lostWeek', 'legacyMystery']);
    expect(gallery).toHaveLength(10);
    expect(gallery.filter((slot) => slot.collected).map((slot) => slot.id)).toEqual([
      'lostWeek',
      'timeWizard',
    ]);
  });
});
