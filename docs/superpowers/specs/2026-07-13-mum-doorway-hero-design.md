# Mum Doorway Hero Vignette Design

**Date:** 2026-07-13

## Outcome

Turn Mum's six-second doorway appearance from visible prototype geometry into a deliberate low-poly hero vignette. Preserve the existing domestic-comedy identity, procedural asset pipeline, dialogue timing, and player control while improving the character silhouette, pose readability, material hierarchy, and hallway context as one composition.

## Confirmed problem

A fresh 1280x720 production capture proves that the previous dialogue-layout pass now exposes Mum correctly. It also exposes the remaining art-quality ceiling:

- Mum's head is a rectangular box with a face texture pasted onto one plane; the hair cap makes the silhouette even squarer.
- The torso is two stacked slabs with no shoulder, waist, collar, or cardigan construction.
- Both arms terminate in one merged horizontal block, so the crossed-arm pose reads as a bar across the body rather than anatomy.
- The hands float at opposite ends of that bar and the tea towel reads as a stiff paper strip.
- The skirt and feet are plausible from a distance, but the upper body is disproportionately narrow and the whole figure lacks contact with the floor.
- The hall is five flat brown planes. It has no skirting, threshold, runner, fixture, or domestic detail, so it reads as an unfinished render box rather than the same house as the bedroom.
- The bright point-light hotspot on the back wall has no visible source. It steals attention from the face and makes the lighting look accidental.
- The door opening is a strong frame, but the empty black surround and centrally placed hotspot flatten the depth behind Mum.

The failure is not missing UI or interaction. It is that the exposed hero moment has prototype silhouette, pose, and set dressing.

## Goals

- Give Mum a recognisable, proportionate low-poly silhouette at the existing doorway scale.
- Make the crossed-arm pose anatomically legible from the player camera.
- Preserve the rose cardigan, cream blouse, navy skirt, tights, slippers, bun, gold studs, skeptical eyebrow, and tea towel identity cues.
- Replace the unexplained wall hotspot with a visible practical light source and controlled warm pools.
- Ground Mum with a threshold/runner and restrained contact cue without enabling real-time shadows.
- Add just enough hallway construction and domestic detail to imply a lived-in house without competing with Mum.
- Keep the whole vignette procedural, dependency-free, disposable through the existing scene traversal, and hidden when Mum is absent.
- Protect the result with browser-observed structure, visual bounds, animation, and rendering-budget contracts.

## Non-goals

- Photorealism, a high-poly human, skeletal rigging, imported models, image assets, external fonts, post-processing, or shadow maps.
- Changing Mum's dialogue, timing, suspicion logic, audio, response UI, camera, player movement, door collider, or interaction model.
- Rebuilding the bedroom, door leaf, or global lighting system.
- Adding a general character framework for a single six-second NPC.
- Claiming parity with a large studio's authored character, facial-animation, lighting, and asset pipeline.

## Approaches considered

### 1. Character-only rebuild

Rebuild Mum and leave the hall unchanged. This is the smallest code diff, but it would place a better character in a visibly unfinished black box and preserve the unexplained light hotspot. Rejected because the environment would continue to undermine the hero read.

### 2. Hallway-only dressing

Add a practical fixture, runner, trim, and wall detail around the existing Mum. This improves depth and lighting logic, but the camera's focal subject would still have a cube head, slab torso, merged forearms, and floating hands. Rejected because it avoids the primary defect.

### 3. Coherent doorway hero vignette — selected

Upgrade the character silhouette and only the hallway elements directly necessary to frame, light, and ground her. Treat the character, practical light, runner, threshold, and one domestic wall detail as a single reveal group. This is the smallest coherent slice that fixes the whole composition.

## Visual direction

The target is authored low-poly illustration, not smooth generic 3D or realism.

- **Silhouette:** soft faceted head, defined shoulders, tapered cardigan, separate crossed forearms, readable hands, stable A-line skirt, compact slippers.
- **Character palette:** dusty rose cardigan, darker rose sleeves/cuffs, warm cream blouse and collar, desaturated navy skirt, brown-grey hair, restrained gold jewelry.
- **Face:** retain the skeptical raised brow and flat mouth, but place the face on a rounded low-poly head so it belongs to the form rather than reading as a decal on a cube.
- **Material hierarchy:** subtle value separation between cardigan body, lapels, sleeves, cuffs, buttons, blouse, skirt, and towel. No noisy textures.
- **Hall palette:** dark umber walls, muted wine runner, warm cream skirting, aged brass fixture, soft amber practical.
- **Lighting:** the visible practical sits above and to one side of Mum. The backlight becomes a controlled pool instead of a central orb; the existing front fill keeps the expression readable.
- **Signature prop:** the tea towel must hang over one forearm with a fold and woven stripe, not float on the torso.
- **Domestic cue:** one small framed family scribble or notice sits off-axis in the hall. It supports the joke and breaks the box without becoming a new focal point.

