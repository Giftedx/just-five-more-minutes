# Chore Target Jeweller's Pass Design

**Date:** 2026-07-14

## Outcome

Replace the bedroom's placeholder-grade mug tray, waste bin, and laundry basket with authored procedural targets that read immediately at gameplay distance while preserving every chore, interaction, placement, collider, and render-budget contract.

This is the next game-wide jeweller's tranche because fresh production inspection found a real hierarchy mismatch: the collectible mugs, wrappers, and clothes are authored objects, but their destinations remain the original five-box tray, bare two-mesh cylinder, and five-slab basket. These targets are the endpoints of every carry chore and currently look materially weaker than the room around them.

## Evidence and gap classification

| Claim | Analogous existing path | Classification | Real action |
|---|---|---|---|
| Chore collectibles need rebuilding | Detailed `makeMug`, `makeWrapper`, `makeHoodie`, `makeSock`, and `makeShirt` builders already exist in `room.ts` | Already satisfied | Preserve |
| Carry interactions need new logic | `InteractSystem`, target metadata, placement slots, and tracker events already work | Already satisfied | Preserve |
| Tray, bin, and basket need visual authorship | Original inline geometry in `buildRoom()` | Missing finish | Replace geometry only |
| Target quality is regression-guarded | No target names or target-specific browser scenario exists | Missing guard | Add real-browser scene contract |
| More draw calls are available | Production room currently renders at the hard ceiling of 128 calls | Already exhausted | Reduce target submissions from 12 meshes to 9 or fewer |

Current measured target footprint:

| Target | Meshes | Instances | Triangles | Textures |
|---|---:|---:|---:|---:|
| Tray | 5 | 5 | 60 | 0 |
| Bin | 2 | 2 | 36 | 0 |
| Basket | 5 | 5 | 60 | 0 |
| Total | 12 | 12 | 156 | 0 |

## Approaches considered

### 1. Draw-call-neutral procedural target module — selected

Move the three builders into `src/host/chore-targets.ts`, use named meshes and instanced repeated members, and keep `room.ts` responsible only for placement, interaction metadata, and colliders. This improves silhouette, removes inline visual clutter from an already-large room builder, and creates a testable boundary without changing gameplay.

### 2. Add detail directly to the existing inline groups

This is mechanically smaller, but it would add more anonymous meshes to `room.ts`, worsen its mixed responsibilities, and exceed the room's draw-call ceiling unless paired with hidden optimization elsewhere. Rejected.

### 3. Add basket weave, tray grain, and bin labels as textures

Textures could fake detail cheaply in geometry terms, but they would add renderer memory, introduce a new visual asset family for mundane props, and weaken the room's procedural low-poly language. Rejected.

## Visual direction

### Subject and job

These are ordinary 2004-bedroom tidying targets, not fantasy loot containers. Each must communicate its household function in silhouette before the interaction prompt appears:

- the tray is low, broad, inset, and easy to place mugs onto;
- the bin is tapered metal with a clear dark opening and rolled rim;
- the basket is an open slatted hamper whose negative space makes it unmistakably different from a cardboard box.

### Palette

- Tray oak: `#8D6238`, inset: `#4D3320`, raised rim: `#B28757`.
- Bin steel: `#68767C`, rim: `#8A979A`, interior: `#202529`.
- Basket wicker: `#B28A55`, dark structure: `#725034`, rim: `#8E673C`.

No new global colour family is introduced. All materials remain matte Lambert materials under the existing bedroom lighting.
Repeated wooden members use three restrained per-instance tone multipliers so adjacent rails separate under warm room lighting without adding materials, textures, or draw calls.

### Signature

The signature is useful negative space. The laundry basket must read through its gaps rather than through painted detail, while the bin's dark mouth and the tray's inset bed provide the same visual cue at smaller scale.

The deliberate aesthetic risk is making the basket more open than a physically exact low-cost hamper. At bedroom scale, legible slats matter more than manufacturing realism.

## Geometry and names

### Tray

Root: `room-chore-tray`

