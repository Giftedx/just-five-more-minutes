# Away Plan Strip Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Mudwick's four functional but nearly invisible standing-order toggles into a clearly labelled, contrast-safe, hoverable `AWAY PLAN` command strip without changing gameplay.

**Architecture:** Export one immutable renderer-owned layout/copy object and one opaque palette. Drawing, hover derivation, and hit-testing consume the same chip rectangles; the existing `MmoGame` click branch remains unchanged. Unit tests pin the pure contract, while one production-browser scenario proves native-coordinate clicks and authored pixels on the real Canvas.

**Tech Stack:** TypeScript 7, Canvas 2D, Vitest 4, Playwright Chromium, Vite 8.

## Global Constraints

- Add no CSS, DOM node, external asset, font, dependency, timer, event listener, route, query parameter, storage field, simulation state, or audio cue.
- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, `imageSmoothingEnabled = false`, all four plan meanings, and all four OFF defaults.
- Do not modify `AwayPlan`, `Career`, `MudwickSim.runAwayPlan()`, or `MmoGame.handleLeftClick()`.
- Use one shared layout for drawing and hit-testing; the plate and caption remain non-interactive.
- Keep the full strip inside `x < 240`; do not cover or mutate the side panel.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes. CSS must remain byte-for-byte unchanged.
- Keep captures and temporary browser state ignored. Do not pull, push, open a PR, or deploy.

---

## File map

- Modify `src/mmo/render/renderer.ts`: immutable copy/layout/palette, shared hit geometry, hover-aware strip drawing.
- Modify `src/mmo/render/renderer.test.ts`: copy, geometry, hit boundaries, default-state purity, and contrast contracts.
- Modify `scripts/smoke.mjs`: real standalone-Mudwick pixel, hover, and click proof.
- Modify `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`: exact closure evidence after verification.
- Modify this plan: checkboxes and exact execution evidence.

### Task 1: Establish the focused baseline

**Files:**
- Read: `src/mmo/render/renderer.ts`
- Read: `src/mmo/render/renderer.test.ts`
- Read: `src/mmo/render/game.ts`

**Interfaces:**
- Consumes: current `MmoRenderer.awayPlanButtonAt(cx, cy): keyof AwayPlan | null` and `MmoGame` click branch.
- Produces: fresh baseline evidence only; no file changes.

- [x] **Step 1: Run the focused renderer and simulation tests**

Run:

```powershell
npm test -- src/mmo/render/renderer.test.ts src/mmo/sim/sim.depth.test.ts
```

Expected before changes: both files pass and all current away-plan simulation behavior remains green.

- [x] **Step 2: Record the current bundle and CSS hashes**

Run:

```powershell
npm run build
npm run size:check
Get-FileHash src/ui/style.css -Algorithm SHA256
```

Expected before changes: JavaScript is inside 204,800 gzip bytes, CSS is 41,737 raw / 10,091 gzip bytes, and the CSS hash is retained for closure comparison.

### Task 2: Lock the strip contract in failing unit and browser tests

**Files:**
- Modify: `src/mmo/render/renderer.test.ts`
- Modify: `scripts/smoke.mjs`
- Test: `src/mmo/render/renderer.test.ts`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: planned exports `AWAY_PLAN_UI` and `AWAY_PLAN_COLORS` from `./renderer`.
- Produces: failing copy/layout/hit/contrast and real-Canvas contracts that the renderer implementation must satisfy.

- [x] **Step 1: Add the exact authored contract test**

Extend the import surface through the existing `rendererModule` namespace and add:

```ts
describe('away plan command strip', () => {
  it('pins the exact caption, chip order, and native geometry', () => {
    const ui = (rendererModule as typeof rendererModule & {
      AWAY_PLAN_UI?: {
        plate: { x: number; y: number; w: number; h: number };
        caption: string;
        chips: readonly {
          key: 'keepWorking' | 'eatBread' | 'runHome' | 'autoSell';
          label: string;
          x: number;
          y: number;
          w: number;
          h: number;
        }[];
      };
    }).AWAY_PLAN_UI;

    expect(ui).toEqual({
      plate: { x: 131, y: 1, w: 108, h: 22 },
      caption: 'AWAY PLAN',
      chips: [
        { key: 'keepWorking', label: 'WORK', x: 135, y: 10, w: 24, h: 11 },
        { key: 'eatBread', label: 'EAT', x: 161, y: 10, w: 24, h: 11 },
        { key: 'runHome', label: 'HOME', x: 187, y: 10, w: 24, h: 11 },
        { key: 'autoSell', label: 'SELL', x: 213, y: 10, w: 24, h: 11 },
      ],
    });
  });
});
```

