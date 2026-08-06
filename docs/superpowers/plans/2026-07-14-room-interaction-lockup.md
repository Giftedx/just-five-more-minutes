# Room Interaction Lockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the room prompt and center reticle into an authored target-state lockup without changing interaction logic.

**Architecture:** Keep `Hud` as the single DOM owner for prompt and crosshair state. Add a browser smoke scenario that drives real room targets, then update `Hud.setInteractLabel()` and compact HUD CSS so actionable, passive, idle, Mum-prompt, PC-mode, and short-viewport states are pinned.

**Tech Stack:** TypeScript, DOM APIs, CSS, Playwright-driven Node smoke checks, Vitest, Vite.

## Global Constraints

- Change no raycast distance, interactable set, carried-item behavior, highlight material behavior, prompt text, key binding, pointer-lock behavior, PC-mode transition, Mum timing, or chore state.
- Add no dependency, image asset, SVG asset, animation loop, timer, world-space label, outline pass, or global design-token system.
- Preserve the existing `Hud.setInteractLabel(label, actionable)` API and keycap split for actionable `E` prompts.
- Keep `.hud-crosshair` decorative and hidden in PC mode.
- Keep the prompt inside 900 by 400 and clear of the bottom-right volume fader.
- Preserve CSS gzip budget.

---

### Task 1: Pin the room lockup contract

**Files:**
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `window.__game.host`, `host.player`, `host.camera`, `.hud-interact`, `.hud-crosshair`, `.hud-prompt`, and `.volume-control`.
- Produces: isolated browser scenario `room interaction lockup exposes authored target states`.

- [ ] **Step 1: Add the failing browser scenario**

Insert this scenario after `volume control is an authored keyboard-safe fader`:

```js
  await scenario(
    'room interaction lockup exposes authored target states',
    { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
    async (page) => {
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.mode === 'room');

      const aimAt = async (position, target) => {
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
        await page.waitForTimeout(100);
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

      await aimAt([0.28, 0, -0.8], [0.28, 0.82, -1.42]);
      state = await readLockup();
      assert.equal(state.promptDisplay, 'flex');
      assert.equal(state.promptText, 'EPick up mug');
      assert.equal(state.promptPassive, false);
      assert.equal(state.target, true);
      assert.equal(state.passive, false);
      assert.ok(state.crosshairWidth >= 17 && state.crosshairHeight >= 17, JSON.stringify(state));
      assert.match(state.borderColor, /232, 195, 63|255, 220, 120/);

      await aimAt([0.05, 0, 1.1], [0.05, 0.05, 1.72]);
      state = await readLockup();
      assert.equal(state.promptDisplay, 'flex');
      assert.match(state.promptText, /tray/);
      assert.equal(state.promptPassive, true);
      assert.equal(state.target, false);
      assert.equal(state.passive, true);

      await page.evaluate(() => window.__game['hud'].openPrompt(performance.now(), 4000));
      state = await readLockup();
      assert.equal(state.promptDisplay, 'none');
      assert.equal(state.target, false);
      assert.equal(state.passive, false);

      await page.evaluate(() => window.__game['hud'].closePrompt());
      await aimAt([0.9, 0, -0.9], [0.9, 0.99, -1.72]);
      await page.keyboard.press('KeyE');
      await page.waitForFunction(() => window.__game?.['host']?.mode === 'pc');
      state = await readLockup();
      assert.equal(state.promptDisplay, 'none');
      assert.equal(state.crosshairDisplay, 'none');

      await page.setViewportSize({ width: 900, height: 400 });
      await page.evaluate(() => window.__game['host'].exitPc());
      await aimAt([0.28, 0, -0.8], [0.28, 0.82, -1.42]);
      state = await readLockup();
      assert.equal(state.promptDisplay, 'flex');
      assert.ok(state.promptBounds.left >= 8 && state.promptBounds.top >= 8, JSON.stringify(state));
      assert.ok(state.promptBounds.right <= state.viewport.width - 8, JSON.stringify(state));
      assert.ok(state.promptBounds.bottom <= state.viewport.height - 8, JSON.stringify(state));
      assert.equal(state.faderOverlap, 0, JSON.stringify(state));
    },
  );
```

- [ ] **Step 2: Run the focused browser suite to verify RED**

Run:

```powershell
npm run build
npm run test:browser
```

Expected: FAIL in `room interaction lockup exposes authored target states` because `.hud-crosshair-target` and `.hud-crosshair-passive` are not set and the reticle is still 5 by 5.

- [ ] **Step 3: Commit the red contract**

```powershell
git add scripts/smoke.mjs
git commit -m "test: pin the authored room interaction lockup"
```

---

### Task 2: Author the HUD lockup

**Files:**
- Modify: `src/ui/hud.ts`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: `Hud.setInteractLabel(label: string | null, actionable?: boolean): void`.
- Produces: `.hud-crosshair-target`, `.hud-crosshair-passive`, `.hud-interact-passive`, and compact lockup CSS.

- [ ] **Step 1: Add a crosshair-state helper**

In `Hud`, add this private helper above `setInteractLabel()`:

```ts
  private setCrosshairState(state: 'idle' | 'target' | 'passive'): void {
    this.crosshairEl.classList.toggle('hud-crosshair-target', state === 'target');
    this.crosshairEl.classList.toggle('hud-crosshair-passive', state === 'passive');
  }
```

