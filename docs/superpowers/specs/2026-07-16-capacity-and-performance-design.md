# Capacity and Performance Evidence Design

**Date:** 2026-07-16

## Outcome

Recover safe release capacity and strengthen runtime lifecycle guarantees without changing the identity, fidelity, accessibility, or pacing of *Just Five More Minutes*. Add the smallest reusable browser measurement path needed to distinguish real waste from speculation, use that evidence to make bounded production optimizations, and ratchet deterministic size budgets to retain useful headroom.

This is Tranche 2 of the [whole-product foundations-first enhancement design](./2026-07-16-whole-product-foundations-first-enhancement-design.md). It is a measurement-and-correction tranche, not a general refactor or visual redesign.

## Current evidence

The clean `master` baseline is `843afd9`. Tranche 1 established truthful standalone and mounted artifacts, base-aware resource smokes, owned preview cleanup, and a final standalone `dist/` after `npm run verify`.

The current standalone artifact passes its deterministic size gate at:

- 204,183 gzip bytes of JavaScript against a 204,800-byte ceiling, leaving 617 bytes;
- 10,091 gzip bytes of CSS against a 10,112-byte ceiling, leaving 21 bytes.

The production browser suite contains 29 isolated scenarios. It already guards capped room-mode Mudwick rendering and WebGL ownership across restart and gate transitions. `Game.dispose()` also owns top-level cancellation and listener cleanup. These are useful assertions, but they do not yet produce a reusable whole-suite resource inventory, transfer report, CSS-usage union, or repeated-transition lifecycle delta.

The gap is therefore measurement and capacity, not an assumed gameplay or presentation defect.

## Goals

1. Produce repeatable production-browser evidence for transfer size, readiness, render cadence, CSS rule use, and browser resource ownership.
2. Fail loudly when the measurement itself is malformed or when deterministic lifecycle and cadence contracts regress.
3. Remove only waste supported by multiple evidence sources.
4. Preserve at least 2 KiB of JavaScript gzip headroom and 512 bytes of CSS gzip headroom beneath the existing ceilings.
5. Keep timing-sensitive diagnostics out of the ordinary CI pass/fail surface while retaining stable size, lifecycle, cadence, and harness-contract gates in `npm run verify`.

## Non-goals

This tranche does not add:

- analytics, telemetry, a backend, or production performance instrumentation;
- a dependency, package-manager change, or external profiling service;
- mobile or touch gameplay;
- lower-resolution art, simpler rendering, reduced accessibility coverage, or altered progression pacing;
- a renderer, game-controller, room, audio, or stylesheet rewrite;
- deletion justified by CSS coverage alone;
- increased JavaScript or CSS ceilings.

Player-visible behavior changes only when measurement exposes a real defect. Any such correction must receive its own failing behavior test before implementation.

## Approaches considered

### 1. Evidence-led capacity recovery — selected

Extend the existing managed production-browser path with an opt-in measurement mode, separate deterministic report logic from browser collection, measure the full scenario matrix, then remove only proven waste. This has a modest harness cost but gives future optimization work a repeatable evidence base and lets lifecycle defects be distinguished from bundle pressure.

### 2. Static size sweep

Inspect imports, generated chunks, and CSS text, then make the smallest changes that reduce gzip output. This is faster initially but cannot establish runtime ownership, cadence, or whole-suite CSS reachability. It also encourages optimizing code shape before proving player-relevant waste.

### 3. Runtime profiling first

Begin with detailed frame and CPU traces in representative gameplay states. This gives deep rendering evidence but does not address the immediate release-capacity constraint and adds a larger, more timing-sensitive harness before stable transfer and lifecycle contracts exist.

## Architecture and data flow

Tranche 2 remains in release tooling until evidence proves that production code or CSS should change.

The data flow is:

`standalone production build -> owned preview -> instrumented Playwright scenarios -> normalized report -> corroborated optimization -> full verification -> stable budget ratchet`

The ordinary browser path remains unchanged by default. Measurement is opt-in and uses the same production artifact, loopback-only preview, scenario definitions, fixed browser behavior, error capture, and `finally`-owned teardown as the release smoke.

Browser-only collectors are installed before application boot. They observe browser APIs and Chrome DevTools Protocol data without adding instrumentation to shipped modules. Each scenario closes its page and session even when collection or assertions fail. The managed runner then terminates its owned preview through the existing cleanup path.

The normalized report is written to standard output as JSON. No report file, trace, generated source, or profiling runtime is committed or included in `dist/`.

## Components

### `scripts/browser-performance-contract.mjs`

This module owns no browser or process lifecycle. It contains pure functions for:

- validating individual scenario samples;
- rejecting missing, non-finite, negative, or structurally inconsistent metrics;
- aggregating repeated samples as minimum, median, and maximum values;
- unioning CSS rule-use ranges by stable stylesheet identity;
- comparing resource-ownership snapshots and size targets;
- producing a stable, versioned JSON report shape.

