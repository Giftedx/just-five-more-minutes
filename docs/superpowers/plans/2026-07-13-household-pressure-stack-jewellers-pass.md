# Household Pressure Stack Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep all three chores and Mum's tier visible above the response prompt in the 900x400 maximum-pressure state while replacing the debug-like tier strip with an authored, accessible household ticket.

**Architecture:** `Hud` continues to receive the existing label and tier and owns one stable semantic ticket subtree. CSS preserves the desktop column and switches only the top-left task stack to a two-row grid at `max-height: 520px`; the browser smoke constructs the real Thursday inspection state and owns the geometry contract.

**Tech Stack:** TypeScript, DOM, CSS, Playwright, Vite, Vitest

## Global Constraints

- Add no dependency, asset, font, timer, event listener, persistent field, gameplay state, or new animation.
- Preserve objective copy, chore copy and order, tier labels, prompt and subtitle staging, clock, toast, volume, scoring, and persistence.
- Do not hide, summarize, truncate, or reorder active chores.
- Do not move the prompt or doorway subtitle.
- Do not expose raw suspicion numbers.
- Desktop layout above 520 pixels high remains a vertical task stack.
- Reduced motion must leave the final Mum tier static.

## File map

- `scripts/smoke.mjs` — real-browser maximum-pressure reproduction, semantics, responsive geometry, and reduced-motion guard.
- `src/ui/hud.ts` — stable Mum ticket DOM and label/tier updates.
- `src/ui/style.css` — Mum ticket visual treatment and short-height household tray.

---

### Task 1: Pin the maximum-pressure browser contract

**Files:**
- Modify: `scripts/smoke.mjs` after the existing `dialogue staging keeps Mum visible and controls separated` scenario
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `window.__game['mum'].suspicion`, the shipped Thursday inspection path, `.hud-task-stack`, `.hud-chores`, `.hud-chore`, `.hud-mum`, `.hud-prompt`, and `.hud-clock`.
- Produces: a browser contract for `role="status"`, `aria-live="polite"`, `aria-atomic="true"`, `aria-label="Mum: at the door"`, `.hud-mum-state`, four `.hud-mum-step` elements, short-height row layout, desktop column layout, viewport containment, clock clearance, and an 8-pixel prompt gap.

- [ ] **Step 1: Add the failing maximum-pressure scenario**

Add this scenario after the existing dialogue-staging scenario:

```js
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
        return {
          choreTexts: chores.map((chore) => chore.textContent),
          choreRects: chores.map(rect),
          tier: mum.dataset.tier,
          state: mum.querySelector('.hud-mum-state')?.textContent ?? '',
          steps: mum.querySelectorAll('.hud-mum-step').length,
          role: mum.getAttribute('role'),
          live: mum.getAttribute('aria-live'),
          atomic: mum.getAttribute('aria-atomic'),
          label: mum.getAttribute('aria-label'),
          animation: getComputedStyle(mum).animationName,
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
      assert.equal(pressure.taskDisplay, 'grid');
      assert.equal(pressure.choreDirection, 'row');
      assert.ok(pressure.taskRect.left >= 0 && pressure.taskRect.top >= 0, JSON.stringify(pressure));
      assert.ok(pressure.taskRect.right <= pressure.viewport.width, JSON.stringify(pressure));
      assert.ok(pressure.choreRects.every((value) => value.bottom <= pressure.viewport.height), JSON.stringify(pressure));
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
```

- [ ] **Step 2: Build and run the browser gate to prove the current defect**

