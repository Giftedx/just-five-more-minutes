# Mudwick Action Readout Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mudwick's unbounded inline hover sentence with a bounded two-line action readout that preserves full primary copy and never overwrites the adjacent away-plan plate.

**Architecture:** Export one immutable renderer-owned layout/palette object and one pure label formatter. `drawHoverText()` consumes both while every simulation, mouse, click, right-click, menu, and trade path remains unchanged; unit tests pin copy and contrast, and the existing production-browser strip scenario proves real bridge-hover ownership.

**Tech Stack:** TypeScript 7, Canvas 2D, Vitest 4, Playwright Chromium, Vite 8.

## Global Constraints

- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, disabled image smoothing, and the existing `{ x: 131, y: 1, w: 108, h: 22 }` away-plan plate.
- Preserve every `MudwickSim.optionsAt()` label and ordering rule, mouse-to-tile calculation, left-click action, right-click menu, menu geometry, trade ownership, away-plan field, simulation rule, and persistence contract.
- Add no CSS, DOM node, listener, timer, state field, simulation event, asset, font, query parameter, dependency, lockfile change, or audio cue.
- Keep the action plate at `{ x: 1, y: 1, w: 128, h: 22 }`; its exclusive right edge is `129`, leaving pixels `129` and `130` clear before the away-plan plate.
- Use exact secondary copy `N MORE · RIGHT-CLICK`; preserve the full primary action without ellipsis.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes. CSS must remain byte-for-byte unchanged.
- Keep captures and temporary browser state ignored. Do not pull, push, open a PR, deploy, or claim a live mounted-route update.

---

## File map

- Modify `src/mmo/render/renderer.ts`: immutable action-readout layout/palette, pure copy formatter, bounded two-line drawing.
- Modify `src/mmo/render/renderer.test.ts`: exact geometry, copy splitting, option cue, and contrast contracts.
- Modify `scripts/smoke.mjs`: real bridge-hover Canvas ownership, gap, width, and side-panel proof inside the existing Mudwick strip scenario.
- Modify `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`: exact closure evidence.
- Modify this plan: completed checkboxes and exact feature-tree/integrated-master evidence.

### Task 1: Establish the focused baseline

**Files:**
- Read: `src/mmo/render/renderer.ts`
- Read: `src/mmo/render/renderer.test.ts`
- Read: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: current `drawHoverText()`, `MmoRenderer.splitLabel()`, `AWAY_PLAN_UI`, and the existing strip browser scenario.
- Produces: fresh baseline evidence only; no file changes.

- [ ] **Step 1: Run focused renderer and simulation tests**

Run:

```powershell
npm test -- src/mmo/render/renderer.test.ts src/mmo/sim/sim.depth.test.ts
```

Expected before changes: both files pass with 40 tests; away-plan behavior remains green.

- [ ] **Step 2: Record current artifact and stylesheet evidence**

Run:

```powershell
npm run build
npm run size:check
Get-FileHash src/ui/style.css -Algorithm SHA256
```

Expected before changes: JavaScript is 756,895 raw / 203,637 gzip bytes, CSS is 41,737 raw / 10,091 gzip bytes, and the stylesheet SHA-256 is `E1E4706C5B04D8A5B4E3E754B25E1F2B03FBB5BDDBC7139FEE6C61090A3933B3`.

### Task 2: Lock copy, geometry, contrast, and collision in failing tests

**Files:**
- Modify: `src/mmo/render/renderer.test.ts`
- Modify: `scripts/smoke.mjs`
- Test: `src/mmo/render/renderer.test.ts`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes planned exports `HOVER_ACTION_UI` and `hoverActionFrame(label: string, extra: number)`.
- Produces failing pure contracts and a real-Canvas collision contract.

- [ ] **Step 1: Add the exact layout and copy contracts**

Append to `renderer.test.ts`:

