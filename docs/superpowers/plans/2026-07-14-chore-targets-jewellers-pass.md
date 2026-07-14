# Chore Target Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bedroom's placeholder tray, bin, and laundry basket with authored, named, draw-call-neutral procedural targets without changing any chore or interaction behavior.

**Architecture:** Create `src/host/chore-targets.ts` as the focused owner of the three Three.js builders. `room.ts` keeps world placement, target metadata, colliders, and placement slots. A production-browser smoke scenario inspects the real scene graph, exact interaction roots, geometry budgets, instance counts, colliders, slots, and the existing room draw-call ceiling.

**Tech Stack:** TypeScript, Three.js low-poly primitives and `InstancedMesh`, Playwright-driven browser smoke checks, Vitest, Vite.

## Global Constraints

- Add no CSS, asset, texture, font, dependency, shader, light, shadow map, event listener, timer, animation loop, or simulation state.
- Change no chore definitions, counts, prompts, scoring, schedule, director behavior, raycast reach, pickup/drop semantics, or persistence.
- Preserve target world positions exactly: tray `[0.05, 0, 1.72]`, bin `[1.95, 0, -1.1]`, basket `[-1.85, 0, 1.55]`.
- Preserve target ids, accepted chore slots, prompt names, placement slots, and bin/basket colliders.
- Keep target textures, lights, and shadow casters at zero.
- Keep the combined target footprint at exactly 8 meshes, no more than 25 instances, no more than 500 triangles, and no more than 128 room draw calls.
- Do not modify Mudwick, Mum, title, scorecard, HUD, rug, shell, furniture, audio, or input systems.

---

### Task 1: Pin the chore-target scene contract

**Files:**
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `window.__game.host.room.scene`, `room.interactables`, `room.colliders`, `room.slots`, and renderer metrics.
- Produces: a failing `bedroom chore targets stay authored, functional, and bounded` production-browser scenario.

- [ ] **Step 1: Add the failing browser scenario**

Insert the scenario immediately after `bedroom hero furniture preserves gameplay contracts`. Navigate with `{ skipTitle: 1, seed: '0xC0FFEE' }`, collect console/page errors, and evaluate the real scene:

