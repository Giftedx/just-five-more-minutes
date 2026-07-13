# Pause Overlay Jeweller's Pass — Design

**Date:** 2026-07-13

## Problem

The pause lifecycle is mechanically sound: room play freezes before the first pointer lock and whenever that lock is lost, PC mode remains unaffected, and the volume control stays available. The presentation is not. A single floating button sits over a translucent collision between the exiting title and the bedroom, keyboard focus remains on the disappearing title control, and there is no semantic heading or distinction between first-time mouse capture and a returning pause.

That is prototype-grade recovery UI in one of the first interactions a desktop player can see.

## Direction

Turn the overlay into a compact **room input hold** panel. It should feel like an intentional interruption from this game's room layer, not a generic settings modal or a decorative VFX interstitial.

- A near-opaque stage suppresses the title/bedroom double exposure immediately.
- A bordered, left-aligned panel establishes a clear eyebrow, headline, explanation, and action hierarchy.
- First capture uses `ROOM MODE · INPUT CHECK` / `Ready when you are.` / `The room is paused until it has your mouse.` / `Click to start looking`.
- Returning pause uses `ROOM MODE · PAUSED` / `The room is holding still.` / `Dinner and Mudwick are frozen until you return.` / `Resume looking`.
- The action receives focus as soon as the overlay appears.
- The overlay is a labelled `dialog`, but deliberately not `aria-modal`: the volume control remains visible and operable.

The palette and type reuse the room/title language already shipped. No looping motion, blur spectacle, or new asset is justified; the visual signature comes from severe staging, the amber room label, the large display headline, and a small pause-mark detail.

## Interaction contract

1. The existing pause predicate remains authoritative.
2. When a visible room pause begins, create one overlay and one focusable recovery action.
3. Preserve the existing pointer-lock request on activation.
4. Update the panel's copy from `hadPointerLock`; do not recreate it on every sync.
5. Keep overlay and panel surfaces pointer-transparent except for the action so the existing volume affordance remains live.
6. Remove the overlay when the room resumes, PC mode takes over, the document hides, or play otherwise stops showing a visible pause.
7. Do not introduce autofocus markup or a modal focus trap. Programmatic focus with `preventScroll` is enough for this transient recovery surface.

## Responsive and accessibility requirements

- The panel keeps at least 16 px clearance at 1000×700 and 900×400.
- Copy wraps without clipping or horizontal scroll.
- The dialog's `aria-labelledby` resolves to its visible headline.
- The focused action has a strong visible outline and an adequate target.
- Reduced-motion users receive no new animation.
- The volume control remains visible, non-inert, and clickable while paused.

## Rejected approaches

- **More translucent blur and scanlines:** dresses up the collision instead of resolving it, weakens text clarity, and wastes the remaining CSS budget.
- **Delay the overlay until the title transition ends:** withholds the only recovery action after a rejected pointer-lock request.
- **Declare a modal and trap focus:** semantically false while volume remains intentionally interactive.
- **Refactor pause state or pointer-lock policy:** enlarges risk without addressing the confirmed quality defect.

## Verification

- Extend the existing rejected-pointer-lock browser smoke before implementation.
- Assert semantic naming, focused recovery action, exact first/return copy, live volume control, and bounded panel geometry.
- Capture real browser evidence at desktop and short landscape sizes.
- Run unit tests, build, size gate, browser smoke, hub build, and the repository's strongest full verification gate.

