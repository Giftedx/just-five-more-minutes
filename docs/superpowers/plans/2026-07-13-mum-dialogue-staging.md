# Mum Dialogue Staging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep Mum's authored doorway character unobscured during dialogue, balance the objective HUD, and eliminate the missing-favicon resource error without changing gameplay.

**Architecture:** Preserve the existing `Hud` DOM and event flow. Recompose the lower dialogue lane with CSS Grid, protect the visual result with a real-browser projected-character overlap test, and keep the adjacent objective/favicon fixes declarative in CSS and `index.html`.

**Tech Stack:** TypeScript 7, CSS Grid, Three.js 0.185 runtime geometry, Node.js ESM, Playwright 1.61, Vite 8.

## Global Constraints

- Preserve Mum's model, doorway animation, dialogue timing, scoring, audio, response semantics, DOM order, and keyboard order.
- Do not add dependencies, image files, external fonts, camera control, WebGL work, or gameplay behavior.
- Keep all four response choices, countdown feedback, focus treatment, subtitles, and toasts visible at the supported 900px desktop floor.
- At 900x600 and 1280x720, neither dialogue panel may intersect Mum's projected upper-body rectangle while the player faces the doorway.
- The prompt must occupy the lower-left lane and the subtitle the lower-right lane without panel overlap.
- The objective must use balanced wrapping and avoid a reward-only final line in the representative long-copy state.
- The favicon must be an inline data URL and must not trigger a failed network response.
- Existing reduced-motion behavior and room rendering budgets must remain unchanged.

---

## File responsibilities

- `scripts/smoke.mjs` owns browser-observed composition, focus, network-resource, and wrapping contracts.
- `src/ui/style.css` owns the HUD grid, dialogue lanes, and objective wrapping.
- `index.html` owns the self-contained document favicon declaration.
- No runtime TypeScript or Three.js scene file changes are expected.

### Task 1: Self-contained favicon and clean resource load

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: the existing `scenario`, `gotoOk`, and production document head.
- Produces: an inline `link[rel~="icon"]` whose `href` begins with `data:image/svg+xml` and no favicon HTTP request.

- [ ] **Step 1: Add the failing browser scenario**

Insert after the two device-gate scenarios:

```js
  await scenario('document icon is self-contained and resource-clean', { viewport: { width: 1000, height: 700 } }, async (page) => {
    const failedResponses = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });
    await gotoOk(page, { seed: 111 });
    await page.waitForLoadState('networkidle');
    const iconHref = await page.locator('link[rel~="icon"]').getAttribute('href');
    assert.match(iconHref ?? '', /^data:image\/svg\+xml,/);
    assert.deepEqual(failedResponses, [], `failed document resources: ${failedResponses.join(', ')}`);
  });
```

- [ ] **Step 2: Run the managed browser gate and verify RED**

Run: `npm run build && npm run test:browser`

Expected: FAIL in `document icon is self-contained and resource-clean` because the document has no icon declaration and Chromium receives `404 /favicon.ico`.

- [ ] **Step 3: Add the inline favicon**

Add after the theme-colour metadata in `index.html`:

```html
    <link
      rel="icon"
      href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='10' fill='%23100d0a'/%3E%3Crect x='10' y='12' width='44' height='34' rx='4' fill='%23d8d0c0'/%3E%3Crect x='14' y='16' width='36' height='25' fill='%232b5f25'/%3E%3Cpath d='M20 52h24' stroke='%23e8c33f' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E"
    />
```

- [ ] **Step 4: Rebuild and verify GREEN**

Run: `npm run build && npm run test:browser`

Expected: all browser scenarios pass; the clean-resource scenario observes no response at status 400 or above.

- [ ] **Step 5: Commit**

```powershell
git add index.html scripts/smoke.mjs
git commit -m "fix: make the document icon self-contained"
```

### Task 2: Character-safe dialogue staging

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: `.hud-dialogue-stack`, `.hud-prompt`, `.hud-subtitle`, `.hud-toast`, `window.__game.host.player`, `window.__game.host.camera`, and `window.__game.host.room.npcSilhouette`.
- Produces: a two-column lower-third grid with prompt, subtitle, and toast grid areas.

- [ ] **Step 1: Replace the vertical-gap assertion with a projected-character contract**

Rename the scenario to `dialogue staging keeps Mum visible and controls separated`. After the prompt/subtitle visibility wait, stage the existing room without changing shipped behavior:

