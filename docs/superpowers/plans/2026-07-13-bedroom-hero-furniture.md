# Bedroom Hero Furniture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the prototype desk chair and slab bed with bounded, low-poly hero furniture while preserving every gameplay, collider, and chore contract.

**Architecture:** Add `src/host/hero-furniture.ts` with focused `makeDeskChair()` and `makeBed()` factories. Keep `room.ts` responsible for placement, the chair's PC interaction, colliders, and chore staging; protect the visual factories with a failing browser contract before integration.

**Tech Stack:** TypeScript, Three.js 0.185.1, Vite, Vitest, Node.js browser smoke runner, Playwright

## Global Constraints

- Add no textures, external assets, runtime dependencies, lights, animation loops, post-processing, or shadow casters.
- Preserve the existing chair interaction tag, chair/bed world positions, colliders, contact-shadow footprints, player route, and bed-chore world positions.
- Name the roots `room-desk-chair` and `room-bed` and expose all diagnostic children named in the design spec.
- Keep the combined furniture roots between 12 and 18 traversed meshes, at most 32 expanded instances/meshes, and at most 1,200 triangles.
- Add no more than 10 first-camera draw calls and reject a median headless cadence regression greater than 15%.
- Keep the duvet top compatible with bed-chore props staged near world `y = 0.46`.

---

### Task 1: Lock the Furniture Contract in a Failing Browser Test

**Files:**
- Modify: `scripts/smoke.mjs`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `window.__game.host.room`, stable Three.js object names, and the existing `scenario`/`gotoOk` helpers.
- Produces: a browser scenario that pins structure, interaction membership, colliders, duvet relief, and local complexity budgets.

- [ ] **Step 1: Add the failing browser scenario**

Insert a scenario after the environment-detail scenario. Navigate with `{ skipTitle: 1, seed: '0xC0FFEE' }`, collect browser warnings/errors, and inspect `room-desk-chair`, `room-bed`, their named children, and the room's collider/interactable arrays.

Use this expanded-cost traversal for both roots:

```js
const metrics = { meshCount: 0, instanceCount: 0, triangles: 0, textures: new Set(), lights: 0, casters: 0 };
for (const root of [chair, bed]) {
  root?.traverse((object) => {
    if (object.isMesh) {
      metrics.meshCount++;
      const multiplier = object.isInstancedMesh ? object.count : 1;
      metrics.instanceCount += multiplier;
      const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
      metrics.triangles += Math.floor(primitives / 3) * multiplier;
      if (object.castShadow) metrics.casters++;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material?.map) metrics.textures.add(material.map.uuid);
    }
    if (object.isLight) metrics.lights++;
  });
}
```

Assert every required name, `chair.userData.interact.type === 'pc'`, chair membership in `room.interactables` equals one, bed-descendant membership equals zero, mesh count is 12–18, expanded count is at most 32, triangles are at most 1,200, and texture/light/caster counts are zero.

Assert exact collider extents within `1e-6` using `Box3.min/max`: chair `(0.65, 0, -1.2)` to `(1.15, 0.9, -0.7)` and bed `(-2.475, 0, -1.45)` to `(-1.425, 0.6, 0.65)`.

For `room-bed-duvet`, assert `material.vertexColors === true`, a `color` attribute exists, and its local position `z` values contain at least three distinct values when rounded to four decimals.

- [ ] **Step 2: Prove RED against the untouched room**

Run: `$env:SMOKE_URL='http://127.0.0.1:5179/'; node scripts/smoke.mjs`

Expected: preceding scenarios pass and the new scenario fails because `room-desk-chair` and `room-bed` do not exist.

- [ ] **Step 3: Commit the failing contract**

```powershell
git add -- scripts/smoke.mjs
git commit -m "test: define bedroom hero furniture contract"
```

### Task 2: Build the Hero Furniture Factories

**Files:**
- Create: `src/host/hero-furniture.ts`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Produces: `makeDeskChair(): THREE.Group` and `makeBed(): THREE.Group`.
- Produces named descendants: `room-chair-seat`, `room-chair-back`, `room-chair-base`, `room-bed-frame`, `room-bed-mattress`, `room-bed-headboard`, `room-bed-duvet`, and `room-bed-pillow`.
- Consumed by: `buildRoom` in Task 3.

- [ ] **Step 1: Add local construction helpers**

Define local `lambert`, `box`, and `instances` helpers. `instances` accepts transforms with `position`, `scale`, and optional `yaw`, composes matrices with a Y-axis quaternion, and returns one `THREE.InstancedMesh`.

- [ ] **Step 2: Build the chair factory**

Create a root named `room-desk-chair` at local origin. Add:

```ts
// Cushion: octagonal, slightly tapered and flattened along z.
new THREE.CylinderGeometry(0.27, 0.245, 0.08, 8)
// Back: low-segment padded capsule, flattened in depth.
new THREE.CapsuleGeometry(0.18, 0.22, 3, 8)
```

Place the seat at `y = 0.46`, scale its z axis to `0.82`, place the capsule back near `(0, 0.79, 0.19)` with scale `(1.08, 1, 0.18)`, and add a rear support. Build `room-chair-base` from a gas-lift cylinder, hub, one five-instance spoke mesh, and one five-instance low-poly caster mesh. Keep the total chair root at 6–8 traversed meshes.

