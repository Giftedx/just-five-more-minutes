# Night-Specific Household Props Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder Tuesday duvet targets, Wednesday wall phone, and Thursday curtain targets with authored procedural props while preserving every gameplay contract.

**Architecture:** Add one deterministic `night-props.ts` factory module, cover it with direct Vitest geometry-contract tests, and let `room.ts` retain all placement and interaction ownership. Extend the production browser smoke across the three relevant nights so factory quality and runtime wiring are both pinned.

**Tech Stack:** TypeScript 7, Three.js 0.185, Vitest 4, Playwright 1.61, Vite 8.

## Global Constraints

- Preserve tug IDs, chore slots, counts, labels, actions, world anchors, raycast membership, and completion behavior exactly.
- The phone remains non-interactive and appears only when `RoomNightConfig.phone` is true.
- Add no texture, canvas, light, shadow caster, Standard/Physical material, external asset, dependency, collider, or permanent-room redesign.
- Keep each night variant below 36 new meshes, 1,500 triangles, and 18 incremental draw calls.
- Preserve the existing JavaScript and CSS gzip gates and reject a matched-camera cadence regression greater than 5% beyond normal sampling noise.

---

### Task 1: Pin the procedural prop contracts

**Files:**
- Create: `src/host/night-props.test.ts`
- Create after RED: `src/host/night-props.ts`

**Interfaces:**
- Produces: `makeWallPhone(): THREE.Group`, `makeDuvetTug(side: 'left' | 'right'): THREE.Group`, and `makeCurtainTug(side: 'left' | 'right'): THREE.Group`.
- Produces stable roots `room-wall-phone`, `room-duvet-tug-left|right`, and `room-curtain-tug-left|right` plus descriptive named children.

- [ ] **Step 1: Write the failing direct factory tests**

Create tests that instantiate all five variants and assert:

```ts
expect(makeWallPhone().name).toBe('room-wall-phone');
expect(makeDuvetTug('left').name).toBe('room-duvet-tug-left');
expect(makeCurtainTug('right').name).toBe('room-curtain-tug-right');
```

