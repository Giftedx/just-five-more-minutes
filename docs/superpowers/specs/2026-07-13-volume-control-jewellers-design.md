# Volume Control Jeweller's Pass Design

**Date:** 2026-07-13
**Status:** Approved under the standing game-wide jeweller's-pass direction.

## Outcome

Replace the last browser-default-looking persistent gameplay control with a compact, period-authentic audio fader. Preserve the native range input, current volume curve, local persistence, pause availability, report hiding, and all audio behavior.

## Confirmed gap

Fresh 1280 by 720 and 900 by 400 production-browser captures show the volume control beside authored task tickets, clock, dialogue, and pause surfaces. The control works, has a real label, persists through `j5mm-volume`, and remains usable while paused. Its finish does not match those systems:

- the range track and circular thumb are browser-default chrome;
- `VOL` and the track have no level readout or deliberate information hierarchy;
- the black pill has no material detail tying it to the game's 2004 bedroom or Mudwick vocabulary;
- keyboard focus falls back to a raw white rectangle around the native track;
- no browser contract pins visual state, keyboard adjustment, or the compact-viewport bounds.

This is a presentation and guard defect, not an audio-system defect.

## Approaches considered

### 1. Compact period fader — selected

Keep the native horizontal range input, restyle its track and thumb, expose a small exact level readout, and give the control an authored focus-within state. This retains keyboard, pointer, and assistive-technology behavior while making the control read as intentional hardware.

### 2. Speaker icon plus mute button

This would create a clearer zero-volume shortcut, but it adds a new interaction, focus stop, state transition, and persistence question to solve a visual seam. Rejected for scope and contract expansion.

### 3. Vertical dial or rotary knob

A dial would suit bedroom hi-fi hardware, but it fights the bottom-right footprint, is worse at short viewport heights, and would require custom interaction semantics. Rejected.

## Visual direction

The control is a tiny desk-console fader, not another floating notification card.

- Use the existing dark brown glass and warm border family so it belongs beside the dinner clock.
- Keep the visible label terse: `AUDIO` in small tracked utility type.
- Add a two-digit level readout (`60%`, and `OFF` at zero) in muted phosphor gold.
- Render the range as a recessed dark slot with a gold filled segment and small calibration ticks.
- Render the thumb as a compact squared fader cap with a bright top edge and dark lower edge, not a generic circular browser knob.
- Give the entire console a gold focus-within border and restrained outer ring. Suppress the browser-default white rectangle only after the custom state exists.
- Keep the footprint subordinate to the clock, prompts, and reports.

## DOM and state contract

`buildVolumeControl()` continues to create one labelled native `input[type="range"]` with min `0`, max `1`, and step `0.05`.

The wrapper gains:

- a decorative top line containing the linked `AUDIO` label and a `.volume-control-level` output;
- `--volume-level` set to the current percentage for track fill;
- `data-muted="true"` only when the value is zero.

A single local synchronizer updates the audio engine, range value, CSS fill, muted state, and visible output for both initial hydration and later `input` events. Persistence remains inside the input path and remains tolerant of unavailable storage.

The visible output is presentation support, not a second live announcement. The native slider remains the accessible value surface and keeps the explicit accessible name `Volume`.

## Responsive behavior

- At normal desktop sizes the control remains bottom-right and no wider than necessary.
- At 900 by 400 it remains fully inside the viewport and clear of the prompt and dialogue regions.
- Its pointer target is at least 32 pixels high and the range retains a practical horizontal drag width.
- The pause overlay remains pointer-transparent around its action, so the fader stays usable.
- The control remains hidden and inert on nightly and weekly reports.

## Constraints

- Change no synth routing, gain curve, volume default, step, storage key, pause lifecycle, overlay z-index ownership, or report lifecycle.
- Add no mute button, tooltip, animation loop, timer, dependency, asset, audio sample, or global token family.
- Preserve native range keyboard behavior, including arrow-key increments.
- Preserve reduced-motion behavior; the control needs no motion.
- Do not change unrelated HUD, toast, crosshair, interaction, or Mudwick surfaces in this tranche.

## Verification

1. Add an isolated browser scenario first and observe it fail on the missing level output and authored state.
2. Assert the linked label/accessibility contract, exact initial fill/readout, arrow-key change, persisted value, custom keyboard focus, pointer target, and viewport containment.
3. Re-run the existing pause scenario to prove the volume input remains operable while room input is held.
4. Re-run report scenarios to prove the control remains hidden and inert.
5. Capture normal, keyboard-focus, zero-volume, full-volume, pause, and 900 by 400 states in a production browser.
6. Reject the result if the control competes with the clock, resembles a media-player widget, loses native keyboard behavior, or introduces overlap at minimum supported size.
7. Run all unit, type, build, size, isolated-browser, full-E2E, and mounted-build gates before integration.
