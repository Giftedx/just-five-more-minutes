# Hero Furniture Microfinish Jeweller's Pass Design

**Date:** 2026-07-14

**Status:** Approved under the standing visual graphic-design improvement direction.

## Outcome

Give the bedroom's two always-visible hero furniture pieces - the desk chair and bed - a restrained authored microfinish pass. Keep the same low-poly bedroom language, camera readability, gameplay contracts, CSS budget, asset budget, and interaction semantics.

## Confirmed gap

Fresh repo and contract inspection shows the title, scorecard, Mum doorway, room shell, interaction lockup, rug, poster wall, and Mudwick surfaces already have focused jeweller's-pass contracts. CSS is effectively at the gzip limit, so another interface reskin is the wrong move.

The remaining safe visual gap is the room hero furniture:

- `src/host/hero-furniture.ts` already owns the bed and chair in a focused file.
- `scripts/smoke.mjs` guards broad furniture contracts, but only requires three chair child names and five bed child names.
- The bed and chair are visible in neutral room, Mum prompt, and report-backdrop compositions.
- The current forms are competent but still read slightly blockout-simple beside the newly finished walls, rug, CRT, Mum, and room interaction lockup.

## Gap table

| Claim | Existing path found | Classification | Real action |
|---|---|---|---|
| Bed needs more finish | `makeBed()` has frame, mattress, headboard, sculpted vertex-colour duvet, drape, pillow | Missing feature | Add small authored seam/throw details without changing collider or chores |
| Chair needs more finish | `makeDeskChair()` has seat, back, lift, base, spokes, casters | Missing feature | Add upholstery seam/handle cues without changing PC interaction target |
| Furniture might bloat renderer | Existing smoke counts furniture meshes, instances, triangles, textures, lights, casters | Missing guard | Tighten browser scenario to require the new authored detail names and preserve budgets |
| CSS/UI needs another pass | CSS budget has only four gzip bytes of headroom and UI surfaces are already guarded | Already satisfied for this tranche | No CSS changes |

## Approach

### 1. Add micro-geometry to the existing furniture file - selected

Use a few simple low-poly meshes inside `src/host/hero-furniture.ts`: dark stitched upholstery lines on the chair, a small headboard lip, a pillow seam, and a folded foot throw/duvet band. This improves the render where players actually look while preserving the game's procedural, low-poly vocabulary.

### 2. Add textures or decals

Canvas textures would allow fine fabric detail, but they consume texture budget and add sampling/shimmer risk. Rejected.

### 3. Rebuild the furniture models

A full remake could increase silhouette quality, but it risks collider/interaction drift and wastes the already good authored foundation. Rejected.

## Visual direction

The signature is "used bedroom furniture, not showroom props": the chair should show stitched compression and a pull handle; the bed should show a tucked pillow seam, headboard rail, and a folded blanket/duvet band at the foot. These details should be visible enough at 1000 by 700 but quieter than the CRT, Mum prompt, and window.

## Implementation boundaries

- Modify only `src/host/hero-furniture.ts`, `scripts/smoke.mjs`, and this program documentation set.
- Add no CSS, external assets, texture files, dependencies, lights, shadows, event listeners, timers, animation loops, gameplay state, colliders, interactables, or chore logic.
- Preserve `room-desk-chair`, `room-chair-seat`, `room-chair-back`, `room-chair-base`, `room-bed`, `room-bed-frame`, `room-bed-mattress`, `room-bed-headboard`, `room-bed-duvet`, and `room-bed-pillow`.
- Preserve chair `pc` interaction and bed non-interactivity.
- Keep furniture textures at zero, lights at zero, shadow casters at zero, and renderer texture budget unchanged.
- Keep furniture mesh and triangle budgets bounded; the new browser contract owns exact limits.

## Verification

1. Add a failing browser check requiring named microfinish children on chair and bed.
2. Confirm the check fails before production code changes.
3. Implement the minimum geometry needed to pass.
4. Run unit tests, TypeScript, production build, size budget, browser checks, full interaction E2E, final TypeScript, and mounted-path build.
5. Capture production proof for a neutral room, Mum prompt, and report backdrop. Reject if the added details compete with UI, make furniture noisy, or alter gameplay affordances.
