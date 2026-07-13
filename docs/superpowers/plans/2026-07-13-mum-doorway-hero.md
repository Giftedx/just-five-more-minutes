# Mum Doorway Hero Vignette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the blockout-quality Mum reveal with a bounded, authored low-poly character-and-hallway vignette without changing gameplay.

**Architecture:** Move Mum's procedural model into a focused `mum-doorway.ts` module that owns the character, reveal-only hallway dressing, practical/fill lights, and idle animation. `room.ts` keeps the existing hall volume, door, collider, and public `Room` contract, and delegates only visual construction and reveal toggling. A production-browser scenario protects names, projection, visibility, motion, non-interactivity, and rendering budgets.

**Tech Stack:** TypeScript 7, Three.js 0.185.1 procedural geometry, Node.js ESM, Playwright 1.61.1, Vite 8.1.4, Vitest 4.1.10

## Global Constraints

- Keep the procedural low-poly style; add no imported model, image asset, font, dependency, post-processing, skeletal rig, or shadow map.
- Preserve Mum's dialogue, timing, suspicion logic, audio, response UI, camera, player movement, door collider, and interaction model.
- Preserve the rose cardigan, cream blouse, navy skirt, tights, slippers, bun, gold studs, skeptical eyebrow, and tea towel.
- Keep the character under 45 meshes and 2,500 triangles.
- Keep reveal-only hallway dressing under 16 meshes and 900 triangles.
- Add no more than one texture beyond the existing face texture.
- Add no shadow casters and do not enable renderer shadows.
- Keep the staged doorway view under 55 draw calls, 4,000 visible triangles, and 14 renderer textures.
- Keep `Room.npcSilhouette`, `Room.npcTick`, and `Room.setHallLight` externally compatible.
- Keep all new GPU resources below the room scene so `HostApp.dispose` continues to own cleanup.

---

## File responsibilities

- `src/host/mum-doorway.ts` owns the character, hallway dressing, two reveal lights, stable authored names, and bounded idle animation.
- `src/host/room.ts` owns the hall volume, door leaf, swing target, collider, scene placement, and the existing public room hooks.
- `scripts/smoke.mjs` owns browser-observed visual structure, projection, visibility, animation, interaction, shadow, texture, and render-budget contracts.
- `docs/superpowers/specs/2026-07-13-mum-doorway-hero-design.md` is the approved visual and scope contract.

### Task 1: Add a browser contract that fails on the blockout

**Files:**
- Modify: `scripts/smoke.mjs` after the existing dialogue-staging scenario

**Interfaces:**
- Consumes: `window.__game.host.room`, `Room.npcSilhouette`, `Room.npcTick`, `Room.setHallLight`, renderer diagnostics, colliders, and interactables.
- Produces: the scenario `Mum doorway vignette stays authored, animated, inert, and bounded`.

- [ ] **Step 1: Add shared measurement inside the new scenario**

Stage the shipped reveal through its existing public hooks and collect descendants without mutating scene construction:

