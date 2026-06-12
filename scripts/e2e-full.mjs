/**
 * Full-loop verification at ?speed=10: answers every NPC prompt (options
 * 1,2,3,4,1), completes all three chores through the real raycast+E path
 * (teleporting the player between items), then asserts the exact scorecard
 * math. Requires `vite preview` on 4173 and Playwright chromium.
 *
 *   node scripts/e2e-full.mjs
 */
import { chromium } from 'playwright';

const URL = process.env.SMOKE_URL ?? 'http://localhost:4173/?speed=10&skipTitle=1';

/** Stand at (sx,sz) and aim the camera at world point (ix,iy,iz). */
const aimSnippet = `
  (function aim(sx, sz, ix, iy, iz) {
    const h = window.__game['host'];
    h.player.pos.set(sx, 0, sz);
    const dx = ix - sx, dz = iz - sz, dy = iy - 1.55;
    h.player.yaw = Math.atan2(-dx, -dz);
    h.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
  })
`;

const browser = await chromium.launch();
const page = await browser.newPage();

const evalGame = (fn) => page.evaluate(fn);
const aimAndPress = async (sx, sz, ix, iy, iz) => {
  await page.evaluate(`${aimSnippet}(${sx},${sz},${ix},${iy},${iz})`);
  await page.waitForTimeout(120); // let a frame raycast
  await page.keyboard.press('e');
  await page.waitForTimeout(80);
};

const carryTo = async (item, target) => {
  await aimAndPress(...item);
  const carried = await evalGame(() => window.__game['host'].interact.tracker.carried?.id ?? null);
  if (!carried) throw new Error(`pickup failed at ${item}`);
  await aimAndPress(...target);
  const still = await evalGame(() => window.__game['host'].interact.tracker.carried?.id ?? null);
  if (still) throw new Error(`place failed for ${still} at ${target}`);
};

const waitForChore = async (chore) => {
  await page.waitForFunction(
    (c) => window.__game['director'].chores[c].requestedAt !== null,
    chore,
    { timeout: 90_000, polling: 150 },
  );
};

const answerPrompt = async (lineId, option) => {
  await page.waitForFunction(
    (l) => window.__game['director'].activePrompt?.lineId === l,
    lineId,
    { timeout: 90_000, polling: 100 },
  );
  await page.keyboard.press(String(option));
};

try {
  const response = await page.goto(URL);
  if (!response || response.status() !== 200) throw new Error(`status ${response?.status()}`);

  const TRAY = [0.05, 1.1, 0.05, 0.05, 1.72];
  const BIN = [1.95, -0.45, 1.95, 0.2, -1.1];
  const BASKET = [-1.85, 0.9, -1.85, 0.15, 1.55];

  await answerPrompt('intro', 1);

  await waitForChore('mugs');
  await answerPrompt('mugs', 2);
  await carryTo([0.28, -0.8, 0.28, 0.82, -1.42], TRAY);
  await carryTo([1.5, -0.8, 1.5, 0.82, -1.38], TRAY);
  await carryTo([1.56, -0.8, 1.56, 0.82, -1.74], TRAY);

  await waitForChore('wrappers');
  await answerPrompt('wrappers', 3);
  await carryTo([0.3, 0.8, 0.3, 0.04, 0.1], BIN);
  await carryTo([1.5, 0.3, 1.5, 0.04, -0.4], BIN);
  await carryTo([-0.55, 0.4, -0.55, 0.04, 1.1], BIN);
  await carryTo([0.32, -0.8, 0.32, 0.82, -1.72], BIN);

  await waitForChore('laundry');
  await answerPrompt('laundry', 4);
  await carryTo([-0.9, 0.5, -0.9, 0.05, -0.2], BASKET);
  await carryTo([-0.2, 0.65, -0.2, 0.05, 1.35], BASKET);
  await carryTo([-1.1, 0.2, -1.9, 0.5, 0.2], BASKET);

  const chores = await evalGame(() => {
    const t = window.__game['host'].interact.tracker;
    return ['mugs', 'wrappers', 'laundry'].map((c) => t.isCompleted(c));
  });
  if (!chores.every(Boolean)) throw new Error(`chores not all complete: ${chores}`);

  await answerPrompt('warn', 1);

  await page.waitForSelector('.sc-card', { timeout: 120_000 });
  const get = (sel) => page.textContent(sel);
  const rows = await page.$$eval('.sc-row .sc-value', (els) => els.map((e) => e.textContent));
  const total = await get('.sc-total-row');
  const ending = await get('.sc-ending');
  const notes = await page.$$eval('.sc-notes li', (els) => els.map((e) => e.textContent));

  // Expected: mmo 0 (no coins), household 30 (3x8+6), vibe 20 (20-3+6 clamped),
  // comedy 2 (choresWithoutGlory), total 52, Employee of the Month.
  const expectRows = ['0 / 40', '30 / 30', '20 / 20', '2 / 10'];
  rows.forEach((r, i) => {
    if (r?.trim() !== expectRows[i]) throw new Error(`row ${i}: got "${r}", want "${expectRows[i]}"`);
  });
  if (!total?.includes('52 / 100')) throw new Error(`total: ${total}`);
  if (!ending?.includes('Employee of the Month (This House)')) throw new Error(`ending: ${ending}`);
  if (!notes.some((n) => n?.includes('failed the only quest'))) throw new Error(`notes: ${notes}`);

  console.log(`E2E PASS — rows [${rows.join(' | ')}], ${total?.trim()}, ending "${ending?.trim()}"`);
} finally {
  await browser.close();
}
