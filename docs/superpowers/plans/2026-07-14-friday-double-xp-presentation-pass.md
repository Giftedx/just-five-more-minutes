# Friday Double XP Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Friday's active Double XP rule persistent and legible inside Mudwick while making every XP drop report the amount the simulation actually grants.

**Architecture:** Expose the simulation's existing Boolean modifier through a read-only `1 | 2` multiplier, consume it through one pure XP-label formatter, and reserve a single Canvas chat line for a period-authentic event strip. Guard the arithmetic seam and copy with Vitest, then guard Monday/Friday presence, geometry, and preserved HUD regions in the production browser smoke.

**Tech Stack:** TypeScript 7, Canvas 2D, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.4

## Global Constraints

- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, `PANEL_W = 80`, and `imageSmoothingEnabled = false`.
- Add no CSS, asset, dependency, font, DOM overlay, timer, event listener, shader, texture, or persisted state.
- Preserve all XP values and progression semantics; expose and present the existing multiplier only.
- Preserve transient chat capacity, fade timing, objective text, standing-order chips, side panel, disconnect ownership, and PC/room transitions.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes.
- Keep captures and temporary inspection scripts ignored; do not pull, push, or deploy.

---

## File responsibilities

- `src/mmo/sim/sim.ts` owns the authoritative read-only XP multiplier.
- `src/mmo/sim/sim.depth.test.ts` owns the multiplier/arithmetic contract.
- `src/mmo/render/renderer.ts` owns XP-drop copy, the event strip, its palette, and chat placement.
- `src/mmo/render/renderer.test.ts` owns deterministic copy and contrast contracts.
- `scripts/smoke.mjs` owns production-browser Monday/Friday pixel and state assertions.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` owns program-wide closure truth.
- `docs/superpowers/plans/2026-07-14-friday-double-xp-presentation-pass.md` owns execution evidence.

### Task 1: Guard the authoritative multiplier and reward copy

**Files:**
- Modify: `src/mmo/sim/sim.depth.test.ts`
- Modify: `src/mmo/render/renderer.test.ts`
- Modify: `src/mmo/sim/sim.ts`
- Modify: `src/mmo/render/renderer.ts`

**Interfaces:**
- Consumes: the existing `MudwickSim` constructor option `doubleXp?: boolean` and base skill XP amount.
- Produces: `MudwickSim.xpMultiplier: 1 | 2` and `xpDropLabel(baseAmount: number, skill: SkillName, multiplier: 1 | 2): string`.

- [ ] **Step 1: Write the failing simulation seam contract**

Extend the existing Double XP test in `src/mmo/sim/sim.depth.test.ts` with:

```ts
expect(normal.xpMultiplier).toBe(1);
expect(double.xpMultiplier).toBe(2);
```

- [ ] **Step 2: Write the failing renderer-copy contract**

Import `xpDropLabel` from `./renderer` and assert:

```ts
expect(xpDropLabel(10, 'fishing', 1)).toBe('+10 Fishing');
expect(xpDropLabel(10, 'fishing', 2)).toBe('+20 Fishing · 2×');
expect(xpDropLabel(25, 'woodcutting', 2)).toBe('+50 Woodcutting · 2×');
```

- [ ] **Step 3: Run focused tests to verify RED**

Run `npm test -- src/mmo/sim/sim.depth.test.ts src/mmo/render/renderer.test.ts`.

Expected: FAIL because `xpMultiplier` and `xpDropLabel` do not exist.

- [ ] **Step 4: Implement the minimum read-only seam**

Add to `MudwickSim` without changing `grantSkillXp`:

```ts
get xpMultiplier(): 1 | 2 {
  return this.doubleXp ? 2 : 1;
}
```

- [ ] **Step 5: Implement and adopt the pure formatter**

Add to `renderer.ts`:

```ts
export function xpDropLabel(baseAmount: number, skill: SkillName, multiplier: 1 | 2): string {
  const suffix = multiplier === 2 ? ' · 2×' : '';
  return `+${baseAmount * multiplier} ${skillLabel(skill)}${suffix}`;
}
```

Route every Attack, Fishing, Foraging, and Woodcutting XP-drop creation through the helper with `this.sim.xpMultiplier`; do not change simulation awards or event shapes.

- [ ] **Step 6: Run focused tests to verify GREEN**

Run `npm test -- src/mmo/sim/sim.depth.test.ts src/mmo/render/renderer.test.ts`.

Expected: both files pass, including existing progression and modem presentation contracts.

### Task 2: Build and prove the Friday event strip

**Files:**
- Modify: `src/mmo/render/renderer.ts`
- Modify: `src/mmo/render/renderer.test.ts`
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `this.sim.xpMultiplier`, the existing Canvas context, transient chat array, and objective baseline.
- Produces: `DOUBLE_XP_COLORS`, `drawDoubleXpBanner()`, a 12-pixel Friday chat offset, and production-browser Monday/Friday assertions.

- [ ] **Step 1: Add the failing palette and contrast contract**

Export:

```ts
export const DOUBLE_XP_COLORS = {
  backdrop: '#161008',
  gold: '#f2c94c',
  parchment: '#fff0a8',
  ember: '#c76b2a',
  moss: '#6e8f45',
} as const;
```

Before implementing the export, add tests that require the object and prove `parchment` against `backdrop` and `gold` against `backdrop` both meet a 4.5:1 contrast floor.

- [ ] **Step 2: Add the failing production-browser contract**

Add an isolated `Friday double XP presentation is persistent and truthful` scenario to `scripts/smoke.mjs`. At a fixed render time, create Monday and Friday games, enter PC mode, and inspect `host.mmo.canvas`. Assert Monday reports `xpMultiplier === 1` and has no event-strip anchor; Friday reports `xpMultiplier === 2`, has the lamp-black, old-gold, parchment, and ember anchors within `x < 240` and `y = 216..227`, preserves the objective bar below `y = 229`, preserves a side-panel pixel at `x >= 240`, and produces no console/page errors.

- [ ] **Step 3: Build and run browser checks to verify RED**

Run `npm run build` and `npm run test:browser`.

Expected: the new scenario fails because Friday has no event-strip pixels.

- [ ] **Step 4: Draw the event strip and reserve its chat line**

When `this.sim.xpMultiplier === 2`, draw an opaque `240×11` strip at `y = 216`, a hard-edged `2×` medallion, `DOUBLE XP`, a one-pixel divider, and `FRIDAY EVENT` using the approved palette. Change the transient chat base from `CANVAS_H - 24` to `CANVAS_H - 36` only while the strip is active. Draw the strip after transient chat and before XP drops; leave `drawDisconnected(now)` last so the outage still owns the viewport.

- [ ] **Step 5: Run focused unit and browser checks to verify GREEN**

Run `npm test -- src/mmo/sim/sim.depth.test.ts src/mmo/render/renderer.test.ts`, `npm run build`, and `npm run test:browser`.

Expected: focused tests pass; every isolated browser scenario and the full interaction E2E pass; the Friday scenario proves the strip and preserved regions.

- [ ] **Step 6: Capture and critique real production frames**

Capture 1440×900 Friday PC-mode frames while idle and with a visible XP drop under ignored `shots/`. Compare chat clearance, objective separation, medallion legibility, reward truthfulness, side-panel continuity, and visual weight against the captured Thursday inspection.

- [ ] **Step 7: Perform the restraint edit**

Remove any stroke, glyph, colour, or word that does not improve rule recognition. Do not add animation, glow, rounded cards, a countdown, a second banner, or marketing copy. Rerun every focused check invalidated by the edit.

- [ ] **Step 8: Verify artifact budgets and commit**

Run `npm run size:check` and `git diff --check`.

Expected: JavaScript is at or below 204,800 gzip bytes; CSS is unchanged at or below 10,112 gzip bytes; no whitespace errors.

Commit `src/mmo/sim/sim.ts`, `src/mmo/sim/sim.depth.test.ts`, `src/mmo/render/renderer.ts`, `src/mmo/render/renderer.test.ts`, and `scripts/smoke.mjs` with `feat: finish Friday double XP presentation`.

### Task 3: Reconcile truth surfaces and complete integration

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Modify: `docs/superpowers/plans/2026-07-14-friday-double-xp-presentation-pass.md`
- Create ignored proof: `shots/friday-double-xp-*.png`

**Interfaces:**
- Consumes: final captures, unit/browser evidence, artifact sizes, and the feature commit.
- Produces: current program truth, a verified feature tree, and a clean locally integrated master.

- [ ] **Step 1: Record the confirmed closure**

Append a dated closure to the game-wide program describing the absent Friday presentation, inaccurate base-value drops, selected event strip, chat reservation, multiplier seam, preserved contracts, final artifact sizes, test counts, browser scenario count, and ignored proof paths.

- [ ] **Step 2: Mark only completed checklist items**

Change each successful `- [ ]` in this plan to `- [x]`. Retain any failed or skipped item unchecked with an explanation.

- [ ] **Step 3: Self-review the documents and diff**

Run `rg -n "[T]BD|[T]ODO|[F]IXME" docs/superpowers/specs/2026-07-14-friday-double-xp-presentation-design.md docs/superpowers/plans/2026-07-14-friday-double-xp-presentation-pass.md`, `git diff --check`, and `git status --short`.

Expected: no placeholders, whitespace defects, or staged proof artifacts.

- [ ] **Step 4: Run the complete feature-tree gate**

Run `npm run verify`.

Expected: all unit tests, standalone build, artifact budgets, every isolated browser scenario, full interaction E2E, and mounted build pass.

- [ ] **Step 5: Integrate locally and verify again**

Fast-forward the verified feature branch onto `master` and rerun `npm run verify`. Do not pull, push, or deploy.

- [ ] **Step 6: Clean up and reflect**

Remove only the task-owned worktree and merged feature branch. Append one valid JSON line with keys `date`, `task`, `outcome`, `surprise`, and `next-time` to `C:\Users\aggis\.Codex\memory\reflections.jsonl` using `apply_patch`, then parse every line to validate the JSONL file.