```js
  await scenario(
    'Mum doorway vignette stays authored, animated, inert, and bounded',
    { viewport: { width: 900, height: 600 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          const text = message.text();
          if (!text.includes('requestPointerLock')) consoleProblems.push(`${message.type()}: ${text}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.room?.scene);
      await page.evaluate(() => {
        const host = window.__game['host'];
        host.player.yaw = Math.PI;
        host.player.pitch = 0;
        host.player['apply']();
        host.room.npcSilhouette.visible = true;
        host.room.setHallLight(true);
      });
      await page.waitForTimeout(350);

      const measure = () => page.evaluate(() => {
        const host = window.__game['host'];
        const root = host.room.scene.getObjectByName('room-mum-doorway');
        const mum = host.room.scene.getObjectByName('mum-character');
        const hall = host.room.scene.getObjectByName('mum-hall-dressing');
        const names = [
          'mum-head', 'mum-torso', 'mum-upper-arm-left', 'mum-upper-arm-right',
          'mum-forearm-left', 'mum-forearm-right', 'mum-hand-left', 'mum-hand-right',
          'mum-tea-towel', 'mum-skirt', 'mum-footwear', 'mum-hall-practical',
          'mum-hall-runner', 'mum-hall-threshold', 'mum-hall-skirting',
          'mum-hall-domestic-detail', 'mum-contact-cue',
        ];
        const metrics = (target) => {
          let meshes = 0;
          let triangles = 0;
          let casters = 0;
          let lights = 0;
          const textures = new Set();
          target?.traverse((object) => {
            if (object.isMesh) {
              meshes++;
              const multiplier = object.isInstancedMesh ? object.count : 1;
              const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
              triangles += Math.floor(primitives / 3) * multiplier;
              if (object.castShadow) casters++;
              for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                if (material?.map) textures.add(material.map.uuid);
              }
            }
            if (object.isLight) lights++;
          });
          return { meshes, triangles, casters, lights, textures: textures.size };
        };
        const belongsTo = (object, target) => {
          for (let cursor = object; cursor; cursor = cursor.parent) if (cursor === target) return true;
          return false;
        };
        const points = [];
        mum?.updateWorldMatrix(true, true);
        mum?.traverse((object) => {
          if (!object.isMesh) return;
          object.geometry.computeBoundingBox();
          const box = object.geometry.boundingBox;
          if (!box) return;
          for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = box.min.clone().set(x, y, z);
              object.localToWorld(point);
              point.project(host.camera);
              points.push({ x: (point.x * 0.5 + 0.5) * innerWidth, y: (-point.y * 0.5 + 0.5) * innerHeight });
            }
          }
        });
        host.renderer.render(host.room.scene, host.camera);
        return {
          rootName: root?.name,
          mumName: mum?.name,
          hallName: hall?.name,
          namedParts: names.map((name) => root?.getObjectByName(name)?.name),
          rootVisible: root?.visible,
          mum: metrics(mum),
          hall: metrics(hall),
          projected: {
            left: Math.min(...points.map((point) => point.x)),
            right: Math.max(...points.map((point) => point.x)),
            top: Math.min(...points.map((point) => point.y)),
            bottom: Math.max(...points.map((point) => point.y)),
          },
          interactions: root ? host.room.interactables.filter((object) => belongsTo(object, root)).length : 0,
          colliders: host.room.colliders.length,
          calls: host.renderer.info.render.calls,
          triangles: host.renderer.info.render.triangles,
          rendererTextures: host.renderer.info.memory.textures,
          shadowsEnabled: host.renderer.shadowMap.enabled,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
        };
      });
```

- [ ] **Step 2: Assert structure, bounds, and budgets**

```js
      const before = await measure();
      assert.equal(before.rootName, 'room-mum-doorway');
      assert.equal(before.mumName, 'mum-character');
      assert.equal(before.hallName, 'mum-hall-dressing');
      assert.deepEqual(before.namedParts, [
        'mum-head', 'mum-torso', 'mum-upper-arm-left', 'mum-upper-arm-right',
        'mum-forearm-left', 'mum-forearm-right', 'mum-hand-left', 'mum-hand-right',
        'mum-tea-towel', 'mum-skirt', 'mum-footwear', 'mum-hall-practical',
        'mum-hall-runner', 'mum-hall-threshold', 'mum-hall-skirting',
        'mum-hall-domestic-detail', 'mum-contact-cue',
      ]);
      assert.equal(before.rootVisible, true);
      assert.ok(before.mum.meshes <= 45 && before.mum.triangles <= 2500, JSON.stringify(before));
      assert.equal(before.mum.textures, 1);
      assert.ok(before.hall.meshes <= 16 && before.hall.triangles <= 900, JSON.stringify(before));
      assert.ok(before.hall.textures <= 1);
      assert.equal(before.mum.casters + before.hall.casters, 0);
      assert.equal(before.interactions, 0);
      assert.equal(before.shadowsEnabled, false);
      assert.ok(before.projected.left >= before.viewportWidth * 0.39 && before.projected.right <= before.viewportWidth * 0.61, JSON.stringify(before));
      assert.ok(before.projected.top >= 110 && before.projected.bottom <= before.viewportHeight + 8, JSON.stringify(before));
      assert.ok(before.calls <= 55 && before.triangles <= 4000 && before.rendererTextures <= 14, JSON.stringify(before));
