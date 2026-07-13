# Household Pressure Stack Jeweller's Design

**Date:** 2026-07-13

## Outcome

Keep every live household obligation readable when the game reaches its densest supported short-screen state. Preserve the authored desktop objective, sticky-note chores, clock, Mum prompt, and doorway subtitle while replacing the crude Mum debug strip with a compact tier ticket that belongs to the same domestic stationery system.

## Subject, audience, and job

The subject is the player's competing household obligations during a five-minute school-night session. The audience is a desktop player who must decide what Mum wants while the Mudwick objective and dinner clock continue to compete for attention. The top-left HUD has one job: show every outstanding household commitment without covering the response controls.

## Confirmed defect

At 900x400 on Thursday, a seeded session at 179 seconds with maximum Mum suspicion produces three active chore notes and the inspection prompt. The prompt begins over the vertical task stack, covering the lower chores and completely burying `MUM: AT THE DOOR`. The existing browser smoke checks only the first chore during an early one-chore prompt, so it falsely passes the actual maximum-pressure state.

The Mum tier itself is a meaningful four-state system (`unbothered`, `curious`, `onto you`, `at the door`) that affects dialogue, scoring, inspections, carried suspicion, and Friday endings. The current UI reduces it to one small square text strip with a colored left border. It reads like debug telemetry beside the authored sticky notes and has no semantic or browser contract.

## Evidence and gap classification

| Surface | Existing authored path | Classification | Action |
|---|---|---|---|
| Title, bedroom, Mum doorway, PC mode, gate, pause, nightly report, week verdict | Current production captures and browser guards | Already satisfied | Preserve |
| One-chore prompt layout | Existing `dialogue staging` smoke geometry | Already satisfied but incomplete | Preserve and extend |
| Three-chore inspection at 900x400 | No maximum-pressure coverage; overlap reproduced in Chromium | Missing guard and responsive layout | Build short-height household tray |
| Mum suspicion status | Four gameplay tiers; flat text strip only | Missing finish and guard | Build semantic tier ticket |
| Chromium screenshot GPU messages | `ReadPixels` driver diagnostics during capture | Harness noise | No product change |

## Approaches considered

### 1. Responsive household tray — selected

Keep the established desktop stack. At heights up to 520 pixels, place the objective on the first row and reflow the chores plus Mum status into one compact horizontal tray below it. This uses the existing materials, preserves all information, and repairs the collision without disturbing the authored prompt stage.

### 2. Shrink the vertical stack

Reduce note padding, type, and gaps until all elements fit above the prompt. Rejected because it makes handwriting harder to read, remains fragile to copy length, and turns a hierarchy problem into a legibility problem.

### 3. Move the prompt or hide obligations

Move the response card to another quadrant or suppress chores while Mum speaks. Rejected because the prompt and doorway subtitle already frame Mum correctly, and hiding the chores at the exact decision moment removes information the player needs.

## Visual direction

### Palette

- Objective gold `#e8c33f` remains Mudwick's live-goal accent.
- Note yellow `#f0e060`, mint `#8fdca6`, and pink `#f0a8b6` remain the three chore identities.
- Paper cream `#efe6cf` and ink brown `#3b251d` define the Mum ticket.
- Hall terracotta `#d89678` warms the escalation rail.
- Warning rust `#c05030` marks the final tier without adding a new global color family.

### Type

- `Segoe Print` remains chore handwriting.
- `Courier New` remains the compact status/data voice.
- `Segoe UI` remains readable interaction copy.

### Layout

Normal desktop heights keep the current vertical composition:

```text
OBJECTIVE

[Mugs]
[Wrappers]
[Laundry]

[MUM / state / tier rail]
```

At `max-height: 520px`, the task stack becomes two rows:

```text
OBJECTIVE
[Mugs] [Wrappers] [Laundry]  [MUM / state / rail]

                         >= 8px clear
MUM RESPONSE PROMPT
```

The compact row may reduce note padding and rotation, but it must not truncate text, remove tape, hide a chore, or cross the clock's reserved right edge.

### Signature

Mum's status becomes a small household-pressure ticket: a quiet paper/ink module containing the `MUM` label, the exact current state, and four restrained escalation marks. The deliberate risk is making a system state feel like physical household paperwork rather than another videogame meter. It must stay subordinate to the objective and response prompt.

## Structure and accessibility

`Hud.setMumStatus()` continues to receive only a label and tier. It renders:

- a visible `MUM` label;
- a visible state label;
- four decorative rail segments;
- `role="status"`, `aria-live="polite"`, and `aria-atomic="true"` on the ticket;
- an accessible label of `Mum: <state>`.

The decorative rail is `aria-hidden`. No numeric suspicion value is exposed because the player-facing contract is the named tier, not internal score telemetry.

## Responsive behavior

- Desktop layout and note rotations remain unchanged above 520 pixels high.
- Short-height layout uses one horizontal chore row below the objective.
- The full task stack stays inside the viewport and clear of the clock.
- In the maximum-pressure Thursday state, every chore and the Mum ticket stay fully visible and at least 8 pixels above the response prompt.
- The right-side doorway subtitle and bottom-right volume control remain untouched.
- Reduced motion disables the final-tier pulse and retains a static warning treatment.

## Architecture

- `src/ui/hud.ts` owns the semantic Mum ticket structure and continues to update it from the existing tier contract.
- `src/ui/style.css` owns the ticket treatment and short-height task-grid reflow.
- `scripts/smoke.mjs` extends the existing dialogue scenario with a fresh Thursday maximum-pressure browser context. It owns geometry, semantics, tier rendering, and reduced-motion guards.
- No gameplay, director, scoring, persistence, Three.js, or Mudwick renderer code changes.

## Constraints

- Add no dependency, asset, font, timer, event listener, persistent field, gameplay state, or new animation.
- Preserve the existing objective copy, chore copy, tier labels, dialogue copy, response options, clock, toast, subtitle, and volume behavior.
- Do not hide, collapse, summarize, truncate, or reorder active chores.
- Do not move the prompt or doorway subtitle to solve a top-left layout problem.
- Do not expose raw suspicion numbers.
- Do not update curated README screenshots in this tranche.

## Verification

1. Extend the browser smoke first with a Thursday `night=3`, `t=179`, 900x400 maximum-pressure state and observe the current chore/status overlap failure.
2. Assert three visible chores, tier `3`, exact `AT THE DOOR` state, four rail segments, live-region semantics, viewport containment, and at least an 8-pixel prompt gap.
3. Add a reduced-motion context and assert the final tier has no running animation.
4. Implement the smallest semantic ticket and short-height reflow.
5. Run the focused browser gate and capture normal 1280x720 plus pressure-state 900x400 images.
6. Reject the candidate if the objective becomes wider, note text truncates, tape disappears, the ticket looks like a generic health bar, the row approaches the clock, or the prompt/subtitle composition shifts.
7. Run all unit tests, type/build, size budgets, all isolated browser scenarios, full interaction E2E, and the mounted hub build.
8. Preserve deployment truth: a local mounted build is not a live deployment claim.
