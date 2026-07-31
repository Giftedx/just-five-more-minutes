import { describe, expect, it } from 'vitest';
import { nightSpec } from '../src/director/nights';
import { E2E_EXPECTATIONS } from './e2e-expectations.mjs';

describe('E2E_EXPECTATIONS', () => {
  it.each([0, 1, 2, 3, 4] as const)('mirrors night %i chore chips', (night) => {
    const chips = Object.values(nightSpec(night).slots).map(({ label, count }) => ({
      label,
      count,
    }));

    expect(E2E_EXPECTATIONS[night].choreChips).toEqual(chips);
  });

  it.each([0, 1, 2, 3, 4] as const)('expects night %i chores to be complete', (night) => {
    expect(E2E_EXPECTATIONS[night].assertions.householdRow).toBe('30 / 30');
  });

  it('preserves the Monday full-night assertions', () => {
    expect(E2E_EXPECTATIONS[0].assertions).toMatchObject({
      rows: ['0 / 40', '30 / 30', '20 / 20', '4 / 10'],
      total: '54 / 100',
      ending: 'Employee of the Month (This House)',
    });
  });
});