- `room-chore-tray-bed`: one low box, preserving the current `0.56 x 0.36` footprint.
- `room-chore-tray-inset`: one darker shallow inset above the bed.
- `room-chore-tray-rim`: one four-instance box batch for the raised perimeter.

Target budget: 3 meshes, 6 instances, 72 triangles.

### Bin

Root: `room-chore-bin`

- `room-chore-bin-shell`: the existing tapered, open, double-sided 12-segment cylinder.
- `room-chore-bin-mouth`: one vertex-coloured batch combining a dark horizontal disc below the lip with a restrained low-segment torus, so the opening reads as depth without adding a third draw call.
- `room-chore-bin-interior` and `room-chore-bin-rim`: named diagnostic anchors preserving the two batched part locations.

Target budget: 2 meshes, 2 instances, no more than 200 triangles.

### Laundry basket

Root: `room-chore-basket`

- `room-chore-basket-base`: one inset floor box.
- `room-chore-basket-slats`: one 12-instance box batch, three spaced uprights per side.
- `room-chore-basket-rim`: one four-instance box batch around the opening.

The basket remains open. No solid wall panels or texture-backed fake holes are allowed.

Target budget: 3 meshes, 17 instances, 204 triangles.

### Combined budget

- Meshes: exactly 8, down from 12.
- Instances: no more than 25.
- Triangles: no more than 500.
- Textures: 0.
- Lights: 0.
- Shadow casters: 0.
- Room draw calls: no more than the existing hard ceiling of 128.

Every non-uniform box instance batch derives its culling sphere from its exact aggregate bounding box. This avoids Three's inflated default sphere for thin rails and keeps the basket rim out of the unrelated Mum doorway render without hiding or deleting geometry.

## Architecture and integration

- `src/host/chore-targets.ts` owns the three pure Three.js builders and their local materials/geometries.
- `src/host/room.ts` imports the builders, preserves the world positions, and retains all existing `tagInteract`, `interactables`, placement-slot, and collider behavior.
- `scripts/smoke.mjs` adds a production-browser scenario that finds the named roots in the real room scene and proves their structure and budgets.
- The game-wide jeweller's program records the repaired gap only after implementation and browser verification pass.

## Preserved contracts

- Target world positions stay exactly `[0.05, 0, 1.72]`, `[1.95, 0, -1.1]`, and `[-1.85, 0, 1.55]`.
- Interaction target ids remain `tray`, `bin`, and `basket`.
- Accepted chore slots and prompt names remain unchanged.
- Bin and basket colliders remain unchanged; the tray remains non-colliding.
- Placement slot coordinates remain unchanged.
- No target becomes an item, chore, light, animation, or event source.
- Carried-object parenting and placement behavior remain unchanged.

## Constraints

- Add no CSS, asset, texture, font, dependency, shader, light, shadow map, event listener, timer, animation loop, or simulation state.
- Change no chore definitions, counts, prompts, scoring, schedule, director behavior, raycast reach, pickup/drop semantics, or persistence.
- Do not modify Mudwick, Mum, title, scorecard, HUD, rug, shell, furniture, audio, or input systems.
- Use deterministic transforms only; no random geometry or runtime allocation inside frame loops.
- Every diagnostic name must identify a truthful mesh or instanced batch with the promised geometry.

## Verification

1. Add the browser contract first and observe RED because the named roots do not exist.
2. Implement the three builders and replace only the inline target construction.
3. Run the focused production build, size check, and browser suite; prove the new target scenario and the existing 128-call room guard pass.
4. Run all unit tests and TypeScript.
5. Capture production proof at gameplay distance for the tray, bin, basket, neutral room, Mum prompt, and report backdrop.
6. Reject the candidate if the tray resembles a picture frame, the bin mouth looks capped, the basket gaps collapse into noise, any target competes with the CRT or Mum, or any placed item visibly floats/clips.
7. Independently review the target builders, exact interaction preservation, smoke contract, and program record; verify every finding before acting.
8. Run the complete standalone and mounted release gates on the feature branch and again after local merge.
9. Do not claim live deployment; local mounted-path verification is not production provenance.

