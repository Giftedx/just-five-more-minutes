# Whole-Product Foundations-First Enhancement Design

**Date:** 2026-07-16

## Outcome

Deeply improve *Just Five More Minutes* across every existing feature without replacing its identity or churning surfaces that are already finished. Establish reliable release artifacts and useful size headroom first, then audit every player-visible and supporting system with current production evidence. Implement only confirmed improvements, preserve intentional desktop-first constraints, and finish with whole-week browser proof.

This is a quality program, not a promise to modify every file. Every feature must receive an evidence-backed disposition: improved, guarded, or intentionally preserved.

## Product direction

The game remains a desktop-first, self-contained browser comedy about balancing a five-minute household deadline with a deliberately overbuilt 2004-style MMO. The procedural bedroom, Canvas 2D Mudwick client, runtime audio, five-night progression, local career, and authored incident-report language remain the core identity.

The program prioritizes player-facing polish, performance, accessibility, and reliability. New gameplay content and broad internal refactoring are secondary and must be justified by a confirmed player-facing or release-quality gap.

Mobile and touch play are not added. First-person pointer-lock navigation and a mouse-driven MMO inside that navigation are intentional desktop mechanics. Unsupported devices continue to receive a clear, polished explanation rather than a compromised alternate control scheme.

## Current evidence

The clean `master` baseline is `ce172af`. It is intentionally 179 commits ahead of `origin/master` and must retain that local history.

The complete local gate passed before this design:

- 19 Vitest files and 232 tests passed.
- The standalone TypeScript and Vite build passed.
- The compressed-size gate passed.
- All 29 isolated production-browser scenarios passed.
- The full interaction E2E passed with `54 / 100` and the expected ending.
- The mounted `/just-five-more-minutes/` build passed.

The audit also confirmed three systemic risks:

1. `npm run verify` ends with `npm run build:hub`, leaving `dist/index.html` pointed at `/just-five-more-minutes/assets/...`. The documented root `npm run preview` then serves the HTML at `/` and returns 404 for the application JavaScript. The gate passes while leaving its documented preview post-condition broken.
2. The deterministic size gate reports 204,183 gzip bytes of JavaScript against a 204,800-byte ceiling and 10,091 gzip bytes of CSS against a 10,112-byte ceiling. That is only 617 bytes and 21 bytes of headroom respectively.
3. Several change-sensitive responsibilities are concentrated in large modules: `renderer.ts` is about 67 KB, `style.css` about 62 KB, `room.ts` about 51 KB, and `game.ts` about 35 KB. Their size alone is not a defect, but feature work must not deepen their coupling without evidence.

Fresh 1440×900 production captures showed a cohesive title, bedroom, and Mudwick client with no console or network errors after restoring the standalone artifact. Existing visual systems are therefore presumed complete until a current state capture, runtime measurement, or source contract proves otherwise.

## Gap classification

| Claim | Existing analogous path | Classification | Required action |
|---|---|---|---|
| Verification leaves a usable standalone preview | `build`, `build:hub`, `test:browser`, `run-browser-checks.mjs` | Missing guard | Make artifact modes explicit and test the final preview post-condition |
| There is safe capacity for continued enhancement | `check-dist-size.mjs` | Missing capacity | Remove measured waste and retain or tighten ceilings; never raise them to admit new work |
| Title and onboarding need a redesign | Authored incident card, live CRT, school-week strip, archive and short-screen guards | Already satisfied | Preserve; audit focus, copy, motion, and failure paths |
| Bedroom needs wholesale remodeling | Authored shell, props, hero furniture, lighting, chore targets, curtains and browser guards | Already satisfied | Preserve; profile rendering and inspect interaction clarity at representative nights |
| Mum and household pressure are readable and fair | Director tests, dialogue staging, doorway vignette, pressure stack and prompt guards | Already satisfied with audit required | Exercise cross-mode timing, maximum pressure, pause, and night escalation |
| Mudwick needs clearer and cheaper presentation | Simulation tests, renderer tests, inventory, action readout, away plan and production-pixel guards | Missing audit, not presumed missing feature | Profile the real Canvas path and repair only observed clarity, layering, or cadence defects |
| Progression and endings are truthful and resilient | Career migrations, report history, verdict matrix, ending archive | Already satisfied with failure-path gaps possible | Exercise corrupt/blocked storage, full-week transitions, replay, and duplicated endings |
| Audio and lifecycle ownership are complete | Persisted volume, pause behavior, restart and gate ownership tests | Missing deeper guard | Measure listener, timer, AudioContext and WebGL cleanup across repeated transitions |
| Accessibility is complete because current smokes pass | Keyboard, semantic dialogs, reduced motion, contrast and short-screen scenarios | Missing whole-flow audit | Verify every modal, transition, failure state and week signature, not just isolated components |
| Large files require a rewrite | Existing focused helpers and extracted procedural factories | Already satisfied as a principle | Extract only cohesive code needed by a confirmed change |

