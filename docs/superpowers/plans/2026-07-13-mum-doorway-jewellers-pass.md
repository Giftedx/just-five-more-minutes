# Mum Doorway Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply a focal-path final-art pass to Mum's existing low-poly doorway vignette without changing gameplay, staging, or texture count.

**Architecture:** Extend the existing production-browser vignette contract first, then refine the procedural asset in place. Preserve `makeMumDoorway`, material batching, marker-transform preservation, and the public `Room` hooks; add only named character and hall cues that survive the design's focal hierarchy.

**Tech Stack:** TypeScript 7, Three.js 0.185.1 procedural geometry, CanvasTexture, Playwright 1.61.1, Vite 8.1.4, Vitest 4.1.10

## Global Constraints

- Modify only `src/host/mum-doorway.ts`, `scripts/smoke.mjs`, and task documentation.
- Add no imported art, image file, font, package, texture, normal map, environment map, post-processing, shadow, event listener, timer, or gameplay behavior.
- Preserve Mum's current total height, `character.position.z = 0.43`, pose, palette, reveal timing, point-light positions/intensities, camera, collider, and interaction behavior.
- Preserve `makeMumDoorway(): MumDoorway`, `Room.npcSilhouette`, `Room.npcTick`, and `Room.setHallLight` compatibility.
- Cloth, skin, hair, paper, wood, runner, and trim remain Lambert; gold and brass use at least one and at most two Phong materials; add no Standard or Physical material.
- Keep the expression canvas as the only character texture; make it exactly 192x192 and sRGB.
- Keep character geometry at or below 3,400 triangles and hall dressing at or below 1,200.
- Keep the staged doorway view at or below 55 draw calls, 5,000 visible triangles, and 14 renderer textures.
- Add no collider, interactable, shadow caster, renderer shadow dependency, or false marker transform.
- Matched-camera median FPS must not regress by more than 5% beyond normal headless sampling noise.

---

## File responsibilities

- `scripts/smoke.mjs` owns stable authored cue names, expression-texture metadata, material-family limits, lifecycle invariants, projection, and rendering budgets.
- `src/host/mum-doorway.ts` owns all procedural character/hall construction, materials, batching, marker transforms, and idle animation.
- `docs/superpowers/specs/2026-07-13-mum-doorway-jewellers-pass-design.md` is the approved scope and visual hierarchy.

### Task 1: Extend the production-browser finish contract

**Files:**
- Modify: `scripts/smoke.mjs:328-485`

**Interfaces:**
- Consumes: the existing `Mum doorway vignette stays authored, animated, inert, and bounded` scenario.
- Produces: named-cue, 192x192 expression-texture, Phong-material, and revised-budget assertions.

- [ ] **Step 1: Add the new stable cue names**

Append these names to the scenario's `names` array and expected `namedParts` result in this exact order:

```js
          'mum-hair-part',
          'mum-armhole-seam-left',
          'mum-armhole-seam-right',
          'mum-cardigan-neckline',
          'mum-cardigan-ribbing',
          'mum-thumb-left',
          'mum-thumb-right',
          'mum-locket',
          'mum-towel-hem',
          'mum-towel-fold',
          'mum-sconce-socket',
          'mum-sconce-rim',
          'mum-family-portrait',
```

- [ ] **Step 2: Measure texture metadata and material families**

Replace the `textures` set inside `metrics` with a map and collect material types:

```js
          const textures = new Map();
          const materialTypes = new Set();
```

Inside the material loop:

```js
                if (!material) continue;
                materialTypes.add(material.type);
                if (material.map) {
                  textures.set(material.map.uuid, {
                    width: material.map.image?.width,
                    height: material.map.image?.height,
                    colorSpace: material.map.colorSpace,
                  });
                }
```

Return:

```js
          return {
            meshes,
            triangles,
            casters,
            lights,
            textures: [...textures.values()],
            materialTypes: [...materialTypes],
          };
```

- [ ] **Step 3: Assert the finish contract and revised budgets**

