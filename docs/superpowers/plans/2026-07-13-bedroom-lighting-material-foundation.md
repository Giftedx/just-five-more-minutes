# Bedroom Lighting and Material Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the first-person bedroom from a flat lit blockout into a grounded, intentionally rendered stylized environment without changing gameplay or adding external assets.

**Architecture:** Preserve the room's existing `MeshLambertMaterial` contract and enhance it at three seams: renderer configuration in `src/host/app.ts`, deterministic architectural textures and selective shadow participation in `src/host/room.ts`, and a browser-level rendering contract in `scripts/smoke.mjs`. Exactly one warm spotlight casts bounded soft shadows; existing lights remain non-shadowing fill.

**Tech Stack:** TypeScript, Three.js, HTML Canvas textures, Node.js browser smoke runner, Vite, Vitest

## Global Constraints

- Keep the low-poly procedural-art identity; add no external raster assets.
- Do not convert the room wholesale away from `MeshLambertMaterial`.
- Use no post-processing stack, bloom, SSAO, or new runtime dependency.
- Exactly one room light may cast shadows.
- Cap the key shadow map at 1024 by 1024.
- Keep browser output in the sRGB colour space.
- Preserve gameplay, interaction, dialogue, and dusk-transition behaviour.

---

### Task 1: Lock the Rendering Contract in a Failing Browser Test

**Files:**
- Modify: `scripts/smoke.mjs:357-389`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: the existing `window.__game.host` diagnostics surface and `scenario(name, options, callback)` browser helper.
- Produces: a smoke scenario that inspects named `room-floor`, `room-wall-north`, `room-desk`, and `room-key-light` objects plus renderer settings.

- [ ] **Step 1: Add the failing room-rendering scenario**

Insert a scenario before the existing room-mode MMO cadence test:

```js
await scenario('bedroom rendering has a bounded material and shadow foundation', { viewport: { width: 1000, height: 700 } }, async (page) => {
  await page.goto(`${baseUrl}/?skipTitle=1&seed=0xC0FFEE`);
  await page.waitForFunction(() => window.__game?.['host']?.room?.scene);

  const state = await page.evaluate(() => {
    const host = window.__game['host'];
    const scene = host.room.scene;
    const floor = scene.getObjectByName('room-floor');
    const wall = scene.getObjectByName('room-wall-north');
    const desk = scene.getObjectByName('room-desk');
    const key = scene.getObjectByName('room-key-light');
    const shadowLights = [];
    scene.traverse((object) => {
      if (object.isLight && object.castShadow) shadowLights.push(object.name);
    });
    return {
      toneMapping: host.renderer.toneMapping,
      outputColorSpace: host.renderer.outputColorSpace,
      shadowsEnabled: host.renderer.shadowMap.enabled,
      shadowType: host.renderer.shadowMap.type,
      floorMapped: Boolean(floor?.material?.map),
      wallMapped: Boolean(wall?.material?.map),
      floorReceives: floor?.receiveShadow,
      deskCasts: desk?.castShadow,
      keyCasts: key?.castShadow,
      shadowSize: [key?.shadow?.mapSize?.width, key?.shadow?.mapSize?.height],
      shadowLights,
    };
  });

  assert.notEqual(state.toneMapping, 0, 'bedroom still uses NoToneMapping');
  assert.equal(state.outputColorSpace, 'srgb');
  assert.equal(state.shadowsEnabled, true);
  assert.notEqual(state.shadowType, 0);
  assert.equal(state.floorMapped, true);
  assert.equal(state.wallMapped, true);
  assert.equal(state.floorReceives, true);
  assert.equal(state.deskCasts, true);
  assert.equal(state.keyCasts, true);
  assert.deepEqual(state.shadowSize, [1024, 1024]);
  assert.deepEqual(state.shadowLights, ['room-key-light']);
});
```

- [ ] **Step 2: Run the focused browser suite and prove RED**

