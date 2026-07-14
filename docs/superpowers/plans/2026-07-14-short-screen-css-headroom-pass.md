# Short-Screen CSS Headroom Pass Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task.

**Goal:** Repair the dead 900×400 prompt compaction rules and replace the four-byte CSS release margin with a deterministic 128-byte minimum headroom contract, without changing unrelated visuals.

**Architecture:** Pin the intended responsive behavior in the existing Playwright production smoke and make the current artifact fail a tighter gzip gate before touching CSS. Then consolidate equivalent media fragments after their component bases, remove only declarations already guaranteed by the universal reset or stronger reduced-motion rule, and prove the visual blast radius with matched production screenshots.

**Tech Stack:** CSS, JavaScript, Node.js gzip sizing, Vite, Playwright, Vitest

**Design:** `docs/superpowers/specs/2026-07-14-short-screen-css-headroom-design.md`

---

## Global constraints

- Work in an isolated `codex/short-screen-css-headroom` worktree based on the current local `master`.
- Preserve all authored effects, copy, controls, accessibility semantics, gameplay, and dependencies.
- Do not raise any artifact budget. The final CSS gzip ceiling is exactly 10,112 bytes.
- Do not alter computed presentation above 520 CSS pixels in viewport height.
- Do not commit a deliberately failing RED state.
- After every CSS edit, rerun the checks whose evidence the edit invalidates.
- No push or deploy. Finish with a local fast-forward merge only after feature and merged-tree verification pass.

### Task 1: Establish the failing release contracts

**Files:**

- Modify: `scripts/check-dist-size.mjs:9`
- Modify: `scripts/smoke.mjs:540-604`

**Step 1: Tighten the deterministic CSS ceiling**

Change only the CSS entry in `scripts/check-dist-size.mjs`:

```js
const budgets = {
  JavaScript: { extension: '.js', gzip: 200 * 1024 },
  CSS: { extension: '.css', gzip: 10_112 },
};
```

**Step 2: Prove the size contract is RED**

Run:

```powershell
npm run build
npm run size:check
```

Expected: the build passes, then size checking fails with the current CSS near 10,236 bytes and reports `CSS gzip budget exceeded by 124 bytes`. Record the actual byte count; do not weaken the ceiling if platform compression differs.

**Step 3: Pin the short-screen computed styles**

In the existing `dialogue staging keeps Mum visible and controls separated` scenario, while the page is still at 900×400 and before restoring 1280×720, evaluate the hint and first option:

```js
const compactPromptStyles = await page.evaluate(() => {
  const hint = document.querySelector('.hud-prompt-hint');
  const option = document.querySelector('.hud-prompt-option');
  if (!(hint instanceof HTMLElement)) throw new Error('Expected a prompt hint');
  if (!(option instanceof HTMLElement)) throw new Error('Expected a prompt option');
  const hintStyle = getComputedStyle(hint);
  const optionStyle = getComputedStyle(option);
  return {
    hintMarginBottom: hintStyle.marginBottom,
    optionPadding: [
      optionStyle.paddingTop,
      optionStyle.paddingRight,
      optionStyle.paddingBottom,
      optionStyle.paddingLeft,
    ],
  };
});
assert.equal(compactPromptStyles.hintMarginBottom, '0px');
assert.deepEqual(compactPromptStyles.optionPadding, ['5px', '10px', '5px', '8px']);
```

Use the scenario file's existing browser-side assertion convention if it differs; the observable values and placement in the 900×400 phase are mandatory.

**Step 4: Prove the responsive contract is RED**

Run:

```powershell
npm run build
npm run test:browser -- --grep "dialogue staging keeps Mum visible and controls separated"
```

If the smoke runner does not forward `--grep`, run its documented focused scenario mechanism or the full `npm run test:browser`. Expected: the new assertions observe `2px` and `7px 12px 7px 8px`, proving the existing media declarations are overwritten by later base rules.

### Task 2: Repair and consolidate the cascade

**Files:**

- Modify: `src/ui/style.css:181-186`
- Modify: `src/ui/style.css:700-920`
- Modify: `src/ui/style.css:1154-1236`
- Modify: `src/ui/style.css:1455-1594`
- Modify: `src/ui/style.css:1843-1893`
- Modify: `src/ui/style.css:2222-2455`
- Test: `scripts/smoke.mjs`
- Test: `scripts/check-dist-size.mjs`

**Step 1: Put all 520px-height overrides after their base declarations**

Remove the four scattered `@media (max-height: 520px)` wrappers and reassemble their declarations in one final wrapper after every affected component's base rules. Preserve each declaration exactly, merging the two `.hud-mum` fragments:

```css
@media (max-height: 520px) {
  .hud-task-stack {
    /* Preserve the existing compact task-stack declarations verbatim. */
  }

  /* Preserve the existing objective and chore declarations verbatim. */

  .hud-prompt {
    gap: 4px;
    padding: 8px 10px;
    transform: translateY(36px);
  }

  .hud-prompt-hint { margin-bottom: 0; }
  .hud-prompt-option { padding: 5px 10px 5px 8px; }

  .hud-mum {
    grid-area: mum;
    min-width: 148px;
    padding-block: 6px 7px;
    transform: none;
  }

  /* Preserve the existing mobile-gate declarations verbatim. */
}
```

Do not change selector specificity. Confirm there are no remaining `max-height: 520px` wrappers outside this single block:

```powershell
rg -n "@media \(max-height: 520px\)" src/ui/style.css
```

Expected: exactly one match.

**Step 2: Remove declarations that are provably redundant**

