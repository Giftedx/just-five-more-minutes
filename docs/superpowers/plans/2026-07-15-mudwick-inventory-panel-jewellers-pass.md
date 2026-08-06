# Mudwick Inventory Panel Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Mudwick's real 28-slot inventory a labelled capacity band, distinct empty and occupied wells, and a bounded two-digit count badge without changing inventory behavior.

**Architecture:** Export one immutable renderer-owned `INVENTORY_UI` geometry/palette contract and one pure `inventoryFrame(count)` formatter. `drawPanel()` consumes both while the existing ordered inventory array, glyph renderer, simulation, persistence, input, skills, and panel bands remain unchanged. Unit tests pin copy, geometry, and contrast; the existing Mudwick browser scenario pins actual empty, occupied, badge, world-boundary, and skills-band pixels.

**Tech Stack:** TypeScript 7, Canvas 2D, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.4

## Global Constraints

- Preserve `INVENTORY_SIZE = 28` as the sole capacity authority.
- Preserve the ordered `player.inventory` array and every acquisition, sale, eating, death-drop, gravestone, and away-plan path.
- Preserve the 4-column by 7-row grid, `pitch = 13`, `cell = 11`, and its current x/y position.
- Preserve all item glyph geometry and item-kind copy.
- Preserve minimap, coin, HP, skills, quest, world, chat, action plate, and away-plan geometry.
- Do not touch the renderer comment that the current skill spacing is approved.
- Add no input, hover state, timer, animation, sound, persistence, external asset, package, CSS selector, or CSS byte.
- Use exact header copy `PACK n/28` and no tooltip or explanatory prose.
- Normal, full, and count text must remain at or above 4.5:1 contrast against their authored backgrounds.
- Browser proof must use the integrated production route and restore mutated QA inventory state before returning.
- Use an isolated worktree for production and test edits; preserve unrelated user changes.

---

## File responsibilities

- `src/mmo/render/renderer.ts` owns inventory geometry, palette, pure presentation state, and Canvas paint order.
- `src/mmo/render/renderer.test.ts` owns exact geometry, copy, state, and contrast contracts.
- `scripts/smoke.mjs` owns real-browser pixel ownership and containment proof inside the existing Mudwick panel scenario.
- `docs/superpowers/specs/2026-07-15-mudwick-inventory-panel-jewellers-design.md` remains the approved design authority.
- `docs/superpowers/plans/2026-07-15-mudwick-inventory-panel-jewellers-pass.md` is this execution record.

### Task 1: Establish the red inventory contracts

**Files:**
- Modify: `src/mmo/render/renderer.test.ts`
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes planned exports `INVENTORY_UI` and `inventoryFrame(count: number)`.
- Produces exact unit and production-browser failures against the old anonymous grid.

- [ ] **Step 1: Add exact unit contracts**

Append to `src/mmo/render/renderer.test.ts`:

