# Release Artifact Correctness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make standalone and mounted production artifacts fail fast on base-path/resource errors, and make `npm run verify` leave a root-previewable standalone `dist/`.

**Architecture:** Reuse the existing managed Vite preview process in `scripts/run-browser-checks.mjs`. Add a small pure CLI/base parser, parameterize the runner with Vite's native `--base`, and add an artifact-only Playwright smoke that checks real resources, boot state, console errors, and external requests. Package and CI orchestration will validate mounted output, rebuild standalone output, validate it again, and leave that standalone artifact in `dist/`.

**Tech Stack:** Node.js 22+, TypeScript 7, Vite 8.1.4, Vitest 4.1.10, Playwright 1.61.1, npm, GitHub Actions.

## Global Constraints

- Preserve `npm run build` as the standalone root artifact contract.
- Preserve `npm run build:hub` as the `/just-five-more-minutes/` artifact contract and its existing `dist/` location.
- `npm run verify` must finish with a standalone `dist/` that works through `npm run preview` at `/`.
- Keep the JavaScript ceiling at 204,800 gzip bytes and the CSS ceiling at 10,112 gzip bytes.
- Add no dependency, backend, external asset, analytics, or network-dependent runtime behavior.
- Do not change gameplay, progression, scoring, persistence, visual output, audio, input, or mobile support.
- Preview processes must bind to `127.0.0.1`, select an available port, prove ownership from Vite's banner, and stop cleanly on success or failure.
- Local mounted-artifact evidence is not a live deployment claim.

---

## File Structure

- Create `scripts/browser-check-config.mjs`: pure normalization and parsing for `--base=<path>` and `--artifact-only`.
- Create `scripts/browser-check-config.test.ts`: Vitest contracts for defaults, mounted paths, and unsafe or unknown arguments.
- Create `scripts/artifact-smoke.mjs`: one fresh Playwright context that proves HTML, resources, boot state, local-only requests, and clean console state.
- Modify `scripts/run-browser-checks.mjs`: pass the normalized base to Vite, construct the base-aware preview URL, and select the focused artifact smoke when requested.
- Modify `package.json`: expose standalone/mounted artifact probes and make `verify` restore and validate standalone output last.
- Modify `.github/workflows/ci.yml`: install Chromium, then run the same authoritative `npm run verify` command used locally.
- Modify `README.md`: document artifact probes and the final standalone `dist/` post-condition.
- Modify `CONTRIBUTING.md`: describe the actual CI/release gate rather than the stale unit/build-only claim.
- Modify `docs/superpowers/specs/2026-07-16-whole-product-foundations-first-enhancement-design.md`: append verified Tranche 1 closure evidence after all gates pass.

---

### Task 1: Base-aware browser-runner configuration

**Files:**
- Create: `scripts/browser-check-config.mjs`
- Create: `scripts/browser-check-config.test.ts`
- Modify: `scripts/run-browser-checks.mjs`

**Interfaces:**
- Produces: `normalizePreviewBase(raw: string): string`
- Produces: `parseBrowserCheckArgs(argv: readonly string[]): { base: string; artifactOnly: boolean }`
- Consumes: Vite preview's `--base <path>` option and existing `findAvailableLoopbackPort(preferredPort)`.

- [ ] **Step 1: Write the failing parser contracts**