Delete only these declarations already guaranteed by `* { margin: 0; padding: 0; box-sizing: border-box; }`:

- `box-sizing: border-box` from `.crt-wall-note`, `.pause-overlay`, `.pause-overlay-panel`, and `.volume-control`;
- `margin: 0` and `padding: 0` from `.volume-control input`;
- `margin: 0` from `.title-mum-quote`, `.title-footer-note`, and `.pause-overlay-title`.

Delete the Mum-only `@media (prefers-reduced-motion: reduce)` wrapper because the earlier blanket covers `.hud *` with `animation: none !important`. Retain the blanket unchanged.

Optionally merge the two identical `animation-delay: 0.28s` rules only if the grouped rule remains after both relevant animation shorthands:

```css
.title-card > *:nth-child(5),
.title-word:nth-child(3) { animation-delay: 0.28s; }
```

Skip this micro-optimization if placing it safely would reduce locality or obscure the cascade.

**Step 3: Make both RED contracts GREEN**

Run:

```powershell
npm run build
npm run size:check
npm run test:browser
```

Expected:

- CSS gzip is at most 10,112 bytes;
- the 900×400 prompt computes to `0px` hint margin and `5px 10px 5px 8px` option padding;
- all existing containment, overlap, focus, reduced-motion, and responsive scenarios pass.

If gzip remains above the ceiling, inspect emitted CSS and reclaim bytes only through equivalent selector/media consolidation. Do not remove visual properties, change the ceiling, add tooling, or minify source readability manually.

**Step 4: Run focused static and unit verification**

Run:

```powershell
npm test
npm run build
npm run size:check
```

Expected: all tests pass, production build succeeds, and both artifact budgets pass.

**Step 5: Commit the coherent implementation**

```powershell
git add scripts/check-dist-size.mjs scripts/smoke.mjs src/ui/style.css
git commit -m "fix: harden short-screen CSS quality"
```

### Task 3: Prove the visual blast radius

**Files:**

- Create: `shots/css-headroom-*.png`
- Modify if warranted: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`

**Step 1: Capture matched production evidence**

Serve the immutable pre-change build and the candidate build on distinct local ports. Capture the same seeded state, animation time, browser engine, device scale, and viewport for:

- title at 1280×720;
- normal dialogue at 1280×720;
- compact dialogue at 900×400;
- maximum short-screen household pressure at 900×400 with reduced motion;
- pause overlay;
- unsupported/mobile gate;
- PC/report state;
- scorecard/verdict state.

Save the durable candidate proof under `shots/css-headroom-*.png`; use scratch storage for temporary baselines and diffs.

**Step 2: Compare pixels and inspect the allowed difference**

Compute exact pixel differences for each matched pair. Expected:

- title, 1280×720 dialogue, pause, gate, PC/report, scorecard, and all states above 520px height are pixel-identical;
- the 900×400 dialogue difference is confined to the response card's hint/option vertical spacing;
- reduced-motion remains motionless and the compact Mum ticket remains fully visible.

Reject and investigate any changed pixel outside the response card or any changed frame above 520px height.

**Step 3: Reconcile the quality-program truth surface**

If the game-wide jeweller's program records completed responsive/release work, add a concise evidence row or note for the fixed short-screen prompt cascade and enforced 128-byte CSS headroom. Do not rewrite historical claims or mark any unverified surface complete.

Commit proof/truth-surface changes separately:

```powershell
git add shots docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md
git commit -m "docs: record short-screen CSS proof"
```

Omit unchanged or purely temporary files from the commit.

### Task 4: Adversarial review and complete verification

**Files:**

- Review all feature-branch changes since the plan commit

**Step 1: Review the branch against the design**

Use `superpowers:requesting-code-review` for an independent review. Ask specifically for:

- CSS cascade changes above 520px;
- lost mobile-gate/task/Mum declarations during wrapper consolidation;
- incorrect reliance on the universal reset for replaced elements;
- weakened reduced-motion coverage;
- false-pass browser assertions;
- size-gate portability and bypasses;
- proof that the visual diff is actually localized.

**Step 2: Verify review findings before acting**

Use `verify-findings` against the source, emitted CSS, computed styles, and runnable checks. Fix only confirmed issues and rerun every invalidated check. Commit confirmed corrections with a focused message.

**Step 3: Run the complete feature-branch gate**

Use `superpowers:verification-before-completion`, then run:

```powershell
npm run verify
git status --short --branch
```

Expected: unit tests, standalone build, tightened size gate, isolated browser scenarios, full interaction E2E, and mounted build all pass; only intentional tracked changes remain.

### Task 5: Integrate, re-verify, and close out

**Files:**

- No additional product files expected

**Step 1: Fast-forward local master**

From the primary workspace, verify it is clean and still at the plan commit, then:

```powershell
git merge --ff-only codex/short-screen-css-headroom
```

Do not push or deploy.

**Step 2: Re-run the complete gate on merged master**

```powershell
npm run verify
git status --short --branch
```

Expected: the same complete gate passes on merged `master`, CSS gzip remains at most 10,112 bytes, and the worktree is clean.

**Step 3: Clean the feature workspace and reflect**

Use `superpowers:finishing-a-development-branch` to remove the merged worktree and branch safely. Use `/reflect` to append and validate the required one-line process reflection.

**Step 4: Hand off evidence**

Report:

- the cascade defect and exact computed-style correction;
- final CSS raw/gzip size and enforced ceiling;
- full feature and merged-master verification results;
- visual comparison result and proof paths;
- local merge commit/branch state;
- explicit confirmation that no push or deploy occurred;
- any residual browser/device/live-deployment limitation without overstating evidence.