```ts
describe('inventory panel finish', () => {
  it('pins the pack band, grid, count badge, and authored palette', () => {
    const ui = (rendererModule as typeof rendererModule & {
      INVENTORY_UI?: {
        capacity: number;
        divider: { x: number; y: number; w: number; h: number };
        headerBacking: { x: number; y: number; w: number; h: number };
        header: { centerX: number; y: number; font: string };
        grid: { x: number; y: number; columns: number; rows: number; pitch: number; cell: number };
        badge: { w: number; h: number; font: string };
        colors: Record<string, string>;
      };
    }).INVENTORY_UI;

    expect(ui).toEqual({
      capacity: 28,
      divider: { x: 248, y: 82, w: 64, h: 1 },
      headerBacking: { x: 253, y: 79, w: 54, h: 7 },
      header: { centerX: 280, y: 79, font: 'bold 6px monospace' },
      grid: { x: 255, y: 86, columns: 4, rows: 7, pitch: 13, cell: 11 },
      badge: { w: 8, h: 6, font: 'bold 5px monospace' },
      colors: {
        panel: '#c8b088',
        divider: '#8a754f',
        header: '#4a3a26',
        fullHeader: '#7a2020',
        emptyBg: '#b09a74',
        emptyBorder: '#8a754f',
        occupiedBg: '#98815d',
        occupiedBorder: '#5c4a32',
        sheen: 'rgba(255,255,255,0.18)',
        badgeBg: '#3a2c18',
        badgeText: '#ffe96b',
      },
    });
  });

  it('formats capacity truthfully at empty, partial, and full states', () => {
    const frame = (rendererModule as typeof rendererModule & {
      inventoryFrame?: (count: number) => { label: string; full: boolean };
    }).inventoryFrame;

    expect(frame).toBeTypeOf('function');
    if (!frame) return;
    expect(frame(0)).toEqual({ label: 'PACK 0/28', full: false });
    expect(frame(14)).toEqual({ label: 'PACK 14/28', full: false });
    expect(frame(28)).toEqual({ label: 'PACK 28/28', full: true });
  });

  it('keeps inventory text roles above 4.5:1', () => {
    const ui = (rendererModule as typeof rendererModule & {
      INVENTORY_UI?: { colors: Record<string, string> };
    }).INVENTORY_UI;
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

    expect(contrast(ui.colors.header!, ui.colors.panel!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ui.colors.fullHeader!, ui.colors.panel!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ui.colors.badgeText!, ui.colors.badgeBg!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ui.colors.occupiedBg!, '#3a3630')).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npm test -- src/mmo/render/renderer.test.ts
```

Expected: three new failures because `INVENTORY_UI` and `inventoryFrame` do not exist. Existing tests continue to pass.

- [ ] **Step 3: Extend the existing Mudwick browser scenario**

Inside `Mudwick away plan strip is labelled, stateful, and hit-aligned`, after the integrated route has exposed `window.__game.host.mmo`, add:

```js
const inventoryFinish = await page.evaluate(() => {
  const mmo = window.__game.host.mmo;
  const ctx = mmo.canvas.getContext('2d');
  if (!ctx) throw new Error('Mudwick canvas has no 2D context');
  const originalInventory = [...mmo.sim.player.inventory];
  const changedPixels = (before, after) => {
    let changed = 0;
    for (let index = 0; index < before.length; index += 4) {
      if (
        before[index] !== after[index]
        || before[index + 1] !== after[index + 1]
        || before[index + 2] !== after[index + 2]
        || before[index + 3] !== after[index + 3]
      ) changed++;
    }
    return changed;
  };

  mmo.renderer.mouse = null;
  mmo.sim.player.inventory = [];
  mmo.renderer.render(1_000, 0);
  const emptySlot = [...ctx.getImageData(264, 94, 1, 1).data];
  const worldBefore = ctx.getImageData(0, 0, 240, 240).data;
  const skillsBefore = ctx.getImageData(240, 178, 80, 62).data;

  mmo.sim.player.inventory = ['log'];
  mmo.renderer.render(1_000, 0);
  const occupiedSlot = [...ctx.getImageData(264, 94, 1, 1).data];
  const nextEmptySlot = [...ctx.getImageData(276, 94, 1, 1).data];

  mmo.sim.player.inventory = Array.from({ length: 28 }, () => 'log');
  mmo.renderer.render(1_000, 0);
  const badgeCorner = [...ctx.getImageData(258, 91, 1, 1).data];
  const worldAfter = ctx.getImageData(0, 0, 240, 240).data;
  const skillsAfter = ctx.getImageData(240, 178, 80, 62).data;
  ctx.font = 'bold 6px monospace';
  const headerWidth = ctx.measureText('PACK 28/28').width;
  ctx.font = 'bold 5px monospace';
  const countWidth = ctx.measureText('28').width;
  mmo.sim.player.inventory = originalInventory;
  mmo.renderer.render(1_000, 0);

  return {
    emptySlot,
    occupiedSlot,
    nextEmptySlot,
    badgeCorner,
    changedWorldPixels: changedPixels(worldBefore, worldAfter),
    changedSkillsPixels: changedPixels(skillsBefore, skillsAfter),
    headerWidth,
    countWidth,
  };
});
assert.deepEqual(inventoryFinish.emptySlot, [176, 154, 116, 255]);
assert.deepEqual(inventoryFinish.occupiedSlot, [152, 129, 93, 255]);
assert.deepEqual(inventoryFinish.nextEmptySlot, [176, 154, 116, 255]);
assert.deepEqual(inventoryFinish.badgeCorner, [58, 44, 24, 255]);
assert.equal(inventoryFinish.changedWorldPixels, 0, 'inventory finish entered the world viewport');
assert.equal(inventoryFinish.changedSkillsPixels, 0, 'inventory finish entered the skills band');
assert.ok(inventoryFinish.headerWidth <= 54, JSON.stringify(inventoryFinish));
assert.ok(inventoryFinish.countWidth <= 8, JSON.stringify(inventoryFinish));
```