```js
  await scenario(
    'bedroom chore targets stay authored, functional, and bounded',
    { viewport: { width: 1200, height: 800 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.host?.room?.scene);

      const state = await page.evaluate(() => {
        const host = window.__game.host;
        const scene = host.room.scene;
        const roots = [
          scene.getObjectByName('room-chore-tray'),
          scene.getObjectByName('room-chore-bin'),
          scene.getObjectByName('room-chore-basket'),
        ];
        const childNames = [
          ['room-chore-tray-bed', 'room-chore-tray-inset', 'room-chore-tray-rim'],
          ['room-chore-bin-shell', 'room-chore-bin-interior', 'room-chore-bin-rim'],
          ['room-chore-basket-base', 'room-chore-basket-slats', 'room-chore-basket-rim'],
        ];
        const textures = new Set();
        let meshCount = 0;
        let instanceCount = 0;
        let triangles = 0;
        let lights = 0;
        let casters = 0;
        for (const root of roots.filter(Boolean)) {
          root.traverse((object) => {
            if (object.isMesh) {
              meshCount++;
              const multiplier = object.isInstancedMesh ? object.count : 1;
              instanceCount += multiplier;
              const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
              triangles += Math.floor(primitives / 3) * multiplier;
              if (object.castShadow) casters++;
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              for (const material of materials) if (material?.map) textures.add(material.map.uuid);
            }
            if (object.isLight) lights++;
          });
        }
        const collider = (min, max) => host.room.colliders.some((box) => (
          Math.abs(box.min.x - min[0]) < 1e-6
          && Math.abs(box.min.y - min[1]) < 1e-6
          && Math.abs(box.min.z - min[2]) < 1e-6
          && Math.abs(box.max.x - max[0]) < 1e-6
          && Math.abs(box.max.y - max[1]) < 1e-6
          && Math.abs(box.max.z - max[2]) < 1e-6
        ));
        host.renderer.render(host.room.scene, host.camera);
        return {
          rootNames: roots.map((root) => root?.name),
          positions: roots.map((root) => root?.position.toArray()),
          childNames: roots.map((root, index) => childNames[index].map((name) => root?.getObjectByName(name)?.name)),
          targetContracts: roots.map((root) => root?.userData.interact),
          interactableMembership: roots.map((root) => host.room.interactables.filter((item) => item === root).length),
          instanceCounts: [
            roots[0]?.getObjectByName('room-chore-tray-rim')?.count,
            roots[2]?.getObjectByName('room-chore-basket-slats')?.count,
            roots[2]?.getObjectByName('room-chore-basket-rim')?.count,
          ],
          meshCount,
          instanceCount,
          triangles,
          textures: textures.size,
          lights,
          casters,
          binCollider: collider([1.77, 0, -1.28], [2.13, 0.4, -0.92]),
          basketCollider: collider([-2.15, 0, 1.25], [-1.55, 0.4, 1.85]),
          slots: Object.fromEntries(Object.entries(host.room.slots).map(([key, values]) => (
            [key, values.map((value) => value.toArray())]
          ))),
          roomCalls: host.renderer.info.render.calls,
          rendererTextures: host.renderer.info.memory.textures,
        };
      });

      assert.deepEqual(state.rootNames, ['room-chore-tray', 'room-chore-bin', 'room-chore-basket']);
      assert.deepEqual(state.positions, [[0.05, 0, 1.72], [1.95, 0, -1.1], [-1.85, 0, 1.55]]);
      assert.deepEqual(state.childNames, [
        ['room-chore-tray-bed', 'room-chore-tray-inset', 'room-chore-tray-rim'],
        ['room-chore-bin-shell', 'room-chore-bin-interior', 'room-chore-bin-rim'],
        ['room-chore-basket-base', 'room-chore-basket-slats', 'room-chore-basket-rim'],
      ]);
      assert.deepEqual(state.targetContracts, [
        { type: 'target', target: 'tray', accepts: 'mugs', name: 'tray' },
        { type: 'target', target: 'bin', accepts: 'wrappers', name: 'bin' },
        { type: 'target', target: 'basket', accepts: 'laundry', name: 'laundry basket' },
      ]);
      assert.deepEqual(state.interactableMembership, [1, 1, 1]);
      assert.deepEqual(state.instanceCounts, [4, 12, 4]);
      assert.equal(state.meshCount, 8);
      assert.ok(state.instanceCount <= 25, `target instance budget exceeded: ${state.instanceCount}`);
      assert.ok(state.triangles <= 500, `target triangle budget exceeded: ${state.triangles}`);
      assert.equal(state.textures, 0);
      assert.equal(state.lights, 0);
      assert.equal(state.casters, 0);
      assert.equal(state.binCollider, true);
      assert.equal(state.basketCollider, true);
      assert.deepEqual(state.slots, {
        tray: [[-0.13, 0.035, 1.72], [0.05, 0.035, 1.72], [0.23, 0.035, 1.72]],
        bin: [[1.95, 0.1, -1.1], [1.93, 0.16, -1.12], [1.97, 0.22, -1.08], [1.95, 0.28, -1.1]],
        basket: [[-1.85, 0.08, 1.55], [-1.83, 0.16, 1.53], [-1.87, 0.24, 1.57]],
      });
      assert.ok(state.roomCalls <= 128, `room draw-call budget exceeded: ${state.roomCalls}`);
      assert.ok(state.rendererTextures <= 12, `room texture budget exceeded: ${state.rendererTextures}`);
      assert.deepEqual(consoleProblems, []);
    },
  );
```

- [ ] **Step 2: Run RED**

```powershell
$node='C:\Users\aggis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node .\node_modules\vite\bin\vite.js build
& $node .\scripts\run-browser-checks.mjs
```

Expected: FAIL in `bedroom chore targets stay authored, functional, and bounded` because the named roots do not exist.

- [ ] **Step 3: Commit the red contract**

```powershell
git add scripts\smoke.mjs
git commit -m "test: pin the authored chore targets"
```

---

### Task 2: Build and integrate the authored targets

**Files:**
- Create: `src/host/chore-targets.ts`
- Modify: `src/host/room.ts`

**Interfaces:**
- Produces: `makeChoreTray(): THREE.Group`, `makeChoreBin(): THREE.Group`, and `makeLaundryBasket(): THREE.Group`.
- Consumes: `room.ts` keeps existing placement, `tagInteract`, collider, and slot contracts.

- [ ] **Step 1: Create the focused target module**

Create `src/host/chore-targets.ts`:

