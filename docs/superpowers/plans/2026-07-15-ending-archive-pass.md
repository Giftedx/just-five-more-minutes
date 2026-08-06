# Ending Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the title's passive ending counter with a truthful, keyboard-safe archive of all ten canonical ending slots.

**Architecture:** Make `src/score/week.ts` the single source for ending records and project arbitrary persisted IDs through a pure `endingGallery()` helper. Pass the projection into a two-view title overlay that reuses existing title and scorecard classes, and use the same projection to correct Week Verdict counts for duplicate and unknown IDs.

**Tech Stack:** TypeScript 7, DOM/CSS, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.4

## Global Constraints

- Add no CSS, asset, dependency, font, route, query parameter, animation, timer, or persisted field.
- Preserve the existing `Career` v1 storage envelope and tolerate arbitrary legacy string IDs without mutating storage.
- Preserve all ten existing ending IDs, titles, blurbs, matrix thresholds, override precedence, stamps, and week scoring.
- Preserve title Begin, click-anywhere, reset confirmation, CRT, quote, parallax, reduced-motion, short-desktop, and disposal behavior.
- Do not reveal undiscovered ending titles, blurbs, or IDs in visible or accessible archive text.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes; CSS must remain byte-for-byte unchanged.
- Keep captures and temporary browser state out of commits; do not pull, push, or deploy.

---

## File responsibilities

- `src/score/week.ts` owns all canonical ending records, the verdict matrix, and gallery projection.
- `src/score/week.test.ts` owns ending metadata and gallery truth contracts.
- `src/game.ts` owns projection of persisted career IDs into title and prospective Week Verdict data.
- `src/ui/title.ts` owns archive markup, view switching, focus, click containment, keyboard behavior, and title disposal.
- `scripts/smoke.mjs` owns production-browser archive, geometry, accessibility, and regression assertions.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` owns program-wide closure truth.
- `docs/superpowers/plans/2026-07-15-ending-archive-pass.md` owns execution evidence.

### Task 1: Establish one canonical ending archive

**Files:**
- Modify: `src/score/week.test.ts`
- Modify: `src/score/week.ts`

**Interfaces:**
- Consumes: the ten existing ending IDs/titles/blurbs and unchanged `weekVerdict(reports, lieDebt, fridaySuspicion)` inputs.
- Produces: `ENDING_ARCHIVE`, `EndingGallerySlot`, and `endingGallery(ids: readonly string[]): EndingGallerySlot[]`.

- [x] **Step 1: Write the failing canonical-metadata contract**

Import `ENDING_ARCHIVE` and `endingGallery` in `src/score/week.test.ts`, then add:

```ts
it('keeps every ending in one stable unique archive', () => {
  expect(ENDING_ARCHIVE.map((ending) => ending.endingId)).toEqual([
    'lostWeek',
    'goblinWidow',
    'groundedWorthIt',
    'quietDecline',
    'negotiator',
    'doubleAgent',
    'employeeOfTheMonth',
    'responsibleOne',
    'timeWizard',
    'groundedForNothing',
  ]);
  expect(new Set(ENDING_ARCHIVE.map((ending) => ending.endingId)).size).toBe(ENDING_ARCHIVE.length);
  expect(ENDING_ARCHIVE.every((ending) => ending.title.length > 0 && ending.blurb.length > 0)).toBe(true);
});
```

- [x] **Step 2: Write the failing projection truth contract**

Add:

```ts
it('projects known endings once and ignores unknown persisted ids', () => {
  const gallery = endingGallery(['timeWizard', 'timeWizard', 'lostWeek', 'legacyMystery']);
  expect(gallery).toHaveLength(10);
  expect(gallery.filter((slot) => slot.collected).map((slot) => slot.id)).toEqual([
    'lostWeek',
    'timeWizard',
  ]);
});
```

- [x] **Step 3: Run the focused test to verify RED**

Run `npm test -- src/score/week.test.ts`.

Expected: FAIL because `ENDING_ARCHIVE` and `endingGallery` are not exported.

- [x] **Step 4: Define canonical records and reuse them in verdict selection**

In `src/score/week.ts`, define each existing ending object exactly once, export the ordered list, and make the matrix/override reference those objects:

```ts
export interface EndingGallerySlot {
  id: string;
  title: string;
  collected: boolean;
}