The intended hierarchy is: face and eyebrow, crossed arms and towel, rose cardigan silhouette, warm practical, runner/threshold, background detail.

## Character construction

- Replace the box head with a low-segment sphere scaled into a head shape. Keep a small front face panel or carefully positioned facial marks so the expression remains crisp at distance.
- Shape the hair with a faceted cap, side masses, back mass, fringe, and bun that follow the rounded head rather than recreating a cube.
- Build the torso from a tapered low-segment form, with separate blouse inset, collar/lapels, hem, buttons, and small shoulder caps.
- Use separate upper arms and forearms. The forearms cross at different depths and angles; hands attach at their actual ends.
- Drape the tea towel from the nearer forearm with two planes/low boxes at a slight angle, a visible lower fold, and one restrained stripe.
- Retain the A-line skirt but add a waistband/hem cue and rebalance its width against the improved torso.
- Keep the existing idle character: subtle weight shift, breathing, and skeptical head tilt. Add at most a tiny forearm/towel secondary motion, bounded so the pose never unhooks.
- Name the character root and major authored groups so browser checks can inspect the shipped composition.

## Hallway construction

- Add a reveal-only hallway dressing root, hidden whenever the hall light is off.
- Add skirting strips, a small threshold, and a narrow runner that lead into the depth of the hall.
- Add a visible sconce or compact ceiling practical with shade/backplate/bulb. Place the point light at the practical rather than at the centre of the back wall.
- Add one restrained framed domestic detail to an off-axis wall.
- Add a soft transparent contact patch beneath Mum instead of enabling shadow maps.
- Keep the existing hall volume, door swing, and collider unchanged.

## Runtime and lifecycle

- `makeMum` continues returning a root and tick function; its external room contract does not change.
- The hallway dressing root is toggled by the existing `setHallLight(on)` path so it produces no closed-door draw-call cost.
- All new meshes, materials, geometry, and canvas textures remain descendants of the room scene and are disposed by the existing `HostApp.dispose` traversal.
- No new event listener, animation frame, timer, or persistent external resource is introduced.

## Browser contract

A production-browser scenario will stage the existing Mum reveal and inspect the authored roots. It must prove:

- Character and hallway roots exist under stable names.
- The character contains separately named head, torso, left/right upper arms, left/right forearms, hands, towel, skirt, and footwear cues.
- The hallway contains a practical, runner, threshold/skirting, domestic detail, and contact cue.
- The reveal root is hidden with the hall light off and visible with it on.
- Mum remains inside the doorway and her projected face/upper-body bounds remain within the protected centre lane at 900x600 and 1280x720.
- The head tilt and weight shift change across time but stay within small authored bounds.
- The vignette adds no interactions, colliders, shadow casters, or shadow-map dependency.
- The character uses at most one small face texture and the hallway adds no texture.
- The visible reveal remains under a bounded mesh/triangle/draw-call budget established from the current production baseline.
- Console and failed-resource inspection remain clean apart from the known headless pointer-lock policy warning.

## Performance budgets

- Prefer reused materials and low-segment primitives.
- Keep the character under 45 meshes and 2,500 triangles.
- Keep reveal-only hallway dressing under 16 meshes and 900 triangles.
- Add no more than one texture beyond the existing face texture.
- Add no shadow casters and do not enable renderer shadows.
- Keep the staged doorway view under 55 draw calls, 4,000 visible triangles, and 14 renderer textures on the existing browser harness.

These budgets deliberately leave room for silhouette quality while remaining tiny compared with a conventional character asset.

## Success criteria

- Fresh 1280x720 and 900x600 production captures read as an intentional character encounter, not a blockout figure in an empty render box.
- The face, crossed-arm pose, towel, cardigan construction, and grounded feet are legible without zooming.
- The practical light is visibly motivated and no bright central wall orb competes with Mum.
- The existing dialogue composition, gameplay, door animation, room collider, full tests, build, asset-size gate, browser checks, interaction E2E, and mounted build pass.
- The final handoff reports the strongest evidence achieved and does not call procedural browser art literally AAA-equivalent.

