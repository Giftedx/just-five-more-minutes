# Bedroom Hero Furniture Design

**Date:** 2026-07-13

## Problem

The bedroom shell, lighting, desk storage, wall storytelling, radiator, and trim now form a coherent first impression, but the two largest remaining furniture silhouettes still read as blockout geometry. The chair is a rectangular back and seat balanced on a square plate; it dominates every desk-facing view. The bed is a stack of slabs with a flat blanket and pillow; it collapses under any camera angle facing the west wall. Both objects already have correct gameplay contracts, so the missing work is visual quality rather than new systems.

## Goals

- Replace the desk chair and bed with intentional late-1990s/early-2000s low-poly silhouettes.
- Improve both the default desk view and representative west-wall views.
- Preserve all interaction, collision, chore staging, contact grounding, room layout, and player pathing.
- Keep the furniture deterministic, texture-free, dependency-free, and inexpensive.
- Protect the result with browser-level structure, interaction, geometry, and performance budgets.

## Non-goals

- Changing the PC transition, chair collider, bed collider, or chore rules.
- Making the bed itself interactable.
- Redesigning the door, bin, laundry basket, PC tower, or room shell.
- Adding cloth simulation, skeletal animation, real-time shadows, post-processing, or external models.
- Introducing a general-purpose asset pipeline.

## Confirmed Existing Contracts

| Area | Existing path | Classification | Action |
| --- | --- | --- | --- |
| Chair interaction | Chair root is tagged `{ type: 'pc' }` and registered in `room.interactables` | Already satisfied | Preserve exactly |
| Chair collision | `colliderAt(0.9, -0.95, 0.5, 0.5, 0.9)` | Already satisfied | Preserve exactly |
| Bed collision | `colliderAt(-1.95, -0.4, 1.05, 2.1, 0.6)` | Already satisfied | Preserve exactly |
| Bed chores | Rumple/tug items stage at fixed world positions above the duvet | Already satisfied | Preserve height and footprint |
| Contact grounding | Existing batched footprints cover chair and bed | Already satisfied | Add no new shadow geometry |
| Furniture quality budget | Only global render and bundle gates exist | Missing guard | Add local browser budgets |

## Considered Approaches

### 1. Chair-only refinement

This fixes the most visible default-camera defect for the lowest cost, but leaves the west half of the room visibly unfinished. Rejected as too narrow.

### 2. Bed-only refinement

This substantially improves alternate room angles, but leaves the chair—the central silhouette during ordinary play—at prototype quality. Rejected because it misses the dominant view.

### 3. Paired hero-furniture module

Move both visual factories into one focused module and replace only the geometry while preserving room-level contracts. Selected because chair and bed share the same low-poly construction vocabulary and together cover the two worst camera regions without widening into unrelated props.

## Architecture

Create `src/host/hero-furniture.ts` with two exported factories:

```ts
export function makeDeskChair(): THREE.Group;
export function makeBed(): THREE.Group;
```

`room.ts` remains responsible for world placement, interactions, colliders, and chore staging. It imports the factories, positions the returned groups at the existing coordinates, tags/registers only the chair root, and retains the existing colliders verbatim. The old separate decorative headboard is removed because the new bed owns its complete silhouette.

## Chair Design

The chair root is named `room-desk-chair`. It contains stable diagnostic children:

- `room-chair-seat`
- `room-chair-back`
- `room-chair-base`

The seat is a low-sided octagonal cushion rather than a box. The back is a flattened low-poly capsule with a separate rear support, giving it a padded period-office-chair profile without a high-detail model. A gas-lift post, central hub, five radial spokes, and five small casters create a believable swivel base. Repeated spokes and casters are instanced to keep draw calls bounded.

The chair stays armless so the current desk clearance and PC interaction pose remain readable. Its footprint, seat height, back height, world position, collider, and interaction tag stay compatible with the existing room.

## Bed Design

The bed root is named `room-bed`. It contains stable diagnostic children:

- `room-bed-frame`
- `room-bed-mattress`
- `room-bed-headboard`
- `room-bed-duvet`
- `room-bed-pillow`

Four raised rails and four short legs replace the solid dark plinth, creating useful negative space and a real furniture silhouette. A slightly inset mattress remains within the existing collider. The headboard becomes part of the bed root.

The duvet is one indexed grid mesh with restrained deterministic height variation and vertex colour variation. It covers the foot half of the mattress and includes one simple aisle-side drape, avoiding cloth simulation while breaking the slab silhouette. The pillow is a flattened low-poly sphere with a slight rotation and visible centre depression implied by vertex scaling.

Existing bed-chore rumples remain at their current world coordinates and visually sit above the new duvet. The duvet top therefore stays near the existing `y = 0.4–0.46` range.

## Performance and Complexity Budget

The paired furniture roots may add no textures, lights, colliders, animation loops, or shadow casters. Their combined budget is:

- 12 through 18 traversed meshes;
- no more than 32 rendered instances/meshes after expanding instancing;
- no more than 1,200 triangles;
- no more than 10 additional first-camera draw calls over the 121-call baseline;
- no more than a 15% median headless frame-cadence regression.

Baseline evidence at 1000 by 700 with device scale 1 is 229 scene meshes, 121 calls, 3,950 triangles, 11 renderer textures, and 26.14 headless requestAnimationFrame FPS.

## Verification Contract

Before implementation, a browser smoke scenario must fail against the current room because `room-desk-chair` and `room-bed` do not exist. It will assert:

- both named roots and every diagnostic child exist;
- the chair root is tagged `{ type: 'pc' }` and appears exactly once in `room.interactables`;
- no bed descendant appears in `room.interactables`;
- the existing chair and bed collider extents remain present;
- combined expanded instance count is at most 32 and triangles at most 1,200;
- combined texture, light, and shadow-caster counts are zero;
- the duvet exposes vertex colours and at least three distinct relief heights;
- no browser warnings, errors, or page errors occur.

After implementation, run unit/build gates, the full browser suite, full project verification, fresh-process baseline/candidate profiling, and full-size visual inspection from the default, desk-side, and bed-facing cameras.

## Visual Acceptance

- The chair must read immediately as a padded swivel chair, not a signpost or dining chair.
- The chair base must show radial structure without becoming visually noisy.
- The bed must show air beneath its rails and a distinct mattress/frame relationship.
- The duvet must have visible but restrained folds without spikes, self-intersections, or a melted appearance.
- The pillow must look soft enough to contrast with the frame while remaining consistent with the low-poly art direction.
- The chair must not intersect the desk drawers, tower, bin, or floor.
- The bed must not intersect the west wall, poster, chore props, slippers, or player route.
- Default dialogue and PC overlays must remain legible.

## Risks

- A capsule back or spherical pillow can become too smooth and stylistically inconsistent.
- Instanced spokes or casters can be transformed incorrectly and corrupt the silhouette.
- Duvet winding can expose backfaces or relief can move chore props below the surface.
- Raising the bed can reveal contact-shadow or collider mismatch.
- More complex geometry can pass mesh-count checks while exceeding triangle cost.

These risks are controlled by low segment counts, explicit object names, expanded instance/triangle calculations, collider assertions, duvet relief checks, representative-angle renders, and fresh-process performance profiling.
