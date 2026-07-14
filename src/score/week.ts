/**
 * The Week Verdict: five incident reports stapled together and judged.
 * Pure — the matrix and overrides come straight from the design spec.
 */
import type { NightReportSummary } from './career';

export interface WeekVerdict {
  endingId: string;
  title: string;
  blurb: string;
  stamps: string[];
  /** Per-night letter grades, Monday first. */
  grades: string[];
  weekTotal: number;
}

export function gradeFor(total: number): string {
  if (total >= 85) return 'A';
  if (total >= 70) return 'B';
  if (total >= 55) return 'C';
  if (total >= 40) return 'D';
  return 'F';
}

type Band = 'low' | 'mid' | 'high';

type Ending = { endingId: string; title: string; blurb: string };

export interface EndingGallerySlot {
  id: string;
  title: string;
  collected: boolean;
}

const LOST_WEEK = {
  endingId: 'lostWeek', title: 'The Lost Week', blurb: 'Neither world improved. Bold.',
} as const;
const GOBLIN_WIDOW = {
  endingId: 'goblinWidow', title: 'Goblin Widow', blurb: 'The goblins know you better than we do.',
} as const;
const GROUNDED_WORTH_IT = {
  endingId: 'groundedWorthIt', title: 'Grounded (Worth It)', blurb: "You regret nothing. That's the problem.",
} as const;
const QUIET_DECLINE = {
  endingId: 'quietDecline', title: 'Quiet Decline', blurb: 'Attendance: yes. Participation: debatable.',
} as const;
const NEGOTIATOR = {
  endingId: 'negotiator', title: 'The Negotiator', blurb: 'Everyone got something. Nobody got everything.',
} as const;
const DOUBLE_AGENT = {
  endingId: 'doubleAgent', title: 'Double Agent', blurb: 'Two lives, adequately led.',
} as const;
const EMPLOYEE_OF_THE_MONTH = {
  endingId: 'employeeOfTheMonth',
  title: 'Employee of the Month (This House)',
  blurb: 'The fridge gets your photo.',
} as const;
const RESPONSIBLE_ONE = {
  endingId: 'responsibleOne', title: 'The Responsible One', blurb: 'Suspiciously functional.',
} as const;
const TIME_WIZARD = {
  endingId: 'timeWizard',
  title: 'Time Wizard',
  blurb: 'We checked the clocks. Nothing was wrong with the clocks.',
} as const;
const GROUNDED_FOR_NOTHING = {
  endingId: 'groundedForNothing',
  title: 'Grounded (For Nothing)',
  blurb: 'All that suspicion, and not even a fortune to show for it.',
} as const;

export const ENDING_ARCHIVE = [
  LOST_WEEK,
  GOBLIN_WIDOW,
  GROUNDED_WORTH_IT,
  QUIET_DECLINE,
  NEGOTIATOR,
  DOUBLE_AGENT,
  EMPLOYEE_OF_THE_MONTH,
  RESPONSIBLE_ONE,
  TIME_WIZARD,
  GROUNDED_FOR_NOTHING,
] as const;

export function endingGallery(ids: readonly string[]): EndingGallerySlot[] {
  const collected = new Set(ids);
  return ENDING_ARCHIVE.map(({ endingId: id, title }) => ({ id, title, collected: collected.has(id) }));
}

function houseBand(avg: number): Band {
  if (avg < 15) return 'low';
  if (avg < 24) return 'mid';
  return 'high';
}

function mudwickBand(avg: number): Band {
  if (avg < 10) return 'low';
  if (avg < 25) return 'mid';
  return 'high';
}

const MATRIX: Record<Band, Record<Band, Ending>> = {
  low: {
    low: LOST_WEEK,
    mid: GOBLIN_WIDOW,
    high: GROUNDED_WORTH_IT,
  },
  mid: {
    low: QUIET_DECLINE,
    mid: NEGOTIATOR,
    high: DOUBLE_AGENT,
  },
  high: {
    low: EMPLOYEE_OF_THE_MONTH,
    mid: RESPONSIBLE_ONE,
    high: TIME_WIZARD,
  },
};

/**
 * Judge the week. `reports` must hold all five nights (Monday first).
 * Overrides, in precedence order: Friday suspicion >= 8 replaces the column
 * ending with a Grounded variant; stamps stack on top of whatever ending won.
 */
export function weekVerdict(
  reports: NightReportSummary[],
  lieDebt: number,
  fridaySuspicion: number,
): WeekVerdict {
  const houseAvg = avg(reports.map((r) => r.rows[1]));
  const mudwickAvg = avg(reports.map((r) => r.rows[0]));
  const mBand = mudwickBand(mudwickAvg);

  let ending = MATRIX[houseBand(houseAvg)][mBand];
  if (fridaySuspicion >= 8) {
    ending = mBand === 'high'
      ? MATRIX.low.high // Grounded (Worth It)
      : GROUNDED_FOR_NOTHING;
  }

  const stamps: string[] = [];
  const choresDone = reports.reduce((sum, r) => sum + r.choresDone, 0);
  if (choresDone >= 15) stamps.push('EVERY CHORE, EVERY NIGHT');
  if (reports.every((r) => r.milestones.includes('dinnerFund'))) stamps.push('RELIABLE ECONOMY');
  if (lieDebt >= 3) stamps.push('IT WAS NEVER ONE SEC');

  return {
    endingId: ending.endingId,
    title: ending.title,
    blurb: ending.blurb,
    stamps,
    grades: reports.map((r) => gradeFor(r.total)),
    weekTotal: reports.reduce((sum, r) => sum + r.total, 0),
  };
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