```ts
import * as THREE from 'three';

interface InstanceTransform {
  position: [number, number, number];
  scale: [number, number, number];
}

function lambert(color: number): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

function box(
  width: number,
  height: number,
  depth: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function instances(material: THREE.Material, transforms: readonly InstanceTransform[]): THREE.InstancedMesh {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, transforms.length);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < transforms.length; index++) {
    const transform = transforms[index]!;
    matrix.compose(
      new THREE.Vector3(...transform.position),
      new THREE.Quaternion(),
      new THREE.Vector3(...transform.scale),
    );
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

export function makeChoreTray(): THREE.Group {
  const tray = new THREE.Group();
  tray.name = 'room-chore-tray';

  const bed = box(0.56, 0.025, 0.36, lambert(0x8d6238), 0, 0.0125, 0);
  bed.name = 'room-chore-tray-bed';
  tray.add(bed);

  const inset = box(0.46, 0.012, 0.26, lambert(0x4d3320), 0, 0.031, 0);
  inset.name = 'room-chore-tray-inset';
  tray.add(inset);

  const rim = instances(lambert(0xb28757), [
    { position: [-0.265, 0.055, 0], scale: [0.03, 0.07, 0.36] },
    { position: [0.265, 0.055, 0], scale: [0.03, 0.07, 0.36] },
    { position: [0, 0.055, -0.165], scale: [0.5, 0.07, 0.03] },
    { position: [0, 0.055, 0.165], scale: [0.5, 0.07, 0.03] },
  ]);
  rim.name = 'room-chore-tray-rim';
  tray.add(rim);
  return tray;
}

export function makeChoreBin(): THREE.Group {
  const bin = new THREE.Group();
  bin.name = 'room-chore-bin';

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.13, 0.34, 12, 1, true),
    lambert(0x68767c),
  );
  shell.name = 'room-chore-bin-shell';
  shell.material.side = THREE.DoubleSide;
  shell.position.y = 0.17;
  bin.add(shell);

  const interior = new THREE.Mesh(new THREE.CircleGeometry(0.125, 12), lambert(0x202529));
  interior.name = 'room-chore-bin-interior';
  interior.rotation.x = -Math.PI / 2;
  interior.position.y = 0.315;
  bin.add(interior);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 12), lambert(0x8a979a));
  rim.name = 'room-chore-bin-rim';
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.335;
  bin.add(rim);
  return bin;
}

export function makeLaundryBasket(): THREE.Group {
  const basket = new THREE.Group();
  basket.name = 'room-chore-basket';

  const base = box(0.46, 0.035, 0.46, lambert(0x725034), 0, 0.0175, 0);
  base.name = 'room-chore-basket-base';
  basket.add(base);

  const slats: InstanceTransform[] = [];
  for (const offset of [-0.15, 0, 0.15]) {
    slats.push(
      { position: [offset, 0.17, -0.235], scale: [0.055, 0.29, 0.025] },
      { position: [offset, 0.17, 0.235], scale: [0.055, 0.29, 0.025] },
      { position: [-0.235, 0.17, offset], scale: [0.025, 0.29, 0.055] },
      { position: [0.235, 0.17, offset], scale: [0.025, 0.29, 0.055] },
    );
  }
  const slatMesh = instances(lambert(0xb28a55), slats);
  slatMesh.name = 'room-chore-basket-slats';
  basket.add(slatMesh);

  const rim = instances(lambert(0x8e673c), [
    { position: [-0.235, 0.33, 0], scale: [0.055, 0.055, 0.5] },
    { position: [0.235, 0.33, 0], scale: [0.055, 0.055, 0.5] },
    { position: [0, 0.33, -0.235], scale: [0.5, 0.055, 0.055] },
    { position: [0, 0.33, 0.235], scale: [0.5, 0.055, 0.055] },
  ]);
  rim.name = 'room-chore-basket-rim';
  basket.add(rim);
  return basket;
}
```

> **Verified implementation deviation:** Production-browser diagnosis found that the three-mesh bin raised the 1200×800 room composition from 128 to 129 calls, while Three's default non-uniform instance sphere raised the Mum doorway composition from 55 to 56. The shipped implementation therefore merges the bin interior and rim into one vertex-coloured `room-chore-bin-mouth` mesh while retaining named part anchors, derives every instance-batch sphere from its exact aggregate box, and adds three draw-call-free instance tones to repeated wooden members after visual proof exposed excessive uniformity. The browser contract pins the resulting eight-mesh target set, three-tone batches, 0.4-or-tighter basket-rim sphere, and both existing render ceilings.

- [ ] **Step 2: Replace only the inline target construction**

Add this import to `src/host/room.ts`:

```ts
import { makeChoreBin, makeChoreTray, makeLaundryBasket } from './chore-targets';
```

Replace the inline tray, bin, and basket geometry blocks with:

