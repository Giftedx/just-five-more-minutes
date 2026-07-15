# Away Plan Strip Jeweller's Pass Design

**Date:** 2026-07-15

## Outcome

Make Mudwick's existing standing orders immediately discoverable and legible at native 320x240 resolution, so Monday's new `CRT AWAY PLAN` tutorial points to a control the player can actually identify without guessing.

## Evidence and gap classification

A fresh production capture of `?dev=mmo&speed=0.1` shows four dark slots at the top-right of the world viewport. Their `wrk / eat / run / sel` abbreviations are lower-contrast than every adjacent focal element, the row has no group label, and the all-OFF default makes the controls read as empty decoration. The control works: `MmoRenderer.awayPlanButtons()` owns aligned draw and hit geometry, `MmoGame` toggles the correct `MudwickSim.awayPlan` field, and the simulation behavior is already tested. The missing work is presentation hierarchy, hover/active feedback, and a guard against visual or hit-region regression.

| Claim | Existing path | Classification | Action |
|---|---|---|---|
| Standing-order behavior | `MudwickSim.runAwayPlan()` and depth tests | Already satisfied | Preserve |
| Toggle interaction | `awayPlanButtonAt()` and `MmoGame.handleLeftClick()` | Already satisfied but unguarded | Add mapping and browser guards |
| Group identity | No visible `AWAY PLAN` label | Missing presentation | Add exact caption |
| Labels | `wrk / eat / run / sel` | Missing legibility | Use `WORK / EAT / HOME / SELL` |
| OFF state | Translucent charcoal with muted grey text | Missing hierarchy | Use opaque, contrast-checked period-game colours |
| ON and hover states | Green colour only; no hover treatment | Missing interaction finish | Add shape-backed ON marker and existing-mouse hover edge |

## Approaches considered

### 1. Compact labelled command strip — selected

Keep the controls in one row at the top-right of the 240-pixel world viewport. Add a small `AWAY PLAN` caption above four full-word chips, place the group on an opaque dark-moss plate, strengthen OFF contrast, add a two-pixel active-state bar, and derive hover treatment from `renderer.mouse`. This repairs the confirmed defect without expanding the system.

### 2. Tooltip-only explanation

Show full copy only after the pointer reaches a chip. This preserves the current footprint but requires the player to find an effectively invisible target before receiving help. Rejected.

### 3. Two-by-two settings panel

Give every order a large labelled row and explicit ON/OFF copy. This is clearest in isolation but consumes too much of the 240-pixel world view and gives a lightweight policy control modal-level weight. Rejected.

## Player experience

The top-right overlay reads as one deliberate 2004-era command strip:

- `AWAY PLAN` identifies the system using the exact term from the Monday tutorial.
- `WORK`, `EAT`, `HOME`, and `SELL` replace ambiguous abbreviations while retaining the same order and semantics.
- OFF chips remain visually quieter than the world objective and combat feedback, but their text and border are plainly readable.
- ON chips gain a green fill, bright text, and a solid two-pixel state bar so state does not depend on colour alone.
- Hover adds a parchment edge using the renderer's existing mouse point; no new event or mutable hover field is introduced.
- Clicking anywhere in a chip's drawn rectangle toggles exactly one existing `AwayPlan` boolean and keeps the existing click sound.

The strip remains an overlay. It never changes simulation behavior, defaults, persistence, or the player's current intent.

## Layout and visual language

The strip is confined to a 108x22 rectangle ending one pixel before `VIEW_W = 240`:

- plate: `x = 131`, `y = 1`, `w = 108`, `h = 22`;
- caption baseline: `y = 7`;
- four chips: `24x11`, `2px` gaps, `y = 10`, spanning `x = 135..237` with the right edge exclusive;
- the right edge remains inside the world viewport and never enters the 80-pixel stats panel.

The palette stays inside Mudwick's established dark-moss, parchment, and reward-gold families. Exported colour constants make the opaque text/background pairs directly contrast-testable. The final values must keep caption, OFF label, ON label, and hover label pairs at or above 4.5:1. Canvas image smoothing, dimensions, and font family remain unchanged.

## Architecture

- `src/mmo/render/renderer.ts` owns immutable away-plan copy, palette, layout, draw order, hover derivation, and hit mapping.
- `src/mmo/render/renderer.test.ts` owns exact caption/label order, geometry boundaries, all four hit mappings, and colour contrast.
- `src/mmo/render/game.ts` continues to own click-to-toggle behavior without a new branch or event.
- `scripts/smoke.mjs` owns real production proof at the standalone Mudwick route: visible caption and pixel anchors, native-coordinate clicks, exact field toggles, hover/ON pixel changes, and unchanged canvas/panel boundaries.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` records closure evidence.

## Failure handling and edge cases

- A pointer outside every chip maps to `null`; plate and caption are not clickable.
- Exact left/top edges are inclusive and right/bottom edges are exclusive, matching current hit semantics.
- Hover disappears on the existing `mouseleave` path because `renderer.mouse` becomes `null`.
- All four OFF defaults remain OFF; rendering cannot mutate the plan.
- Disconnect, trade, context menu, side panel, objective banner, chat, XP drops, and Double XP retain their existing draw ownership. The disconnected modal remains last and therefore obscures the strip when the game is offline.
- The browser guard samples opaque authored pixels rather than anti-aliased text alone, so a font rasterization difference cannot create a false failure.

## Constraints

- Add no CSS, DOM node, external asset, font, dependency, timer, event listener, route, query parameter, storage field, simulation state, or audio cue.
- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, `imageSmoothingEnabled = false`, and the existing plan order and meanings.
- Preserve all four defaults as OFF and do not change `AwayPlan`, `Career`, or `MudwickSim.runAwayPlan()`.
- Use the existing renderer mouse point and existing click path; do not add parallel geometry.
- Keep the strip within `x < VIEW_W` and avoid the minimap/stats panel.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes; CSS must remain byte-for-byte unchanged.
- Keep captures and temporary browser state ignored; do not pull, push, or deploy.

## Verification

1. Establish the focused renderer and game baseline.
2. Add failing tests for exact copy, 108x22 bounds, four chip mappings, edge exclusion, and opaque contrast pairs.
3. Add a failing production-browser scenario proving the current strip lacks the caption/full labels and robust state pixels.
4. Implement the minimum shared layout and draw repair, with hit-testing consuming the same exported chip rectangles.
5. Run focused unit tests, typecheck, standalone build, size gate, and the browser scenario.
6. Capture OFF, hover, and mixed ON/OFF states at 1280x720. Reject the result if it obscures meaningful world content, reads like a web settings card, enters the stats panel, or lets state depend on green alone.
7. Red-team renderer ordering, menu/trade/disconnect overlap, all hit boundaries, and any false-pass pixel assertions.
8. Run `npm run verify` in the feature worktree and again after local fast-forward integration.

## Approval

The user has repeatedly granted standing approval to choose and execute bounded quality improvements without routine confirmation. This design stays inside that mandate: one confirmed focal-path presentation defect, no gameplay or persistence change, reversible local commits, and full production-browser proof before integration.
