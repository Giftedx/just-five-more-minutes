# Away Plan Onboarding Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the away plan once, on the first Monday stand-up of a career, with backward-compatible persistence and production-browser proof.

**Architecture:** Extend Career v1 in memory with a strictly validated tutorial block that defaults only when absent from a legacy save. In `Game` consume that flag on the existing PC-to-room callback, persist before presenting one neutral HUD toast, and guard the full lifecycle in a real 900×400 browser scenario.

**Tech Stack:** TypeScript 7, DOM/CSS, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.4

## Global Constraints

- Add no CSS, asset, dependency, font, animation, timer, overlay, input binding, route, query parameter, or standalone storage key.
- Preserve Career `version: 1` and `j5mm-career-v1`; migrate only the absent tutorial block.
- Preserve `Auto-pilot engaged. This is definitely allowed.` verbatim and keep the complete toast at 85 characters.
- Trigger only on Monday PC-to-room, never initial room setup or PC entry.
- Mark in memory before attempting storage so a storage exception cannot create same-session spam.
- Do not toggle any away-plan setting automatically; all four defaults remain off.
- Preserve every existing toast, subtitle, prompt, focus, pointer-lock, reduced-motion, and short-screen behavior.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes; CSS must remain byte-for-byte unchanged.
- Keep captures and temporary browser state out of commits; do not pull, push, or deploy.

---

## File responsibilities

- `src/score/career.ts` owns `CareerTutorials`, fresh defaults, legacy absent-field migration, and strict present-field validation.
- `src/score/career.test.ts` owns fresh, legacy, malformed, round-trip, night-fold, and week-reset tutorial truth.
- `src/game.ts` owns the authored tutorial contract and Monday PC-to-room one-shot behavior.
- `src/game.test.ts` pins the authored copy, duration, and neutral tone independently of browser pixels.
- `scripts/smoke.mjs` owns production-browser transition, persistence, repetition, accessibility, and 900×400 geometry proof.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` owns program-wide closure truth.
- `docs/superpowers/plans/2026-07-15-away-plan-onboarding-jewellers-pass.md` owns execution evidence.

### Task 1: Lock Career tutorial truth in failing tests

**Files:**
- Modify: `src/score/career.test.ts`

**Interfaces:**
- Consumes: existing `freshCareer()`, `loadCareer()`, `saveCareer()`, `recordNight()`, and `completeWeek()`.
- Produces: failing contracts for `career.tutorials.awayPlanSeen: boolean` and absent-field migration.

- [ ] **Step 1: Pin the fresh and round-trip defaults**

Extend the fresh-career test with:

```ts
expect(c.tutorials).toEqual({ awayPlanSeen: false });
```

In the save/load round-trip test, set and preserve the seen state:

```ts
c.tutorials.awayPlanSeen = true;
expect(saveCareer(storage, c)).toBe(true);
expect(loadCareer(storage)).toEqual(c);
```

- [ ] **Step 2: Add the legacy absent-field migration contract**

Add:

```ts
it('migrates a legacy v1 career with no tutorial block', () => {
  const legacy = freshCareer() as unknown as Record<string, unknown>;
  delete legacy.tutorials;
  const loaded = loadCareer(memoryStorage({ 'j5mm-career-v1': JSON.stringify(legacy) }));
  expect(loaded.tutorials).toEqual({ awayPlanSeen: false });
  expect(loaded.character.coins).toBe(0);
  expect(loaded.week.night).toBe(0);
});
```

- [ ] **Step 3: Add strict malformed-block coverage**

Add this case to the existing malformed-career table:

```ts
[
  'malformed tutorial flag',
  JSON.stringify({ ...freshCareer(), tutorials: { awayPlanSeen: 'yes' } }),
],
```

The expected result remains `freshCareer()`, proving that only absence migrates and malformed present data does not.

- [ ] **Step 4: Pin preservation across both career folds**

Add:

```ts
it('preserves tutorial progress across nights and completed weeks', () => {
  const seen = freshCareer();
  seen.tutorials.awayPlanSeen = true;
  const next = recordNight(seen, report(54), 4, 0);
  expect(next.tutorials.awayPlanSeen).toBe(true);
  expect(completeWeek(next, 'lostWeek', 54).tutorials.awayPlanSeen).toBe(true);
});
```

- [ ] **Step 5: Run the focused test to verify RED**

Run `npm test -- src/score/career.test.ts`.

Expected: FAIL because fresh and loaded careers have no `tutorials` block.

- [ ] **Step 6: Commit the red persistence contract**

Run `git diff --check`, then commit `src/score/career.test.ts` with `test: expose missing tutorial persistence`.

### Task 2: Implement backward-compatible Career v1 tutorial state

**Files:**
- Modify: `src/score/career.ts`
- Test: `src/score/career.test.ts`

**Interfaces:**
- Consumes: Task 1's failing contracts.
- Produces: `CareerTutorials`, `Career.tutorials`, and legacy-compatible parsing.

- [ ] **Step 1: Add the in-memory tutorial shape and fresh default**

Add:

```ts
export interface CareerTutorials {
  awayPlanSeen: boolean;
}