Traverse the roots and assert the phone contains `room-phone-backplate`, `room-phone-handset`, `room-phone-keypad`, `room-phone-buttons`, and `room-phone-cord`; duvet variants contain `room-duvet-tug-body`, `room-duvet-tug-fold`, and `room-duvet-tug-shadow`; curtain variants contain `room-curtain-tug-body`, `room-curtain-tug-pleats`, `room-curtain-tug-band`, and `room-curtain-tug-tail`. Assert left/right tails have opposite `rotation.x` signs. Assert all descendants have zero textures/lights/casters, only Lambert/Basic materials, no `userData.interact`, no more than 36 meshes and 1,500 triangles combined, and distinct body shapes instead of the old box dimensions.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/host/night-props.test.ts`

Expected: FAIL because `./night-props` does not exist.

- [ ] **Step 3: Implement the minimum authored factories**

Create `src/host/night-props.ts` with shared `lambert`, `box`, naming, traversal-safe roots, and these constructions:

- phone: stepped cream backplate, dark keypad field, twelve raised buttons in one `InstancedMesh`, three-piece vertical handset with two round end details, two cradle hooks, and one dark `TubeGeometry` cord;
- duvet: a subdivided box whose top vertices are raised and biased into a low asymmetric cushion wedge, plus a folded lip and underside strip; mirror the fold bias by side;
- curtain: an eight-sided tapered cylinder scaled into a vertical gathered bundle, three pleat ribs in one `InstancedMesh`, a tie band, and a mirrored angled tail.

Name every root and child exactly as the tests require. Do not add interaction metadata in the factories.

- [ ] **Step 4: Run focused and full unit tests**

Run: `npm test -- src/host/night-props.test.ts`

Expected: PASS.

Run: `npm test`

Expected: all unit test files pass with no warnings or errors.

- [ ] **Step 5: Commit the factory**

```powershell
git add src/host/night-props.ts src/host/night-props.test.ts
git commit -m "feat: author night-specific household props"
```

### Task 2: Wire the factories without changing gameplay

**Files:**
- Modify: `src/host/room.ts:1-15,1097-1129`
- Modify: `scripts/smoke.mjs` after the existing hero-furniture scenario

**Interfaces:**
- Consumes the three Task 1 factories.
- Preserves `addTug(id, chore, name, action, obj, x, y, z)` and all current metadata.
- Produces per-night runtime roots discoverable by their stable names.

- [ ] **Step 1: Write the failing production-browser scenario**

Add one scenario that navigates separately to `night=1`, `night=2`, and `night=3`. For each night, inspect the live room scene and assert exact positions and contracts:

```js
assert.deepEqual(bedPositions, [[-1.68, 0.46, 0.42], [-2.22, 0.46, 0.32]]);
assert.deepEqual(curtainPositions, [[2.33, 1.35, -0.05], [2.33, 1.35, 0.85]]);
assert.deepEqual(phonePosition, [0.35, 1.35, 1.97]);
assert.equal(phoneInteraction, undefined);
```

Assert each tug root appears exactly once in `host.room.interactables`; assert its `userData.interact` remains `{ type: 'tug', itemId, chore, name, action }`; assert the phone appears only on Wednesday and zero times in `interactables`; and assert each relevant night stays under the mesh/triangle/texture/light/caster budgets with no console problems.

- [ ] **Step 2: Build and verify browser RED**

Run: `npm run build; npm run test:browser`

Expected: FAIL because the stable roots and authored child names are absent from the room scene.

- [ ] **Step 3: Replace only the placeholder constructors**

Import the factories in `room.ts`. Replace `rumple(...)` calls with `makeDuvetTug('left'|'right')`, replace `gather(...)` calls with `makeCurtainTug('left'|'right')`, and replace the inline three-box phone with `makeWallPhone()`. Keep all `addTug` arguments and phone position values byte-for-byte equivalent to the current contracts.

- [ ] **Step 4: Run browser and interaction verification**

Run: `npm run build; npm run test:browser`

Expected: 22 isolated browser scenarios and the full interaction E2E pass, with no console or page errors.

Run: `npm test`

Expected: all unit test files pass.

- [ ] **Step 5: Commit runtime wiring and smoke coverage**

```powershell
git add src/host/room.ts scripts/smoke.mjs
git commit -m "test: lock night prop runtime contracts"
```

### Task 3: Render, calibrate, and close the release gate

**Files:**
- Modify only if proof exposes a defect: `src/host/night-props.ts`
- Modify only if a newly discovered contract is missing: `src/host/night-props.test.ts`, `scripts/smoke.mjs`
- Create ignored proof files: `shots/night-props-bed.png`, `shots/night-props-phone.png`, `shots/night-props-curtains.png`

**Interfaces:**
- Consumes the production build and live `window.__game.host` scene/camera.
- Produces original-resolution proof captures and full release evidence.

- [ ] **Step 1: Capture matched production views**

Build standalone production output, start a strict loopback Vite preview, freeze `host.player.update`, hide non-canvas overlays, set the following 1400 by 900 cameras, render once, and capture the page:

```text
Tuesday bed: camera (-0.15, 1.35, 1.35), look at (-1.94, 0.46, 0.36)
Wednesday phone: camera (0.35, 1.45, 0.35), look at (0.35, 1.35, 1.97)
Thursday curtains: camera (0.90, 1.55, 0.40), look at (2.35, 1.38, 0.40)
```

Use a fresh browser context for each view and save the final proof under `shots/`.

- [ ] **Step 2: Inspect at original resolution and calibrate test-first**

Reject the bed if targets float, clip, or read as cubes; reject the phone if it reads as a thermostat/intercom; reject the curtains if the bundles read as shutters, obscure the moon, or detach from the panels. If a mechanical defect is found, extend the smallest relevant automated assertion, observe RED, then adjust only `night-props.ts` and repeat the production render.

- [ ] **Step 3: Profile and inspect runtime bounds**

At each matched camera, record render calls, triangles, textures, lights, shadow casters, and a repeated headless cadence sample. Confirm no night variant exceeds the stated budgets or materially regresses matched-camera median cadence by more than 5% beyond ordinary run-to-run noise.

- [ ] **Step 4: Run the complete release gate**

Run: `npm run verify`

Expected: all unit tests, TypeScript, standalone build, gzip checks, isolated browser scenarios, full interaction E2E, and mounted-path build pass.

- [ ] **Step 5: Adversarially review and commit any calibration**

Review factory boundaries, names, world anchors, per-night presence, target membership, interaction metadata, material types, disposal ownership, renderer budgets, visual silhouettes, and generated-file hygiene. Verify every actionable finding against source or a reproducing test before changing code.

If calibration changed tracked files:

```powershell
git add src/host/night-props.ts src/host/night-props.test.ts scripts/smoke.mjs
git commit -m "fix: calibrate night-specific household props"
```

- [ ] **Step 6: Confirm clean handoff state**

Run: `git status --short --branch`

Expected: clean feature branch with only ignored proof captures outside Git status.