```js
    await page.evaluate(() => {
      const game = window.__game;
      const player = game.host.player;
      player.yaw = Math.PI;
      player.pitch = 0;
      player.apply();
      game.host.room.npcSilhouette.visible = true;
      game.host.room.setHallLight(true);
      game.silhouetteHideAt = performance.now() + 60_000;
    });
    await page.waitForTimeout(300);
```

Replace `dialogueGap` with this geometry result:

```js
    const measureDialogueGeometry = () => page.evaluate(() => {
      const rect = (selector) => {
        const value = document.querySelector(selector).getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      };
      const prompt = rect('.hud-prompt');
      const subtitle = rect('.hud-subtitle');
      const objective = document.querySelector('.hud-objective').getBoundingClientRect();
      const chore = document.querySelector('.hud-chore').getBoundingClientRect();
      const host = window.__game.host;
      const root = host.room.npcSilhouette;
      const points = [];
      root.updateWorldMatrix(true, true);
      root.traverse((object) => {
        if (!object.isMesh || !object.geometry) return;
        object.geometry.computeBoundingBox();
        const box = object.geometry.boundingBox;
        if (!box) return;
        for (const x of [box.min.x, box.max.x]) {
          for (const y of [box.min.y, box.max.y]) {
            for (const z of [box.min.z, box.max.z]) {
              const point = box.min.clone().set(x, y, z);
              object.localToWorld(point);
              point.project(host.camera);
              points.push({
                x: (point.x * 0.5 + 0.5) * innerWidth,
                y: (-point.y * 0.5 + 0.5) * innerHeight,
              });
            }
          }
        }
      });
      const mum = {
        left: Math.min(...points.map((point) => point.x)),
        right: Math.max(...points.map((point) => point.x)),
        top: Math.min(...points.map((point) => point.y)),
        bottom: Math.max(...points.map((point) => point.y)),
      };
      const upperBody = { ...mum, bottom: mum.top + (mum.bottom - mum.top) * 0.68 };
      const overlapArea = (a, b) => (
        Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
      );
      return {
        prompt,
        subtitle,
        mum: upperBody,
        promptSubtitleOverlap: overlapArea(prompt, subtitle),
        promptMumOverlap: overlapArea(prompt, upperBody),
        subtitleMumOverlap: overlapArea(subtitle, upperBody),
        taskGap: chore.top - objective.bottom,
        viewportWidth: innerWidth,
      };
    });
    const assertDialogueGeometry = (geometry) => {
      assert.ok(geometry.prompt.right <= geometry.viewportWidth * 0.48, JSON.stringify(geometry));
      assert.ok(geometry.subtitle.left >= geometry.viewportWidth * 0.38, JSON.stringify(geometry));
      assert.equal(geometry.promptSubtitleOverlap, 0, JSON.stringify(geometry));
      assert.equal(geometry.promptMumOverlap, 0, JSON.stringify(geometry));
      assert.equal(geometry.subtitleMumOverlap, 0, JSON.stringify(geometry));
    };
    const compactGeometry = await measureDialogueGeometry();
    assertDialogueGeometry(compactGeometry);
```

Keep the existing `taskGap`, focus, toast tone, toast marker, and `toast/prompt gap` assertions.

- [ ] **Step 2: Run against the baseline build and verify RED**

Run: `npm run build && npm run test:browser`

Expected: FAIL because the centered prompt intersects Mum's projected upper body and its right edge exceeds 48% of the viewport.

- [ ] **Step 3: Implement the asymmetric grid**

Replace the existing `.hud-dialogue-stack` positioning rules and add explicit areas:

```css
.hud-dialogue-stack {
  position: fixed;
  left: 18px;
  right: 18px;
  bottom: clamp(18px, 4vh, 44px);
  width: auto;
  display: grid;
  grid-template-columns: minmax(300px, 340px) minmax(360px, 680px);
  grid-template-areas:
    'toast toast'
    'prompt subtitle';
  justify-content: center;
  align-items: end;
  gap: 12px clamp(18px, 6vw, 96px);
  pointer-events: none;
}

.hud-prompt {
  grid-area: prompt;
  width: 100%;
  min-width: 0;
}

.hud-subtitle {
  grid-area: subtitle;
  width: 100%;
  justify-self: stretch;
}

.hud-toast {
  grid-area: toast;
  justify-self: center;
}
```

Remove the old `left: 50%`, `transform: translateX(-50%)`, fixed stack width, flex-direction, `align-items`, and `.hud-toast { order: -1; }` declarations superseded by the grid.