Replace the old character/hall texture and triangle assertions with:

```js
      assert.ok(before.mum.meshes <= 45 && before.mum.triangles <= 3400, JSON.stringify(before));
      assert.deepEqual(before.mum.textures, [{ width: 192, height: 192, colorSpace: 'srgb' }]);
      assert.ok(before.hall.meshes <= 16 && before.hall.triangles <= 1200, JSON.stringify(before));
      assert.deepEqual(before.hall.textures, []);
      const materialTypes = new Set([...before.mum.materialTypes, ...before.hall.materialTypes]);
      const phongCount = [...before.mum.materialTypes, ...before.hall.materialTypes]
        .filter((type) => type === 'MeshPhongMaterial').length;
      assert.ok(phongCount >= 1 && phongCount <= 2, JSON.stringify(before));
      assert.equal(materialTypes.has('MeshStandardMaterial'), false);
      assert.equal(materialTypes.has('MeshPhysicalMaterial'), false);
```

Update the staged-view assertion to:

```js
      assert.ok(before.calls <= 55 && before.triangles <= 5000 && before.rendererTextures <= 14, JSON.stringify(before));
```

- [ ] **Step 4: Run the current production build and verify RED**

Run: `npm run build && npm run test:browser`

Expected: FAIL in the Mum doorway scenario because the first new named cue is absent; after name inspection the existing expression texture is 128x128 and no Phong material exists. Existing earlier scenarios must pass before the failure.

- [ ] **Step 5: Commit the failing contract**

```powershell
git add scripts/smoke.mjs
git commit -m "test: define Mum jeweller finish contract"
```

### Task 2: Refine Mum's focal-path character details

**Files:**
- Modify: `src/host/mum-doorway.ts:11-329`

**Interfaces:**
- Consumes: `named`, `box`, `ellipsoid`, `limbBetween`, and `batchStaticMeshes`.
- Produces: a 192x192 expression, one gold Phong material, and the ten named character finish cues.

- [ ] **Step 1: Add a restrained metal material helper**

After `lambert`, add:

```ts
const metal = (color: number): THREE.MeshPhongMaterial => new THREE.MeshPhongMaterial({
  color,
  specular: 0xffd8a0,
  shininess: 58,
});
```

Change `const gold = lambert(GOLD);` to `const gold = metal(GOLD);`. Do not convert buttons, cardigan details, or hair to metal.

- [ ] **Step 2: Rebuild the expression at 192x192**

Set the canvas dimensions to 192 and scale the drawing context once:

```ts
  canvas.width = 192;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable for Mum expression');
  ctx.scale(1.5, 1.5);
```

Before the dark irises, draw warm eye shapes:

```ts
  ctx.fillStyle = '#f1dfcb';
  ctx.beginPath();
  ctx.ellipse(39, 63, 9, 5.5, -0.03, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(89, 63, 9, 5.5, 0.03, 0, Math.PI * 2);
  ctx.fill();
```

Replace the existing dark eye ellipses with irises of radius `4.4`, then add catchlights:

```ts
  ctx.fillStyle = '#352821';
  for (const x of [39, 89]) {
    ctx.beginPath();
    ctx.arc(x, 63, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#f8ead8';
  ctx.beginPath();
  ctx.arc(40.5, 61.5, 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(90.5, 61.5, 1.25, 0, Math.PI * 2);
  ctx.fill();
```

After the nose bridge, add the nostrils:

```ts
  ctx.fillStyle = 'rgba(104,76,64,0.7)';
  for (const x of [60, 68]) {
    ctx.beginPath();
    ctx.arc(x, 82, 1.25, 0, Math.PI * 2);
    ctx.fill();
  }
```

After the existing flat mouth, add mouth corners and the quiet chin cue:

```ts
  ctx.strokeStyle = 'rgba(143,79,77,0.76)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(47, 99);
  ctx.lineTo(51, 98);
  ctx.moveTo(78, 98);
  ctx.lineTo(82, 99);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(104,76,64,0.26)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(55, 107);
  ctx.quadraticCurveTo(64, 110, 73, 107);
  ctx.stroke();
```

