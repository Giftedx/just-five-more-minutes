# Bedroom Woven Rug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bedroom's flat bullseye rug with a deterministic woven oval and braided edge while preserving gameplay and the existing two-draw-call footprint.

**Architecture:** Add a focused `makeWovenRug()` factory in `src/host/woven-rug.ts`. The factory owns one generated sRGB canvas texture, one subtly relieved mapped surface, and one vertex-coloured low-poly braid; `room.ts` owns only placement. A browser smoke contract pins structure, rendering cost, texture metadata, and the absence of gameplay behavior before integration.

**Tech Stack:** TypeScript 7, Three.js 0.185, HTML Canvas 2D, Playwright 1.61, Node assertion smokes, Vite/Vitest.

## Global Constraints

- Keep the root at `(0.1, 0, 0.4)` and name it `room-rug`.
- Name the only children `room-rug-surface` and `room-rug-braid`.
- Use exactly two traversed meshes, no more than 500 rug triangles, and exactly one 256 by 192 generated sRGB texture.
- Keep the room at or below 128 first-camera draw calls and 12 renderer textures.
- Add no collision, interaction metadata, animation callback, light, transparency, shadow caster, external asset, dependency, or gameplay change.
- Reject a median fresh-process headless frame-cadence regression greater than 10%.
- Preserve unrelated user changes and remove all scratch captures before completion.

---

## File Map

| File | Responsibility |
| --- | --- |
| `src/host/woven-rug.ts` | Procedural rug texture, surface relief, braid colours, and exported visual factory |
| `src/host/room.ts` | Existing room layout; imports and places the new visual factory |
| `scripts/smoke.mjs` | Browser-level structure, texture, gameplay, and renderer budgets |
| `shots/woven-rug-final.png` | Ignored final visual evidence captured from the verified local build |

---

### Task 1: Define the failing browser contract

**Files:**
- Modify: `scripts/smoke.mjs` immediately after `bedroom hero furniture preserves gameplay contracts`

**Interfaces:**
- Consumes: `window.__game.host.room`, `THREE.Object3D` names, renderer diagnostics, and the existing `scenario()` / `gotoOk()` helpers.
- Produces: Browser scenario `bedroom rug stays authored, inert, and bounded`.

- [ ] **Step 1: Add the failing scenario**

Insert this scenario after the hero-furniture scenario:

