# Bedroom Environment Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded procedural environment-art cluster that gives the first-camera bedroom a narrative wall focal point, believable desk mass, lower-window architecture, and a finished ceiling junction.

**Architecture:** Create `src/host/environment-details.ts` as a focused deterministic art factory returning one named `THREE.Group`, then attach it once from `buildRoom`. Protect its names, texture count, mesh budget, non-interactive status, and no-shadow contract in the existing Playwright smoke runner before implementing it.

**Tech Stack:** TypeScript, Three.js, Canvas 2D, Vite, Vitest, Node.js browser smoke runner, Playwright

## Global Constraints

- Add no external assets, network fetches, runtime dependencies, post-processing, lights, animation loops, colliders, or shadow casters.
- Preserve gameplay, interaction, chore staging, player pathing, lighting, dusk behaviour, and the current Lambert material contract.
- The root group must be named `room-environment-details` and contain `room-story-board`, `room-desk-drawers`, `room-radiator`, and `room-coving`.
- Add exactly one 256 by 160 sRGB canvas texture.
- Keep the detail root between 10 and 18 traversed meshes, at most 18 added draw calls, and below 1,200 added triangles.
- Reject the candidate if controlled headless frame cadence falls by more than 15% from the untouched baseline.

---

### Task 1: Lock the Environment-Art Contract in a Failing Browser Test

**Files:**
- Modify: `scripts/smoke.mjs`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `window.__game.host.room.scene`, `window.__game.host.renderer`, and stable Three.js object names.
- Produces: a smoke scenario that pins the detail root, its four clusters, one sRGB texture, a 10–18 mesh budget, four coving rails, and zero lights, casters, or interaction tags.

- [ ] **Step 1: Add the failing scenario**

Insert a scenario immediately after the existing bedroom-rendering scenario. Navigate with `{ skipTitle: 1, seed: '0xC0FFEE' }`, collect warning/error/pageerror events, and inspect the detail root with this traversal:

```js
const root = scene.getObjectByName('room-environment-details');
const clusters = [
  'room-story-board',
  'room-desk-drawers',
  'room-radiator',
  'room-coving',
].map((name) => root?.getObjectByName(name)?.name);
const textures = new Map();
let meshCount = 0;
let lights = 0;
let casters = 0;
let interactions = 0;
root?.traverse((object) => {
  if (object.isMesh) {
    meshCount++;
    if (object.castShadow) casters++;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (material?.map) textures.set(material.map.uuid, material.map.colorSpace);
    }
  }
  if (object.isLight) lights++;
  if (object.userData?.interact) interactions++;
});
```

Assert the exact root and cluster names, `meshCount >= 10 && meshCount <= 18`, `textureSpaces` equals `['srgb']`, `coving.children.length === 4`, and all light/caster/interaction counts are zero while renderer shadows remain disabled. Assert the collected console problem array is empty.

- [ ] **Step 2: Prove RED against the untouched room**

Run: `$env:SMOKE_URL='http://127.0.0.1:5179/'; node scripts/smoke.mjs`

Expected: the new scenario fails because `room-environment-details` does not exist; the preceding smoke scenarios remain green.

- [ ] **Step 3: Commit the failing contract**

```powershell
git add -- scripts/smoke.mjs
git commit -m "test: define bedroom environment detail contract"
```

### Task 2: Build the Procedural Detail Module

**Files:**
- Create: `src/host/environment-details.ts`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Produces: `makeEnvironmentDetails(): THREE.Group`.
- Produces stable descendants: `room-story-board`, `room-story-board-face`, `room-desk-drawers`, `room-radiator`, and `room-coving`.
- Consumed by: `buildRoom` in Task 3.

- [ ] **Step 1: Add focused material and geometry helpers**

Define a local `lambert(color)` helper and `box(width, height, depth, material)` helper. Define `instances(geometry, material, transforms)` returning an `InstancedMesh` whose matrices are composed from each `{ position, scale }`. Keep every material opaque.

- [ ] **Step 2: Create the single story-board texture**

Implement `makeStoryBoardTexture(): THREE.CanvasTexture` with a 256 by 160 canvas. Paint a muted cork base and deterministic flecks, then large graphic shapes representing a weekly timetable, Mudwick sketch, ticket, and two taped photos. Use no tiny body-copy rendering. Set `texture.colorSpace = THREE.SRGBColorSpace`. Throw `new Error('2D canvas unavailable for story board')` if the context is unavailable.

- [ ] **Step 3: Build the four named clusters**

Use these bounded placements and shapes:

```ts
storyBoard.position.set(-0.72, 1.55, -1.968); // 0.96 x 0.60 face + instanced frame
deskDrawers.position.set(0.28, 0, -1.6);      // cabinet + instanced fronts/handles
radiator.position.set(2.43, 0.48, 0.4);       // shallow body + instanced ribs + pipe/valve
```