## Approaches considered

### 1. Foundations first, then feature-by-feature evidence — selected

Repair artifact correctness, recover capacity, and establish production measurements before modifying feature surfaces. Then audit each feature and implement the highest-value confirmed improvements test-first. This protects the current quality bar and makes later changes cheaper to prove.

### 2. Surface-by-surface jeweller's pass

Continue polishing title, room, Mum, Mudwick, and reports in visual order. This gives immediate screenshots but ignores the broken artifact post-condition and exhausted budgets. It risks spending the remaining capacity on decoration while release reliability degrades.

### 3. Architectural rewrite

Split the renderer, game controller, room factory, and stylesheet before adding improvements. This may produce cleaner files, but it creates a large regression surface without evidence that the existing boundaries prevent player value. Rejected in favor of targeted extraction around confirmed work.

## Architecture and data flow

The current product flow remains authoritative:

`NightSpec -> Director and room configuration -> Host and Mudwick simulation -> normalized events -> HUD, audio and score -> career persistence -> title, report and verdict`

The following ownership rules apply:

- `NightSpec` remains the source for per-night timing, physical chores, room signatures, Mum escalation, modem state, and XP modifiers.
- Director and simulation remain deterministic from the session seed and elapsed game time.
- Host and Mudwick expose events rather than reaching into scoring or career presentation.
- `Game` remains the top-level orchestration boundary. Cohesive lifecycle, persistence, or presentation logic may be extracted only when a confirmed improvement would otherwise deepen coupling.
- Renderer and room factories retain current draw order, click geometry, procedural-art identity, and asset-free runtime. Pure layout, formatting, or resource-ownership helpers may be extracted when independently testable.
- Career data remains versioned, tolerant of older values, and local-only. Migration must never silently discard recoverable progress.

## Release artifact design

The public contracts remain:

- `npm run build` creates a standalone artifact that works at `/` and through `npm run preview`.
- `npm run build:hub` creates a mounted artifact for `/just-five-more-minutes/` in the location expected by the hub integration.
- `npm run verify` validates both modes and finishes with a valid standalone `dist/` artifact, matching the documented preview workflow.

Verification must load both builds through their real base paths and reject missing scripts, styles, fonts, icons, or unexpected network requests. A successful HTML response is insufficient when its referenced assets fail.

The implementation may use a temporary or alternate output directory internally, or rebuild the standalone artifact at the end. It must not silently change the hub consumer's expected command or artifact location.

## Capacity and performance design

The size ceilings remain 204,800 gzip bytes for JavaScript and 10,112 gzip bytes for CSS. They are constraints, not targets to fill.

Before optimizing, record production measurements for:

- script, style and font transfer size;
- title-to-interactive and first playable frame;
- room and PC-mode frame cadence at representative states;
- room-mode capped Mudwick cadence;
- repeated title, gate, restart and week-transition resource ownership;
- event listeners, timers, animation frames, AudioContext state and WebGL context disposal;
- CSS selector use across all browser scenarios rather than one screen.

Remove only waste demonstrated by measurements or unreachable-path analysis. Acceptable changes include deleting stale rules, consolidating equivalent logic, eliminating redundant production-only wrappers, reducing repeated work, or separating development affordances when doing so reduces shipped cost without breaking documented routes.

