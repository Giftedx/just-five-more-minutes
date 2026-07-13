/**
 * Browser release smoke checks. The managed runner owns the preview server;
 * this script owns one fresh browser context per scenario so storage, viewport,
 * media preferences, and WebGL state cannot leak between checks.
 */
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = new URL(process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/');
baseUrl.search = '';
baseUrl.hash = '';

const urlFor = (params = {}) => {
  const url = new URL(baseUrl);
  for (const [name, value] of Object.entries(params)) {
    url.searchParams.set(name, String(value));
  }
  return url.href;
};

const gotoOk = async (page, params = {}) => {
  const url = urlFor(params);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  assert.equal(response?.status(), 200, `expected 200 from ${url}, got ${response?.status()}`);
};

const browser = await chromium.launch();
let passed = 0;

const scenario = async (name, contextOptions, run) => {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  try {
    await run(page);
    passed++;
    console.log(`  PASS ${name}`);
  } catch (error) {
    throw new Error(`browser smoke scenario failed: ${name}`, { cause: error });
  } finally {
    await context.close();
  }
};

try {
  await scenario('gate owns game lifecycle', { viewport: { width: 800, height: 600 } }, async (page) => {
    await gotoOk(page, { skipTitle: 1, seed: 1 });
    await page.locator('.mobile-gate').waitFor({ state: 'visible' });
    assert.deepEqual(
      await page.evaluate(() => ({
        hasGame: Object.prototype.hasOwnProperty.call(window, '__game'),
        roomCanvases: document.querySelectorAll('#room-canvas').length,
      })),
      { hasGame: false, roomCanvases: 0 },
    );

    await page.setViewportSize({ width: 1000, height: 700 });
    await page.waitForFunction(() => window.__game && document.querySelectorAll('#room-canvas').length === 1);
    assert.deepEqual(
      await page.evaluate(() => ({
        gate: document.querySelector('.mobile-gate') !== null,
        roomCanvases: document.querySelectorAll('#room-canvas').length,
        disposed: window.__game['disposed'],
      })),
      { gate: false, roomCanvases: 1, disposed: false },
    );
  });

  await scenario(
    'gate blocks devices without any fine pointer',
    { viewport: { width: 1000, height: 700 }, hasTouch: true },
    async (page) => {
      await gotoOk(page, { skipTitle: 1, seed: 11 });
      await page.locator('.mobile-gate[data-reason="pointer"]').waitFor({ state: 'visible' });
      assert.deepEqual(
        await page.evaluate(() => ({
          anyFinePointer: matchMedia('(any-pointer: fine)').matches,
          hasGame: Object.prototype.hasOwnProperty.call(window, '__game'),
          roomCanvases: document.querySelectorAll('#room-canvas').length,
        })),
        { anyFinePointer: false, hasGame: false, roomCanvases: 0 },
      );
    },
  );

  await scenario('first pointer-lock rejection freezes time', { viewport: { width: 1000, height: 700 } }, async (page) => {
    await page.addInitScript(() => {
      // Pin the permissions policy to "allowed": this scenario tests the
      // TRANSIENT rejection freeze (Esc cooldown), not the policy-forbidden
      // drag-look fallback. Headless Chromium otherwise forbids the feature.
      Object.defineProperty(Document.prototype, 'featurePolicy', {
        configurable: true,
        get() {
          return { allowsFeature: (name) => name === 'pointer-lock' };
        },
      });
      Object.defineProperty(HTMLCanvasElement.prototype, 'requestPointerLock', {
        configurable: true,
        value() {
          return Promise.reject(new Error('intentional smoke-test rejection'));
        },
      });
    });
    await gotoOk(page, { seed: 2 });
    const begin = page.locator('.title-begin');
    await begin.waitFor({ state: 'visible' });
    assert.equal(await begin.evaluate((button) => document.activeElement === button), true);
    assert.deepEqual(
      await page.locator('.volume-control').evaluate((control) => ({
        display: getComputedStyle(control).display,
        inert: control.inert,
      })),
      { display: 'none', inert: true },
    );
    await page.keyboard.press('Shift+Tab');
    assert.notEqual(await page.evaluate(() => document.activeElement?.id), 'j5mm-volume-slider');
    await begin.focus();
    await page.locator('.title-begin').click();
    await page.locator('.pause-overlay-hint').waitFor({ state: 'visible' });
    assert.deepEqual(
      await page.locator('.volume-control').evaluate((control) => ({
        display: getComputedStyle(control).display,
        inert: control.inert,
      })),
      { display: 'flex', inert: false },
    );
    const before = await page.evaluate(() => window.__game['director'].t);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => window.__game['director'].t);
    assert.ok(after - before < 0.05, `director advanced ${(after - before).toFixed(3)}s while first lock failed`);
  });

  await scenario('dialogue stack preserves a readable gap', { viewport: { width: 900, height: 600 } }, async (page) => {
    await gotoOk(page, { speed: 1, t: 37, skipTitle: 1, seed: 3 });
    await page.waitForFunction(() => {
      const prompt = document.querySelector('.hud-prompt');
      const subtitle = document.querySelector('.hud-subtitle');
      return prompt instanceof HTMLElement
        && subtitle instanceof HTMLElement
        && getComputedStyle(prompt).display !== 'none'
        && getComputedStyle(subtitle).display !== 'none';
    });
    await page.locator('.hud-chore').first().waitFor({ state: 'visible' });
    const geometry = await page.evaluate(() => {
      const prompt = document.querySelector('.hud-prompt').getBoundingClientRect();
      const subtitle = document.querySelector('.hud-subtitle').getBoundingClientRect();
      const objective = document.querySelector('.hud-objective').getBoundingClientRect();
      const chore = document.querySelector('.hud-chore').getBoundingClientRect();
      return {
        dialogueGap: subtitle.top - prompt.bottom,
        taskGap: chore.top - objective.bottom,
      };
    });
    assert.ok(
      geometry.dialogueGap >= 11.5,
      `dialogue gap was ${geometry.dialogueGap.toFixed(2)}px, expected at least 11.5px`,
    );
    assert.ok(
      geometry.taskGap >= 17.5,
      `objective/chore gap was ${geometry.taskGap.toFixed(2)}px, expected at least 17.5px`,
    );
    await page.evaluate(() => {
      const game = window.__game;
      game['handleMmoEvents']([{ type: 'playerDied', coinsLost: 4, whileAway: true }]);
    });
    const toastGeometry = await page.locator('.hud-toast').evaluate((toast) => {
      const toastRect = toast.getBoundingClientRect();
      const promptRect = document.querySelector('.hud-prompt').getBoundingClientRect();
      return {
        gap: promptRect.top - toastRect.bottom,
        tone: toast.dataset.tone,
        marker: getComputedStyle(toast, '::before').content,
      };
    });
    assert.ok(toastGeometry.gap >= 11.5, `toast/prompt gap was ${toastGeometry.gap.toFixed(2)}px`);
    assert.equal(toastGeometry.tone, 'danger');
    assert.match(toastGeometry.marker, /!/);
  });

  await scenario(
    'reduced motion is static but still painted',
    { viewport: { width: 1000, height: 700 }, reducedMotion: 'reduce' },
    async (page) => {
      await gotoOk(page, { seed: 4 });
      await page.locator('.title-screen').waitFor({ state: 'visible' });
      const before = await page.locator('.title-atmosphere').evaluate((el) => el.style.transform);
      await page.mouse.move(100, 100);
      await page.mouse.move(900, 600);
      const state = await page.evaluate(() => {
        const atmosphere = document.querySelector('.title-atmosphere');
        const flicker = document.querySelector('.title-crt-flicker');
        const canvas = document.querySelector('.title-crt');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let painted = false;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] !== 0) {
            painted = true;
            break;
          }
        }
        return {
          transform: atmosphere.style.transform,
          flickerDisplay: getComputedStyle(flicker).display,
          painted,
        };
      });
      assert.equal(state.transform, before, 'reduced-motion title parallax changed');
      assert.equal(state.flickerDisplay, 'none');
      assert.equal(state.painted, true, 'reduced-motion CRT had no painted pixels');
    },
  );

  await scenario('ordinary motion retains title parallax', { viewport: { width: 1000, height: 700 } }, async (page) => {
    await gotoOk(page, { seed: 5 });
    await page.locator('.title-screen').waitFor({ state: 'visible' });
    await page.mouse.move(100, 100);
    const first = await page.locator('.title-atmosphere').evaluate((el) => el.style.transform);
    await page.mouse.move(900, 600);
    const second = await page.locator('.title-atmosphere').evaluate((el) => el.style.transform);
    assert.notEqual(first, second, 'ordinary title parallax did not react to mouse movement');
    assert.ok(second.includes('translate'), `unexpected parallax transform: ${second}`);
  });

  await scenario('title shows the school week strip on a fresh career', { viewport: { width: 1000, height: 700 } }, async (page) => {
    await gotoOk(page, { seed: 6 });
    await page.locator('.title-week').waitFor({ state: 'visible' });
    const strip = await page.evaluate(() => ({
      days: document.querySelectorAll('.title-week-day').length,
      tonight: document.querySelectorAll('.title-week-day--tonight').length,
      card: document.querySelector('.title-week-card')?.textContent ?? '',
      reset: document.querySelector('.title-reset') !== null,
    }));
    assert.equal(strip.days, 5, 'expected five weekday chips');
    assert.equal(strip.tonight, 1, 'expected exactly one highlighted night');
    assert.ok(strip.card.includes('MONDAY'), `fresh career should start Monday: ${strip.card}`);
    assert.ok(strip.reset, 'full reset control missing');
  });

  await scenario('title stays fully composed on a short desktop', { viewport: { width: 1000, height: 700 } }, async (page) => {
    await gotoOk(page, { seed: 61 });
    await page.locator('.title-begin').waitFor({ state: 'visible' });
    const geometry = await page.evaluate(() => {
      const card = document.querySelector('.title-card');
      const header = document.querySelector('.title-header');
      const footer = document.querySelector('.title-footer');
      const begin = document.querySelector('.title-begin');
      const cardRect = card.getBoundingClientRect();
      return {
        scrollTop: card.scrollTop,
        clientHeight: card.clientHeight,
        scrollHeight: card.scrollHeight,
        headerTop: header.getBoundingClientRect().top,
        footerBottom: footer.getBoundingClientRect().bottom,
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        beginFocused: document.activeElement === begin,
      };
    });
    assert.equal(geometry.scrollTop, 0, `title autofocus changed scroll position: ${JSON.stringify(geometry)}`);
    assert.ok(
      geometry.scrollHeight <= geometry.clientHeight,
      `title overflowed a 1000x700 desktop: ${JSON.stringify(geometry)}`,
    );
    assert.ok(geometry.headerTop >= geometry.cardTop, `title header was clipped: ${JSON.stringify(geometry)}`);
    assert.ok(geometry.footerBottom <= geometry.cardBottom, `title footer was clipped: ${JSON.stringify(geometry)}`);
    assert.equal(geometry.beginFocused, true, 'Begin did not retain initial keyboard focus');
  });

  await scenario('scorecard is semantic, focused, and short-screen reachable', { viewport: { width: 900, height: 400 } }, async (page) => {
    await gotoOk(page, { speed: 20, t: 299, skipTitle: 1, seed: '0x0badc0de' });
    await page.locator('.sc-card').waitFor({ state: 'visible', timeout: 10_000 });
    const state = await page.evaluate(() => {
      const scorecard = document.querySelector('.scorecard');
      const title = document.querySelector('.sc-title');
      const ending = document.querySelector('.sc-ending');
      const total = document.querySelector('.sc-total-row');
      const restart = document.querySelector('.sc-restart');
      const volume = document.querySelector('.volume-control');
      return {
        role: scorecard.getAttribute('role'),
        modal: scorecard.getAttribute('aria-modal'),
        labelledBy: scorecard.getAttribute('aria-labelledby'),
        titleId: title.id,
        title: title.textContent,
        ending: ending.textContent,
        total: total.textContent,
        restartFocused: document.activeElement === restart,
        volumeDisplay: getComputedStyle(volume).display,
        career: document.querySelector('.sc-career')?.textContent ?? '',
        seed: document.querySelector('.sc-seed')?.textContent ?? '',
        raf: window.__game['raf'],
      };
    });
    assert.match(state.title, /HOUSEHOLD INCIDENT REPORT/);
    assert.ok(state.ending.trim().length > 0, 'missing ending title');
    assert.match(state.total, /TOTAL\s*\d+ \/ 100/);
    assert.equal(state.role, 'dialog');
    assert.equal(state.modal, 'true');
    assert.equal(state.labelledBy, state.titleId);
    assert.equal(state.restartFocused, true);
    assert.equal(state.volumeDisplay, 'none');
    assert.match(state.career, /RUN\s+\d+/);
    assert.match(state.seed, /RUN SEED\s*·\s*0x0BADC0DE/);
    assert.equal(state.raf, 0, 'game retained an animation frame after ending');

    const topState = await page.evaluate(() => {
      const overlay = document.querySelector('.scorecard');
      overlay.scrollTop = 0;
      const overlayRect = overlay.getBoundingClientRect();
      const cardRect = document.querySelector('.sc-card').getBoundingClientRect();
      const titleRect = document.querySelector('.sc-title').getBoundingClientRect();
      return { overlayTop: overlayRect.top, cardTop: cardRect.top, titleTop: titleRect.top };
    });
    assert.ok(topState.cardTop >= topState.overlayTop - 1, `card top was unreachable: ${JSON.stringify(topState)}`);
    assert.ok(topState.titleTop >= topState.overlayTop - 1, `heading top was unreachable: ${JSON.stringify(topState)}`);

    const bottomState = await page.evaluate(async () => {
      const overlay = document.querySelector('.scorecard');
      overlay.scrollTop = overlay.scrollHeight;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const overlayRect = overlay.getBoundingClientRect();
      const restartRect = document.querySelector('.sc-restart').getBoundingClientRect();
      return {
        overlayTop: overlayRect.top,
        overlayBottom: overlayRect.bottom,
        restartTop: restartRect.top,
        restartBottom: restartRect.bottom,
      };
    });
    assert.ok(
      bottomState.restartTop < bottomState.overlayBottom && bottomState.restartBottom <= bottomState.overlayBottom + 1,
      `restart was unreachable at max scroll: ${JSON.stringify(bottomState)}`,
    );
  });

  await scenario('room-mode MMO render cadence is capped', { viewport: { width: 1000, height: 700 } }, async (page) => {
    await gotoOk(page, { skipTitle: 1, seed: 6 });
    await page.waitForFunction(() => {
      const host = window.__game?.['host'];
      return host?.mode === 'room'
        && host.mmo.renderer['chat'].some((line) => line.text === 'Dinner fund target: 100 gp.');
    });
    const welcomeCopy = await page.evaluate(
      () => window.__game['host'].mmo.renderer['chat'].map((line) => line.text),
    );
    assert.ok(welcomeCopy.includes('Dinner fund target: 100 gp.'), `missing dinner-fund copy: ${welcomeCopy}`);
    assert.ok(
      welcomeCopy.includes('Max stack + 99 all: legendary goals.'),
      `missing legendary-goal copy: ${welcomeCopy}`,
    );
    assert.equal(welcomeCopy.some((line) => line.includes('Earn max stack before dinner')), false);
    const renders = await page.evaluate(() => new Promise((resolve) => {
      const renderer = window.__game['host'].mmo.renderer;
      const original = renderer.render;
      let count = 0;
      renderer.render = function renderSmokeWrapper(...args) {
        count++;
        return original.apply(this, args);
      };
      window.setTimeout(() => {
        renderer.render = original;
        resolve(count);
      }, 1000);
    }));
    assert.ok(renders > 0, 'room-mode MMO never rendered');
    assert.ok(renders <= 12, `room-mode MMO rendered ${renders} times in one second`);
  });

  await scenario('restart and gate transitions release WebGL ownership', { viewport: { width: 1000, height: 700 } }, async (page) => {
    const consoleText = [];
    page.on('console', (message) => consoleText.push(message.text()));
    await gotoOk(page, { seed: 7 });
    await page.waitForFunction(() => window.__game && document.querySelectorAll('#room-canvas').length === 1);

    const restarts = await page.evaluate(async () => {
      let replaced = 0;
      for (let i = 0; i < 20; i++) {
        const before = window.__game;
        before['restart']();
        const after = window.__game;
        if (!after || after === before) throw new Error(`restart ${i + 1} kept the same game handle`);
        if (before['disposed'] !== true) throw new Error(`restart ${i + 1} did not dispose the old game`);
        if (after['disposed'] !== false) throw new Error(`restart ${i + 1} produced a disposed game`);
        replaced++;
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      window.__gameBeforeGate = window.__game;
      return {
        replaced,
        roomCanvases: document.querySelectorAll('#room-canvas').length,
        disposed: window.__game['disposed'],
      };
    });
    assert.deepEqual(restarts, { replaced: 20, roomCanvases: 1, disposed: false });
    await page.waitForTimeout(100);
    assert.equal(
      consoleText.some((text) => text.includes('Too many active WebGL contexts')),
      false,
      `WebGL context warning observed: ${consoleText.join(' | ')}`,
    );

    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForFunction(() => !window.__game && document.querySelectorAll('#room-canvas').length === 0);
    assert.equal(await page.locator('.mobile-gate').isVisible(), true);

    await page.setViewportSize({ width: 1000, height: 700 });
    await page.waitForFunction(() => window.__game && document.querySelectorAll('#room-canvas').length === 1);
    const restored = await page.evaluate(() => {
      const result = {
        fresh: window.__game !== window.__gameBeforeGate,
        roomCanvases: document.querySelectorAll('#room-canvas').length,
        disposed: window.__game['disposed'],
      };
      delete window.__gameBeforeGate;
      return result;
    });
    assert.deepEqual(restored, { fresh: true, roomCanvases: 1, disposed: false });
    await page.waitForTimeout(100);
    assert.equal(
      consoleText.some((text) => text.includes('Too many active WebGL contexts')),
      false,
      `WebGL context warning observed after gate restore: ${consoleText.join(' | ')}`,
    );
  });

  console.log(`SMOKE PASS — ${passed} isolated browser scenarios`);
} finally {
  await browser.close();
}