export interface Career {
  version: 1;
  character: CareerCharacter;
  week: CareerWeek;
  tutorials: CareerTutorials;
  gallery: string[];
  weeksCompleted: { endingId: string; total: number }[];
}
```

In `freshCareer()` add:

```ts
tutorials: { awayPlanSeen: false },
```

- [ ] **Step 2: Parse absence as legacy and presence strictly**

Add:

```ts
function parseTutorials(raw: unknown): CareerTutorials | undefined {
  if (raw === undefined) return { awayPlanSeen: false };
  if (typeof raw !== 'object' || raw === null) return undefined;
  const tutorials = raw as Record<string, unknown>;
  if (!isBoolean(tutorials.awayPlanSeen)) return undefined;
  return { awayPlanSeen: tutorials.awayPlanSeen };
}
```

In `parseCareer()`, parse the block and require it alongside character/week:

```ts
const tutorials = parseTutorials(record.tutorials);
if (!character || !week || !tutorials) return undefined;
```

Return `tutorials` in the fresh parsed object. Do not change the version or storage key.

- [ ] **Step 3: Run focused tests to verify GREEN**

Run `npm test -- src/score/career.test.ts`.

Expected: all career tests pass, including legacy migration, malformed-present rejection, and fold preservation.

- [ ] **Step 4: Fan out every Career producer and fixture**

Run:

```powershell
rg -n "version: 1|freshCareer\(|Career\b|j5mm-career-v1" src scripts --glob "*.ts" --glob "*.mjs"
```

Every handwritten Career fixture must either include `tutorials` or intentionally omit it to test legacy migration. Existing object spreads from a full Career need no edit. Use `npm run typecheck` to catch missed producers.

- [ ] **Step 5: Commit the compatible persistence seam**

Run `git diff --check`, then commit `src/score/career.ts` and any compiler-required fixture edits with `feat: persist tutorial progress`.

### Task 3: Lock the first-stand-up experience in failing tests

**Files:**
- Modify: `src/game.test.ts`
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `Career.tutorials.awayPlanSeen` from Task 2, the real chair interaction, `HostApp` mode callbacks, and existing HUD toast semantics.
- Produces: failing authored-copy and production-browser lifecycle contracts.

- [ ] **Step 1: Add the authored tutorial contract test**

In `src/game.test.ts`, import `AWAY_PLAN_TUTORIAL` from `./game` and add:

```ts
describe('away plan onboarding copy', () => {
  it('keeps the promised line, instruction, duration, and neutral tone together', () => {
    expect(AWAY_PLAN_TUTORIAL).toEqual({
      text: 'Auto-pilot engaged. This is definitely allowed. Set the CRT AWAY PLAN before leaving.',
      durationMs: 6500,
      tone: 'neutral',
    });
  });
});
```

- [ ] **Step 2: Add a reusable real-chair transition inside the browser scenario**

Add an isolated scenario named `Monday first stand-up teaches the away plan once` at `{ viewport: { width: 900, height: 400 }, reducedMotion: 'reduce' }`. Inside it define:

```js
const sitAtCrt = async () => {
  await page.evaluate(() => {
    const host = window.__game.host;
    const player = host.player;
    const position = [0.9, 0, -0.9];
    const target = [0.9, 0.99, -1.72];
    player.pos.set(...position);
    const dx = target[0] - position[0];
    const dy = target[1] - 1.55;
    const dz = target[2] - position[2];
    player.yaw = Math.atan2(-dx, -dz);
    player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    player.apply();
  });
  await page.waitForFunction(() => /Sit down/.test(window.__game?.host?.prompt?.label ?? ''));
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__game?.host?.mode === 'pc');
};
```

- [ ] **Step 3: Assert initial silence, first-show semantics, and geometry**

Navigate with `await gotoOk(page, { skipTitle: 1, night: 0, seed: 71 })`, wait for room mode, and require the toast to be hidden. Call `sitAtCrt()`, then create realistic competing lanes before standing:

```js
await page.evaluate(() => {
  const game = window.__game;
  const now = game.gameNow;
  game.hud.showSubtitle('Dinner is still getting colder.', now, 10_000);
  game.hud.openPrompt(now, 10_000);
  game.host.exitPc();
});
await page.locator('.hud-toast').waitFor({ state: 'visible' });
```

Read exact text, tone, live-region attributes, local storage, and rectangles. Use this helper for overlap:

```js
const overlapArea = (a, b) => (
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
  * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
);
```

Assert:

```js
assert.equal(state.text, 'Auto-pilot engaged. This is definitely allowed. Set the CRT AWAY PLAN before leaving.');
assert.equal(state.tone, 'neutral');
assert.deepEqual(state.live, { role: 'status', ariaLive: 'polite', ariaAtomic: 'true' });
assert.equal(state.seen, true);
assert.ok(state.toast.left >= 8 && state.toast.top >= 8, JSON.stringify(state));
assert.ok(state.toast.right <= 892 && state.toast.bottom <= 392, JSON.stringify(state));
assert.equal(overlapArea(state.toast, state.prompt), 0, JSON.stringify(state));
assert.equal(overlapArea(state.toast, state.subtitle), 0, JSON.stringify(state));
```

- [ ] **Step 4: Prove no second-show, reload-show, or Tuesday-show**

Expire the first toast without sleeping:

```js
await page.evaluate(() => {
  const game = window.__game;
  game.hud.update(game.gameNow + 7000);
  game.hud.closePrompt();
});
assert.equal(await page.locator('.hud-toast').evaluate((toast) => getComputedStyle(toast).display), 'none');
```

Call `window.__game.host.enterPc()` and `exitPc()` for a second transition and require the toast to stay hidden. Reload Monday, perform the same direct PC-to-room transition, and require it to stay hidden. Remove `j5mm-career-v1`, navigate to `{ skipTitle: 1, night: 1, seed: 72 }`, perform PC-to-room, and require it to stay hidden with `awayPlanSeen === false` in memory.

- [ ] **Step 5: Run tests and browser checks to verify RED**

Run `npm test -- src/game.test.ts`, `npm run build`, and `npm run test:browser`.

Expected: the unit test fails because `AWAY_PLAN_TUTORIAL` is absent; after the browser contract can build, it fails because no first-stand-up toast or persisted seen flag exists.

- [ ] **Step 6: Commit the red experience contract**

Run `git diff --check`, then commit `src/game.test.ts` and `scripts/smoke.mjs` with `test: expose missing away plan onboarding`.

### Task 4: Implement the Monday one-shot transition

**Files:**
- Modify: `src/game.ts`
- Test: `src/game.test.ts`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `Career.tutorials.awayPlanSeen`, `saveCareer()`, `HostApp.hooks.onModeChange`, and the existing neutral `Hud.showToast()` lane.
- Produces: exported `AWAY_PLAN_TUTORIAL` and the persisted Monday PC-to-room behavior.

- [ ] **Step 1: Define the authored contract once**

Near the existing authored copy constants in `src/game.ts`, add:

```ts
export const AWAY_PLAN_TUTORIAL = {
  text: 'Auto-pilot engaged. This is definitely allowed. Set the CRT AWAY PLAN before leaving.',
  durationMs: 6500,
  tone: 'neutral',
} as const;
```

- [ ] **Step 2: Consume and persist the flag on Monday stand-up**

Extend `this.host.hooks.onModeChange` after the existing crosshair/interact work:

```ts
if (mode === 'room' && this.night.night === 0 && !this.career.tutorials.awayPlanSeen) {
  this.career = {
    ...this.career,
    tutorials: { ...this.career.tutorials, awayPlanSeen: true },
  };
  try {
    saveCareer(localStorage, this.career);
  } catch {
    // Persistence is optional; the in-memory flag still prevents session spam.
  }
  this.hud.showToast(
    AWAY_PLAN_TUTORIAL.text,
    this.gameNow,
    AWAY_PLAN_TUTORIAL.durationMs,
    AWAY_PLAN_TUTORIAL.tone,
  );
}
```

Keep `this.syncPauseOverlay()` in the callback and do not alter `HostApp.enterPc()` or `HostApp.exitPc()`.

- [ ] **Step 3: Run focused and browser tests to verify GREEN**

Run `npm test -- src/score/career.test.ts src/game.test.ts`, `npm run typecheck`, `npm run build`, `npm run size:check`, and `npm run test:browser`.

Expected: career and game unit tests pass; every isolated browser scenario and the full interaction E2E pass; CSS bytes are unchanged; the new scenario proves the exact first/second/reload/Tuesday lifecycle.

- [ ] **Step 4: Commit the player-facing behavior**

Run `git diff --check`, then commit `src/game.ts`, `src/game.test.ts`, and `scripts/smoke.mjs` with `feat: teach the away plan on first stand-up`.

### Task 5: Adversarial review, visual proof, and closure

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-away-plan-onboarding-jewellers-pass.md`