Place four coving rails at `y = 2.54`: north/south rails are `5.0 x 0.08 x 0.08` at `z = +/-1.95`; east/west rails are `0.08 x 0.08 x 3.82` at `x = +/-2.45`. Name each cluster before adding it to the root. Keep the root's traversed mesh count within 10–18 and add no `userData.interact` keys.

- [ ] **Step 4: Run static verification before integration**

Run: `npm test -- --run; npm run build`

Expected: all existing unit tests pass and TypeScript/Vite compile the module without changing runtime behaviour because it is not attached yet.

- [ ] **Step 5: Commit the module**

```powershell
git add -- src/host/environment-details.ts
git commit -m "feat: build procedural bedroom detail cluster"
```

### Task 3: Attach the Detail Root and Prove the Contract Green

**Files:**
- Modify: `src/host/room.ts:1-3`
- Modify: `src/host/room.ts:880-925`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `makeEnvironmentDetails(): THREE.Group` from `src/host/environment-details.ts`.
- Produces: one static `room-environment-details` subtree in every room scene.

- [ ] **Step 1: Import and attach the factory**

Add `import { makeEnvironmentDetails } from './environment-details';` and call `scene.add(makeEnvironmentDetails());` after the room shell walls are added and before gameplay props are built.

- [ ] **Step 2: Prove GREEN against a candidate dev server**

Start the candidate server on port 5180 and run: `$env:SMOKE_URL='http://127.0.0.1:5180/'; node scripts/smoke.mjs`

Expected: all browser smoke scenarios pass with the required names, one sRGB texture, 10–18 meshes, four coving rails, and zero warnings/errors/lights/casters/interactions.

- [ ] **Step 3: Run unit and build gates**

Run: `npm test -- --run; npm run build`

Expected: all existing unit tests pass and the production build remains inside the JavaScript/CSS size budgets.

- [ ] **Step 4: Commit the integration**

```powershell
git add -- src/host/room.ts
git commit -m "feat: dress bedroom with environment details"
```

### Task 4: Render, Profile, Correct, and Close the Slice

**Files:**
- Verify: `src/host/environment-details.ts`
- Verify: `src/host/room.ts`
- Verify: `scripts/smoke.mjs`
- Artifact: `output/playwright/bedroom-environment-detail.png` (ignored evidence)

**Interfaces:**
- Consumes: untouched baseline URL on port 5179 and candidate URL on port 5180.
- Produces: full-size visual evidence, controlled same-process cost evidence, full verification output, and a clean integrated branch.

- [ ] **Step 1: Capture and inspect the clean host view**

Build and start an immutable preview, then capture `?dev=host` at 1440 by 900 with device scale 1. Reject the image for wall intersections, curtain/radiator collisions, a board that competes with the CRT, illegible visual noise, blocked chair space, a heavy coving border, or unchanged dead zones.

- [ ] **Step 2: Correct visual defects with bounded edits**

Adjust only transform, dimensions, colour, or canvas composition inside `src/host/environment-details.ts`. After every edit, rerun `npm run build`, the new browser scenario, and the full-size capture whose evidence the edit invalidated.

- [ ] **Step 3: Profile baseline and candidate in one Chromium process**

Open fresh alternating pages at 1000 by 700 with device scale 1, wait 500 milliseconds, and count `requestAnimationFrame` callbacks for two seconds. Record scene meshes, render calls, triangles, renderer textures, and cadence for each URL. Starting untouched evidence is 216 meshes, 108 calls, 3,628 triangles, 10 renderer textures, and approximately 30 headless rAF FPS.

Expected candidate bounds: at most 234 meshes, 126 calls, 4,828 triangles, 11 renderer textures, shadows disabled, and at least 85% of the same-process baseline cadence.

- [ ] **Step 4: Adversarially audit the finished change**

Search every new object for shadow flags, lights, interaction metadata, and unbounded canvas allocations. Confirm the new module has one responsibility and no duplicated gameplay configuration. Recheck the visual acceptance list from the design spec at full size.

- [ ] **Step 5: Run the authoritative closeout gate**

Run:

```powershell
npm run verify
git diff --check
git status --short --branch
git log --oneline --decorate -10
```

Expected: unit, build, size, browser smoke, full E2E, and hub build gates all pass; no generated browser artifacts are staged; the worktree contains only intentional source/docs history.

- [ ] **Step 6: Integrate locally and clean temporary processes**

Merge the verified feature branch into local `master`, stop the baseline/candidate/preview servers started for this slice, remove the temporary worktree, and leave push/deployment untouched.