Do not lower visual fidelity, remove accessibility states, weaken browser coverage, change progression pacing, or increase the ceilings to claim success. After optimization, ratchet documentation and tests to the achieved headroom only when the result is stable across the supported local and CI Node lines.

## Feature experience program

### Boot, title and onboarding

Preserve the incident-card hierarchy, live CRT, school-week strip, ending archive, Begin priority, reset confirmation, parallax and reduced-motion behavior. Audit initial keyboard focus, click-anywhere behavior, storage-failure messaging, short-height reachability and the transition into pointer lock.

### Bedroom and chores

Audit navigation, object readability, interaction labels, carry and tug feedback, target clarity, overlapping chore states, night-specific props, homework panic, collision boundaries and room-scale Mudwick legibility. Preserve current procedural geometry and authored visual language unless a fresh capture proves a defect.

### Mum and the director

Audit prompt timing, grace periods, ignored responses, repeated excuses, suspicion tiers, maximum household-pressure stacking, inspection staging, pause behavior, mode changes and the final warning. Player feedback must remain truthful, readable and fair without making Mum less persistent or less funny.

### Mudwick

Audit default and context actions, hover/readout bounds, combat, death and gravestones, gathering, fishing and cooking, trading, toll progression, away-plan automation, inventory states, quest feedback, double XP, modem outage layering, minimap and side-panel hierarchy. Preserve deterministic simulation and 320×240 hard-pixel rendering.

### Audio and pause

Audit first-unlock behavior, persisted volume, title and gameplay transitions, background-tab behavior, repeated restart, unsupported audio environments and context cleanup. Audio failure must never prevent play.

### Week progression, reports and endings

Audit Monday through Friday transitions, persistent character state, suspicion carry, signature night events, report history, score rounding, verdict selection, duplicate endings, the archive, full reset and replay. Player-visible counts and claims must come from canonical data.

### Accessibility and unsupported devices

Retain desktop-only play. Verify semantic dialogs, focus entry and return, keyboard-only actions, focus visibility, contrast through animated states, reduced motion, 900×400 and ordinary desktop layouts, readable error states, and the fine-pointer/device gate. Unsupported devices must receive an honest explanation with no false promise of automatic compatibility.

## Error handling and resilience

- Missing or corrupt local storage produces a recoverable fresh state while preserving any valid fields that can be migrated.
- A failed save does not discard the current report or crash the session. The player receives one clear, non-spamming indication when progression will not persist.
- Pointer-lock rejection pauses time and offers a retry path. It must not create duplicate canvases, listeners, or game instances.
- Visibility changes freeze the correct clocks and presentation timers without desynchronizing prompts, subtitles, particles, or renderer messages.
- Web Audio failures degrade to silence with working volume controls and gameplay.
- Gate transitions and restarts dispose owned WebGL resources, timers, animation frames and DOM listeners.
- Build verification fails with the requested base path, failed resource and artifact mode visible in the error.

## Verification strategy

Implementation follows test-driven development. Each behavior change begins with a test that fails for the confirmed reason, followed by the smallest coherent implementation.

### Focused evidence

- Pure unit tests cover deterministic simulation, score, persistence, formatting, layout bounds and resource helpers.
- Production-browser scenarios cover real DOM, Canvas, WebGL, keyboard, focus, responsive, reduced-motion and failure behavior.
- Visual captures are inspected at original resolution for 1440×900, 1000×700, 900×400 and relevant reduced-motion states.
- Performance comparisons use the same production state, seed, viewport, browser and measurement procedure before and after.

### Whole-product evidence

The expanded browser matrix must represent every weeknight and include Wednesday's modem outage, Thursday's inspection path, Friday's double XP presentation, the Friday report, the week verdict, archive return and new-week transition. It must also exercise blocked storage, pointer-lock rejection, visibility pause, unsupported devices and repeated lifecycle transitions.

For each selected weeknight, the managed runner executes `scripts/e2e-full.mjs --night=N`. `scripts/e2e-night.mjs` provides the interaction plan. `scripts/e2e-expectations.mjs` provides the assertions for each night. `npm run test:browser` selects nights 0 through 4 by default. Use `npm run test:browser -- --nights=0,2` to select a subset.

