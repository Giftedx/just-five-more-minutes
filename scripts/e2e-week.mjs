/** Play Monday through Friday in one career and verify the stored week verdict. */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { E2E_EXPECTATIONS } from './e2e-expectations.mjs';
import { playNight } from './e2e-night.mjs';

const CAREER_KEY = 'j5mm-career-v1';
const NIGHT_CARDS = [
  'MONDAY — Casserole',
  'TUESDAY — Bins Night',
  'WEDNESDAY — Auntie Carol',
  'THURSDAY — Inspection',
  'FRIDAY — The Hendersons',
];
const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

const gradeFor = (total) => {
  if (total >= 85) return 'A';
  if (total >= 70) return 'B';
  if (total >= 55) return 'C';
  if (total >= 40) return 'D';
  return 'F';
};

const url = new URL(process.env.SMOKE_URL ?? 'http://localhost:4173/?speed=10&skipTitle=1');
url.searchParams.delete('night');

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

try {
  const response = await page.goto(url.href);
  assert.equal(response?.status(), 200, `expected 200 from ${url.href}`);

  for (let night = 0; night < E2E_EXPECTATIONS.length; night++) {
    await page.waitForFunction(
      (expectedNight) => window.__game?.['night']?.night === expectedNight,
      night,
    );
    await playNight(page, E2E_EXPECTATIONS[night].answers);

    const scorecard = page.locator('.scorecard:not(.sc-week)');
    await scorecard.locator('.sc-card').waitFor({ state: 'visible', timeout: 120_000 });
    const subtitle = (await scorecard.locator('.sc-subtitle').textContent())?.trim() ?? '';
    assert.ok(
      subtitle.endsWith(NIGHT_CARDS[night]),
      `night ${night} scorecard was out of order: ${JSON.stringify(subtitle)}`,
    );

    const endState = await page.evaluate((careerKey) => {
      const rawCareer = localStorage.getItem(careerKey);
      if (!rawCareer) throw new Error('career was not saved');
      const game = window.__game;
      const sim = game['host'].mmo.sim;
      return {
        career: JSON.parse(rawCareer),
        coins: sim.player.coins,
        xp: { ...sim.player.skills },
      };
    }, CAREER_KEY);
    assert.equal(endState.career.week.reports.length, night + 1);
    assert.equal(endState.career.week.night, Math.min(night + 1, 4));
    assert.equal(endState.career.character.coins, endState.coins);
    assert.deepEqual(endState.career.character.xp, endState.xp);

    const action = scorecard.locator('.sc-restart');
    const actionLabel = (await action.textContent())?.trim() ?? '';
    if (night === 4) {
      assert.equal(actionLabel, 'See the week verdict');
      await action.click();
      break;
    }

    assert.equal(actionLabel, 'File another report (restart)');
    await action.click();
    await page.waitForFunction(
      (nextNight) => window.__game?.['night']?.night === nextNight,
      night + 1,
    );

    const carried = await page.evaluate(() => {
      const game = window.__game;
      const sim = game['host'].mmo.sim;
      return {
        coins: sim.player.coins,
        xp: { ...sim.player.skills },
        suspicion: game['mum'].suspicion,
      };
    });
    assert.equal(carried.coins, endState.career.character.coins);
    assert.deepEqual(carried.xp, endState.career.character.xp);
    assert.equal(carried.suspicion, endState.career.week.suspicionCarry);
  }

  const verdict = page.locator('.scorecard.sc-week');
  await verdict.locator('.sc-card').waitFor({ state: 'visible' });
  const result = await page.evaluate((careerKey) => {
    const rawCareer = localStorage.getItem(careerKey);
    if (!rawCareer) throw new Error('completed career was not saved');
    return {
      career: JSON.parse(rawCareer),
      grades: [...document.querySelectorAll('.sc-week-day')].map((chip) => ({
        day: chip.querySelector('span')?.textContent?.trim() ?? '',
        grade: chip.querySelector('strong')?.textContent?.trim() ?? '',
      })),
    };
  }, CAREER_KEY);
  const totals = result.career.week.reports.map((report) => report.total);
  assert.equal(totals.length, 5);
  assert.deepEqual(result.grades, totals.map((total, index) => ({
    day: DAYS[index],
    grade: gradeFor(total),
  })));

  console.log(`WEEK E2E PASS — totals [${totals.join(', ')}], grades [${result.grades.map(({ grade }) => grade).join(', ')}]`);
} finally {
  await browser.close();
}
