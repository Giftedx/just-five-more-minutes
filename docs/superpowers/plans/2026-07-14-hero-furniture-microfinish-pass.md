# Hero Furniture Microfinish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained authored micro-geometry to the bedroom bed and desk chair without changing gameplay, CSS, assets, textures, or render architecture.

**Architecture:** Keep all production model changes inside `src/host/hero-furniture.ts`. Extend the existing browser furniture scenario in `scripts/smoke.mjs` so real Three.js scene inspection proves the new detail exists while preserving interaction, collider, texture, shadow, mesh, instance, and triangle budgets.

**Tech Stack:** TypeScript, Three.js low-poly mesh primitives, Playwright-driven browser smoke checks, Vitest, Vite.

## Global Constraints

- Add no CSS, external raster asset, texture file, dependency, shader, post-processing pass, shadow map, event listener, timer, or animation loop.
- Preserve room dimensions, camera behavior, chair `pc` interaction, bed non-interactivity, room colliders, chore items, and all existing object names required by the current smoke scenario.
- Add no renderer texture memory.
- Keep furniture textures at zero, lights at zero, and shadow casters at zero.
- Keep furniture mesh count at or below 22, instance count at or below 36, and triangles at or below 1500.
- Do not modify Mudwick, title, scorecard, HUD, audio, reports, shell materials, rug, or gameplay systems in this tranche.

---

### Task 1: Pin the hero furniture microfinish contract

**Files:**
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `window.__game.host.room.scene`, `room-desk-chair`, `room-bed`, and existing furniture smoke metrics.
- Produces: stricter `bedroom hero furniture preserves gameplay contracts` assertions for named microfinish children.

- [ ] **Step 1: Add failing assertions**

In the existing `bedroom hero furniture preserves gameplay contracts` scenario:

1. Extend `chairChildren` with:

```js
          'room-chair-seat-stitch',
          'room-chair-back-stitch',
          'room-chair-back-handle',
```

2. Extend `bedChildren` with:

```js
          'room-bed-headboard-lip',
          'room-bed-pillow-seam',
          'room-bed-foot-throw',
```

3. Raise the bounded budget assertions:

```js
      assert.ok(state.meshCount >= 18 && state.meshCount <= 22, `furniture mesh budget exceeded: ${state.meshCount}`);
      assert.ok(state.instanceCount <= 36, `furniture instance budget exceeded: ${state.instanceCount}`);
      assert.ok(state.triangles <= 1500, `furniture triangle budget exceeded: ${state.triangles}`);
```

- [ ] **Step 2: Run RED**

```powershell
node .\node_modules\vite\bin\vite.js build
node .\scripts\run-browser-checks.mjs
```

Expected: FAIL in `bedroom hero furniture preserves gameplay contracts` because the named microfinish children do not exist yet.

- [ ] **Step 3: Commit the red contract**

```powershell
git add scripts\smoke.mjs
git commit -m "test: pin hero furniture microfinish"
```

---

### Task 2: Add restrained furniture micro-geometry

**Files:**
- Modify: `src/host/hero-furniture.ts`

**Interfaces:**
- Consumes: `box(...)`, `lambert(...)`, `makeDeskChair()`, and `makeBed()`.
- Produces: named, non-interactive child meshes under existing chair and bed roots.

- [ ] **Step 1: Add chair stitching and handle meshes**

In `makeDeskChair()`, after the chair back is added and before the support post, add:

```ts
  const stitchMat = lambert(0x2f3038);
  const seatStitch = box(0.36, 0.012, 0.018, stitchMat, 0, 0.507, -0.105);
  seatStitch.name = 'room-chair-seat-stitch';
  chair.add(seatStitch);

  const backStitch = box(0.25, 0.012, 0.018, stitchMat, 0, 0.83, 0.235);
  backStitch.name = 'room-chair-back-stitch';
  chair.add(backStitch);

  const backHandle = box(0.18, 0.035, 0.018, darkMetal, 0, 0.92, 0.24);
  backHandle.name = 'room-chair-back-handle';
  chair.add(backHandle);
```

- [ ] **Step 2: Add bed lip, pillow seam, and foot throw**

In `makeBed()`, add these meshes:

After the headboard is added:

```ts
  const headboardLip = box(0.98, 0.055, 0.085, wood, 0, 0.79, -1.0);
  headboardLip.name = 'room-bed-headboard-lip';
  bed.add(headboardLip);
```

After the duvet is added:

```ts
  const footThrow = box(0.82, 0.045, 0.18, lambert(0x5a3a72), 0, 0.505, 0.83);
  footThrow.name = 'room-bed-foot-throw';
  bed.add(footThrow);
```

After the pillow is added:

```ts
  const pillowSeam = box(0.58, 0.012, 0.018, lambert(0xcfc6b6), 0, 0.54, -0.52);
  pillowSeam.name = 'room-bed-pillow-seam';
  pillowSeam.rotation.y = -0.08;
  bed.add(pillowSeam);
```

- [ ] **Step 3: Run GREEN**

```powershell
node .\node_modules\vite\bin\vite.js build
node .\scripts\check-dist-size.mjs
node .\scripts\run-browser-checks.mjs
```

Expected: size budgets pass, all browser checks pass, and the furniture scenario reports the new detail names inside budget.

- [ ] **Step 4: Run unit and type checks**

```powershell
node .\node_modules\vitest\vitest.mjs run
node .\node_modules\typescript\bin\tsc --noEmit
```

Expected: 203 unit tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit implementation**

```powershell
git add src\host\hero-furniture.ts
git commit -m "feat: author hero furniture microfinish"
```

---

### Task 3: Prove, review, merge, and close

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Create ignored proof captures under: `shots/`

**Interfaces:**
- Consumes: production build, browser smoke runner, full interaction E2E, mounted-path build, and proof screenshots.
- Produces: inspected proof images, review notes, full verification evidence, local merge, and reflection.

- [ ] **Step 1: Reconcile the program record**

In `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`, update the Bedroom row to record that hero furniture microfinish is repaired and browser-guarded locally. Do not claim live deployment.

- [ ] **Step 2: Capture proof images**

Capture and inspect:

```text
shots/hero-furniture-microfinish-room.png
shots/hero-furniture-microfinish-mum-prompt.png
shots/hero-furniture-microfinish-report-backdrop.png
```

Use production preview. Use `?dev=room` for a neutral room proof if the game route immediately enters a Mum prompt.

- [ ] **Step 3: Run independent review**

Use `superpowers:requesting-code-review` for a bounded review of `scripts/smoke.mjs`, `src/host/hero-furniture.ts`, and the program doc. Verify every finding before changing code.

- [ ] **Step 4: Run full verification**

```powershell
node .\node_modules\vitest\vitest.mjs run
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\vite\bin\vite.js build
node .\scripts\check-dist-size.mjs
node .\scripts\run-browser-checks.mjs
node .\node_modules\typescript\bin\tsc --noEmit
node .\node_modules\vite\bin\vite.js build --base /just-five-more-minutes/
```

Expected: unit tests, typecheck, standalone build, JS/CSS gzip budgets, all isolated browser scenarios, full interaction E2E, final typecheck, and mounted-path build pass.

- [ ] **Step 5: Finish under the standing local-merge choice**

Use `superpowers:finishing-a-development-branch`, merge the feature branch into local `master`, rerun the full release gate on the merged tree, remove the linked worktree and feature branch, clean generated scratch artifacts, and append the required reflection. Do not push or deploy.
