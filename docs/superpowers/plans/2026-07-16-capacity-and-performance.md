# Capacity and Performance Measurement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable production-browser measurement command that exercises the authoritative 29-scenario matrix three times, reports deterministic artifact and runtime evidence, and identifies the exact safe optimization work needed to recover release headroom.

**Architecture:** Keep `scripts/smoke.mjs` as the only scenario matrix and wrap it with an opt-in Playwright/CDP probe installed before application boot. Pure report and size modules validate and aggregate three isolated smoke processes, while the existing managed runner continues to own one strict Vite preview and all cleanup. Normal tests and browser checks retain their current output and behavior; measurement writes exactly one JSON document to standard output and sends progress diagnostics to standard error.

**Tech Stack:** Node.js 22, JavaScript ES modules, TypeScript 7, Vite 8.1.4, Vitest 4.1.10, Playwright 1.61.1, Chrome DevTools Protocol, npm, Git.

## Global Constraints

- Keep the JavaScript ceiling at 204,800 gzip bytes and the CSS ceiling at 10,112 gzip bytes during baseline measurement.
- The completed capacity tranche must reach JavaScript at or below 202,752 gzip bytes and CSS at or below 9,600 gzip bytes without raising either ceiling.
- Add no dependency, backend, analytics, telemetry, external profiling service, or shipped instrumentation.
- Preserve all visuals, accessibility states, browser scenarios, interaction behavior, audio behavior, and progression pacing unless measurement proves a defect.
- Keep `npm run build`, `npm run build:hub`, `npm run test:browser`, artifact probes, and `npm run verify` backward compatible.
- `npm run measure:browser` must use the standalone production artifact, the same 29 scenarios, three fixed-input runs, and the managed loopback preview.
- Wall-clock readiness values are diagnostic; missing, negative, or non-finite values are fatal, but slower values alone do not fail the command.
- Lifecycle growth, malformed reports, broken cadence, browser errors, resource failures, and cleanup failures are hard failures.
- Do not commit raw JSON reports, traces, screenshots, or generated profiling artifacts.
- Do not select or edit production optimization candidates before Task 6 records the baseline evidence.

## Plan boundary

This plan delivers the complete reusable measurement system and a verified baseline. It intentionally stops at the evidence gate required by the approved design. Exact production/CSS optimization tasks cannot be written honestly before the baseline identifies candidates; after Task 6, write a short candidate-specific continuation plan with exact files, failing tests, expected byte recovery, and verification commands. That continuation implements capacity recovery and the final budget ratchet.

The measurement system is independently useful and testable: it leaves ordinary release gates unchanged, emits a validated three-run report, and produces the evidence required for the second plan. No speculative production task is hidden in this document.

---

## File Structure

- Create `scripts/browser-performance-contract.mjs`: pure validation, statistics, CSS range union, ownership comparison, run aggregation, and stable JSON serialization.
- Create `scripts/browser-performance-contract.test.ts`: Vitest coverage for every pure report invariant.
- Create `scripts/dist-size-contract.mjs`: reusable deterministic raw/gzip artifact measurement and budget checking.
- Create `scripts/dist-size-contract.test.ts`: in-memory size and budget contracts.
- Modify `scripts/check-dist-size.mjs`: keep the existing CLI output while delegating calculation to the reusable size contract.
- Create `scripts/browser-performance-probe.mjs`: Playwright/CDP setup, pre-boot browser resource instrumentation, network/CSS capture, and guaranteed protocol cleanup.
- Create `scripts/browser-performance-probe-smoke.mjs`: focused real-browser proof for resource observation, release, once-listener semantics, and intentional leak rejection.
- Modify `scripts/browser-check-config.mjs`: parse mutually exclusive `--artifact-only` and `--measure-only` modes.
- Modify `scripts/browser-check-config.test.ts`: preserve existing argument contracts and cover measurement conflicts.
- Modify `scripts/smoke.mjs`: opt into the probe, collect one complete 29-scenario run, preserve ordinary output, and emit one validated run document in measurement mode.
- Modify `scripts/run-browser-checks.mjs`: run the probe self-check, execute three measured smoke processes, aggregate them, keep stdout machine-readable, and preserve owned preview cleanup.
- Modify `package.json`: expose `npm run measure:browser` without adding it to `npm run verify`.
- Modify `README.md`: document the explicit diagnostic command and JSON/stdout behavior.
- Modify `CONTRIBUTING.md`: distinguish stable release gates from optional pre/post performance evidence.

---

### Task 1: Pure browser-performance report contract

**Files:**
- Create: `scripts/browser-performance-contract.mjs`
- Create: `scripts/browser-performance-contract.test.ts`

**Interfaces:**
- Produces: `REPORT_SCHEMA_VERSION: 1`
- Produces: `summarize(values: readonly number[]): { min: number; median: number; max: number }`
- Produces: `normalizeRanges(ranges: readonly { start: number; end: number }[]): { start: number; end: number }[]`
- Produces: `assertOwnershipBaseline(label: string, baseline: OwnershipSnapshot, current: OwnershipSnapshot): void`
- Produces: `validatePerformanceRun(run: unknown): PerformanceRun`
- Produces: `aggregatePerformanceRuns(runs: readonly PerformanceRun[]): PerformanceReport`
- Produces: `stableStringify(value: unknown): string`
- Consumes: plain JSON-compatible data only; this module must not import Playwright, filesystem, child-process, or production game code.