- [x] **Step 2: Add hit-boundary and render-purity tests**

Inside the same describe block add:

```ts
it('maps every drawn chip and excludes caption, gaps, and right/bottom edges', () => {
  const sim = new MudwickSim({ seed: 13 });
  const renderer = new MmoRenderer(sim, 600, 13);

  expect(renderer.awayPlanButtonAt(135, 10)).toBe('keepWorking');
  expect(renderer.awayPlanButtonAt(158.99, 20.99)).toBe('keepWorking');
  expect(renderer.awayPlanButtonAt(161, 10)).toBe('eatBread');
  expect(renderer.awayPlanButtonAt(187, 10)).toBe('runHome');
  expect(renderer.awayPlanButtonAt(236.99, 20.99)).toBe('autoSell');
  expect(renderer.awayPlanButtonAt(134.99, 10)).toBeNull();
  expect(renderer.awayPlanButtonAt(159, 10)).toBeNull();
  expect(renderer.awayPlanButtonAt(135, 9.99)).toBeNull();
  expect(renderer.awayPlanButtonAt(237, 10)).toBeNull();
  expect(renderer.awayPlanButtonAt(213, 21)).toBeNull();
  expect(renderer.awayPlanButtonAt(140, 6)).toBeNull();
  expect(sim.awayPlan).toEqual({ keepWorking: false, eatBread: false, runHome: false, autoSell: false });
});
```

- [x] **Step 3: Add opaque palette contrast tests**

Add a local luminance helper in the describe block and assert every text state:

```ts
it('keeps caption, OFF, ON, and hover text above 4.5:1', () => {
  const colors = (rendererModule as typeof rendererModule & {
    AWAY_PLAN_COLORS?: Record<string, string>;
  }).AWAY_PLAN_COLORS;
  expect(colors).toBeDefined();
  if (!colors) return;

  const luminance = (hex: string): number => {
    const channels = [1, 3, 5]
      .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
  };
  const contrast = (a: string, b: string): number => {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (values[0]! + 0.05) / (values[1]! + 0.05);
  };

  expect(contrast(colors.caption!, colors.plate!)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.offText!, colors.offBg!)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.onText!, colors.onBg!)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.hover!, colors.offBg!)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(colors.hover!, colors.onBg!)).toBeGreaterThanOrEqual(4.5);
});
```

- [x] **Step 4: Run the unit test to verify RED**

Run:

```powershell
npm test -- src/mmo/render/renderer.test.ts
```

Expected: the copy/layout and palette tests fail because both exports are absent; hit assertions also fail against the old `y = 4`, `22x11`, abbreviated layout.

- [x] **Step 5: Add a minimal failing production-browser contract**

Add this scenario after the document-icon check:

```js
await scenario(
  'Mudwick away plan strip is labelled, stateful, and hit-aligned',
  { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' },
  async (page) => {
    await gotoOk(page, { dev: 'mmo', speed: 0.1 });
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible' });
    const platePixel = await canvas.evaluate((element) => {
      const ctx = element.getContext('2d');
      return [...ctx.getImageData(132, 3, 1, 1).data];
    });
    assert.deepEqual(platePixel, [23, 32, 18, 255]);
  },
);
```

- [x] **Step 6: Run the production browser contract to verify RED**

Run:

```powershell
npm run build
npm run test:browser
```

Expected: the new scenario fails at the plate pixel because the old renderer draws world terrain at `(132, 3)` and has no labelled opaque strip.

- [x] **Step 7: Commit both red contracts**

Run `git diff --check`, then:

```powershell
git add src/mmo/render/renderer.test.ts scripts/smoke.mjs
git commit -m "test: expose weak away plan controls"
```

### Task 3: Implement the shared command-strip renderer contract

**Files:**
- Modify: `src/mmo/render/renderer.ts`
- Test: `src/mmo/render/renderer.test.ts`

**Interfaces:**
- Produces: `AWAY_PLAN_UI`, `AWAY_PLAN_COLORS`, shared hit geometry, and hover-aware drawing.
- Preserves: `awayPlanButtonAt(cx, cy): keyof AwayPlan | null` and every `MmoGame` consumer.

- [x] **Step 1: Add immutable copy, layout, and opaque palette exports**

After `DOUBLE_XP_COPY`, add:

```ts
export const AWAY_PLAN_COLORS = {
  plate: '#172012',
  plateBorder: '#6f7f54',
  caption: '#e8c33f',
  offBg: '#303328',
  offBorder: '#8a8f78',
  offText: '#f0ead8',
  onBg: '#315a2c',
  onBorder: '#8be86b',
  onText: '#f0ffe8',
  hover: '#fff4d0',
  stateBar: '#8be86b',
} as const;

export const AWAY_PLAN_UI = {
  plate: { x: 131, y: 1, w: 108, h: 22 },
  caption: 'AWAY PLAN',
  chips: [
    { key: 'keepWorking', label: 'WORK', x: 135, y: 10, w: 24, h: 11 },
    { key: 'eatBread', label: 'EAT', x: 161, y: 10, w: 24, h: 11 },
    { key: 'runHome', label: 'HOME', x: 187, y: 10, w: 24, h: 11 },
    { key: 'autoSell', label: 'SELL', x: 213, y: 10, w: 24, h: 11 },
  ],
} as const satisfies {
  plate: { x: number; y: number; w: number; h: number };
  caption: string;
  chips: readonly {
    key: keyof AwayPlan;
    label: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }[];
};
```

- [x] **Step 2: Make hit-testing consume the exported chip rectangles**

Replace `awayPlanButtons()` and the current hit loop with:

```ts
awayPlanButtonAt(cx: number, cy: number): keyof AwayPlan | null {
  for (const chip of AWAY_PLAN_UI.chips) {
    if (
      cx >= chip.x && cx < chip.x + chip.w
      && cy >= chip.y && cy < chip.y + chip.h
    ) return chip.key;
  }
  return null;
}
```

Delete the private abbreviated-layout helper so no second geometry source remains.

- [x] **Step 3: Replace the four floating slots with the command strip**

Replace `drawAwayPlanChips()` with:

```ts
private drawAwayPlanChips(): void {
  const ctx = this.ctx;
  const { plate, caption, chips } = AWAY_PLAN_UI;
  const colors = AWAY_PLAN_COLORS;

  ctx.save();
  ctx.fillStyle = colors.plate;
  ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
  ctx.strokeStyle = colors.plateBorder;
  ctx.strokeRect(plate.x + 0.5, plate.y + 0.5, plate.w - 1, plate.h - 1);
  ctx.font = 'bold 6px monospace';
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.caption;
  ctx.fillText(caption, plate.x + 4, plate.y + 6);

  ctx.textAlign = 'center';
  for (const chip of chips) {
    const on = this.sim.awayPlan[chip.key];
    const hovered = this.mouse !== null
      && this.awayPlanButtonAt(this.mouse.x, this.mouse.y) === chip.key;
    ctx.fillStyle = on ? colors.onBg : colors.offBg;
    ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
    ctx.strokeStyle = hovered ? colors.hover : on ? colors.onBorder : colors.offBorder;
    ctx.strokeRect(chip.x + 0.5, chip.y + 0.5, chip.w - 1, chip.h - 1);
    ctx.fillStyle = hovered ? colors.hover : on ? colors.onText : colors.offText;
    ctx.fillText(chip.label, chip.x + chip.w / 2, chip.y + 7);
    if (on) {
      ctx.fillStyle = colors.stateBar;
      ctx.fillRect(chip.x + 3, chip.y + chip.h - 3, chip.w - 6, 2);
    }
  }
  ctx.restore();
}
```

- [x] **Step 4: Run focused tests and typecheck to verify GREEN**

Run:

```powershell
npm test -- src/mmo/render/renderer.test.ts src/mmo/sim/sim.depth.test.ts
npm run typecheck
```

Expected: both focused files pass, all four hit mappings are exact, and TypeScript reports no unused old layout helper.

- [x] **Step 5: Build and enforce budgets**

Run:

```powershell
npm run build
npm run size:check
```

Expected: JavaScript remains at or below 204,800 gzip bytes and CSS remains 41,737 raw / 10,091 gzip bytes.

- [x] **Step 6: Commit the renderer repair**

Run `git diff --check`, then:

```powershell
git add src/mmo/render/renderer.ts
git commit -m "polish: clarify the away plan strip"
```

### Task 4: Guard the real production interaction and pixels

**Files:**
- Modify: `scripts/smoke.mjs`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: native 320x240 `canvas`, the shared chip rectangles, and existing `.crt-screen` scaling.
- Produces: one isolated browser scenario proving authored OFF/hover/ON pixels and real click alignment.

- [x] **Step 1: Expand the minimal red scenario with pixel and client-coordinate helpers**

Replace the minimal scenario body after its initial navigation with:

```js
    const rgbaAt = (x, y) => canvas.evaluate((element, point) => {
      const ctx = element.getContext('2d');
      if (!ctx) throw new Error('Mudwick canvas has no 2D context');
      return [...ctx.getImageData(point.x, point.y, 1, 1).data];
    }, { x, y });
    const clientPoint = async (x, y) => {
      const box = await canvas.boundingBox();
      assert.ok(box, 'Mudwick canvas has no client bounds');
      return {
        x: box.x + ((x + 0.5) / 320) * box.width,
        y: box.y + ((y + 0.5) / 240) * box.height,
      };
    };
```

- [x] **Step 2: Pin the opaque plate and OFF-state pixels**

Continue the scenario:

```js
    assert.deepEqual(await rgbaAt(132, 3), [23, 32, 18, 255]);
    for (const x of [137, 163, 189, 215]) {
      assert.deepEqual(await rgbaAt(x, 11), [48, 51, 40, 255]);
    }
    const panelBefore = await rgbaAt(240, 12);
```

The sample points are opaque fill anchors, not anti-aliased glyph pixels.

- [x] **Step 3: Prove hover and each real click**

Continue:

```js
    for (const x of [135, 161, 187, 213]) {
      const hoverPoint = await clientPoint(x + 1, 10);
      await page.mouse.move(hoverPoint.x, hoverPoint.y);
      await page.waitForTimeout(50);
      const hoveredEdge = await rgbaAt(x, 10);
      assert.ok(
        hoveredEdge[0] > 180 && hoveredEdge[1] > 170 && hoveredEdge[2] > 130,
        `chip at ${x} did not gain a parchment hover edge: ${hoveredEdge}`,
      );

      const clickPoint = await clientPoint(x + 12, 15);
      await page.mouse.click(clickPoint.x, clickPoint.y);
      await page.waitForTimeout(50);
      assert.deepEqual(await rgbaAt(x + 2, 11), [49, 90, 44, 255]);
      assert.deepEqual(await rgbaAt(x + 4, 19), [139, 232, 107, 255]);

      await page.mouse.click(clickPoint.x, clickPoint.y);
      await page.waitForTimeout(50);
      assert.deepEqual(await rgbaAt(x + 2, 11), [48, 51, 40, 255]);
    }
    assert.deepEqual(await rgbaAt(240, 12), panelBefore, 'strip entered the stats panel');
```

- [x] **Step 4: Preserve the observed red-test teeth**

Confirm the original Task 2 browser run failed at `(132, 3)`. The expanded assertions must remain stricter: the old renderer has no plate, uses chip `x = 142` and `y = 4`, has no hover edge or state bar, and cannot satisfy the full-word shared contract. Do not weaken the assertions to match old pixels.

- [x] **Step 5: Run browser, build, and size checks**

Run:

```powershell
npm run build
npm run size:check
npm run test:browser
```

Expected: 29 isolated browser scenarios and the full interaction E2E pass; CSS bytes remain unchanged.

- [x] **Step 6: Commit the browser guard**

Run `git diff --check`, then:

```powershell
git add scripts/smoke.mjs
git commit -m "test: guard the away plan command strip"
```