The module is independently unit-tested so schema and comparison failures do not require launching Chromium.

### `scripts/smoke.mjs`

The existing smoke remains the single source of truth for the 29 production-browser scenarios. An opt-in measurement mode wraps those same scenarios rather than creating a second, drifting matrix.

For each measured page, the smoke:

- creates a DevTools Protocol session where required;
- installs browser API collectors before application boot;
- records network, readiness, cadence, CSS-use, and ownership samples;
- preserves the existing console, page, resource, and scenario assertions;
- detaches the protocol session and closes the page in `finally`;
- passes raw samples to the pure performance contract.

Ordinary browser execution neither starts coverage nor emits a performance report.

### `scripts/run-browser-checks.mjs`

The managed runner gains a `--measure-only` mode that is mutually exclusive with `--artifact-only`. It starts the same owned Vite preview and invokes the smoke with measurement enabled. Argument conflicts, unsupported bases, a failed child process, or preview cleanup failure remain fatal and include actionable context.

### `npm run measure:browser`

The package command creates a standalone production build and runs the managed browser checks in measurement mode. Its output is one normalized JSON document suitable for local comparison or capture by CI tooling, while diagnostics and failures go to standard error.

The command is an explicit pre/post optimization tool. It is not added wholesale to `npm run verify`, because three-run wall-clock sampling would lengthen the existing browser matrix and introduce a timing-sensitive recurring gate. The deterministic contract tests and hard browser invariants remain part of normal verification.

## Measurement contract

Every report includes:

- schema version, commit identifier when available, Node version, browser version, operating system, seed, viewport, base path, and sample count;
- production script, style, font, and other first-party resource sizes, including encoded network bytes where observable and deterministic artifact gzip sizes where applicable;
- navigation-to-title-interactive and Begin-to-first-playable-frame durations;
- room-mode and PC-mode animation/render counts over fixed observation windows;
- capped room-mode Mudwick render cadence;
- CSS stylesheet identity, total tracked bytes, used ranges, unused ranges, and union coverage across all scenarios;
- active animation frames, timeouts, intervals, registered event listeners, AudioContexts, and WebGL contexts at defined lifecycle checkpoints;
- ownership deltas after title return, gate transitions, repeated restart, and final teardown;
- console, page, request, collector, and cleanup errors.

Timing and cadence samples use three runs with the same production build, seed, viewport, browser configuration, and scenario order. The report retains minimum, median, and maximum rather than presenting a single precise-looking value.

Network reporting distinguishes observed encoded transfer from deterministic gzip artifact size. A localhost server that does not negotiate compression must not be described as real-world compressed transfer.

### Readiness definitions

`titleInteractiveMs` begins at the page performance time origin and ends when the authored title action is visible, enabled, and responds to the existing title interaction contract.

`firstPlayableFrameMs` begins when the title action is invoked and ends when the gameplay shell is active and the room canvas has presented advancing frames under the smoke's controlled pointer-lock path.

Both readiness measurements are diagnostic until a future evidence set demonstrates a stable cross-platform threshold. They must still be present, finite, and non-negative.

### CSS rule-use collection

CSS rule-use tracking starts separately for every scenario page through the DevTools Protocol. Results are normalized by stylesheet content hash and rule byte range, then unioned across all 29 scenarios and all repeated runs. Generated asset filenames alone are not stable identities.

A rule becomes a deletion candidate only when all of the following agree:

1. the complete coverage union does not use it;
2. source search finds no required dynamic, pseudo-class, reduced-motion, responsive, unsupported-device, or failure-state consumer;
3. focused browser coverage exists for the affected surface;
4. removing it produces a verified artifact-size reduction;
5. the full release gate remains green.

Coverage is evidence of observation, not proof of unreachability.

### Browser resource ownership

Collectors wrap page-owned browser APIs before boot and maintain active inventories:

- animation frames are removed when cancelled or when their callback begins;
- one-shot timeouts are removed when cleared or executed;
- intervals remain active until cleared;
- listeners are keyed by target, type, callback identity, and capture semantics, including once-completion;
- AudioContexts retain construction and current state, and are considered released only when the application has closed or intentionally returned them to its documented inactive state;
- WebGL contexts are associated with their canvas and record explicit context loss.

The harness compares named checkpoints rather than asserting that the page owns zero resources while running. This avoids treating an intentional main loop or persistent application listener as a leak.

The repeated lifecycle sample performs 20 restart cycles and one complete device-gate transition. After each settled transition, active owned resources must return to the applicable baseline. Resource counts must not grow monotonically, superseded WebGL contexts must be lost, and retired audio contexts must not remain running.

## Failure semantics

The measurement command fails for:

- malformed samples, schema drift, missing required fields, or non-finite values;
- existing console, page, first-party resource, or scenario failures;
- collector setup, protocol, aggregation, or serialization errors;
- lifecycle growth beyond the matching baseline;
- a broken hard cadence contract, including the existing capped room-mode Mudwick cadence;
- leaked pages, browser processes, protocol sessions, or preview processes;
- cleanup that requires the runner's forced-kill fallback.

