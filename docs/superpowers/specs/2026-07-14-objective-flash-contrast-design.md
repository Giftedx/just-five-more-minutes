# Objective Flash Contrast Design

**Date:** 2026-07-14

## Outcome

Keep the objective-completion flash celebratory while making its small OBJECTIVE eyebrow readable throughout the animation. Reconcile the game-wide jeweller's program with the Mudwick work that is already shipped instead of reopening completed sprite systems.

## Evidence and gap classification

| Claim | Existing path | Classification | Real action |
|---|---|---|---|
| The objective body remains readable during its gold flash | The hudflash keyframes animate the body to dark #1a1408 on gold #e8c33f | Already satisfied | Preserve |
| The OBJECTIVE eyebrow remains readable during the flash | The objective pseudo-element fixes the eyebrow at muted #b8954a, only 1.66:1 against the gold phase | Confirmed defect | Make the eyebrow follow the animated body colour with restrained opacity |
| Mudwick faces, weapons, hobgoblins, and hearts still need implementation | Commits 719d385, 4c44aab, 249da15, 4f93ee3, and 2bb4fc1; current sprite tests and renderer paths | Stale documentation | Record the shipped state and preserve it |
| Another global HUD reskin is needed | Fresh production captures show authored title, Mum, chores, pressure, PC mode, and responsive states | Already satisfied | None |

Baseline evidence is 18 test files / 208 tests passing and a 41,717-byte CSS artifact at 10,078 gzip bytes against the 10,112-byte ceiling.

## Approaches considered

### 1. Inherit the animated colour with muted opacity — selected

Replace the eyebrow's fixed colour with currentColor and opacity 0.65. The pseudo-element then follows both existing hudflash colour endpoints without duplicating animation timing. At the gold endpoint, the composited eyebrow clears 4.5:1; in the normal dark panel it remains subordinate to the objective body while clearing 6.8:1.

### 2. Add an eyebrow-only keyframe

Animate the pseudo-element from a dark brown back to its normal muted gold. This permits independent colour tuning but duplicates the 0.9-second/two-iteration timing, creates another cascade seam, and spends more of the tight CSS budget. Rejected.

### 3. Darken or remove the gold flash

Reduce the background change until the fixed eyebrow passes. This repairs contrast by weakening a useful progress cue and changes a larger visual area. Rejected.

## Visual and interaction design

The objective remains Mudwick's dark-glass information card with coin gold as its signal colour. The completion flash keeps its current gold field, dark body text, duration, easing, and two iterations. Only the eyebrow's colour source changes: it inherits the card's animated foreground and renders at 65% opacity.

This uses hierarchy rather than a new colour. The body stays primary; the label stays quieter; both reverse together when the card flashes. No new animation, decoration, layout, copy, or interaction is introduced.

## Architecture

- src/ui/style.css owns the single production change.
- scripts/smoke.mjs owns the browser contract for the pseudo-element's inherited colour, opacity, and rendered flash contrast.
- docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md records the completed Mudwick tranche and this objective-state closure.
- docs/superpowers/plans/2026-07-13-mudwick-jewellers-pass.md receives a status note linking the shipped commits and current verification; its historical execution steps remain intact.

## Constraints

- Preserve hudflash duration, easing, iteration count, background endpoints, body colours, panel geometry, and responsive rules.
- Do not raise the CSS or JavaScript artifact budgets.
- Add no dependency, asset, runtime state, timer, event listener, or JavaScript animation.
- Preserve normal-state hierarchy and reduced-motion behaviour.
- Do not change Mudwick sprites, renderer behaviour, simulation, input, audio, bedroom, Mum, title, scorecard, or deployment state.

## Verification

1. Add a browser assertion first and observe failure because the eyebrow has a fixed colour and opacity 1.
2. Freeze the real objective card at the gold flash endpoint, read the objective and pseudo-element computed styles, alpha-composite the pseudo-element foreground over its background, and require at least 4.5:1 contrast.
3. Require the pseudo-element's computed colour to match the objective's computed colour and its opacity to equal 0.65.
4. Apply the one-declaration CSS repair, rerun the focused browser scenario, and recapture the 1280 by 720 objective-flash frame.
5. Confirm the CSS artifact remains at or below 10,112 gzip bytes.
6. Run the complete npm run verify gate before and after local integration.
7. Treat the mounted build as local build evidence only; do not push or deploy.
