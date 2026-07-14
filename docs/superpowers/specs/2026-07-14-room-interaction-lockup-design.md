# Room Interaction Lockup Jeweller's Pass Design

**Date:** 2026-07-14
**Status:** Approved under the standing game-wide jeweller's-pass direction.

## Outcome

Turn the first-person room prompt and center reticle into one authored targeting lockup. Preserve all raycast logic, prompt text, object highlighting, input behavior, Mum prompt suppression, PC-mode hiding, and chore state.

## Confirmed gap

Fresh production-browser captures at 1440 by 900 show the room, volume fader, clock, task stack, and Mudwick screen now have deliberate presentation. The remaining first-person interaction affordance does not match that bar:

- the reticle is a five-pixel white dot in every state;
- actionable, passive, and idle targets all share the same center mark;
- the prompt is a generic dark floating pill visually detached from the reticle;
- passive targets only get a weak color and border difference;
- no browser contract pins target-state classing, prompt geometry, PC-mode hiding, or the Mum response suppression behavior.

This is a HUD-state and presentation defect, not an interaction-system defect.

## Gap table

| Claim | Analogous existing path found | Classification | Real action |
| --- | --- | --- | --- |
| The room needs a better interaction affordance | `Hud.setInteractLabel(label, actionable)` already receives idle, actionable, and passive state | Missing feature | Build authored crosshair state and prompt lockup |
| Mudwick contextual menus need this pass next | `src/mmo/render/renderer.ts` already has authored menu structure, semantic colors, bounded geometry, and overflow copy | Already satisfied for this tranche | No code change |
| Toasts need this pass next | `.hud-toast` already has tone states, live-region semantics, and smoke coverage | Already satisfied for this tranche | No code change |
| Mum response prompt conflicts with interact prompt | `Hud.setInteractLabel()` already suppresses the interact prompt while the Mum prompt is open | Missing guard | Add browser assertion that suppression also clears target styling |

## Approaches considered

### 1. Compact target-state lockup - selected

Keep the existing DOM, but let `Hud.setInteractLabel()` set a reticle state. Idle stays quiet. Actionable targets get a small warm focus frame and keyed prompt. Passive targets get a restrained unavailable state that does not imply pressing `E` will work. The prompt and reticle share color language so they read as one instrument.

### 2. Animated target pulse

A pulse would make actionable targets obvious, but it adds motion noise at the exact screen center and competes with the object highlight. Rejected for restraint and reduced-motion simplicity.

### 3. World-space labels or object outlines

Outlines and labels would be stronger object-level feedback, but they expand into Three.js material traversal, occlusion, depth, and performance questions. Rejected as a different, larger feature.

## Visual direction

The lockup should feel like a small, handmade focus mark from the same bedroom-console vocabulary as the clock and fader.

- Idle: a tiny warm pin, visible enough for aim but not visually loud.
- Actionable: four compact brackets around the pin, warm gold edge, and a prompt with the same gold accent.
- Passive: desaturated bracket and muted prompt, clearly readable but not inviting.
- Prompt: slightly tighter, less generic glass; keep the existing `E` keycap treatment for actionable prompts.
- No new visible instructional copy. Existing labels remain the interaction source of truth.

## DOM and state contract

`Hud.setInteractLabel(label, actionable)` remains the only state entry point.

It must:

- hide `.hud-interact` when `label` is null or the Mum response prompt is open;
- remove target state classes whenever the prompt is hidden or suppressed;
- set `.hud-crosshair-target` only for visible actionable prompts;
- set `.hud-crosshair-passive` only for visible passive prompts;
- preserve the existing keycap split for labels shaped like `E - <action>` or the current em-dash live-copy equivalent;
- leave `.hud-crosshair` decorative and hidden by `setCrosshairVisible(false)` in PC mode.

No gameplay system should read these CSS classes. They are view state only.

## Responsive and accessibility behavior

- At 1440 by 900 the prompt sits below center without covering the reticle or task stack.
- At 900 by 400 the prompt remains within the viewport and clear of the bottom-right volume control.
- PC mode hides both the room prompt and reticle.
- Mum response prompt suppresses the room prompt and clears target styling.
- Reduced-motion users see the same static states; this pass adds no animation requirement.
- The decorative crosshair remains outside the accessibility tree. The interaction prompt remains visual HUD copy, not a noisy live announcement.

## Constraints

- Change no raycast distance, interactable set, carried-item behavior, highlight material behavior, prompt text, key binding, pointer-lock behavior, PC-mode transition, Mum timing, or chore state.
- Add no dependency, image asset, SVG asset, animation loop, timer, world-space label, outline pass, or global design-token system.
- Preserve CSS gzip budget by replacing or compacting existing HUD styles rather than adding an oversized block.
- Do not modify Mudwick menus, toasts, volume control, reports, or room geometry in this tranche.

## Verification

1. Add an isolated browser scenario first and observe it fail on missing reticle state.
2. Assert idle, actionable, passive, Mum-prompt suppression, PC-mode hiding, and 900 by 400 containment in Chromium.
3. Capture production-browser proof for idle, actionable mug, passive tray, Mum prompt suppression, PC mode, and short viewport.
4. Reject the result if actionable and passive targets are hard to distinguish, if the reticle becomes decorative clutter, or if the prompt overlaps the fader at the supported short viewport.
5. Run all unit, type, build, size, isolated-browser, full interaction E2E, and mounted-build gates before integration.
