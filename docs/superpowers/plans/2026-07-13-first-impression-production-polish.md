# First-Impression Production Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the complete title composition visible on normal desktop displays, make keyboard focus unmistakable, and make the managed browser gate independent of port 4173 availability.

**Architecture:** Preserve the current title DOM and visual language. Add a height-aware CSS composition and prevent focused controls from changing the initial scroll position. Extract loopback-port selection into a deterministic Node helper used by the browser runner.

**Tech Stack:** TypeScript 7, CSS, Node.js ESM, Vitest 4, Playwright 1.61, Vite 8.

## Global Constraints

- Preserve the procedural, dependency-free art pipeline and the existing screen-versus-hall title signature.
- Do not weaken the 900px width device gate.
- At 1280x720 and 1000x700, `.title-card` must start at `scrollTop === 0` and have `scrollHeight <= clientHeight`.
- At shorter supported heights, autofocus must not scroll the card away from its header.
- Existing reduced-motion behavior and browser scenarios must remain green.
- The browser runner must prefer 4173 when free and use an available loopback port when it is occupied.

---

### Task 1: Resilient managed preview port

**Files:**
- Create: `scripts/available-port.mjs`
- Create: `scripts/available-port.test.ts`
- Modify: `scripts/run-browser-checks.mjs`

**Interfaces:**
- Produces: `findAvailableLoopbackPort(preferredPort: number): Promise<number>`.
- Consumes: the returned port in every Vite argument, readiness banner check, readiness fetch, and `SMOKE_URL` passed to child scripts.

- [ ] **Step 1: Write the failing unit test**

```ts
import { createServer } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { findAvailableLoopbackPort } from './available-port.mjs';

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe('findAvailableLoopbackPort', () => {
  it('keeps the preferred port when it is free', async () => {
    const port = await findAvailableLoopbackPort(0);
    expect(port).toBeGreaterThan(0);
  });

  it('moves away from an occupied preferred port', async () => {
    const occupied = createServer();
    servers.push(occupied);
    await new Promise<void>((resolve, reject) => {
      occupied.once('error', reject);
      occupied.listen(0, '127.0.0.1', resolve);
    });
    const address = occupied.address();
    if (!address || typeof address === 'string') throw new Error('missing occupied port');

    const selected = await findAvailableLoopbackPort(address.port);

    expect(selected).not.toBe(address.port);
    expect(selected).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run scripts/available-port.test.ts`

Expected: FAIL because `scripts/available-port.mjs` does not exist.

- [ ] **Step 3: Implement the allocator**

```js
import { createServer } from 'node:net';

const HOST = '127.0.0.1';

const probe = (port) => new Promise((resolve, reject) => {
  const server = createServer();
  server.unref();
  server.once('error', reject);
  server.listen(port, HOST, () => {
    const address = server.address();
    const selected = address && typeof address !== 'string' ? address.port : null;
    server.close((error) => error ? reject(error) : resolve(selected));
  });
});

export async function findAvailableLoopbackPort(preferredPort) {
  try {
    const preferred = await probe(preferredPort);
    if (preferred !== null) return preferred;
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EADDRINUSE') throw error;
  }
  const fallback = await probe(0);
  if (fallback === null) throw new Error('Could not allocate a loopback preview port');
  return fallback;
}
```

Update `scripts/run-browser-checks.mjs` to await `findAvailableLoopbackPort(4173)`, construct `previewUrl` from it, pass the port to Vite, and match the dynamic listening banner.

- [ ] **Step 4: Verify GREEN and the original reproduction**

Run: `npx vitest run scripts/available-port.test.ts`

Expected: 2 passing tests.

Run while 4173 remains occupied: `npm run test:browser`

Expected: the preview announces another loopback port and both browser checks pass.

- [ ] **Step 5: Commit**

```powershell
git add scripts/available-port.mjs scripts/available-port.test.ts scripts/run-browser-checks.mjs
git commit -m "test: isolate browser preview ports"
```

### Task 2: Height-safe title composition

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `src/ui/style.css`
- Modify: `src/ui/title.ts`

**Interfaces:**
- Consumes: existing `.title-card`, `.title-header`, `.title-scene`, `.title-week`, `.title-controls`, and `.title-footer` nodes.
- Produces: an initial title state with zero scroll and no overflow at 1000x700; `Begin` remains focused.

- [ ] **Step 1: Add a failing browser geometry scenario**

Add a 1000x700 scenario after the school-week strip scenario. Load the title, wait for `.title-begin`, then assert:

```js
const geometry = await page.evaluate(() => {
  const card = document.querySelector('.title-card');
  const header = document.querySelector('.title-header');
  const footer = document.querySelector('.title-footer');
  const cardRect = card.getBoundingClientRect();
  return {
    scrollTop: card.scrollTop,
    clientHeight: card.clientHeight,
    scrollHeight: card.scrollHeight,
    headerTop: header.getBoundingClientRect().top,
    footerBottom: footer.getBoundingClientRect().bottom,
    cardTop: cardRect.top,
    cardBottom: cardRect.bottom,
    beginFocused: document.activeElement === document.querySelector('.title-begin'),
  };
});
assert.equal(geometry.scrollTop, 0);
assert.ok(geometry.scrollHeight <= geometry.clientHeight, JSON.stringify(geometry));
assert.ok(geometry.headerTop >= geometry.cardTop, JSON.stringify(geometry));
assert.ok(geometry.footerBottom <= geometry.cardBottom, JSON.stringify(geometry));
assert.equal(geometry.beginFocused, true);
```

- [ ] **Step 2: Run smoke against the existing dev server and verify RED**

Run: `$env:SMOKE_URL='http://127.0.0.1:5174/'; node scripts/smoke.mjs`

Expected: FAIL because the title card scrolls to the focused button and overflows.

- [ ] **Step 3: Preserve focus without scrolling**

Change the title focus call to:

```ts
beginButton?.focus({ preventScroll: true });
```

- [ ] **Step 4: Add the short-desktop composition**

Add an `@media (max-height: 800px) and (min-width: 681px)` block that reduces card padding, vertical margins, live-CRT dimensions, quote spacing, week-strip spacing, control spacing, and footer spacing. Keep both title-scene columns visible. At `max-height: 640px`, allow intentional scrolling but retain `scrollTop === 0` through `preventScroll`.

- [ ] **Step 5: Run the smoke scenario and verify GREEN**

Run: `$env:SMOKE_URL='http://127.0.0.1:5174/'; node scripts/smoke.mjs`

Expected: all isolated scenarios pass, including the title geometry scenario.

- [ ] **Step 6: Commit**

```powershell
git add scripts/smoke.mjs src/ui/style.css src/ui/title.ts
git commit -m "fix: keep the title composed on short desktops"
```

### Task 3: Complete keyboard-visible interaction states

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: `.hud-prompt-option` and `.title-reset` buttons.
- Produces: visible focus outlines that are distinct from hover-only styling.

- [ ] **Step 1: Extend browser smoke with computed focus checks**

Focus `.title-reset` on the title scenario and assert its computed `outlineStyle` is not `none`. In the dialogue scenario, focus the first `.hud-prompt-option` and assert the same.

- [ ] **Step 2: Run smoke and verify RED**

Run: `$env:SMOKE_URL='http://127.0.0.1:5174/'; node scripts/smoke.mjs`

Expected: FAIL because neither control has a `:focus-visible` rule.

- [ ] **Step 3: Implement the focus states**

```css
.hud-prompt-option:focus-visible,
.title-reset:focus-visible {
  outline: 2px solid rgba(255, 220, 120, 0.92);
  outline-offset: 3px;
}

.hud-prompt-option:focus-visible {
  background: linear-gradient(to bottom, rgba(120, 92, 44, 0.95), rgba(86, 64, 30, 0.95));
  border-color: rgba(255, 220, 130, 0.72);
}
```

Raise the idle reset text color from `#6a6274` to `#9b90a6` so the affordance does not disappear into the card.

- [ ] **Step 4: Verify GREEN and commit**

Run: `$env:SMOKE_URL='http://127.0.0.1:5174/'; node scripts/smoke.mjs`

Expected: all scenarios pass.

```powershell
git add scripts/smoke.mjs src/ui/style.css
git commit -m "fix: expose keyboard focus in game prompts"
```

### Task 4: Full verification and visual QA

**Files:**
- Modify only if a verification failure proves a scoped regression.

**Interfaces:**
- Consumes: the complete repository gate and live local render.
- Produces: fresh evidence, screenshots, and an explicit residual-risk list.

- [ ] **Step 1: Run the full release gate**

Run: `npm run verify`

Expected: unit tests, standalone build, size gate, isolated browser smoke, full interaction E2E, and mounted build all pass.

- [ ] **Step 2: Capture representative screenshots**

Capture settled title screens at 1280x720 and 1440x900 and a room prompt state. Confirm no title scrollbar at normal desktop heights, no clipped metadata, no console errors, and visible keyboard focus.

- [ ] **Step 3: Adversarial review**

Recheck the spec line by line. Confirm that browser-port ownership, reduced motion, scorecard reachability, and short-height intentional scrolling were not weakened. State clearly that the procedural room remains below literal AAA asset quality.

- [ ] **Step 4: Record the required reflection**

Use `/reflect` to append one valid JSON line with `date`, `task`, `outcome`, `surprise`, and `next-time`.
