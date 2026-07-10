# Integration and Fairness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing five-minute game fair, reactive, replayable, accessible, and browser-robust by integrating its shipped systems and closing verified UX/lifecycle gaps.

**Architecture:** Keep the pure MMO simulation and scoring layer authoritative, carry a richer session snapshot through `Game`, and render it through the existing HUD/scorecard. Add two focused pure helpers for seed/history behavior; keep browser lifecycle work inside the existing title/gate/host modules. Use one managed Playwright runner as the release-level integration gate.

**Tech Stack:** TypeScript 6, Vite 8, Vitest 4, Three.js 0.184, Canvas 2D, DOM/CSS, Playwright 1.60, Node.js scripts.

## Global Constraints

- Preserve the five-minute director schedule, physical chores, and room/PC split.
- Keep max stack and 99-all-stats as legendary goals; `SESSION_COIN_TARGET` is exactly `100`.
- Add no runtime dependency, external asset, backend, analytics, account, or cloud storage.
- Store only report count, best total, and previous total locally.
- Preserve the pre-existing dirty input work; never overwrite or revert it.
- Do not commit, stage, push, deploy, or open a PR during this implementation.
- All source edits use `apply_patch`; every task finishes with an explicit verification checkpoint.

## File Map

- `src/mmo/sim/osrs.ts`: achievable dinner-fund constant and progress labels.
- `src/mmo/sim/types.ts`, `src/mmo/sim/sim.ts`: contract-completion accounting.
- `src/score/score.ts`: rich session snapshot, integer MMO score, facts, endings.
- `src/score/history.ts`: validated local report summary persistence.
- `src/session.ts`: seed parse/create/format helpers.
- `src/game.ts`: session orchestration, seed/history wiring, pointer-lock state, cross-world feedback.
- `src/ui/hud.ts`, `src/ui/scorecard.ts`, `src/ui/title.ts`, `src/ui/gate.ts`, `src/ui/style.css`: presentation, accessibility, reduced motion, gate/onboarding lifecycle.
- `src/host/room.ts`, `src/host/app.ts`, `src/mmo/render/game.ts`: forgiving interactions, render cadence, GPU cleanup.
- `src/main.ts`, `index.html`: supported-device boot and page metadata.
- `scripts/smoke.mjs`, `scripts/e2e-full.mjs`, `scripts/run-browser-checks.mjs`, `scripts/check-dist-size.mjs`: deterministic browser/build gates.
- `.github/workflows/ci.yml`, `package.json`, `README.md`: truth surfaces and CI entrypoints.

---

### Task 1: Account for the MMO systems and rebalance five-minute scoring

**Files:**
- Modify: `src/mmo/sim/osrs.ts`
- Modify: `src/mmo/sim/types.ts`
- Modify: `src/mmo/sim/sim.ts`
- Modify: `src/mmo/sim/osrs.test.ts`
- Modify: `src/mmo/sim/sim.test.ts`
- Modify: `src/score/score.ts`
- Modify: `src/score/score.test.ts`

**Interfaces:**
- Produces: `SESSION_COIN_TARGET: 100`, `SimStats.contractsCompleted: number`, expanded `SessionData`, integer `scoreMmoProgress(data): number`.
- Consumes: existing `Skills`, `levelOf`, `MAX_COINS`, `objectiveHit`, and `statsBonusHit` semantics unchanged.

- [ ] **Step 1: Write failing sim and score tests**

Add exact assertions for contract accounting and the new score components:

```ts
it('counts each claimed Wyn contract exactly once', () => {
  const sim = new MudwickSim(7);
  sim.quest = { kind: 'logs', target: 1, progress: 1, reward: 22, claimed: false };
  expect(sim.turnInQuest()).toBe(true);
  expect(sim.stats.contractsCompleted).toBe(1);
  expect(sim.turnInQuest()).toBe(false);
  expect(sim.stats.contractsCompleted).toBe(1);
});

it('scores reachable economy, training, contracts, and streaks', () => {
  const data = base({
    coins: 100,
    skills: { woodcutting: xpForLevel(4), attack: xpForLevel(3), foraging: xpForLevel(2) },
    contractsCompleted: 2,
    bestStreak: 4,
  });
  expect(scoreMmoProgress(data)).toBe(38);
});

it('reserves the final two MMO points for legendary goals', () => {
  const ordinary = base({
    coins: 100,
    skills: { woodcutting: xpForLevel(4), attack: xpForLevel(3), foraging: xpForLevel(2) },
    contractsCompleted: 2,
    bestStreak: 4,
  });
  expect(scoreMmoProgress({ ...ordinary, objectiveHit: true, statsBonusHit: true })).toBe(40);
});
```

