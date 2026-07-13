# Device Gate Jeweller's Pass Design

**Date:** 2026-07-13

## Outcome

Turn the unsupported-device gate from a sentence on black into a first-class *Just Five More Minutes* state. It must explain the failed equipment check immediately, preserve the existing game-lifecycle boundary, and look authored at both narrow desktop and touch-device sizes.

## Evidence and scope

Fresh production captures show that the title, bedroom, Mum encounter, Mudwick screen, and settled scorecard already carry a coherent visual identity. At 800x600, the device gate is only centered Segoe UI text on `#0e0b14`; it has no hierarchy, world-building, recovery cue, or visual relationship to the rest of the game.

This tranche changes only `src/ui/gate.ts`, its CSS, and the existing browser smoke. It does not add mobile gameplay, weaken the 900px/fine-pointer requirements, construct the game behind the gate, or change resize/pointer lifecycle ownership.

## Approaches considered

### 1. Authored equipment-check card — selected

Present the failure as a period-computer equipment check: a small waiting CRT, a reason-specific heading, the existing practical instruction, and a quiet automatic-recovery note. This makes the state memorable without pretending the unsupported device can play.

### 2. Compact playable fallback

Add touch controls or a reduced room. Rejected because it changes input, camera, game balance, testing, and device support rather than polishing the current contract.

### 3. Typography-only cleanup

Improve the existing sentence with a border and larger type. Rejected because it would remain a generic error page and would not meet the game-wide finish bar.

## Visual direction

The subject is a 2004 bedroom computer refusing to pass its own equipment check. The gate's single job is to tell the player what is missing and what will happen when it is fixed.

### Palette

- Night phosphor `#0e0b14` — full-screen stage.
- Ink brown `#17110c` — card and CRT surround.
- Lamp gold `#e8c33f` — failed-check hierarchy.
- Phosphor green `#9be86b` — waiting CRT status.
- Paper cream `#efe6cf` — readable instructions.
- Hall rust `#8d4938` — domestic accent and failed indicator.

### Type

- RuneScape is used only for the gate title and CRT status.
- Segoe UI carries the practical instruction.
- Courier New carries the equipment-check eyebrow and recovery note.

### Layout

At 640px and wider, a bounded incident card pairs the CSS CRT with the explanation. Below 640px it stacks into one column, reduces the CRT, and keeps every element within the viewport without scrolling.

```text
┌──────────────────────────────────────────────────────────┐
│ EQUIPMENT CHECK · WINDOW                         FAILED  │
│ ┌──────────── CRT ────────────┐  Not enough desk space. │
│ │       MUDWICK WAITING       │  Widen this window...   │
│ │          tiny goblin        │  Starts automatically.  │
│ └─────────────────────────────┘                          │
└──────────────────────────────────────────────────────────┘
```

### Signature

The memorable element is a tiny waiting CRT whose scanlines, status text, goblin face, stand, and green LED are built from CSS. It is deliberately a static equipment-check illustration, not another animation loop.

## Content and semantics

Both states retain `role="alert"` and `data-reason`.

- Viewport eyebrow: `EQUIPMENT CHECK · WINDOW`
- Viewport title: `Not enough desk space.`
- Viewport instruction: `Mudwick needs a little more desk space. Widen this window to at least 900 pixels.`
- Pointer eyebrow: `EQUIPMENT CHECK · POINTER`
- Pointer title: `Mouse and keyboard required.`
- Pointer instruction: `This one needs a keyboard, a mouse, and a chair you refuse to leave.`
- Shared recovery note: `The evening starts automatically when this check passes.`

The CSS CRT is `aria-hidden="true"`; the reason title and instruction are real text. There is no fake button because recovery is automatic.

## Architecture

- `src/ui/gate.ts` owns a typed content record and creates the stable semantic DOM for the current reason.
- `src/ui/style.css` owns the responsive composition and CSS illustration.
- `scripts/smoke.mjs` proves reason-specific content, semantics, bounded geometry, no game construction while blocked, and automatic game construction after the viewport becomes supported.

The existing `deviceBlockReason()` precedence remains pointer first, then viewport. `installGate()` keeps its listeners, reason transition callback, disposal behavior, and single gate node.

## Motion and accessibility

- Add no timer, RAF, canvas, video, or dependency.
- Use no essential animation. The CRT scanlines are static, so reduced motion needs no alternate state.
- Maintain sufficient contrast for title, body, and utility text.
- The card is non-interactive and must not create a tab stop.
- At 800x600 and 360x640, the card must fit inside the viewport with at least 16px outer clearance.

## Verification

1. Extend the existing viewport and pointer browser scenarios first; observe failure because the authored gate structure does not exist.
2. Implement the typed content and semantic DOM, then the CSS composition.
3. Verify the gate has one alert, correct reason-specific copy, an `aria-hidden` visual, no game/canvas while blocked, and bounded geometry.
4. Resize the 800px viewport to 1000px and retain the existing proof that the gate disappears and exactly one game canvas starts.
5. Capture 800x600 and a touch-style narrow state in Chromium and reject the design if it resembles a generic marketing card, clips, scrolls, or implies touch support.
6. Run the complete `npm run verify` gate and keep mounted-build evidence separate from any live-deployment claim.