```

- [ ] **Step 3: Assert reveal visibility and bounded animation**

```js
      const poseA = await page.evaluate(() => ({
        body: window.__game['host'].room.npcSilhouette.rotation.z,
        head: window.__game['host'].room.scene.getObjectByName('mum-head').rotation.z,
      }));
      await page.evaluate(() => window.__game['host'].room.npcTick(performance.now() + 900));
      const poseB = await page.evaluate(() => ({
        body: window.__game['host'].room.npcSilhouette.rotation.z,
        head: window.__game['host'].room.scene.getObjectByName('mum-head').rotation.z,
      }));
      assert.notDeepEqual(poseA, poseB);
      assert.ok(Math.abs(poseB.body) <= 0.018 && Math.abs(poseB.head) <= 0.06, JSON.stringify({ poseA, poseB }));
      await page.evaluate(() => window.__game['host'].room.setHallLight(false));
      assert.equal(await page.evaluate(() => window.__game['host'].room.scene.getObjectByName('room-mum-doorway').visible), false);
      assert.deepEqual(consoleProblems, []);
```

- [ ] **Step 4: Run the managed browser check and verify RED**

Run: `npm run build && npm run test:browser`

Expected: FAIL because `room-mum-doorway`, `mum-character`, `mum-hall-dressing`, and the named authored parts do not exist. Record the exact failure; do not weaken the assertions to fit the current blockout.

- [ ] **Step 5: Commit the failing contract**

```powershell
git add scripts/smoke.mjs
git commit -m "test: define Mum doorway hero contract"
```

### Task 2: Build the procedural character and reveal group

**Files:**
- Create: `src/host/mum-doorway.ts`
- Modify: `src/host/room.ts:1-5,545-695,939-1025,1484-1488,1515-1517`

**Interfaces:**
- Produces: `makeMumDoorway(): MumDoorway`, where `MumDoorway` contains `root: THREE.Group`, `character: THREE.Group`, `tick(nowMs: number): void`, and `setRevealed(on: boolean): void`.
- Consumes: only Three.js core primitives; no helper from `room.ts` and no external asset.

- [ ] **Step 1: Create the module contract and deterministic helpers**

```ts
import * as THREE from 'three';

export interface MumDoorway {
  root: THREE.Group;
  character: THREE.Group;
  tick: (nowMs: number) => void;
  setRevealed: (on: boolean) => void;
}

const material = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color });

function named<T extends THREE.Object3D>(object: T, name: string): T {
  object.name = name;
  return object;
}

function box(size: [number, number, number], mat: THREE.Material, position: [number, number, number], name?: string): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  if (name) mesh.name = name;
  return mesh;
}