```js
  await scenario(
    'bedroom rug stays authored, inert, and bounded',
    { viewport: { width: 1000, height: 700 } },
    async (page) => {
      const consoleProblems = [];
      page.on('console', (message) => {
        if (message.type() === 'warning' || message.type() === 'error') {
          consoleProblems.push(`${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => consoleProblems.push(`pageerror: ${error.message}`));
      await gotoOk(page, { skipTitle: 1, seed: '0xC0FFEE' });
      await page.waitForFunction(() => window.__game?.['host']?.room?.scene);

      const state = await page.evaluate(() => {
        const host = window.__game['host'];
        const root = host.room.scene.getObjectByName('room-rug');
        const surface = root?.getObjectByName('room-rug-surface');
        const braid = root?.getObjectByName('room-rug-braid');
        const textures = new Map();
        let meshCount = 0;
        let triangles = 0;
        let lights = 0;
        let casters = 0;
        let interactions = 0;
        root?.traverse((object) => {
          if (object.isMesh) {
            meshCount++;
            const multiplier = object.isInstancedMesh ? object.count : 1;
            const primitives = object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0;
            triangles += Math.floor(primitives / 3) * multiplier;
            if (object.castShadow) casters++;
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              if (material?.map) {
                textures.set(material.map.uuid, {
                  colorSpace: material.map.colorSpace,
                  width: material.map.image?.width,
                  height: material.map.image?.height,
                });
              }
            }
          }
          if (object.isLight) lights++;
          if (object.userData?.interact) interactions++;
        });
        const belongsToRoot = (object) => {
          for (let cursor = object; cursor; cursor = cursor.parent) {
            if (cursor === root) return true;
          }
          return false;
        };
        const relief = surface?.geometry.attributes.position
          ? [...new Set(Array.from(surface.geometry.attributes.position.array)
            .filter((_, index) => index % 3 === 2)
            .map((value) => Number(value.toFixed(4))))]
          : [];
        host.renderer.render(host.room.scene, host.camera);
        return {
          rootName: root?.name,
          children: [
            root?.getObjectByName('room-rug-surface')?.name,
            root?.getObjectByName('room-rug-braid')?.name,
          ],
          position: root ? root.position.toArray() : null,
          meshCount,
          triangles,
          textures: [...textures.values()],
          surfaceHasUvs: Boolean(surface?.geometry.attributes.uv),
          relief,
          braidVertexColors: braid?.material.vertexColors,
          lights,
          casters,
          interactions,
          interactableMembers: root ? host.room.interactables.filter(belongsToRoot).length : 0,
          shadowsEnabled: host.renderer.shadowMap.enabled,
          roomCalls: host.renderer.info.render.calls,
          rendererTextures: host.renderer.info.memory.textures,
        };
      });

      assert.equal(state.rootName, 'room-rug');
      assert.deepEqual(state.children, ['room-rug-surface', 'room-rug-braid']);
      assert.deepEqual(state.position, [0.1, 0, 0.4]);
      assert.equal(state.meshCount, 2);
      assert.ok(state.triangles <= 500, `rug triangle budget exceeded: ${state.triangles}`);
      assert.deepEqual(state.textures, [{ colorSpace: 'srgb', width: 256, height: 192 }]);
      assert.equal(state.surfaceHasUvs, true);
      assert.ok(state.relief.length >= 3, `rug surface is mathematically flat: ${state.relief}`);
      assert.ok(Math.max(...state.relief.map(Math.abs)) <= 0.003, `rug relief hides props: ${state.relief}`);
      assert.equal(state.braidVertexColors, true);
      assert.equal(state.lights, 0);
      assert.equal(state.casters, 0);
      assert.equal(state.interactions, 0);
      assert.equal(state.interactableMembers, 0);
      assert.equal(state.shadowsEnabled, false);
      assert.ok(state.roomCalls <= 128, `room draw-call budget exceeded: ${state.roomCalls}`);
      assert.ok(state.rendererTextures <= 12, `room texture budget exceeded: ${state.rendererTextures}`);
      assert.deepEqual(consoleProblems, []);
    },
  );