Expand `base()` with exact defaults:

```ts
kills: 0,
logsSold: 0,
flaxSold: 0,
bestStreak: 0,
contractsCompleted: 0,
skills: { woodcutting: 0, attack: 0, foraging: 0 },
```

- [ ] **Step 2: Run the narrow tests and confirm red**

Run: `npx vitest run src/mmo/sim/osrs.test.ts src/mmo/sim/sim.test.ts src/score/score.test.ts`

Expected: TypeScript/test failures for missing `SESSION_COIN_TARGET`, `contractsCompleted`, and expanded `SessionData` fields.

- [ ] **Step 3: Add the achievable target and contract accounting**

In `osrs.ts` add:

```ts
export const SESSION_COIN_TARGET = 100;
```

Keep `COIN_OBJECTIVE = MAX_COINS`. Update `objectiveProgressLabel()` to lead with `SESSION_COIN_TARGET` while retaining max-stack copy after the session target is met.

In `SimStats` and its constructor add:

```ts
contractsCompleted: number;
// constructor value
contractsCompleted: 0,
```

In `turnInQuest()`, immediately after marking the quest claimed:

```ts
this.stats.contractsCompleted++;
```

- [ ] **Step 4: Implement the integer MMO score and reachable ending branches**

Expand `SessionData` with:

```ts
kills: number;
logsSold: number;
flaxSold: number;
bestStreak: number;
contractsCompleted: number;
skills: Skills;
```

Replace `scoreMmoProgress()` with this exact composition:

```ts
export function scoreMmoProgress(data: SessionData): number {
  const economy = Math.round(20 * clamp(data.coins / SESSION_COIN_TARGET, 0, 1));
  const levelsGained = SKILL_NAMES.reduce(
    (sum, skill) => sum + Math.max(0, levelOf(data.skills[skill]) - 1),
    0,
  );
  const training = Math.min(6, levelsGained);
  const contracts = Math.min(8, data.contractsCompleted * 4);
  const streak = Math.min(4, data.bestStreak);
  const legendary = Number(data.objectiveHit) + Number(data.statsBonusHit);
  return clamp(economy + training + contracts + streak + legendary - 5 * data.deaths, 0, 40);
}
```

Update `endingTitle()` priority to: both legendary flags; stats 99; max stack plus all chores; max stack; dinner fund plus all chores; two contracts; dinner fund; all chores; four kills; default. Use exact new titles `Max Stack and Matching Socks`, `The Economy Actually Needed You`, `Functional Adult (Suspicious)`, `Wyn's Employee of the Minute`, `The Economy Needed You`, and `Goblin Performance Reviewer` for those new branches.

Add a `contractor` comedy fact at two completed contracts with note `Completed multiple freelance contracts during a domestic incident.` Update `laundryIgnored` copy to refer to max stack and add a separate dinner-fund fact only if needed to preserve the five-fact comedy cap tests.

- [ ] **Step 5: Make category rounding internally consistent**

In `computeScore()`, category functions already return integers after this change. Compute total from the four returned category values exactly:

```ts
total: mmo + household + vibe + comedy,
```

Update score/ending fixtures to expect the new reachable branches and exact integer totals.

- [ ] **Step 6: Verify Task 1**

Run: `npx vitest run src/mmo/sim/osrs.test.ts src/mmo/sim/sim.test.ts src/score/score.test.ts`

Expected: all selected tests pass; no category score is fractional.

Checkpoint: `git diff -- src/mmo/sim src/score/score.ts src/score/score.test.ts`

---

### Task 2: Add reproducible run seeds and minimal local report history

**Files:**
- Create: `src/session.ts`
- Create: `src/session.test.ts`
- Create: `src/score/history.ts`
- Create: `src/score/history.test.ts`

**Interfaces:**
- Produces: `parseSessionSeed(raw)`, `createSessionSeed(source?)`, `formatSessionSeed(seed)`, `recordReport(storage, total)`.
- Produces: `ReportHistorySummary { runNumber, best, previousTotal, delta, isNewBest, persisted }`.

- [ ] **Step 1: Write failing seed tests**

