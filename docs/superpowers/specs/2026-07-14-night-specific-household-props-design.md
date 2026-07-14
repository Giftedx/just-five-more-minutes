# Night-Specific Household Props Jeweller's Pass

## Problem

The bedroom's permanent furniture, shell, lighting, Mum staging, and everyday chore targets now share a deliberately authored low-poly language. Three later-night-only surfaces do not. Tuesday's duvet tug points are isolated cubes, Thursday's curtain tug points are featureless boxes pasted over rigid panels, and Wednesday's landline is three tiny slabs that reads as a thermostat at gameplay distance. These props carry unique school-week story beats, so their placeholder silhouettes create a visible quality drop exactly when the campaign should feel richer.

## Goals

- Make the Wednesday wall prop read immediately as a cream early-2000s corded landline.
- Make both Tuesday duvet targets look like grabbable rumpled corners integrated with the existing hero bed.
- Make both Thursday targets look like gathered curtain fabric, with pleats and tie details integrated with the existing window dressing.
- Preserve every gameplay contract: IDs, chore slots, counts, labels, actions, world anchors, raycast membership, and completion behavior.
- Keep the pass procedural, dependency-free, performant, and consistent with the room's chunky low-poly construction.

## Non-goals

- No new interaction, animation, physics, audio, lighting, textures, external assets, or dependencies.
- No redesign of the hero bed, window, radiator, Mum, HUD, phone event, or school-week data.
- No movement of colliders, player spawn, permanent furniture, or existing interaction anchors.
- No attempt to make the landline answerable; it remains Mum's non-interactive story prop.

## Evidence

Production-build renders at 1400 by 900 confirm the source-level defect. The Wednesday prop appears as a narrow cream rectangle with a black square and could be mistaken for a thermostat or intercom. The Thursday view shows two large rectangular purple blocks floating over two already rigid curtain panels. Source inspection confirms the Tuesday targets are `0.2 x 0.12 x 0.2` boxes, the Thursday targets are `0.09 x 0.5 x 0.3` boxes, and the phone is composed of only three boxes.

## Options considered

### Phone only

Replace only the landline. This is the cheapest change but leaves the equally visible Thursday failure untouched and does not close the shared later-night quality gap.

### Remodel the bed and full window treatment

Rebuild the permanent hero bed and curtain/window cluster together. This would give maximum geometric freedom, but it duplicates the already-approved hero-furniture pass and expands risk into room architecture, collision, and first-camera composition.

### Focused procedural night-props module — selected

Create one small `night-props.ts` factory module for the three related authored surfaces. The room continues to own placement and interaction metadata. This cleanly separates reusable geometry from gameplay wiring, matches the existing `chore-targets.ts` and `hero-furniture.ts` boundaries, and allows direct deterministic tests without touching the simulation.

## Visual direction

### Landline

Use a warm cream wall base with a stepped backplate, visible cradle, dark keypad field, twelve raised buttons, a separate curved handset, end caps, earpiece/mouthpiece details, and a short dark coiled-cord suggestion. The silhouette must be wider and more horizontal than the placeholder and remain readable against the south wall. Materials stay matte Lambert; small dark and warm accents provide period readability without emissive or texture cost.

### Duvet corners

Each target is a low, soft-looking wedge assembled from a faceted tapered cushion surface, a folded lip, and a small underside shadow strip. The two instances use related but non-identical purple tones and mirrored fold bias so they do not read as duplicated blocks. The factory root remains the raycast/interactable object.

### Curtain gathers

Each target is a narrow vertical bundle with a gently tapered faceted body, two or three raised pleat ribs, a contrasting tie band, and a short fabric tail. The permanent panels stay in place; the new bundle visually bridges their inner edges instead of covering the window with another slab. Left and right variants mirror the tail and fold bias.

## Architecture and contracts

Add `src/host/night-props.ts` exporting:

```ts
export function makeWallPhone(): THREE.Group;
export function makeDuvetTug(side: 'left' | 'right'): THREE.Group;
export function makeCurtainTug(side: 'left' | 'right'): THREE.Group;
```

`src/host/room.ts` imports the factories and replaces only the three placeholder constructors. `addTug` remains unchanged and continues to tag the returned root. The landline remains visual-only. Factory roots and important children receive stable names for tests and browser inspection.

The existing world anchors remain exact:

- duvet targets: `(-1.68, 0.46, 0.42)` and `(-2.22, 0.46, 0.32)`;
- curtain targets: `(2.33, 1.35, -0.05)` and `(2.33, 1.35, 0.85)`;
- phone: `(0.35, 1.35, 1.97)`.

## Quality and performance budgets

- No texture, canvas, light, shadow caster, Standard material, or Physical material.
- No new collider or interactable beyond the two pre-existing roots for each tug chore.
- All factory meshes descend from their named root and dispose with the room scene.
- Combined additions stay below 36 meshes, 1,500 triangles, and 18 incremental draw calls in any one night variant.
- Production JavaScript and CSS gzip budgets must still pass the existing `size:check` gate.
- No material median headless cadence regression greater than 5% at matched cameras beyond normal sampling noise.

## Verification

1. Unit tests pin root/child names, mirrored variants, material constraints, mesh/triangle budgets, and absence of textures/lights/shadows/interaction metadata inside the factories.
2. The browser smoke pins exact root positions, interaction metadata and membership, phone non-interactivity, per-night presence, renderer budgets, and clean rendering.
3. Full interaction E2E proves tug completion behavior is unchanged.
4. Production-build screenshots at 1400 by 900 inspect Tuesday bed-facing, Wednesday south-wall, and Thursday window-facing cameras at original resolution.
5. The complete `npm run verify` gate proves unit, type, build, size, isolated browser, full interaction, and mounted-build compatibility.

## Rejection criteria

Reject the pass if the phone still reads as a thermostat; if duvet pieces float above or clip through the hero bed; if curtain bundles obscure the moon/window or look like rectangular shutters; if a target becomes harder to raycast; if permanent-night geometry changes; or if any stated budget or release gate fails.
