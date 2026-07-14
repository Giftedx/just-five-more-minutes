# Window Curtains Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the east window's four rigid curtain boxes and bare rod with a four-call procedural dressing that has sculpted pleats, hems, rings, and finials without changing gameplay.

**Architecture:** Add a pure `window-curtains.ts` factory that owns one merged fabric surface and three hardware batches. `room.ts` keeps the exact world anchor and all window/tug ownership; direct Vitest and production-browser smoke guard geometry, resources, culling, interaction isolation, and the global room-call ceiling.

**Tech Stack:** TypeScript 7, Three.js 0.185, Vitest 4, Playwright 1.61, Vite 8.

## Global Constraints

- Preserve the window frame, glow, mullion, sill, radiator, plant, camera, room navigation, and all Thursday tug contracts exactly.
- Position `room-window-curtains` at `[2.36, 0, 0.4]`; keep the rod world center `[2.36, 2.26, 0.4]` and span `1.74`.
- Produce exactly four meshes/draw calls, eight ring instances, two finial instances, and no more than 1,000 triangles.
- Add zero textures, lights, shadow casters, colliders, interaction tags, Standard/Physical materials, CSS, dependencies, external assets, or runtime animation.
- Keep representative room renders at or below 128 calls and preserve byte-identical CSS output.
- Reject a material median live-frame cadence regression greater than 5% beyond normal headless noise.

---

### Task 1: Build the procedural curtain factory test-first

**Files:**
- Create: `src/host/window-curtains.test.ts`
- Create after RED: `src/host/window-curtains.ts`

**Interfaces:**
- Produces: `makeWindowCurtains(): THREE.Group`.
- Produces root `room-window-curtains` and children `room-curtain-fabric`, `room-curtain-rings`, `room-curtain-rod`, `room-curtain-finials`.

- [ ] **Step 1: Write the failing factory contract**

Instantiate the factory and assert the exact root/child names. Traverse it and assert exactly four meshes, ten hardware instances, no more than 1,000 triangles, zero maps/lights/casters/interactions, only Lambert materials, and no array materials. Assert the fabric material has `vertexColors === true`, its geometry has color attributes and at least three distinct x depths, and its local bounding box covers the current `y=0.79..2.21` and `z=-0.92..0.92` curtain envelope.