```ts
expect(parseSessionSeed('12648430')).toBe(12648430);
expect(parseSessionSeed('-1')).toBe(0xffffffff);
expect(parseSessionSeed('nope')).toBeUndefined();
expect(createSessionSeed({ getRandomValues: (a) => { a[0] = 0x12345678; return a; } })).toBe(0x12345678);
expect(formatSessionSeed(0xc0ffee)).toBe('00C0FFEE');
```

Use a structural source type rather than the full browser `Crypto` interface:

```ts
export interface RandomSource {
  getRandomValues(array: Uint32Array): Uint32Array;
}
```

- [ ] **Step 2: Write failing history tests**

Use an in-memory storage stub and assert:

```ts
expect(recordReport(storage, 42)).toEqual({
  runNumber: 1,
  best: 42,
  previousTotal: null,
  delta: null,
  isNewBest: true,
  persisted: true,
});
expect(recordReport(storage, 37)).toMatchObject({
  runNumber: 2,
  best: 42,
  previousTotal: 42,
  delta: -5,
  isNewBest: false,
});
```

Also seed storage with malformed JSON and a wrong schema version; both must recover as a first report. A throwing `setItem` stub must return `persisted: false` without throwing.

- [ ] **Step 3: Run the new tests and confirm red**

Run: `npx vitest run src/session.test.ts src/score/history.test.ts`

Expected: module-not-found failures.

- [ ] **Step 4: Implement seed helpers**

Use unsigned normalization and Web Crypto with a bounded fallback:

```ts
export function parseSessionSeed(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed >>> 0 : undefined;
}

export function createSessionSeed(source: RandomSource | undefined = globalThis.crypto): number {
  if (source) return source.getRandomValues(new Uint32Array(1))[0] ?? 0;
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

export function formatSessionSeed(seed: number): string {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
```

- [ ] **Step 5: Implement validated history storage**

Use key `j5mm-report-history-v1` and schema `{ version: 1, runs, best, lastTotal }`. Accept only finite non-negative integers. `recordReport()` reads safely, computes summary from the prior record, attempts one write, and returns the computed summary with `persisted: false` if either storage operation throws.

- [ ] **Step 6: Verify Task 2**

Run: `npx vitest run src/session.test.ts src/score/history.test.ts`

Expected: both files pass, including malformed/throwing storage cases.

Checkpoint: `git diff -- src/session.ts src/session.test.ts src/score/history.ts src/score/history.test.ts`

---

### Task 3: Integrate progression, feedback, history, and accessible reporting

**Files:**
- Modify: `src/game.ts`
- Create: `src/game.test.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/hud.ts`
- Modify: `src/ui/scorecard.ts`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: Task 1 expanded `SessionData`; Task 2 seed/history helpers.
- Produces: `Hud.setObjectiveProgress(coins, skills, questLabel, maxStackHit, statsBonusHit)` and expanded `ScorecardStats`.

- [ ] **Step 1: Wire a per-instance seed and full session snapshot**

In `Game` choose once:

```ts
private readonly sessionSeed: number;

this.sessionSeed = opts.seed ?? createSessionSeed();
const hostOpts = { speed: opts.speed, seed: this.sessionSeed };
```

Parse `?seed=` in `main.ts` with `parseSessionSeed()`. Include `seed` in `GameOptions` only when valid, preserving `exactOptionalPropertyTypes`.

At `endSession()`, map the sim into `SessionData` exactly:

```ts
kills: sim.stats.kills,
logsSold: sim.stats.logsSold,
flaxSold: sim.stats.flaxSold,
bestStreak: sim.stats.bestStreak,
contractsCompleted: sim.stats.contractsCompleted,
skills: { ...sim.player.skills },
```

- [ ] **Step 2: Replace the impossible HUD lead with session progress**

Change `Hud.setObjectiveProgress()` to render:

```ts
const dinnerFund = `${formatGpShort(coins)} / ${SESSION_COIN_TARGET} gp`;
const legend = maxStackHit && statsBonusHit
  ? 'MAX STACK · 99 ALL'
  : maxStackHit
    ? 'MAX STACK'
    : statsBonusHit
      ? '99 ALL'
      : null;
this.objectiveEl.textContent = legend
  ? `Dinner fund secured · ${questLabel} · ${legend}`
  : `Dinner fund: ${dinnerFund} · Wyn: ${questLabel}`;
```