const LOST_WEEK = {
  endingId: 'lostWeek', title: 'The Lost Week', blurb: 'Neither world improved. Bold.',
} as const;
const GOBLIN_WIDOW = {
  endingId: 'goblinWidow', title: 'Goblin Widow', blurb: 'The goblins know you better than we do.',
} as const;
const GROUNDED_WORTH_IT = {
  endingId: 'groundedWorthIt', title: 'Grounded (Worth It)', blurb: "You regret nothing. That's the problem.",
} as const;
const QUIET_DECLINE = {
  endingId: 'quietDecline', title: 'Quiet Decline', blurb: 'Attendance: yes. Participation: debatable.',
} as const;
const NEGOTIATOR = {
  endingId: 'negotiator', title: 'The Negotiator', blurb: 'Everyone got something. Nobody got everything.',
} as const;
const DOUBLE_AGENT = {
  endingId: 'doubleAgent', title: 'Double Agent', blurb: 'Two lives, adequately led.',
} as const;
const EMPLOYEE_OF_THE_MONTH = {
  endingId: 'employeeOfTheMonth', title: 'Employee of the Month (This House)', blurb: 'The fridge gets your photo.',
} as const;
const RESPONSIBLE_ONE = {
  endingId: 'responsibleOne', title: 'The Responsible One', blurb: 'Suspiciously functional.',
} as const;
const TIME_WIZARD = {
  endingId: 'timeWizard', title: 'Time Wizard', blurb: 'We checked the clocks. Nothing was wrong with the clocks.',
} as const;
const GROUNDED_FOR_NOTHING = {
  endingId: 'groundedForNothing', title: 'Grounded (For Nothing)',
  blurb: 'All that suspicion, and not even a fortune to show for it.',
} as const;

export const ENDING_ARCHIVE = [
  LOST_WEEK,
  GOBLIN_WIDOW,
  GROUNDED_WORTH_IT,
  QUIET_DECLINE,
  NEGOTIATOR,
  DOUBLE_AGENT,
  EMPLOYEE_OF_THE_MONTH,
  RESPONSIBLE_ONE,
  TIME_WIZARD,
  GROUNDED_FOR_NOTHING,
] as const;

export function endingGallery(ids: readonly string[]): EndingGallerySlot[] {
  const collected = new Set(ids);
  return ENDING_ARCHIVE.map(({ endingId: id, title }) => ({ id, title, collected: collected.has(id) }));
}
```

Keep `WeekVerdict.endingId`, every title/blurb, all thresholds, and the Friday override unchanged.

- [x] **Step 5: Run the focused test to verify GREEN**

Run `npm test -- src/score/week.test.ts`.

Expected: all week tests pass, including the pre-existing 3×3 matrix, override, stamp, and grade contracts.

- [x] **Step 6: Commit the canonical data seam**

Run `git diff --check`, then commit `src/score/week.ts` and `src/score/week.test.ts` with `refactor: canonicalize ending archive data`.

### Task 2: Add the title archive and correct collection counts

**Files:**
- Modify: `src/ui/title.ts`
- Modify: `src/game.ts`
- Modify: `scripts/smoke.mjs`

**Interfaces:**
- Consumes: `endingGallery(ids)` and `EndingGallerySlot[]` from Task 1.
- Produces: `WeekView.gallery: readonly EndingGallerySlot[]`, a title `ENDING ARCHIVE · n/10` action, a hidden paper archive card, and truthful prospective Week Verdict counts.

- [x] **Step 1: Add the failing production-browser archive contract**

In `scripts/smoke.mjs`, add an isolated `title exposes a truthful keyboard-safe ending archive` scenario at `{ viewport: { width: 1000, height: 700 } }`. Seed `j5mm-career-v1` with eight known IDs, one duplicate, and one unknown ID before navigation. Assert before interaction:

```js
assert.equal(state.archiveAction, 'ENDING ARCHIVE · 8/10');
assert.equal(state.archiveHidden, true);
assert.equal(state.beginFocused, true);
assert.equal(state.overflow, false);
```

Click the unique archive button, then assert:

```js
assert.equal(state.mainHidden, true);
assert.equal(state.archiveHidden, false);
assert.equal(state.dialogLabelledBy, 'ending-archive-title');
assert.equal(state.headingFocused, true);
assert.equal(state.rows, 10);
assert.equal(state.collectedRows, 8);
assert.equal(state.classifiedRows, 2);
assert.equal(state.hasKnownTitle, true);
assert.equal(state.revealsLockedTitle, false);
assert.equal(state.overflow, false);
```

Click the paper card away from its button and prove the title has not begun. Press Escape, prove the main title returns and Begin regains focus, reopen the archive, press Enter, and prove the same return behavior. Retain the existing short-desktop title geometry scenario.

- [x] **Step 2: Build and run browser checks to verify RED**

Run `npm run build` and `npm run test:browser`.

Expected: the new scenario fails because no archive action or archive card exists.

- [x] **Step 3: Pass projected slots through the title contract**

Change `WeekView` in `src/ui/title.ts` from `galleryCount: number` to:

```ts
gallery: readonly {
  id: string;
  title: string;
  collected: boolean;
}[];
```

In `src/game.ts`, import `endingGallery`, build the projection once for the title, and pass it as `gallery: endingGallery(this.career.gallery)`.

- [x] **Step 4: Render the archive using only existing classes**

In `showTitle`, derive `collectedCount`, render a secondary `.title-reset` archive button after the footer note, and render a sibling `.sc-card` with `hidden`, `aria-labelledby="ending-archive-title"`, one `.sc-career` row per slot, and a `.sc-restart` return button. Collected rows include the real title; locked rows include only their ordinal and `CLASSIFIED`. Remove the old `galleryLine` footer suffix.

The archive card structure must remain:

```html
<section class="sc-card" hidden>
  <div class="sc-header">
    <div class="sc-stamp">ARCHIVED</div>
    <div class="sc-title" id="ending-archive-title" tabindex="-1">ENDING ARCHIVE</div>
    <div class="sc-subtitle">Mudwick remembers every completed week.</div>
  </div>
  <div class="sc-body"><!-- ten sc-career rows --></div>
  <button class="sc-restart" type="button">Return to title</button>