function limbBetween(name: string, start: THREE.Vector3, end: THREE.Vector3, radius: number, mat: THREE.Material): THREE.Mesh {
  const delta = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, delta.length(), 8), mat);
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return mesh;
}
```

- [ ] **Step 2: Build a transparent expression texture**

Use a 128x128 transparent canvas. Draw only the two eyebrows, two half-lidded eyes, nose hint, mouth, and restrained blush; do not paint a skin-colour rectangle. Set `texture.colorSpace = THREE.SRGBColorSpace`. Mount it on `PlaneGeometry(0.19, 0.18)` at local `(0, -0.005, 0.116)` beneath the named `mum-head` group.

- [ ] **Step 3: Build the named character hierarchy**

Construct `mum-character` facing positive Z, then rotate it by `Math.PI` inside the doorway root. Use these exact major shapes and names:

| Name | Geometry and placement |
|---|---|
| `mum-footwear` | group containing two 10x8 sphere slippers scaled `(0.075, 0.035, 0.11)` plus slim soles at x `±0.075`, y `0.04` |
| `mum-skirt` | 12-segment cylinder, top radius `0.15`, bottom radius `0.23`, height `0.56`, y `0.49`, Z scale `0.72` |
| `mum-torso` | 10-segment cylinder, top radius `0.205`, bottom radius `0.17`, height `0.39`, y `1.00`, Z scale `0.62` |
| cardigan details | cream blouse inset, two rose lapels rotated `±0.18`, three 0.012-radius buttons, and a darker hem band |
| upper arms | `mum-upper-arm-left/right`, radius `0.055`, from shoulders `(±0.18,1.12,0)` to elbows `(±0.225,0.98,0.07)` |
| forearms | `mum-forearm-left` from `(-0.225,0.98,0.07)` to `(0.105,0.91,0.16)`; `mum-forearm-right` from `(0.225,0.98,0.06)` to `(-0.11,0.88,0.18)`; radius `0.052` |
| hands | `mum-hand-left/right`, low-segment spheres scaled `(0.045,0.035,0.042)` at the two forearm endpoints |
| `mum-tea-towel` | group with two cream drape boxes at `(-0.045,0.79,0.205)` and `(-0.015,0.72,0.207)`, one lower fold, and one muted red stripe |
| neck | 10-segment cylinder at y `1.245` |
| `mum-head` | group at y `1.39`, containing a skin sphere radius `0.12`, scaled `(1,1.08,0.9)`, expression plane, ears, hair cap/side/back/bun, and gold studs |

Set `character.position.z = 0.22`, `character.rotation.y = Math.PI`, and keep total height between `1.48` and `1.58` metres.

- [ ] **Step 4: Build the named reveal-only hall dressing**

Under `mum-hall-dressing`, add:

- `mum-hall-runner`: wine `PlaneGeometry(0.42, 0.95)`, floor-facing at `(0, 0.009, 0.08)`, with a smaller muted-gold centre stripe.
- `mum-hall-threshold`: one warm-wood box `(0.84, 0.025, 0.10)` at `(0, 0.016, -0.49)`.
- `mum-hall-skirting`: group with two cream boxes `(0.06, 0.09, 0.92)` at x `±0.43`, y `0.045`, z `0.04`.
- `mum-hall-domestic-detail`: group on the right wall with an aged-brass frame and cream insert, both rotated toward the doorway.
- `mum-hall-practical`: group at `(0.26, 1.82, 0.46)` containing a brass backplate, short arm, open 10-segment shade, and warm emissive bulb.
- `mum-contact-cue`: black transparent `CircleGeometry(0.19, 20)` scaled Z `0.62`, floor-facing at `(0, 0.012, 0.22)`, `opacity: 0.2`, `depthWrite: false`.

Put a `PointLight(0xffc487, 1.55, 2.2, 1.8)` at `(0.26, 1.68, 0.28)` and a `PointLight(0xffd9b0, 1.25, 2.1, 1.8)` at `(0, 1.48, -0.72)` under the root. These two lights replace the old unexplained centre-back `hallLight` and `mumFill`.

- [ ] **Step 5: Implement visibility and bounded idle motion**

```ts
  root.visible = false;
  const tick = (nowMs: number): void => {
    const t = nowMs / 1000;
    character.rotation.z = Math.sin(t * 1.1) * 0.014;
    head.rotation.z = Math.sin(t * 0.7 + 1) * 0.048;
    head.position.y = 1.39 + Math.sin(t * 2.1) * 0.004;
    towel.rotation.z = Math.sin(t * 1.1 + 0.4) * 0.008;
  };
  return {
    root,
    character,
    tick,
    setRevealed: (on) => { root.visible = on; },
  };
```

- [ ] **Step 6: Integrate without changing the room contract**

Import `makeMumDoorway`, delete `makeMumFaceTexture` and `makeMum`, and replace the old character/two-light construction with:

```ts
  const mum = makeMumDoorway();
  mum.root.position.set(-0.8, 0, 2.5);
  mum.character.visible = false;
  scene.add(mum.root);
```

Keep door easing unchanged. In `roomTick`, call `mum.tick(nowMs)` when `mum.character.visible`. Replace `setHallLight` with:

```ts
  const setHallLight = (on: boolean): void => {
    mum.setRevealed(on);
    doorTarget = on ? DOOR_OPEN : 0;
  };