### Task 5: Visual review, adversarial verification, and closure

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-away-plan-strip-jewellers-pass.md`

**Interfaces:**
- Consumes: the green renderer and browser contract.
- Produces: ignored visual proof, synchronized program truth, and integrated-master evidence.

- [x] **Step 1: Capture OFF, hover, and mixed-state production frames**

Serve the standalone production build and capture `?dev=mmo&speed=0.1` at 1280x720 under ignored `shots/`:

- `away-plan-strip-off.png`
- `away-plan-strip-hover.png`
- `away-plan-strip-mixed.png`

Reject the result if the caption is not readable, full labels blur together, the plate looks like a modern web card, the strip covers the side panel, hover is weaker than OFF borders, or ON depends on green without the state bar.

- [x] **Step 2: Red-team and verify findings**

Review and source-verify:

- all four left/top inclusive and right/bottom exclusive hit edges;
- caption/plate non-interactivity;
- mouseleave hover cleanup through existing `renderer.mouse = null`;
- rendering purity and unchanged all-OFF defaults;
- disconnect final ownership;
- trade/context-menu draw order;
- objective, chat, XP-drop, and Double-XP overlap;
- side-panel boundary at `x = 240`;
- exact opaque-pixel assertions versus anti-aliased false passes;
- CSS hash equality and JavaScript size headroom.

Only source- or reproduction-confirmed findings become fixes.

- [x] **Step 3: Run the complete feature-worktree gate**

Run:

```powershell
npm run verify
```

Expected: all unit tests, standalone build, size checks, 29 isolated browser scenarios, full interaction E2E, and mounted build pass.

- [x] **Step 4: Record exact closure evidence**

Append unit count, browser scenario count, JS/CSS sizes, CSS hash comparison, capture paths, and red-team outcome to this plan. Add a concise closure section to `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`.

- [x] **Step 5: Commit closure truth**

Run `git diff --check`, then:

```powershell
git add docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md docs/superpowers/plans/2026-07-15-away-plan-strip-jewellers-pass.md
git commit -m "docs: close away plan strip pass"
```

- [x] **Step 6: Integrate and verify master**

Fast-forward local `master`, run `npm run verify` again from the integrated tree, restore standalone `dist`, copy ignored proof into the main checkout, remove the owned worktree and merged branch, and confirm a clean repository.

Expected: the integrated master gate independently passes; no pull, push, PR, or deployment occurs.

## Feature-worktree execution evidence

- Baseline: 37 focused tests passed. Standalone artifacts were 756,286 raw / 203,408 gzip bytes of JavaScript and 41,737 raw / 10,091 gzip bytes of CSS. `src/ui/style.css` SHA-256 was `E1E4706C5B04D8A5B4E3E754B25E1F2B03FBB5BDDBC7139FEE6C61090A3933B3`.
- RED: the renderer test failed three intended contracts because `AWAY_PLAN_UI` and `AWAY_PLAN_COLORS` were absent and `(135, 10)` missed the old abbreviated geometry. The production browser read terrain `[45, 75, 31, 255]` at the planned plate anchor instead of `[23, 32, 18, 255]`.
- GREEN: 40 focused renderer/simulation tests and typecheck passed. The real browser pinned the plate, every OFF/hover/ON state, all four scaled clicks, the ON state bar, and the `x = 240` panel boundary.
- Adversarial review: one candidate survived verification. A live `+25 Woodcutting` drop changed 243 pixels inside the plate because XP text was drawn after the strip at the same coordinates. The regression failed before repair and now requires zero changed plate pixels; XP motion begins below the plate. Side-panel bleed, hit-edge drift, caption interactivity, stale mouseleave hover, default-state mutation, overlay ownership, and CSS drift were rejected by source evidence and passing runtime guards. Security, persistence, migration, and external-service categories do not apply to this renderer-only change.
- Full feature-tree gate: 19 test files / 226 tests passed, followed by standalone build, size check, 29 isolated browser scenarios, full interaction E2E (`TOTAL54 / 100`, ending `Employee of the Month (This House)`), and the mounted `/just-five-more-minutes/` build.
- Final standalone artifacts: 756,895 raw / 203,637 gzip bytes of JavaScript and 41,737 raw / 10,091 gzip bytes of CSS, leaving 1,163 gzip bytes of JavaScript headroom and 21 gzip bytes of CSS headroom. The stylesheet hash remained exactly `E1E4706C5B04D8A5B4E3E754B25E1F2B03FBB5BDDBC7139FEE6C61090A3933B3`.
- Ignored visual proof: `shots/away-plan-strip-off.png`, `shots/away-plan-strip-hover.png`, `shots/away-plan-strip-mixed.png`, `shots/away-plan-strip-900x400.png`, and `shots/away-plan-strip-xp-clear.png`. All were reviewed from the production build; no curated repository asset changed.

## Integrated-master evidence

Local `master` fast-forwarded from `8b8ee40` to `bbc4092`. A fresh integrated `npm run verify` independently repeated all 19 test files / 226 tests, both production builds, the size gate, all 29 isolated browser scenarios, and the full interaction E2E. A final standalone rebuild restored root-relative `dist` and repeated the 203,637-byte JavaScript and 10,091-byte CSS gzip figures. The five ignored proof captures were copied into the main checkout, the owned `.worktrees/away-plan-strip` worktree was removed, its merged branch was deleted, and the repository returned clean. No pull, push, PR, deployment, dependency install, lockfile change, or live-route claim occurred.

## Self-review

- Spec coverage: exact label/copy, 108x22 geometry, one shared draw/hit source, OFF/ON/hover states, non-colour marker, contrast, edge semantics, draw ownership, no gameplay/persistence change, CSS immutability, size gates, visual proof, red-team, and both verification tiers each have an explicit task.
- Placeholder scan: no deferred code, unspecified test, vague error handling, or unbounded follow-up remains.
- Type consistency: `AWAY_PLAN_UI`, `AWAY_PLAN_COLORS`, `plate`, and the four `keyof AwayPlan` chip keys are identical across implementation, unit tests, browser proof, and closure steps.
