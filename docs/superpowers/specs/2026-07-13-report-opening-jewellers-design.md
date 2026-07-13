# Report Opening Jeweller's Pass — Design

**Date:** 2026-07-13

## Problem

The nightly incident report and five-night week verdict are visually authored, semantically modal, and scrollable on short desktops. Their opening behavior is still broken. Both functions focus the final action immediately with plain `.focus()`. At 900×400, Chromium scrolls the nightly report to `scrollTop 184` and the week verdict to `scrollTop 137`, so the player first sees the middle or bottom of the document instead of its heading and context.

The current browser smoke proves that the top and bottom can be reached only after manually moving the scroll container. It does not assert the initial reading position, and it does not cover the week verdict at all.

## Direction

Treat each report as a document before it is an action prompt.

- Make the visible `.sc-title` a programmatic focus target with `tabindex="-1"`.
- After insertion, focus that title with `{ preventScroll: true }`.
- Keep focus inside the modal and begin at the document's accessible name.
- Leave the restart/new-week button as the only control in the normal Tab order; one Tab moves from the heading to the action and scrolls it into view.
- Preserve the ruled-paper layout, grades, stamps, coffee ring, animation, action copy, scoring, persistence, and restart callbacks.

The report already has a specific visual identity. The jeweller's work here is sequencing and reading order, not a reskin.

## Approaches considered

### 1. Focus the report heading — selected

This follows the reading order, keeps the title visible on short screens, gives assistive technology immediate context, and requires no sticky UI or layout rewrite.

### 2. Keep the bottom button focused with `preventScroll`

This would preserve `scrollTop 0` but leave keyboard focus on an offscreen control. A player could press Space or Enter without seeing what is active. Rejected.

### 3. Make the action footer sticky

This would keep the button visible while the report starts at the top, but it would cover ruled-paper content, complicate short-screen geometry, and give the action more visual weight than the verdict. Rejected.

## Interaction and accessibility contract

1. Both report variants retain `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to their visible title.
2. On opening at 900×400, `document.activeElement` is the title and the scorecard scroll position is zero.
3. The title remains visible within the overlay's initial viewport.
4. Pressing Tab focuses the final action and makes it fully visible.
5. Shift+Tab returns focus to the browser boundary rather than creating a fake focus trap; no new modal-trap machinery is introduced for a one-control document.
6. Reduced-motion behavior and existing focus-visible styling on the final action remain unchanged.

## Browser guard

Extend the existing short-screen scorecard scenario to pin initial scroll and title focus for the nightly report. In the same real-browser context, construct a complete five-report week through the live `Game` career state and invoke the shipped verdict path; assert five grades, expected stamps, semantic labelling, initial `scrollTop 0`, title focus, and final-action reachability after Tab.

## Constraints

- Change no score calculation, career data, history, persistence, report copy, verdict matrix, restart behavior, animation timing, or visual geometry.
- Add no dependency, focus-trap library, timer, event listener, or new persistent state.
- Do not spend additional CSS budget unless real browser evidence shows the focused static heading lacks an adequate visible treatment.
- Preserve both standalone and `/just-five-more-minutes/` mounted builds.

## Verification

1. Add browser assertions first and observe both current scroll/focus failures.
2. Apply the smallest shared heading-focus change to both report constructors.
3. Run the browser gate and inspect 900×400 captures for initial and tabbed states.
4. Red-team modal semantics, keyboard order, callback behavior, reduced motion, and short-screen reachability.
5. Run `npm run verify`, merge locally, and rerun the same gate from `master`.

