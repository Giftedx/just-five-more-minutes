/**
 * The career file: one persistent Mudwick character and one school week of
 * incident reports, stored locally. Pure functions + injected storage,
 * following the history.ts discipline: a versioned envelope, a validating
 * parse that returns a fresh career on any malformed field, and tolerance
 * for storage that throws.
 */
import { MAX_COINS, SKILL_NAMES } from '../mmo/sim/osrs';
import { DEFAULT_AWAY_PLAN } from '../mmo/sim/sim';
import type { AwayPlan, SkillName } from '../mmo/sim/types';
import type { ReportHistoryStorage } from './history';

const CAREER_KEY = 'j5mm-career-v1';

export type { AwayPlan } from '../mmo/sim/types';
export { DEFAULT_AWAY_PLAN } from '../mmo/sim/sim';

export interface CareerCharacter {
  coins: number;
  xp: Record<SkillName, number>;
  bridgePass: boolean;
  awayPlan: AwayPlan;
}

export interface NightReportSummary {
  total: number;
  /** [mmo, household, vibe, comedy] as displayed. */
  rows: [number, number, number, number];
  endingTitle: string;
  seed: number;
  milestones: string[];
  /** Chore slots completed (0-3) — the week verdict counts to fifteen. */
  choresDone: number;
}

export interface CareerWeek {
  night: 0 | 1 | 2 | 3 | 4;
  suspicionCarry: number;
  lieDebt: number;
  /** "Historical preservation" only lands once a week. She remembers. */
  archivistUsed: boolean;
  reports: NightReportSummary[];
}

export interface CareerTutorials {
  awayPlanSeen: boolean;
}

export interface Career {
  version: 1;
  character: CareerCharacter;
  week: CareerWeek;
  tutorials: CareerTutorials;
  /** Ending ids collected across all completed weeks. */
  gallery: string[];
  weeksCompleted: { endingId: string; total: number }[];
}

export function freshCareer(): Career {
  const xp = {} as Record<SkillName, number>;
  for (const skill of SKILL_NAMES) xp[skill] = 0;
  return {
    version: 1,
    character: { coins: 0, xp, bridgePass: false, awayPlan: { ...DEFAULT_AWAY_PLAN } },
    week: { night: 0, suspicionCarry: 0, lieDebt: 0, archivistUsed: false, reports: [] },
    tutorials: { awayPlanSeen: false },
    gallery: [],
    weeksCompleted: [],
  };
}

const clampSuspicion = (value: number): number => Math.max(0, Math.min(10, value));

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCount(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isSafeInteger(value) && value >= 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function parseAwayPlan(raw: unknown): AwayPlan | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const plan = raw as Record<string, unknown>;
  if (
    !isBoolean(plan.keepWorking) ||
    !isBoolean(plan.eatBread) ||
    !isBoolean(plan.runHome) ||
    !isBoolean(plan.autoSell)
  ) {
    return undefined;
  }
  return {
    keepWorking: plan.keepWorking,
    eatBread: plan.eatBread,
    runHome: plan.runHome,
    autoSell: plan.autoSell,
  };
}

function parseTutorials(raw: unknown): CareerTutorials | undefined {
  // The tutorials block was added without bumping the save envelope. Its
  // absence therefore means a legitimate legacy v1 career, while a present
  // malformed block remains a corrupt save and must fail closed.
  if (raw === undefined) return { awayPlanSeen: false };
  if (typeof raw !== 'object' || raw === null) return undefined;
  const tutorials = raw as Record<string, unknown>;
  if (!isBoolean(tutorials.awayPlanSeen)) return undefined;
  return { awayPlanSeen: tutorials.awayPlanSeen };
}

function parseCharacter(raw: unknown): CareerCharacter | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const c = raw as Record<string, unknown>;
  if (!isCount(c.coins) || c.coins > MAX_COINS || !isBoolean(c.bridgePass)) return undefined;
  if (typeof c.xp !== 'object' || c.xp === null) return undefined;
  const rawXp = c.xp as Record<string, unknown>;
  const xp = {} as Record<SkillName, number>;
  for (const skill of SKILL_NAMES) {
    const value = rawXp[skill];
    if (!isCount(value)) return undefined;
    xp[skill] = value;
  }
  const awayPlan = parseAwayPlan(c.awayPlan);
  if (!awayPlan) return undefined;
  return { coins: c.coins, xp, bridgePass: c.bridgePass, awayPlan };
}