The command does not fail for:

- a slower wall-clock diagnostic in isolation;
- a high unused-CSS percentage without corroborating reachability evidence;
- platform differences that are represented honestly in the report and do not violate deterministic invariants.

All nested ownership uses `try`/`finally`. A primary scenario failure is preserved when cleanup also fails, with cleanup details attached rather than replacing the original cause.

## Evidence-led optimization rules

Production changes begin only after a baseline report identifies a candidate. Candidates are ranked by deterministic gzip recovery, repeated runtime work avoided, confidence of unreachability, regression surface, and testability.

Acceptable changes include:

- deleting stale CSS confirmed unused across source and browser evidence;
- consolidating byte-expensive equivalent declarations or logic when output and behavior remain identical;
- removing unreachable production wrappers or duplicate work;
- closing a measured listener, timer, animation-frame, AudioContext, or WebGL lifecycle leak;
- extracting a small pure helper only when it makes the measured correction independently testable and does not increase shipped cost.

Every candidate receives source search, a test that fails for the relevant contract, pre/post measurement, deterministic size comparison, and the complete invalidated verification set. A change that merely moves bytes between chunks or files without improving the aggregate does not count as recovered capacity.

## Testing strategy

Implementation follows test-driven development.

### Pure contract tests

Unit tests cover:

- report schema acceptance and rejection;
- minimum, median, and maximum aggregation for odd and even sample counts;
- CSS range normalization and union, including overlapping and adjacent ranges;
- ownership baseline comparisons and monotonic-growth detection;
- non-finite, negative, missing, and contradictory metrics;
- deterministic JSON ordering and versioning;
- argument compatibility for ordinary, artifact-only, and measure-only modes.

### Browser harness tests

Focused browser checks prove that collectors observe and release a deliberately scheduled timeout, interval, animation frame, listener, AudioContext where supported, and WebGL context. They also prove collector cleanup after an intentional scenario failure and reject an intentionally leaked resource.

The measured path then runs all 29 production scenarios three times with a fixed seed and viewport. It includes 20 restarts and a complete gate transition, and emits one aggregate report only after all pages and protocol sessions close cleanly.

### Optimization tests

Each production or CSS change begins with the narrowest test that fails before the change. Visual or interaction-sensitive deletions retain or add browser evidence for hover, focus, active, responsive, reduced-motion, error, and unsupported-device states as applicable. Original-resolution captures are inspected when a rule or rendering path can affect presentation.

### Release verification

The completed tranche runs:

1. focused contract and browser tests during development;
2. `npm run measure:browser` before optimization;
3. `npm run measure:browser` after optimization under the same controlled inputs;
4. `npm run verify` on the final tree;
5. `git diff --check` and a clean attribution review.

The stable report-contract tests, lifecycle assertions, cadence checks, and ratcheted size budgets execute locally and in CI through `npm run verify`. The three-run diagnostic command remains explicit and repeatable rather than becoming a wall-clock CI gate.

## Acceptance criteria

This tranche is complete when:

- `npm run measure:browser` builds the standalone artifact, exercises all 29 scenarios three times, and emits a valid normalized JSON report;
- the report includes environment, seed, viewport, resources, readiness, cadence, CSS union, and lifecycle ownership data;
- timing diagnostics report minimum, median, and maximum values without imposing an unsupported universal threshold;
- 20 restarts and a complete gate transition return owned resources to their matching settled baselines;
- old WebGL contexts are lost and retired AudioContexts are not left running;
- room-mode Mudwick cadence remains capped and existing room/PC presentation contracts remain intact;
- JavaScript is no more than 202,752 gzip bytes, leaving at least 2,048 bytes beneath the unchanged 204,800-byte ceiling;
- CSS is no more than 9,600 gzip bytes, leaving at least 512 bytes beneath the unchanged 10,112-byte ceiling;
- no size recovery comes from weakened visuals, accessibility states, scenario coverage, interaction behavior, or progression pacing;
- no collector, generated report, development trace, or measurement dependency appears in the shipped artifact;
- focused tests, all existing browser scenarios, full interaction E2E, standalone and mounted artifact checks, and `npm run verify` pass;
- documentation, scripts, package commands, budget assertions, and shipped behavior agree.

If the target headroom cannot be recovered without violating these constraints, the tranche is not described as capacity-recovered. The implementation records the exact measured blocker and preserves the existing ceilings and quality bar for a separately designed follow-up.

## Delivery boundary

The implementation plan for this specification has three ordered phases:

1. pure measurement contract and unit tests;
2. opt-in browser collectors, managed command, and baseline evidence;
3. evidence-selected optimizations, budget ratchet, complete verification, and documentation reconciliation.

The plan must not preselect production deletions before the baseline measurement phase. Discovering no safe deletion is a valid measurement result, but it does not satisfy the capacity-recovery acceptance criteria.
