# Bedroom Lighting and Material Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the first-person bedroom from a flat lit blockout into a grounded, intentionally rendered stylized environment without changing gameplay or imposing an unacceptable browser performance cost.

**Architecture:** Preserve the room's `MeshLambertMaterial` interaction contract. Configure filmic renderer response in `src/host/app.ts`; generate deterministic vertex-coloured wall/floor geometry plus one batched contact-shadow mesh in `src/host/room.ts`; pin colour, geometry winding, grounding, and zero real-time shadow maps in `scripts/smoke.mjs`. Real-time PCF shadows are explicitly rejected by measured same-process A/B evidence.

**Tech Stack:** TypeScript, Three.js, Canvas 2D, Node.js browser smoke runner, Playwright, Vite, Vitest

## Global Constraints

- Keep the low-poly procedural-art identity; add no external raster assets.
- Do not convert the room wholesale away from `MeshLambertMaterial`.
- Use no post-processing stack, bloom, SSAO, or new runtime dependency.
- Keep runtime shadow maps disabled and batch contact grounding into one mesh.
- Keep browser output in the sRGB colour space.
- Preserve gameplay, interaction, dialogue, and dusk-transition behaviour.
- Reject any approach that reproduces the measured 13 fps headless result of PCF shadow sampling.

---

### Task 1: Lock the Rendering Contract in a Failing Browser Test

**Files:**
- Modify: `scripts/smoke.mjs`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `window.__game.host`, `scenario(name, options, callback)`, and stable room object names.
- Produces: a browser scenario covering filmic/sRGB response, vertex-coloured architecture, upward-facing indexed geometry, one mapped depth-safe contact mesh, no casters, and no warning/error events.

- [ ] **Step 1: Add the rendering scenario**

The scenario must navigate with `{ skipTitle: 1, seed: '0xC0FFEE' }`, collect `console` warnings/errors and `pageerror` events, and inspect `room-floor`, `room-wall-north`, `room-desk`, `room-key-light`, and `room-contact-shadows`.

Use this manual winding calculation for the first indexed triangle:

```js
const facesUp = (mesh) => {
  const position = mesh?.geometry?.attributes?.position;
  const index = mesh?.geometry?.index;
  if (!position || !index || index.count < 3) return false;
  const i0 = index.getX(0);
  const i1 = index.getX(1);
  const i2 = index.getX(2);
  const ax = position.getX(i1) - position.getX(i0);
  const az = position.getZ(i1) - position.getZ(i0);
  const bx = position.getX(i2) - position.getX(i0);
  const bz = position.getZ(i2) - position.getZ(i0);
  return az * bx - ax * bz > 0;
};
```

Assert `toneMapping !== 0`, `outputColorSpace === 'srgb'`, `shadowMap.enabled === false`, both architectural meshes expose vertex colours, both horizontal meshes face upward, the contact material has a map with `depthWrite === false`, and caster/light arrays are empty.

- [ ] **Step 2: Prove RED against the untouched room**

Run: `$env:SMOKE_URL='http://127.0.0.1:<baseline-port>/'; node scripts/smoke.mjs`

Expected: FAIL because the untouched floor and wall do not expose vertex colour attributes and `room-contact-shadows` does not exist.

- [ ] **Step 3: Commit the failing contract**

```powershell
git add -- scripts/smoke.mjs
git commit -m "test: define bedroom rendering contract"
```

### Task 2: Configure Filmic Renderer Response

**Files:**
- Modify: `src/host/app.ts:61-68`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: Three.js `ACESFilmicToneMapping`.
- Produces: `HostApp.renderer` with exposure `1.05`; output colour space remains Three.js's sRGB default; shadow maps remain disabled.

- [ ] **Step 1: Configure the renderer**

```ts
this.renderer = new THREE.WebGLRenderer({ antialias: true });
this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
this.renderer.toneMappingExposure = 1.05;
```

- [ ] **Step 2: Run static and unit gates**

Run: `npm test -- --run; npm run build`

Expected: 198 tests pass and the production build succeeds.

- [ ] **Step 3: Commit**

```powershell
git add -- src/host/app.ts
git commit -m "feat: configure cinematic room renderer"
```

### Task 3: Build Procedural Architectural Geometry

**Files:**
- Modify: `src/host/room.ts`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Produces: `makePaintGeometry(width, height): THREE.PlaneGeometry` and `makeFloorGeometry(): THREE.BufferGeometry`.
- Consumers: named wall and floor meshes in the browser contract.

- [ ] **Step 1: Generate deterministic wall vertex colours**

