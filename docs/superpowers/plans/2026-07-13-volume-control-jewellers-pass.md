# Volume Control Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-default gameplay volume slider with an authored, keyboard-safe period fader without changing audio or persistence behavior.

**Architecture:** Keep the existing native range input and `Game.buildVolumeControl()` ownership. Add a small display synchronizer for DOM state, style the existing control with standard range pseudo-elements, and pin the real-browser behavior in the isolated smoke suite.

**Tech Stack:** TypeScript, DOM APIs, CSS, Playwright-driven Node smoke checks, Vitest, Vite.

## Global Constraints

- Change no synth routing, gain curve, default volume `0.6`, slider step `0.05`, storage key `j5mm-volume`, pause lifecycle, overlay ownership, or report lifecycle.
- Add no mute button, tooltip, animation loop, timer, dependency, asset, audio sample, or global token family.
- Preserve the native `input[type="range"]`, explicit accessible name `Volume`, arrow-key behavior, pointer behavior, and privacy-restricted storage fallback.
- Keep the control available while paused and hidden plus inert on nightly and weekly reports.
- Keep the complete control inside the minimum supported 900 by 400 viewport.
- Do not modify unrelated HUD, toast, crosshair, interaction, or Mudwick surfaces.

---

### Task 1: Pin the authored fader contract

**Files:**
- Modify: `scripts/smoke.mjs:260`

**Interfaces:**
- Consumes: `#j5mm-volume-slider`, `.volume-control`, `window.__game.audio`, and local-storage key `j5mm-volume`.
- Produces: isolated browser scenario `volume control is an authored keyboard-safe fader`.

- [ ] **Step 1: Write the failing browser scenario**

Insert this scenario between the pointer-lock and dialogue-staging scenarios:

```js
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
      const initialState = await control.evaluate((element) => ({
          fill: element.style.getPropertyValue('--volume-level'),
          muted: element.dataset.muted,
          height: element.getBoundingClientRect().height,
      }));
      assert.deepEqual(
        { fill: initialState.fill, muted: initialState.muted },
        { fill: '60%', muted: 'false' },
      );
      assert.ok(initialState.height >= 32, `volume pointer target was ${initialState.height}px high`);
      assert.equal(await slider.evaluate((element) => getComputedStyle(element).appearance), 'none');

      await slider.focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await slider.inputValue(), '0.65');
      assert.equal(await level.textContent(), '65%');
      assert.equal(await page.evaluate(() => localStorage.getItem('j5mm-volume')), '0.65');
      assert.equal(await page.evaluate(() => window.__game.audio.getVolume()), 0.65);
      assert.deepEqual(
        await slider.evaluate((element) => {
          const style = getComputedStyle(element);
          return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor };
        }),
        { width: '2px', style: 'solid', color: 'rgb(232, 195, 63)' },
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
        })),
        { fill: '0%', muted: 'true' },
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
```

- [ ] **Step 2: Build the current tree and run the isolated browser suite to verify RED**

Run:

```powershell
$node='C:\Users\aggis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node .\node_modules\vite\bin\vite.js build
$env:SMOKE_URL='http://127.0.0.1:4173/'
& $node .\scripts\smoke.mjs
```

Use the managed preview helper instead if port 4173 is not already serving the built `dist/`.

Expected: FAIL in `volume control is an authored keyboard-safe fader` because `.volume-control-level` and the authored display state do not exist.

- [ ] **Step 3: Commit the red contract**

```powershell
git add scripts/smoke.mjs
git commit -m "test: pin the authored volume fader contract"
```

---

### Task 2: Compose and style the native fader

**Files:**
- Modify: `src/game.ts:530-566`
- Modify: `src/ui/style.css:2266-2288`

**Interfaces:**
- Consumes: `SynthAudio.getVolume(): number`, `SynthAudio.setVolume(v: number): void`, storage key `j5mm-volume`, and `setVolumeControlVisible(visible: boolean)`.
- Produces: `.volume-control-meta`, `.volume-control-level`, wrapper `--volume-level`, and wrapper `data-muted` state.

- [ ] **Step 1: Add the level DOM and one display synchronizer**

Change `buildVolumeControl()` so its construction and synchronization follow this exact shape:

```ts
    const meta = document.createElement('span');
    meta.className = 'volume-control-meta';
    const label = document.createElement('label');
    label.textContent = 'AUDIO';
    const level = document.createElement('output');
    level.className = 'volume-control-level';
    level.setAttribute('aria-hidden', 'true');
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'j5mm-volume-slider';
    slider.setAttribute('aria-label', 'Volume');
    label.htmlFor = slider.id;
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    meta.append(label, level);

    const syncDisplay = (value: number): void => {
      const percentage = Math.round(value * 100);
      slider.value = String(value);
      wrap.style.setProperty('--volume-level', `${percentage}%`);
      wrap.dataset.muted = String(percentage === 0);
      level.value = percentage === 0 ? 'OFF' : `${percentage}%`;
    };
```

After storage hydration, call `this.audio.setVolume(initial)` under the existing finite guard and then `syncDisplay(this.audio.getVolume())`. In the existing `input` handler, call `this.audio.setVolume(Number(slider.value))`, `syncDisplay(this.audio.getVolume())`, and persist `String(this.audio.getVolume())`. Append `meta` and `slider` to the wrapper.

- [ ] **Step 2: Replace the browser-default range treatment**

Replace the volume CSS block with:

```css
.volume-control {
  --volume-level: 60%;
  position: absolute;
  right: 16px;
  bottom: 14px;
  z-index: 35;
  box-sizing: border-box;
  width: 166px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: 1px solid #d8a85557;
  border-radius: 6px;
  background: linear-gradient(155deg, #1f1911f5, #0c0a07f5);
  box-shadow: 0 8px 22px #0000007a;
  font: 700 9px 'Segoe UI', system-ui, sans-serif;
}

.volume-control-meta {
  display: flex;
  flex: 0 0 38px;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.volume-control label {
  letter-spacing: 1.8px;
  color: #c7b889;
}

.volume-control-level {
  color: #e8c33f;
  font: 700 10px ui-monospace, monospace;
}

.volume-control input {
  appearance: none;
  width: 104px;
  height: 22px;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.volume-control input::-webkit-slider-runnable-track {
  height: 6px;
  border: 1px solid #d8a8554d;
  border-radius: 2px;
  background:
    repeating-linear-gradient(90deg, transparent 0 10px, #fff4d221 10px 11px),
    linear-gradient(90deg, #e8c33f 0 var(--volume-level), #211b12 var(--volume-level) 100%);
  box-shadow: inset 0 1px 2px #000000e6;
}

.volume-control input::-webkit-slider-thumb {
  appearance: none;
  width: 11px;
  height: 16px;
  margin-top: -6px;
  border: 1px solid #7a6225;
  border-radius: 2px;
  background: linear-gradient(180deg, #ffe078 0 24%, #d1a62d 25% 72%, #705719 73% 100%);
  box-shadow: 0 2px 4px #000000bf;
}

.volume-control input::-moz-range-track {
  height: 6px;
  border: 1px solid #d8a8554d;
  border-radius: 2px;
  background: #211b12;
  box-shadow: inset 0 1px 2px #000000e6;
}

.volume-control input::-moz-range-progress {
  height: 6px;
  border-radius: 1px;
  background: #e8c33f;
}

.volume-control input::-moz-range-thumb {
  width: 11px;
  height: 16px;
  border: 1px solid #7a6225;
  border-radius: 2px;
  background: linear-gradient(180deg, #ffe078 0 24%, #d1a62d 25% 72%, #705719 73% 100%);
  box-shadow: 0 2px 4px #000000bf;
}

.volume-control input:focus-visible {
  outline: 2px solid #e8c33f;
  outline-offset: 3px;
}

```

- [ ] **Step 3: Build and run the isolated browser suite to verify GREEN**

Run:

```powershell
$node='C:\Users\aggis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node .\node_modules\vite\bin\vite.js build
& $node .\scripts\run-browser-checks.mjs
```

Expected: the authored-fader scenario passes, the pause slider remains interactive, reports still hide the control, and full interaction E2E passes.

- [ ] **Step 4: Run unit and type checks**

```powershell
& $node .\node_modules\vitest\vitest.mjs run
& $node .\node_modules\typescript\bin\tsc --noEmit
```

Expected: 203 unit tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit the implementation**

```powershell
git add src/game.ts src/ui/style.css
git commit -m "feat: author the gameplay volume fader"
```

---

### Task 3: Reconcile the audit and close the release gate

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md:22,29,128`
- Create ignored proof captures under: `shots/`

**Interfaces:**
- Consumes: the completed fader DOM/CSS contract and existing `npm run verify` stages.
- Produces: current audit classification, production proof images, and final verification evidence.

- [ ] **Step 1: Reconcile the game-wide program record**

Change the HUD row to state that persistent controls are authored and guarded, change the audio/transitions row to record the confirmed and repaired browser-chrome seam, and remove the stale exact browser-scenario count from verification step 7. Do not claim live deployment.

- [ ] **Step 2: Capture and inspect the required production states**

Using the repository's Playwright workflow against a production build, capture:

```text
shots/volume-fader-desktop.png
shots/volume-fader-keyboard-focus.png
shots/volume-fader-muted.png
shots/volume-fader-paused.png
shots/volume-fader-short.png
```

Inspect all five at original resolution. Confirm hierarchy, calibration ticks, fill, fader-cap silhouette, `OFF` state, gold keyboard outline, pause operability, and 900 by 400 containment. If any state looks like generic media-player chrome or competes with the dinner clock, fix it under a new failing browser assertion before continuing.

- [ ] **Step 3: Run adversarial and independent review**

Use `/red-team` against the design and implementation. Independently verify every claimed issue with source or runtime evidence before changing code. Then use `superpowers:requesting-code-review` for one bounded review of the implementation range; fix only verified Critical or Important issues, test-first.

- [ ] **Step 4: Run the full local release gate**

Run with the bundled Node executable and direct local tools:

```powershell
$node='C:\Users\aggis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node .\node_modules\vitest\vitest.mjs run
& $node .\node_modules\typescript\bin\tsc --noEmit
& $node .\node_modules\vite\bin\vite.js build
& $node .\scripts\check-dist-size.mjs
& $node .\scripts\run-browser-checks.mjs
& $node .\node_modules\typescript\bin\tsc --noEmit
& $node .\node_modules\vite\bin\vite.js build --base /just-five-more-minutes/
```

Expected: 203 unit tests, typecheck, standalone build, JS/CSS gzip budgets, all isolated browser scenarios, full interaction E2E, final typecheck, and mounted-path build all pass.

- [ ] **Step 5: Commit the truth-surface reconciliation**

```powershell
git add docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md
git commit -m "docs: reconcile the volume fader audit"
```

- [ ] **Step 6: Finish the branch under the standing local-merge choice**

Use `superpowers:finishing-a-development-branch`, merge the feature branch into local `master`, rerun the full release gate on the merged tree, remove the linked worktree and feature branch, and append the required reflection. Do not push or deploy.
