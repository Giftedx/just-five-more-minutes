# Bedroom Shell Material Jeweller's Pass Design

**Date:** 2026-07-14
**Status:** Approved under the standing visual graphic-design improvement direction.

## Outcome

Give the bedroom's largest surfaces - walls and ceiling - visible, restrained material finish without changing gameplay, lighting ownership, CSS, assets, texture files, controls, dialogue, or room layout.

## Confirmed gap

Fresh production captures show the title, Mudwick screen, scorecard, HUD, Mum doorway, rug, furniture, poster, and wall props are already authored. The remaining weak visual read is the architectural shell itself:

- the wall vertex colour grid is only `4 x 3`, so broad views still read as flat brown planes;
- the ceiling is a single flat Lambert plane with no vertex-colour material character;
- the large room corner is less finished than the authored poster, doorway, desk, and report overlay around it;
- existing browser checks prove walls and floor have vertex colours, but do not pin material richness, ceiling finish, or shell complexity budget.

This is a base-material defect, not a prop-density defect.

## Gap table

| Claim | Analogous existing path found | Classification | Real action |
| --- | --- | --- | --- |
| Bedroom walls still look flat | `makePaintGeometry(width, height)` already applies deterministic vertex colours | Missing feature | Increase authored wall colour field and pin contrast/vertex budget |
| Ceiling looks like a flat blockout plane | `room-ceiling` uses `PlaneGeometry` with one Lambert colour | Missing feature | Give ceiling deterministic vertex colour finish |
| Room needs more wall objects | `makeEnvironmentDetails()`, poster, sticky notes, calendar, and story board already provide authored objects | Already satisfied | No new props |
| Need richer lighting/post FX | Filmic renderer, non-shadowing lights, and contact shadows already exist and are guarded | Already satisfied | Preserve, do not add post-processing |

## Approaches considered

### 1. Deterministic vertex-colour shell finish - selected

Reuse the existing procedural geometry path. Increase wall subdivisions enough for visible low-poly paint grain, add a ceiling-specific vertex-coloured plane, and protect the result with browser assertions for colour variance, vertex budget, no extra texture, and no gameplay metadata.

### 2. Wallpaper or painted plaster texture

A canvas texture could add fine grain quickly, but it consumes texture budget, can shimmer at oblique angles, and risks becoming visual noise behind prompts and Mum. Rejected for this pass.

### 3. More posters and bedroom props

Extra wall objects would fill empty areas, but the authored props are not the weak part anymore. Adding more objects avoids the base-material problem and increases mesh/draw budgets. Rejected.

## Visual direction

The shell should feel like old painted plaster in a warm bedroom: uneven, hand-lit, and period-game simple.

- Wall paint keeps the existing warm brown family, but gains larger top-to-bottom and corner variation.
- Ceiling gets a duller tan-grey finish with shallow mottling, enough to stop reading as a single flat cap.
- Variation must remain low contrast; posters, Mum, CRT, prompts, and report paper stay dominant.
- The aesthetic risk is visible low-poly material patches, but restrained enough that they read as stylized paint rather than dirt.

## Architecture

`src/host/room.ts` remains the owner of room shell geometry.

- Replace `makePaintGeometry(width, height)` with a deterministic vertex-colour helper that accepts base colour and finish options.
- Build walls with the richer wall finish.
- Build `room-ceiling` from the same helper, rotated as today, with a ceiling-specific base colour.
- Keep every material Lambert, non-shadowing, asset-free, and texture-free.
- Add no colliders, interactables, lights, animation callbacks, timers, storage, or public API.

## Constraints

- Add no CSS, external raster asset, texture file, dependency, shader, post-processing pass, shadow map, event listener, timer, or animation loop.
- Preserve room dimensions, wall object names, ceiling object name, floor geometry, contact shadows, lighting behavior, colliders, interactables, item placement, Mum doorway, and PC interaction.
- Preserve `MeshLambertMaterial` for shell meshes and `vertexColors: true`.
- Increase shell geometry only within a bounded budget: each major wall or ceiling plane must stay at or below 99 vertices and 160 triangles.
- Add no renderer texture memory.
- Do not modify Mudwick, title, scorecard, HUD, audio, reports, or gameplay systems in this tranche.

## Verification

1. Add a browser smoke scenario first and observe it fail because the current ceiling has no vertex colours and wall material variance is too low.
2. Assert wall and ceiling vertex colours, per-channel colour variance, bounded vertex/triangle counts, zero shell textures, no shell lights/casters/interactions, and unchanged renderer texture budget.
3. Capture production proof at 1440 by 900 for a neutral bedroom view and a Mum prompt view.
4. Reject the result if wall patches compete with UI, ceiling looks speckled/noisy, the room becomes darker, object outlines are harder to read, or browser texture/render budgets rise unexpectedly.
5. Run the full local release gate, including unit tests, typecheck, standalone build, size budgets, isolated browser scenarios, full interaction E2E, final typecheck, and mounted-path build.