```ts
describe('hover action readout', () => {
  it('pins the bounded plate and authored palette', () => {
    const ui = (rendererModule as typeof rendererModule & {
      HOVER_ACTION_UI?: {
        plate: { x: number; y: number; w: number; h: number };
        primary: { x: number; y: number; font: string };
        detail: { x: number; y: number; font: string };
        colors: Record<string, string>;
      };
    }).HOVER_ACTION_UI;

    expect(ui).toEqual({
      plate: { x: 1, y: 1, w: 128, h: 22 },
      primary: { x: 4, y: 3, font: '7px monospace' },
      detail: { x: 4, y: 13, font: 'bold 6px monospace' },
      colors: {
        plate: '#172012',
        border: '#6f7f54',
        verb: '#f0ead8',
        target: '#9be8e0',
        detail: '#d8c79d',
      },
    });
  });

  it('preserves the bridge action and separates the context-menu cue', () => {
    const frame = (rendererModule as typeof rendererModule & {
      hoverActionFrame?: (label: string, extra: number) => {
        verb: string;
        target: string | null;
        detail: string;
      };
    }).hoverActionFrame;

    expect(frame).toBeTypeOf('function');
    if (!frame) return;
    expect(frame('Cross bridge (10gp toll)', 2)).toEqual({
      verb: 'Cross',
      target: 'bridge (10gp toll)',
      detail: '2 MORE · RIGHT-CLICK',
    });
    expect(frame('Walk here', 2)).toEqual({
      verb: 'Walk here',
      target: null,
      detail: '2 MORE · RIGHT-CLICK',
    });
    expect(frame('Examine Fence', 1)).toEqual({
      verb: 'Examine',
      target: 'Fence',
      detail: '1 MORE · RIGHT-CLICK',
    });
  });
});
```

- [ ] **Step 2: Add contrast tests for all three text roles**

Inside the same describe block add:

```ts
it('keeps every small text role above 4.5:1 against the plate', () => {
  const ui = (rendererModule as typeof rendererModule & {
    HOVER_ACTION_UI?: { colors: Record<string, string> };
  }).HOVER_ACTION_UI;
  expect(ui).toBeDefined();
  if (!ui) return;

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

  expect(contrast(ui.colors.verb!, ui.colors.plate!)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(ui.colors.target!, ui.colors.plate!)).toBeGreaterThanOrEqual(4.5);
  expect(contrast(ui.colors.detail!, ui.colors.plate!)).toBeGreaterThanOrEqual(4.5);
});
```

- [ ] **Step 3: Run unit RED**

Run:

```powershell
npm test -- src/mmo/render/renderer.test.ts
```

Expected: three intended failures because `HOVER_ACTION_UI` and `hoverActionFrame` do not exist.

- [ ] **Step 4: Add the real bridge-hover collision contract**

In the existing `Mudwick away plan strip is labelled, stateful, and hit-aligned` scenario, after navigating to `{ skipTitle: 1, seed: 13 }` and resolving `mmo`, add this browser evaluation before the XP-drop assertion:

```js
const bridgeReadout = await page.evaluate(() => {
  const mmo = window.__game.host.mmo;
  const ctx = mmo.canvas.getContext('2d');
  if (!ctx) throw new Error('Mudwick canvas has no 2D context');
  mmo.sim.player.pos = { x: 21, y: 4 };
  mmo.renderer.mouse = null;
  mmo.renderer.render(1_000, 0);
  const beforeAway = ctx.getImageData(131, 1, 108, 22).data;
  const beforeGap = ctx.getImageData(129, 1, 2, 22).data;
  const panelBefore = [...ctx.getImageData(240, 12, 1, 1).data];
  const camX = mmo.renderer.camX;
  mmo.renderer.mouse = { x: 22 * 16 - camX + 8, y: 4 * 16 + 8 };
  mmo.renderer.render(1_000, 0);
  const afterAway = ctx.getImageData(131, 1, 108, 22).data;
  const afterGap = ctx.getImageData(129, 1, 2, 22).data;
  const changedPixels = (before, after) => {
    let changed = 0;
    for (let index = 0; index < before.length; index += 4) {
      if (before[index] !== after[index] || before[index + 1] !== after[index + 1]
        || before[index + 2] !== after[index + 2] || before[index + 3] !== after[index + 3]) changed++;
    }
    return changed;
  };
  ctx.font = '7px monospace';
  return {
    actionPlate: [...ctx.getImageData(3, 3, 1, 1).data],
    changedAwayPixels: changedPixels(beforeAway, afterAway),
    changedGapPixels: changedPixels(beforeGap, afterGap),
    panelBefore,
    panelAfter: [...ctx.getImageData(240, 12, 1, 1).data],
    bridgeLabelWidth: ctx.measureText('Cross bridge (10gp toll)').width,
  };
});
assert.deepEqual(bridgeReadout.actionPlate, [23, 32, 18, 255]);
assert.equal(bridgeReadout.changedAwayPixels, 0, 'bridge hover overwrote away plan');
assert.equal(bridgeReadout.changedGapPixels, 0, 'bridge hover consumed the plate gap');
assert.deepEqual(bridgeReadout.panelAfter, bridgeReadout.panelBefore);
assert.ok(bridgeReadout.bridgeLabelWidth <= 122, JSON.stringify(bridgeReadout));
```