Pass `sim.questLabel()` on every update and use the same formatter when the objective banner first appears.

- [ ] **Step 3: Write the failing cross-world feedback tests**

Create `src/game.test.ts` and assert the wished-for pure copy helpers before implementing them:

```ts
expect(crossWorldToast({ type: 'playerDied', coinsLost: 4, whileAway: true }))
  .toBe('Mudwick: you died while unsupervised.');
expect(crossWorldToast({ type: 'playerDied', coinsLost: 4, whileAway: false })).toBeNull();
expect(crossWorldToast({ type: 'questComplete', reward: 22, kind: 'logs' }))
  .toBe('Wyn contract complete — 22 gp.');
expect(choreDoneToast('Mugs 3/3', false)).toBe('Mugs 3/3 — sorted.');
expect(choreDoneToast('Mugs 3/3', true))
  .toBe('Sorted while your avatar was in mortal danger. Efficient.');
```

Run: `npx vitest run src/game.test.ts`

Expected: FAIL because `crossWorldToast` and `choreDoneToast` are not exported.

- [ ] **Step 4: Add rare cross-world feedback**

Move MMO event handling into a named method. Preserve every existing audio switch branch. Add:

```ts
if (event.type === 'playerDied' && event.whileAway) {
  this.hud.showToast('Mudwick: you died while unsupervised.', this.gameNow, 4200);
}
if (event.type === 'questComplete') {
  this.hud.showToast(`Wyn contract complete — ${event.reward} gp.`, this.gameNow, 3200);
}
```

Implement the two tested pure helpers and use them from the named MMO event handler and chore-completion path. Change the danger chore completion toast to `Sorted while your avatar was in mortal danger. Efficient.` only when the danger flag is set for that completion; retain the ordinary completion copy otherwise.

- [ ] **Step 5: Record and render the report summary**

Call `recordReport(localStorage, score.total)` inside a `try`-safe helper and pass the summary plus these fields to `showScorecard()`:

```ts
kills: sim.stats.kills,
bestStreak: sim.stats.bestStreak,
contractsCompleted: sim.stats.contractsCompleted,
skillLevels: {
  woodcutting: levelOf(sim.player.skills.woodcutting),
  attack: levelOf(sim.player.skills.attack),
  foraging: levelOf(sim.player.skills.foraging),
},
seed: this.sessionSeed,
history,
```

Render two compact metadata lines, a career strip, and hexadecimal run seed. Set scorecard attributes `role="dialog"`, `aria-modal="true"`, `aria-labelledby="incident-report-title"`; give the title that id and call `restartButton.focus()` after append.

- [ ] **Step 6: Make audio control state explicit**

Replace the sibling `VOL` span with a `label` linked to a stable slider id and `aria-label="Volume"`. Read/write key `j5mm-volume` via `localStorage` inside `try/catch`. Store the wrapper as `this.volumeControl`, and hide it before showing the scorecard.

- [ ] **Step 7: Verify Task 3**

Run: `npm test && npm run typecheck`

Expected: all unit tests pass and strict TypeScript accepts every expanded interface.

Checkpoint: `git diff -- src/game.ts src/main.ts src/ui/hud.ts src/ui/scorecard.ts src/ui/style.css`

---

### Task 4: Fix first pointer lock, gate boot, title cleanup, and overlay accessibility

**Files:**
- Modify: `src/game.ts`
- Modify: `src/main.ts`
- Modify: `src/ui/title.ts`
- Modify: `src/ui/gate.ts`
- Modify: `src/ui/hud.ts`
- Modify: `src/ui/style.css`
- Modify: `index.html`

**Interfaces:**
- Changes: `showTitle(parent, audio, onBegin): () => void` invokes `onBegin` synchronously once and returns an idempotent disposer.
- Changes: `new Game(root, options, onRestart)` leaves replacement ownership with `main.ts`.
- Changes: `installGate(parent, onChange): () => void`, where `onChange(reason)` receives `'pointer' | 'viewport' | null`.

- [ ] **Step 1: Make title completion synchronous and fully disposable**

Replace the promise API with a one-shot callback. Inside `finish()` stop title activity, call `onBegin()` in the activating event turn, then schedule the 520 ms visual removal. Return one idempotent disposer that removes key/click listeners, stops parallax/CRT activity, clears the removal timeout, and removes the title. Track all Mum timers:

```ts
let swapTimer = 0;
const knock = (): void => {
  quote.classList.add('title-mum-quote--knock');
  audio?.knock();
  swapTimer = window.setTimeout(swapQuote, 220);
};
const firstTimer = window.setTimeout(knock, 2200);
const interval = window.setInterval(knock, 9000);
return () => {
  window.clearTimeout(firstTimer);
  window.clearTimeout(swapTimer);
  window.clearInterval(interval);
};
```

- [ ] **Step 2: Freeze the game until first pointer lock**

Add `pointerLockRequired`, set it from `begin(lockPointer)`, call `syncPauseOverlay()` immediately, and define room pause as:

```ts
if (this.hiddenPause) return true;
return this.host.mode === 'room' && this.pointerLockRequired && !this.host.pointerLocked;
```

Keep `skipTitle=1` unlocked by calling `begin(false)`. The pause overlay uses a real `<button type="button">`; before first successful lock it says `Click to start looking`, and after one successful lock it says `Paused — click to resume`. Pointer-lock rejection leaves the same frozen overlay available. Count first success only when the game's own canvas owns pointer lock.

- [ ] **Step 3: Make the device gate own full-game boot**

Expose:

```ts
export type DeviceBlockReason = 'pointer' | 'viewport';
export function deviceBlockReason(): DeviceBlockReason | null;
export function installGate(
  parent: HTMLElement,
  onChange: (reason: DeviceBlockReason | null) => void,
): () => void;
```

Use reason-specific copy and `role="alert"`. Subscribe to window resize and both pointer media-query `change` events. Deliver the initial reason synchronously and future callbacks only when it changes. In `main.ts`, become the sole owner of `Game`: centralise guarded start/stop/restart, construct no game while blocked, dispose and clear the debug handle on block, and start exactly one fresh game when support returns. Dev routes remain ungated. This prevents a scorecard restart from leaving a stale gate-owned reference.

- [ ] **Step 4: Add live-region and page semantics**

Set subtitle/toast to `role="status" aria-live="polite" aria-atomic="true"`; set the Mum prompt to `role="group" aria-label="Respond to Mum"` without making its shrinking timer live. Add description, theme-color `#100d0a`, and `color-scheme` `dark` metadata in `index.html`.

- [ ] **Step 5: Verify Task 4 statically**

Run: `npm run typecheck && npm test`

Expected: no listener/timer/type regressions; 79 existing input/director/score/sim/chores tests plus new tests pass.

Checkpoint: `git diff -- src/game.ts src/main.ts src/ui/title.ts src/ui/gate.ts src/ui/hud.ts src/ui/style.css index.html`

---

### Task 5: Fix tiny-target interaction, render cadence, ended-loop work, and GPU cleanup

**Files:**
- Modify: `src/host/room.ts`
- Modify: `src/host/app.ts`
- Modify: `src/mmo/render/game.ts`
- Modify: `src/game.ts`
- Modify: `scripts/e2e-full.mjs`

**Interfaces:**
- Changes: `MmoGame.update(dtMs, playerAway, render = true): void`.
- Preserves: the E2E uses real `InteractSystem` raycasting; it does not mutate tracker state directly.

- [ ] **Step 1: Re-run the failing wrapper regression before editing**

Run with preview active: `node scripts/e2e-full.mjs`

Expected on the pre-fix tree: `pickup failed at 0.32,-0.8,0.32,0.82,-1.72` in at least one isolated run.

- [ ] **Step 2: Add a non-rendering wrapper interaction proxy**

Add a helper that inserts a transparent, depth-write-disabled `BoxGeometry` into the wrapper group:

```ts
function addInteractionProxy(group: THREE.Group, size: THREE.Vector3, y: number): void {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const proxy = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
  proxy.position.y = y;
  group.add(proxy);
}
```

Call `addInteractionProxy(g, new THREE.Vector3(0.13, 0.12, 0.13), 0.06)` in `makeWrapper()`. The tag remains on the parent group, so `resolveTarget()` returns the existing item interaction and highlighting still affects only Lambert materials.

- [ ] **Step 3: Replace E2E sleeps with state conditions**

Change `carryTo()` to accept `itemId`. After aiming, wait for the exact actionable pickup prompt for that item; after pressing E, wait until `tracker.carried?.id === itemId`. At the target, wait for a `Put` prompt while the same item is carried, press E, then wait until that item's tracker state is exactly `placed`. Use 5-second condition timeouts and remove the fixed 120/80 ms sleeps. This prevents stale-prompt and floor-drop false positives.