Run:

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
npm.cmd run build
npm.cmd run test:browser
```

Expected: FAIL in `household pressure stack stays readable at maximum short-screen pressure`. The current Mum strip has no `.hud-mum-state`, no rail segments, no live-region attributes, and the prompt gap is negative because the vertical stack is covered.

- [ ] **Step 3: Commit the red browser contract**

```powershell
git add scripts/smoke.mjs
git commit -m "test: pin maximum household pressure layout"
```

---

### Task 2: Build the semantic Mum ticket and short-height household tray

**Files:**
- Modify: `src/ui/hud.ts:13-62,101-110`
- Modify: `src/ui/style.css:607-698,2250-2284`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `Hud.setMumStatus(label: string | null, tier = 0): void` and the existing four string labels/tier values from `MUM_TIER_LABELS`.
- Produces: one stable `.hud-mum-state` span, one `aria-hidden` `.hud-mum-rail` containing four `.hud-mum-step` spans, live-region semantics, `data-tier`, and the responsive grid/flex contract pinned by Task 1.

- [ ] **Step 1: Create the stable Mum ticket subtree once in the constructor**

Add a field beside `mumEl`:

```ts
  private mumStateEl: HTMLSpanElement;
```

Immediately after creating `this.mumEl`, create the ticket structure once:

```ts
    this.mumEl.setAttribute('role', 'status');
    this.mumEl.setAttribute('aria-live', 'polite');
    this.mumEl.setAttribute('aria-atomic', 'true');

    const mumLabelEl = document.createElement('span');
    mumLabelEl.className = 'hud-mum-label';
    mumLabelEl.textContent = 'MUM';
    this.mumStateEl = document.createElement('span');
    this.mumStateEl.className = 'hud-mum-state';
    const mumRailEl = document.createElement('span');
    mumRailEl.className = 'hud-mum-rail';
    mumRailEl.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 4; index++) {
      const step = document.createElement('span');
      step.className = 'hud-mum-step';
      mumRailEl.appendChild(step);
    }
    this.mumEl.append(mumLabelEl, this.mumStateEl, mumRailEl);
```

Keep `setMumStatus()` allocation-free during the game loop:

```ts
  setMumStatus(label: string | null, tier = 0): void {
    if (label === null) {
      this.mumEl.style.display = 'none';
      return;
    }
    this.mumEl.style.display = 'grid';
    this.mumStateEl.textContent = label.toUpperCase();
    this.mumEl.dataset['tier'] = String(tier);
    this.mumEl.setAttribute('aria-label', `Mum: ${label}`);
  }
```

- [ ] **Step 2: Replace the debug strip with the restrained household ticket**

Replace the current Mum status CSS with:

```css
.hud-mum {
  --mum-accent: #8e8067;
  min-width: 158px;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'label state'
    'rail rail';
  align-items: center;
  gap: 4px 10px;
  padding: 7px 10px 8px 12px;
  background: linear-gradient(170deg, rgba(239, 230, 207, 0.96), rgba(210, 194, 160, 0.94));
  border: 1px solid rgba(59, 37, 29, 0.48);
  border-left: 3px solid var(--mum-accent);
  color: #3b251d;
  box-shadow: 2px 5px 12px rgba(0, 0, 0, 0.38);
  transform: rotate(0.35deg);
}

.hud-mum-label {
  grid-area: label;
  font: 700 8.5px 'Courier New', monospace;
  letter-spacing: 0.18em;
}

.hud-mum-state {
  grid-area: state;
  justify-self: end;
  font: 700 10px 'Courier New', monospace;
  letter-spacing: 0.08em;
  white-space: nowrap;
}

.hud-mum-rail {
  grid-area: rail;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 3px;
}

.hud-mum-step {
  height: 3px;
  background: rgba(59, 37, 29, 0.18);
}