- [ ] **Step 4: Verify at both supported compositions**

After the 900x600 assertions and before the focus/toast checks, resize the same live scenario and rerun the same helper:

```js
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(100);
    const desktopGeometry = await measureDialogueGeometry();
    assertDialogueGeometry(desktopGeometry);
```

Run: `npm run build && npm run test:browser`

Expected: both 900x600 and 1280x720 pass with zero upper-body overlap, four visible options, and unchanged focus/toast assertions.

- [ ] **Step 5: Commit**

```powershell
git add scripts/smoke.mjs src/ui/style.css
git commit -m "fix: stage Mum dialogue around the doorway"
```

### Task 3: Balanced objective copy

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `src/ui/style.css`

**Interfaces:**
- Consumes: `.hud-objective` and the existing long initial objective text.
- Produces: a maximum 390px balanced text block whose final line is not a short reward orphan.

- [ ] **Step 1: Add the failing wrapping assertion**

In the 1280x720 dialogue scenario, collect direct text line rectangles:

```js
      const objectiveEl = document.querySelector('.hud-objective');
      const range = document.createRange();
      range.selectNodeContents(objectiveEl);
      const lineWidths = [...range.getClientRects()].map((line) => line.width);
```

Return `objectiveTextWrap: getComputedStyle(objectiveEl).textWrap` and `objectiveLineWidths: lineWidths`, then assert:

```js
    assert.equal(geometry.objectiveTextWrap, 'balance');
    const widestLine = Math.max(...geometry.objectiveLineWidths);
    const finalLine = geometry.objectiveLineWidths.at(-1) ?? 0;
    assert.ok(finalLine >= widestLine * 0.35, `objective reward orphaned: ${JSON.stringify(geometry.objectiveLineWidths)}`);
```

- [ ] **Step 2: Run the browser gate and verify RED**

Run: `npm run build && npm run test:browser`

Expected: FAIL because computed `text-wrap` is `wrap`, not `balance`.

- [ ] **Step 3: Implement balanced wrapping**

Update `.hud-objective`:

```css
.hud-objective {
  max-width: 390px;
  text-wrap: balance;
  /* retain every existing declaration */
}
```

- [ ] **Step 4: Rebuild, verify GREEN, and visually inspect**

Run: `npm run build && npm run test:browser`

Expected: the representative objective has balanced lines with no reward-only final line and every browser scenario passes.

- [ ] **Step 5: Commit**

```powershell
git add scripts/smoke.mjs src/ui/style.css
git commit -m "fix: balance bedroom objective copy"
```

### Task 4: Full verification and adversarial closeout

**Files:**
- Modify only if fresh evidence proves a scoped regression.

**Interfaces:**
- Consumes: the merged dialogue, objective, and document-head changes.
- Produces: fresh release-gate, screenshot, performance-parity, and residual-risk evidence.

- [ ] **Step 1: Capture baseline and candidate render metrics**

In three fresh Chromium processes per build, record `renderer.info.render.calls`, `renderer.info.render.triangles`, `renderer.info.memory.textures`, and one-second frame cadence while the room is settled.

Expected: calls, triangles, and textures are identical because the change is DOM/CSS only; frame cadence has no meaningful regression.

- [ ] **Step 2: Run the full repository gate**

Run: `npm run verify`

Expected: 198 or more unit tests, standalone build, size budgets, all browser smokes, full interaction E2E, and mounted build pass.

- [ ] **Step 3: Capture visual evidence**

Capture prompt-open doorway views at 900x600 and 1280x720 plus a settled non-dialogue room view. Confirm Mum's face, cardigan, crossed arms, tea towel, and doorway silhouette remain readable; controls and captions do not collide; the non-dialogue room is unchanged.

- [ ] **Step 4: Red-team the final diff**

Check malformed/long dialogue copy, 900px width, short height, focus order, toast overlap, objective/clock separation, reduced motion, data-URL parsing, CSP assumptions, WebGL ownership, and stale centered-stack assertions. Verify findings against source and runtime evidence before editing.

- [ ] **Step 5: Record the required reflection**

Append one JSON line to `C:\Users\aggis\.Codex\memory\reflections.jsonl` with exactly `date`, `task`, `outcome`, `surprise`, and `next-time`, then parse every line and validate the final keys.

- [ ] **Step 6: Integrate only after all checks pass**

Fast-forward the completed isolated branch onto `master`, remove the worktree and branch, ensure no preview process remains, and confirm `git status --short --branch` is clean apart from intentional ignored visual evidence.
