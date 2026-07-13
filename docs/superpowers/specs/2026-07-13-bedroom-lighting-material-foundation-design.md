# Bedroom Lighting and Material Foundation Design

**Date:** 2026-07-13

## Problem

The bedroom establishes the game's first playable impression, but its current rendering reads as a lit blockout rather than a finished stylized environment. The wall and floor materials are uniform colour fields, furniture has almost no contact grounding, the ceiling fixture clips into an overexposed white shape, and the default renderer response compresses the room into a broad brown gradient. The composition and procedural-art language are worth preserving; the missing layer is depth, material separation, and light control.

## Goals

- Preserve the low-poly, procedural, late-1990s/early-2000s bedroom identity.
- Give the room shell visible but restrained material character at normal play distance.
- Add perceptual grounding with one bounded soft-shadow system.
- Replace the uncalibrated linear-looking renderer response with an intentional filmic response.
- Keep all generated surfaces deterministic and asset-free.
- Protect the result with browser-level structural regression coverage and the existing bundle/performance gates.

## Non-goals

- Photorealistic physically based materials.
- Screen-space post-processing, bloom, ambient occlusion, or a render-composer dependency.
- New room geometry, prop redesign, or interaction changes.
- Blanket conversion away from `MeshLambertMaterial`; the interaction highlight system depends on that material contract.
- Multiple shadow-casting lights or point-light cube shadows.

## Considered Approaches

### 1. Post-processing stack

Bloom, colour grading, and screen-space ambient occlusion could create a fast dramatic uplift, but would conceal rather than solve the flat shell materials, add bundle/GPU cost, and make the current clipped lamp worse. Rejected for this slice.

### 2. Full PBR conversion

Converting every prop to standard/physical materials would enable richer surface response but would widen the change across the interaction highlighter and every material-producing helper. The scene does not yet have the authored maps needed to justify that complexity. Rejected as disproportionate and contract-breaking.

### 3. Restrained Lambert pipeline enhancement

Keep the established Lambert art system, add deterministic canvas textures to the architectural shell, enable filmic tone mapping, and use one soft shadow-casting spotlight plus non-shadowing fill lights. This is the smallest coherent slice that directly improves depth while preserving performance and style. Selected.

## Design

### Renderer response

The host renderer will use ACES filmic tone mapping with a calibrated exposure. Three.js already supplies an sRGB output colour space; browser coverage will pin that default so an engine upgrade cannot silently regress it. Soft PCF shadows will be enabled globally, but only one room light may cast them.

### Procedural architectural materials

The walls and floor will receive deterministic `CanvasTexture` maps generated at room construction time:

- Wall paint uses low-contrast tonal variation and sparse roller-like mottling. It must remain quiet enough not to compete with posters, notes, or dialogue UI.
- Floorboards use broad planks, shallow seams, and restrained lengthwise grain. The geometry remains a single plane.
- Textures carry their final surface colour, use sRGB colour interpretation, repeat rather than stretch, and avoid external files or runtime randomness.

The ceiling remains visually subordinate but participates as a shadow receiver. Named shell objects provide a stable diagnostics surface for smoke tests.

### Shadow budget and light hierarchy

One warm spotlight near the ceiling fixture provides directional key light and casts soft shadows. Its map is capped at 1024 by 1024, with an explicit near/far range that covers only the room. The existing point sources remain non-shadowing fill and practical light, with intensity reduced to prevent the fixture from blowing out under tone mapping.

Major opaque Lambert meshes cast and receive shadows. Architectural planes receive but do not cast. Flat decorative overlays and transparent elements remain non-casters where their shadow would look like a cardboard cutout. The browser contract enforces one shadow-casting light, preventing accidental six-face point-light shadow cost later.

### Dusk integration

The key and practical light intensities remain part of `setDusk`. The dusk transition must preserve the current narrative shift from window fill to warm interior light without introducing sudden exposure changes.

## Verification Contract

Before implementation, a browser smoke scenario will fail against the current room and assert:

- filmic tone mapping is active;
- renderer output remains sRGB;
- soft shadow maps are enabled;
- exactly one light casts shadows;
- the key shadow map is no larger than 1024 by 1024;
- floor and wall meshes have procedural texture maps;
- the floor receives shadows and representative furniture casts them.

After implementation, verification includes the focused browser scenario, the full project verification gate, fresh fixed-seed renders at 1440 by 900, and a warning/error console check. Visual acceptance requires improved surface separation and contact grounding without crushed dialogue readability, distracting texture noise, or visible shadow aliasing.

## Risks

- Shadows may expose mesh intersections that were hidden by flat lighting.
- Tone mapping may make the room too dim or desaturate the deliberately warm palette.
- Procedural texture repetition may become obvious at oblique angles.
- Blanket shadow flags may cost too much or make thin decorative planes look artificial.

These risks are controlled through a single bounded shadow source, selective mesh eligibility, restrained texture contrast, deterministic screenshots, and the existing size/browser gates.
