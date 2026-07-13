# Device Gate Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic unsupported-device sentence with a responsive, reason-specific equipment-check card that belongs to the game's visual world without changing device support or lifecycle ownership.

**Architecture:** Keep `deviceBlockReason()` and `installGate()` as the lifecycle boundary. Add a typed content record plus a pure DOM-composition helper in `gate.ts`, style that stable structure in the existing stylesheet, and extend the two existing browser gate scenarios to pin semantics, geometry, copy, and automatic recovery.

**Tech Stack:** TypeScript 7, CSS, Playwright 1.61 browser smoke, Vite 8, Vitest 4.

## Global Constraints

- Preserve pointer-first block precedence and the 900px viewport threshold.
- Construct no `Game`, `#room-canvas`, timer, RAF, or interactive control while blocked.
- Add no external asset, font, dependency, canvas, video, or animation loop.
- Keep one `role="alert"` gate with `data-reason="viewport"` or `data-reason="pointer"`.
- Keep the CSS illustration `aria-hidden="true"`; all practical guidance remains real text.
- Fit the complete card inside 800x600 and 360x640 with at least 16px outer clearance.
- The game must start automatically when the failing condition clears.

---

### Task 1: Pin the authored gate contract in the real browser

**Files:**
- Modify: `scripts/smoke.mjs:42-84`

**Interfaces:**
- Consumes: `.mobile-gate[data-reason]` created synchronously by `installGate()`.
- Produces: browser assertions for `.mobile-gate-card`, `.mobile-gate-eyebrow`, `.mobile-gate-title`, `.mobile-gate-copy`, `.mobile-gate-note`, and `.mobile-gate-visual`.

- [ ] **Step 1: Extend the viewport-gate scenario before production code**

After `.mobile-gate` becomes visible at 800x600, evaluate the gate and assert the exact authored contract:

```js
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
```

Retain the existing assertions that `window.__game` is absent and no room canvas exists, then retain the resize-to-1000 proof that the gate disappears and exactly one game starts.

- [ ] **Step 2: Extend the pointer-gate scenario**

In the existing touch context, assert:

```js
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
```

- [ ] **Step 3: Run the managed browser gate and verify RED**

Run: `npm run test:browser`

Expected: FAIL in `gate owns game lifecycle` because `.mobile-gate-card` and its authored children do not exist. The failure must occur before any production edit.

- [ ] **Step 4: Commit only after the implementation in Task 2 is green**

Do not commit a deliberately failing tree. Task 1's assertions ship in Task 2's coherent commit.

### Task 2: Build the reason-specific equipment-check card

**Files:**
- Modify: `src/ui/gate.ts:3-45`
- Modify: `src/ui/style.css:1822-1835`
- Modify: `scripts/smoke.mjs:42-84`

**Interfaces:**
- Consumes: `DeviceBlockReason = 'pointer' | 'viewport'` and the existing `installGate(parent, onChange)` callback contract.
- Produces: `GATE_CONTENT: Readonly<Record<DeviceBlockReason, GateContent>>` and `renderGate(gate, reason): void`.

- [ ] **Step 1: Add typed content and semantic DOM composition**

Replace `GATE_TEXT` with:

```ts
interface GateContent {
  eyebrow: string;
  title: string;
  copy: string;
}

const GATE_CONTENT: Readonly<Record<DeviceBlockReason, GateContent>> = {
  pointer: {
    eyebrow: 'EQUIPMENT CHECK · POINTER',
    title: 'Mouse and keyboard required.',
    copy: 'This one needs a keyboard, a mouse, and a chair you refuse to leave.',
  },
  viewport: {
    eyebrow: 'EQUIPMENT CHECK · WINDOW',
    title: 'Not enough desk space.',
    copy: 'Mudwick needs a little more desk space. Widen this window to at least 900 pixels.',
  },
};

const makeElement = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};
```

Add `renderGate(gate, reason)` that creates one `.mobile-gate-card`, header eyebrow and `FAILED` badge, an `aria-hidden="true"` `.mobile-gate-visual` containing CRT/frame/screen/status/goblin/stand nodes, and a copy region containing an `h1.mobile-gate-title`, `.mobile-gate-copy`, and `.mobile-gate-note`. Give the title `id="mobile-gate-title"` and the card `aria-labelledby="mobile-gate-title"`. Finish with `gate.replaceChildren(card)`.

Call `renderGate(gate, reason)` every time a non-null reason is installed. Preserve the existing one-gate creation, listeners, callback order, disposal, and null removal.

- [ ] **Step 2: Replace the generic gate CSS with the composed visual system**

Keep `.mobile-gate` fixed and centered, then implement these exact responsibilities:

```css
.mobile-gate {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 24px;
  background:
    radial-gradient(circle at 18% 22%, rgba(141, 73, 56, 0.18), transparent 32%),
    radial-gradient(circle at 82% 78%, rgba(72, 115, 47, 0.12), transparent 30%),
    #0e0b14;
  color: #efe6cf;
}

.mobile-gate-card {
  width: min(720px, 100%);
  display: grid;
  grid-template-columns: minmax(210px, 0.8fr) minmax(260px, 1.2fr);
  gap: 26px 34px;
  padding: 28px 30px 30px;
  border: 1px solid rgba(232, 195, 63, 0.46);
  border-radius: 18px;
  background: linear-gradient(145deg, rgba(32, 24, 17, 0.98), rgba(18, 14, 12, 0.98));
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.62), inset 0 1px rgba(255, 233, 176, 0.06);
}

.mobile-gate-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding-bottom: 14px;
  border-bottom: 1px solid rgba(232, 195, 63, 0.2);
}
```

Style the eyebrow/note in Courier New, the title/status in RuneScape, the instruction in Segoe UI, and the `FAILED` badge in rust/gold. Build the CRT from nested borders and static repeating-linear-gradient scanlines; make the goblin a green pixel block with pseudo-element eyes/ears, and make the stand from pseudo-elements. Use no animation declaration.

Add `@media (max-width: 640px)` to stack the card, reduce padding to 20px, center the CRT, and cap it at 190px. Add `@media (max-height: 520px)` to reduce vertical gaps, CRT size, and title/body scale so the complete card remains bounded.

- [ ] **Step 3: Run the browser smoke and verify GREEN**

Run: `npm run test:browser`

Expected: all 17 isolated scenarios and the full interaction E2E pass. Specifically, both gate scenarios pass with the exact copy and the 800x600 card bounds.

- [ ] **Step 4: Run focused static and unit gates**

Run: `npm test`

Expected: 16 files and 203 tests pass.

Run: `npm run build`

Expected: TypeScript and Vite succeed with no new external asset request.

- [ ] **Step 5: Commit the coherent implementation**

```powershell
git add scripts/smoke.mjs src/ui/gate.ts src/ui/style.css
git commit -m "feat: author the unsupported-device gate"
```

### Task 3: Visual calibration and release closeout

**Files:**
- Modify only when rendered evidence proves a scoped defect: `src/ui/style.css`, `scripts/smoke.mjs`

**Interfaces:**
- Consumes: the production build and the two blocked-device reasons.
- Produces: settled screenshots, adversarial review, full release evidence, and a clean merged tree.

- [ ] **Step 1: Capture the real 800x600 viewport state**

Build the standalone production bundle, serve it on a verified free loopback port, and use Playwright CLI to capture `output/playwright/device-gate-jewellers/viewport-800x600.png` from `?skipTitle=1&seed=1`.

Reject the candidate if the card clips, scrolls, resembles a generic SaaS error, visually implies a button, or hides the practical 900px instruction.

- [ ] **Step 2: Exercise the pointer state in Chromium**

Use a fresh Playwright context with `hasTouch: true` at 360x640. Assert `data-reason="pointer"`, capture the page, and confirm the stack fits with at least 16px clearance. Do not force `window.__game` or bypass the gate.

- [ ] **Step 3: Calibrate only observed CSS defects**

If a screenshot fails the design, first extend the browser assertion when the defect is mechanically expressible, observe RED, then change only gate CSS/markup and rerun the focused browser gate.

- [ ] **Step 4: Red-team lifecycle and symmetry**

Verify pointer and viewport copies are siblings, pointer precedence is unchanged, a same-reason resize does not duplicate DOM, supported resize removes the only alert and creates exactly one room canvas, disposal removes listeners/gate, no focusable control was introduced, reduced motion has no alternate requirement, and no asset/dependency/timer entered the diff.

- [ ] **Step 5: Run the complete release gate**

Run: `npm run verify`

Expected: 16 test files / 203 tests, standalone build, JS/CSS budgets, 17 isolated browser scenarios, full interaction E2E, and the mounted `/just-five-more-minutes/` build all pass.

- [ ] **Step 6: Record and validate the reflection**

Append one JSON line with exact keys `date`, `task`, `outcome`, `surprise`, and `next-time` to `C:\Users\aggis\.Codex\memory\reflections.jsonl` using `apply_patch`. Parse every non-empty line and assert the newest entry has the exact required key set.

- [ ] **Step 7: Integrate and clean up**

Fast-forward the verified isolated branch onto `master`, rerun `npm run verify` on merged `master`, remove the task-owned worktree and branch, close owned browser sessions, stop only owned preview processes, delete untracked browser artifacts after preserving one ignored proof image under `shots/`, and confirm a clean status. Do not push or deploy.

