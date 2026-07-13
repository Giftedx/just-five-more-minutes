# Pause Overlay Jeweller's Pass — Implementation Plan

> Execute in an isolated worktree. Keep the pause predicate and pointer-lock lifecycle unchanged.

**Goal:** Replace the prototype pause button with a visually resolved, accessible room-input hold panel that owns focus and remains bounded without regressing freeze behavior or the live volume control.

**Architecture:** `Game.syncPauseOverlay()` remains the sole lifecycle owner. It creates a stable semantic DOM subtree once, refreshes the state-dependent copy, and removes the subtree on resume. Existing CSS owns presentation; the existing Playwright smoke owns integration proof.

**Tech:** TypeScript, DOM APIs, CSS, Node assertions, Playwright, Vitest, Vite.

---

## Task 1: Lock the browser contract in red

**Files:**
- Modify: `scripts/smoke.mjs`

1. Extend `first pointer-lock rejection freezes time` to require a labelled non-modal dialog, visible hierarchy, and action focus.
2. Assert the first-capture copy exactly.
3. Assert the volume control remains visible and non-inert.
4. Assert panel bounds at 1000×700 and 900×400.
5. Exercise the existing returning-pause branch by setting `hadPointerLock` and dispatching the real `pointerlockchange` listener; assert returning copy.
6. Build and run the focused browser suite. Confirm failure is caused by the missing panel contract.

## Task 2: Author the semantic overlay

**Files:**
- Modify: `src/game.ts`

1. Create the dialog, panel, eyebrow, headline, explanation, and recovery action only when the visible pause first appears.
2. Wire `aria-labelledby` to the visible headline without declaring `aria-modal`.
3. Keep the existing pointer-lock request behavior.
4. Focus the recovery action with `preventScroll` after insertion.
5. Refresh first-capture versus returning-pause text from `hadPointerLock`.
6. Build and run the browser suite until the semantic and focus assertions pass.

## Task 3: Give the interruption stage authority

**Files:**
- Modify: `src/ui/style.css`

1. Replace the translucent button-only treatment with a near-opaque stage and bounded panel.
2. Establish eyebrow, display headline, readable explanation, full-width action, and restrained pause-mark detail.
3. Preserve pointer transparency outside the action and the existing focus-visible affordance.
4. Add short-landscape adjustments only if the browser geometry proves they are needed.
5. Build, run `npm run size:check`, and keep CSS below the enforced budget.

## Task 4: Visual and adversarial review

**Files:**
- Modify as findings require: `src/game.ts`, `src/ui/style.css`, `scripts/smoke.mjs`
- Create ignored evidence: `shots/pause-overlay-jewellers.png`

1. Inspect first-lock rejection at 1440×900 and 900×400 in a real browser.
2. Check hierarchy, wrap, focus, double exposure, hit targets, volume availability, and return-pause wording.
3. Red-team focus ownership, pointer transparency, hidden-tab behavior, PC mode, disposal, and CSS budget.
4. Independently verify each finding before changing code.

## Task 5: Close the repository gates

1. Run `npm test`.
2. Run `npm run build`.
3. Run `npm run size:check`.
4. Run `npm run test:browser`.
5. Run `npm run build:hub`.
6. Run `npm run verify` as the strongest repository closeout gate.
7. Confirm the worktree contains only the intended source, smoke, and documentation changes.
8. Commit, merge into local `master`, rerun the relevant verification from `master`, and remove the worktree.

