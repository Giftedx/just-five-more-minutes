# Bedroom Environment Detail Design

**Date:** 2026-07-13

## Problem

The lighting and material foundation now gives the bedroom coherent colour response and grounding, but the environment still reads as a dressed prototype. The first camera sees a large unbroken north wall, a desk built from a top and four isolated legs, an empty lower window wall, and a hard ceiling seam. Existing small props are individually legible, yet they are too sparse and too evenly distributed to create a convincing lived-in room or a strong compositional hierarchy.

## Goals

- Turn the first-camera bedroom composition from sparse blockout into a deliberate late-1990s/early-2000s teenager's room.
- Add one high-value narrative focal point and three architectural or furniture layers across the upper, middle, and lower depth bands.
- Preserve the procedural low-poly art direction, existing interactions, collision, lighting, and dusk behaviour.
- Keep the pass deterministic, dependency-free, cheap to render, and structurally testable.
- Protect the current no-shadow-map performance strategy and bundle budgets.

## Non-goals

- Photorealistic assets, external models, image downloads, or a texture pipeline.
- Changing the room layout, player pathing, interactable objects, chore staging, or narrative rules.
- Filling every surface with decoration; negative space remains necessary around the CRT and dialogue UI.
- Rebuilding all furniture in this slice.
- Adding real-time shadows, post-processing, transparency-heavy effects, or new runtime dependencies.

## Existing Language and Confirmed Gaps

The room already establishes its visual language through simple Lambert materials, warm wood, dark trim, chunky period electronics, a shelf, books, three sticky notes, a calendar, curtains, and a window plant. The missing work is not a new style; it is a stronger authored hierarchy using that style.

| Area | Existing treatment | Confirmed gap |
| --- | --- | --- |
| North wall | Shelf, three small notes, calendar | No dominant narrative anchor; most of the wall is dead space |
| Desk | Top, four legs, peripherals | Silhouette reads as a generic table rather than bedroom furniture |
| East wall | Window, sill, curtains, plant | Lower wall has no functional architectural detail |
| Ceiling junction | Flat wall/ceiling intersection | Razor-sharp seam makes the shell read as a box |

## Considered Approaches

### 1. Furniture-only refinement

Replace or substantially remodel the desk and chair. This would improve the central silhouette, but the enormous empty wall would remain the most visible defect. Rejected as too narrow for the first-camera composition.

### 2. Wall-only narrative dressing

Add posters, a board, and more notes. This is inexpensive and improves storytelling, but it would leave the desk and lower window wall visibly unfinished. Rejected because it concentrates all detail in one depth band.

### 3. Balanced environment cluster

Add one authored story board, one desk drawer pedestal, one radiator cluster, and restrained ceiling coving. Each element repairs a different confirmed gap and the set creates a clear upper-to-lower visual rhythm. Selected because it delivers the broadest visible improvement for a bounded rendering cost.

## Design

### Module boundary

The new art lives in `src/host/environment-details.ts`, keeping the already-large room builder focused on layout and gameplay staging. The module exports one deterministic factory returning a root group named `room-environment-details`. `buildRoom` adds that group during static room construction.

The root has four stable diagnostic children:

- `room-story-board`
- `room-desk-drawers`
- `room-radiator`
- `room-coving`

The detail root contains no interactable metadata and introduces no colliders. The desk pedestal stays within the existing desk footprint; the radiator is shallow enough to remain outside the player path.

### Story board

A framed cork board occupies the empty left side of the north wall without crowding the CRT, sticky-note cluster, shelf, or calendar. One deterministic 256 by 160 canvas texture carries the entire board face: muted cork variation, a school timetable, a Mudwick sketch, a ticket, and two pinned photo shapes. Large graphic blocks, tape, and pins carry the story at gameplay distance; tiny pseudo-text is avoided.

The board uses one mapped face plus four simple dark-wood frame rails. The texture uses the sRGB colour space, requires no network asset, and is the only new texture in this pass.

### Desk drawer pedestal

A compact three-drawer pedestal sits under the left half of the existing desk. The cabinet mass, inset fronts, and simple handles turn the current four-legged slab into period bedroom furniture while leaving the chair opening and PC access clear. Materials reuse the room's warm wood and dark metal palette.

The pedestal is decorative and sits inside the desk's current collision/contact footprint, so it must not add collision or a separate contact-shadow system.

### Radiator and pipework

A shallow off-white panel radiator sits below the east window, with repeated vertical ribs, a short feed pipe, and a blocky valve. It explains the previously empty lower wall and adds a cool light material that separates from the overwhelmingly brown room. Geometry remains deliberately low-poly; no transparency, decals, or animation are introduced.

### Coving

Four narrow trim pieces trace the wall/ceiling perimeter as an upper counterpart to the existing skirting. The profile stays dark and restrained so it closes the shell without creating a heavy frame or lowering the perceived ceiling.

## Performance and Complexity Budget

The pass may add at most:

- one canvas texture;
- 18 meshes inside `room-environment-details`;
- 18 additional draw calls in the first-camera render;
- 1,200 additional triangles;
- no shadow casters, lights, animation loops, colliders, or dependencies.

The browser contract pins the one-texture and mesh-count budgets. Final same-process profiling compares the untouched baseline and candidate at identical viewport and device scale. The candidate is rejected if its headless frame cadence falls by more than 15% or if it enables a shadow pass.

## Verification Contract

Before implementation, the browser smoke suite will fail against the untouched room and require:

- the named detail root and all four named clusters;
- exactly one unique mapped texture in the detail root, using sRGB;
- a bounded detail-root mesh count of 10 through 18;
- exactly four coving rails;
- no interactable metadata, colliders, shadow casters, or detail lights;
- the existing global shadow map remaining disabled;
- no browser warnings, errors, or page errors.

After implementation, verification includes the focused browser contract, unit/build gates, full project verification, controlled baseline/candidate browser profiling, and visual inspection at 1440 by 900 from a clean production preview.

## Visual Acceptance

The pass is accepted only if:

- the story board becomes the secondary focal point after the CRT without competing with dialogue;
- the desk reads as one believable furniture mass rather than a top on sticks;
- the radiator fills the lower window wall without narrowing the walkable route;
- coving closes the room shell without creating a distracting dark border;
- props do not intersect walls, curtains, the CRT, chair, or existing notes;
- mapped content remains legible as graphic storytelling rather than noisy miniature text;
- the image preserves useful negative space and the established warm, low-poly identity.

## Risks

- The story board can become noisy or visually compete with the CRT.
- Decorative geometry can inflate draw calls despite low triangle count.
- The radiator can intersect curtains or read as a modern object.
- Coving can expose corner overlaps or make the room feel smaller.
- The desk pedestal can block the chair opening or duplicate the existing collision silhouette.

These risks are controlled with conservative placement, named structural assertions, a strict local mesh/texture budget, same-process profiling, and full-size browser inspection before integration.