```ts
  // ---- tray by the door
  const tray = makeChoreTray();
  tray.position.set(0.05, 0, 1.72);
  scene.add(tray);
  tagInteract(tray, { type: 'target', target: 'tray', accepts: 'mugs', name: 'tray' });
  interactables.push(tray);

  // ---- bin (beside desk)
  const bin = makeChoreBin();
  bin.position.set(1.95, 0, -1.1);
  scene.add(bin);
  tagInteract(bin, { type: 'target', target: 'bin', accepts: 'wrappers', name: 'bin' });
  interactables.push(bin);
  colliders.push(colliderAt(1.95, -1.1, 0.36, 0.36, 0.4));

  // ---- laundry basket (south-west corner)
  const basket = makeLaundryBasket();
  basket.position.set(-1.85, 0, 1.55);
  scene.add(basket);
  tagInteract(basket, { type: 'target', target: 'basket', accepts: 'laundry', name: 'laundry basket' });
  interactables.push(basket);
  colliders.push(colliderAt(-1.85, 1.55, 0.6, 0.6, 0.4));
```

Do not change the slot block or any item spawns.

- [ ] **Step 3: Run GREEN browser and size gates**

```powershell
$node='C:\Users\aggis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node .\node_modules\vite\bin\vite.js build
& $node .\scripts\check-dist-size.mjs
& $node .\scripts\run-browser-checks.mjs
```

Expected: size budgets pass, all browser checks pass, the target scenario reports 8 meshes, 25 or fewer instances, 500 or fewer triangles, and the existing room draw-call ceiling remains green.

- [ ] **Step 4: Run unit and type checks**

```powershell
& $node .\node_modules\vitest\vitest.mjs run
& $node .\node_modules\typescript\bin\tsc --noEmit
```

Expected: all unit tests pass and TypeScript exits 0.

- [ ] **Step 5: Commit implementation**

```powershell
git add src\host\chore-targets.ts src\host\room.ts
git commit -m "feat: author the bedroom chore targets"
```

---

### Task 3: Prove, review, merge, and close

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Create ignored proof captures under: `shots/`

**Interfaces:**
- Consumes: production build, target scene contract, full interaction E2E, mounted-path build, and proof screenshots.
- Produces: inspected visual evidence, review findings, full verification evidence, local merge, and reflection.

- [ ] **Step 1: Reconcile the game-wide program record**

Update the Bedroom row in `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` to read:

```md
| Bedroom | Filmic Lambert response, authored vertex-coloured shell finish, contact grounding, hero furniture microfinish, authored chore targets, environment storytelling, woven rug | Shell material, hero furniture, and chore-target gaps repaired and browser-guarded locally | Preserve geometry/texture budgets and recapture |
```

Commit with:

```powershell
git add docs\superpowers\specs\2026-07-13-game-wide-jewellers-program-design.md
git commit -m "docs: reconcile the chore target jeweller's pass"
```

- [ ] **Step 2: Capture and inspect production proof**

Capture these ignored files from an owned production preview:

```text
shots/chore-targets-tray.png
shots/chore-targets-bin.png
shots/chore-targets-basket.png
shots/chore-targets-room.png
shots/chore-targets-mum-prompt.png
shots/chore-targets-report-backdrop.png
```

Use `?dev=room` for controlled close inspection and real game routes for the neutral/Mum/report compositions. Reject any frame with collapsed basket gaps, a capped-looking bin mouth, floating placed items, wall clipping, noisy contrast, or target prominence above the CRT/Mum.

- [ ] **Step 3: Run independent review and verify findings**

Use `superpowers:requesting-code-review` for a read-only review of:

```text
src/host/chore-targets.ts
src/host/room.ts
scripts/smoke.mjs
docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md
```

Review against this plan and the design spec. Use `/verify-findings` before changing code in response to any reviewer claim.

- [ ] **Step 4: Run the complete feature-branch release gate**

```powershell
$node='C:\Users\aggis\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node .\node_modules\vitest\vitest.mjs run
& $node .\node_modules\typescript\bin\tsc --noEmit
& $node .\node_modules\vite\bin\vite.js build
& $node .\scripts\check-dist-size.mjs
& $node .\scripts\run-browser-checks.mjs
& $node .\node_modules\typescript\bin\tsc --noEmit
& $node .\node_modules\vite\bin\vite.js build --base /just-five-more-minutes/
```

Expected: unit tests, typechecks, standalone build, gzip budgets, all isolated browser scenarios, full interaction E2E, and mounted-path build pass.

- [ ] **Step 5: Finish under the standing local-merge choice**

Use `superpowers:finishing-a-development-branch`, merge into local `master`, rerun the complete release gate on the merged tree, copy proof captures to the main ignored `shots/` directory, remove the owned `.worktrees/` worktree and feature branch, and append/validate the required reflection. Do not push or deploy.