Create `scripts/browser-check-config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  normalizePreviewBase,
  parseBrowserCheckArgs,
} from './browser-check-config.mjs';

describe('normalizePreviewBase', () => {
  it('keeps root and adds one trailing slash to a mounted path', () => {
    expect(normalizePreviewBase('/')).toBe('/');
    expect(normalizePreviewBase('/just-five-more-minutes')).toBe('/just-five-more-minutes/');
    expect(normalizePreviewBase('/just-five-more-minutes/')).toBe('/just-five-more-minutes/');
  });

  it('rejects non-path, ambiguous, or traversal-like values', () => {
    for (const value of [
      '',
      'just-five-more-minutes',
      '//example.test/game',
      '/game//nested',
      '/game/../admin',
      '/game?mode=1',
      '/game#fragment',
      '/game\\assets',
    ]) {
      expect(() => normalizePreviewBase(value)).toThrow(/preview base/i);
    }
  });
});

describe('parseBrowserCheckArgs', () => {
  it('defaults to the full standalone browser suite', () => {
    expect(parseBrowserCheckArgs([])).toEqual({ base: '/', artifactOnly: false });
  });

  it('parses the mounted artifact-only mode', () => {
    expect(parseBrowserCheckArgs([
      '--artifact-only',
      '--base=/just-five-more-minutes/',
    ])).toEqual({ base: '/just-five-more-minutes/', artifactOnly: true });
  });

  it('rejects unknown arguments', () => {
    expect(() => parseBrowserCheckArgs(['--grep=title'])).toThrow(/unknown browser-check argument/i);
  });

  it('rejects duplicate base arguments', () => {
    expect(() => parseBrowserCheckArgs(['--base=/', '--base=/game/'])).toThrow(
      /only one --base/i,
    );
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- scripts/browser-check-config.test.ts
```

Expected: FAIL because `scripts/browser-check-config.mjs` does not exist.

- [ ] **Step 3: Implement the pure configuration boundary**

Create `scripts/browser-check-config.mjs`:

```js
/** Normalize a same-origin Vite preview mount path. */
export function normalizePreviewBase(raw) {
  if (
    typeof raw !== 'string'
    || raw.length === 0
    || !raw.startsWith('/')
    || raw.startsWith('//')
    || raw.slice(1).includes('//')
    || raw.includes('?')
    || raw.includes('#')
    || raw.includes('\\')
    || raw.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`invalid preview base: ${JSON.stringify(raw)}`);
  }

  return raw === '/' ? '/' : `${raw.replace(/\/+$/, '')}/`;
}

/** Parse the deliberately small public CLI of the managed browser runner. */
export function parseBrowserCheckArgs(argv) {
  let artifactOnly = false;
  let baseRaw = null;

  for (const arg of argv) {
    if (arg === '--artifact-only') {
      artifactOnly = true;
      continue;
    }
    if (arg.startsWith('--base=')) {
      if (baseRaw !== null) throw new Error('only one --base argument is allowed');
      baseRaw = arg.slice('--base='.length);
      continue;
    }
    throw new Error(`unknown browser-check argument: ${arg}`);
  }

  return {
    base: normalizePreviewBase(baseRaw ?? '/'),
    artifactOnly,
  };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```powershell
npm test -- scripts/browser-check-config.test.ts
```

Expected: PASS with 1 test file and 6 tests.

- [ ] **Step 5: Parameterize the existing preview without changing default behavior**

In `scripts/run-browser-checks.mjs`, import the parser beside the port helper:

```js
import { parseBrowserCheckArgs } from './browser-check-config.mjs';
import { findAvailableLoopbackPort } from './available-port.mjs';
```

Replace the fixed preview URL initialization with:

```js
const options = parseBrowserCheckArgs(process.argv.slice(2));
const previewPort = await findAvailableLoopbackPort(4173);
const previewOrigin = `http://127.0.0.1:${previewPort}`;
const previewUrl = new URL(options.base, `${previewOrigin}/`).href;
```

Replace the Vite `spawn` argument array with:

```js
[
  viteBin,
  'preview',
  '--host',
  '127.0.0.1',
  '--port',
  String(previewPort),
  '--strictPort',
  '--base',
  options.base,
]
```

Do not use `options.artifactOnly` yet. Task 2 connects that mode when its smoke script exists.

- [ ] **Step 6: Re-run parser, default browser, and diff checks**

Run:

```powershell
npm test -- scripts/browser-check-config.test.ts
npm run build
npm run test:browser
git diff --check
```

Expected: parser tests PASS; the unchanged default path reports 29 isolated scenarios, the full interaction E2E, and `BROWSER CHECKS PASS`; diff check is silent.

- [ ] **Step 7: Commit the configuration boundary**

```powershell
git add scripts/browser-check-config.mjs scripts/browser-check-config.test.ts scripts/run-browser-checks.mjs
git commit -m "test: parameterize browser preview base"
```

---

### Task 2: Focused production-artifact resource smoke

**Files:**
- Create: `scripts/artifact-smoke.mjs`
- Modify: `scripts/run-browser-checks.mjs`

**Interfaces:**
- Consumes: `SMOKE_URL` containing the exact root or mounted preview URL.
- Produces: process exit 0 and `ARTIFACT PASS — <url>` only when HTML, same-origin resources, boot state, console, and page errors are clean.
- Produces: `--artifact-only` runner mode that owns and stops the same strict Vite preview as the full browser suite.

- [ ] **Step 1: Add the focused artifact browser probe**

Create `scripts/artifact-smoke.mjs`:

```js
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const targetUrl = new URL(process.env.SMOKE_URL ?? 'http://127.0.0.1:4173/');
const expectedOrigin = targetUrl.origin;
const failedResponses = [];
const externalRequests = [];
const runtimeErrors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1000, height: 700 } });
const page = await context.newPage();