```

- [ ] **Step 2: Prove the test is red against the untouched room**

Run the current `master` server on port 5179, then from the implementation worktree run:

```powershell
$env:SMOKE_URL='http://127.0.0.1:5179/'
node scripts/smoke.mjs
```

Expected: every preceding scenario passes, then this scenario fails because `state.rootName` is `undefined` instead of `room-rug`.

- [ ] **Step 3: Commit the red contract**

```powershell
git add scripts/smoke.mjs
git commit -m "test: define bedroom woven rug contract"
```

---

### Task 2: Build the procedural visual factory

**Files:**
- Create: `src/host/woven-rug.ts`

**Interfaces:**
- Consumes: `THREE.Group`, `CanvasTexture`, `CircleGeometry`, `TorusGeometry`, `BufferAttribute`, and `MeshLambertMaterial`.
- Produces: `makeWovenRug(): THREE.Group` with the exact diagnostic names from the global constraints.

- [ ] **Step 1: Create the generated textile texture**

Add `makeRugTexture()` using this structure:

```ts
function makeRugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for woven rug');

  ctx.fillStyle = '#773f43';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#4b2830';
  ctx.lineWidth = 18;
  ctx.beginPath();
  ctx.ellipse(128, 96, 112, 80, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#c06a46';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(128, 96, 99, 68, 0, 0, Math.PI * 2);
  ctx.stroke();

  const diamond = (cx: number, cy: number, rx: number, ry: number, color: string): void => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry);
    ctx.lineTo(cx + rx, cy);
    ctx.lineTo(cx, cy + ry);
    ctx.lineTo(cx - rx, cy);
    ctx.closePath();
    ctx.fill();
  };
  diamond(128, 96, 58, 42, '#c58a4a');
  diamond(128, 96, 39, 29, '#4d6172');
  diamond(128, 96, 22, 17, '#e2c487');
  diamond(128, 96, 9, 7, '#71363f');
  for (const x of [50, 206]) {
    diamond(x, 96, 18, 28, '#b45c45');
    diamond(x, 96, 8, 14, '#d6ad65');
  }

  for (let y = 1; y < canvas.height; y += 3) {
    ctx.fillStyle = y % 6 === 1 ? 'rgba(255,236,198,0.055)' : 'rgba(50,20,24,0.045)';
    ctx.fillRect(0, y, canvas.width, 1);
  }
  for (let x = 2; x < canvas.width; x += 4) {
    ctx.fillStyle = x % 8 === 2 ? 'rgba(255,220,180,0.035)' : 'rgba(35,18,23,0.03)';
    ctx.fillRect(x, 0, 1, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}
```

- [ ] **Step 2: Create the relieved surface and braided rim**

Use these exact geometry constraints:

```ts
function makeSurfaceGeometry(): THREE.CircleGeometry {
  const geometry = new THREE.CircleGeometry(0.91, 32);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const radius = Math.hypot(x, y);
    const angle = Math.atan2(y, x);
    position.setZ(i, radius < 0.01 ? 0 : 0.0022 * Math.sin(angle * 6));
  }
  geometry.computeVertexNormals();
  return geometry;
}

function makeBraidGeometry(): THREE.TorusGeometry {
  const geometry = new THREE.TorusGeometry(0.91, 0.035, 6, 32);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  for (let i = 0; i < position.count; i++) {
    const angle = Math.atan2(position.getY(i), position.getX(i));
    const color = new THREE.Color(Math.sin(angle * 16) >= 0 ? 0x4b2830 : 0x6b3539);
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
```

Build the exported group:

```ts
export function makeWovenRug(): THREE.Group {
  const rug = new THREE.Group();
  rug.name = 'room-rug';
  rug.position.set(0.1, 0, 0.4);

  const surface = new THREE.Mesh(
    makeSurfaceGeometry(),
    new THREE.MeshLambertMaterial({ map: makeRugTexture() }),
  );
  surface.name = 'room-rug-surface';
  surface.rotation.x = -Math.PI / 2;
  surface.scale.y = 0.76;
  surface.position.y = 0.006;
  rug.add(surface);

  const braid = new THREE.Mesh(
    makeBraidGeometry(),
    new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
  );
  braid.name = 'room-rug-braid';
  braid.rotation.x = -Math.PI / 2;
  braid.scale.y = 0.76;
  braid.position.y = 0.014;
  rug.add(braid);
  return rug;
}
```

- [ ] **Step 3: Compile the isolated factory**

Run:

```powershell
npm run typecheck
```

Expected: exit 0. The browser contract remains red because the factory is not integrated yet.

- [ ] **Step 4: Commit the factory**

```powershell
git add src/host/woven-rug.ts
git commit -m "feat: build procedural woven rug"
```

---

### Task 3: Integrate the factory without gameplay changes

**Files:**
- Modify: `src/host/room.ts:1-5`
- Modify: `src/host/room.ts:936-944`

**Interfaces:**
- Consumes: `makeWovenRug(): THREE.Group` from Task 2.
- Produces: One placed `room-rug` scene root; removes both unnamed legacy circles.

- [ ] **Step 1: Replace the inline rug circles**

Add the import:

```ts
import { makeWovenRug } from './woven-rug';
```

Replace:

```ts
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), lambert(0x9c4a3c));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0.1, 0.005, 0.4);
  scene.add(rug);
  const rugInner = new THREE.Mesh(new THREE.CircleGeometry(0.62, 24), lambert(0xb86a50));
  rugInner.rotation.x = -Math.PI / 2;
  rugInner.position.set(0.1, 0.006, 0.4);
  scene.add(rugInner);