- [ ] **Step 1: Write failing statistics and CSS-union tests**

Create `scripts/browser-performance-contract.test.ts` with these first contracts:

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizeRanges,
  stableStringify,
  summarize,
} from './browser-performance-contract.mjs';

describe('summarize', () => {
  it('reports min, median, and max for odd and even samples', () => {
    expect(summarize([9, 1, 4])).toEqual({ min: 1, median: 4, max: 9 });
    expect(summarize([8, 2, 6, 4])).toEqual({ min: 2, median: 5, max: 8 });
  });

  it('rejects empty, negative, and non-finite samples', () => {
    expect(() => summarize([])).toThrow(/non-empty/i);
    expect(() => summarize([1, -1])).toThrow(/non-negative/i);
    expect(() => summarize([1, Number.NaN])).toThrow(/finite/i);
  });
});

describe('normalizeRanges', () => {
  it('sorts and merges overlapping or adjacent half-open ranges', () => {
    expect(normalizeRanges([
      { start: 20, end: 25 },
      { start: 0, end: 5 },
      { start: 4, end: 10 },
      { start: 10, end: 12 },
    ])).toEqual([
      { start: 0, end: 12 },
      { start: 20, end: 25 },
    ]);
  });

  it('rejects reversed, negative, and non-finite ranges', () => {
    expect(() => normalizeRanges([{ start: 4, end: 3 }])).toThrow(/range/i);
    expect(() => normalizeRanges([{ start: -1, end: 3 }])).toThrow(/range/i);
    expect(() => normalizeRanges([{ start: 0, end: Number.POSITIVE_INFINITY }])).toThrow(/range/i);
  });
});

