# Game-Wide Jeweller's Program Design

**Date:** 2026-07-13

## Outcome

Carry the same exacting finish standard used on Mum's doorway vignette across every player-visible state without confusing activity with improvement. Preserve surfaces that are already authored and guarded; intervene only where live code and rendered evidence confirm a weaker finish level.

The first implementation tranche is the Mudwick microfinish because it is the largest remaining fidelity mismatch and appears in three major views: the title CRT, the physical bedroom monitor, and full PC mode.

## Subject, audience, and job

The subject is a runtime-generated 2004 browser MMO seen through a teenager's CRT. The audience is a desktop player who must read actions, threats, rewards, and status within a few pixels while Mum and the dinner clock compete for attention. Mudwick's visual job is to feel like a specific, slightly overbuilt period game rather than a generic green pixel field.

## Evidence and gap classification

| Surface | Existing authored path | Classification | Program action |
|---|---|---|---|
| Title | Split-screen incident card, live CRT, school-week strip, short-height and reduced-motion browser guards | Already satisfied | Preserve and recapture |
| Bedroom | Filmic Lambert response, authored vertex-coloured shell finish, contact grounding, hero furniture microfinish, authored carry targets, permanent window dressing, night-specific phone/duvet/curtain props, environment storytelling, woven rug | Shell material, hero furniture, carry-target, permanent-curtain, and later-night household-prop gaps repaired and browser-guarded locally | Preserve geometry/texture budgets and recapture |
| Mum encounter | Authored character, hallway vignette, dialogue staging, focal-path microdetail, transform/material guards | Already satisfied | Preserve and recapture |
| HUD and dialogue | Responsive stack, keyboard focus, semantics, compact objective/chore hierarchy, authored volume fader, authored room interaction lockup, guarded 900×400 prompt compaction | Confirmed volume, room-interaction, and short-height cascade seams repaired; CSS release headroom hardened | Preserve browser contracts and recapture |
| Scorecard | Lined household report, filing marks, career annotation, semantic modal and short-screen reachability | Already satisfied | Preserve and recapture |
| Mudwick action pose | `PLAYER_ATTACK_SPRITE` declares a weapon colour but contains no weapon pixels | Confirmed defect | Repair test-first |
| Mudwick player and trader faces | Face rows contain only flat skin blocks | Missing finish | Add restrained eye cues |
| Hobgoblin silhouette | Reuses the ordinary goblin rows with palette changes only | Missing finish | Give it a distinct armoured/tusked silhouette |
| Mudwick HP display | Ten generic circles resemble a bank of buttons | Missing finish | Replace with full/empty pixel-heart states |
| Mudwick feedback | Click markers, hitsplats, particles, XP drops, coin pops, hover text, chatter, and low-HP pulse already exist | Already satisfied | Preserve timing and layering |
| Audio and transitions | Procedural UI sounds, scene modes, pause/gate ownership, reduced-motion paths, native persisted fader | Authored and guarded | Preserve behavior; intervene only on rendered evidence |

## Approaches considered

### 1. Focal-path Mudwick microfinish — selected

Refine the sprite vocabulary and HP iconography inside the existing 320x240 Canvas 2D renderer. This corrects confirmed defects, improves three headline views at once, and remains deterministic, asset-free, and cheap.

### 2. Global CRT filter or VFX overlay

Add scanline, glow, chromatic, or distortion effects over the entire canvas. This could create immediate novelty but would obscure weak silhouettes instead of repairing them, compete with the physical CRT mesh, and add per-frame cost. Rejected.

### 3. External authored asset pipeline

Replace procedural sprites and UI glyphs with image assets and an animation toolchain. This is a valid route for a different production, but it breaks the project's runtime-generated art identity and turns a bounded finish pass into a content-pipeline migration. Rejected.

## Visual direction

### Palette

- Mud grass `#48732f` and deep hedge `#243d18` remain the world foundation.
- Player tunic blue `#3a5a9c` and shade `#2c4377` remain the protagonist read.
- Goblin green `#5f8f3e` and hob rust `#a8703c` remain faction identifiers.
- Coin/attention gold `#e8c33f` remains the reward hierarchy.
- Damage red `#b02020` and miss blue `#2a4a9c` remain combat feedback.
- Panel parchment `#c8b088` and dark wood `#5c4a32` remain the interface substrate.

No new global colour family is introduced.

### Type and layout

Keep the current monospace Canvas 2D text, 320x240 canvas, 240-pixel world viewport, 80-pixel side panel, minimap, inventory, skill bars, objective strip, chat stack, and context-menu geometry unchanged. Image smoothing remains disabled.

### Signature

Mudwick's signature becomes hand-authored one-pixel readability: every important character has a recognisable face and silhouette, the attack frame contains an unmistakable diagonal weapon, and health reads as a period-game icon rather than generic controls.

