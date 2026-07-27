/**
 * Full-loop verification at ?speed=10: answers every NPC prompt (options
 * 1,2,3,4,1), completes all three chores through the real raycast+E path
 * (teleporting the player between items), then asserts the exact scorecard
 * math. Requires `vite preview` on 4173 and Playwright chromium.
 *
 *   node scripts/e2e-full.mjs
 */
import { chromium } from 'playwright';
import { playNight } from './e2e-night.mjs';

const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/?speed=10&skipTitle=1';

const browser = await chromium.launch();
const page = await browser.newPage();

// CPU_THROTTLE=8 emulates a slow CI runner (CDP throttling) for local repros.
const throttleRate = Number(process.env.CPU_THROTTLE ?? '0');
if (throttleRate > 1) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttleRate });
}

try {
  const response = await page.goto(URL);
  if (!response || response.status() !== 200) throw new Error(`status ${response?.status()}`);

  await playNight(page, [1, 2, 3, 4, 1]);

  await page.waitForSelector('.sc-card', { timeout: 120_000 });
  const get = (sel) => page.textContent(sel);
  const rows = await page.$$eval('.sc-row .sc-value', (els) => els.map((e) => e.textContent));
  const total = await get('.sc-total-row');
  const ending = await get('.sc-ending');
  const notes = await page.$$eval('.sc-notes li', (els) => els.map((e) => e.textContent));

  // Spec §5 Monday derivation: mmo 0 (never at the PC), household 30 (3x8+6),
  // vibe 20 (20 - floor(susp 2/2) + 6 quickstarts, clamped), comedy 4
  // (choresWithoutGlory + archivist), total 54, Employee of the Month.
  const expectRows = ['0 / 40', '30 / 30', '20 / 20', '4 / 10'];
  const actualRows = rows.map((row) => row?.trim() ?? '');
  if (
    actualRows.length !== expectRows.length
    || actualRows.some((row, index) => row !== expectRows[index])
  ) {
    throw new Error(`rows: got ${JSON.stringify(actualRows)}, want ${JSON.stringify(expectRows)}`);
  }
  if (!total?.includes('54 / 100')) throw new Error(`total: ${total}`);
  if (!ending?.includes('Employee of the Month (This House)')) throw new Error(`ending: ${ending}`);
  if (!notes.some((n) => n?.includes('100 gp dinner fund'))) throw new Error(`notes: ${notes}`);

  console.log(`E2E PASS — rows [${rows.join(' | ')}], ${total?.trim()}, ending "${ending?.trim()}"`);
} finally {
  await browser.close();
}