</section>
```

- [x] **Step 5: Implement view, focus, click, and keyboard lifecycle**

Keep references to the main card, archive card, archive action, archive heading, and return button. Add `openArchive()` and `closeArchive()` that toggle `hidden`, update the dialog's `aria-labelledby`, and focus the correct target with `{ preventScroll: true }`. Stop propagation on archive action, archive paper, and return button. While the archive is open, backdrop click closes it, Enter/Escape close it, and no key can call `finish()`. On the main title, preserve the existing Enter/Space rules exactly. Remove the new listeners in `removeInputListeners()`.

- [x] **Step 6: Correct prospective Week Verdict progress**

Replace `this.career.gallery.length + 1` with:

```ts
endingGallery([...this.career.gallery, verdict.endingId]).filter((slot) => slot.collected).length
```

This must count a newly discovered ending once, keep the count stable for a replay, and ignore unknown legacy IDs without rewriting storage.

- [x] **Step 7: Run focused and browser checks to verify GREEN**

Run `npm test -- src/score/week.test.ts`, `npm run build`, and `npm run test:browser`.

Expected: unit tests pass; every isolated browser scenario and the full interaction E2E pass; the new archive scenario proves 8/10 truth, redaction, focus, click containment, keyboard return, and 1000×700 geometry.

- [x] **Step 8: Capture and critique real production frames**

Capture populated archive frames at 1440×900 and 1000×700 under ignored `shots/`. Reject the result if rows look like generic achievement pills, locked titles leak, the card requires scrolling at 1000×700, the backdrop begins play, the archive competes with the title's primary Begin action, or focus is not obvious.

- [x] **Step 9: Perform the restraint edit and verify budgets**

Remove any duplicate copy, unnecessary row ornament, or interaction that does not improve collection comprehension. Run `git diff -- src/ui/style.css` and require no output. Then run `npm run size:check` and `git diff --check`.

Expected: JavaScript is at or below 204,800 gzip bytes; CSS remains byte-for-byte unchanged at or below 10,112 gzip bytes; no whitespace errors.

- [x] **Step 10: Commit the archive experience**

Commit `src/ui/title.ts`, `src/game.ts`, and `scripts/smoke.mjs` with `feat: add the ending archive`.

### Task 3: Reconcile truth surfaces and complete integration

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-ending-archive-pass.md`
- Create ignored proof: `shots/ending-archive-*.png`

**Interfaces:**
- Consumes: final captures, unit/browser evidence, artifact sizes, and feature commits.
- Produces: current program truth, a verified feature tree, and a clean locally integrated master.

- [x] **Step 1: Record the confirmed closure**

Append a dated closure to the game-wide program describing the counter-only defect, duplicate-count bug, selected filed-paper archive, canonical projection, redaction and focus contracts, preserved CSS, final artifact sizes, test counts, browser scenario count, and ignored proof paths.

- [x] **Step 2: Mark only completed checklist items**

Change each successful `- [ ]` in this plan to `- [x]`. Retain any failed or skipped item unchecked with a concrete explanation.

- [x] **Step 3: Self-review the documents and diff**

Run `rg -n "[T]BD|[T]ODO|[F]IXME" docs/superpowers/specs/2026-07-15-ending-archive-design.md docs/superpowers/plans/2026-07-15-ending-archive-pass.md`, `git diff --check`, and `git status --short`.

Expected: no placeholders, whitespace defects, or staged browser artifacts.

- [x] **Step 4: Run the complete feature-tree gate**

Run `npm run verify`.

Expected: all unit tests, standalone build, artifact budgets, every isolated browser scenario, full interaction E2E, and mounted build pass.

- [x] **Step 5: Integrate locally and verify again**

Fast-forward the verified feature branch onto `master` and rerun `npm run verify`. Do not pull, push, or deploy.

- [x] **Step 6: Clean up and reflect**

Remove only the task-owned worktree and merged feature branch. Use `apply_patch` to append one valid JSON line to `reflections.jsonl` in the agent's own memory directory. Use keys `date`, `task`, `outcome`, `surprise`, and `next-time`. Parse every line to validate the JSONL file.
