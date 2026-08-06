# Bedroom Shell Material Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add restrained authored wall and ceiling material finish to the bedroom shell without changing gameplay, assets, CSS, or render architecture.

**Architecture:** Keep shell construction in `src/host/room.ts`. Add a browser smoke contract that observes real Three.js geometry/material state, then replace the current low-resolution wall paint helper with a bounded deterministic vertex-colour shell helper and apply it to walls and ceiling.

**Tech Stack:** TypeScript, Three.js `BufferAttribute`/`PlaneGeometry`, Playwright-driven Node smoke checks, Vitest, Vite.

## Global Constraints

- Add no CSS, external raster asset, texture file, dependency, shader, post-processing pass, shadow map, event listener, timer, or animation loop.
- Preserve room dimensions, wall object names, ceiling object name, floor geometry, contact shadows, lighting behavior, colliders, interactables, item placement, Mum doorway, and PC interaction.
- Preserve `MeshLambertMaterial` for shell meshes and `vertexColors: true`.
- Increase shell geometry only within a bounded budget: each major wall or ceiling plane must stay at or below 99 vertices and 160 triangles.
- Add no renderer texture memory.
- Do not modify Mudwick, title, scorecard, HUD, audio, reports, or gameplay systems in this tranche.

---

### Task 1: Pin the shell material contract

**Files:**
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `window.__game.host.room.scene`, `room-wall-north`, `room-wall-west`, `room-ceiling`, and renderer memory diagnostics.
- Produces: browser scenario `bedroom shell materials stay authored and bounded`.

- [ ] **Step 1: Add the failing browser scenario**

Insert this scenario after `bedroom rendering has a bounded material and grounding foundation`:

```js
  await scenario(
    'bedroom shell materials stay authored and bounded',
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
        const scene = host.room.scene;
        const inspect = (name) => {
          const mesh = scene.getObjectByName(name);
          const color = mesh?.geometry?.attributes?.color;
          const position = mesh?.geometry?.attributes?.position;
          const index = mesh?.geometry?.index;
          const channelRange = (channel) => {
            if (!color) return 0;
            let min = Infinity;
            let max = -Infinity;
            for (let i = 0; i < color.count; i++) {
              const value = channel === 0 ? color.getX(i) : channel === 1 ? color.getY(i) : color.getZ(i);
              min = Math.min(min, value);
              max = Math.max(max, value);
            }
            return Number((max - min).toFixed(5));
          };
          const materials = Array.isArray(mesh?.material) ? mesh.material : [mesh?.material];
          return {
            name: mesh?.name,
            vertices: position?.count ?? 0,
            triangles: index ? Math.floor(index.count / 3) : Math.floor((position?.count ?? 0) / 3),
            hasColor: Boolean(color),
            colorRanges: [channelRange(0), channelRange(1), channelRange(2)],
            vertexColors: materials.every((material) => material?.vertexColors === true),
            textures: materials.filter((material) => material?.map).length,
            casters: mesh?.castShadow === true,
            interactions: Boolean(mesh?.userData?.interact),
          };
        };
        const shellNames = [
          'room-wall-north',
          'room-wall-west',
          'room-wall-east',
          'room-wall-south-left',
          'room-wall-south-right',
          'room-wall-south-header',
          'room-ceiling',
        ];
        return {
          shells: shellNames.map(inspect),
          rendererTextures: host.renderer.info.memory.textures,
        };
      });

      for (const shell of state.shells) {
        assert.equal(shell.hasColor, true, `${shell.name} has no vertex colors`);
        assert.equal(shell.vertexColors, true, `${shell.name} material ignores vertex colors`);
        assert.ok(shell.vertices > 20, `${shell.name} is still too coarse: ${shell.vertices}`);
        assert.ok(shell.vertices <= 99, `${shell.name} vertex budget exceeded: ${shell.vertices}`);
        assert.ok(shell.triangles <= 160, `${shell.name} triangle budget exceeded: ${shell.triangles}`);
        assert.ok(Math.max(...shell.colorRanges) >= 0.045, `${shell.name} material range too flat: ${shell.colorRanges}`);
        assert.ok(Math.max(...shell.colorRanges) <= 0.16, `${shell.name} material range too noisy: ${shell.colorRanges}`);
        assert.equal(shell.textures, 0, `${shell.name} unexpectedly allocated a texture`);
        assert.equal(shell.casters, false, `${shell.name} unexpectedly casts shadows`);
        assert.equal(shell.interactions, false, `${shell.name} unexpectedly became interactable`);
      }
      assert.ok(state.rendererTextures <= 12, `renderer texture budget exceeded: ${state.rendererTextures}`);
      assert.deepEqual(consoleProblems, []);
    },
  );
```

- [ ] **Step 2: Run RED**