For `room-curtain-rings` and `room-curtain-finials`, call `computeBoundingBox()` and compare each assigned `boundingSphere` to `boundingBox.getBoundingSphere(...)` with center/radius deltas no greater than `1e-9`. Assert ring count `8`, finial count `2`, and rod local transform `[0, 2.26, 0]` with `rotation.x === Math.PI / 2`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/host/window-curtains.test.ts`

Expected: FAIL because `./window-curtains` does not exist.

- [ ] **Step 3: Implement the four-call factory**

Create a panel-grid helper that appends two mirrored indexed surfaces into shared position, colour, and index arrays. Use seven vertical rows and six horizontal columns per side. At the top, the left panel spans local z `-0.88..-0.40` and the right `0.40..0.88`; at the bottom, taper them outward to `-0.92..-0.62` and `0.62..0.92`. Alternate local x depth between `-0.075`, `-0.035`, and `-0.055` across columns; add a restrained row sag no greater than `0.018`. Use alternating purple vertex colours with the bottom row darkened as a hem, compute normals/bounds, and render with one double-sided vertex-colour Lambert material.

Create eight `TorusGeometry(0.032, 0.007, 4, 8)` ring instances at local y `2.19`, x `-0.025`, and z values spanning each panel's top edge. Create one eight-sided cylinder rod of height `1.74`, rotated onto local z at y `2.26`. Create two faceted finial instances at local z `-0.9` and `0.9`. For both instance batches, compute aggregate boxes and replace default spheres with exact box-derived spheres.

- [ ] **Step 4: Run focused, type, and full unit gates**

Run: `npm test -- src/host/window-curtains.test.ts`

Expected: PASS.

Run: `npm run typecheck; npm test`

Expected: all type checks and all unit test files pass.

- [ ] **Step 5: Commit the factory**

```powershell
git add src/host/window-curtains.ts src/host/window-curtains.test.ts
git commit -m "feat: author the bedroom window curtains"
```

### Task 2: Integrate and browser-guard the permanent dressing

**Files:**
- Modify: `src/host/room.ts:1-10,1154-1165`
- Modify: `scripts/smoke.mjs` near the bedroom environment scenarios

**Interfaces:**
- Consumes `makeWindowCurtains()` from Task 1.
- Preserves the existing window scene objects and the separate Thursday tug roots.
- Produces one permanent root at exact world anchor `[2.36, 0, 0.4]`.

- [ ] **Step 1: Write the failing production-browser contract**

Add a scenario that navigates to a neutral night and Thursday. On the neutral night, find `room-window-curtains`, its four children, and inspect exact anchor, mesh/draw/instance/triangle/resource totals, fabric vertex colours/depths/bounds, exact ring/finial culling spheres, no collider, no interaction membership, and room calls `<=128`. On Thursday, assert the same permanent root still exists once and both existing tug roots retain their exact positions, metadata, memberships, and real E-key exercise coverage.

- [ ] **Step 2: Build and verify browser RED**

Run: `npm run build; npm run test:browser`

Expected: FAIL because `room-window-curtains` and its children do not exist.

- [ ] **Step 3: Replace only the inline permanent curtain block**

Import `makeWindowCurtains` in `room.ts`, remove the inline rod and four fabric boxes, create the root, set `root.position.set(2.36, 0, 0.4)`, and add it to the scene. Do not edit the window, night-prop, collider, interaction, or chore blocks.

- [ ] **Step 4: Run production browser and unit gates**

Run: `npm run build; npm run test:browser; npm test`

Expected: 24 isolated browser scenarios, full interaction E2E, and all unit tests pass with no console/page errors.

- [ ] **Step 5: Commit integration and runtime coverage**

```powershell
git add src/host/room.ts scripts/smoke.mjs
git commit -m "test: lock the authored window curtain contracts"
```

### Task 3: Calibrate, review, and close the release boundary

**Files:**
- Modify only if proof exposes a mechanically testable defect: `src/host/window-curtains.ts`, `src/host/window-curtains.test.ts`, `scripts/smoke.mjs`
- Modify after verification: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Create ignored proof: `shots/window-curtains-room.png`, `shots/window-curtains-close.png`, `shots/window-curtains-thursday.png`

**Interfaces:**
- Consumes the production build and live `window.__game.host` camera/renderer.
- Produces visual, performance, review, release, and truth-surface evidence.

- [ ] **Step 1: Capture production proof**

Build standalone output, launch one owned strict preview, and capture 1400 by 900 views with overlays hidden and player update frozen:

```text
Default room: shipped player spawn and camera
Close neutral window: camera (0.90, 1.55, 0.40), look at (2.35, 1.42, 0.40)
Thursday dressing: same close camera with night=3
```

Warm the WebGL process before saving the first proof image and use fresh browser contexts for the three final captures.

- [ ] **Step 2: Critique and calibrate test-first**

Reject panels that still read as slabs, noisy striped folds, floating rings, disconnected top edges, hidden moon/plant/radiator, or detached Thursday bundles. For a mechanical defect, add the smallest assertion that fails for the observed reason, run RED, change only the factory, rerun focused/full unit checks, rebuild, and recapture.

**Proof-driven deviation:** The first close Thursday capture proved that the preserved tug descendants themselves were the detached-bundle defect: compressed cylinders, bright box pleats, and a buried tie band. The accepted correction may therefore change `src/host/night-props.ts` and its direct test, but only for the body/pleat/band/tail visual descendants. It must preserve stable names, roots, anchors, metadata, membership, raycasting, completion transforms, chores, and scoring; spend no new draw calls, geometries, textures, lights, colliders, or dependencies; and add no more than the measured 48 Thursday triangles. Add a production-scene seam overlap/depth guard and rerun the real Thursday raycast-plus-E exercise after calibration.

- [ ] **Step 3: Measure baseline/candidate cost**

Compare distinct baseline/candidate build hashes on unique owned ports. Record full-scene calls/triangles/textures at default and close cameras plus four 240-frame live cadence windows. Confirm at least one saved permanent draw call, no new texture, identical median/p95 cadence within the 5% threshold, and CSS gzip remains exactly `10236` bytes.

- [ ] **Step 4: Independently review and verify findings**

Request a read-only review of the commit range against the design and plan. Require file/line evidence for contract drift, culling errors, false-pass budgets, winding/backface defects, raycast interference, visual intersections, or missed requirements. Apply `/verify-findings`; only reproduced survivors become changes.

- [ ] **Step 5: Run feature and merged release gates**

Run `npm run verify` on the clean feature branch. Reconcile the game-wide program record only after proof and review pass, commit it, fast-forward local `master`, rerun `npm run verify` on merged `master`, copy proof images, remove the owned worktree/branch, and append/validate the required reflection. Do not push or deploy.