describe('stableStringify', () => {
  it('sorts object keys recursively and keeps array order', () => {
    expect(stableStringify({ z: 1, a: { d: 4, b: 2 }, rows: [{ y: 2, x: 1 }] }))
      .toBe('{"a":{"b":2,"d":4},"rows":[{"x":1,"y":2}],"z":1}');
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- scripts/browser-performance-contract.test.ts
```

Expected: FAIL because `scripts/browser-performance-contract.mjs` does not exist.

- [ ] **Step 3: Implement deterministic statistics, range union, and serialization**

Create `scripts/browser-performance-contract.mjs` with these foundations:

```js
export const REPORT_SCHEMA_VERSION = 1;

const assertFiniteNonNegative = (value, label) => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite`);
  if (value < 0) throw new Error(`${label} must be non-negative`);
};

export function summarize(values) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('summary requires a non-empty sample');
  }
  values.forEach((value, index) => assertFiniteNonNegative(value, `sample[${index}]`));
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
  return { min: sorted[0], median, max: sorted.at(-1) };
}

export function normalizeRanges(ranges) {
  const sorted = ranges.map(({ start, end }, index) => {
    assertFiniteNonNegative(start, `range[${index}].start`);
    assertFiniteNonNegative(end, `range[${index}].end`);
    if (end < start) throw new Error(`range[${index}] ends before it starts`);
    return { start, end };
  }).sort((left, right) => left.start - right.start || left.end - right.end);

  const merged = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || range.start > previous.end) merged.push({ ...range });
    else previous.end = Math.max(previous.end, range.end);
  }
  return merged;
}

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
};

export const stableStringify = (value) => JSON.stringify(canonicalize(value));
```

- [ ] **Step 4: Add failing schema, ownership, and aggregation tests**

Extend the test import with `REPORT_SCHEMA_VERSION`, `aggregatePerformanceRuns`, `assertOwnershipBaseline`, and `validatePerformanceRun`. Add a `makeRun(sampleIndex)` fixture whose exact top-level shape is:

```ts
const makeRun = (sampleIndex: number) => ({
  schemaVersion: 1,
  sampleIndex,
  environment: {
    base: '/', browser: 'Chromium test', commit: 'abc1234', node: 'v22.0.0',
    platform: 'win32', seed: '0x00C0FFEE', viewport: { width: 1000, height: 700 },
  },
  artifact: {
    JavaScript: { budget: 204800, files: 1, gzip: 204183, raw: 758266 },
    CSS: { budget: 10112, files: 1, gzip: 10091, raw: 41737 },
  },
  scenarios: [{
    name: 'gate owns game lifecycle',
    cadence: { roomMmoRenders: 8 },
    css: [{ hash: 'sha256:test', totalBytes: 20, url: '/assets/index.css', used: [{ start: 0, end: 10 }] }],
    lifecycle: {
      baseline: { animationFrames: 1, audioClosed: 0, audioRunning: 0, audioSuspended: 0, audioTotal: 0, intervals: 0, listeners: 8, timeouts: 0, webgl: 1 },
      settled: { animationFrames: 1, audioClosed: 0, audioRunning: 0, audioSuspended: 0, audioTotal: 0, intervals: 0, listeners: 8, timeouts: 0, webgl: 1 },
    },
    readiness: { firstPlayableFrameMs: 120, titleInteractiveMs: 60 },
    resources: [{ encodedBytes: 100, kind: 'script', url: '/assets/index.js' }],
  }],
});
```

Add assertions that:

```ts
expect(validatePerformanceRun(makeRun(0))).toEqual(makeRun(0));
expect(() => validatePerformanceRun({ ...makeRun(0), schemaVersion: 2 })).toThrow(/schema/i);
expect(() => assertOwnershipBaseline('restart',
  makeRun(0).scenarios[0].lifecycle.baseline,
  { ...makeRun(0).scenarios[0].lifecycle.settled, listeners: 9 },
)).toThrow(/restart.*listeners/i);

const report = aggregatePerformanceRuns([makeRun(0), makeRun(1), makeRun(2)]);
expect(report.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
expect(report.sampleCount).toBe(3);
expect(report.scenarioCount).toBe(1);
expect(report.readiness.titleInteractiveMs).toEqual({ min: 60, median: 60, max: 60 });
expect(report.css[0].used).toEqual([{ start: 0, end: 10 }]);
```

Also mutate each required numeric field in turn to `NaN`, `-1`, or `undefined` and expect validation to throw with the field path.

- [ ] **Step 5: Run the expanded test and verify RED**

Run `npm test -- scripts/browser-performance-contract.test.ts`.

Expected: FAIL because the four new exports are absent.

- [ ] **Step 6: Implement the complete run contract**

Add the four exports. Validation must walk every required environment, artifact, scenario, resource, readiness, cadence, CSS, and lifecycle field; use `assertFiniteNonNegative` for every number; require unique scenario names; require `end <= totalBytes` for CSS ranges; and call `assertOwnershipBaseline` for every lifecycle pair.

`assertOwnershipBaseline` compares the active keys `animationFrames`, `audioRunning`, `intervals`, `listeners`, `timeouts`, and `webgl`. It validates but does not require historical `audioClosed` or `audioTotal` counts to decrease. `aggregatePerformanceRuns` must:

```js
export function aggregatePerformanceRuns(runs) {
  if (runs.length !== 3) throw new Error(`expected 3 performance runs, received ${runs.length}`);
  const valid = runs.map(validatePerformanceRun);
  const first = valid[0];
  const signature = stableStringify({
    artifact: first.artifact,
    base: first.environment.base,
    scenarioNames: first.scenarios.map(({ name }) => name),
    seed: first.environment.seed,
    viewport: first.environment.viewport,
  });
  for (const run of valid.slice(1)) {
    const current = stableStringify({
      artifact: run.artifact,
      base: run.environment.base,
      scenarioNames: run.scenarios.map(({ name }) => name),
      seed: run.environment.seed,
      viewport: run.environment.viewport,
    });
    if (current !== signature) throw new Error('performance runs do not share controlled inputs');
  }

  const scenarios = valid.flatMap(({ scenarios: rows }) => rows);
  const readinessRows = scenarios.filter(({ readiness }) => readiness);
  const cssByHash = new Map();
  for (const row of scenarios.flatMap(({ css }) => css)) {
    const current = cssByHash.get(row.hash) ?? { ...row, used: [] };
    current.used = normalizeRanges([...current.used, ...row.used]);
    cssByHash.set(row.hash, current);
  }

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    sampleCount: valid.length,
    scenarioCount: first.scenarios.length,
    environment: first.environment,
    artifact: first.artifact,
    resources: aggregateResources(scenarios),
    readiness: {
      titleInteractiveMs: summarize(readinessRows.map((row) => row.readiness.titleInteractiveMs)),
      firstPlayableFrameMs: summarize(readinessRows.map((row) => row.readiness.firstPlayableFrameMs)),
    },
    cadence: aggregateCadence(scenarios),
    css: [...cssByHash.values()].sort((left, right) => left.hash.localeCompare(right.hash)),
    lifecycle: aggregateLifecycle(scenarios),
  };
}
```

Implement `aggregateResources`, `aggregateCadence`, and `aggregateLifecycle` as private reducers in the same file. They group by stable key, summarize numeric samples, and return alphabetically sorted arrays/objects. Do not discard individual lifecycle checkpoint labels.

- [ ] **Step 7: Verify GREEN and commit**

Run:

```powershell
npm test -- scripts/browser-performance-contract.test.ts
git diff --check
```

Expected: focused tests PASS and diff check is silent.

Commit:

```powershell
git add scripts/browser-performance-contract.mjs scripts/browser-performance-contract.test.ts
git commit -m "test: define browser performance report contract"
```

---

### Task 2: Reusable deterministic artifact-size metrics

**Files:**
- Create: `scripts/dist-size-contract.mjs`
- Create: `scripts/dist-size-contract.test.ts`
- Modify: `scripts/check-dist-size.mjs`

**Interfaces:**
- Produces: `SIZE_BUDGETS` with unchanged baseline ceilings.
- Produces: `measureAssetBuffers(entries): ArtifactSizeMetrics`
- Produces: `collectDistSizeMetrics(directory): Promise<ArtifactSizeMetrics>`
- Produces: `assertSizeBudgets(metrics, budgets = SIZE_BUDGETS): void`
- Consumes: sorted `{ path: string, contents: Buffer }[]` entries and the current `dist/assets` tree.

- [ ] **Step 1: Write failing deterministic-size tests**

Create `scripts/dist-size-contract.test.ts`:

```ts
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import {
  SIZE_BUDGETS,
  assertSizeBudgets,
  measureAssetBuffers,
} from './dist-size-contract.mjs';

describe('measureAssetBuffers', () => {
  it('totals raw and deterministic level-9 gzip bytes by artifact kind', () => {
    const js = Buffer.from('export const answer = 42;');
    const css = Buffer.from('body{color:#fff}');
    expect(measureAssetBuffers([
      { path: 'z.css', contents: css },
      { path: 'a.js', contents: js },
    ])).toEqual({
      CSS: { budget: 10112, files: 1, gzip: gzipSync(css, { level: 9, mtime: 0 }).byteLength, raw: css.byteLength },
      JavaScript: { budget: 204800, files: 1, gzip: gzipSync(js, { level: 9, mtime: 0 }).byteLength, raw: js.byteLength },
    });
  });

  it('requires at least one JavaScript and one CSS artifact', () => {
    expect(() => measureAssetBuffers([{ path: 'a.js', contents: Buffer.from('x') }])).toThrow(/CSS/i);
  });
});

describe('assertSizeBudgets', () => {
  it('accepts equality and rejects one byte over either ceiling', () => {
    const exact = {
      CSS: { budget: SIZE_BUDGETS.CSS, files: 1, gzip: SIZE_BUDGETS.CSS, raw: 1 },
      JavaScript: { budget: SIZE_BUDGETS.JavaScript, files: 1, gzip: SIZE_BUDGETS.JavaScript, raw: 1 },
    };
    expect(() => assertSizeBudgets(exact)).not.toThrow();
    expect(() => assertSizeBudgets({
      ...exact,
      CSS: { ...exact.CSS, gzip: SIZE_BUDGETS.CSS + 1 },
    })).toThrow(/CSS.*1 byte/i);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm test -- scripts/dist-size-contract.test.ts`.

Expected: FAIL because `scripts/dist-size-contract.mjs` does not exist.

- [ ] **Step 3: Implement the reusable size module**

Move recursive file discovery and deterministic gzip calculation out of `scripts/check-dist-size.mjs`. Keep these exact public ceilings:

```js
export const SIZE_BUDGETS = Object.freeze({
  JavaScript: 200 * 1024,
  CSS: 10_112,
});
```

`measureAssetBuffers` must sort entries by path, filter `.js` and `.css`, compute raw and `gzipSync(contents, { level: 9, mtime: 0 })` totals, attach `files` and `budget`, and reject a missing kind. `collectDistSizeMetrics` recursively reads regular files and delegates to `measureAssetBuffers`. `assertSizeBudgets` throws one message listing every exceeded kind and byte count.

- [ ] **Step 4: Make the existing CLI a thin backward-compatible consumer**

Replace the calculation body in `scripts/check-dist-size.mjs` with:

```js
import { fileURLToPath } from 'node:url';
import {
  assertSizeBudgets,
  collectDistSizeMetrics,
} from './dist-size-contract.mjs';

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const metrics = await collectDistSizeMetrics(assetsDir);

for (const [label, row] of Object.entries(metrics)) {
  console.log(
    `${label}: ${row.raw} raw bytes, ${row.gzip} gzip bytes `
      + `(${row.files} file${row.files === 1 ? '' : 's'}, budget ${row.budget})`,
  );
}

try {
  assertSizeBudgets(metrics);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
```

- [ ] **Step 5: Verify unchanged real-artifact behavior and commit**

Run:

```powershell
npm test -- scripts/dist-size-contract.test.ts
npm run size:check
git diff --check
```

Expected: tests PASS; the CLI still reports 204,183 JavaScript gzip bytes and 10,091 CSS gzip bytes against the unchanged ceilings; diff check is silent.

Commit:

```powershell
git add scripts/dist-size-contract.mjs scripts/dist-size-contract.test.ts scripts/check-dist-size.mjs
git commit -m "test: expose deterministic artifact size metrics"
```

---

### Task 3: Pre-boot browser ownership and CDP probe

**Files:**
- Create: `scripts/browser-performance-probe.mjs`
- Create: `scripts/browser-performance-probe-smoke.mjs`

**Interfaces:**
- Produces: `installBrowserPerformanceProbe(context): Promise<void>`
- Produces: `startScenarioCollection(context, page): Promise<ScenarioCollector>`
- Produces: `snapshotOwnership(page): Promise<OwnershipSnapshot>`
- Produces: `finishScenarioCollection(collector, name): Promise<{ cadence; css; lifecycle; readiness; resources }>`
- Produces on `ScenarioCollector`: `setReadiness(values)`, `setCadence(values)`, `setLifecycle(checkpoints)`, `close()`, and read-only `finished`.
- Consumes: Playwright `BrowserContext` and `Page`; uses CDP `Network`, `DOM`, and `CSS` domains.

- [ ] **Step 1: Create a real-browser probe smoke that initially fails**

Create `scripts/browser-performance-probe-smoke.mjs`. Launch Chromium, create one context/page, call `installBrowserPerformanceProbe`, `startScenarioCollection`, `snapshotOwnership`, and `finishScenarioCollection`, and load a `data:text/html` page. In the page, schedule one interval, one timeout, one animation frame, one ordinary listener, one `{ once: true }` listener, one WebGL context, and one AudioContext when construction succeeds.

Assert these transitions:

```js
assert.equal(afterCreate.intervals - baseline.intervals, 1);
assert.equal(afterCreate.timeouts - baseline.timeouts, 1);
assert.equal(afterCreate.animationFrames - baseline.animationFrames, 1);
assert.equal(afterCreate.listeners - baseline.listeners, 2);
assert.equal(afterCreate.webgl - baseline.webgl, 1);
assert.ok(afterCreate.audioTotal - baseline.audioTotal === 0 || afterCreate.audioTotal - baseline.audioTotal === 1);
assert.equal(afterOnce.listeners - baseline.listeners, 1);
assert.deepEqual(afterRelease, baseline);
```

Then intentionally leave an interval active and assert `assertOwnershipBaseline('intentional leak', baseline, leaked)` throws. Close the collector, page, context, and browser through nested `finally` blocks. Print `PERFORMANCE PROBE PASS` to standard error only.

- [ ] **Step 2: Run the probe smoke and verify RED**

Run `node scripts/browser-performance-probe-smoke.mjs`.

Expected: FAIL because `scripts/browser-performance-probe.mjs` does not exist.

- [ ] **Step 3: Implement the init-script resource inventory**

In `installBrowserPerformanceProbe`, call `context.addInitScript` with one self-contained function. Store its API at `window.__j5mmPerformanceProbe`. The function must preserve native `this`, arguments, return values, property descriptors, and thrown errors while wrapping:

- `requestAnimationFrame` / `cancelAnimationFrame` with active-ID removal before callback execution;
- `setTimeout` / `clearTimeout` with active-ID removal before callback execution;
- `setInterval` / `clearInterval` with active IDs retained until clear;
- `EventTarget.prototype.addEventListener` / `removeEventListener`, keyed by target, type, listener identity, and normalized capture; `{ once: true }` removes its record before invoking the listener;
- `AudioContext` and `webkitAudioContext` constructors with state counted as `audioRunning`, `audioSuspended`, or `audioClosed`;
- `HTMLCanvasElement.prototype.getContext` for `webgl`, `webgl2`, and `experimental-webgl`, with context-loss status read from `isContextLost()`.

Expose only:

```js
window.__j5mmPerformanceProbe = Object.freeze({
  snapshot() {
    return {
      animationFrames: activeAnimationFrames.size,
      audioClosed,
      audioRunning,
      audioSuspended,
      audioTotal: audioContexts.length,
      intervals: activeIntervals.size,
      listeners: listenerRecords.size,
      timeouts: activeTimeouts.size,
      webgl: webglContexts.filter((context) => !context.isContextLost()).length,
    };
  },
});
```

Keep all maps, sets, and native references inside the init-script closure. Do not expose callbacks or DOM targets.

- [ ] **Step 4: Implement network and CSS collection with guaranteed detach**

`startScenarioCollection` creates `context.newCDPSession(page)`, enables `Network`, `DOM`, and `CSS`, starts rule-usage tracking, and records first-party `Network.responseReceived` metadata plus `Network.loadingFinished.encodedDataLength` by request ID.

`finishScenarioCollection` must run in this order inside `try`/`finally`:

1. take and stop rule-usage tracking;
2. fetch stylesheet text for every tracked stylesheet ID;
3. hash UTF-8 stylesheet bytes as `sha256:<lowercase hex>` and convert CDP character offsets to UTF-8 byte offsets before creating half-open `{ start, end }` ranges;
4. return sorted CSS and first-party resource rows;
5. disable CSS and DOM and detach the CDP session in `finally`.

Classify resource kinds as `script`, `style`, `font`, or `other`. Keep the URL pathname in the report, not the ephemeral preview port. Reject failed first-party requests and non-finite encoded sizes.

- [ ] **Step 5: Verify probe semantics and commit**

Run:

```powershell
node scripts/browser-performance-probe-smoke.mjs
npm test -- scripts/browser-performance-contract.test.ts
git diff --check
```

Expected: probe prints `PERFORMANCE PROBE PASS` to stderr; contract tests PASS; diff check is silent.

Commit:

```powershell
git add scripts/browser-performance-probe.mjs scripts/browser-performance-probe-smoke.mjs
git commit -m "test: observe browser resource ownership"
```

---

### Task 4: Instrument the authoritative 29-scenario smoke

**Files:**
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `MEASURE_BROWSER=1`, `MEASURE_SAMPLE_INDEX`, `ARTIFACT_SIZE_JSON`, and the probe/contract APIs.
- Produces: unchanged human-readable ordinary smoke output, or one validated `PerformanceRun` JSON document on stdout in measurement mode.

- [ ] **Step 1: Add measurement-mode setup without changing ordinary execution**

Import `os`, `execFileSync`, the performance contract, and probe APIs. Add:

```js
const measure = process.env.MEASURE_BROWSER === '1';
const sampleIndex = Number(process.env.MEASURE_SAMPLE_INDEX ?? '0');
const progress = measure ? console.error : console.log;
const measuredScenarios = [];
const fixedViewport = { width: 1000, height: 700 };
```

Use `progress` for each `PASS` line and the ordinary final `SMOKE PASS` line. Keep `console.log` unused during measurement until the final JSON write.

- [ ] **Step 2: Install and close collection inside the existing scenario owner**

Change `scenario` so measurement installs the init script before `context.newPage()`, starts collection after page creation, and always finishes or detaches before `context.close()`:

```js
const scenario = async (name, contextOptions, run) => {
  const context = await browser.newContext(contextOptions);
  if (measure) await installBrowserPerformanceProbe(context);
  const page = await context.newPage();
  const collector = measure ? await startScenarioCollection(context, page) : null;
  let primaryError = null;
  try {
    await run(page);
    if (measure) {
      const captured = await finishScenarioCollection(collector, name);
      measuredScenarios.push({
        name,
        cadence: captured.cadence ?? {},
        css: captured.css,
        lifecycle: captured.lifecycle ?? null,
        readiness: captured.readiness ?? null,
        resources: captured.resources,
      });
    }
    passed++;
    progress(`  PASS ${name}`);
  } catch (error) {
    primaryError = error;
    throw new Error(`browser smoke scenario failed: ${name}`, { cause: error });
  } finally {
    if (collector && !collector.finished) {
      try { await collector.close(); }
      catch (cleanupError) {
        if (!primaryError) throw cleanupError;
        primaryError.cleanupError = cleanupError;
      }
    }
    await context.close();
  }
};
```

Store readiness, cadence, and lifecycle values through `collector.setReadiness(values)`, `collector.setCadence(values)`, and `collector.setLifecycle(checkpoints)` respectively; do not infer them from console text. Preserve every scenario's existing viewport and media options so short-screen, device-gate, and reduced-motion coverage remains authoritative across all three runs.

- [ ] **Step 3: Record readiness in an existing title scenario**

In `ordinary motion retains title parallax`, when `measure` is true:

1. record `performance.timeOrigin` before navigation;
2. wait for `.title-begin` to be visible, enabled, and focused;
3. calculate `titleInteractiveMs` from `performance.timeOrigin` to the page's current `performance.now()`;
4. click `.title-begin` through the existing controlled pointer-lock path;
5. wait for `#room-canvas`, `window.__game`, and two distinct animation-frame timestamps;
6. calculate `firstPlayableFrameMs` from the click timestamp;
7. attach both finite non-negative values to that scenario's collector.

Keep the existing parallax assertions before the Begin click so this remains one of the same 29 scenarios.

- [ ] **Step 4: Record cadence in the existing cadence scenario**

Retain the hard assertion `renders > 0 && renders <= 12`. Attach `roomMmoRenders: renders` and the fixed 1,000 ms observation window to the collector. Add a 1,000 ms PC-mode observation in the same scenario by invoking the existing host PC-mode transition, wrapping the same renderer method, and asserting the count is finite and greater than zero before attaching `pcMmoRenders`.

Do not add wall-clock pass/fail thresholds beyond the existing room-mode cap.

- [ ] **Step 5: Record lifecycle checkpoints in the existing 20-restart scenario**

In `restart and gate transitions release WebGL ownership`:

- snapshot `baseline` after the initial game settles;
- retain all 20 existing restart assertions;
- snapshot `afterRestarts` after the final replacement settles;
- snapshot `gated` after the viewport gate removes the game;
- snapshot `restored` after the fresh game settles;
- call `assertOwnershipBaseline('after 20 restarts', baseline, afterRestarts)` for animation frames, timeouts, intervals, listeners, running audio, and live WebGL;
- require `gated.webgl === 0`, `gated.audioRunning === 0`, and no growth in timers/listeners;
- compare `restored` to `baseline` after the gate reopens.

Attach every named checkpoint. Keep the current disposed-game, canvas-count, and WebGL-warning assertions.

- [ ] **Step 6: Emit one validated run document only in measurement mode**

After all scenarios pass, build:

```js
const run = {
  schemaVersion: REPORT_SCHEMA_VERSION,
  sampleIndex,
  environment: {
    base: baseUrl.pathname,
    browser: browser.version(),
    commit: process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim(),
    node: process.version,
    platform: `${os.platform()}-${os.arch()}`,
    seed: 'authoritative-scenario-matrix-v1',
    viewport: fixedViewport,
  },
  artifact: JSON.parse(process.env.ARTIFACT_SIZE_JSON ?? 'null'),
  scenarios: measuredScenarios,
};
```

Require `measuredScenarios.length === 29`, validate the run, and write `stableStringify(run)` plus one newline to stdout. In ordinary mode, retain exactly `SMOKE PASS — 29 isolated browser scenarios`.

- [ ] **Step 7: Verify ordinary smoke behavior before enabling the runner mode**

Run:

```powershell
npm run build
npm run test:browser
git diff --check
```

Expected: all 29 isolated scenarios and the full E2E PASS with the existing human-readable output; no performance JSON is printed; diff check is silent.

Commit:

```powershell
git add scripts/smoke.mjs
git commit -m "test: collect performance evidence from browser scenarios"
```

---

### Task 5: Three-run managed measurement command

**Files:**
- Modify: `scripts/browser-check-config.mjs`
- Modify: `scripts/browser-check-config.test.ts`
- Modify: `scripts/run-browser-checks.mjs`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Produces: `parseBrowserCheckArgs(argv): { base: string; artifactOnly: boolean; measureOnly: boolean }`
- Produces: `npm run measure:browser`
- Consumes: three validated run documents and `aggregatePerformanceRuns`.

- [ ] **Step 1: Extend the failing CLI contracts**

Update existing expected objects to include `measureOnly: false`. Add:

```ts
it('parses standalone measurement mode', () => {
  expect(parseBrowserCheckArgs(['--measure-only', '--base=/'])).toEqual({
    artifactOnly: false,
    base: '/',
    measureOnly: true,
  });
});

it('rejects mutually exclusive runner modes', () => {
  expect(() => parseBrowserCheckArgs(['--artifact-only', '--measure-only']))
    .toThrow(/mutually exclusive/i);
});
```

- [ ] **Step 2: Run the parser test and verify RED**

Run `npm test -- scripts/browser-check-config.test.ts`.

Expected: FAIL because `measureOnly` and `--measure-only` are unsupported.

- [ ] **Step 3: Implement the mutually exclusive mode**

Track `measureOnly` beside `artifactOnly`, accept the exact flag once, reject duplicates, and reject both flags together after parsing. Return all three fields. Keep base normalization unchanged.

- [ ] **Step 4: Add a capture-capable child runner**

Refactor `runCheck` to accept `{ captureJson = false, env = {} }`. Ordinary and artifact checks retain inherited stdio. Captured checks pipe stdout, forward stderr, reject non-zero/signal exits, parse exactly one non-empty stdout line as JSON, and return the parsed document.

When `options.measureOnly`:

1. route preview output, headings, progress, and the completion line to stderr;
2. collect artifact sizes from `dist/assets` and stable-stringify them into `ARTIFACT_SIZE_JSON`;
3. run `browser-performance-probe-smoke.mjs` once;
4. run `smoke.mjs` three times with `MEASURE_BROWSER=1` and sample indices 0, 1, and 2;
5. validate and aggregate the three returned documents;
6. write exactly `stableStringify(report) + '\n'` to stdout;
7. skip the full interaction E2E because measurement wraps the isolated 29-scenario matrix, while ordinary `test:browser` continues to run E2E.

`finally` must still stop the preview. If `stopPreview()` reaches SIGKILL fallback in measurement mode, set a failing exit code and report that cleanup required forced termination.

- [ ] **Step 5: Add the package command**

Add this script without changing `verify`:

```json
"measure:browser": "npm run build --silent 1>&2 && node scripts/run-browser-checks.mjs --measure-only --base=/"
```

`--silent` suppresses npm banners and `1>&2` sends TypeScript/Vite build output to stderr under both npm's Windows command shell and POSIX shell. The runner then owns stdout and writes one JSON document.

- [ ] **Step 6: Document stable gates versus diagnostic measurement**

Add to the README local-development block:

```text
npm run measure:browser # build + 3-run production-browser JSON evidence (stdout)
```

After the browser-check paragraph, state that the command exercises the same 29 isolated scenarios with fixed inputs, reports min/median/max readiness and cadence plus CSS/resource ownership, writes progress to stderr and one JSON document to stdout, and is intentionally not a wall-clock CI gate.

In `CONTRIBUTING.md`, add one sentence after the `npm run verify` paragraph: use `npm run measure:browser` before and after capacity or lifecycle work, compare like-for-like environment/seed/viewport values, and never treat timing movement alone as a release failure.

- [ ] **Step 7: Run focused, ordinary, and measured verification**

Run:

```powershell
npm test -- scripts/browser-check-config.test.ts scripts/browser-performance-contract.test.ts scripts/dist-size-contract.test.ts
npm run build
npm run test:browser
$reportPath = Join-Path $env:TEMP 'j5mm-performance-report.json'
npm run measure:browser 1> $reportPath
@'
const fs = require('node:fs');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (report.schemaVersion !== 1) throw new Error('wrong schema');
if (report.sampleCount !== 3) throw new Error('wrong sample count');
if (report.scenarioCount !== 29) throw new Error('wrong scenario count');
console.error(`REPORT PASS — ${report.sampleCount} runs / ${report.scenarioCount} scenarios`);
'@ | node - $reportPath
git diff --check
```

Expected: focused tests PASS; ordinary browser output still reports 29 scenarios and full E2E; measurement progress appears on stderr; the redirected file parses as one JSON object and reports `REPORT PASS — 3 runs / 29 scenarios`; diff check is silent.

- [ ] **Step 8: Prove failure cleanup and stdout hygiene**

Temporarily invoke the runner with the probe smoke configured to leak its interval. Capture stdout and stderr separately. Expected: non-zero exit, leak label on stderr, no valid success report on stdout, no listening process on the selected preview port, and no SIGKILL cleanup success claim. Restore the intentional leak before committing and rerun Step 7.

- [ ] **Step 9: Commit the managed measurement command**

```powershell
git add scripts/browser-check-config.mjs scripts/browser-check-config.test.ts scripts/run-browser-checks.mjs package.json README.md CONTRIBUTING.md
git commit -m "feat: add managed browser performance measurement"
```

---

### Task 6: Capture the baseline and open the exact optimization continuation

**Files:**
- Read: temporary JSON emitted by `npm run measure:browser`
- Read: `src/`, `scripts/`, and `src/ui/style.css` candidates named by that JSON
- Create: `docs/superpowers/plans/2026-07-16-capacity-recovery.md` only after evidence identifies candidates
- Do not modify: production code, CSS, size ceilings, or the approved design during this task

**Interfaces:**
- Consumes: one validated three-run report from Task 5.
- Produces: a candidate-specific continuation plan with exact files, tests, expected byte recovery, and a final budget ratchet.

- [ ] **Step 1: Capture a fresh controlled baseline outside the repository**

Run:

```powershell
$baseline = Join-Path $env:TEMP 'j5mm-capacity-baseline.json'
npm run measure:browser 1> $baseline
node -e "const r=require(process.argv[1]); console.log(JSON.stringify({artifact:r.artifact,readiness:r.readiness,cadence:r.cadence,lifecycle:r.lifecycle,css:r.css},null,2))" $baseline
```

Expected: exit 0; three runs; 29 scenarios; JavaScript 204,183 gzip and CSS 10,091 gzip before optimization; finite readiness/cadence summaries; no ownership growth.

- [ ] **Step 2: Rank CSS candidates with corroborating source evidence**

For every unused CSS range large enough to matter, map its byte range back to the source selector, assign that observed selector or class name to `$candidate`, then run:

```powershell
rg -n --fixed-strings -- $candidate src scripts index.html
```

Reject any candidate used by dynamic class construction, pseudo states, media queries, reduced motion, short-screen layout, device gates, dialogs, error states, or browser-only flows. Record only candidates supported by the full coverage union and source search.

- [ ] **Step 3: Rank JavaScript and lifecycle candidates**

Use report resource/cadence/lifecycle rows plus source search to identify repeated work or leaked ownership. For every candidate, trace constructor, owner, disposer, and all callers with `rg -n` before including it. Do not infer dead code from minified output alone.

- [ ] **Step 4: Apply the continuation threshold**

Create the continuation plan only if corroborated candidates can plausibly recover at least 1,431 additional JavaScript gzip bytes and 491 additional CSS gzip bytes from the baseline, producing final totals no greater than 202,752 and 9,600 respectively. These deltas are the exact gaps between current measurements and approved targets.

If safe candidates do not plausibly reach both targets, do not edit production code and do not raise ceilings. Record the measured blocker in the continuation document, mark capacity recovery blocked by insufficient safe waste, and return for a new design decision.

- [ ] **Step 5: Write the exact candidate-specific continuation plan**

The continuation plan must use the writing-plans header and contain, for each selected candidate:

- exact production/CSS files and line anchors;
- the source/coverage evidence that makes the candidate safe;
- a failing focused test or browser assertion that protects its behavior;
- the exact edit, shown as code or CSS;
- pre/post `npm run size:check` and `npm run measure:browser` commands;
- the minimum expected gzip recovery;
- a final update changing `SIZE_BUDGETS` to JavaScript 202,752 and CSS 9,600 only after achieved output is at or below both values;
- `npm run verify`, original-resolution visual checks for presentation-sensitive CSS, documentation reconciliation, and Tranche 2 closure evidence.

- [ ] **Step 6: Verify the measurement phase and commit the continuation plan**

Run:

```powershell
npm run verify
npm run measure:browser 1> (Join-Path $env:TEMP 'j5mm-capacity-baseline-final.json')
git diff --check
git status --short
```

Expected: complete verify PASS; measurement again reports three runs and 29 scenarios; diff check is silent; only the continuation plan is uncommitted.

Commit:

```powershell
git add docs/superpowers/plans/2026-07-16-capacity-recovery.md
git commit -m "docs: plan evidence-led capacity recovery"
```

Do not begin the continuation in the same unchecked batch. Review its exact candidates against the saved baseline first.

---

## Plan Self-Review Checklist

- [ ] Every measurement-contract requirement in the approved spec maps to Tasks 1–5.
- [ ] The authoritative 29 scenarios are wrapped, not copied into a second matrix.
- [ ] Three-run aggregation, fixed seed/viewport, min/median/max, CSS union, artifact sizes, lifecycle ownership, and stdout/stderr separation have explicit owners.
- [ ] Ordinary browser, artifact, E2E, build, and verify behavior remain backward compatible.
- [ ] Wall-clock timing remains diagnostic while malformed data, lifecycle growth, cadence regressions, browser errors, and cleanup failures remain fatal.
- [ ] The plan contains no preselected production deletion before baseline evidence.
- [ ] Task 6 computes the exact current-to-target gaps: 1,431 JavaScript gzip bytes and 491 CSS gzip bytes.
- [ ] The continuation gate forbids raising ceilings or weakening quality when safe recovery is insufficient.
- [ ] No raw report, trace, screenshot, or measurement runtime enters the shipped artifact or commit.
- [ ] Function names and report fields are consistent across tasks.
