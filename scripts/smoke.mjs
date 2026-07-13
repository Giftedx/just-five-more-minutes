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
        ];
        const bedChildren = [
          'room-bed-frame',
          'room-bed-mattress',
          'room-bed-headboard',
          'room-bed-duvet',
          'room-bed-pillow',
        ];

        return {
          chairName: chair?.name,
          bedName: bed?.name,
          namedChildren: [
            ...chairChildren.map((name) => chair?.getObjectByName(name)?.name),
            ...bedChildren.map((name) => bed?.getObjectByName(name)?.name),
          ],
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
        'room-bed-frame',
        'room-bed-mattress',
        'room-bed-headboard',
        'room-bed-duvet',
        'room-bed-pillow',
      ]);
      assert.equal(state.chairInteraction, 'pc');
      assert.equal(state.chairInteractableMembers, 1);
      assert.equal(state.bedInteractableMembers, 0);
      assert.ok(state.meshCount >= 12 && state.meshCount <= 18, `furniture mesh budget exceeded: ${state.meshCount}`);
      assert.ok(state.instanceCount <= 32, `furniture instance budget exceeded: ${state.instanceCount}`);
      assert.ok(state.triangles <= 1200, `furniture triangle budget exceeded: ${state.triangles}`);
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