The final release gate includes:

1. focused tests for every changed subsystem;
2. all Vitest tests;
3. type checking;
4. standalone production build;
5. deterministic compressed-size check;
6. standalone production-browser scenarios and one full interaction E2E per selected weeknight;
7. mounted production build and mounted-base resource smoke;
8. a final standalone artifact and root preview smoke;
9. `git diff --check` and a clean attribution review.

After any late edit, rerun every invalidated check. A locally mounted artifact is not a live deployment claim.

## Delivery sequence

### Tranche 1: release foundation

Repair the artifact post-condition and add base-aware resource checks. This is the first implementation slice because every later improvement depends on truthful artifacts.

### Tranche 2: capacity and performance

Add the smallest reusable measurement harness needed to identify real waste, then recover release headroom and close lifecycle leaks without weakening quality gates.

### Tranche 3: feature matrix

Capture and exercise every player-visible state. Prioritize confirmed issues by player impact, frequency, reversibility and strength of local proof. Implement coherent cross-feature fixes rather than cosmetic churn.

### Tranche 4: whole-week closure

Expand representative browser coverage, reconcile documentation and scripts, run the complete release gate, and record residual hardware or live-deployment limits precisely.

## Planning boundary

This document is the umbrella design for the whole-product program, not one monolithic implementation plan. The next implementation plan covers Tranche 1 only: release artifact correctness and its regression guards. Tranche 2 receives its own evidence-specific design and plan after Tranche 1 establishes trustworthy artifacts; Tranches 3 and 4 follow the same rule. This keeps each change set bounded, testable, and based on current measurements while preserving the commitment to audit every feature.

## Scope boundaries

This program does not add:

- mobile or touch gameplay;
- a backend, account, analytics or telemetry service;
- external art, music, voice, shader or content pipelines;
- online multiplayer or network-dependent runtime behavior;
- a new package manager or unreviewed dependency;
- a wholesale renderer, room or state-management rewrite;
- relaxed size, accessibility, performance or browser gates.

New content is allowed only when the cross-feature audit proves that content, rather than clarity, resilience, performance or flow, is the highest-value remaining gap.

## Acceptance criteria

The program is complete when:

- standalone and mounted artifacts both load through their intended base paths with no missing resources or unexpected console errors;
- `npm run verify` passes and leaves `npm run preview` usable at the documented root;
- compressed-size ceilings remain unchanged and additional stable headroom is recorded;
- representative load, frame-cadence and lifecycle measurements do not regress;
- every feature in the experience program has a current evidence-backed disposition;
- confirmed improvements have tests that would have failed beforehand;
- Monday through Friday signature states and end-of-week transitions have production-browser evidence;
- keyboard, focus, reduced-motion, short-screen, storage-failure, pointer-lock, visibility and repeated-restart paths pass;
- README, scripts, tests, specifications and shipped behavior agree;
- residual risks, skipped checks, hardware limits and undeployed local artifacts are reported without borrowing stronger language than the evidence supports.

## 2026-07-16 Tranche 1 release-artifact closure

The release gate now treats artifact mode as an observable contract. The managed Vite preview accepts an explicit normalized base, and a focused Playwright probe rejects failed resources, external requests, console/page errors, or a missing title/game/room boot state. The same owned preview lifecycle serves the full standalone suite and the focused standalone or mounted artifact probes.

`npm run verify` now validates the mounted build at `/just-five-more-minutes/`, rebuilds standalone output, repeats the size gate, validates the root artifact, and leaves that standalone `dist/` for `npm run preview`. CI installs Chromium and runs this same command. No dependency, lockfile, gameplay, visual, audio, input, persistence, scoring, or size ceiling changed.

Fresh local verification passed 20 test files / 238 tests, all 29 isolated browser scenarios, the full interaction E2E with `54 / 100` and `Employee of the Month (This House)`, both artifact probes, and clean preview teardown. The final standalone artifact remained 204,183 JavaScript gzip bytes and 10,091 CSS gzip bytes against unchanged 204,800-byte and 10,112-byte ceilings. This is local artifact evidence, not a live deployment claim.