.hud-mum[data-tier='1'] { --mum-accent: #b8954a; }
.hud-mum[data-tier='2'] { --mum-accent: #d87844; }
.hud-mum[data-tier='3'] {
  --mum-accent: #c05030;
  animation: mumpulse 1.2s ease-in-out infinite;
}

.hud-mum[data-tier='0'] .hud-mum-step:nth-child(-n + 1),
.hud-mum[data-tier='1'] .hud-mum-step:nth-child(-n + 2),
.hud-mum[data-tier='2'] .hud-mum-step:nth-child(-n + 3),
.hud-mum[data-tier='3'] .hud-mum-step:nth-child(-n + 4) {
  background: var(--mum-accent);
}

@keyframes mumpulse {
  50% { box-shadow: 2px 5px 12px rgba(0, 0, 0, 0.38), 0 0 14px rgba(192, 80, 48, 0.35); }
}

@media (prefers-reduced-motion: reduce) {
  .hud-mum[data-tier='3'] { animation: none; }
}
```

- [ ] **Step 3: Recompose only the short-height task stack**

Add this media query after the chore-note rules:

```css
@media (max-height: 520px) {
  .hud-task-stack {
    right: 118px;
    display: grid;
    grid-template-columns: auto auto;
    grid-template-areas:
      'objective objective'
      'chores mum';
    align-items: start;
    width: max-content;
    max-width: calc(100vw - 154px);
    gap: 14px 10px;
  }

  .hud-objective { grid-area: objective; }

  .hud-chores {
    grid-area: chores;
    flex-direction: row;
    align-items: flex-start;
    gap: 6px;
  }

  .hud-chore {
    padding: 6px 9px 7px;
    font-size: 12px;
    transform: rotate(-1deg);
  }

  .hud-chore:nth-child(even) { transform: rotate(0.8deg); }

  .hud-mum {
    grid-area: mum;
    min-width: 148px;
    padding-block: 6px 7px;
    transform: none;
  }
}
```

- [ ] **Step 4: Build and run the browser gate**

Run:

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
npm.cmd run build
npm.cmd run test:browser
```

Expected: all isolated browser scenarios and the full interaction E2E pass. If the maximum-pressure scenario reports task/clock or task/prompt geometry below the required gap, adjust only the short-height row gaps and compact padding; do not shrink copy or move the prompt.

- [ ] **Step 5: Commit the implementation**

```powershell
git add src/ui/hud.ts src/ui/style.css
git commit -m "feat: compose the household pressure stack"
```

---

### Task 3: Visual rejection pass and complete verification

**Files:**
- Modify only if a reproduced visual defect requires a narrowly scoped correction: `src/ui/style.css`
- Test only if review exposes an unguarded acceptance contract: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: the production build from Task 2 and the two representative HUD states.
- Produces: approved 1280x720 desktop and 900x400 pressure-state captures, an independently reviewed diff, and complete repository verification.

- [ ] **Step 1: Capture representative production states**

Build the standalone artifact and capture:

- Thursday maximum pressure at 900x400 with all three chores, tier three, and the inspection prompt.
- The same task stack at 1280x720 without changing the desktop vertical composition.

Store dev proof under the ignored `shots/` directory. Reject the candidate if any note truncates, tape disappears, the task tray approaches the clock, the ticket resembles a generic health bar, the prompt/subtitle composition shifts, or the status ticket outranks the objective.

- [ ] **Step 2: Run adversarial review**

Review live source and Chromium evidence for:

- all four tier labels and rail progression;
- repeated per-frame updates without subtree rebuilding;
- live-region accuracy and decorative rail hiding;
- one, two, and three chore states;
- 900x400 prompt, clock, volume, and viewport clearance;
- desktop column restoration after resize;
- reduced-motion static tier three;
- no changes to director, scoring, persistence, or gameplay state.

Act only on findings reproduced in source or Chromium.

- [ ] **Step 3: Run the complete branch gate**

```powershell
$env:PATH = 'C:\Program Files\nodejs;' + $env:PATH
npm.cmd run verify
```

Expected: 203 unit tests pass; type/build passes; JavaScript and CSS remain inside their gzip budgets; all isolated Chromium scenarios and full interaction E2E pass; the mounted `/just-five-more-minutes/` build passes.

- [ ] **Step 4: Commit any verified review closure**

If review required a real fix, commit only the verified delta:

```powershell
git add scripts/smoke.mjs src/ui/hud.ts src/ui/style.css
git commit -m "fix: close household pressure review findings"
```

If review found no actionable defect, create no empty commit.