**Interfaces:**
- Consumes: the green compatible persistence and transition behavior.
- Produces: synchronized closure truth, ignored visual proof, and integrated-master verification.

- [ ] **Step 1: Capture and critique production frames**

Serve the standalone production build and capture the first Monday stand-up at 1440×900 and 900×400 under ignored `shots/`. Reject the result if it reads like an achievement, wraps awkwardly, exits the viewport, covers Mum's response/subtitle lanes, changes the away-plan switches, or appears in PC mode.

- [ ] **Step 2: Fan out and red-team the completed change**

Enumerate every Career producer/consumer/fixture and every HostApp mode transition. Review for old-save rejection, malformed-data acceptance, lost tutorial state during `recordNight()`/`completeWeek()`, same-session repeat after storage failure, initial-room false triggers, Tuesday false triggers, toast replacement hazards, CSS drift, and false-pass browser timing. Verify every candidate against source or a reproducing test before editing.

- [ ] **Step 3: Run the complete feature-worktree gate**

Run `npm run verify`.

Expected: all unit tests, standalone build, size checks, isolated browser scenarios, full interaction E2E, and mounted build pass.

- [ ] **Step 4: Record exact closure evidence**

Append exact unit-test counts, browser scenario count, bundle sizes, proof paths, and adversarial-review outcome to this plan. Add a concise closure section to `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`.

- [ ] **Step 5: Commit closure truth**

Run `git diff --check`, then commit the two documentation files with `docs: close away plan onboarding pass`.

- [ ] **Step 6: Integrate and verify master**

Fast-forward local `master`, run `npm run verify` again from the integrated tree, remove the feature worktree/branch, restore standalone `dist`, leave the verified Monday proof visible in the in-app browser, and confirm no current console/page errors.

Expected: master is clean apart from ignored proof artifacts; every plan checkbox is complete; no pull, push, or deployment occurs.

## Self-review

- Spec coverage: exact copy, duration, tone, Monday PC-to-room trigger, in-memory-before-storage ordering, legacy absent-field migration, malformed-present rejection, full-reset behavior, fold preservation, accessibility, short-screen geometry, no-repeat lifecycle, CSS immutability, browser proof, and both verification tiers each have an explicit step.
- Placeholder scan: no deferred implementation, unspecified validation, vague error handling, or unbounded follow-up remains.
- Type consistency: the plan consistently uses `CareerTutorials`, `Career.tutorials.awayPlanSeen`, `AWAY_PLAN_TUTORIAL`, `durationMs: 6500`, and tone `neutral`.

