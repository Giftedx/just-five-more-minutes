# Modem Outage Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Wednesday's landline interruption a readable, period-authentic Mudwick system modal while preserving all gameplay and timing contracts.

**Architecture:** Export a tiny pure frame model from the existing renderer module, consume it in a Canvas-only classic-system modal, and move the disconnected draw to the top of the world-viewport overlay stack. Guard temporal copy with Vitest and real pixels/state with the production Playwright smoke.

**Tech Stack:** TypeScript 7, Canvas 2D, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.4

## Global Constraints

- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, `PANEL_W = 80`, and `imageSmoothingEnabled = false`.
- Add no CSS, asset, dependency, font, DOM overlay, timer, event listener, shader, texture, or simulation state.
- Preserve Wednesday's `125→155` director timing and combat-safe disconnect semantics.
- Preserve the side panel, external objective HUD, Mum bark, danger toast, volume control, and PC/room mode ownership.
- Draw the disconnected modal above Canvas objective, standing-order, chat, XP, hover, and trade/menu layers within the world viewport.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes.
- Keep captures and temporary inspection scripts ignored; do not pull, push, or deploy.

---

## File responsibilities

- `src/mmo/render/renderer.ts` owns disconnect presentation state, drawing, and render order.
- `src/mmo/render/renderer.test.ts` owns deterministic retry cadence and copy contracts.
- `scripts/smoke.mjs` owns production-browser modal geometry, palette, state, and side-panel assertions.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` owns program-wide closure truth.
- `docs/superpowers/plans/2026-07-14-modem-outage-modal-pass.md` owns execution evidence.

### Task 1: Guard the disconnect presentation

**Files:**
- Create: `src/mmo/render/renderer.test.ts`
- Modify: `src/mmo/render/renderer.ts`
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: renderer time in milliseconds and the existing `MudwickSim.isLoggedOut` state.
- Produces: `disconnectFrame(now: number): { retryLabel: string; activeSegments: number }`, with one-to-three dots at 400ms cadence and one-to-six active segments at 200ms cadence.

- [x] **Step 1: Write the failing unit contract**

Create `src/mmo/render/renderer.test.ts` with exact checks that `disconnectFrame(0)`, `disconnectFrame(399)`, `disconnectFrame(400)`, `disconnectFrame(800)`, and `disconnectFrame(1200)` return the specified retry copy and that segment counts advance at 200ms before looping after six segments.

- [x] **Step 2: Run the focused test to verify RED**

Run `npm test -- src/mmo/render/renderer.test.ts`.

Expected: FAIL because `disconnectFrame` is not exported.

- [x] **Step 3: Add the failing production-browser contract**

Add an isolated scenario named `modem outage modal stays authored and bounded` to `scripts/smoke.mjs`. Enter PC mode, force `host.mmo.sim.setConnected(false)`, render a known frame, and inspect `host.mmo.canvas`. Assert the logged-out state; `320×240` canvas; navy title-bar, classic-shell, red failure-icon, and dim-world anchor pixels inside `x < 240`; an unchanged non-modal side-panel anchor at `x >= 240`; and no console/page errors.

- [x] **Step 4: Build and run the browser scenario to verify RED**

Run `npm run build` and `npm run test:browser`.

Expected: the new scenario fails because the current floating-text overlay has none of the modal palette/layout anchors.

### Task 2: Implement and visually tune the classic-system modal

**Files:**
- Modify: `src/mmo/render/renderer.ts`
- Modify if the real pixel anchors require correction: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `disconnectFrame(now)` and the existing Canvas 2D context.
- Produces: a modal wholly inside the `240×240` world viewport while the `80×240` side panel remains visible.

- [x] **Step 1: Implement the minimum pure frame model**

Return `retryLabel: 'Retrying' + '.'.repeat(1 + Math.floor(now / 400) % 3)` and `activeSegments: 1 + Math.floor(now / 200) % 6`. Do not add a timer or mutable state.

- [x] **Step 2: Draw the modal and correct render order**

Replace the floating text with an opaque classic-shell dialog over the existing dim fill. Use the palette and hierarchy in the design spec; draw a broken phone-line icon, distinct `Connection to server lost.` copy, retry label, six-segment meter, `PHONE LINE  BUSY`, and `Someone is on the phone.` Move `drawDisconnected(now)` after the normal Canvas HUD, chat, panel, and modal layers so those layers cannot cross the outage dialog; keep its fill limited to `VIEW_W`.

- [x] **Step 3: Run focused unit and browser checks to verify GREEN**

Run `npm test -- src/mmo/render/renderer.test.ts`, `npm run build`, and `npm run test:browser`.

Expected: the focused temporal tests pass; every isolated browser scenario and the full interaction E2E pass; the new anchors prove the modal and preserved side panel.

- [x] **Step 4: Capture three real production phases**

Capture 1440×900 PC-mode outage frames at renderer times representing one, three, and six active segments. Save them under ignored `shots/`. Compare text wrapping, one-pixel bevels, icon read, retry cadence, chat occlusion, side-panel continuity, outer toast, and Mum subtitle.

- [x] **Step 5: Perform the restraint edit**

Remove any line, border, or glyph that does not improve state recognition. Do not add CRT noise, glow, rounded web-card geometry, a fake actionable button, or another colour family. Rerun every focused check invalidated by the edit.

- [x] **Step 6: Verify artifact budgets and commit**

Run `npm run size:check` and `git diff --check`.

Expected: JavaScript is at or below 204,800 gzip bytes; CSS is unchanged at or below 10,112 gzip bytes; no whitespace errors.

Commit `src/mmo/render/renderer.ts`, `src/mmo/render/renderer.test.ts`, and `scripts/smoke.mjs` with `feat: finish modem outage presentation`.

### Task 3: Reconcile truth surfaces and complete integration

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Modify: `docs/superpowers/plans/2026-07-14-modem-outage-modal-pass.md`
- Create ignored proof: `shots/modem-outage-modal-*.png`

**Interfaces:**
- Consumes: final captures, browser/unit evidence, artifact sizes, and feature commit.
- Produces: current program truth, a verified feature tree, and a clean locally integrated master.

- [x] **Step 1: Record the confirmed closure**

Append a dated closure to the game-wide program describing the original floating-text/layering defect, the selected modal, retry cadence, preserved contracts, final artifact sizes, test counts, browser scenario count, and ignored proof paths.

- [x] **Step 2: Mark only completed checklist items**

Change each successful `- [ ]` in this plan to `- [x]`. Retain any failed or skipped item unchecked with an explanation.

- [x] **Step 3: Self-review the documents and diff**

Run `rg -n "[T]BD|[T]ODO|[F]IXME" docs/superpowers/specs/2026-07-14-modem-outage-modal-design.md docs/superpowers/plans/2026-07-14-modem-outage-modal-pass.md`, `git diff --check`, and `git status --short`.

Expected: no placeholders, whitespace defects, or staged proof artifacts.

- [x] **Step 4: Run the complete feature-tree gate**

Run `npm run verify`.

Expected: all unit tests, standalone build, artifact budgets, all isolated browser scenarios, full interaction E2E, and mounted build pass.

- [ ] **Step 5: Integrate locally and verify again**

Fast-forward the verified feature branch onto `master` and rerun `npm run verify`. Do not pull, push, or deploy.

- [ ] **Step 6: Clean up and reflect**

Remove only the task-owned worktree and merged feature branch. Append one valid JSON line with keys `date`, `task`, `outcome`, `surprise`, and `next-time` to `C:\Users\aggis\.Codex\memory\reflections.jsonl` using `apply_patch`, then parse every line to validate the JSONL file.
