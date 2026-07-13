# Report Opening Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make nightly and weekly reports open at their heading on short desktops while keeping focus inside the modal and the final action one Tab away.

**Architecture:** `showScorecard()` and `showWeekVerdict()` remain the only DOM constructors. Each visible report title becomes a programmatic focus target and receives focus after insertion with scroll prevention. The existing Playwright scorecard scenario owns both variants' initial reading-order and final-action reachability contract.

**Tech Stack:** TypeScript DOM APIs, CSS already present, Node assertions, Playwright, Vitest, Vite.

## Global Constraints

- Change no score calculation, career data, history, persistence, report copy, verdict matrix, restart behavior, animation timing, or visual geometry.
- Add no dependency, focus-trap library, timer, event listener, or persistent state.
- Preserve `role="dialog"`, `aria-modal="true"`, and the existing `aria-labelledby` values.
- Do not add CSS unless browser evidence proves the programmatically focused heading lacks an adequate visible treatment.
- Preserve standalone and `/just-five-more-minutes/` mounted builds.

---

### Task 1: Pin both broken opening states in the browser

**Files:**
- Modify: `scripts/smoke.mjs:812-877`

**Interfaces:**
- Consumes: `window.__game`, private runtime fields already used by the smoke suite, `.scorecard`, `.sc-title`, `.sc-restart`, `.sc-week`
- Produces: browser assertions for initial report focus/scroll and week-verdict rendering/reachability

- [ ] **Step 1: Extend the nightly report state assertion**

Add initial scroll and focus fields before the scenario manually changes scroll position:

```js
const state = await page.evaluate(() => {
  const scorecard = document.querySelector('.scorecard');
  const title = document.querySelector('.sc-title');
  const restart = document.querySelector('.sc-restart');
  return {
    initialScrollTop: scorecard.scrollTop,
    titleFocused: document.activeElement === title,
    restartFocused: document.activeElement === restart,
  };
});
assert.equal(state.initialScrollTop, 0, 'nightly report skipped its heading on open');
assert.equal(state.titleFocused, true, 'nightly report heading did not own initial focus');
assert.equal(state.restartFocused, false, 'nightly report opened on its final action');
```

- [ ] **Step 2: Add the live week-verdict branch after the nightly reachability checks**

Construct five complete reports through the live career object and invoke the shipped verdict path:

```js
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
```

- [ ] **Step 3: Pin the one-Tab action handoff**

```js
await page.keyboard.press('Tab');
const weekAction = page.locator('.scorecard.sc-week .sc-restart');
assert.equal(await weekAction.evaluate((button) => document.activeElement === button), true);
const actionBounds = await weekAction.evaluate((button) => {
  const rect = button.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, height: innerHeight };
});
assert.ok(actionBounds.top >= 0 && actionBounds.bottom <= actionBounds.height, JSON.stringify(actionBounds));
```

- [ ] **Step 4: Build the current source and run the browser gate to prove red**

Run: `npm run build && npm run test:browser`

Expected: FAIL in `scorecard is semantic, focused, and short-screen reachable`; current nightly `scrollTop` is non-zero and `restartFocused` is true.

- [ ] **Step 5: Commit the red browser contract**

```powershell
git add -- scripts/smoke.mjs
git commit -m "test: pin report opening reading order"
```

### Task 2: Focus the document heading instead of the final action

**Files:**
- Modify: `src/ui/scorecard.ts:45-87`
- Modify: `src/ui/scorecard.ts:108-154`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: existing `.sc-title` and `aria-labelledby` IDs
- Produces: heading-focused, top-positioned report dialogs with unchanged callbacks and Tab order

- [ ] **Step 1: Make each visible title a programmatic focus target**

Change the two title fragments only:

```html
<div class="sc-title" id="incident-report-title" tabindex="-1">HOUSEHOLD INCIDENT REPORT</div>
```

```html
<div class="sc-title" id="week-verdict-title" tabindex="-1">THE WEEK VERDICT</div>
```

- [ ] **Step 2: Focus each title after insertion**

In `showScorecard()`, preserve the action listener and replace action focus with:

```ts
const restartButton = el.querySelector<HTMLButtonElement>('.sc-restart');
restartButton?.addEventListener('click', () => onRestart());
el.querySelector<HTMLElement>('.sc-title')?.focus({ preventScroll: true });
```

In `showWeekVerdict()`, preserve the action listener and replace action focus with:

```ts
const button = el.querySelector<HTMLButtonElement>('.sc-restart');
button?.addEventListener('click', () => onNewWeek());
el.querySelector<HTMLElement>('.sc-title')?.focus({ preventScroll: true });
```

- [ ] **Step 3: Run the browser gate to prove green**

Run: `npm run build && npm run test:browser`

Expected: PASS for all 17 isolated browser scenarios and the full interaction E2E.

- [ ] **Step 4: Inspect the short nightly and weekly openings**

Capture both report variants at 900×400 after their entrance animation. Reject the candidate if the heading is clipped, the focused element is not visible, Tab does not reveal the full action, or the paper composition shifts.

- [ ] **Step 5: Commit the implementation**

```powershell
git add -- src/ui/scorecard.ts
git commit -m "fix: open reports at their heading"
```

### Task 3: Adversarial review and release closure

**Files:**
- Modify only if a verified finding requires it: `src/ui/scorecard.ts`, `scripts/smoke.mjs`, `src/ui/style.css`
- Preserve ignored proof captures: `shots/report-opening-nightly.png`, `shots/report-opening-week.png`

**Interfaces:**
- Consumes: final Task 1 and Task 2 commits
- Produces: merged, verified local `master`

- [ ] **Step 1: Red-team the finished behavior**

Check nightly versus weekly symmetry, initial focus visibility, Tab/Shift+Tab order, short-screen top and bottom reachability, reduced motion, modal labelling, callback activation, hidden volume control, and zero changes to score/career state.

- [ ] **Step 2: Verify every candidate finding before editing**

For each finding, grep the live line, check existing assertions, reproduce in Chromium, and reject anything not observable. Do not patch speculation.

- [ ] **Step 3: Request independent read-only review**

Review the implementation range against `docs/superpowers/specs/2026-07-13-report-opening-jewellers-design.md`. Fix Critical and Important findings only after independent verification.

- [ ] **Step 4: Run the complete branch gate**

Run: `npm run verify`

Expected: 203 or more unit tests pass; all 17 browser scenarios and full E2E pass; standalone and mounted builds succeed; JS and CSS remain under their enforced gzip budgets.

- [ ] **Step 5: Merge and reverify**

Fast-forward the feature branch into local `master`, run `npm run verify` again from `master`, preserve proof captures, remove the created worktree and feature branch, and confirm `git status --short --branch` is clean. Do not push or deploy.