- [ ] **Step 2: Clear and set state from `setInteractLabel()`**

Change `setInteractLabel()` so the hidden path clears both prompt and crosshair state, and the visible path sets target state:

```ts
  setInteractLabel(label: string | null, actionable = true): void {
    // While the 1-4 prompt is up it owns that part of the screen; the
    // interact pill would overlap it (it's refreshed every frame, so it
    // reappears the moment the prompt closes).
    if (label === null || this.promptDeadline !== null) {
      this.interactEl.style.display = 'none';
      this.interactEl.classList.remove('hud-interact-passive');
      this.setCrosshairState('idle');
      return;
    }
    this.interactEl.style.display = 'flex';
    this.interactEl.classList.toggle('hud-interact-passive', !actionable);
    this.setCrosshairState(actionable ? 'target' : 'passive');
    // Actionable labels arrive as "E - do the thing": render the E as a keycap.
    const keyed = label.match(/^E [—-] (.*)$/);
    this.interactEl.innerHTML = '';
    if (keyed) {
      const key = document.createElement('span');
      key.className = 'hud-key';
      key.textContent = 'E';
      const text = document.createElement('span');
      text.textContent = keyed[1] ?? '';
      this.interactEl.append(key, text);
    } else {
      this.interactEl.textContent = label;
    }
  }
```

- [ ] **Step 3: Replace the prompt and reticle CSS**

Replace the existing `.hud-interact`, `.hud-interact-passive`, and `.hud-crosshair` block with compact authored styles:

```css
.hud-interact {
  position: absolute;
  bottom: 29%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: min(420px, calc(100vw - 32px));
  padding: 7px 14px;
  border: 1px solid #e8c33f66;
  border-radius: 7px;
  background: linear-gradient(150deg, #24190fd9, #0f0b08e6);
  color: #ffe9b0;
  font-size: 14px;
  font-weight: 700;
  box-shadow: 0 10px 24px #0009, inset 0 1px #fff2;
}

.hud-interact-passive {
  border-color: #fff2;
  color: #b8b0a0;
}

.hud-crosshair {
  position: absolute;
  top: 50%;
  left: 50%;
  box-sizing: border-box;
  width: 7px;
  height: 7px;
  margin: -3.5px;
  border: 1px solid #fff6;
  border-radius: 50%;
  background: #fff8e6d9;
  box-shadow: 0 0 4px #000d;
}

.hud-crosshair-target,
.hud-crosshair-passive {
  width: 19px;
  height: 19px;
  margin: -9.5px;
  border-radius: 3px;
  background:
    linear-gradient(#e8c33f, #e8c33f) 50% 0 / 7px 1px no-repeat,
    linear-gradient(#e8c33f, #e8c33f) 50% 100% / 7px 1px no-repeat,
    linear-gradient(#e8c33f, #e8c33f) 0 50% / 1px 7px no-repeat,
    linear-gradient(#e8c33f, #e8c33f) 100% 50% / 1px 7px no-repeat;
  border-color: #e8c33f;
  box-shadow: 0 0 0 1px #000b, 0 0 12px #e8c33f33;
}

.hud-crosshair-passive {
  filter: grayscale(0.9) brightness(0.82);
  opacity: 0.72;
}
```

- [ ] **Step 4: Run browser checks and size check**

Run:

```powershell
npm run build
npm run size:check
npm run test:browser
```

Expected: the lockup scenario passes, CSS gzip remains at or below 10240 bytes, all isolated scenarios and full interaction E2E pass.

- [ ] **Step 5: Commit the implementation**

```powershell
git add src/ui/hud.ts src/ui/style.css
git commit -m "feat: author the room interaction lockup"
```

---

### Task 3: Prove, review, merge, and close

**Files:**
- Create ignored proof captures under: `shots/`
- Modify only if evidence requires it: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`

**Interfaces:**
- Consumes: production build, browser smoke runner, full interaction E2E, and mounted-path build.
- Produces: inspected proof images, review notes, full verification evidence, local merge, and reflection.

- [ ] **Step 1: Capture production proof images**

Capture and inspect:

```text
shots/interaction-lockup-idle.png
shots/interaction-lockup-actionable.png
shots/interaction-lockup-passive.png
shots/interaction-lockup-mum-prompt.png
shots/interaction-lockup-pc-mode.png
shots/interaction-lockup-short.png
```

Use real room state and real targets. Do not fake the HUD on a standalone fixture.

- [ ] **Step 2: Run independent review**

Use `superpowers:requesting-code-review` for a bounded review of `scripts/smoke.mjs`, `src/ui/hud.ts`, and `src/ui/style.css`. Treat review findings as hypotheses and verify each before changing code.

- [ ] **Step 3: Run full verification**

Run:

```powershell
npm test
npm run typecheck
npm run build
npm run size:check
npm run test:browser
npm run typecheck
npm run build:hub
```

Expected: unit tests, typecheck, standalone build, JS/CSS gzip budgets, all isolated browser scenarios, full interaction E2E, final typecheck, and mounted-path build pass.

- [ ] **Step 4: Finish under the standing local-merge choice**

Use `superpowers:finishing-a-development-branch`, merge the feature branch into local `master`, rerun the full release gate on the merged tree, remove the linked worktree and feature branch, and append the required reflection. Do not push or deploy.
