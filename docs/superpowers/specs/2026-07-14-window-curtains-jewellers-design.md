# Window Curtains Jeweller's Pass Design

**Date:** 2026-07-14

## Problem

The east-wall window is now surrounded by authored sky, frame, sill, radiator, plant, and Thursday tug bundles, but its permanent curtains remain the original prototype geometry: one rod and four long boxes. The outer panels read as purple boards, the inner strips read as duplicate boards, and nothing visually connects the fabric to the rod. The newer pleated tug bundles make that mismatch more obvious rather than hiding it.

## Goals

- Replace the rigid permanent panels with visibly hanging, pleated low-poly fabric.
- Give the curtains credible period hardware: repeated rings, a finished rod, and restrained finials.
- Shape the fabric so its upper inner edges visually feed into the existing Thursday tug bundles while its lower edges fall outward and continue framing the window.
- Preserve the moon, sky, frame, sill, radiator, plant, tug targets, room navigation, and interaction behavior exactly.
- Improve quality while reducing the permanent curtain cluster from five draw calls to four.

## Non-goals

- No changes to the window texture, frame, sill, radiator, plant, lighting, dusk behavior, wall materials, or camera.
- No curtain animation or persistent open/closed state.
- No changes to `makeCurtainTug`, tug IDs, prompts, world anchors, raycast behavior, completion transforms, chore scheduling, or scoring.
- No textures, external assets, dependencies, CSS, shaders, lights, colliders, or interactables.

## Evidence and gap classification

| Claim | Analogous existing path | Classification | Real action |
|---|---|---|---|
| Window backdrop needs rebuilding | Textured night sky, moon/stars, framed opening, and mullions already exist | Already satisfied | Preserve |
| Lower window wall needs detail | Authored radiator, valve, sill, pot, and plant already exist | Already satisfied | Preserve |
| Thursday interaction needs redesign | Named pleated tug factories, real raycast-plus-E smoke coverage, and exact anchors already exist | Already satisfied | Preserve |
| Permanent curtains need visual finish | One cylinder plus four boxes in `buildRoom()` | Missing finish | Replace geometry only |
| Permanent curtain quality is regression-guarded | No stable curtain root or fabric/hardware-specific browser contract exists | Missing guard | Add direct and production-browser contracts |
| More draw calls are available | The room already reaches its 128-call guard at representative cameras | Already exhausted | Reduce five permanent submissions to four |

## Options considered

### Reclaim CSS budget first

The four-byte CSS headroom is a real release-engineering risk, but CSS compaction does not improve the visibly weak curtain silhouette. It remains a separate optimization tranche because combining it with Three.js art would produce an incoherent review and rollback boundary.

### Rebuild the entire east-wall cluster

Replacing the window, sky, frame, sill, plant, radiator, and curtains together would maximize freedom but churn several recently authored, browser-guarded systems. It is rejected as unnecessary and higher risk.

### Procedural curtain dressing only — selected

Move the permanent rod/panel construction into a focused factory. Replace four fabric boxes with one sculpted, vertex-coloured surface and use instancing for repeated hardware. This addresses the confirmed defect, integrates with the existing tug art, and creates one stable diagnostic boundary while saving a draw call.

## Visual direction

The curtains remain the room's established bruised-purple palette, not a new decorative theme. Each side hangs from a short run of dark-brass rings. The top edge stays broad enough to meet the rod and overlap the Thursday bundle area; the bottom edge tapers toward the outer wall, making the drape feel pulled aside rather than cut into a rectangle.

The fabric surface uses a small vertical grid. Alternating x-depth creates broad pleats that respond to the existing Lambert light, while restrained vertex-colour bands distinguish folds and a darker bottom hem. Left and right panels mirror their silhouette but vary their colour rhythm so the result does not look mechanically duplicated. The rod stays dark wood and gains two compact faceted finials.

The distinctive gesture is the diagonal inner fall: the panel begins near the tug bundle at the top, then pulls away from the glass toward the bottom. This makes the permanent fabric and the night-specific interaction geometry read as one dressing instead of unrelated props.

## Architecture

Add `src/host/window-curtains.ts` exporting:

```ts
export function makeWindowCurtains(): THREE.Group;
```

The returned root is named `room-window-curtains`. `room.ts` positions it at the existing window anchor `(2.36, 0, 0.4)` and otherwise leaves window and chore construction unchanged.

Stable children:

- `room-curtain-fabric`: one indexed `BufferGeometry` containing both mirrored panel grids, with vertex colours and computed normals/bounds;
- `room-curtain-rings`: one `InstancedMesh` containing eight torus rings with exact aggregate culling bounds;
- `room-curtain-rod`: one eight-sided cylinder at the current height and span;
- `room-curtain-finials`: one `InstancedMesh` containing two faceted end caps with exact aggregate culling bounds.

The factory contains no interaction metadata. The existing Thursday tug roots remain separate scene members and keep their exact anchors.

## Preserved contracts

- Window frame, glow, mullion, and backdrop transforms remain unchanged.
- Curtain root world position is exactly `[2.36, 0, 0.4]`.
- Rod center remains world `(2.36, 2.26, 0.4)` and its span remains 1.74 units.
- Permanent fabric remains outside the glass opening and clear of the radiator, sill plant, and player path.
- Thursday tug roots remain at `(2.33, 1.35, -0.05)` and `(2.33, 1.35, 0.85)`.
- No permanent curtain child appears in `room.interactables` or carries `userData.interact`.
- Existing room disposal continues to own every geometry and material through scene traversal.

## Budgets

- Exactly four curtain meshes/draw calls: fabric, rings, rod, and finials.
- Exactly ten hardware instances: eight rings and two finials.
- No more than 1,000 triangles for the complete root.
- Zero textures, lights, shadow casters, colliders, or interaction tags.
- No Standard or Physical materials; fabric is Lambert with vertex colours.
- Representative room renders remain at or below the existing 128-call ceiling.
- No material median live-frame cadence regression greater than 5% beyond normal headless sampling noise.
- Existing JavaScript and CSS gzip gates continue to pass; CSS output must remain byte-identical because this pass changes no styles.

## Verification

1. Direct Vitest coverage pins the root/child names, exact mesh and instance counts, vertex-colour fabric, pleat depth range, tapered inner edges, mirrored bounds, exact instance culling spheres, and all resource/material budgets.
2. Production-browser smoke finds the real root at the exact anchor, proves zero interaction/collider side effects, preserves Thursday tug presence/contracts, renders the close camera, and enforces the 128-call room ceiling.
3. The existing real Thursday raycast-plus-E exercise remains green.
4. Production screenshots inspect the default room, a close neutral-night window, and Thursday with both tug bundles at 1400 by 900.
5. Matched baseline/candidate live-frame windows and renderer metrics confirm the saved submission and cadence parity.
6. `npm run verify` passes on the feature branch and merged local `master`, including standalone and mounted builds.

## Rejection criteria

Reject the pass if the panels still read as slabs; if folds become noisy striping; if rings float away from the rod or fabric; if the diagonal fall exposes an implausible gap to the tug bundles; if fabric covers the moon, plant, or radiator; if any window/tug contract moves; or if a render, size, interaction, disposal, or release gate fails.