Create `PlaneGeometry(width, height, 4, 3)`. Add a three-component `color` attribute derived from base `0x8a7560` with deterministic lightness offset `((((i * 17) % 11) - 5) * 0.0025)`. Render it with a white `MeshLambertMaterial({ vertexColors: true })`.

- [ ] **Step 2: Generate one indexed floorboard mesh**

Build five adjacent one-metre quads spanning `x = -2.5..2.5`, `z = -2..2`, using board colours `0x97754f`, `0xa08058`, `0x94714b`, `0x9d7951`, and `0x96734d`. Set upward normals and use upward-facing indices:

```ts
indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
```

Name the mesh `room-floor` and render with vertex colours.

- [ ] **Step 3: Build and run focused smoke**

Run: `npm run build; $env:SMOKE_URL='http://127.0.0.1:<candidate-port>/'; node scripts/smoke.mjs`

Expected: architectural assertions pass; contact-grounding assertions remain red.

### Task 4: Batch Contact Grounding and Calibrate Light

**Files:**
- Modify: `src/host/room.ts`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Produces: `makeContactShadowTexture(): THREE.CanvasTexture`, `makeContactShadows(): THREE.Mesh`, `room-contact-shadows`, `room-key-light`, and `room-desk`.

- [ ] **Step 1: Create the shared radial alpha texture**

Use a 64 by 64 canvas radial gradient with stops `rgba(45,22,14,0.46)` at 0, `rgba(45,22,14,0.22)` at 0.55, and transparent at 1.

- [ ] **Step 2: Batch five footprints into one upward-facing mesh**

Include desk `(0.9,-1.55,1.75,0.85)`, chair `(0.9,-0.95,0.68,0.68)`, bed `(-1.95,-0.4,1.12,2.18)`, bin `(1.95,-1.1,0.42,0.42)`, and basket `(-1.85,1.55,0.58,0.58)`. Position vertices at `y = 0.007`, share one UV-mapped material, set `transparent: true`, `depthWrite: false`, and `toneMapped: false`.

- [ ] **Step 3: Add the non-shadowing warm key and practical calibration**

Use the named spotlight at intensity `4.5`, practical point light at `6`, and dusk interpolation to `7` and `8`. Set `keyLight.castShadow = false`. Render the visible ceiling shade as unlit gold `0xc9964a` so nearby physical lights cannot saturate it.

- [ ] **Step 4: Prove GREEN**

Run: `npm run build; $env:SMOKE_URL='http://127.0.0.1:<candidate-port>/'; node scripts/smoke.mjs`

Expected: all 12 isolated smoke scenarios pass with no console warnings/errors.

### Task 5: Measure, Render, and Adversarially Review

**Files:**
- Verify: `src/host/app.ts`, `src/host/room.ts`, `scripts/smoke.mjs`
- Artifact: `output/playwright/bedroom-lighting-after.png` (ignored generated evidence)

**Interfaces:**
- Consumes: identical 1440 by 900 baseline and candidate URLs with `?skipTitle=1&seed=0xC0FFEE`.
- Produces: controlled A/B cadence/draw evidence and a clean production-preview PNG.

- [ ] **Step 1: Profile baseline and candidate in one Chromium process**

Open each URL in alternating fresh pages, wait 500 milliseconds, and count `requestAnimationFrame` callbacks for two seconds. Record renderer calls, triangles, and texture count. Reject any candidate near the measured PCF result of 13 fps, 259 calls, and 8,660 triangles.

Expected optimized result: 18.5–19 fps versus 21.5–23 fps baseline, one extra draw call, one extra texture, and no shadow pass.

- [ ] **Step 2: Render from an immutable production preview**

Run:

```powershell
npm run build
npm run preview -- --host 127.0.0.1 --port <preview-port> --strictPort
npx playwright screenshot --browser chromium --viewport-size "1440, 900" --wait-for-selector "#room-canvas" --wait-for-timeout 1500 "http://127.0.0.1:<preview-port>/?skipTitle=1&seed=0xC0FFEE" "output/playwright/bedroom-lighting-after.png"
```

Reject the render for clipped/white fixture fill, black backface holes, opaque contact rectangles, corrupted dialogue, crushed window art, obvious wall patching, or warning/error console output.

- [ ] **Step 3: Run full verification**

Run: `npm run verify`

Expected: unit tests, production build, size budget, 12 browser smoke scenarios, full interaction E2E, and mounted hub build all pass.

- [ ] **Step 4: Inspect final state**

Run: `git diff --check; git status --short; git log --oneline --decorate -8`

Confirm no untracked source files, conflict markers, stale PCF references, or generated screenshots are staged.