- [ ] **Step 4: Render the hidden MMO only at monitor cadence**

In `MmoGame.update()`, advance time/sim exactly as before and accumulate elapsed render delta even across skipped frames, then guard only the final render:

```ts
this.renderDtMs += dtMs;
if (render) {
  const renderDtMs = this.renderDtMs;
  this.renderDtMs = 0;
  this.renderer.render(this.now, renderDtMs);
}
```

In `HostApp.update()`, accumulate monitor time before `mmo.update()`. Pass `renderMmo = this.mode === 'pc' || monitorDue`; mark `monitorTex.needsUpdate` only when `monitorDue`; preserve sim updates every host frame. Keep `MONITOR_REFRESH_MS = 100`, which makes Room Mode rendering exactly the existing 10 fps monitor cadence.

- [ ] **Step 5: Stop ended RAF and release the WebGL context**

At the bottom of `Game.tick`, use:

```ts
if (this.state === 'ended') {
  this.raf = 0;
  return;
}
this.raf = requestAnimationFrame(this.tick);
```

After `renderer.dispose()` call `renderer.forceContextLoss()`. Restart replacement and the live debug handle are owned by the `main.ts` controller from Task 4.

- [ ] **Step 6: Verify Task 5**

Run: `npm test && npm run build`

With preview active run the full E2E three consecutive times. Expected: all three pass, including `wrap3`; no fixed interaction sleeps remain.

Checkpoint: `git diff -- src/host/room.ts src/host/app.ts src/mmo/render/game.ts src/game.ts scripts/e2e-full.mjs`

---

### Task 6: Make overlays responsive and honor reduced motion

**Files:**
- Modify: `src/ui/hud.ts`
- Modify: `src/ui/title.ts`
- Modify: `src/host/interact.ts`
- Modify: `src/ui/style.css`

**Interfaces:**
- Produces: `.hud-dialogue-stack` containing prompt then subtitle with a 12 px minimum gap.
- Produces: construction-time reduced-motion behavior; live preference changes remain reload-bound.

- [ ] **Step 1: Build one dialogue stack**

In `Hud` create a `div.hud-dialogue-stack`, append `promptEl` then `subtitleEl`, and append the stack to the HUD root. Remove independent fixed positioning from the two children. Style the stack as fixed, centered, bottom `clamp(24px, 6vh, 64px)`, width `min(680px, calc(100vw - 32px))`, flex column, `gap: 12px`, and `pointer-events: none`; keep prompt buttons pointer-enabled.

- [ ] **Step 2: Render a static title CRT under reduced motion**

Pass `reduceMotion` to `startTitleCrt()`. Call its draw loop once synchronously; schedule the next RAF only when false. Do not start parallax or Mum quote cycling when `matchMedia('(prefers-reduced-motion: reduce)').matches` is true.

- [ ] **Step 3: Disable nonessential motion consistently**

Cache the same media query in `InteractSystem` and use steady emissive intensity `0.35` instead of a sine pulse under reduced motion. Expand the CSS media query to disable animation/transition on pseudo-elements, hide CRT/title flicker overlays, remove scorecard/stamp transforms, and stop the late-clock pulse.

- [ ] **Step 4: Verify Task 6**

Run: `npm run typecheck && npm test`

Expected: strict build and all unit tests pass. Browser assertions are added in Task 7.

Checkpoint: `git diff -- src/ui/hud.ts src/ui/title.ts src/host/interact.ts src/ui/style.css`

---

### Task 7: Turn browser/build behavior into managed release gates

**Files:**
- Modify: `scripts/smoke.mjs`
- Create: `scripts/run-browser-checks.mjs`
- Create: `scripts/check-dist-size.mjs`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: `npm run test:browser`, `npm run size:check`, and `npm run verify`.
- Consumes: built standalone `dist/`; `run-browser-checks.mjs` owns preview lifecycle.

- [ ] **Step 1: Expand smoke coverage with deterministic browser assertions**

Use separate pages to assert:

