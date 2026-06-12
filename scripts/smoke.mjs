/**
 * Smoke test: drive the built game at ?speed=20&skipTitle=1 and assert the
 * scorecard DOM appears at session end. Requires `vite preview` running on
 * port 4173 and a Playwright chromium.
 *
 *   node scripts/smoke.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/?speed=20&skipTitle=1';

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const response = await page.goto(URL);
  if (!response || response.status() !== 200) {
    throw new Error(`expected 200 from ${URL}, got ${response?.status()}`);
  }

  // The 12-minute session runs at 20x => ~36s. Give it 120s of headroom.
  await page.waitForSelector('.sc-card', { timeout: 120_000 });
  const title = await page.textContent('.sc-title');
  const ending = await page.textContent('.sc-ending');
  const total = await page.textContent('.sc-total-row');
  if (!title || !title.includes('HOUSEHOLD INCIDENT REPORT')) {
    throw new Error(`unexpected scorecard title: ${title}`);
  }
  if (!ending || ending.trim().length === 0) {
    throw new Error('missing ending title');
  }
  console.log(`SMOKE PASS — "${title.trim()}" / ending: "${ending.trim()}" / ${total?.trim()}`);
} finally {
  await browser.close();
}