- [ ] **Step 5: Run browser RED and preserve the failure**

Run:

```powershell
npm run build
npm run test:browser
```

Expected: the existing fourth scenario fails with the old action plate anchor and `changedAwayPixels === 30`; do not weaken the assertion.

- [ ] **Step 6: Commit the failing contracts**

Run `git diff --check`, then:

```powershell
git add src/mmo/render/renderer.test.ts scripts/smoke.mjs
git commit -m "test: expose hover readout collision"
```

### Task 3: Implement the bounded twin readout

**Files:**
- Modify: `src/mmo/render/renderer.ts`
- Test: `src/mmo/render/renderer.test.ts`

**Interfaces:**
- Produces `HOVER_ACTION_UI` and `hoverActionFrame(label: string, extra: number)`.
- Preserves `drawHoverText(): void` as the only hover-render entry point.

- [ ] **Step 1: Add immutable geometry, palette, and pure formatter**

After `AWAY_PLAN_UI`, add:

```ts
export const HOVER_ACTION_UI = {
  plate: { x: 1, y: 1, w: 128, h: 22 },
  primary: { x: 4, y: 3, font: '7px monospace' },
  detail: { x: 4, y: 13, font: 'bold 6px monospace' },
  colors: {
    plate: '#172012',
    border: '#6f7f54',
    verb: '#f0ead8',
    target: '#9be8e0',
    detail: '#d8c79d',
  },
} as const;

export interface HoverActionFrame {
  verb: string;
  target: string | null;
  detail: string;
}

export function hoverActionFrame(label: string, extra: number): HoverActionFrame {
  if (label === 'Walk here' || label === 'Cancel') {
    return { verb: label, target: null, detail: `${extra} MORE · RIGHT-CLICK` };
  }
  const splitAt = label.indexOf(' ');
  return {
    verb: splitAt < 0 ? label : label.slice(0, splitAt),
    target: splitAt < 0 ? null : label.slice(splitAt + 1),
    detail: `${extra} MORE · RIGHT-CLICK`,
  };
}
```

- [ ] **Step 2: Replace the unbounded inline draw path**

Delete `MmoRenderer.splitLabel()` and replace `drawHoverText()` with:

```ts
private drawHoverText(): void {
  if (this.menu || this.tradeOpen) return;
  const m = this.mouse;
  if (!m) return;
  const tile = this.tileAt(m.x, m.y);
  if (!tile) return;
  const opts = this.sim.optionsAt(tile.x, tile.y);
  const first = opts[0];
  if (!first) return;

  const frame = hoverActionFrame(first.label, opts.length - 1);
  const { plate, primary, detail, colors } = HOVER_ACTION_UI;
  const ctx = this.ctx;
  ctx.save();
  ctx.fillStyle = colors.plate;
  ctx.fillRect(plate.x, plate.y, plate.w, plate.h);
  ctx.strokeStyle = colors.border;
  ctx.strokeRect(plate.x + 0.5, plate.y + 0.5, plate.w - 1, plate.h - 1);
  ctx.textBaseline = 'top';
  ctx.font = primary.font;
  const verbText = frame.target ? `${frame.verb} ` : frame.verb;
  ctx.fillStyle = colors.verb;
  ctx.fillText(verbText, primary.x, primary.y);
  if (frame.target) {
    ctx.fillStyle = colors.target;
    ctx.fillText(frame.target, primary.x + ctx.measureText(verbText).width, primary.y);
  }
  ctx.font = detail.font;
  ctx.fillStyle = colors.detail;
  ctx.fillText(frame.detail, detail.x, detail.y);
  ctx.restore();
}
```

- [ ] **Step 3: Run focused GREEN and typecheck**

Run:

```powershell
npm test -- src/mmo/render/renderer.test.ts src/mmo/sim/sim.depth.test.ts
npm run typecheck
```

Expected: 43 focused tests pass; no stale `splitLabel` reference or TypeScript error remains.

- [ ] **Step 4: Build and enforce budgets**

Run:

```powershell
npm run build
npm run size:check
Get-FileHash src/ui/style.css -Algorithm SHA256
```

Expected: JavaScript remains within 204,800 gzip bytes; CSS remains 41,737 raw / 10,091 gzip bytes with the baseline SHA-256.

- [ ] **Step 5: Commit the renderer repair**

Run `git diff --check`, then:

```powershell
git add src/mmo/render/renderer.ts
git commit -m "polish: bound Mudwick action readout"
```