```

Return `npcSilhouette: mum.character`, `npcTick: roomTick`, and `setHallLight` exactly as before. Do not alter the threshold collider or any interactable.

- [ ] **Step 7: Build and run the browser contract GREEN**

Run: `npm run build && npm run test:browser`

Expected: the new scenario passes at 900x600, all existing browser scenarios still pass, and the staged reveal remains within every named budget.

- [ ] **Step 8: Run unit tests and commit**

Run: `npm test`

Expected: 15 test files and 198 tests pass.

```powershell
git add src/host/mum-doorway.ts src/host/room.ts scripts/smoke.mjs
git commit -m "feat: rebuild Mum doorway hero vignette"
```

### Task 3: Visual calibration, regression proof, and integration

**Files:**
- Modify if evidence requires: `src/host/mum-doorway.ts`
- Modify if a contract needs correction rather than weakening: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: the production build and `makeMumDoorway` output.
- Produces: final 1280x720 and 900x600 visual evidence plus full repository verification.

- [ ] **Step 1: Capture the production reveal at both supported sizes**

Build, start `vite preview` on a verified free port, use the Playwright CLI, stage the reveal through `npcSilhouette.visible = true` and `setHallLight(true)`, point the player at yaw `Math.PI`, and save:

```text
shots/mum-doorway-hero-1280.png
shots/mum-doorway-hero-900.png
```

Inspect both original-resolution images. Reject the result if any of these remain: cube-head read, merged forearm bar, floating hands, rigid paper-strip towel, unexplained bright wall orb, feet without a floor cue, clipping into the door/frame, practical hidden directly behind the head, or hallway decoration louder than the face.

- [ ] **Step 2: Calibrate only evidence-backed defects**

Adjust existing geometry positions, scale, light intensity, or material values in `mum-doorway.ts`. Do not add a new subsystem or asset. After every adjustment run `npm run build`, refresh the production page, and recapture the affected size. After the final adjustment rerun `npm run test:browser` because the browser evidence was invalidated.

- [ ] **Step 3: Profile baseline versus candidate**

Use the existing room cadence/profiling approach at the same camera, viewport, and seed. Record calls, triangles, textures, and a short repeated FPS sample. The candidate must meet the explicit browser budgets and must not show a material median-FPS regression beyond normal headless noise.

- [ ] **Step 4: Adversarially review the shipped result**

Check: no new collider/interactable; no `castShadow`; renderer shadows remain off; hidden reveal root removes its draw cost; all new resources descend from the room scene; `Room` public hooks remain compatible; old centre-back lights are gone; console/resource failures are clean; no screenshot or `.playwright-cli` scratch directory is staged.

- [ ] **Step 5: Run the complete local gate**

Run: `npm run verify`

Expected:

- 15 Vitest files / 198 tests pass.
- standalone TypeScript/Vite build passes.
- JavaScript gzip remains at or below 204,800 bytes and CSS gzip at or below 10,240 bytes.
- every browser smoke and full-interaction scenario passes.
- mounted `/just-five-more-minutes/` build passes.

- [ ] **Step 6: Append and validate the required reflection**

Append one JSON object with keys `date`, `task`, `outcome`, `surprise`, and `next-time` to `C:\Users\aggis\.Codex\memory\reflections.jsonl` using `apply_patch`. Parse every non-empty line with `ConvertFrom-Json`, then select the exact task string and assert all five keys are present.

- [ ] **Step 7: Commit final calibration if needed**

```powershell
git add src/host/mum-doorway.ts scripts/smoke.mjs
git commit -m "fix: calibrate Mum doorway composition"
```

Skip this commit when Task 2 required no later source change.

- [ ] **Step 8: Integrate and clean up**

Fast-forward the isolated implementation branch onto `master`, remove the worktree and local feature branch, close the Playwright session, stop only the preview process started for this task, and confirm `git status --short --branch` is clean. Do not push or deploy without a separate request.
