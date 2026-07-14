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
    const gateState = await page.locator('.mobile-gate').evaluate((gate) => {
      const card = gate.querySelector('.mobile-gate-card');
      const visual = gate.querySelector('.mobile-gate-visual');
      const rect = card.getBoundingClientRect();
      return {
        reason: gate.dataset.reason,
        role: gate.getAttribute('role'),
        eyebrow: gate.querySelector('.mobile-gate-eyebrow')?.textContent ?? '',
        title: gate.querySelector('.mobile-gate-title')?.textContent ?? '',
        copy: gate.querySelector('.mobile-gate-copy')?.textContent ?? '',
        note: gate.querySelector('.mobile-gate-note')?.textContent ?? '',
        visualHidden: visual?.getAttribute('aria-hidden'),
        bounds: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        viewport: { width: innerWidth, height: innerHeight },
      };
    });
    assert.equal(gateState.reason, 'viewport');
    assert.equal(gateState.role, 'alert');
    assert.equal(gateState.eyebrow, 'EQUIPMENT CHECK · WINDOW');
    assert.equal(gateState.title, 'Not enough desk space.');
    assert.match(gateState.copy, /at least 900 pixels/);
    assert.equal(gateState.note, 'The evening starts automatically when this check passes.');
    assert.equal(gateState.visualHidden, 'true');
    assert.ok(gateState.bounds.left >= 16 && gateState.bounds.top >= 16, JSON.stringify(gateState));
    assert.ok(
      gateState.bounds.right <= gateState.viewport.width - 16
        && gateState.bounds.bottom <= gateState.viewport.height - 16,
      JSON.stringify(gateState),
    );
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
      const pointerGate = await page.locator('.mobile-gate').evaluate((gate) => ({
        reason: gate.dataset.reason,
        eyebrow: gate.querySelector('.mobile-gate-eyebrow')?.textContent ?? '',
        title: gate.querySelector('.mobile-gate-title')?.textContent ?? '',
        copy: gate.querySelector('.mobile-gate-copy')?.textContent ?? '',
      }));
      assert.deepEqual(pointerGate, {
        reason: 'pointer',
        eyebrow: 'EQUIPMENT CHECK · POINTER',
        title: 'Mouse and keyboard required.',
        copy: 'This one needs a keyboard, a mouse, and a chair you refuse to leave.',
      });
      assert.deepEqual(
        await page.evaluate(() => ({
          anyFinePointer: matchMedia('(any-pointer: fine)').matches,
          hasGame: Object.prototype.hasOwnProperty.call(window, '__game'),
          roomCanvases: document.querySelectorAll('#room-canvas').length,
        })),
        { anyFinePointer: false, hasGame: false, roomCanvases: 0 },
      );
      for (const viewport of [{ width: 360, height: 400 }, { width: 640, height: 360 }]) {
        await page.setViewportSize(viewport);
        const geometry = await page.locator('.mobile-gate-card').evaluate((card) => {
          const rect = card.getBoundingClientRect();
          return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: innerWidth,
            height: innerHeight,
          };
        });
        assert.ok(geometry.left >= 16 && geometry.top >= 16, JSON.stringify(geometry));
        assert.ok(
          geometry.right <= geometry.width - 16 && geometry.bottom <= geometry.height - 16,
          JSON.stringify(geometry),
        );
      }
    },
  );

  await scenario('document icon is self-contained and resource-clean', { viewport: { width: 1000, height: 700 } }, async (page) => {
    const failedResponses = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });
    await gotoOk(page, { seed: 111 });
    await page.waitForLoadState('networkidle');
    const iconHref = await page.locator('link[rel~="icon"]').getAttribute('href');
    assert.match(iconHref ?? '', /^data:image\/svg\+xml,/);
    assert.deepEqual(failedResponses, [], `failed document resources: ${failedResponses.join(', ')}`);
  });

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
    await page.evaluate(() => {
      window.__pauseFocusLabel = null;
      document.addEventListener('focusin', (event) => {
        if (event.target instanceof HTMLElement && event.target.classList.contains('pause-overlay-hint')) {
          window.__pauseFocusLabel = event.target.textContent;
        }
      });
    });
    await page.locator('.title-begin').click();
    await page.locator('.pause-overlay-hint').waitFor({ state: 'visible' });
    const overlay = page.locator('.pause-overlay');
    const panel = page.locator('.pause-overlay-panel');
    const title = page.locator('.pause-overlay-title');
    const hint = page.locator('.pause-overlay-hint');
    const titleId = await title.getAttribute('id');
    assert.equal(await overlay.getAttribute('role'), 'dialog');
    assert.equal(await overlay.getAttribute('aria-labelledby'), titleId);
    assert.equal(await overlay.getAttribute('aria-modal'), null);
    assert.equal(await page.locator('.pause-overlay-eyebrow').textContent(), 'ROOM MODE · INPUT CHECK');
    assert.equal(await title.textContent(), 'Ready when you are.');
    assert.equal(await page.locator('.pause-overlay-copy').textContent(), 'The room is paused until it has your mouse.');
    assert.equal(await hint.textContent(), 'Click to start looking');
    assert.equal(await hint.evaluate((button) => document.activeElement === button), true);
    assert.equal(await page.evaluate(() => window.__pauseFocusLabel), 'Click to start looking');
    assert.deepEqual(
      await page.locator('.volume-control').evaluate((control) => ({
        display: getComputedStyle(control).display,
        inert: control.inert,
      })),
      { display: 'flex', inert: false },
    );
    const slider = page.locator('#j5mm-volume-slider');
    const initialVolume = Number(await slider.inputValue());
    const sliderBox = await slider.boundingBox();
    assert.ok(sliderBox, 'volume slider has no clickable bounds while paused');
    const clickPosition = {
      x: sliderBox.width * (initialVolume < 0.5 ? 0.75 : 0.25),
      y: sliderBox.height / 2,
    };
    await slider.click({ position: clickPosition });
    const changedVolume = Number(await slider.inputValue());
    assert.notEqual(changedVolume, initialVolume, 'pause overlay intercepted the live volume slider');
    assert.equal(await page.evaluate(() => window.__game['audio'].getVolume()), changedVolume);
    const before = await page.evaluate(() => window.__game['director'].t);
    await page.waitForTimeout(500);
    const after = await page.evaluate(() => window.__game['director'].t);
    assert.ok(after - before < 0.05, `director advanced ${(after - before).toFixed(3)}s while first lock failed`);

    for (const viewport of [{ width: 1000, height: 700 }, { width: 900, height: 400 }]) {
      await page.setViewportSize(viewport);
      const geometry = await panel.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: innerWidth, height: innerHeight };
      });
      assert.ok(geometry.left >= 16 && geometry.top >= 16, JSON.stringify(geometry));
      assert.ok(
        geometry.right <= geometry.width - 16 && geometry.bottom <= geometry.height - 16,
        JSON.stringify(geometry),
      );
    }

    await page.evaluate(() => {
      window.__game['hadPointerLock'] = true;
      document.dispatchEvent(new Event('pointerlockchange'));
    });
    assert.equal(await page.locator('.pause-overlay-eyebrow').textContent(), 'ROOM MODE · PAUSED');
    assert.equal(await title.textContent(), 'The room is holding still.');
    assert.equal(await page.locator('.pause-overlay-copy').textContent(), 'Dinner and Mudwick are frozen until you return.');
    assert.equal(await hint.textContent(), 'Resume looking');
  });

  await scenario(
    'volume control is an authored keyboard-safe fader',
    { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' },
    async (page) => {
      await page.addInitScript(() => localStorage.setItem('j5mm-volume', '0.6'));
      await gotoOk(page, { skipTitle: 1, seed: 23 });
      const control = page.locator('.volume-control');
      const slider = page.locator('#j5mm-volume-slider');
      const label = control.locator('label');
      const level = control.locator('.volume-control-level');

      assert.equal(await label.textContent(), 'AUDIO');
      assert.equal(await label.getAttribute('for'), 'j5mm-volume-slider');
      assert.equal(await slider.getAttribute('aria-label'), 'Volume');
      assert.equal(await level.textContent(), '60%');
      assert.equal(await level.getAttribute('aria-hidden'), 'true');
      const initialState = await control.evaluate((element) => ({
          fill: element.style.getPropertyValue('--volume-level'),
          muted: element.dataset.muted,
      }));
      assert.deepEqual(
        { fill: initialState.fill, muted: initialState.muted },
        { fill: '60%', muted: 'false' },
      );
      const sliderHeight = await slider.evaluate((element) => element.getBoundingClientRect().height);
      assert.ok(sliderHeight >= 32, `volume pointer target was ${sliderHeight}px high`);
      assert.equal(await slider.evaluate((element) => getComputedStyle(element).appearance), 'none');

      await slider.focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await slider.inputValue(), '0.65');
      assert.equal(await level.textContent(), '65%');
      assert.equal(await page.evaluate(() => localStorage.getItem('j5mm-volume')), '0.65');
      assert.equal(await page.evaluate(() => window.__game.audio.getVolume()), 0.65);
      assert.deepEqual(
        await control.evaluate((element) => {
          const style = getComputedStyle(element);
          return {
            width: style.outlineWidth,
            style: style.outlineStyle,
            color: style.outlineColor,
            inputWidth: getComputedStyle(element.querySelector('input')).outlineWidth,
          };
        }),
        { width: '2px', style: 'solid', color: 'rgb(232, 195, 63)', inputWidth: '0px' },
      );

      await slider.evaluate((element) => {
        element.value = '0';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      });
      assert.equal(await level.textContent(), 'OFF');
      assert.deepEqual(
        await control.evaluate((element) => ({
          fill: element.style.getPropertyValue('--volume-level'),
          muted: element.dataset.muted,
          levelColor: getComputedStyle(element.querySelector('.volume-control-level')).color,
        })),
        { fill: '0%', muted: 'true', levelColor: 'rgb(157, 146, 121)' },
      );

      await slider.evaluate((element) => {
        element.value = '1';
        element.dispatchEvent(new Event('input', { bubbles: true }));
      });
      assert.equal(await level.textContent(), '100%');
      assert.deepEqual(
        await control.evaluate((element) => ({
          fill: element.style.getPropertyValue('--volume-level'),
          muted: element.dataset.muted,
        })),
        { fill: '100%', muted: 'false' },
      );

      await page.setViewportSize({ width: 900, height: 400 });
      const bounds = await control.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      });
      assert.ok(bounds.left >= 8 && bounds.top >= 8, JSON.stringify(bounds));
      assert.ok(bounds.right <= 892 && bounds.bottom <= 392, JSON.stringify(bounds));
    },
  );

  await scenario(
    'room interaction lockup exposes authored target states',
    { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
    async (page) => {
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.mode === 'room');

      const aimAt = async (position, target, promptPattern) => {
        await page.evaluate(({ position, target }) => {
          const host = window.__game['host'];
          const player = host.player;
          player.pos.set(position[0], position[1], position[2]);
          const dx = target[0] - position[0];
          const dy = target[1] - 1.55;
          const dz = target[2] - position[2];
          player.yaw = Math.atan2(-dx, -dz);
          player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
          player['apply']();
        }, { position, target });
        await page.waitForFunction(
          (pattern) => {
            const prompt = window.__game?.['host']?.prompt;
            return prompt?.label && new RegExp(pattern).test(prompt.label);
          },
          promptPattern,
        );
        await page.waitForFunction(
          (pattern) => new RegExp(pattern).test(document.querySelector('.hud-interact')?.textContent ?? ''),
          promptPattern.replace(/^E . /, ''),
        );
      };

      const readLockup = () => page.evaluate(() => {
        const prompt = document.querySelector('.hud-interact');
        const crosshair = document.querySelector('.hud-crosshair');
        const fader = document.querySelector('.volume-control');
        const promptRect = prompt.getBoundingClientRect();
        const crosshairRect = crosshair.getBoundingClientRect();
        const faderRect = fader.getBoundingClientRect();
        const style = getComputedStyle(crosshair);
        const overlapArea = (a, b) => (
          Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
          * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
        );
        return {
          promptDisplay: getComputedStyle(prompt).display,
          promptText: prompt.textContent,
          promptPassive: prompt.classList.contains('hud-interact-passive'),
          crosshairDisplay: style.display,
          target: crosshair.classList.contains('hud-crosshair-target'),
          passive: crosshair.classList.contains('hud-crosshair-passive'),
          crosshairWidth: crosshairRect.width,
          crosshairHeight: crosshairRect.height,
          borderColor: style.borderColor,
          background: style.backgroundColor,
          backgroundImage: style.backgroundImage,
          promptBounds: {
            left: promptRect.left,
            top: promptRect.top,
            right: promptRect.right,
            bottom: promptRect.bottom,
          },
          viewport: { width: innerWidth, height: innerHeight },
          faderOverlap: overlapArea(promptRect, faderRect),
        };
      });

      let state = await readLockup();
      assert.equal(state.promptDisplay, 'none');
      assert.equal(state.target, false);
      assert.equal(state.passive, false);
      assert.equal(state.crosshairDisplay, 'block');

      await aimAt([0.28, 0, -0.8], [0.28, 0.82, -1.42], 'Pick up mug');
      state = await readLockup();
      assert.equal(state.promptDisplay, 'flex');
      assert.equal(state.promptText, 'EPick up mug');
      assert.equal(state.promptPassive, false);
      assert.equal(state.target, true);
      assert.equal(state.passive, false);
      assert.ok(state.crosshairWidth >= 17 && state.crosshairHeight >= 17, JSON.stringify(state));
      assert.match(state.borderColor, /232, 195, 63|255, 220, 120/);
      assert.notEqual(state.backgroundImage, 'none');
      const actionableBorder = state.borderColor;

      await aimAt([0.05, 0, 1.1], [0.05, 0.05, 1.72], 'tray');
      state = await readLockup();
      assert.equal(state.promptDisplay, 'flex');
      assert.match(state.promptText, /tray/);
      assert.equal(state.promptPassive, true);
      assert.equal(state.target, false);
      assert.equal(state.passive, true);
      assert.notEqual(state.borderColor, actionableBorder);

      await page.evaluate(() => window.__game['hud'].openPrompt(performance.now(), 4000));
      state = await readLockup();
      assert.equal(state.promptDisplay, 'none');
      assert.equal(state.target, false);
      assert.equal(state.passive, false);

      await page.evaluate(() => window.__game['hud'].closePrompt());
      await aimAt([0.9, 0, -0.9], [0.9, 0.99, -1.72], 'Sit down');
      await page.keyboard.press('KeyE');
      await page.waitForFunction(() => window.__game?.['host']?.mode === 'pc');
      state = await readLockup();
      assert.equal(state.promptDisplay, 'none');
      assert.equal(state.crosshairDisplay, 'none');
      assert.equal(state.target, false);
      assert.equal(state.passive, false);

      await page.setViewportSize({ width: 900, height: 400 });
      await page.evaluate(() => window.__game['host'].exitPc());
      await aimAt([0.28, 0, -0.8], [0.28, 0.82, -1.42], 'Pick up mug');
      state = await readLockup();
      assert.equal(state.promptDisplay, 'flex');
      assert.ok(state.promptBounds.left >= 8 && state.promptBounds.top >= 8, JSON.stringify(state));
      assert.ok(state.promptBounds.right <= state.viewport.width - 8, JSON.stringify(state));
      assert.ok(state.promptBounds.bottom <= state.viewport.height - 8, JSON.stringify(state));
      assert.equal(state.faderOverlap, 0, JSON.stringify(state));
    },
  );

  await scenario('dialogue staging keeps Mum visible and controls separated', { viewport: { width: 900, height: 600 } }, async (page) => {
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
    await page.evaluate(() => {
      const game = window.__game;
      const player = game['host'].player;
      player.yaw = Math.PI;
      player.pitch = 0;
      player['apply']();
      game['host'].room.npcSilhouette.visible = true;
      game['host'].room.setHallLight(true);
      game['silhouetteHideAt'] = performance.now() + 60_000;
    });
    await page.waitForTimeout(300);

    const measureDialogueGeometry = () => page.evaluate(() => {
      const rect = (selector) => {
        const value = document.querySelector(selector).getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      };
      const prompt = rect('.hud-prompt');
      const subtitle = rect('.hud-subtitle');
      const volume = rect('.volume-control');
      const choreRect = rect('.hud-chore');
      const objectiveEl = document.querySelector('.hud-objective');
      const objective = objectiveEl.getBoundingClientRect();
      const objectiveRange = document.createRange();
      objectiveRange.selectNodeContents(objectiveEl);
      const objectiveLineWidths = [...objectiveRange.getClientRects()].map((line) => line.width);
      const chore = document.querySelector('.hud-chore').getBoundingClientRect();
      const host = window.__game['host'];
      const root = host.room.npcSilhouette;
      const points = [];
      root.updateWorldMatrix(true, true);
      root.traverse((object) => {
        if (!object.isMesh || !object.geometry) return;
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox;
        if (!box) return;
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = box.min.clone().set(x, y, z);
              object.localToWorld(point);
              point.project(host.camera);
              points.push({
                x: (point.x * 0.5 + 0.5) * innerWidth,
                y: (-point.y * 0.5 + 0.5) * innerHeight,
              });
            }
          }
        }
      });
      const mum = {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)),
        bottom: Math.max(...points.map((point) => point.y)),
      };
      const upperBody = { ...mum, bottom: mum.top + (mum.bottom - mum.top) * 0.68 };
      const overlapArea = (a, b) => (
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      );
      return {
        prompt,
        subtitle,
        volume,
        chore: choreRect,
        mum: upperBody,
        promptSubtitleOverlap: overlapArea(prompt, subtitle),
        promptMumOverlap: overlapArea(prompt, upperBody),
        subtitleMumOverlap: overlapArea(subtitle, upperBody),
        subtitleVolumeOverlap: overlapArea(subtitle, volume),
        subtitleVolumeGap: volume.top - subtitle.bottom,
        chorePromptOverlap: overlapArea(choreRect, prompt),
        chorePromptGap: prompt.top - choreRect.bottom,
        taskGap: chore.top - objective.bottom,
        objectiveTextWrap: getComputedStyle(objectiveEl).textWrap,
        objectiveLineWidths,
        viewportWidth: innerWidth,
      };
    });

    const assertDialogueGeometry = (geometry) => {
      assert.ok(geometry.prompt.right <= geometry.viewportWidth * 0.48, JSON.stringify(geometry));
      assert.ok(geometry.subtitle.left >= geometry.viewportWidth * 0.38, JSON.stringify(geometry));
      assert.equal(geometry.promptSubtitleOverlap, 0, JSON.stringify(geometry));
      assert.equal(geometry.promptMumOverlap, 0, JSON.stringify(geometry));
      assert.equal(geometry.subtitleMumOverlap, 0, JSON.stringify(geometry));
      assert.equal(geometry.subtitleVolumeOverlap, 0, JSON.stringify(geometry));
      assert.ok(geometry.subtitleVolumeGap >= 8, JSON.stringify(geometry));
    };

    const compactGeometry = await measureDialogueGeometry();
    assertDialogueGeometry(compactGeometry);
    assert.ok(
      compactGeometry.taskGap >= 17.5,
      `objective/chore gap was ${compactGeometry.taskGap.toFixed(2)}px, expected at least 17.5px`,
    );

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(100);
    const desktopGeometry = await measureDialogueGeometry();
    assertDialogueGeometry(desktopGeometry);
    assert.equal(desktopGeometry.objectiveTextWrap, 'balance');
    const widestObjectiveLine = Math.max(...desktopGeometry.objectiveLineWidths);
    const finalObjectiveLine = desktopGeometry.objectiveLineWidths.at(-1) ?? 0;
    assert.ok(
      finalObjectiveLine >= widestObjectiveLine * 0.35,
      `objective reward orphaned: ${JSON.stringify(desktopGeometry.objectiveLineWidths)}`,
    );

    await page.setViewportSize({ width: 900, height: 400 });
    await page.waitForTimeout(100);
    const shortGeometry = await measureDialogueGeometry();
    assertDialogueGeometry(shortGeometry);
    assert.equal(shortGeometry.chorePromptOverlap, 0, JSON.stringify(shortGeometry));
    assert.ok(shortGeometry.chorePromptGap >= 8, JSON.stringify(shortGeometry));

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(100);

    const firstPromptOption = page.locator('.hud-prompt-option').first();
    await firstPromptOption.focus();
    assert.deepEqual(
      await firstPromptOption.evaluate((button) => {
        const style = getComputedStyle(button);
        return { width: style.outlineWidth, offset: style.outlineOffset };
      }),
      { width: '2px', offset: '3px' },
      'Mum response button did not use the intentional keyboard focus treatment',
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
    'household pressure stack stays readable at maximum short-screen pressure',
    { viewport: { width: 900, height: 400 }, reducedMotion: 'reduce' },
    async (page) => {
      await gotoOk(page, { speed: 1, t: 179, night: 3, skipTitle: 1, seed: 313 });
      await page.locator('.hud-chore').first().waitFor({ state: 'visible' });
      await page.evaluate(() => { window.__game['mum'].suspicion = 9; });
      await page.locator('.hud-prompt').waitFor({ state: 'visible' });

      const pressure = await page.evaluate(() => {
        const rect = (element) => {
          const value = element.getBoundingClientRect();
          return { left: value.left, top: value.top, right: value.right, bottom: value.bottom };
        };
        const chores = [...document.querySelectorAll('.hud-chore')];
        const mum = document.querySelector('.hud-mum');
        const prompt = document.querySelector('.hud-prompt');
        const taskStack = document.querySelector('.hud-task-stack');
        const clock = document.querySelector('.hud-clock');
        const taskRects = [...chores.map(rect), rect(mum)];
        const lowestTaskBottom = Math.max(...taskRects.map((value) => value.bottom));
        const promptRect = rect(prompt);
        const mumStyle = getComputedStyle(mum);
        return {
          choreTexts: chores.map((chore) => chore.textContent),
          choreRects: chores.map(rect),
          mumRect: rect(mum),
          tier: mum.dataset.tier,
          state: mum.querySelector('.hud-mum-state')?.textContent ?? '',
          steps: mum.querySelectorAll('.hud-mum-step').length,
          role: mum.getAttribute('role'),
          live: mum.getAttribute('aria-live'),
          atomic: mum.getAttribute('aria-atomic'),
          label: mum.getAttribute('aria-label'),
          animation: mumStyle.animationName,
          mumTransform: mumStyle.transform,
          mumMinWidth: mumStyle.minWidth,
          taskDisplay: getComputedStyle(taskStack).display,
          choreDirection: getComputedStyle(document.querySelector('.hud-chores')).flexDirection,
          taskRect: rect(taskStack),
          clockRect: rect(clock),
          promptRect,
          promptGap: promptRect.top - lowestTaskBottom,
          viewport: { width: innerWidth, height: innerHeight },
        };
      });

      assert.deepEqual(pressure.choreTexts, ['Wrappers 0/4', 'Curtains 0/2', 'Laundry 0/3']);
      assert.equal(pressure.tier, '3');
      assert.equal(pressure.state, 'AT THE DOOR');
      assert.equal(pressure.steps, 4);
      assert.equal(pressure.role, 'status');
      assert.equal(pressure.live, 'polite');
      assert.equal(pressure.atomic, 'true');
      assert.equal(pressure.label, 'Mum: at the door');
      assert.equal(pressure.animation, 'none');
      assert.equal(pressure.mumTransform, 'none');
      assert.equal(pressure.mumMinWidth, '148px');
      assert.equal(pressure.taskDisplay, 'grid');
      assert.equal(pressure.choreDirection, 'row');
      assert.ok(pressure.taskRect.left >= 0 && pressure.taskRect.top >= 0, JSON.stringify(pressure));
      assert.ok(pressure.taskRect.right <= pressure.viewport.width, JSON.stringify(pressure));
      assert.ok(pressure.choreRects.every((value) => value.bottom <= pressure.viewport.height), JSON.stringify(pressure));
      assert.ok(
        [...pressure.choreRects, pressure.mumRect].every(
          (value) => value.left >= 0 && value.right <= pressure.clockRect.left - 8,
        ),
        JSON.stringify(pressure),
      );
      assert.ok(pressure.taskRect.right <= pressure.clockRect.left - 8, JSON.stringify(pressure));
      assert.ok(pressure.promptGap >= 8, JSON.stringify(pressure));

      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(100);
      assert.deepEqual(
        await page.evaluate(() => ({
          taskDisplay: getComputedStyle(document.querySelector('.hud-task-stack')).display,
          choreDirection: getComputedStyle(document.querySelector('.hud-chores')).flexDirection,
        })),
        { taskDisplay: 'flex', choreDirection: 'column' },
      );
    },
  );

  await scenario(
    'Mum doorway vignette stays authored, animated, inert, and bounded',
    { viewport: { width: 900, height: 600 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          const text = message.text();
          if (!text.includes('requestPointerLock')) consoleProblems.push(`${message.type()}: ${text}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.room?.scene);
      const colliderCount = await page.evaluate(() => window.__game['host'].room.colliders.length);
      await page.evaluate(() => {
        const host = window.__game['host'];
        host.player.yaw = Math.PI;
        host.player.pitch = 0;
        host.player['apply']();
        host.room.npcSilhouette.visible = true;
        host.room.setHallLight(true);
      });
      await page.waitForTimeout(350);

      const measure = () => page.evaluate(() => {
        const host = window.__game['host'];
        const scene = host.room.scene;
        const root = scene.getObjectByName('room-mum-doorway');
        const mum = scene.getObjectByName('mum-character');
        const head = scene.getObjectByName('mum-head');
        const hall = scene.getObjectByName('mum-hall-dressing');
        const names = [
          'mum-head',
          'mum-torso',
          'mum-upper-arm-left',
          'mum-upper-arm-right',
          'mum-forearm-left',
          'mum-forearm-right',
          'mum-hand-left',
          'mum-hand-right',
          'mum-tea-towel',
          'mum-skirt',
          'mum-footwear',
          'mum-hall-practical',
          'mum-hall-runner',
          'mum-hall-threshold',
          'mum-hall-skirting',
          'mum-hall-domestic-detail',
          'mum-contact-cue',
          'mum-hair-part',
          'mum-armhole-seam-left',
          'mum-armhole-seam-right',
          'mum-cardigan-neckline',
          'mum-cardigan-ribbing',
          'mum-thumb-left',
          'mum-thumb-right',
          'mum-locket',
          'mum-towel-hem',
          'mum-towel-fold',
          'mum-sconce-socket',
          'mum-sconce-rim',
          'mum-family-portrait',
        ];
        const metrics = (target) => {
          let meshes = 0;
          let triangles = 0;
          let casters = 0;
          let lights = 0;
          const textures = new Map();
          const materialTypes = new Set();
          let maxPhongSpecular = 0;
          target?.traverse((object) => {
            if (object.isMesh) {
              meshes++;
              const multiplier = object.isInstancedMesh ? object.count : 1;
              const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
              triangles += Math.floor(primitives / 3) * multiplier;
              if (object.castShadow) casters++;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              for (const material of materials) {
                if (!material) continue;
                materialTypes.add(material.type);
                if (material.isMeshPhongMaterial) {
                  maxPhongSpecular = Math.max(
                    maxPhongSpecular,
                    material.specular.r,
                    material.specular.g,
                    material.specular.b,
                  );
                }
                if (material.map) {
                  textures.set(material.map.uuid, {
                    width: material.map.image?.width,
                    height: material.map.image?.height,
                    colorSpace: material.map.colorSpace,
                  });
                }
              }
            }
            if (object.isLight) lights++;
          });
          return {
            meshes,
            triangles,
            casters,
            lights,
            textures: [...textures.values()],
            materialTypes: [...materialTypes],
            maxPhongSpecular,
          };
        };
        const belongsTo = (object, target) => {
          for (let cursor = object; cursor; cursor = cursor.parent) {
            if (cursor === target) return true;
          }
          return false;
        };
        const projectedBounds = (target) => {
          const points = [];
          target?.updateWorldMatrix(true, true);
          target?.traverse((object) => {
            if (!object.isMesh || !object.geometry) return;
            object.geometry.computeBoundingBox();
            const box = object.geometry.boundingBox;
            if (!box) return;
            for (const x of [box.min.x, box.max.x]) {
              for (const y of [box.min.y, box.max.y]) {
                for (const z of [box.min.z, box.max.z]) {
                  const point = box.min.clone().set(x, y, z);
                  object.localToWorld(point);
                  point.project(host.camera);
                  points.push({
                    x: (point.x * 0.5 + 0.5) * innerWidth,
                    y: (-point.y * 0.5 + 0.5) * innerHeight,
                  });
                }
              }
            }
          });
          return {
            left: Math.min(...points.map((point) => point.x)),
            right: Math.max(...points.map((point) => point.x)),
            top: Math.min(...points.map((point) => point.y)),
            bottom: Math.max(...points.map((point) => point.y)),
          };
        };
        host.renderer.render(scene, host.camera);
        const portraitMarker = root?.getObjectByName('mum-family-portrait');
        const portraitWorld = portraitMarker
          ? portraitMarker.localToWorld(portraitMarker.position.clone().set(0, 0, 0)).toArray()
          : undefined;
        const domesticAlias = root?.getObjectByName('mum-hall-domestic-detail');
        const domesticAliasWorld = domesticAlias
          ? domesticAlias.localToWorld(domesticAlias.position.clone().set(0, 0, 0)).toArray()
          : undefined;
        return {
          rootName: root?.name,
          mumName: mum?.name,
          hallName: hall?.name,
          namedParts: names.map((name) => root?.getObjectByName(name)?.name),
          rootVisible: root?.visible,
          characterDepth: mum?.position.z,
          contactDepth: root?.getObjectByName('mum-contact-cue')?.position.z,
          thresholdDepth: root?.getObjectByName('mum-hall-threshold')?.position.z,
          markerPositions: {
            ribbing: root?.getObjectByName('mum-cardigan-ribbing')?.position.toArray(),
            portrait: portraitMarker?.position.toArray(),
            portraitWorld,
            domesticAlias: domesticAliasWorld,
          },
          mum: metrics(mum),
          hall: metrics(hall),
          projected: projectedBounds(mum),
          headProjected: projectedBounds(head),
          interactions: root ? host.room.interactables.filter((object) => belongsTo(object, root)).length : 0,
          colliders: host.room.colliders.length,
          calls: host.renderer.info.render.calls,
          triangles: host.renderer.info.render.triangles,
          rendererTextures: host.renderer.info.memory.textures,
          shadowsEnabled: host.renderer.shadowMap.enabled,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
        };
      });

      const before = await measure();
      assert.equal(before.rootName, 'room-mum-doorway');
      assert.equal(before.mumName, 'mum-character');
      assert.equal(before.hallName, 'mum-hall-dressing');
      assert.deepEqual(before.namedParts, [
        'mum-head',
        'mum-torso',
        'mum-upper-arm-left',
        'mum-upper-arm-right',
        'mum-forearm-left',
        'mum-forearm-right',
        'mum-hand-left',
        'mum-hand-right',
        'mum-tea-towel',
        'mum-skirt',
        'mum-footwear',
        'mum-hall-practical',
        'mum-hall-runner',
        'mum-hall-threshold',
        'mum-hall-skirting',
        'mum-hall-domestic-detail',
        'mum-contact-cue',
        'mum-hair-part',
        'mum-armhole-seam-left',
        'mum-armhole-seam-right',
        'mum-cardigan-neckline',
        'mum-cardigan-ribbing',
        'mum-thumb-left',
        'mum-thumb-right',
        'mum-locket',
        'mum-towel-hem',
        'mum-towel-fold',
        'mum-sconce-socket',
        'mum-sconce-rim',
        'mum-family-portrait',
      ]);
      assert.equal(before.rootVisible, true);
      assert.ok(before.characterDepth >= 0.4 && before.characterDepth <= 0.46, JSON.stringify(before));
      assert.ok(before.contactDepth >= 0.4 && before.contactDepth <= 0.46, JSON.stringify(before));
      assert.ok(before.thresholdDepth >= -0.52 && before.thresholdDepth <= -0.46, JSON.stringify(before));
      assert.ok(
        before.markerPositions.ribbing[1] >= 0.8
          && before.markerPositions.ribbing[1] <= 0.83
          && before.markerPositions.ribbing[2] >= 0.08
          && before.markerPositions.ribbing[2] <= 0.1,
        JSON.stringify(before),
      );
      assert.ok(
        before.markerPositions.portrait[0] >= -0.31
          && before.markerPositions.portrait[0] <= -0.27
          && before.markerPositions.portrait[1] >= 1.34
          && before.markerPositions.portrait[1] <= 1.38
          && before.markerPositions.portrait[2] >= 0.45
          && before.markerPositions.portrait[2] <= 0.48,
        JSON.stringify(before),
      );
      assert.deepEqual(before.markerPositions.domesticAlias, before.markerPositions.portraitWorld);
      assert.ok(before.mum.meshes <= 45 && before.mum.triangles <= 3400, JSON.stringify(before));
      assert.deepEqual(before.mum.textures, [{ width: 192, height: 192, colorSpace: 'srgb' }]);
      assert.ok(before.hall.meshes <= 16 && before.hall.triangles <= 1200, JSON.stringify(before));
      assert.deepEqual(before.hall.textures, []);
      const materialTypes = new Set([...before.mum.materialTypes, ...before.hall.materialTypes]);
      const phongCount = [...before.mum.materialTypes, ...before.hall.materialTypes]
        .filter((type) => type === 'MeshPhongMaterial').length;
      assert.ok(phongCount >= 1 && phongCount <= 2, JSON.stringify(before));
      assert.ok(Math.max(before.mum.maxPhongSpecular, before.hall.maxPhongSpecular) <= 0.7, JSON.stringify(before));
      assert.equal(materialTypes.has('MeshStandardMaterial'), false);
      assert.equal(materialTypes.has('MeshPhysicalMaterial'), false);
      assert.equal(before.mum.casters + before.hall.casters, 0);
      assert.equal(before.interactions, 0);
      assert.equal(before.colliders, colliderCount);
      assert.equal(before.shadowsEnabled, false);
      assert.ok(
        before.projected.left >= before.viewportWidth * 0.35
          && before.projected.right <= before.viewportWidth * 0.65,
        JSON.stringify(before),
      );
      assert.ok(
        before.headProjected.left >= before.viewportWidth * 0.42
          && before.headProjected.right <= before.viewportWidth * 0.65
          && before.headProjected.top >= 100
          && before.headProjected.bottom <= before.viewportHeight * 0.72,
        JSON.stringify(before),
      );
      assert.ok(before.calls <= 55 && before.triangles <= 5000 && before.rendererTextures <= 14, JSON.stringify(before));

      const poseA = await page.evaluate(() => ({
        body: window.__game['host'].room.npcSilhouette.rotation.z,
        head: window.__game['host'].room.scene.getObjectByName('mum-head').rotation.z,
      }));
      await page.evaluate(() => window.__game['host'].room.npcTick(performance.now() + 900));
      const poseB = await page.evaluate(() => ({
        body: window.__game['host'].room.npcSilhouette.rotation.z,
        head: window.__game['host'].room.scene.getObjectByName('mum-head').rotation.z,
      }));
      assert.notDeepEqual(poseA, poseB);
      assert.ok(Math.abs(poseB.body) <= 0.018 && Math.abs(poseB.head) <= 0.06, JSON.stringify({ poseA, poseB }));
      await page.evaluate(() => window.__game['host'].room.setHallLight(false));
      assert.equal(
        await page.evaluate(() => window.__game['host'].room.scene.getObjectByName('room-mum-doorway').visible),
        false,
      );
      assert.deepEqual(consoleProblems, []);
    },
  );

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

    await page.keyboard.press('Tab');
    const reset = page.locator('.title-reset');
    assert.equal(await reset.evaluate((button) => document.activeElement === button), true);
    assert.deepEqual(
      await reset.evaluate((button) => {
        const style = getComputedStyle(button);
        return { width: style.outlineWidth, offset: style.outlineOffset };
      }),
      { width: '2px', offset: '3px' },
      'full-reset control did not use the intentional keyboard focus treatment',
    );
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
      const titleStyle = getComputedStyle(title);
      return {
        role: scorecard.getAttribute('role'),
        modal: scorecard.getAttribute('aria-modal'),
        labelledBy: scorecard.getAttribute('aria-labelledby'),
        titleId: title.id,
        title: title.textContent,
        ending: ending.textContent,
        total: total.textContent,
        initialScrollTop: scorecard.scrollTop,
        titleFocused: document.activeElement === title,
        titleOutline: {
          width: titleStyle.outlineWidth,
          offset: titleStyle.outlineOffset,
          style: titleStyle.outlineStyle,
        },
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
    assert.equal(state.initialScrollTop, 0, 'nightly report skipped its heading on open');
    assert.equal(state.titleFocused, true, 'nightly report heading did not own initial focus');
    assert.equal(state.restartFocused, false, 'nightly report opened on its final action');
    assert.deepEqual(
      state.titleOutline,
      { width: '2px', offset: '3px', style: 'solid' },
      'report heading retained the browser-default focus treatment',
    );
    assert.equal(state.volumeDisplay, 'none');
    assert.match(state.career, /RUN\s+\d+/);
    assert.match(state.seed, /RUN SEED\s*·\s*0x0BADC0DE/);
    assert.equal(state.raf, 0, 'game retained an animation frame after ending');

    await page.keyboard.press('Tab');
    const nightlyAction = page.locator('.scorecard:not(.sc-week) .sc-restart');
    assert.equal(await nightlyAction.evaluate((button) => document.activeElement === button), true);
    const nightlyActionBounds = await nightlyAction.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: innerHeight };
    });
    assert.ok(
      nightlyActionBounds.top >= 0 && nightlyActionBounds.bottom <= nightlyActionBounds.height,
      JSON.stringify(nightlyActionBounds),
    );

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

    await page.evaluate(() => {
      document.querySelector('.scorecard')?.remove();
      const game = window.__game;
      game['career'].week.reports = Array.from({ length: 5 }, (_, night) => ({
        night,
        total: 90,
        rows: [35, 28, 18, 9],
        choresDone: 3,
        milestones: ['dinnerFund'],
      }));
      game['career'].week.lieDebt = 3;
      game['career'].week.suspicionCarry = 0;
      game['showVerdictThenRestart']();
    });
    await page.locator('.scorecard.sc-week').waitFor({ state: 'visible' });
    const week = await page.evaluate(() => {
      const overlay = document.querySelector('.scorecard.sc-week');
      const title = overlay.querySelector('.sc-title');
      return {
        scrollTop: overlay.scrollTop,
        titleFocused: document.activeElement === title,
        role: overlay.getAttribute('role'),
        modal: overlay.getAttribute('aria-modal'),
        labelledBy: overlay.getAttribute('aria-labelledby'),
        titleId: title.id,
        grades: overlay.querySelectorAll('.sc-week-day').length,
        stamps: [...overlay.querySelectorAll('.sc-week-stamp')].map((stamp) => stamp.textContent),
      };
    });
    assert.equal(week.scrollTop, 0, 'week verdict skipped its heading on open');
    assert.equal(week.titleFocused, true, 'week verdict heading did not own initial focus');
    assert.equal(week.role, 'dialog');
    assert.equal(week.modal, 'true');
    assert.equal(week.labelledBy, week.titleId);
    assert.equal(week.grades, 5);
    assert.deepEqual(week.stamps, ['EVERY CHORE, EVERY NIGHT', 'RELIABLE ECONOMY', 'IT WAS NEVER ONE SEC']);

    await page.keyboard.press('Tab');
    const weekAction = page.locator('.scorecard.sc-week .sc-restart');
    assert.equal(await weekAction.evaluate((button) => document.activeElement === button), true);
    const actionBounds = await weekAction.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, height: innerHeight };
    });
    assert.ok(actionBounds.top >= 0 && actionBounds.bottom <= actionBounds.height, JSON.stringify(actionBounds));
  });

  await scenario(
    'bedroom rendering has a bounded material and grounding foundation',
    { viewport: { width: 1000, height: 700 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.room?.scene);

      const state = await page.evaluate(() => {
        const host = window.__game['host'];
        const scene = host.room.scene;
        const floor = scene.getObjectByName('room-floor');
        const wall = scene.getObjectByName('room-wall-north');
        const desk = scene.getObjectByName('room-desk');
        const key = scene.getObjectByName('room-key-light');
        const contactShadows = scene.getObjectByName('room-contact-shadows');
        const facesUp = (mesh) => {
          const position = mesh?.geometry?.attributes?.position;
          const index = mesh?.geometry?.index;
          if (!position || !index || index.count < 3) return false;
          const i0 = index.getX(0);
          const i1 = index.getX(1);
          const i2 = index.getX(2);
          const ax = position.getX(i1) - position.getX(i0);
          const az = position.getZ(i1) - position.getZ(i0);
          const bx = position.getX(i2) - position.getX(i0);
          const bz = position.getZ(i2) - position.getZ(i0);
          return az * bx - ax * bz > 0;
        };
        const shadowLights = [];
        let shadowCasters = 0;
        scene.traverse((object) => {
          if (object.isLight && object.castShadow) shadowLights.push(object.name);
          if (object.isMesh && object.castShadow) shadowCasters++;
        });
        return {
          toneMapping: host.renderer.toneMapping,
          outputColorSpace: host.renderer.outputColorSpace,
          shadowsEnabled: host.renderer.shadowMap.enabled,
          floorVertexColors: Boolean(floor?.material?.vertexColors && floor?.geometry?.attributes?.color),
          wallVertexColors: Boolean(wall?.material?.vertexColors && wall?.geometry?.attributes?.color),
          contactShadowsMapped: Boolean(contactShadows?.material?.map),
          contactShadowsDepthWrite: contactShadows?.material?.depthWrite,
          floorFacesUp: facesUp(floor),
          contactShadowsFaceUp: facesUp(contactShadows),
          deskNamed: desk?.name,
          keyCasts: key?.castShadow,
          shadowLights,
          shadowCasters,
        };
      });

      assert.notEqual(state.toneMapping, 0, 'bedroom still uses NoToneMapping');
      assert.equal(state.outputColorSpace, 'srgb');
      assert.equal(state.shadowsEnabled, false);
      assert.equal(state.floorVertexColors, true);
      assert.equal(state.wallVertexColors, true);
      assert.equal(state.contactShadowsMapped, true);
      assert.equal(state.contactShadowsDepthWrite, false);
      assert.equal(state.floorFacesUp, true);
      assert.equal(state.contactShadowsFaceUp, true);
      assert.equal(state.deskNamed, 'room-desk');
      assert.equal(state.keyCasts, false);
      assert.deepEqual(state.shadowLights, []);
      assert.equal(state.shadowCasters, 0);
      assert.deepEqual(consoleProblems, []);
    },
  );

  await scenario(
    'bedroom shell materials stay authored and bounded',
    { viewport: { width: 1000, height: 700 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.room?.scene);

      const state = await page.evaluate(() => {
        const host = window.__game['host'];
        const scene = host.room.scene;
        const inspect = (name) => {
          const mesh = scene.getObjectByName(name);
          const color = mesh?.geometry?.attributes?.color;
          const position = mesh?.geometry?.attributes?.position;
          const index = mesh?.geometry?.index;
          const channelRange = (channel) => {
            if (!color) return 0;
            let min = Infinity;
            let max = -Infinity;
            for (let i = 0; i < color.count; i++) {
              const value = channel === 0 ? color.getX(i) : channel === 1 ? color.getY(i) : color.getZ(i);
              min = Math.min(min, value);
              max = Math.max(max, value);
            }
            return Number((max - min).toFixed(5));
          };
          const materials = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material];
          return {
            name: mesh?.name,
            vertices: position?.count ?? 0,
            triangles: index ? Math.floor(index.count / 3) : Math.floor((position?.count ?? 0) / 3),
            hasColor: Boolean(color),
            colorRanges: [channelRange(0), channelRange(1), channelRange(2)],
            vertexColors: materials.every((material) => material?.vertexColors === true),
            textures: materials.filter((material) => material?.map).length,
            casters: mesh?.castShadow === true,
            interactions: Boolean(mesh?.userData?.interact),
          };
        };
        const shellNames = [
          'room-wall-north',
          'room-wall-west',
          'room-wall-east',
          'room-wall-south-left',
          'room-wall-south-right',
          'room-wall-south-header',
          'room-ceiling',
        ];
        return {
          shells: shellNames.map(inspect),
          rendererTextures: host.renderer.info.memory.textures,
        };
      });

      for (const shell of state.shells) {
        assert.equal(shell.hasColor, true, `${shell.name} has no vertex colors`);
        assert.equal(shell.vertexColors, true, `${shell.name} material ignores vertex colors`);
        assert.ok(shell.vertices > 20, `${shell.name} is still too coarse: ${shell.vertices}`);
        assert.ok(shell.vertices <= 99, `${shell.name} vertex budget exceeded: ${shell.vertices}`);
        assert.ok(shell.triangles <= 160, `${shell.name} triangle budget exceeded: ${shell.triangles}`);
        assert.ok(Math.max(...shell.colorRanges) >= 0.045, `${shell.name} material range too flat: ${shell.colorRanges}`);
        assert.ok(Math.max(...shell.colorRanges) <= 0.16, `${shell.name} material range too noisy: ${shell.colorRanges}`);
        assert.equal(shell.textures, 0, `${shell.name} unexpectedly allocated a texture`);
        assert.equal(shell.casters, false, `${shell.name} unexpectedly casts shadows`);
        assert.equal(shell.interactions, false, `${shell.name} unexpectedly became interactable`);
      }
      assert.ok(state.rendererTextures <= 12, `renderer texture budget exceeded: ${state.rendererTextures}`);
      assert.deepEqual(consoleProblems, []);
    },
  );

  await scenario(
    'bedroom environment details stay authored and bounded',
    { viewport: { width: 1000, height: 700 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.room?.scene);

      const state = await page.evaluate(() => {
        const host = window.__game['host'];
        const scene = host.room.scene;
        const root = scene.getObjectByName('room-environment-details');
        const clusters = [
          'room-story-board',
          'room-desk-drawers',
          'room-radiator',
          'room-coving',
        ].map((name) => root?.getObjectByName(name)?.name);
        const textures = new Map();
        let meshCount = 0;
        let instanceCount = 0;
        let triangles = 0;
        let lights = 0;
        let casters = 0;
        let interactions = 0;
        root?.traverse((object) => {
          if (object.isMesh) {
            meshCount++;
            const multiplier = object.isInstancedMesh ? object.count : 1;
            instanceCount += multiplier;
            const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
            triangles += Math.floor(primitives / 3) * multiplier;
            if (object.castShadow) casters++;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              if (material?.map) {
                textures.set(material.map.uuid, {
                  colorSpace: material.map.colorSpace,
                  width: material.map.image?.width,
                  height: material.map.image?.height,
                });
              }
            }
          }
          if (object.isLight) lights++;
          if (object.userData?.interact) interactions++;
        });
        const belongsToDetailRoot = (object) => {
          for (let cursor = object; cursor; cursor = cursor.parent) {
            if (cursor === root) return true;
          }
          return false;
        };
        return {
          rootName: root?.name,
          clusters,
          meshCount,
          instanceCount,
          triangles,
          textureMetadata: [...textures.values()],
          covingRails: root?.getObjectByName('room-coving')?.children.length,
          lights,
          casters,
          interactions,
          interactableMembers: host.room.interactables.filter(belongsToDetailRoot).length,
          shadowsEnabled: host.renderer.shadowMap.enabled,
        };
      });

      assert.equal(state.rootName, 'room-environment-details');
      assert.deepEqual(state.clusters, [
        'room-story-board',
        'room-desk-drawers',
        'room-radiator',
        'room-coving',
      ]);
      assert.ok(state.meshCount >= 10 && state.meshCount <= 18, `detail mesh budget exceeded: ${state.meshCount}`);
      assert.ok(state.instanceCount <= 32, `detail instance budget exceeded: ${state.instanceCount}`);
      assert.ok(state.triangles <= 1200, `detail triangle budget exceeded: ${state.triangles}`);
      assert.deepEqual(state.textureMetadata, [{ colorSpace: 'srgb', width: 256, height: 160 }]);
      assert.equal(state.covingRails, 4);
      assert.equal(state.lights, 0);
      assert.equal(state.casters, 0);
      assert.equal(state.interactions, 0);
      assert.equal(state.interactableMembers, 0);
      assert.equal(state.shadowsEnabled, false);
      assert.deepEqual(consoleProblems, []);
    },
  );

  await scenario(
    'bedroom hero furniture preserves gameplay contracts',
    { viewport: { width: 1000, height: 700 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.room?.scene);

      const state = await page.evaluate(() => {
        const host = window.__game['host'];
        const scene = host.room.scene;
        const chair = scene.getObjectByName('room-desk-chair');
        const bed = scene.getObjectByName('room-bed');
        const furnitureRoots = [chair, bed].filter(Boolean);
        const textures = new Set();
        let meshCount = 0;
        let instanceCount = 0;
        let triangles = 0;
        let lights = 0;
        let casters = 0;
        for (const root of furnitureRoots) {
          root.traverse((object) => {
            if (object.isMesh) {
              meshCount++;
              const multiplier = object.isInstancedMesh ? object.count : 1;
              instanceCount += multiplier;
              const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
              triangles += Math.floor(primitives / 3) * multiplier;
              if (object.castShadow) casters++;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              for (const material of materials) {
                if (material?.map) textures.add(material.map.uuid);
              }
            }
            if (object.isLight) lights++;
          });
        }
        const belongsTo = (object, root) => {
          for (let cursor = object; cursor; cursor = cursor.parent) {
            if (cursor === root) return true;
          }
          return false;
        };
        const collider = (min, max) => host.room.colliders.find((box) => (
          Math.abs(box.min.x - min[0]) < 1e-6
          && Math.abs(box.min.y - min[1]) < 1e-6
          && Math.abs(box.min.z - min[2]) < 1e-6
          && Math.abs(box.max.x - max[0]) < 1e-6
          && Math.abs(box.max.y - max[1]) < 1e-6
          && Math.abs(box.max.z - max[2]) < 1e-6
        ));
        const duvet = bed?.getObjectByName('room-bed-duvet');
        const duvetDepths = duvet?.geometry.attributes.position
          ? [...new Set(Array.from(duvet.geometry.attributes.position.array)
            .filter((_, index) => index % 3 === 2)
            .map((value) => Number(value.toFixed(4))))]
          : [];
        const chairChildren = [
          'room-chair-seat',
          'room-chair-back',
          'room-chair-base',
          'room-chair-seat-stitch',
          'room-chair-back-stitch',
          'room-chair-back-handle',
        ];
        const bedChildren = [
          'room-bed-frame',
          'room-bed-mattress',
          'room-bed-headboard',
          'room-bed-duvet',
          'room-bed-pillow',
          'room-bed-headboard-lip',
          'room-bed-pillow-seam',
          'room-bed-foot-throw',
        ];
        const detailNames = [
          'room-chair-seat-stitch',
          'room-chair-back-stitch',
          'room-chair-back-handle',
          'room-bed-headboard-lip',
          'room-bed-pillow-seam',
          'room-bed-foot-throw',
        ];
        const round = (value) => Number(value.toFixed(3));
        const instanceTransforms = (object) => {
          if (!object?.isInstancedMesh) return null;
          const values = Array.from(object.instanceMatrix.array);
          return Array.from({ length: object.count }, (_, index) => {
            const offset = index * 16;
            return {
              position: [values[offset + 12], values[offset + 13], values[offset + 14]].map(round),
              scale: [values[offset], values[offset + 5], values[offset + 10]].map(round),
            };
          });
        };
        const handle = chair?.getObjectByName('room-chair-back-handle');
        const frameBatch = bed?.getObjectByName('room-bed-frame')?.children.find((object) => object.isInstancedMesh);

        return {
          chairName: chair?.name,
          bedName: bed?.name,
          namedChildren: [
            ...chairChildren.map((name) => chair?.getObjectByName(name)?.name),
            ...bedChildren.map((name) => bed?.getObjectByName(name)?.name),
          ],
          detailStates: detailNames.map((name) => {
            const object = chair?.getObjectByName(name) ?? bed?.getObjectByName(name);
            return {
              name: object?.name,
              isMesh: object?.isMesh,
              position: object?.position.toArray().map(round),
              rotationY: object ? round(object.rotation.y) : null,
            };
          }),
          handleInstances: instanceTransforms(handle),
          frameInstances: instanceTransforms(frameBatch),
          chairInteraction: chair?.userData.interact?.type,
          chairInteractableMembers: chair
            ? host.room.interactables.filter((object) => belongsTo(object, chair)).length
            : 0,
          bedInteractableMembers: bed
            ? host.room.interactables.filter((object) => belongsTo(object, bed)).length
            : 0,
          meshCount,
          instanceCount,
          triangles,
          textures: textures.size,
          lights,
          casters,
          chairCollider: Boolean(collider([0.65, 0, -1.2], [1.15, 0.9, -0.7])),
          bedCollider: Boolean(collider([-2.475, 0, -1.45], [-1.425, 0.6, 0.65])),
          duvetVertexColors: duvet?.material.vertexColors,
          duvetHasColors: Boolean(duvet?.geometry.attributes.color),
          duvetDepthCount: duvetDepths.length,
        };
      });

      assert.equal(state.chairName, 'room-desk-chair');
      assert.equal(state.bedName, 'room-bed');
      assert.deepEqual(state.namedChildren, [
        'room-chair-seat',
        'room-chair-back',
        'room-chair-base',
        'room-chair-seat-stitch',
        'room-chair-back-stitch',
        'room-chair-back-handle',
        'room-bed-frame',
        'room-bed-mattress',
        'room-bed-headboard',
        'room-bed-duvet',
        'room-bed-pillow',
        'room-bed-headboard-lip',
        'room-bed-pillow-seam',
        'room-bed-foot-throw',
      ]);
      assert.deepEqual(state.detailStates, [
        { name: 'room-chair-seat-stitch', isMesh: true, position: [0, 0.507, -0.105], rotationY: 0 },
        { name: 'room-chair-back-stitch', isMesh: true, position: [0, 0.83, 0.235], rotationY: 0 },
        { name: 'room-chair-back-handle', isMesh: true, position: [0, 0.92, 0.24], rotationY: 0 },
        { name: 'room-bed-headboard-lip', isMesh: true, position: [0, 0.79, -1], rotationY: 0 },
        { name: 'room-bed-pillow-seam', isMesh: true, position: [0, 0.54, -0.52], rotationY: -0.08 },
        { name: 'room-bed-foot-throw', isMesh: true, position: [0, 0.505, 0.83], rotationY: 0 },
      ]);
      assert.deepEqual(state.handleInstances, [
        { position: [0, -0.33, -0.07], scale: [0.055, 0.34, 0.055] },
        { position: [0, 0, 0], scale: [0.18, 0.035, 0.018] },
      ]);
      assert.deepEqual(state.frameInstances, [
        { position: [-0.445, 0.22, 0], scale: [0.08, 0.24, 1.92] },
        { position: [0.445, 0.22, 0], scale: [0.08, 0.24, 1.92] },
        { position: [0, 0.22, -0.96], scale: [0.95, 0.24, 0.08] },
        { position: [0, 0.22, 0.96], scale: [0.95, 0.24, 0.08] },
        { position: [-0.41, 0.09, -0.92], scale: [0.08, 0.18, 0.08] },
        { position: [0.41, 0.09, -0.92], scale: [0.08, 0.18, 0.08] },
        { position: [-0.41, 0.09, 0.92], scale: [0.08, 0.18, 0.08] },
        { position: [0.41, 0.09, 0.92], scale: [0.08, 0.18, 0.08] },
      ]);
      assert.equal(state.chairInteraction, 'pc');
      assert.equal(state.chairInteractableMembers, 1);
      assert.equal(state.bedInteractableMembers, 0);
      assert.ok(state.meshCount >= 18 && state.meshCount <= 22, `furniture mesh budget exceeded: ${state.meshCount}`);
      assert.ok(state.instanceCount <= 36, `furniture instance budget exceeded: ${state.instanceCount}`);
      assert.ok(state.triangles <= 1500, `furniture triangle budget exceeded: ${state.triangles}`);
      assert.equal(state.textures, 0);
      assert.equal(state.lights, 0);
      assert.equal(state.casters, 0);
      assert.equal(state.chairCollider, true);
      assert.equal(state.bedCollider, true);
      assert.equal(state.duvetVertexColors, true);
      assert.equal(state.duvetHasColors, true);
      assert.ok(state.duvetDepthCount >= 3, `duvet is not visibly sculpted: ${state.duvetDepthCount} depths`);
      assert.deepEqual(consoleProblems, []);
    },
  );

  await scenario(
    'night-specific household props stay authored, functional, and bounded',
    { viewport: { width: 1200, height: 800 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));

      const inspectNight = async (night, names) => {
        await gotoOk(page, { skipTitle: 1, night, seed: 313 });
        await page.waitForFunction(() => window.__game?.host?.room?.scene);
        return page.evaluate((rootNames) => {
          const host = window.__game.host;
          const roots = rootNames.map((name) => host.room.scene.getObjectByName(name));
          const textures = new Set();
          let meshes = 0;
          let drawCalls = 0;
          let triangles = 0;
          let lights = 0;
          let casters = 0;
          const forbiddenMaterials = [];
          for (const root of roots.filter(Boolean)) {
            root.traverse((object) => {
              if (object.isLight) lights++;
              if (!object.isMesh) return;
              meshes++;
              if (object.castShadow) casters++;
              const multiplier = object.isInstancedMesh ? object.count : 1;
              const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
              triangles += Math.floor(primitives / 3) * multiplier;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              drawCalls += materials.length;
              for (const material of materials) {
                if (material?.map) textures.add(material.map.uuid);
                if (material?.isMeshStandardMaterial || material?.isMeshPhysicalMaterial) {
                  forbiddenMaterials.push(material.type);
                }
              }
            });
          }
          host.renderer.render(host.room.scene, host.camera);
          return {
            names: roots.map((root) => root?.name),
            namedCounts: rootNames.map((name) => {
              let count = 0;
              host.room.scene.traverse((object) => { if (object.name === name) count++; });
              return count;
            }),
            positions: roots.map((root) => root?.position.toArray()),
            contracts: roots.map((root) => root?.userData.interact),
            memberships: roots.map((root) => host.room.interactables.filter((item) => item === root).length),
            stablePresence: [
              'room-wall-phone',
              'room-duvet-tug-left',
              'room-duvet-tug-right',
              'room-curtain-tug-left',
              'room-curtain-tug-right',
            ].map((name) => Boolean(host.room.scene.getObjectByName(name))),
            meshes,
            drawCalls,
            triangles,
            textures: textures.size,
            lights,
            casters,
            forbiddenMaterials,
          };
        }, names);
      };

      const exerciseTugs = async (night, chore, targets) => {
        await gotoOk(page, { skipTitle: 1, night, t: 179, seed: 313 });
        await page.waitForFunction(() => window.__game?.host?.room?.scene);
        const settled = [];
        for (const target of targets) {
          await page.evaluate(({ stand, look }) => {
            const host = window.__game.host;
            host.player.pos.set(stand[0], 0, stand[1]);
            const dx = look[0] - stand[0];
            const dz = look[2] - stand[1];
            const dy = look[1] - 1.55;
            host.player.yaw = Math.atan2(-dx, -dz);
            host.player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
          }, target);
          await page.waitForFunction(
            ({ itemId, label }) => {
              const host = window.__game.host;
              const resolved = host.interact['resolveTarget'](host.camera).action?.interact;
              return host.interact.tracker.item(itemId)?.state === 'world'
                && resolved?.type === 'tug'
                && resolved.itemId === itemId
                && host.prompt?.actionable === true
                && host.prompt.label === label;
            },
            { itemId: target.itemId, label: target.label },
            { timeout: 5_000, polling: 'raf' },
          );
          const before = await page.evaluate((name) => {
            const root = window.__game.host.room.scene.getObjectByName(name);
            return { scaleY: root.scale.y, positionY: root.position.y };
          }, target.name);
          await page.keyboard.press('e');
          await page.waitForFunction(
            (itemId) => window.__game.host.interact.tracker.item(itemId)?.state === 'placed',
            target.itemId,
            { timeout: 5_000, polling: 'raf' },
          );
          const after = await page.evaluate((name) => {
            const root = window.__game.host.room.scene.getObjectByName(name);
            return { scaleY: root.scale.y, positionY: root.position.y };
          }, target.name);
          settled.push({ before, after });
        }
        return {
          settled,
          completed: await page.evaluate((id) => window.__game.host.interact.tracker.isCompleted(id), chore),
        };
      };

      const bedNames = ['room-duvet-tug-left', 'room-duvet-tug-right'];
      const curtainNames = ['room-curtain-tug-left', 'room-curtain-tug-right'];
      const tuesday = await inspectNight(1, bedNames);
      const wednesday = await inspectNight(2, ['room-wall-phone', ...bedNames]);
      const thursday = await inspectNight(3, curtainNames);

      assert.deepEqual(tuesday.names, bedNames);
      assert.deepEqual(tuesday.namedCounts, [1, 1]);
      assert.deepEqual(tuesday.stablePresence, [false, true, true, false, false]);
      assert.deepEqual(tuesday.positions, [[-1.68, 0.46, 0.42], [-2.22, 0.46, 0.32]]);
      assert.deepEqual(tuesday.contracts, [
        { type: 'tug', itemId: 'bed0', chore: 'wrappers', name: 'duvet corner', action: 'Tug the duvet straight' },
        { type: 'tug', itemId: 'bed1', chore: 'wrappers', name: 'duvet corner', action: 'Tug the duvet straight' },
      ]);
      assert.deepEqual(tuesday.memberships, [1, 1]);

      assert.deepEqual(wednesday.names, ['room-wall-phone', ...bedNames]);
      assert.deepEqual(wednesday.namedCounts, [1, 1, 1]);
      assert.deepEqual(wednesday.stablePresence, [true, true, true, false, false]);
      assert.deepEqual(wednesday.positions, [[0.35, 1.35, 1.97], [-1.68, 0.46, 0.42], [-2.22, 0.46, 0.32]]);
      assert.equal(wednesday.contracts[0], undefined);
      assert.equal(wednesday.memberships[0], 0);
      assert.deepEqual(wednesday.memberships.slice(1), [1, 1]);

      assert.deepEqual(thursday.names, curtainNames);
      assert.deepEqual(thursday.namedCounts, [1, 1]);
      assert.deepEqual(thursday.stablePresence, [false, false, false, true, true]);
      assert.deepEqual(thursday.positions, [[2.33, 1.35, -0.05], [2.33, 1.35, 0.85]]);
      assert.deepEqual(thursday.contracts, [
        { type: 'tug', itemId: 'curt0', chore: 'wrappers', name: 'curtain', action: 'Throw the curtains open' },
        { type: 'tug', itemId: 'curt1', chore: 'wrappers', name: 'curtain', action: 'Throw the curtains open' },
      ]);
      assert.deepEqual(thursday.memberships, [1, 1]);

      for (const state of [tuesday, wednesday, thursday]) {
        assert.ok(state.meshes <= 18, `night prop mesh budget exceeded: ${state.meshes}`);
        assert.ok(state.drawCalls <= 18, `night prop draw-call budget exceeded: ${state.drawCalls}`);
        assert.ok(state.triangles <= 1500, `night prop triangle budget exceeded: ${state.triangles}`);
        assert.equal(state.textures, 0);
        assert.equal(state.lights, 0);
        assert.equal(state.casters, 0);
        assert.deepEqual(state.forbiddenMaterials, []);
      }

      const bedExercise = await exerciseTugs(1, 'wrappers', [
        { name: 'room-duvet-tug-left', itemId: 'bed0', label: 'E — Tug the duvet straight', stand: [-0.9, 0.42], look: [-1.68, 0.46, 0.42] },
        { name: 'room-duvet-tug-right', itemId: 'bed1', label: 'E — Tug the duvet straight', stand: [-0.9, 0.62], look: [-2.22, 0.46, 0.32] },
      ]);
      const curtainExercise = await exerciseTugs(3, 'wrappers', [
        { name: 'room-curtain-tug-left', itemId: 'curt0', label: 'E — Throw the curtains open', stand: [1.35, -0.05], look: [2.33, 1.35, -0.05] },
        { name: 'room-curtain-tug-right', itemId: 'curt1', label: 'E — Throw the curtains open', stand: [1.35, 0.85], look: [2.33, 1.35, 0.85] },
      ]);
      for (const exercise of [bedExercise, curtainExercise]) {
        assert.equal(exercise.completed, true);
        for (const { before, after } of exercise.settled) {
          assert.equal(after.scaleY, before.scaleY * 0.25);
          assert.ok(Math.abs(after.positionY - (before.positionY - 0.02)) <= 1e-9);
        }
      }
      assert.deepEqual(consoleProblems, []);
    },
  );

  await scenario(
    'bedroom chore targets stay authored, functional, and bounded',
    { viewport: { width: 1200, height: 800 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.host?.room?.scene);

      const state = await page.evaluate(() => {
        const host = window.__game.host;
        const scene = host.room.scene;
        const roots = [
          scene.getObjectByName('room-chore-tray'),
          scene.getObjectByName('room-chore-bin'),
          scene.getObjectByName('room-chore-basket'),
        ];
        const childNames = [
          ['room-chore-tray-bed', 'room-chore-tray-inset', 'room-chore-tray-rim'],
          ['room-chore-bin-shell', 'room-chore-bin-interior', 'room-chore-bin-rim'],
          ['room-chore-basket-base', 'room-chore-basket-slats', 'room-chore-basket-rim'],
        ];
        const textures = new Set();
        let meshCount = 0;
        let instanceCount = 0;
        let triangles = 0;
        let lights = 0;
        let casters = 0;
        for (const root of roots.filter(Boolean)) {
          root.traverse((object) => {
            if (object.isMesh) {
              meshCount++;
              const multiplier = object.isInstancedMesh ? object.count : 1;
              instanceCount += multiplier;
              const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
              triangles += Math.floor(primitives / 3) * multiplier;
              if (object.castShadow) casters++;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              for (const material of materials) if (material?.map) textures.add(material.map.uuid);
            }
            if (object.isLight) lights++;
          });
        }
        const collider = (min, max) => host.room.colliders.some((box) => (
          Math.abs(box.min.x - min[0]) < 1e-6
          && Math.abs(box.min.y - min[1]) < 1e-6
          && Math.abs(box.min.z - min[2]) < 1e-6
          && Math.abs(box.max.x - max[0]) < 1e-6
          && Math.abs(box.max.y - max[1]) < 1e-6
          && Math.abs(box.max.z - max[2]) < 1e-6
        ));
        host.renderer.render(host.room.scene, host.camera);
        return {
          rootNames: roots.map((root) => root?.name),
          positions: roots.map((root) => root?.position.toArray()),
          childNames: roots.map((root, index) => childNames[index].map((name) => root?.getObjectByName(name)?.name)),
          targetContracts: roots.map((root) => root?.userData.interact),
          interactableMembership: roots.map((root) => host.room.interactables.filter((item) => item === root).length),
          instanceCounts: [
            roots[0]?.getObjectByName('room-chore-tray-rim')?.count,
            roots[2]?.getObjectByName('room-chore-basket-slats')?.count,
            roots[2]?.getObjectByName('room-chore-basket-rim')?.count,
          ],
          instancePaletteSizes: [
            roots[0]?.getObjectByName('room-chore-tray-rim'),
            roots[2]?.getObjectByName('room-chore-basket-slats'),
            roots[2]?.getObjectByName('room-chore-basket-rim'),
          ].map((batch) => {
            if (!batch?.instanceColor) return 0;
            const color = batch.material.color.clone();
            const palette = new Set();
            for (let index = 0; index < batch.count; index++) {
              batch.getColorAt(index, color);
              palette.add(color.getHexString());
            }
            return palette.size;
          }),
          instanceBounds: [
            roots[0]?.getObjectByName('room-chore-tray-rim'),
            roots[2]?.getObjectByName('room-chore-basket-slats'),
            roots[2]?.getObjectByName('room-chore-basket-rim'),
          ].map((batch) => {
            batch?.computeBoundingBox();
            if (!batch?.boundingBox || !batch.boundingSphere) return null;
            const expected = batch.boundingBox.getBoundingSphere(batch.boundingSphere.clone());
            return {
              centerDelta: batch.boundingSphere.center.distanceTo(expected.center),
              radiusDelta: Math.abs(batch.boundingSphere.radius - expected.radius),
              radius: batch.boundingSphere.radius,
            };
          }),
          binMouthBatch: (() => {
            const mouth = roots[1]?.getObjectByName('room-chore-bin-mouth');
            return {
              name: mouth?.name,
              vertexColors: mouth?.material?.vertexColors,
              hasColors: Boolean(mouth?.geometry?.attributes?.color),
            };
          })(),
          meshCount,
          instanceCount,
          triangles,
          textures: textures.size,
          lights,
          casters,
          binCollider: collider([1.77, 0, -1.28], [2.13, 0.4, -0.92]),
          basketCollider: collider([-2.15, 0, 1.25], [-1.55, 0.4, 1.85]),
          slots: Object.fromEntries(Object.entries(host.room.slots).map(([key, values]) => (
            [key, values.map((value) => value.toArray())]
          ))),
          roomCalls: host.renderer.info.render.calls,
          rendererTextures: host.renderer.info.memory.textures,
        };
      });

      assert.deepEqual(state.rootNames, ['room-chore-tray', 'room-chore-bin', 'room-chore-basket']);
      assert.deepEqual(state.positions, [[0.05, 0, 1.72], [1.95, 0, -1.1], [-1.85, 0, 1.55]]);
      assert.deepEqual(state.childNames, [
        ['room-chore-tray-bed', 'room-chore-tray-inset', 'room-chore-tray-rim'],
        ['room-chore-bin-shell', 'room-chore-bin-interior', 'room-chore-bin-rim'],
        ['room-chore-basket-base', 'room-chore-basket-slats', 'room-chore-basket-rim'],
      ]);
      assert.deepEqual(state.targetContracts, [
        { type: 'target', target: 'tray', accepts: 'mugs', name: 'tray' },
        { type: 'target', target: 'bin', accepts: 'wrappers', name: 'bin' },
        { type: 'target', target: 'basket', accepts: 'laundry', name: 'laundry basket' },
      ]);
      assert.deepEqual(state.interactableMembership, [1, 1, 1]);
      assert.deepEqual(state.instanceCounts, [4, 12, 4]);
      assert.deepEqual(state.instancePaletteSizes, [3, 3, 3]);
      for (const bounds of state.instanceBounds) {
        assert.ok(bounds && bounds.centerDelta <= 1e-9 && bounds.radiusDelta <= 1e-9, `instance bounds drifted: ${JSON.stringify(state.instanceBounds)}`);
      }
      assert.ok(state.instanceBounds[2].radius <= 0.4, `basket rim culling bounds are inflated: ${state.instanceBounds[2].radius}`);
      assert.deepEqual(state.binMouthBatch, {
        name: 'room-chore-bin-mouth',
        vertexColors: true,
        hasColors: true,
      });
      assert.equal(state.meshCount, 8);
      assert.ok(state.instanceCount <= 25, `target instance budget exceeded: ${state.instanceCount}`);
      assert.ok(state.triangles <= 500, `target triangle budget exceeded: ${state.triangles}`);
      assert.equal(state.textures, 0);
      assert.equal(state.lights, 0);
      assert.equal(state.casters, 0);
      assert.equal(state.binCollider, true);
      assert.equal(state.basketCollider, true);
      assert.deepEqual(state.slots, {
        tray: [[-0.13, 0.035, 1.72], [0.05, 0.035, 1.72], [0.23, 0.035, 1.72]],
        bin: [[1.95, 0.1, -1.1], [1.93, 0.16, -1.12], [1.97, 0.22, -1.08], [1.95, 0.28, -1.1]],
        basket: [[-1.85, 0.08, 1.55], [-1.83, 0.16, 1.53], [-1.87, 0.24, 1.57]],
      });
      assert.ok(state.roomCalls <= 128, `room draw-call budget exceeded: ${state.roomCalls}`);
      assert.ok(state.rendererTextures <= 12, `room texture budget exceeded: ${state.rendererTextures}`);
      assert.deepEqual(consoleProblems, []);
    },
  );

  await scenario(
    'bedroom rug stays authored, inert, and bounded',
    { viewport: { width: 1000, height: 700 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.room?.scene);

      const state = await page.evaluate(() => {
        const host = window.__game['host'];
        const root = host.room.scene.getObjectByName('room-rug');
        const surface = root?.getObjectByName('room-rug-surface');
        const braid = root?.getObjectByName('room-rug-braid');
        const textures = new Map();
        let meshCount = 0;
        let triangles = 0;
        let lights = 0;
        let casters = 0;
        let interactions = 0;
        root?.traverse((object) => {
          if (object.isMesh) {
            meshCount++;
            const multiplier = object.isInstancedMesh ? object.count : 1;
            const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
            triangles += Math.floor(primitives / 3) * multiplier;
            if (object.castShadow) casters++;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              if (material?.map) {
                textures.set(material.map.uuid, {
                  colorSpace: material.map.colorSpace,
                  width: material.map.image?.width,
                  height: material.map.image?.height,
                });
              }
            }
          }
          if (object.isLight) lights++;
          if (object.userData?.interact) interactions++;
        });
        const belongsToRoot = (object) => {
          for (let cursor = object; cursor; cursor = cursor.parent) {
            if (cursor === root) return true;
          }
          return false;
        };
        const relief = surface?.geometry.attributes.position
          ? [...new Set(Array.from(surface.geometry.attributes.position.array)
            .filter((_, index) => index % 3 === 2)
            .map((value) => Number(value.toFixed(4))))]
          : [];
        braid?.geometry.computeBoundingBox();
        const braidBounds = braid?.geometry.boundingBox;
        host.renderer.render(host.room.scene, host.camera);
        return {
          rootName: root?.name,
          children: [
            root?.getObjectByName('room-rug-surface')?.name,
            root?.getObjectByName('room-rug-braid')?.name,
          ],
          position: root ? root.position.toArray() : null,
          meshCount,
          triangles,
          textures: [...textures.values()],
          surfaceHasUvs: Boolean(surface?.geometry.attributes.uv),
          relief,
          braidVertexColors: braid?.material.vertexColors,
          braidThickness: braidBounds ? braidBounds.max.z - braidBounds.min.z : null,
          braidFloorClearance: braidBounds ? braid.position.y + braidBounds.min.z : null,
          lights,
          casters,
          interactions,
          interactableMembers: root ? host.room.interactables.filter(belongsToRoot).length : 0,
          shadowsEnabled: host.renderer.shadowMap.enabled,
          roomCalls: host.renderer.info.render.calls,
          rendererTextures: host.renderer.info.memory.textures,
        };
      });

      assert.equal(state.rootName, 'room-rug');
      assert.deepEqual(state.children, ['room-rug-surface', 'room-rug-braid']);
      assert.deepEqual(state.position, [0.1, 0, 0.4]);
      assert.equal(state.meshCount, 2);
      assert.ok(state.triangles <= 500, `rug triangle budget exceeded: ${state.triangles}`);
      assert.deepEqual(state.textures, [{ colorSpace: 'srgb', width: 256, height: 192 }]);
      assert.equal(state.surfaceHasUvs, true);
      assert.ok(state.relief.length >= 3, `rug surface is mathematically flat: ${state.relief}`);
      assert.ok(Math.max(...state.relief.map(Math.abs)) <= 0.003, `rug relief hides props: ${state.relief}`);
      assert.equal(state.braidVertexColors, true);
      assert.ok(state.braidThickness <= 0.04, `rug braid is overinflated: ${state.braidThickness}`);
      assert.ok(state.braidFloorClearance >= 0.003, `rug braid clips through floor: ${state.braidFloorClearance}`);
      assert.equal(state.lights, 0);
      assert.equal(state.casters, 0);
      assert.equal(state.interactions, 0);
      assert.equal(state.interactableMembers, 0);
      assert.equal(state.shadowsEnabled, false);
      assert.ok(state.roomCalls <= 128, `room draw-call budget exceeded: ${state.roomCalls}`);
      assert.ok(state.rendererTextures <= 12, `room texture budget exceeded: ${state.rendererTextures}`);
      assert.deepEqual(consoleProblems, []);
    },
  );

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