```

with:

```ts
  scene.add(makeWovenRug());
```

- [ ] **Step 2: Run the green browser contract and focused build checks**

Start the candidate server on port 5180, then run:

```powershell
$env:SMOKE_URL='http://127.0.0.1:5180/'
node scripts/smoke.mjs
npm test -- --run
npm run build
```

Expected: 15 isolated browser scenarios pass, 198 unit tests pass, and the build exits 0. The rug scenario reports no warnings and stays inside all local/global budgets.

- [ ] **Step 3: Commit integration**

```powershell
git add src/host/room.ts
git commit -m "feat: replace bedroom target rug"
```

---

### Task 4: Visual calibration, profiling, and release closure

**Files:**
- Verify: `src/host/woven-rug.ts`
- Verify: `src/host/room.ts`
- Verify: `scripts/smoke.mjs`
- Artifact: `shots/woven-rug-final.png` (ignored)

**Interfaces:**
- Consumes: baseline server on 5179 and candidate server on 5180, each sampled in a fresh Chromium process.
- Produces: visual evidence, performance evidence, adversarial review, merged and reverified `master`.

- [ ] **Step 1: Capture spawn and elevated rug views**

For each capture, launch a fresh Chromium process, navigate to `?skipTitle=1&seed=0xC0FFEE`, replace `host.player.update` with a no-op, hide non-canvas DOM, set the camera, call `renderer.render`, and capture `#room-canvas` at 1400 by 900.

Use these cameras:

```js
{ position: [0.05, 1.48, 1.55], target: [0, 0.72, -0.45] } // spawn composition
{ position: [0.1, 1.75, 1.72], target: [0.1, 0.03, 0.35] } // elevated rug inspection
```

Reject and adjust only `woven-rug.ts` if the image shows a bullseye, moire, square texture edge, z-fighting, hidden prop, braid seam, or a rug stronger than the CRT.

- [ ] **Step 2: Profile three fresh processes per build**

For baseline and candidate, capture scene mesh/instance/triangle counts, `renderer.info.render.calls`, `renderer.info.memory.textures`, and renderer-call cadence over 3,000 ms. Compute medians from three independent browser processes.

Accept only if:

```text
candidate calls <= 128
candidate renderer textures <= 12
(baseline median FPS - candidate median FPS) / baseline median FPS <= 0.10
```

- [ ] **Step 3: Adversarially review and independently verify findings**

Use `/red-team` across rendering, item visibility/raycast, lifecycle disposal, texture colour space, geometry bounds, and sibling soft-furnishing paths. Use `/verify-findings` before any repair. Specifically trace `HostApp.dispose()` to confirm the generated texture, material, torus, and circle resources are freed during restart.

- [ ] **Step 4: Run the full release gate**

Run:

```powershell
npm run verify
git diff --check
git status --short --branch
```

Expected: 198 unit tests, 15 isolated browser scenarios, full interaction E2E, size checks, standalone build, and mounted build all pass; only intentional commits remain.

- [ ] **Step 5: Capture the verified artifact and integrate**

Capture `shots/woven-rug-final.png` from the verified candidate. Under the user's standing approval, fast-forward the feature branch into `master`, rerun `npm run verify` on merged `master`, then remove the owned `.worktrees/bedroom-woven-rug` worktree and delete the merged branch.

- [ ] **Step 6: Reflect and clean up**

Stop ports 5179 and 5180, remove scratch `output/` only after verifying its resolved path is inside the owned worktree, and append one valid JSON line to `C:\Users\aggis\.Codex\memory\reflections.jsonl` with exact keys `date`, `task`, `outcome`, `surprise`, and `next-time`. Validate every JSONL line and confirm the final Git state.