Run:

```powershell
npm run build
npm run test:browser
```

Expected: FAIL in `bedroom shell materials stay authored and bounded` because `room-ceiling` lacks vertex colours and the current wall colour range is below the authored-material threshold.

- [ ] **Step 3: Commit the red contract**

```powershell
git add scripts/smoke.mjs
git commit -m "test: pin bedroom shell material finish"
```

---

### Task 2: Build the vertex-coloured shell finish

**Files:**
- Modify: `src/host/room.ts`

**Interfaces:**
- Consumes: existing `makePaintGeometry(width, height)` call sites and `lambert(color)`.
- Produces: `makeShellGeometry(width, height, base, options)` and vertex-coloured `room-ceiling`.

- [ ] **Step 1: Replace `makePaintGeometry` with a shell helper**

Replace the existing `makePaintGeometry(width, height)` function with:

```ts
function makeShellGeometry(
  width: number,
  height: number,
  base: number,
  opts: { widthSegments?: number; heightSegments?: number; vertical?: number; corner?: number; grain?: number } = {},
): THREE.PlaneGeometry {
  const widthSegments = opts.widthSegments ?? 8;
  const heightSegments = opts.heightSegments ?? 5;
  const geometry = new THREE.PlaneGeometry(width, height, widthSegments, heightSegments);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const baseColor = new THREE.Color(base);
  for (let i = 0; i < position.count; i++) {
    const xNorm = width === 0 ? 0 : Math.abs(position.getX(i)) / (width / 2);
    const yNorm = height === 0 ? 0 : (position.getY(i) + height / 2) / height;
    const cornerShade = (xNorm ** 1.7) * (opts.corner ?? -0.025);
    const verticalShade = (0.5 - yNorm) * (opts.vertical ?? 0.055);
    const grain = ((((i * 37) % 17) - 8) / 8) * (opts.grain ?? 0.012);
    baseColor.clone().offsetHSL(0, 0, cornerShade + verticalShade + grain).toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}
```

- [ ] **Step 2: Update wall construction**

In `mkWall`, replace:

```ts
makePaintGeometry(w, h),
```

with:

```ts
makeShellGeometry(w, h, 0x8a7560),
```

- [ ] **Step 3: Give the ceiling the same authored material contract**

Replace:

```ts
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(5, 4), lambert(0x7a6a58));
```

with:

```ts
const ceiling = new THREE.Mesh(
  makeShellGeometry(5, 4, 0x7a6a58, { vertical: 0.035, corner: -0.018, grain: 0.01 }),
  new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }),
);
```

- [ ] **Step 4: Run GREEN**

Run:

```powershell
npm run build
npm run size:check
npm run test:browser
```

Expected: CSS/JS budgets remain unchanged enough to pass, all isolated browser scenarios pass, and full interaction E2E passes.

- [ ] **Step 5: Run unit and type checks**

```powershell
npm test
npm run typecheck
```

Expected: 203 unit tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit implementation**

```powershell
git add src/host/room.ts
git commit -m "feat: author the bedroom shell material"
```

---

### Task 3: Prove, review, merge, and close

**Files:**
- Create ignored proof captures under: `shots/`
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`

**Interfaces:**
- Consumes: production build, browser smoke runner, full interaction E2E, and mounted-path build.
- Produces: inspected proof images, review notes, full verification evidence, local merge, and reflection.

- [ ] **Step 1: Capture proof images**

Capture and inspect:

```text
shots/bedroom-shell-material-room.png
shots/bedroom-shell-material-mum-prompt.png
shots/bedroom-shell-material-report-backdrop.png
```

Use production preview, real room state, and real report overlay. Reject if material patches compete with UI or make the room dirtier rather than richer.

- [ ] **Step 2: Reconcile the program record**

In `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`, update the Bedroom row to record that the shell material finish is repaired and guarded. Do not claim live deployment.

- [ ] **Step 3: Run independent review**

Use `superpowers:requesting-code-review` for a bounded review of `scripts/smoke.mjs`, `src/host/room.ts`, and the program doc. Verify every finding before changing code.

- [ ] **Step 4: Run full verification**

Run:

```powershell
npm test
npm run typecheck
npm run build
npm run size:check
npm run test:browser
npm run typecheck
npm run build:hub
```

Expected: unit tests, typecheck, standalone build, JS/CSS gzip budgets, all isolated browser scenarios, full interaction E2E, final typecheck, and mounted-path build pass.

- [ ] **Step 5: Finish under the standing local-merge choice**

Use `superpowers:finishing-a-development-branch`, merge the feature branch into local `master`, rerun the full release gate on the merged tree, remove the linked worktree and feature branch, clean generated scratch artifacts, and append the required reflection. Do not push or deploy.
