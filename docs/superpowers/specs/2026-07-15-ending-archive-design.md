# Ending Archive Design

**Date:** 2026-07-15

## Outcome

Turn the title screen's buried ending counter into a real career archive that names every discovered ending, preserves mystery for undiscovered endings, and reports collection progress truthfully without adding CSS or changing persistence.

## Evidence and gap classification

Fresh production captures at 1440×900 and 1000×700 seeded a valid career with eight different endings. Both renders were visually identical to a fresh career except for `8 endings collected` appended to the smallest footer line beside joke goals. The title exposed no ending names, no canonical total, no collection view, and no way to inspect what had been earned. This does not satisfy the README or school-week design promise that endings collect in a title-screen gallery.

The audit also found a related truth defect in the Week Verdict. It receives `career.gallery.length + 1` before persistence, so replaying an ending falsely announces that the collection grew. Legacy or malformed string IDs also inflate the raw count even though they cannot correspond to a real ending.

## Approaches considered

### 1. Expand the footer into an ending-name list

This needs no new interaction, but eight to ten titles become unreadable at ordinary desktop widths and break the already-tight 1000×700 composition. Rejected.

### 2. Add a new modal or drawer

This is conventional but duplicates overlay, focus, keyboard, and responsive CSS machinery. CSS has only 21 compressed bytes of headroom, so a second design system is unjustifiable. Rejected.

### 3. Reuse the title and incident-report languages as a dedicated archive view — selected

Replace the passive footer count with a secondary `ENDING ARCHIVE · n/10` action. Activating it hides the main title card and reveals a filed-paper archive card made entirely from existing scorecard classes. The archive lists all ten canonical slots in a stable order, shows collected titles, redacts undiscovered titles, and returns cleanly to the title with a button, Enter, or Escape.

## Visual direction

The archive is a physical career file, not a modern achievement grid. It should look like one more school-night incident report: ruled paper, red stamp, Courier copy, numbered rows, and blunt redactions. The surrounding lamp/CRT atmosphere remains visible, connecting the file to the same desk.

~~~text
┌──────────────────────────────────────────────┐
│ ENDING ARCHIVE                     8 / 10    │
│ Mudwick remembers every completed week.     │
├──────────────────────────────────────────────┤
│ FILE 01   THE LOST WEEK                      │
│ FILE 02   GOBLIN WIDOW                       │
│ ...                                          │
│ FILE 09   [ CLASSIFIED ]                     │
│ FILE 10   [ CLASSIFIED ]                     │
├──────────────────────────────────────────────┤
│                 RETURN TO TITLE              │
└──────────────────────────────────────────────┘
~~~

Discovered rows use the real ending title. Undiscovered rows expose only their file number and `CLASSIFIED`; their IDs, titles, and blurbs remain absent from accessible text. Completion is written as `n / 10`, so the player understands both progress and scope.

## Interaction and accessibility

- The main title keeps Begin as its initial focus and Enter/Space start behavior.
- The archive action is a real button and stops the title screen's click-anywhere start handler.
- Opening the archive hides the main card, reveals the paper card, changes the dialog's `aria-labelledby` target, and focuses the archive heading.
- `Return to title`, Enter, or Escape closes the archive and restores focus to Begin without scrolling.
- Clicking the archive paper does not begin the game. Clicking the surrounding backdrop while the archive is open returns to the title rather than starting play.
- Space on a focused button retains native button behavior.
- Reduced-motion behavior remains unchanged; the archive adds no animation, timer, or listener beyond the existing title lifecycle.

## Canonical data and truth rules

- `src/score/week.ts` owns one exported ordered list of all ten ending records. The verdict matrix and Grounded override reference those same records so titles cannot drift.
- A pure `endingGallery(ids)` helper deduplicates known IDs, ignores unknown IDs, and returns all canonical slots with `collected` flags.
- Title progress is derived from those slots, never from the raw persisted array length.
- The Week Verdict derives its prospective count from the current gallery plus the awarded ending, so replaying an ending does not falsely increment the count.
- Persistence version, stored IDs, completion rules, ending selection, copy, and week reset behavior remain unchanged.

## Architecture

- `src/score/week.ts` owns canonical ending records and pure gallery projection.
- `src/score/week.test.ts` owns order, uniqueness, deduplication, unknown-ID, and verdict-copy contracts.
- `src/game.ts` projects persisted IDs for the title and calculates the truthful prospective Week Verdict count.
- `src/ui/title.ts` owns the two-view title lifecycle, archive markup, focus, click containment, and keyboard return.
- `scripts/smoke.mjs` owns production-browser proof at 1000×700, including populated archive content, redaction, focus, dialog labelling, backdrop behavior, return behavior, and no overflow.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` records closure evidence.

## Constraints

- Add no CSS, asset, dependency, font, route, query parameter, animation, timer, or persisted field.
- Preserve the existing `Career` v1 storage envelope and tolerate arbitrary legacy string IDs without mutating storage.
- Preserve all ten existing ending IDs, titles, blurbs, matrix thresholds, override precedence, stamps, and week scoring.
- Preserve title Begin, click-anywhere, reset confirmation, CRT, quote, parallax, reduced-motion, short-desktop, and disposal behavior.
- Do not reveal undiscovered ending titles, blurbs, or IDs in visible or accessible archive text.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes; CSS must remain byte-for-byte unchanged.
- Keep captures and temporary browser state out of commits; do not pull, push, or deploy.

## Verification

1. Add failing unit contracts for canonical order, unique IDs, gallery deduplication, unknown-ID exclusion, and stable verdict output.
2. Add a failing production-browser scenario for an eight-ending career at 1000×700.
3. Implement canonical records and pure projection, then route title and Week Verdict counts through it.
4. Implement the archive as a second hidden card using only existing classes and native `hidden` behavior.
5. Capture and critique populated archive renders at 1440×900 and 1000×700.
6. Reject the candidate if it reveals locked titles, begins play from archive interaction, traps focus, overflows, resembles a web achievement modal, changes CSS, or reports a duplicate/unknown ID as progress.
7. Run focused unit tests, build, browser checks, size gates, and `npm run verify` in the feature worktree and again after local fast-forward integration.