Keep the existing brows, lids, nose bridge, blush, and flat mouth.

- [ ] **Step 3: Refine shoulders, armholes, neckline, and ribbing**

Replace both shoulder caps with:

```ts
  character.add(ellipsoid(0.068, [9, 6], [1, 0.62, 0.7], cardigan, [-0.178, 1.125, 0]));
  character.add(ellipsoid(0.068, [9, 6], [1, 0.62, 0.7], cardigan, [0.178, 1.125, 0]));
```

Add one half-torus armhole seam per side using `cardiganDark`:

```ts
  const seamLeft = named(new THREE.Mesh(new THREE.TorusGeometry(0.059, 0.006, 4, 10, Math.PI), cardiganDark), 'mum-armhole-seam-left');
  seamLeft.position.set(-0.178, 1.125, 0.04);
  seamLeft.rotation.z = -0.38;
  const seamRight = named(new THREE.Mesh(new THREE.TorusGeometry(0.059, 0.006, 4, 10, Math.PI), cardiganDark), 'mum-armhole-seam-right');
  seamRight.position.set(0.178, 1.125, 0.04);
  seamRight.rotation.z = 0.38;
  character.add(seamLeft, seamRight);
```

Narrow each lapel to width `0.047` and position at x `±0.047`. Add a named lower-half neckline arc:

```ts
  const neckline = named(new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.007, 4, 12, Math.PI), cardiganDark), 'mum-cardigan-neckline');
  neckline.position.set(0, 1.155, 0.137);
  neckline.rotation.z = Math.PI;
  character.add(neckline);
```

Create the hem ribbing as one stable named group:

```ts
  const ribbing = named(new THREE.Group(), 'mum-cardigan-ribbing');
  for (const y of [0.805, 0.815, 0.825]) {
    ribbing.add(box([0.28, 0.006, 0.01], cardiganDark, [0, y, 0.093]));
  }
  character.add(ribbing);
```

- [ ] **Step 4: Add thumbs, necklace, and locket**

Add `mum-thumb-left` at `(0.082, 0.932, 0.192)` and `mum-thumb-right` at `(-0.086, 0.902, 0.205)` using skin-shadow ellipsoids of radius `0.019`, scale `(0.7, 1.05, 0.7)`.

Add a gold half-torus necklace and named locket:

```ts
  const necklace = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.004, 4, 12, Math.PI), gold);
  necklace.position.set(0, 1.12, 0.157);
  necklace.rotation.z = Math.PI;
  character.add(necklace);
  character.add(ellipsoid(0.012, [7, 5], [0.82, 1, 0.65], gold, [0, 1.065, 0.163], 'mum-locket'));
```

- [ ] **Step 5: Add towel construction cues**

Inside `mum-tea-towel`, add:

```ts
  towel.add(box([0.102, 0.018, 0.03], towelShadow, [-0.024, 0.602, 0.22], 'mum-towel-hem'));
  const fold = box([0.018, 0.18, 0.012], towelShadow, [-0.006, 0.73, 0.231], 'mum-towel-fold');
  fold.rotation.z = -0.06;
  towel.add(fold);
  towel.add(box([0.012, 0.18, 0.028], towelStripe, [-0.103, 0.785, 0.216], 'mum-towel-binding'));
```

Move the lower towel panel x position from `-0.024` to `-0.014` to make the hanging edge asymmetric without changing its overall length.

- [ ] **Step 6: Add hair part and bun pin**

Inside `mum-head`, add the part, highlight sweep, and bun pin exactly as follows:

```ts
  const hairPart = box([0.008, 0.07, 0.01], hair, [-0.018, 0.105, 0.108], 'mum-hair-part');
  hairPart.rotation.z = -0.2;
  head.add(hairPart);
  const hairSweep = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.006, 4, 12, Math.PI * 0.72), hairLight);
  hairSweep.position.set(0.006, 0.105, 0.065);
  hairSweep.rotation.z = 0.22;
  head.add(hairSweep);
  const bunPin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.085, 6), gold);
  bunPin.position.set(0.035, 0.092, -0.165);
  bunPin.rotation.z = Math.PI / 2.4;
  head.add(bunPin);
```