- [ ] **Step 4: Build and run browser checks to verify rendered RED**

Run:

```powershell
npm run build
npm run test:browser
```

Expected: build succeeds; the existing Mudwick panel scenario fails because an occupied slot still paints `[176, 154, 116, 255]` instead of `[152, 129, 93, 255]`, and the old count path does not paint the dark badge corner.

- [ ] **Step 5: Commit the red contracts**

```powershell
git add src/mmo/render/renderer.test.ts scripts/smoke.mjs
git commit -m "test: expose Mudwick inventory finish gaps"
```

### Task 2: Implement the pack band and bounded wells

**Files:**
- Modify: `src/mmo/render/renderer.ts`

**Interfaces:**
- Produces `INVENTORY_UI` and `inventoryFrame(count: number): InventoryFrame`.
- Preserves `drawPanel(): void` as the only inventory render entry point.

- [ ] **Step 1: Import the capacity authority**

Add `INVENTORY_SIZE` to the existing `../sim/sim` import:

```ts
import {
  BREAD_PRICE,
  INVENTORY_SIZE,
  ITEM_PRICES,
  levelOf,
  MudwickSim,
  MAX_LEVEL,
  PLAYER_MAX_HP,
  xpForLevel,
} from '../sim/sim';
```

- [ ] **Step 2: Add immutable geometry, palette, and pure state**

After `HOVER_ACTION_UI`, add:

```ts
export const INVENTORY_UI = {
  capacity: INVENTORY_SIZE,
  divider: { x: 248, y: 82, w: 64, h: 1 },
  headerBacking: { x: 253, y: 79, w: 54, h: 7 },
  header: { centerX: 280, y: 79, font: 'bold 6px monospace' },
  grid: { x: 255, y: 86, columns: 4, rows: 7, pitch: 13, cell: 11 },
  badge: { w: 8, h: 6, font: 'bold 5px monospace' },
  colors: {
    panel: '#c8b088',
    divider: '#8a754f',
    header: '#4a3a26',
    fullHeader: '#7a2020',
    emptyBg: '#b09a74',
    emptyBorder: '#8a754f',
    occupiedBg: '#98815d',
    occupiedBorder: '#5c4a32',
    sheen: 'rgba(255,255,255,0.18)',
    badgeBg: '#3a2c18',
    badgeText: '#ffe96b',
  },
} as const;

export interface InventoryFrame {
  label: string;
  full: boolean;
}

export function inventoryFrame(count: number): InventoryFrame {
  return {
    label: `PACK ${count}/${INVENTORY_SIZE}`,
    full: count >= INVENTORY_SIZE,
  };
}
```

- [ ] **Step 3: Remove duplicated local inventory geometry**

Delete `invY` and `slot` from the local `PL` object. Delete `invCols`, `invGridW`, and `invX`. Keep every other panel constant unchanged.

Replace the two-divider block with the unchanged upper divider only:

```ts
ctx.fillStyle = '#8a754f';
ctx.fillRect(x0 + 8, 44, PANEL_W - 16, 1);
```