- [ ] **Step 3: Build the sculpted duvet geometry**

Create `makeDuvetGeometry(): THREE.PlaneGeometry` from `PlaneGeometry(0.88, 1.14, 4, 5)`. For every vertex, set local z relief to:

```ts
0.018 + 0.014 * Math.sin((x + 0.44) * 8) + 0.01 * Math.cos((y + 0.57) * 6)
```

Assign deterministic purple vertex colours with lightness offsets derived from the vertex index, then call `computeVertexNormals()`.

- [ ] **Step 4: Build the bed factory**

Create a root named `room-bed`. Use one four-instance rail mesh and one four-instance leg mesh inside `room-bed-frame`. Add an inset mattress at local `(0, 0.34, 0)`, a headboard at `(0, 0.5, -0.99)`, the duvet rotated `-Math.PI / 2` at `(0, 0.445, 0.31)`, an aisle-side drape, and a flattened low-poly spherical pillow near `(0, 0.47, -0.66)`. Keep the combined chair/bed roots within the global budgets.

- [ ] **Step 5: Run static gates and commit**

Run: `npm test -- --run; npm run build`

Expected: 198 unit tests pass and TypeScript/Vite compile the unattached module.

```powershell
git add -- src/host/hero-furniture.ts
git commit -m "feat: build low-poly hero furniture"
```

### Task 3: Integrate Furniture Without Changing Gameplay

**Files:**
- Modify: `src/host/room.ts:1-4`
- Modify: `src/host/room.ts:1165-1185`
- Modify: `src/host/room.ts:1415-1420`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `makeDeskChair()` and `makeBed()` from `src/host/hero-furniture.ts`.
- Produces: named visual roots at the original chair/bed coordinates with unchanged room interaction and collider contracts.

- [ ] **Step 1: Replace the inline chair geometry**

Import both factories. Replace the four-box chair construction with:

```ts
const chair = makeDeskChair();
chair.position.set(0.9, 0, -0.95);
scene.add(chair);
tagInteract(chair, { type: 'pc' });
interactables.push(chair);
colliders.push(colliderAt(0.9, -0.95, 0.5, 0.5, 0.9));
```

- [ ] **Step 2: Replace the inline bed geometry**

Replace the four-box bed with `makeBed()`, keep `bed.position.set(-1.95, 0, -0.4)`, keep the collider call byte-for-byte, and delete the later standalone headboard mesh because the factory owns it.

- [ ] **Step 3: Prove GREEN in the candidate browser**

Start the worktree dev server on port 5180 and run: `$env:SMOKE_URL='http://127.0.0.1:5180/'; node scripts/smoke.mjs`

Expected: all browser smoke scenarios pass, including exact interaction/collider invariants and the local geometry budget.

- [ ] **Step 4: Run unit/build gates and commit**

Run: `npm test -- --run; npm run build`

```powershell
git add -- src/host/room.ts
git commit -m "feat: install bedroom hero furniture"
```

### Task 4: Render, Profile, Red-Team, and Close

**Files:**
- Verify: `src/host/hero-furniture.ts`
- Verify: `src/host/room.ts`
- Verify: `scripts/smoke.mjs`
- Artifact: `output/playwright/hero-furniture-final.png` (ignored evidence)

**Interfaces:**
- Consumes: baseline port 5179 and candidate port 5180.
- Produces: representative-angle visual evidence, fresh-process performance evidence, authoritative verification, and a clean local merge.

- [ ] **Step 1: Capture three representative angles**

Use one fresh browser and freeze `window.__devhost.paused = true`. Capture 1440 by 900 default, desk-side, and bed-facing views. Reject any render with chair/desk intersection, malformed instance transforms, melted duvet relief, pillow clipping, bed/wall overlap, floating feet, or choreography props below the duvet.

- [ ] **Step 2: Correct only proven visual defects**

Adjust transforms, dimensions, low-poly segment counts, or colours only inside `hero-furniture.ts`. After every visual edit, rerun build, the furniture browser scenario, and all representative captures invalidated by the edit.

- [ ] **Step 3: Profile baseline and candidate in fresh browser processes**

Measure three alternating baseline/candidate samples at 1000 by 700 with device scale 1, using a new Chromium process per sample. Record median requestAnimationFrame cadence, scene meshes, calls, triangles, geometries, and textures.

Expected hard bounds: candidate calls at most 131, furniture-local triangles at most 1,200, renderer textures remain 11, shadows remain disabled, and candidate median cadence is at least 85% of baseline.

- [ ] **Step 4: Run adversarial and authoritative verification**

Audit interaction membership, collider extents, duvet winding/relief, resource disposal, texture allocation, lights, shadow flags, and every removed inline furniture consumer. Then run:

```powershell
npm run verify
git diff --check
git status --short --branch
git log --oneline --decorate -10
```

Expected: 198 unit tests, all browser smokes, full interaction E2E, production/hub builds, and size budgets pass with no generated artifacts staged.

- [ ] **Step 5: Integrate and clean up**

Fast-forward the verified feature branch into local `master`, rerun unit tests on the merged hash, stop ports 5179/5180, remove the owned worktree, delete the merged branch, and leave push/deployment untouched.