The cap sweep and pin remain unnamed because the stable contract already covers the hair part and gold material.

- [ ] **Step 7: Build and run the browser scenario**

Run: `npm run build && npm run test:browser`

Expected: the scenario advances past the new character cues and 192x192 texture assertion, then remains RED on the first missing hall cue (`mum-sconce-socket` or `mum-sconce-rim`). Character triangles must remain at or below 3,400.

- [ ] **Step 8: Run unit tests and commit the character finish**

Run: `npm test`

Expected: 15 files / 198 tests pass.

```powershell
git add src/host/mum-doorway.ts
git commit -m "feat: refine Mum focal character details"
```

### Task 3: Refine the practical light and family portrait

**Files:**
- Modify: `src/host/mum-doorway.ts:331-393`

**Interfaces:**
- Consumes: the `metal` helper and existing hall batching.
- Produces: named socket/rim/portrait cues and the completed green browser contract.

- [ ] **Step 1: Convert brass to the second bounded Phong material**

Change `const brass = lambert(0x9d7132);` to `const brass = metal(0x9d7132);`. Add `const shadeCloth = lambert(0xbda77f);` and use it only for the lampshade.

- [ ] **Step 2: Replace the block-built practical**

Keep `practical.position` unchanged. Replace its current children with:

```ts
  const backplate = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.022, 12), brass);
  backplate.rotation.x = Math.PI / 2;
  practical.add(backplate);
  practical.add(limbBetween(
    'mum-sconce-arm',
    new THREE.Vector3(0, -0.018, -0.018),
    new THREE.Vector3(0, -0.105, -0.13),
    0.012,
    brass,
  ));
  const socket = named(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.055, 10), brass), 'mum-sconce-socket');
  socket.position.set(0, -0.14, -0.14);
  practical.add(socket);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.132, 0.145, 12, 1, true), shadeCloth);
  shade.position.set(0, -0.22, -0.14);
  practical.add(shade);
  const rim = named(new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.007, 5, 14), brass), 'mum-sconce-rim');
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, -0.292, -0.14);
  practical.add(rim);
```

Place a smaller bulb below the rim:

```ts
  const bulb = ellipsoid(
    0.038,
    [9, 6],
    [0.8, 1.05, 0.8],
    new THREE.MeshBasicMaterial({ color: 0xffd5a0 }),
    [0, -0.305, -0.14],
  );
  practical.add(bulb);
```

This keeps the bulb below the rim without reproducing the current white blob.

- [ ] **Step 3: Replace the thermostat-like domestic detail**

Keep the outer frame at `(-0.29, 1.36, 0.476)`. Name the root `mum-family-portrait` instead of `mum-hall-domestic-detail`, and add a nested alias marker named `mum-hall-domestic-detail` so the existing contract remains compatible.

Replace the old bars with these exact layers and silhouettes:

```ts
  const portrait = named(new THREE.Group(), 'mum-family-portrait');
  portrait.add(named(new THREE.Group(), 'mum-hall-domestic-detail'));
  portrait.add(box([0.2, 0.26, 0.018], brass, [-0.29, 1.36, 0.476]));
  portrait.add(box([0.158, 0.216, 0.009], paper, [-0.29, 1.36, 0.464]));
  portrait.add(box([0.125, 0.17, 0.006], lambert(0x3b302b), [-0.29, 1.36, 0.456]));
  const family = [
    { x: -0.032, y: 0.035, radius: 0.016, color: 0xa85d68 },
    { x: 0, y: 0.015, radius: 0.014, color: 0x3f5067 },
    { x: 0.032, y: 0.03, radius: 0.012, color: 0x8a6042 },
  ];
  for (const member of family) {
    const material = lambert(member.color);
    portrait.add(ellipsoid(
      member.radius,
      [7, 5],
      [0.9, 1.05, 0.62],
      paper,
      [-0.29 + member.x, 1.36 + member.y, 0.448],
    ));
    portrait.add(box(
      [member.radius * 2.5, member.radius * 1.7, 0.006],
      material,
      [-0.29 + member.x, 1.325 + member.y, 0.45],
    ));
  }
  hall.add(portrait);
```

