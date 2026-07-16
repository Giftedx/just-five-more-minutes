import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const targetUrl = new URL(process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/');
const expectedOrigin = targetUrl.origin;
const failedResponses = [];
const externalRequests = [];
const runtimeErrors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
const page = await context.newPage();

page.on('request', (request) => {
  const requestUrl = new URL(request.url());
  if ((requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:')
      && requestUrl.origin !== expectedOrigin) {
    externalRequests.push(request.url());
  }
});
page.on('response', (response) => {
  if (!response.ok()) failedResponses.push(`${response.status()} ${response.url()}`);
});
page.on('console', (message) => {
  if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));

try {
  const response = await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  assert.equal(
    response?.status(),
    200,
    `expected 200 from ${targetUrl.href}, got ${response?.status()}`,
  );
  assert.deepEqual(failedResponses, [], `failed resources: ${failedResponses.join(', ')}`);
  assert.deepEqual(externalRequests, [], `unexpected external requests: ${externalRequests.join(', ')}`);
  assert.deepEqual(runtimeErrors, [], `runtime errors: ${runtimeErrors.join(', ')}`);

  const boot = await page.evaluate(() => ({
    hasGame: Object.prototype.hasOwnProperty.call(window, '__game'),
    roomCanvases: document.querySelectorAll('#room-canvas').length,
    titleScreens: document.querySelectorAll('.title-screen').length,
  }));
  assert.deepEqual(boot, { hasGame: true, roomCanvases: 1, titleScreens: 1 });

  console.log(`ARTIFACT PASS — ${targetUrl.href}`);
} finally {
  await context.close();
  await browser.close();
}