Run: `npm run build && npm run smoke`

Expected: FAIL in `bedroom rendering has a bounded material and shadow foundation`, with `bedroom still uses NoToneMapping` as the first rendering-contract failure.

- [ ] **Step 3: Commit the failing contract**

```powershell
git add -- scripts/smoke.mjs
git commit -m "test: define bedroom rendering contract"
```

### Task 2: Configure the Host Renderer

**Files:**
- Modify: `src/host/app.ts:61-68`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: Three.js `ACESFilmicToneMapping` and `PCFSoftShadowMap` constants.
- Produces: `HostApp.renderer` configured with filmic tone mapping, calibrated exposure, and enabled soft shadows before the room is built.

- [ ] **Step 1: Configure renderer response and shadow support**

Immediately after renderer construction, add:

```ts
this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
this.renderer.toneMappingExposure = 1.05;
this.renderer.shadowMap.enabled = true;
this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```

Do not assign `outputColorSpace`; Three.js already defaults to `SRGBColorSpace`, and the browser test pins that engine contract.

- [ ] **Step 2: Run static and unit gates**

Run: `npm test -- --run && npm run build`

Expected: 198 unit tests pass and the production build succeeds. The browser contract remains red because the room objects do not exist yet.

- [ ] **Step 3: Commit the renderer seam**

```powershell
git add -- src/host/app.ts
git commit -m "feat: configure cinematic room renderer"
```

### Task 3: Add Deterministic Architectural Surface Textures

**Files:**
- Modify: `src/host/room.ts:60-66,792-840`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: browser Canvas 2D APIs and Three.js `CanvasTexture`, `RepeatWrapping`, and `SRGBColorSpace`.
- Produces: `makePaintTexture(): THREE.CanvasTexture`, `makeFloorTexture(): THREE.CanvasTexture`, and named mapped shell meshes.

- [ ] **Step 1: Implement deterministic canvas texture helpers**

Add helpers near the existing material helper. Each texture must paint its final colour, set `colorSpace = THREE.SRGBColorSpace`, set both wrap axes to `THREE.RepeatWrapping`, and use only loop-index arithmetic rather than `Math.random()`.

```ts
function makePaintTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for wall texture');
  ctx.fillStyle = '#8b6046';
  ctx.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 4) {
    const alpha = 0.014 + ((y * 17) % 5) * 0.002;
    ctx.fillStyle = `rgba(255,232,204,${alpha})`;
    ctx.fillRect(0, y, 128, 2);
  }
  for (let i = 0; i < 96; i += 1) {
    const x = (i * 47) % 128;
    const y = (i * 73) % 128;
    ctx.fillStyle = i % 2 ? 'rgba(35,20,18,0.018)' : 'rgba(255,238,214,0.018)';
    ctx.fillRect(x, y, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 2);
  return texture;
}
```

Implement `makeFloorTexture()` with a 256 by 256 warm-brown base, four 64-pixel boards, 1-pixel dark seams, and deterministic low-alpha lengthwise grain. Use `texture.repeat.set(1.6, 1.3)`.

- [ ] **Step 2: Apply and name the shell materials**

Create one wall texture and one floor texture per room. Use white Lambert materials so the colour map is not multiplied by the old solid colours. Name the floor `room-floor`, name the north wall `room-wall-north`, and give the other wall segments stable `room-wall-*` names. Set shell planes to `receiveShadow = true` and leave `castShadow = false`.

- [ ] **Step 3: Run build and inspect the generated room**

Run: `npm run build && npm run smoke`

Expected: the new map assertions pass; the scenario still fails because `room-key-light` and `room-desk` shadow participation have not been added.

- [ ] **Step 4: Commit the surface foundation**

```powershell
git add -- src/host/room.ts
git commit -m "feat: texture bedroom architecture"
```

### Task 4: Add One Bounded Key Shadow and Selective Casters