- [ ] **Step 4: Paint the functional pack band**

Immediately after the HP loop, add:

```ts
const inv = this.sim.player.inventory;
const frame = inventoryFrame(inv.length);
const { divider, headerBacking, header, grid, badge, colors } = INVENTORY_UI;
ctx.fillStyle = colors.divider;
ctx.fillRect(divider.x, divider.y, divider.w, divider.h);
ctx.fillStyle = colors.panel;
ctx.fillRect(headerBacking.x, headerBacking.y, headerBacking.w, headerBacking.h);
ctx.font = header.font;
ctx.textBaseline = 'top';
ctx.textAlign = 'center';
ctx.fillStyle = frame.full ? colors.fullHeader : colors.header;
ctx.fillText(frame.label, header.centerX, header.y);
ctx.textAlign = 'left';
```

- [ ] **Step 5: Replace the anonymous grid paint loop**

Replace the existing inventory geometry and 28-slot loop with:

```ts
for (let i = 0; i < grid.columns * grid.rows; i++) {
  const sx = grid.x + (i % grid.columns) * grid.pitch;
  const sy = grid.y + Math.floor(i / grid.columns) * grid.pitch;
  const item = inv[i];
  const occupied = item !== undefined;
  ctx.fillStyle = occupied ? colors.occupiedBg : colors.emptyBg;
  ctx.fillRect(sx, sy, grid.cell, grid.cell);
  ctx.strokeStyle = occupied ? colors.occupiedBorder : colors.emptyBorder;
  ctx.strokeRect(sx + 0.5, sy + 0.5, grid.cell - 1, grid.cell - 1);
  ctx.fillStyle = colors.sheen;
  ctx.fillRect(sx + 1, sy + 1, grid.cell - 2, 1);
  if (item !== undefined) this.drawItemGlyph(item, sx, sy);
}
```

- [ ] **Step 6: Replace loose counts with bounded badges**

Replace the existing repeated-item count loop with:

```ts
const counted = new Set<ItemKind>();
for (let i = 0; i < inv.length; i++) {
  const kind = inv[i];
  if (kind === undefined || counted.has(kind)) continue;
  counted.add(kind);
  const count = inv.filter((item) => item === kind).length;
  if (count <= 1) continue;
  const sx = grid.x + (i % grid.columns) * grid.pitch;
  const sy = grid.y + Math.floor(i / grid.columns) * grid.pitch;
  const bx = sx + grid.cell - badge.w;
  const by = sy + grid.cell - badge.h;
  ctx.fillStyle = colors.badgeBg;
  ctx.fillRect(bx, by, badge.w, badge.h);
  ctx.save();
  ctx.font = badge.font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  ctx.fillStyle = colors.badgeText;
  ctx.fillText(String(count), bx + badge.w - 1, by + 1);
  ctx.restore();
}
```

- [ ] **Step 7: Run focused GREEN and typecheck**

Run:

```powershell
npm test -- src/mmo/render/renderer.test.ts src/mmo/sim/sim.depth.test.ts
npm run typecheck
```

Expected: 46 focused tests pass and TypeScript reports no stale `PL.invY`, `PL.slot`, `invX`, `gx`, `gy`, or `slot` references.

- [ ] **Step 8: Run the rendered browser contract**

Run:

```powershell
npm run build
npm run test:browser
```

Expected: all 29 isolated browser scenarios and the full interaction E2E pass. The Mudwick panel scenario reports the exact empty, occupied, and badge pixels with zero changed world or skills pixels.

- [ ] **Step 9: Commit production implementation**

```powershell
git add src/mmo/render/renderer.ts
git commit -m "polish: finish Mudwick inventory panel"
```

### Task 3: Visual calibration, adversarial review, and integration

**Files:**
- Modify only if rendered evidence exposes a directly related defect: `src/mmo/render/renderer.ts`
- Modify only if a corrected invariant needs pinning: `src/mmo/render/renderer.test.ts`, `scripts/smoke.mjs`
- Preserve: `src/ui/style.css`