page.on('request', (request) => {
  const requestUrl = new URL(request.url());
  if ((requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:')
      && requestUrl.origin !== expectedOrigin) {
    externalRequests.push(request.url());
  }
});
page.on('response', (response) => {
  if (!response.ok()) failedResponses.push(`${response.status()} ${response.url()}`);
});
page.on('console', (message) => {
  if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => runtimeErrors.push(`page: ${error.message}`));

try {
  const response = await page.goto(targetUrl.href, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  assert.equal(
    response?.status(),
    200,
    `expected 200 from ${targetUrl.href}, got ${response?.status()}`,
  );
  assert.deepEqual(failedResponses, [], `failed resources: ${failedResponses.join(', ')}`);
  assert.deepEqual(externalRequests, [], `unexpected external requests: ${externalRequests.join(', ')}`);
  assert.deepEqual(runtimeErrors, [], `runtime errors: ${runtimeErrors.join(', ')}`);

  const boot = await page.evaluate(() => ({
    hasGame: Object.prototype.hasOwnProperty.call(window, '__game'),
    roomCanvases: document.querySelectorAll('#room-canvas').length,
    titleScreens: document.querySelectorAll('.title-screen').length,
  }));
  assert.deepEqual(boot, { hasGame: true, roomCanvases: 1, titleScreens: 1 });

  console.log(`ARTIFACT PASS — ${targetUrl.href}`);
} finally {
  await context.close();
  await browser.close();
}
```

- [ ] **Step 2: Wire artifact-only selection into the managed runner**

In `scripts/run-browser-checks.mjs`, add:

```js
const artifactScript = fileURLToPath(new URL('./artifact-smoke.mjs', import.meta.url));
```

Replace the current check-selection body inside the top-level `try` with:

```js
await waitForPreview();
if (options.artifactOnly) {
  exitCode = await runCheck('artifact resource smoke', artifactScript, previewUrl);
} else {
  exitCode = await runCheck('isolated browser smoke', smokeScript, previewUrl);
  if (exitCode === 0) {
    const fullUrl = new URL(previewUrl);
    fullUrl.searchParams.set('speed', '10');
    fullUrl.searchParams.set('skipTitle', '1');
    fullUrl.searchParams.set('seed', String(0x00c0ffee));
    exitCode = await runCheck('full interaction E2E', e2eScript, fullUrl.href);
  }
}
```

Replace the final success message with:

```js
if (exitCode === 0) {
  console.log(options.artifactOnly
    ? '\nARTIFACT CHECK PASS — preview stopped cleanly'
    : '\nBROWSER CHECKS PASS — preview stopped cleanly');
}
```

- [ ] **Step 3: Prove the current artifact mismatch fails for the right reason**

Run:

```powershell
npm run build:hub
node scripts/run-browser-checks.mjs --artifact-only --base=/
```

Expected: FAIL. The probe reports a 404 under `/just-five-more-minutes/assets/...` while the preview is mounted at `/`, and the preview still stops cleanly.

- [ ] **Step 4: Prove the mounted artifact passes at its intended base**

Run:

```powershell
node scripts/run-browser-checks.mjs --artifact-only --base=/just-five-more-minutes/
```

Expected: `ARTIFACT PASS — http://127.0.0.1:<port>/just-five-more-minutes/` followed by clean preview shutdown.

- [ ] **Step 5: Prove the standalone artifact passes at root**

Run:

```powershell
npm run build
node scripts/run-browser-checks.mjs --artifact-only --base=/
```

Expected: `ARTIFACT PASS — http://127.0.0.1:<port>/` followed by clean preview shutdown.

- [ ] **Step 6: Re-run both runner branches and the size gate**

Run:

```powershell
npm test -- scripts/browser-check-config.test.ts
npm run size:check
npm run test:browser
git diff --check
```

Expected: 6 parser tests PASS; size remains 204,183 JavaScript gzip and 10,091 CSS gzip; all 29 isolated scenarios and the full E2E PASS; diff check is silent.

- [ ] **Step 7: Commit the artifact probe**

```powershell
git add scripts/artifact-smoke.mjs scripts/run-browser-checks.mjs
git commit -m "test: verify production artifact resources"
```

---

### Task 3: Authoritative local and CI orchestration

**Files:**
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `CONTRIBUTING.md`

**Interfaces:**
- Produces: `npm run test:artifact` for a current standalone `dist/`.
- Produces: `npm run test:artifact:hub` for a current mounted `dist/`.
- Produces: `npm run verify` that validates mounted output, rebuilds standalone output, rechecks size/resources, and leaves standalone `dist/` last.
- Produces: CI parity through the same `npm run verify` command.

- [ ] **Step 1: Record the orchestration RED against the mounted artifact**

Run:

```powershell
npm run build:hub
node scripts/run-browser-checks.mjs --artifact-only --base=/
```

Expected: FAIL with the mounted asset 404, proving that the current final-artifact state cannot satisfy the standalone post-condition.

- [ ] **Step 2: Add explicit artifact scripts and repair verification order**

In `package.json`, preserve every existing script and add or replace these exact entries:

```json
"test:browser": "node scripts/run-browser-checks.mjs",
"test:artifact": "node scripts/run-browser-checks.mjs --artifact-only --base=/",
"test:artifact:hub": "node scripts/run-browser-checks.mjs --artifact-only --base=/just-five-more-minutes/",
"test:watch": "vitest",
"typecheck": "tsc --noEmit",
"size:check": "node scripts/check-dist-size.mjs",
"verify": "npm test && npm run build && npm run size:check && npm run test:browser && npm run build:hub && npm run test:artifact:hub && npm run build && npm run size:check && npm run test:artifact"
```

Do not change dependencies or `package-lock.json`.

- [ ] **Step 3: Make CI execute the authoritative local gate**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v6
        with:
          node-version: 22
          cache: npm

      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run verify
```

- [ ] **Step 4: Reconcile README release-command truth**

In the `Local development` command block in `README.md`, replace the browser, verify, and preview lines with:

```text
npm run test:browser  # managed standalone preview + isolated smoke + full interaction E2E
npm run test:artifact # focused resource/boot smoke for the current standalone dist/
npm run verify        # full standalone + browser + mounted + final standalone artifact gate
npm run preview       # serve the standalone dist/ left by build or verify
```

Replace the paragraph beginning `Browser checks need Playwright's Chromium` with:

```markdown
Browser checks need Playwright's Chromium installed once (`npx playwright install chromium`). `npm run test:browser` starts and owns a strict local preview of the current standalone `dist/`, runs both browser suites, and stops the preview even if a check fails. `npm run test:artifact` is the focused resource and boot probe for a current standalone build. The complete `npm run verify` gate validates standalone behavior, validates a mounted `/just-five-more-minutes/` build at its real base path, then rebuilds and revalidates standalone `dist/` so `npm run preview` works at the documented root afterward.
```

- [ ] **Step 5: Reconcile the contributor CI contract**

Replace the final sentence under `Getting started` in `CONTRIBUTING.md` with:

```markdown
Run `npm run verify` before opening a PR. CI installs Chromium and runs the same authoritative gate: unit tests, type checks, standalone build and size budgets, production browser scenarios, full interaction E2E, mounted-base artifact smoke, and a final root-previewable standalone artifact.
```

- [ ] **Step 6: Run the repaired complete gate**

Run:

```powershell
npm run verify
```

Expected:

- 20 test files and 238 tests PASS.
- JavaScript remains 204,183 gzip bytes against 204,800 on both standalone size checks.
- CSS remains 10,091 gzip bytes against 10,112 on both standalone size checks.
- All 29 isolated browser scenarios PASS.
- Full E2E reports rows `[0 / 40 | 30 / 30 | 20 / 20 | 4 / 10]`, total `54 / 100`, and ending `Employee of the Month (This House)`.
- The mounted artifact probe passes at `/just-five-more-minutes/`.
- The final standalone artifact probe passes at `/`.
- Every owned preview stops cleanly.

- [ ] **Step 7: Inspect the final artifact and tracked scope**

Run:

```powershell
Select-String -Path dist/index.html -SimpleMatch '/just-five-more-minutes/assets/'
Select-String -Path dist/index.html -SimpleMatch './assets/'
git diff --check
git status --short
```

Expected: the mounted absolute asset pattern is absent; the standalone `./assets/` pattern is present; diff check is silent; only the four Task 3 files are modified.

- [ ] **Step 8: Commit orchestration and documentation truth**

```powershell
git add package.json .github/workflows/ci.yml README.md CONTRIBUTING.md
git commit -m "fix: leave a verified standalone artifact"
```

---

### Task 4: Record Tranche 1 closure and final evidence

**Files:**
- Modify: `docs/superpowers/specs/2026-07-16-whole-product-foundations-first-enhancement-design.md`

**Interfaces:**
- Consumes: the exact successful outputs from Task 3.
- Produces: durable Tranche 1 closure evidence and the handoff boundary for the evidence-specific Tranche 2 design.

- [ ] **Step 1: Append the verified closure record**

Append this section to `docs/superpowers/specs/2026-07-16-whole-product-foundations-first-enhancement-design.md` only after Task 3 matches the recorded results:

```markdown
## 2026-07-16 Tranche 1 release-artifact closure

The release gate now treats artifact mode as an observable contract. The managed Vite preview accepts an explicit normalized base, and a focused Playwright probe rejects failed resources, external requests, console/page errors, or a missing title/game/room boot state. The same owned preview lifecycle serves the full standalone suite and the focused standalone or mounted artifact probes.

`npm run verify` now validates the mounted build at `/just-five-more-minutes/`, rebuilds standalone output, repeats the size gate, validates the root artifact, and leaves that standalone `dist/` for `npm run preview`. CI installs Chromium and runs this same command. No dependency, lockfile, gameplay, visual, audio, input, persistence, scoring, or size ceiling changed.

Fresh local verification passed 20 test files / 238 tests, all 29 isolated browser scenarios, the full interaction E2E with `54 / 100` and `Employee of the Month (This House)`, both artifact probes, and clean preview teardown. The final standalone artifact remained 204,183 JavaScript gzip bytes and 10,091 CSS gzip bytes against unchanged 204,800-byte and 10,112-byte ceilings. This is local artifact evidence, not a live deployment claim.
```

- [ ] **Step 2: Run documentation and repository hygiene checks**

Run:

```powershell
rg -n -i "TBD|TODO|FIXME|placeholder" docs/superpowers/specs/2026-07-16-whole-product-foundations-first-enhancement-design.md
git diff --check
git status --short --branch
```

Expected: no placeholder matches; diff check is silent; only the design file is modified; the branch remains local and ahead of `origin/master`.

- [ ] **Step 3: Commit the closure record**

```powershell
git add docs/superpowers/specs/2026-07-16-whole-product-foundations-first-enhancement-design.md
git commit -m "docs: close release artifact tranche"
```

- [ ] **Step 4: Confirm the final handoff state**

Run:

```powershell
git status --short --branch
git log -5 --oneline
```

Expected: no task-owned changes; recent history contains the configuration, artifact probe, orchestration, and closure commits. Do not pull, push, open a PR, or deploy.

- [ ] **Step 5: Record the required process reflection**

Invoke the repository's `/reflect` skill with the completed Tranche 1 result, then validate every line in `.Codex\memory\reflections.jsonl` as JSON. The reflection must name one specific surprise and one actionable next-time change; it does not replace any verification above.