The deliberate aesthetic risk is exaggeration at tiny scale. A weapon and hobgoblin armour may be larger than anatomically realistic because a 320x240 game must communicate in one or two frames. The test is readability, not realism.

## Sprite construction

### Player and cosmetic players

- Preserve the 12-pixel body footprint and 14-row idle cadence.
- Add two dark eye pixels without adding outlines or changing the tunic silhouette.
- Cosmetic players continue to reuse the same rows with palette substitutions.

### Attack frame

- Preserve the player's body registration so the shadow and interpolation do not jump.
- Extend a silver-grey diagonal weapon from the right hand, with one dark hilt pixel.
- Keep the animation controlled by the existing 220ms `swingUntil`; add no new timer or event.
- The weapon may extend beyond the ordinary body width but must stay within one adjacent tile.

### Trader Wyn

- Add two eye pixels and retain the hood, robe, coin trim, and body footprint.
- Do not animate or make Wyn interactable beyond the existing simulation contract.

### Hobgoblin

- Move the hobgoblin sprite definition into the shared sprite vocabulary rather than spreading a renderer-local copy.
- Preserve the rust/purple palette, but add a broader armoured shoulder line and pale tusk pixels so a hobgoblin remains recognisable without colour.
- Keep ordinary and angry variants; angry state changes eye colour only.

### Health hearts

- Add `HP_FULL_SPRITE` and `HP_EMPTY_SPRITE` as compact five-by-five pixel icons.
- Full hearts use damage red, a light top-left glint, and a dark lower point.
- Empty hearts retain the same silhouette in the panel's muted depleted colour.
- Keep the existing two rows of five and all status-cluster coordinates.

## Architecture

- `src/mmo/render/sprites.ts` owns every reusable pixel sprite and pure sprite-shape contracts.
- `src/mmo/render/renderer.ts` selects sprites and preserves render order, timers, simulation access, and panel geometry.
- `src/mmo/render/sprites.test.ts` pins row width, palette coverage, facial cues, weapon pixels, silhouette distinction, and full/empty heart topology.
- The production browser suite remains the integration and lifecycle gate; no debug-only runtime export is added.

## Constraints

- Add no external assets, texture files, font, dependency, shader, filter, offscreen animation loop, event listener, timer, or simulation state.
- Change no map, pathfinding, damage, XP, economy, quest, click target, input, director, score, or persistence behavior.
- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, and `imageSmoothingEnabled = false`.
- Preserve draw order: terrain, statics, ghosts, enemies, player, tree tops, markers, particles, rewards, hitsplats, overlays, panel.
- Sprite rows use palette keys only; transparent cells remain `.`.
- Attack weapon pixels must be present and must not appear in the idle sprite.
- Hobgoblin row data must differ structurally from ordinary goblin row data.
- Full and empty heart sprites must share the same non-transparent topology.
- No curated README screenshot is updated until fresh production captures pass visual review.

## Verification

1. Add pure unit tests first and observe failure because the new exported sprites and weapon/face keys do not exist.
2. Implement the minimum shared sprite vocabulary and renderer selection changes.
3. Run focused sprite tests, then all unit tests.
4. Build production and capture title, physical CRT, and full PC mode at representative desktop sizes.
5. Reject the candidate if the sword looks detached, eyes read as holes, hobgoblins become visually larger than their tile, hearts resemble flowers, panel spacing shifts, or effects outrank the world.
6. Compare renderer cadence before and after at the same PC-mode state; this pass must introduce no detectable frame-cadence regression.
7. Run the complete `npm run verify` gate, including standalone and mounted builds, size budgets, every isolated browser scenario, full interaction E2E, and 20-restart WebGL disposal coverage.
8. Preserve deployment provenance: a local mounted build is not a live deployment claim.

## Program continuation rule

After the Mudwick tranche, recapture title, bedroom, Mum, HUD, PC mode, report, blocked-device, pause, and reduced-motion states. A later tranche is allowed only for a defect visible in those fresh captures or a missing contract confirmed in source. “Everywhere” is a quality bar, not a requirement to churn already-finished surfaces.

## 2026-07-14 short-screen and release-headroom closure

The follow-up cascade audit found that the 900×400 hint margin and option padding were declared before their base rules, so the browser computed `2px` and `7px 12px 7px 8px` instead of the authored compact values. The production smoke now requires `0px` and `5px 10px 5px 8px`. Equivalent short-height rules live under one final `max-height: 520px` boundary, and the CSS artifact is 41,928 raw / 10,106 gzip bytes against a tightened 10,112-byte ceiling—134 bytes below the former 10 KiB limit.

Matched production captures prove zero changed pixels for title, report, blocked-device gate, pause, PC chrome, and 1280×720 dialogue UI after masking only live Canvas timing. Both 900×400 dialogue variants differ solely within the response card and its existing shadow/blur footprint, bounded at `(0,132)–(375,382)`. This is release-proof hardening, not another decorative layer.