**Files:**
- Modify: `src/host/room.ts:792-840,1337-1404`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: the named shell meshes from Task 3 and the existing `setDusk(t)` room-light transition.
- Produces: named `room-key-light`, named `room-desk`, exactly one shadow-casting light, and selective Lambert mesh shadow participation.

- [ ] **Step 1: Name the desk and mark opaque furniture casters**

Name the desk's primary mesh `room-desk`. After room construction and before returning, traverse the scene. For opaque `THREE.Mesh` instances with a `MeshLambertMaterial`, enable `receiveShadow`; enable `castShadow` unless the object is an architectural shell, transparent, or a thin decorative overlay. Preserve explicitly configured shell flags.

- [ ] **Step 2: Add the bounded key spotlight**

Add a warm `THREE.SpotLight` near the ceiling fixture:

```ts
const keyLight = new THREE.SpotLight(0xffd39a, 6.5, 5.5, Math.PI / 3.2, 0.65, 1.4);
keyLight.name = 'room-key-light';
keyLight.position.set(-0.4, 2.45, -0.2);
keyLight.target.position.set(0, 0.2, 0.15);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.near = 0.15;
keyLight.shadow.camera.far = 6;
keyLight.shadow.bias = -0.00035;
keyLight.shadow.normalBias = 0.025;
scene.add(keyLight, keyLight.target);
```

Reduce the existing practical point light from intensity 14 to 7 so it becomes fill rather than a second key. In `setDusk`, interpolate the key from 4.5 to 7 and the practical from 6 to 8 while preserving the existing ambient/window fade.

- [ ] **Step 3: Run the browser contract and prove GREEN**

Run: `npm run build && npm run smoke`

Expected: all smoke scenarios pass, including one shadow light named `room-key-light`, 1024 by 1024 shadow map, mapped shell, and desk caster assertions.

- [ ] **Step 4: Commit the bounded lighting system**

```powershell
git add -- src/host/room.ts scripts/smoke.mjs
git commit -m "feat: ground bedroom with bounded soft shadows"
```

### Task 5: Visual Calibration and Full Verification

**Files:**
- Modify if calibration requires it: `src/host/app.ts`, `src/host/room.ts`
- Verify: `scripts/smoke.mjs`, `scripts/e2e-full.mjs`

**Interfaces:**
- Consumes: fixed seed URL `/?skipTitle=1&seed=0xC0FFEE` and the completed rendering contract.
- Produces: a fresh 1440 by 900 comparison render, clean browser console, and full gate evidence.

- [ ] **Step 1: Capture and inspect a fixed-seed render**

Run a development server on an available port, open the fixed-seed URL at 1440 by 900, wait 900 milliseconds, save `shots/lighting-after.png`, and inspect it beside `shots/lighting-before.png`.

Reject the calibration if the dialogue text loses contrast, the wall texture reads as noise, the lamp remains a featureless white blob, the floor seams shimmer, or shadows show hard aliasing/intersection acne.

- [ ] **Step 2: Calibrate only documented rendering constants**

If necessary, adjust only renderer exposure, texture alpha/repeats, fill/key intensity, spotlight penumbra, and shadow bias. Do not widen into geometry or UI changes. After every calibration edit, rerun `npm run build && npm run smoke`.

- [ ] **Step 3: Run full verification**

Run: `npm run verify`

Expected: all unit tests, type/build checks, size budgets, browser smoke scenarios, full E2E, and hub build pass. Record exact counts and bundle sizes from the command output.

- [ ] **Step 4: Adversarially inspect final state**

Run: `git diff --check`, inspect `git diff --stat`, confirm browser warnings/errors are empty, and verify the smoke assertion still reports exactly one shadow-casting light.

- [ ] **Step 5: Commit final calibration if changed**

```powershell
git add -- src/host/app.ts src/host/room.ts scripts/smoke.mjs
git commit -m "fix: calibrate bedroom lighting response"
```

Skip this commit when the tree is already clean.
