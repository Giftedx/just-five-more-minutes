# Mum Doorway Jeweller's Pass Design

**Date:** 2026-07-13

## Outcome

Give the existing Mum doorway vignette a final-art micro-detail pass. Preserve its authored low-poly silhouette and proven runtime contract while removing the remaining primitive-built tells in the face, clothing construction, towel, practical light, and domestic wall detail.

## Confirmed baseline

The hero-vignette pass already solved the macro failures: Mum has a rounded faceted head, coherent hair, separate limbs and hands, a readable crossed-arm pose, a draped towel, motivated practical light, hall depth, grounding, stable names, reveal-only visibility, and bounded performance.

Fresh 1280x720 and 900x600 renders expose a narrower finish gap:

- The shoulder caps look like attached spheres rather than cardigan sleeves.
- The cardigan neckline, closure, cuffs, and hem read as separate primitives instead of one constructed garment.
- The face is readable but lacks the eyelid, iris/highlight, mouth-corner, and cheek structure needed to hold attention at hero scale.
- The hair has a coherent mass but no clear parting or highlight rhythm.
- The hands are attached correctly but lack a thumb cue, weakening the crossed-arm anatomy.
- The towel has layers and stripes but no convincing hem, fold ridge, or asymmetric edge.
- The sconce still exposes its construction as a box, box arm, cone, and sphere.
- The framed domestic detail reads as a thermostat because two horizontal bars do not imply people.
- Gold studs, buttons, and brass share the same matte response as cloth and wood.

## Goals

- Improve the focal path in this order: face and hair, neckline and crossed hands, towel, sconce, family portrait.
- Make clothing details read as construction: armhole seams, cuffs, ribbed hem, neckline, closure, and restrained jewellery.
- Make metal distinct from cloth with a controlled specular response that remains legible without an environment map.
- Turn the practical and portrait into recognisable authored props without letting them compete with Mum.
- Preserve the current pose, dimensions, depth staging, palette, reveal timing, batching, disposal ownership, and gameplay contract.
- Add browser-observed guards for the new authored cues, material hierarchy, texture resolution, and revised geometry budgets.

## Non-goals

- Rebuilding the macro silhouette, changing proportions substantially, or adding a rig.
- Photoreal skin, physically based skin/hair shaders, facial animation, lip sync, imported art, image files, or external fonts.
- Changing the room, door, hall volume, runner, threshold, camera, collider, dialogue, timing, score, audio, or input.
- Adding post-processing, renderer shadows, normal maps, environment maps, or another texture.
- Decorating every visible surface. Empty space and large low-poly planes remain part of the style.

## Approaches considered

### 1. Dense micro-geometry everywhere

Add bevels, seams, trims, fasteners, and surface breaks to every character and hall object. This could increase apparent complexity, but it would flatten the visual hierarchy and turn the deliberate low-poly language into noisy kitbash. Rejected.

### 2. Lighting and shader-only polish

Adjust the two point lights and introduce shinier materials without changing construction. This would improve highlights but leave spherical shoulder caps, blunt towel edges, the box-built sconce, and thermostat-like portrait intact. Rejected as cosmetic.

### 3. Focal-path jewellery — selected

Spend a small, controlled geometry and material budget only where the eye lands. Refine facial marks, garment seams, hands, towel, practical, and portrait; keep the rest untouched. This produces the strongest visible return while preserving performance and style.

## Character finish

### Face and hair

- Increase the expression canvas from 128x128 to 192x192 without adding a texture.
- Preserve the raised skeptical brow and flat mouth.
- Add warm off-white eye shapes, dark irises, one-pixel-scale catchlights, coloured upper lids, subtle nostril marks, mouth corners, and restrained cheek/chin shading.
- Keep every facial mark inside the existing transparent expression plane so the faceted head remains the skin surface.
- Add a named hair-part cue and one restrained lighter sweep that follows the cap rather than forming a stripe across it.
- Preserve the bun and studs; add one small gold pin visible at the bun's side angle.

### Cardigan, arms, and hands

- Reduce and flatten the shoulder caps so they bridge torso and upper arm rather than reading as balls.
- Add named armhole seam cues following the shoulder line.
- Refine the lapels into a narrower V that reveals the cream blouse without creating an oversized bib.
- Add a shallow neckline edge, ribbed hem cues, and cuff ribs using low-profile geometry.
- Keep three cardigan buttons but use the metal material only for a tiny locket and existing jewellery; buttons remain cloth/dark horn.
- Add one thumb cue per hand, placed at the forearm endpoints so the crossed pose reads immediately.
- Add a thin gold necklace arc and tiny locket below the blouse collar. It is a focal accent, not a new character theme.

### Towel and skirt

- Preserve the two-layer drape and muted red stripes.
- Add a named lower hem, narrow side binding, one shallow fold ridge, and a small asymmetry between the two hanging panels.
- Add one restrained skirt pleat/highlight plane only if it remains subordinate to the towel and face.
- Do not change character depth, total height, skirt silhouette, tights, or footwear placement.

## Hall prop finish

### Practical light

- Replace the rectangular visual read with a smaller shaped backplate, short curved/angled brass arm, visible socket, warm bulb, tapered fabric shade, and thin shade rim.
- Keep the practical in its current location and keep the existing point light positions/intensities unless screenshots prove a calibration defect.
- Use a low-shininess cloth material for the shade and a controlled Phong metal for the brass. The bulb remains emissive/basic.

### Family portrait

- Keep the existing frame location and outer dimensions.
- Replace the two bars with a cream mount, dark inner aperture, and three tiny warm/desaturated head-and-shoulder silhouettes at different heights.
- Add no canvas or image texture; construct the portrait from batched procedural geometry.
- The portrait must remain dimmer and lower-contrast than Mum's face.

## Material hierarchy

- Cloth, skin, hair, paper, wood, runner, and painted trim remain Lambert.
- Gold jewellery and sconce brass use `MeshPhongMaterial` with restrained warm specular colour and bounded shininess.
- The bulb and transparent facial-expression plane remain MeshBasic.
- Add no texture beyond the existing expression canvas.
- Batching remains material-based and must preserve named marker transforms.

## Browser contract

Extend the existing production-browser scenario to prove:

- New stable cues exist: hair part, armhole seams, neckline/ribbing, both thumb cues, locket, towel hem/fold, practical socket/rim, and family portrait silhouettes.
- The expression texture remains the only character texture and is 192x192 in sRGB.
- The vignette contains at least one and no more than two Phong materials, and no Standard/Physical material.
- Named marker transforms remain truthful after batching.
- Reveal visibility, animation bounds, projected placement, collider/interactable isolation, and shadow-free rendering remain unchanged.
- Character geometry stays at or below 3,400 triangles; hall dressing stays at or below 1,200.
- The staged doorway view stays at or below 55 draw calls, 5,000 visible triangles, and 14 renderer textures.
- Matched-camera median FPS must not regress by more than 5% beyond normal headless sampling noise.

## Success criteria

- At 1280x720 and 900x600, the eye reads a constructed cardigan, believable crossed hands, cloth towel, intentional jewellery, real sconce, and family portrait without zooming.
- No individual new detail becomes louder than the face or raised eyebrow.
- The result remains recognisably the same Mum and the same low-poly game rather than a style swap.
- The full unit, standalone build, size, browser, interaction E2E, and mounted-build gates pass.
- Final reporting remains honest: this is a high-finish procedural low-poly asset, not a substitute for a rigged studio character pipeline.
