/**
 * Full-loop verification at ?speed=10. The script answers every NPC prompt,
 * completes all three chores through the real raycast+E path, and verifies
 * the scorecard. The script moves the player between items.
 * Requires `vite preview` on 4173 and Playwright Chromium.
 *
 *   node scripts/e2e-full.mjs [--night=N]
 * The NIGHT environment variable is used when --night is not present.
 */
import { chromium } from 'playwright';
import { E2E_EXPECTATIONS } from './e2e-expectations.mjs';
import { playNight } from './e2e-night.mjs';

const nightArg = process.argv.slice(2).find((arg) => arg.startsWith('--night='));
const nightValue = nightArg?.slice('--night='.length) ?? process.env.NIGHT ?? '0';
const night = Number(nightValue);
if (nightValue.trim() === '' || !Number.isInteger(night)
  || night < 0 || night >= E2E_EXPECTATIONS.length) {
  throw new Error('night must be an integer from 0 to 4');
}
const expectation = E2E_EXPECTATIONS[night];
const url = new URL(process.env.SMOKE_URL ?? 'http://localhost:4173/?speed=10&skipTitle=1');
url.searchParams.set('night', String(night));

const browser = await chromium.launch();
const page = await browser.newPage();

// CPU_THROTTLE=8 emulates a slow CI runner (CDP throttling) for local repros.
const throttleRate = Number(process.env.CPU_THROTTLE ?? '0');
if (throttleRate > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttleRate });
}

try {
  const response = await page.goto(url.href);
  if (!response || response.status() !== 200) throw new Error(`status ${response?.status()}`);

  await playNight(page, expectation.answers);

  await page.waitForSelector('.sc-card', { timeout: 120_000 });
  const get = (sel) => page.textContent(sel);
  const rows = await page.$$eval('.sc-row .sc-value', (els) => els.map((e) => e.textContent));
  const total = await get('.sc-total-row');
  const ending = await get('.sc-ending');
  const notes = await page.$$eval('.sc-notes li', (els) => els.map((e) => e.textContent));

  const actualRows = rows.map((row) => row?.trim() ?? '');
  if (actualRows[1] !== expectation.assertions.householdRow) {
    throw new Error(
      `household: got ${actualRows[1]}, want ${expectation.assertions.householdRow}`,
    );
  }
  const expectRows = expectation.assertions.rows;
  if (expectRows && (
    actualRows.length !== expectRows.length
    || actualRows.some((row, index) => row !== expectRows[index])
  )) {
    throw new Error(`rows: got ${JSON.stringify(actualRows)}, want ${JSON.stringify(expectRows)}`);
  }
  if (expectation.assertions.total && !total?.includes(expectation.assertions.total)) {
    throw new Error(`total: ${total}`);
  }
  if (expectation.assertions.ending && !ending?.includes(expectation.assertions.ending)) {
    throw new Error(`ending: ${ending}`);
  }
  for (const note of expectation.assertions.notes ?? []) {
    if (!notes.some((actual) => actual?.includes(note))) throw new Error(`notes: ${notes}`);
  }

  console.log(`E2E PASS — rows [${rows.join(' | ')}], ${total?.trim()}, ending "${ending?.trim()}"`);
} finally {
  await browser.close();
}
