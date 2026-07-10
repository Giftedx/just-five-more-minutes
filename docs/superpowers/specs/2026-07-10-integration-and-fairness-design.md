# Integration and Fairness Enhancement Design

Status: autonomously approved by the hands-off product brief on 2026-07-10.

## Goal

Make the existing five-minute game feel fairer, more reactive, more replayable, and more robust without diluting its two-world comedy or adding another large subsystem. The pass should turn systems that already exist—contracts, skills, streaks, chores, prompts, scoring, procedural presentation—into one coherent session whose ordinary achievements are visible and whose absurd max-stack/99-all goals remain legendary jokes.

## Constraints

- Preserve the five-minute session, director timing invariants, physical chore loop, and room/PC split.
- Keep max stack and 99-all-stats as deliberately absurd stretch goals.
- Keep all art and audio runtime-generated; add no external asset or service dependency.
- Preserve the existing user-owned input changes in `README.md`, `src/host/app.ts`, `src/host/input.ts`, and `src/host/input.test.ts`.
- Keep the implementation static, local-only, and privacy-preserving.
- Prefer additions to existing modules over a new framework or generalized engine.

## Gap Classification

| Claim | Existing analogous path | Classification | Real action |
|---|---|---|---|
| Five-minute director and prompt-safe pacing | `src/director/director.ts` plus timing tests | Already satisfied | Preserve |
| Combat, gathering, trade, skills, streaks, and Wyn contracts | `src/mmo/sim/sim.ts` | Already satisfied | Integrate into scoring/reporting |
| Reachable five-minute MMO success | Max stack and 99 all stats require orders of magnitude more progress than roughly 500 ticks permit | Missing feature | Add a 100 gp dinner-fund milestone and score ordinary mastery |
| Report reflects actual MMO play | `SimStats` tracks kills, sales, and streaks, but `SessionData` drops them | Missing feature | Carry session statistics into score and report |
| Replays vary but remain reproducible | `MudwickSim` always defaults to `0xc0ffee` | Missing feature | Random production seeds, explicit `?seed=` override, report seed |
| Restart gives comparative motivation | Scorecard only restarts | Missing feature | Local run count, previous-score delta, personal best |
| Chore targeting is forgiving | Center raycast exists, but the flattened desk wrapper now misses the old full-loop aim point | Missing feature | Invisible interaction proxy for tiny props |
| Initial pointer-lock failure is recoverable | Post-lock pause overlay exists | Missing feature | Freeze before first lock and show a recovery action |
| Dialogue cannot overlap | Interact prompt already yields its lane to Mum prompts | Missing feature | Shared prompt/subtitle stack |
| Accessibility and motion preferences are guarded | Native buttons and partial reduced-motion CSS exist | Missing guard | Labels, live regions, dialog focus, full reduced-motion behavior |
| Restart releases browser resources | `dispose()` frees Three resources but not the WebGL context | Missing guard | Explicit context loss and regression smoke |
| Blocked devices do no hidden work | Mobile gate overlays an already-running game | Missing feature | Defer game construction until supported |
| Off-screen and ended states avoid wasted frames | MMO canvas renders every host frame; the ended game keeps scheduling RAF callbacks | Missing feature | Render the room-monitor MMO at 10 fps and stop the ended loop |
| Browser and mounted builds are release gates | Browser scripts and `build:hub` exist but CI does not run them | Missing guard | Managed browser runner plus CI/package scripts |

## Chosen Approach

Use an integration-and-fairness pass. A polish-only pass would leave the MMO progression disconnected from the five-minute format. A content-expansion pass would add complexity before the shipped systems pay off. This design makes the current content matter, then closes the concrete browser and accessibility defects exposed during exploration.

## Progression and Scoring

Add `SESSION_COIN_TARGET = 100` as the achievable dinner-fund milestone. `MAX_COINS` and level 99 remain unchanged and remain visible as legendary goals.

`SimStats` gains `contractsCompleted`. The end-session data also carries kills, logs sold, flax sold, best streak, completed contracts, and final skill XP. The MMO category remains 0–40 and becomes integer-valued:

- Economy: 0–20, linear progress from 0 to 100 gp.
- Training: 0–6, one point per level gained above the three starting level-1 skills.
- Contracts: 0–8, four points per completed Wyn contract.
- Combat streak: 0–4, one point per best-streak kill.
- Legendary stretch: one point for max stack and one for 99 all stats.
- Deaths: minus five each.
- Clamp the result to 0–40.

This makes a strong ordinary run worth up to 38 MMO points while reserving the final two points for the absurd headline goals. Category values are rounded before total calculation so the displayed rows always sum to the displayed total.

The HUD leads with the dinner fund and current Wyn contract. Max stack and 99-all remain visible in Mudwick/title presentation as legendary ambitions rather than masquerading as realistic five-minute objectives.

The ending matrix keeps the current legendary titles, then adds reachable branches for dinner fund plus chores, dinner fund alone, repeated contract work, household completion, and combat-focused play. Existing comedy facts remain; report copy that currently equates ordinary success with max stack is updated to distinguish the session milestone from the legendary cap.

## Replay and Local History

When no explicit seed is supplied, each `Game` instance creates a fresh unsigned 32-bit seed and passes it to the MMO. `?seed=N` locks a reproducible run for development and bug reports. Restart creates a new seed in normal play and repeats the locked seed in seeded play. The scorecard shows the seed in compact hexadecimal form.

A small pure history module stores only schema version, completed-run count, personal best, and previous total in `localStorage`. It stores no timestamps, identity, analytics, or full play history. Invalid or unavailable storage fails closed without blocking a scorecard. The report displays run number, personal best/new-best state, and delta from the previous report.

