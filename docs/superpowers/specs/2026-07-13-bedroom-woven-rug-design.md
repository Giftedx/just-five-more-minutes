# Bedroom Woven Rug Design

**Date:** 2026-07-13

## Problem

The bedroom now has coherent lighting, authored wall detail, and believable hero furniture, but its largest foreground surface is still two flat circles: a red outer disk and an orange inner disk. From the player spawn and any elevated room view, the rug reads as a target decal rather than fabric. It occupies more screen area than the chair or bed and drags the otherwise deliberate room back toward prototype quality.

## Goals

- Replace the bullseye rug with a period-appropriate woven oval that reads as textile at ordinary gameplay distance.
- Preserve the current foreground role, approximate footprint, negative space, chore-prop visibility, room layout, and player movement.
- Use the project's procedural low-poly language with no external asset or dependency.
- Keep the replacement deterministic, structurally testable, and no more expensive in draw calls than the existing two-mesh rug.
- Protect texture, geometry, interaction, shadow, and performance budgets with a browser-level contract.

## Non-goals

- Changing floor materials, room lighting, furniture, item spawn positions, collision, or chore rules.
- Adding cloth simulation, animated fibres, transparency, normal maps, post-processing, or dynamic shadows.
- Reworking every soft furnishing in the room.
- Introducing a general asset or texture-loading pipeline.

## Confirmed Existing Paths

| Claim | Analogous existing path | Classification | Action |
| --- | --- | --- | --- |
| Rug has authored textile character | Two unnamed `CircleGeometry` meshes at the room centre | Missing feature | Replace both circles |
| Procedural mapped storytelling is supported | Poster, Mum face, story board, and contact-shadow canvas textures | Already satisfied | Reuse the canvas-texture pattern |
| Deterministic custom geometry is supported | Floorboards, contact shadows, duvet, and instanced room details | Already satisfied | Reuse the local factory pattern |
| Rug needs gameplay collision or interaction | Existing rug has neither | Already satisfied | Preserve absence exactly |
| Rug has a local complexity guard | Only global room and bundle gates exist | Missing guard | Add a browser contract |

## Approaches Considered

### 1. Procedural oval woven rug with braided rim — selected

Use one generated mapped surface and one low-poly torus rim. This preserves the two-draw-call footprint, gives the textile a legible pattern and edge thickness, and retains the broad foreground mass without touching gameplay.

### 2. Vertex-colour-only radial mesh

Use concentric vertex-colour rings with no texture. This is slightly cheaper in texture memory, but the pattern would remain radial and risk looking like a more elaborate target. It cannot carry convincing weave at the current camera distance.

### 3. Rectangular fringed kilim

Use a rounded rectangle with instanced fringe. This creates a strong silhouette, but it materially changes the room's established foreground shape and places tassels beneath several chore props. The coordination and regression risk are not justified for this pass.

## Architecture

Create `src/host/woven-rug.ts` with one exported factory:

```ts
export function makeWovenRug(): THREE.Group;
```

The returned root is named `room-rug`. It owns two stable diagnostic children:

- `room-rug-surface`
- `room-rug-braid`

`room.ts` removes the two inline circle meshes, adds the factory result at the existing centre `(0.1, 0, 0.4)`, and otherwise leaves room construction untouched. The rug factory contains no gameplay imports, interactable metadata, collider, light, animation callback, or shadow caster.

## Visual Design

### Surface and footprint

The surface is a 32-segment circle scaled into a restrained oval. Its footprint remains close to the old 0.9-metre radius while opening slightly more floor along the near and far edges. Small deterministic height offsets at the perimeter break the mathematically perfect disk without creating visible waves or hiding floor items.

The rug stays only a few millimetres above the floor. Existing wrappers and laundry props must remain visible and raycastable above it, and the surface must not intersect the bed, chair, door threshold, or furniture contact shadows.

### Pattern and weave

One deterministic 256 by 192 canvas texture provides the textile identity. It uses:

- a muted burgundy field;
- a dark woven border;
- one elongated central diamond rather than concentric colour disks;
- mirrored rust, ochre, cream, and desaturated blue geometric accents;
- restrained horizontal and vertical thread lines that survive minification without producing moire.

The texture uses sRGB colour space and opaque pixels only. The surface therefore remains an ordinary depth-writing Lambert mesh with no transparent sorting or alpha-edge artifacts.

### Braided edge

A low-poly torus, scaled to the same oval, sits slightly above the surface and frames its perimeter. Alternating vertex colours imply a twisted dark braid while keeping the silhouette chunky and consistent with the room. The braid must look continuous from the spawn and elevated inspection views, with no seam, floating sections, or glossy plastic response.

## Performance and Complexity Budget

The old rug uses two meshes, two first-camera draw calls, 48 triangles, and no texture. The replacement may use:

- exactly two traversed meshes;
- no more than two first-camera draw calls;
- no more than 500 triangles;
- exactly one 256 by 192 generated sRGB texture;
- no lights, animation loops, colliders, interactable metadata, shadow casters, transparency, or dependencies;
- no more than a 10% median fresh-process headless frame-cadence regression.

The room-wide guard remains the current 126-call, 4,378-rendered-triangle, 11-texture baseline. The candidate must stay at or below 128 calls and 12 renderer textures.

## Verification Contract

Before implementation, a new browser smoke scenario must fail against the current room because `room-rug` does not exist. It will assert:

- the root and both named children exist with the expected nesting;
- the root remains centred at `(0.1, 0, 0.4)`;
- the root contains exactly two meshes and at most 500 expanded triangles;
- exactly one mapped texture exists, with dimensions 256 by 192 and sRGB colour space;
- the surface exposes UVs and at least three distinct small relief heights;
- no rug descendant contains interaction metadata or appears in `room.interactables`;
- the rug contains no lights or shadow casters and global shadow mapping remains disabled;
- no browser warning, error, or page error occurs.

After implementation, run unit/build checks, the full browser suite, the complete project verification gate, fresh-process baseline/candidate profiling, and clean 1400 by 900 renders from the spawn and elevated rug-facing cameras.

## Visual Acceptance

- The foreground must no longer read as a bullseye, target, or two stacked decals.
- The central motif must be legible as a woven geometric pattern without competing with the CRT or dialogue UI.
- The oval silhouette and braid must feel materially thicker than the floor while staying low enough for scattered props.
- No square texture boundary, transparent halo, z-fighting, moire, braid gap, or floating edge may be visible.
- Existing wrapper, sock, and laundry silhouettes near or on the rug must remain visible and interactable.
- The palette must separate from the orange floor while harmonising with the purple duvet and warm wood.

## Risks

- Dense thread lines can shimmer or collapse into noise under minification.
- A raised surface can hide tiny interactive props or z-fight with them.
- Torus scaling can make the braid look pinched or expose a seam.
- A large generated texture can increase renderer memory without improving the gameplay view.
- A decorative pattern can become a stronger focal point than the CRT.

These risks are controlled with a small opaque texture, restrained thread contrast, millimetre-scale relief, a named structural/browser budget, unchanged item placement, representative-angle renders, and fresh-process performance profiling.