**Interfaces:**
- Consumes the verified `INVENTORY_UI`, `inventoryFrame`, and production build.
- Produces ignored fresh/mixed/full visual proof, release evidence, a locally integrated `master`, cleanup, and reflection.

- [ ] **Step 1: Capture three inventory states at integer scale**

Use an owned production preview and Playwright to capture:

```text
shots/mudwick-inventory-empty.png
shots/mudwick-inventory-mixed.png
shots/mudwick-inventory-full.png
```

Use the integrated route, set only the QA browser's in-memory inventory to `[]`, `['log', 'flax', 'flax', 'bread']`, and 28 logs, render at the same clock, copy the hidden 320-by-240 canvas into a temporary visible 960-by-720 QA canvas, and screenshot it. Restore the original browser inventory before closing.

- [ ] **Step 2: Apply the visual rejection checklist**

Reject the candidate if `PACK n/28` touches the hearts or first row, the divider breaks behind the label, occupied slots swallow any item glyph, empty slots compete with items, the badge resembles an item, a two-digit count leaves its slot, the full state depends on colour alone, the grid enters the skills band, or the panel becomes noisier than the world.

- [ ] **Step 3: Calibrate only observed defects**

If and only if a rejection condition is visible, change only the exact geometry or palette value responsible, update its existing unit/browser expectation, rerun the focused unit tests, rebuild, and recapture all three states. Add no effect, interaction, or adjacent panel redesign.

- [ ] **Step 4: Red-team the completed diff**

Check adversarial input (0, 1, 2, 9, 10, and 28 items), hidden assumptions (all seven item kinds and repeated-kind ordering), sibling ownership (HP above, skills below, world left, panel edge right), state leakage (`textAlign`, `textBaseline`, font, alpha), false-pass pixels, source-of-truth capacity, CSS hash, dependency diff, and unchanged simulation/input/persistence paths. Independently verify every candidate finding before editing.

- [ ] **Step 5: Run the complete release gate**

Run:

```powershell
npm run verify
```

Expected: 19 test files / 232 tests, standalone build, JS and CSS size ceilings, 29 isolated browser scenarios, full interaction E2E, and the mounted `/just-five-more-minutes/` build all pass.

- [ ] **Step 6: Prove CSS remained unchanged**

Record the standalone CSS SHA-256 and compare it with the pre-pass hash:

```text
CD87A492DCDBF50B6DEC7975FFE5EEEBD56985CB4BF81CE73C0C7DB9D9016F6B
```

Expected: exact match and 41,737 raw / 10,091 gzip bytes.

- [ ] **Step 7: Fast-forward the verified branch locally**

From the main checkout, confirm both trees are clean, run:

```powershell
git merge --ff-only codex/mudwick-inventory-panel
```

Then rerun `npm test`, `npm run build`, and `npm run size:check` on merged `master`. Do not pull, push, or deploy.

- [ ] **Step 8: Clean only task-owned resources**

Close the owned browser session, stop only the owned preview process tree, preserve the ignored proof under `shots/`, remove the `.worktrees/mudwick-inventory-panel` worktree, prune stale registrations, and delete the merged feature branch. Confirm `git status --short --branch` is clean apart from the expected ahead count.

- [ ] **Step 9: Append and validate the reflection**

Append one JSON object to `.Codex\memory\reflections.jsonl` using `apply_patch`, with exact keys `date`, `task`, `outcome`, `surprise`, and `next-time`. Parse every line with PowerShell `ConvertFrom-Json` and report the validated line count.

- [ ] **Step 10: Commit evidence-driven calibration or closure docs only when needed**

If visual calibration changed tracked code, commit it with:

```powershell
git add src/mmo/render/renderer.ts src/mmo/render/renderer.test.ts scripts/smoke.mjs
git commit -m "fix: calibrate Mudwick inventory finish"
```

If no tracked calibration or closure documentation is required, do not create an empty commit.
