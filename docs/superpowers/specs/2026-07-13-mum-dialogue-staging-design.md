# Mum Dialogue Staging Design

**Date:** 2026-07-13

## Outcome

Make Mum's interruptions read as an authored encounter between the player and a visible character. Preserve the existing procedural Mum, doorway animation, dialogue choices, and domestic-comedy visual language while preventing the HUD from covering the character it is presenting.

## Confirmed problem

Fresh 1280x720 production renders show that the room, Mum model, title, Mudwick screen, and incident report already have distinct and coherent visual identities. The dialogue composition is the remaining failure:

- The response card is centered directly over Mum's torso.
- The full-width subtitle occupies the same central doorway lane.
- The player sees a face floating above UI instead of the authored cardigan, crossed arms, tea towel, skirt, and idle animation.
- The initial objective can leave a short reward such as `22gp` stranded on its own line.
- Every page load requests a missing `/favicon.ico`, producing a console-visible 404.

The character system is not missing. The presentation is hiding it.

## Goals

- Keep Mum's upper body unobscured when the player looks toward the open doorway during a prompt.
- Preserve all four response choices, countdown feedback, keyboard shortcuts, focus treatment, subtitle text, toast behavior, and supported 900px desktop floor.
- Give the prompt, character, and spoken line distinct visual lanes without making the UI feel detached from the room.
- Balance long objective copy so a reward does not become a weak orphan line.
- Start without avoidable failed resource requests.
- Add browser-level composition guards that would fail on the current centered stack.

## Non-goals

- Rebuilding or replacing the procedural Mum model.
- Taking control of the camera, changing pointer-lock behavior, or forcing the player to face the doorway.
- Changing dialogue timing, scoring, suspicion, response semantics, audio, or room interaction.
- Adding image files, external fonts, dependencies, post-processing, or new WebGL work.
- Redesigning the title, Mudwick, scorecard, or general room dressing.

## Approaches considered

### 1. Asymmetric staged lower third — selected

Turn the dialogue lane into a two-column stage at supported desktop widths. Place the response dossier on the lower left and Mum's line on the lower right. Toasts span the upper row. The open center keeps the doorway character legible, while the subtitle remains visually associated with Mum.

This approach changes only layout and preserves the existing DOM, behavior, focus order, and runtime contracts.

### 2. Left-rail response card

Move only the response card to the left and leave the subtitle centered. This exposes more of Mum than the current stack but still puts a wide opaque strip over the doorway and produces an unbalanced composition. Rejected as an incomplete fix.

### 3. Directed dialogue camera

Rotate or ease the camera toward Mum whenever she speaks. This could guarantee a dramatic view, but it would steal control, create motion-discomfort risk, complicate pointer lock, and change gameplay rather than presentation. Rejected.

## Visual direction

The visual system remains specific to the bedroom rather than becoming a generic game dialogue box.

- **Ink:** `#0e0a06` for the translucent household dossier.
- **Lamp gold:** `#e8c33f` for response urgency and keyboard affordances.
- **Paper cream:** `#f5edd8` for Mum's spoken line.
- **Cardigan rose:** `#a86878` remains the character focal colour.
- **Phosphor green:** `#8aff96` remains reserved for the dinner clock and Mudwick.
- **Interaction type:** Segoe UI for readable choices.
- **Household utility type:** Consolas/Courier for labels, timer language, and objective metadata.

The signature composition is triangular:

```text
┌ objective                                  dinner clock ┐
│                                                          │
│                         MUM                              │
│                    open doorway                          │
│                                                          │
│  ┌ response dossier ┐       ┌ Mum's spoken line ─────┐  │
│  │ 1–4 choices      │       │ lower-right caption    │  │
│  └──────────────────┘       └─────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

The memorable risk is asymmetry: the controls no longer sit safely in the generic center. That risk is justified because it turns the existing character into the scene's focal point.

## Layout and behavior

- `.hud-dialogue-stack` becomes a bounded two-column grid across the lower viewport.
- The prompt owns the left column, the subtitle owns the right column, and toasts span both columns above them.
- Columns have fixed minimums that remain viable at 900x600 and bounded maximums that avoid excessively wide copy at 1280x720 and above.
- The prompt stays fully visible and interactive; DOM order and keyboard order do not change.
- The subtitle may overlap Mum's lower legs at short heights, but it must not overlap the projected upper-body region.
- Existing reduced-motion behavior remains unchanged.
- The objective uses balanced wrapping and a slightly wider cap while remaining clear of the clock.
- `index.html` declares a percent-encoded inline SVG favicon. It must not introduce an asset request or external dependency.

## Browser contract

The dialogue smoke scenario will stage a real prompt, face the existing player camera toward the doorway, and inspect the rendered geometry at 900x600 and 1280x720.

It must prove:

- The prompt is left of the viewport's central character lane.
- The subtitle is in the right lower-third lane.
- Prompt and subtitle do not overlap each other.
- Neither panel intersects Mum's projected upper-body rectangle.
- The four choices remain visible, focusable, and keyboard-treated.
- Toasts remain separated from the response controls.
- The objective uses balanced wrapping and does not leave a tiny reward-only final line in the representative long-copy state.
- A favicon declaration exists as an inline data URL and a clean page load produces no failed favicon response.

## Performance and disposal

This is a DOM/CSS and document-head change. It creates no geometry, texture, material, light, animation loop, listener, or persistent object. Existing WebGL calls, triangles, and texture counts must remain unchanged. No new disposal path is required.

## Success criteria

- Fresh 1280x720 and 900x600 captures show Mum's face, torso, crossed-arm pose, and doorway silhouette unobscured during the response window.
- The existing full unit, build, size, browser smoke, interaction E2E, and mounted-build gates pass.
- Browser console and failed-resource inspection are clean apart from the known headless pointer-lock policy warning.
- No gameplay, input, timing, score, or rendering-budget regression is introduced.

## Explicit non-claim

This pass fixes the most obvious dialogue-composition defect. It does not make the entire procedural game literally equivalent to a large studio's authored asset pipeline, animation team, device lab, or shipped production build.