function parseReport(raw: unknown): NightReportSummary | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  if (!isCount(r.total) || r.total > 100) return undefined;
  if (!Array.isArray(r.rows) || r.rows.length !== 4) return undefined;
  const [mmo, household, vibe, comedy] = r.rows as unknown[];
  if (!isCount(mmo) || !isCount(household) || !isCount(vibe) || !isCount(comedy)) {
    return undefined;
  }
  if (typeof r.endingTitle !== 'string') return undefined;
  if (!isCount(r.seed)) return undefined;
  if (!Array.isArray(r.milestones) || !r.milestones.every((m) => typeof m === 'string')) {
    return undefined;
  }
  if (!isCount(r.choresDone) || r.choresDone > 3) return undefined;
  return {
    total: r.total,
    rows: [mmo, household, vibe, comedy],
    endingTitle: r.endingTitle,
    seed: r.seed,
    milestones: r.milestones.slice(),
    choresDone: r.choresDone,
  };
}

function parseWeek(raw: unknown): CareerWeek | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined;
  const w = raw as Record<string, unknown>;
  if (!isCount(w.night) || w.night > 4) return undefined;
  if (!isCount(w.suspicionCarry) || w.suspicionCarry > 10) return undefined;
  if (!isCount(w.lieDebt)) return undefined;
  if (!isBoolean(w.archivistUsed)) return undefined;
  if (!Array.isArray(w.reports)) return undefined;
  // reports.length === night while the week runs; Friday-complete (verdict
  // pending) holds night=4 with all five reports.
  if (w.reports.length !== w.night && !(w.night === 4 && w.reports.length === 5)) {
    return undefined;
  }
  const reports: NightReportSummary[] = [];
  for (const rawReport of w.reports) {
    const report = parseReport(rawReport);
    if (!report) return undefined;
    reports.push(report);
  }
  return {
    night: w.night as CareerWeek['night'],
    suspicionCarry: w.suspicionCarry,
    lieDebt: w.lieDebt,
    archivistUsed: w.archivistUsed,
    reports,
  };
}

function parseCareer(raw: string | null): Career | undefined {
  if (raw === null) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1) return undefined;
    const character = parseCharacter(record.character);
    const week = parseWeek(record.week);
    const tutorials = parseTutorials(record.tutorials);
    if (!character || !week || !tutorials) return undefined;
    if (!Array.isArray(record.gallery) || !record.gallery.every((g) => typeof g === 'string')) {
      return undefined;
    }
    if (!Array.isArray(record.weeksCompleted)) return undefined;
    const weeksCompleted: { endingId: string; total: number }[] = [];
    for (const rawWeek of record.weeksCompleted) {
      if (typeof rawWeek !== 'object' || rawWeek === null) return undefined;
      const entry = rawWeek as Record<string, unknown>;
      if (typeof entry.endingId !== 'string' || !isCount(entry.total)) return undefined;
      weeksCompleted.push({ endingId: entry.endingId, total: entry.total });
    }
    return {
      version: 1,
      character,
      week,
      tutorials,
      gallery: record.gallery.slice(),
      weeksCompleted,
    };
  } catch {
    return undefined;
  }
}

export function loadCareer(storage: ReportHistoryStorage): Career {
  let raw: string | null = null;
  try {
    raw = storage.getItem(CAREER_KEY);
  } catch {
    return freshCareer();
  }
  return parseCareer(raw) ?? freshCareer();
}

export function saveCareer(storage: ReportHistoryStorage, career: Career): boolean {
  try {
    storage.setItem(CAREER_KEY, JSON.stringify(career));
    return true;
  } catch {
    return false;
  }
}

/**
 * Fold a finished night into the career: advance the night pointer, carry
 * half the suspicion forward (rounded), accumulate lie-debt. Pure.
 */
export function recordNight(
  career: Career,
  report: NightReportSummary,
  suspicionEnd: number,
  lieDebtDelta: number,
  archivistUsed = false,
): Career {
  if (weekComplete(career)) return career;
  const nextNight = Math.min(4, career.week.night + 1) as CareerWeek['night'];
  return {
    ...career,
    week: {
      night: nextNight,
      suspicionCarry: clampSuspicion(Math.round(clampSuspicion(suspicionEnd) / 2)),
      lieDebt: career.week.lieDebt + lieDebtDelta,
      archivistUsed: career.week.archivistUsed || archivistUsed,
      reports: [...career.week.reports, report],
    },
  };
}

/** True once Friday's report is in and only the verdict remains. */
export function weekComplete(career: Career): boolean {
  return career.week.reports.length === 5;
}

/** Archive the finished week and reset to Monday. Character and gallery persist. */
export function completeWeek(career: Career, endingId: string, total: number): Career {
  return {
    ...career,
    week: { night: 0, suspicionCarry: 0, lieDebt: 0, archivistUsed: false, reports: [] },
    gallery: career.gallery.includes(endingId)
      ? career.gallery.slice()
      : [...career.gallery, endingId],
    weeksCompleted: [...career.weeksCompleted, { endingId, total }],
  };
}
