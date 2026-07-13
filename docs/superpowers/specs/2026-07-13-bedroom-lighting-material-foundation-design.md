# Bedroom Lighting and Material Foundation Design

**Date:** 2026-07-13

## Problem

The bedroom establishes the game's first playable impression, but its current rendering reads as a lit blockout rather than a finished stylized environment. The wall and floor materials are uniform colour fields, furniture has almost no contact grounding, the ceiling fixture clips into an overexposed white shape, and the default renderer response compresses the room into a broad brown gradient. The composition and procedural-art language are worth preserving; the missing layer is depth, material separation, and light control.

## Goals

- Preserve the low-poly, procedural, late-1990s/early-2000s bedroom identity.
- Give the room shell visible but restrained material character at normal play distance.
- Add perceptual grounding with one batched contact-shadow system.
- Replace the uncalibrated linear-looking renderer response with an intentional filmic response.
- Keep all generated surfaces deterministic and asset-free.
- Protect the result with browser-level structural regression coverage and the existing bundle/performance gates.

## Non-goals

- Photorealistic physically based materials.
- Screen-space post-processing, bloom, ambient occlusion, or a render-composer dependency.
- New room geometry, prop redesign, or interaction changes.
- Blanket conversion away from `MeshLambertMaterial`; the interaction highlight system depends on that material contract.
- Real-time shadow maps; controlled A/B profiling showed an unacceptable 40% headless frame-cadence regression.

## Considered Approaches

### 1. Post-processing stack

Bloom, colour grading, and screen-space ambient occlusion could create a fast dramatic uplift, but would conceal rather than solve the flat shell materials, add bundle/GPU cost, and make the current clipped lamp worse. Rejected for this slice.

### 2. Full PBR conversion

Converting every prop to standard/physical materials would enable richer surface response but would widen the change across the interaction highlighter and every material-producing helper. The scene does not yet have the authored maps needed to justify that complexity. Rejected as disproportionate and contract-breaking.

### 3. Restrained Lambert pipeline with a real-time shadow map

Keep the established Lambert art system, add deterministic canvas textures to the architectural shell, enable filmic tone mapping, and use one shadow-casting spotlight plus non-shadowing fill lights. This was implemented and visually improved depth, but controlled same-process profiling fell from a 21.5–23 fps headless baseline to 13 fps. Caster pruning, a 512-pixel map, cached depth rendering, and basic filtering did not remove the fragment-sampling cost. Rejected after measurement.

### 4. Vertex-coloured architecture with batched contact grounding

Keep the filmic Lambert light hierarchy, move broad wall and floor variation into vertex colour data, and batch five radial furniture footprints into one transparent contact-shadow mesh. This preserves visible material separation and grounding with no runtime shadow map, one extra draw call, and one small 64-pixel texture. Controlled cadence recovered to 18.5–19 fps. Selected.

## Design

### Renderer response

The host renderer uses ACES filmic tone mapping with a calibrated exposure. Three.js already supplies an sRGB output colour space; browser coverage pins that default so an engine upgrade cannot silently regress it. Runtime shadow mapping remains disabled.

### Procedural architectural materials

The walls and floor receive deterministic vertex colour data generated at room construction time:

- Wall paint uses a coarse 4 by 3 interpolation grid with low-contrast tonal variation. It remains quiet enough not to compete with posters, notes, or dialogue UI and avoids a full-screen texture lookup.
- Floorboards are five indexed quads in one buffer geometry with alternating warm wood colours.
- Both geometries use upward-facing winding and deterministic colour values; browser coverage verifies the winding so backface culling cannot expose the scene background again.

The ceiling remains visually subordinate. Named shell objects provide a stable diagnostics surface for smoke tests.

### Contact grounding and light hierarchy

One warm non-shadowing spotlight provides directional key light. Existing point sources remain non-shadowing fill and practical light, with intensity reduced to prevent the fixture from blowing out under tone mapping. The visible shade is an authored unlit gold surface so inverse-square lights cannot saturate it into a white disk.

Five furniture footprints—desk, chair, bed, bin, and laundry basket—share one 64 by 64 radial alpha texture and one indexed mesh. The mesh sits seven millimetres above the floor, disables depth writes, and renders after the opaque floor. It supplies stable contact grounding without per-object draw calls or dynamic shadow sampling.

### Dusk integration

The key and practical light intensities remain part of `setDusk`. The dusk transition must preserve the current narrative shift from window fill to warm interior light without introducing sudden exposure changes.

## Verification Contract

Before implementation, a browser smoke scenario will fail against the current room and assert:

- filmic tone mapping is active;
- renderer output remains sRGB;
- runtime shadow maps remain disabled and no light or mesh casts shadows;
- floor and wall meshes have vertex colour attributes;
- the floor and contact mesh face upward;
- one named contact-shadow mesh has a map and disables depth writes;
- the desk and non-shadowing key light retain stable diagnostics names.

After implementation, verification includes the focused browser scenario, the full project verification gate, same-process baseline/candidate profiling, fresh production-preview renders at 1440 by 900, and a warning/error console check. Visual acceptance requires improved surface separation and contact grounding without crushed dialogue readability, distracting tonal patches, backface holes, or opaque contact-shadow rectangles.

## Risks

- Custom indexed geometry may be wound downward and disappear under backface culling.
- Tone mapping may make the room too dim or desaturate the deliberately warm palette.
- Vertex colour patches may become obvious at oblique angles.
- Transparent contact shadows may sort incorrectly or obscure the floor if depth writes are enabled.

These risks are controlled through winding/depth-write browser assertions, restrained colour contrast, an immutable production-preview screenshot, controlled A/B profiling, and the existing size/browser gates.