## Cross-World Feedback

Reuse existing HUD toasts for rare, meaningful bridges between Mudwick and the bedroom:

- A death while away immediately reports that the avatar died unsupervised.
- A contract completion reports the reward when it matters outside the MMO renderer.
- Completing a chore while in combat or critically low on health gets distinct copy.

Feedback is event-driven and rate-limited by the events themselves. It does not replace director subtitles or open new response prompts.

## Input, Gate, and Lifecycle

The first room session requires pointer lock unless `skipTitle=1` is used for automation/dev. Until lock succeeds, director time, MMO time, and the countdown remain frozen and a visible “Click to start looking” action is available. Later lock loss uses the same overlay with pause copy. Title completion resolves immediately on the activating input so the browser receives the lock request inside user activation; the exit animation may continue visually.

The device gate reports pointer capability and viewport size separately. Main-game construction is deferred while the initial device state is blocked; becoming supported starts exactly one game. Pointer media-query changes and resize both resynchronise the gate.

Tiny chore props receive invisible raycast proxies that do not render and do not alter their visible geometry. This fixes the currently failing wrapper path while improving human targeting rather than merely changing a test coordinate.

Disposal explicitly releases the WebGL context after freeing scene resources. Restart also refreshes the development `window.__game` handle so repeated-run diagnostics address the live instance. The title’s delayed first knock is cancelled when the title is dismissed.

The MMO simulation still advances at its fixed tick rate while the player is in Room Mode, but its off-screen canvas renders only when the 3D monitor texture is due for its 10 fps refresh. PC Mode continues to render at display-frame rate. Once the incident report is visible, the main animation loop stops until restart creates a new game.

## HUD, Accessibility, and Motion

Mum’s response card and subtitle move into one centered flex stack with a fixed gap so they cannot overlap at supported short viewports. Existing interaction-pill suppression remains.

### Visual direction

The subject is a desktop player juggling a 2004 mini-MMO and a very physical household deadline; the screen’s single job is to make that divided attention legible without sanding away the joke. Preserve the existing two-material identity: Mudwick uses phosphor green, coin gold, dark glass, the RuneScape display face, and compact utility sans; Mum and the scorecard use warm paper, rust-red stamps, handwriting/monospace details, and restrained household stationery.

- Ink black `#0a0a10`, lamp wall `#a87c54`, CRT green `#4a8f3c`, coin gold `#e8c33f`, report paper `#efe6cf`, and filed red `#a03028` remain the core palette.
- RuneScape is reserved for the game/logo voice, Segoe UI for readable controls/HUD, Georgia for Mum’s quoted voice, and Courier New for the incident report.
- Layout signature: one view, two competing material systems. The responsive dialogue stack belongs to the household layer; the dinner-fund/contract panel belongs to the CRT layer.
- The one new aesthetic risk is the career comparison strip on the report: it should read like a stamped filing annotation, not a dashboard stat card.

This direction deliberately rejects a generic progress-dashboard redesign. New hierarchy comes from the game’s existing artifacts and vocabulary, not gradients, glass cards, or ornamental metrics that could belong to any game.

- The volume slider receives a real label, persists locally, and is hidden on the modal scorecard.
- Subtitle/toast/prompt regions receive deliberate status/live-region semantics without per-frame announcements.
- The scorecard is a labelled modal dialog and focuses its restart button.
- The pause action is a real button.
- The device gate has alert/status semantics and actionable, reason-specific copy.
- Page metadata gains a description, theme color, and supported color-scheme declaration.

Under `prefers-reduced-motion: reduce`, CSS animations/transitions, CRT flicker, late-clock pulsing, scorecard entrance, title parallax/knock cycling, and interaction-highlight pulsing stop. The title CRT renders a static frame rather than disappearing. The preference is evaluated at construction/reload; live preference changes are not required for this pass.

## Error Handling

- Storage reads/writes are parsed and validated; failure leaves history unavailable but gameplay intact.
- Random seed generation uses Web Crypto when available and a bounded fallback otherwise.
- Pointer-lock rejection leaves the game frozen with the recovery action visible.
- Device capability changes cannot create duplicate game instances.
- Context-loss cleanup runs only during disposal and tolerates an already-lost context.

## Verification

Implementation follows test-first workstreams:

1. Unit tests for contracts, streak accounting, expanded session data, integer scoring, ending branches, and local-history corruption/failure cases.
2. The existing full-loop Playwright script remains the failing regression for the tiny-wrapper raycast and must pass without weakening its real raycast path.
3. Browser smoke adds checks for forced first pointer-lock rejection (clock frozen and recovery shown), blocked-device deferred boot, dialogue separation at 900×600, scorecard focus/semantics, reduced-motion state, off-screen render cadence, stopped ended-loop RAF, and rapid repeated restarts without “Too many active WebGL contexts.”
4. A managed browser runner owns preview startup/readiness/shutdown. Package scripts expose it, and CI installs Chromium, runs the standalone and mounted builds, then runs the browser gate.
5. A deterministic compressed-size check gives the current JavaScript/CSS output realistic headroom and fails accidental bundle growth.
6. Full `npm test`, `npm run build`, `npm run build:hub`, the managed browser gate, the size check, and `git diff --check` run after the final mutation.
7. Fresh screenshots verify the title, room HUD, prompt stack, PC mode, and expanded scorecard. Curated README screenshots are updated only when the new captures are stable and representative.

## Out of Scope

- Touch controls or a mobile game redesign.
- New maps, chores, NPCs, combat types, external assets, backend services, accounts, analytics, or cloud saves.
- Refactoring the large renderer/room/CSS files solely for size.
- Changing the five-minute director schedule or physical one-item carry rule.
