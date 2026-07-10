const REPORT_HISTORY_KEY = 'j5mm-report-history-v1';

export interface ReportHistorySummary {
  runNumber: number;
  best: number;
  previousTotal: number | null;
  delta: number | null;
  isNewBest: boolean;
  persisted: boolean;
}

export interface ReportHistoryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredReportHistory {
  version: 1;
  runs: number;
  best: number;
  lastTotal: number;
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isReportTotal(value: unknown): value is number {
  return isSafeNonNegativeInteger(value) && value <= 100;
}

function parseStoredHistory(raw: string | null): StoredReportHistory | undefined {
  if (raw === null) return undefined;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return undefined;

    const record = parsed as Record<string, unknown>;
    if (
      record.version !== 1 ||
      !isSafeNonNegativeInteger(record.runs) ||
      record.runs < 1 ||
      record.runs >= Number.MAX_SAFE_INTEGER ||
      !isReportTotal(record.best) ||
      !isReportTotal(record.lastTotal) ||
      record.best < record.lastTotal
    ) {
      return undefined;
    }

    return {
      version: 1,
      runs: record.runs,
      best: record.best,
      lastTotal: record.lastTotal,
    };
  } catch {
    return undefined;
  }
}

export function recordReport(
  storage: ReportHistoryStorage,
  total: number,
): ReportHistorySummary {
  if (!isReportTotal(total)) {
    throw new RangeError('report total must be an integer between 0 and 100');
  }

  let readSucceeded = true;
  let raw: string | null = null;

  try {
    raw = storage.getItem(REPORT_HISTORY_KEY);
  } catch {
    readSucceeded = false;
  }

  const previous = parseStoredHistory(raw);
  const previousTotal = previous?.lastTotal ?? null;
  const isNewBest = previous === undefined || total > previous.best;
  const best = isNewBest ? total : previous.best;
  const runNumber = (previous?.runs ?? 0) + 1;
  let writeSucceeded = true;

  try {
    storage.setItem(
      REPORT_HISTORY_KEY,
      JSON.stringify({ version: 1, runs: runNumber, best, lastTotal: total }),
    );
  } catch {
    writeSucceeded = false;
  }

  return {
    runNumber,
    best,
    previousTotal,
    delta: previousTotal === null ? null : total - previousTotal,
    isNewBest,
    persisted: readSucceeded && writeSucceeded,
  };
}
