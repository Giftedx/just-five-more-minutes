import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const EXPECTED_NIGHTS = [
  'MONDAY — Casserole',
  'TUESDAY — Bins Night',
  'WEDNESDAY — Auntie Carol',
  'THURSDAY — Inspection',
  'FRIDAY — The Hendersons',
];
const EXPECTED_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

const url = new URL(process.env.SMOKE_URL ?? 'http://localhost:4173/');
url.searchParams.set('skipTitle', '1');
url.searchParams.set('speed', '10');
url.searchParams.set('t', '179');
url.searchParams.delete('night');

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  const response = await page.goto(url.href);
  assert.equal(response?.status(), 200, `expected page status 200, got ${response?.status()}`);

  for (const expectedNight of EXPECTED_NIGHTS) {
    const scorecard = page.locator('.scorecard:not(.sc-week)');
    await scorecard.waitFor({ state: 'visible', timeout: 30_000 });

    const subtitle = await scorecard.locator('.sc-subtitle').textContent();
    const actualNight = subtitle?.split('·').at(-1)?.trim();
    assert.equal(actualNight, expectedNight, `expected ${expectedNight}, got ${actualNight}`);

    const action = scorecard.locator('.sc-restart');
    if (expectedNight === EXPECTED_NIGHTS.at(-1)) {
      assert.equal((await action.textContent())?.trim(), 'See the week verdict');
    }
    await action.click();
  }

  const verdict = page.locator('.scorecard.sc-week');
  await verdict.waitFor({ state: 'visible', timeout: 10_000 });
  const dayGrades = await verdict.locator('.sc-week-day').evaluateAll((chips) => chips.map((chip) => ({
    day: chip.querySelector('span')?.textContent?.trim(),
    grade: chip.querySelector('strong')?.textContent?.trim(),
  })));
  assert.deepEqual(dayGrades.map(({ day }) => day), EXPECTED_DAYS);
  assert.equal(dayGrades.length, 5);
  assert.ok(dayGrades.every(({ grade }) => grade), 'each day must have a grade');

  const career = await verdict.locator('.sc-restart').evaluate((button) => {
    button.click();
    return window.__game['career'];
  });
  assert.equal(career.weeksCompleted.length, 1);
  assert.equal(career.week.night, 0);
  assert.deepEqual(career.week.reports, []);

  console.log('WEEK E2E PASS: Monday through Friday completed and a new week started');
} finally {
  await browser.close();
}
