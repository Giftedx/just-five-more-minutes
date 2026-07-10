import { describe, expect, it, vi } from 'vitest';
import { recordReport } from './history';

const HISTORY_KEY = 'j5mm-report-history-v1';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  constructor(value?: string) {
    if (value !== undefined) this.values.set(HISTORY_KEY, value);
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('recordReport', () => {
  it.each([-1, 101, Number.MAX_SAFE_INTEGER + 1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid report total %s before accessing storage',
    (total) => {
      const storage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
      };
      let thrown: unknown;

      try {
        recordReport(storage, total);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(RangeError);
      expect((thrown as Error).message).toBe(
        'report total must be an integer between 0 and 100',
      );
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.setItem).not.toHaveBeenCalled();
    },
  );

  it('records the first report under the versioned history key', () => {
    const storage = new MemoryStorage();

    expect(recordReport(storage, 42)).toEqual({
      runNumber: 1,
      best: 42,
      previousTotal: null,
      delta: null,
      isNewBest: true,
      persisted: true,
    });
    expect(JSON.parse(storage.getItem(HISTORY_KEY) ?? '')).toEqual({
      version: 1,
      runs: 1,
      best: 42,
      lastTotal: 42,
    });
  });

  it('compares a later report with the previous total and best', () => {
    const storage = new MemoryStorage();
    recordReport(storage, 42);

    expect(recordReport(storage, 37)).toMatchObject({
      runNumber: 2,
      best: 42,
      previousTotal: 42,
      delta: -5,
      isNewBest: false,
      persisted: true,
    });
  });

  it.each([
    ['malformed JSON', '{not-json'],
    [
      'the wrong schema version',
      JSON.stringify({ version: 2, runs: 8, best: 99, lastTotal: 75 }),
    ],
  ])('recovers from %s as a first report', (_case, storedValue) => {
    const storage = new MemoryStorage(storedValue);

    expect(recordReport(storage, 18)).toMatchObject({
      runNumber: 1,
      best: 18,
      previousTotal: null,
      delta: null,
      isNewBest: true,
      persisted: true,
    });
  });

  it.each([
    JSON.stringify({ version: 1, runs: -1, best: 42, lastTotal: 42 }),
    JSON.stringify({ version: 1, runs: 0, best: 42, lastTotal: 42 }),
    JSON.stringify({ version: 1, runs: Number.MAX_SAFE_INTEGER, best: 42, lastTotal: 42 }),
    JSON.stringify({ version: 1, runs: Number.MAX_SAFE_INTEGER + 1, best: 42, lastTotal: 42 }),
    JSON.stringify({ version: 1, runs: 1, best: 42.5, lastTotal: 42 }),
    JSON.stringify({ version: 1, runs: 1, best: 101, lastTotal: 42 }),
    JSON.stringify({ version: 1, runs: 1, best: 42, lastTotal: 101 }),
    JSON.stringify({ version: 1, runs: 1, best: 10, lastTotal: 90 }),
    '{"version":1,"runs":1,"best":42,"lastTotal":1e309}',
  ])('rejects stored history with invalid numeric fields', (storedValue) => {
    const storage = new MemoryStorage(storedValue);

    expect(recordReport(storage, 18)).toMatchObject({
      runNumber: 1,
      best: 18,
      previousTotal: null,
      delta: null,
      isNewBest: true,
    });
  });

  it('returns an unpersisted summary when writing throws', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('storage full');
      },
    };

    expect(recordReport(storage, 27)).toEqual({
      runNumber: 1,
      best: 27,
      previousTotal: null,
      delta: null,
      isNewBest: true,
      persisted: false,
    });
  });

  it('attempts one write but reports failure when reading throws', () => {
    let writes = 0;
    const storage = {
      getItem: () => {
        throw new Error('storage unavailable');
      },
      setItem: () => {
        writes += 1;
      },
    };

    expect(recordReport(storage, 31)).toMatchObject({
      runNumber: 1,
      best: 31,
      previousTotal: null,
      delta: null,
      isNewBest: true,
      persisted: false,
    });
    expect(writes).toBe(1);
  });
});