### Task 4: Prove production composition and adversarial states

**Files:**
- Modify if a verified gap requires it: `scripts/smoke.mjs`
- Test: `scripts/smoke.mjs`

**Interfaces:**
- Consumes the green immutable contract and pure formatter.
- Produces production-browser, visual, and adversarial proof.

- [ ] **Step 1: Run the strengthened browser scenario and full interaction E2E**

Run:

```powershell
npm run test:browser
```

Expected: 29 isolated scenarios and the full interaction E2E pass; the bridge action measures at most 122px, action plate is opaque, away plate and gap change by zero pixels, and the side panel remains identical.

- [ ] **Step 2: Capture representative production frames**

Capture under ignored `shots/`:

- `mudwick-action-readout-bridge.png`: native 320×240 bridge hover.
- `mudwick-action-readout-1280x720.png`: full CRT at 1280×720.
- `mudwick-action-readout-900x400.png`: full CRT at 900×400.
- `mudwick-action-readout-menu.png`: bridge context menu proving the hover plate yields ownership.

Reject if toll copy clips, the two plates visually fuse, the second line is weaker than the old suffix, the readout looks like a modern card, or either viewport makes the right-click cue unreadable.

- [ ] **Step 3: Red-team and verify findings**

Source- and browser-verify:

- bridge label, every shorter first action, `Walk here`, and one-more/two-more cues;
- no mouse, panel hover, and mouseleave cleanup;
- menu and trade suppression;
- XP-drop clearance and disconnect ownership;
- exclusive action-plate edge `129`, two gap columns, away plate start `131`, and panel start `240`;
- opaque fill anchors versus anti-aliased text/stroke pixels;
- CSS hash equality and JavaScript headroom.

Only reproduced or source-confirmed findings become fixes. If any fix follows, add a failing regression first and rerun every invalidated check.

- [ ] **Step 4: Commit any browser-guard hardening**

If Step 3 required no test edit, record a truthful null result and make no empty commit. Otherwise run `git diff --check`, then:

```powershell
git add scripts/smoke.mjs
git commit -m "test: harden Mudwick action readout"
```

### Task 5: Close truth surfaces, fully verify, and integrate

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-mudwick-action-readout-jewellers-pass.md`

**Interfaces:**
- Consumes all focused, browser, capture, and red-team evidence.
- Produces synchronized program truth and integrated-master proof.

- [ ] **Step 1: Run the complete feature-worktree gate**

Run:

```powershell
npm run verify
```

Expected: all unit files, standalone build, size gate, 29 isolated browser scenarios, full interaction E2E, and mounted build pass.

- [ ] **Step 2: Record exact closure evidence**

Append to both closure documents:

- focused and full unit counts;
- RED failure values and GREEN browser values;
- standalone JavaScript/CSS raw and gzip bytes;
- before/after stylesheet SHA-256;
- capture paths;
- red-team survivors and rejected candidates;
- residual risk or truthful null result.

- [ ] **Step 3: Commit closure truth**

Run `git diff --check`, then:

```powershell
git add docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md docs/superpowers/plans/2026-07-15-mudwick-action-readout-jewellers-pass.md
git commit -m "docs: close Mudwick action readout pass"
```

- [ ] **Step 4: Integrate and verify local master**

Fast-forward local `master`, run `npm run verify` again from the integrated tree, restore standalone `dist` with `npm run build` and `npm run size:check`, copy ignored proof into the main checkout, remove the owned worktree and merged branch, and confirm a clean repository. Do not pull, push, open a PR, or deploy.

- [ ] **Step 5: Record integrated-master evidence**

Mark every checkbox complete, append the integrated commit range and repeated gate results, run `git diff --check`, and commit:

```powershell
git add docs/superpowers/plans/2026-07-15-mudwick-action-readout-jewellers-pass.md
git commit -m "docs: record Mudwick action readout integration"
```

## Self-review

- Spec coverage: confirmed collision, three compared approaches, exact two-plate geometry, full primary copy, exact secondary copy, palette, contrast, modal suppression, layer ownership, no gameplay/CSS change, size limits, browser proof, captures, red-team, both verification tiers, and cleanup each have an explicit task.
- Placeholder scan: no deferred code, unspecified test, vague error handling, or unbounded follow-up remains.
- Type consistency: `HOVER_ACTION_UI`, `HoverActionFrame`, `hoverActionFrame(label, extra)`, geometry, palette keys, bridge label, and secondary copy are identical across unit, renderer, browser, and closure steps.