```js
// 800x600: gate visible and no window.__game; resize to 1000x700 starts one game.
// forced requestPointerLock rejection: .pause-overlay is visible and director.t changes < 0.05 in 500 ms.
// 900x600 seeded prompt: promptBox.y + promptBox.height + 12 <= subtitleBox.y.
// reduced motion: parallax transform stays unchanged and flicker display is none.
// scorecard: activeElement has class sc-restart and role/aria-modal are correct.
// room mode: instrumented MMO renderer runs <= 12 times in one second.
// ended state: window.__game.raf === 0.
// 20 synchronous restart() calls: one #room-canvas, live __game, no console text includes 'Too many active WebGL contexts'.
```

Keep the existing incident-report title/ending/total assertions.

- [ ] **Step 2: Add a cross-platform managed preview runner**

Spawn Vite directly with Node so process termination is reliable:

```js
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const server = spawn(process.execPath, [viteBin, 'preview', '--host', '127.0.0.1'], {
  stdio: ['ignore', 'pipe', 'pipe'],
});
```

Poll `http://127.0.0.1:4173/` with `fetch()` for at most 15 seconds, run `smoke.mjs` then `e2e-full.mjs` as child Node processes with `SMOKE_URL`, and terminate the server in `finally`. Propagate the first non-zero exit code.

- [ ] **Step 3: Add a deterministic compressed-size budget**

Read built `dist/assets/*.js` and `*.css`, gzip each with `gzipSync`, sum by type, print raw/gzip totals, and fail when JavaScript gzip exceeds `200 * 1024` bytes or CSS gzip exceeds `10 * 1024` bytes.

- [ ] **Step 4: Expose package and CI gates**

Add scripts:

```json
"test:browser": "node scripts/run-browser-checks.mjs",
"size:check": "node scripts/check-dist-size.mjs",
"verify": "npm test && npm run build && npm run size:check && npm run test:browser && npm run build:hub"
```

In CI, after `npm ci`, run unit tests, standalone build, size check, `npx playwright install --with-deps chromium`, browser tests, and `npm run build:hub`.

- [ ] **Step 5: Verify Task 7 locally**

Run: `npm run verify`

Expected: unit tests pass; standalone and mounted builds succeed; size totals remain below budgets; smoke and full E2E pass; preview exits cleanly.

Checkpoint: `git diff -- scripts package.json .github/workflows/ci.yml`

---

### Task 8: Refresh truth surfaces, visual captures, and final evidence

**Files:**
- Modify: `README.md`
- Modify when captures are demonstrably current: `docs/screenshots/parity-3d.png`
- Modify when captures are demonstrably current: `docs/screenshots/ui-mmo-full.png`
- Modify when captures are demonstrably current: `docs/screenshots/ui-mum.png`
- Modify when captures are demonstrably current: `docs/screenshots/ui-score.png`
- Add when representative: `docs/screenshots/title.png`

**Interfaces:**
- Consumes: every prior task and final browser-rendered UI.
- Produces: accurate controls/goals/dev params/test commands/screenshots.

- [ ] **Step 1: Update README facts**

Document the 100 gp dinner fund as the achievable session goal and max stack/99 all as legendary stretch goals. Add `?seed=N`, local best/run comparison, `npm run verify`, and the actual final Vitest count. Preserve the user-owned input-test wording rather than replacing it.

- [ ] **Step 2: Capture current visual states**

Use Playwright at 1440×900 for title, room HUD, PC mode, prompt stack, and scorecard. Store review captures in the temporary directory first. Replace curated files only after checking that copy says five minutes, the HUD uses dinner-fund progress, no overlays collide, the volume control is absent from the scorecard, and the scorecard metadata is legible.

- [ ] **Step 3: Run the complete final gate after the last edit**

Run:

```powershell
npm run verify
git diff --check
git status --short --branch
```

Expected: `verify` exits 0; `git diff --check` has no output; status contains only the original input slice plus this enhancement’s intentional files.

- [ ] **Step 4: Review the final diff for accidental scope or user-change loss**

Compare the original dirty baseline: `README.md`, `src/host/app.ts`, `src/host/input.ts`, and `src/host/input.test.ts`. Confirm the input hook/tests remain byte-for-byte semantically intact and no `.claude`, `.swe-agent`, `dist`, temp screenshot, or browser log artifact appears in the diff.

- [ ] **Step 5: Perform an independent diff review**

Request a reviewer to return findings only. Verify every finding against the live tree before changing code, rerun the affected narrow test, then rerun `npm run verify` if any source changes.

Checkpoint: final uncommitted handoff with exact gate output and remaining environment limitations.