The z values keep the silhouettes separated from the aperture without z-fighting.

- [ ] **Step 4: Build and verify GREEN**

Run: `npm run build && npm run test:browser`

Expected: all 17 isolated browser scenarios and full interaction E2E pass. The vignette scenario reports all new names, one 192x192 sRGB texture, one or two Phong material types, no Standard/Physical material, character ≤3,400 triangles, hall ≤1,200, staged view ≤55 calls / 5,000 triangles / 14 textures.

- [ ] **Step 5: Commit the hall finish**

```powershell
git add src/host/mum-doorway.ts scripts/smoke.mjs
git commit -m "feat: finish Mum doorway hero props"
```

### Task 4: Visual calibration and release proof

**Files:**
- Modify only if screenshots expose a defect: `src/host/mum-doorway.ts`
- Modify only if a contract is semantically wrong: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: final production build.
- Produces: original-resolution 1280x720 and 900x600 evidence, matched-camera performance evidence, full verification, reflection, and integrated master.

- [ ] **Step 1: Capture the final dialogue reveal**

Start a production preview on a verified free port and use Playwright CLI to stage the existing real prompt/reveal at 1280x720 and 900x600. Save ignored evidence as:

```text
shots/mum-jewellers-pass-1280.png
shots/mum-jewellers-pass-900.png
```

Reject the candidate if: shoulder seams read as jewellery hoops; the neckline forms a moustache; the locket floats outside the blouse; thumbs detach; towel details become a barcode; hair part resembles a wound; the shade rim intersects the bulb; the portrait returns to a switch/thermostat read; metal becomes white plastic; or any micro-detail outranks the face.

- [ ] **Step 2: Calibrate only observed defects**

Adjust existing positions, scales, colours, shininess, or opacity. Do not add another cue after the design inventory. After every source edit, rebuild and recapture the affected size; after the final edit rerun the browser gate.

- [ ] **Step 3: Profile the matched camera**

Compare the current master baseline and candidate at 1280x720, yaw `Math.PI`, pitch `0`, reveal active, with five 500ms requestAnimationFrame samples. Record median FPS, calls, triangles, and textures. Candidate median FPS must remain within 5% of baseline and all explicit browser budgets.

- [ ] **Step 4: Red-team lifecycle and truth surfaces**

Verify hidden root draw cost, both reveal directions, 20-restart disposal, no extra texture, no collider/interactable, no shadow caster, no Standard/Physical material, truthful named marker transforms, and no `.playwright-cli` or screenshot staging.

- [ ] **Step 5: Run the complete local release gate**

Run: `npm run verify`

Expected: 198 unit tests, standalone build, JS/CSS compressed-size budgets, 17 browser scenarios, full interaction E2E, and mounted `/just-five-more-minutes/` build all pass.

- [ ] **Step 6: Append and validate the required reflection**

Use `apply_patch` to append one JSON object to `reflections.jsonl` in the agent's own memory directory. Use keys `date`, `task`, `outcome`, `surprise`, and `next-time`. Parse every non-empty line. Select the exact task string. Assert all five keys.

- [ ] **Step 7: Commit final calibration if required**

```powershell
git add src/host/mum-doorway.ts scripts/smoke.mjs
git commit -m "fix: calibrate Mum jeweller finish"
```

Skip this commit if visual calibration required no source edit.

- [ ] **Step 8: Integrate locally and clean up**

Fast-forward the verified isolated branch onto `master`, rerun `npm run verify` on the merged tree, remove the owned worktree and feature branch, close task browser sessions, stop only task preview processes, and confirm a clean status. Do not push or deploy without a separate request.
