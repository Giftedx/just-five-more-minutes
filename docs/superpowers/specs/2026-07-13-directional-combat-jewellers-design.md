# Directional Combat Jeweller's Pass Design

**Date:** 2026-07-13

## Outcome

Make every Mudwick player swing point toward its actual target without changing combat rules, timing, pathfinding, input, camera behaviour, or the deliberately tiny 2004-browser-MMO style.

The current attack frame always extends its sword east. That pose reads correctly only when the target happens to be on the player's right. Combat already supplies the target goblin identifier with each `playerSwing`, so this is a missing render finish rather than a missing gameplay system.

## Evidence and scope

| Claim | Existing path | Classification | Action |
|---|---|---|---|
| The sword ignores target direction | `MmoRenderer` always selects one east-facing `PLAYER_ATTACK_SPRITE` | Confirmed defect | Add four registered attack variants |
| Target direction is unavailable | `playerSwing.goblinId`, `sim.player.pos`, and `goblin.pos` exist at event consumption | Already satisfied | Derive and latch direction in the renderer |
| Combat needs new state or timing | `swingUntil = now + 220` already owns the complete visual window | Already satisfied | Preserve exactly |
| Player body needs four redraws | The idle body already has a stable 12-by-14 topology | Missing guard only | Embed the same body into every 16-by-14 attack frame |
| Short desktop presentation needs another pass | Title and scorecard already have explicit short-height reachability contracts | Already satisfied | No change |

## Approaches considered

### 1. Registered body plus directional weapon overlays — selected

Embed the unchanged idle body in a 16-by-14 attack canvas, then add one hilt and four blade pixels on the north, east, south, or west side. Build the four sprites once when the module loads. This keeps body registration mathematically identical and makes palette, topology, and direction easy to test.

### 2. Four hand-authored full-body attack frames

This offers more pose variation but duplicates the body four times. At this scale duplication is more likely to create a one-pixel face, boot, or torso jump than meaningful animation quality. Rejected for this tranche.

### 3. Persistent simulation-facing state

Store player facing in `MudwickSim` and update it during movement and combat. This may be appropriate for a future locomotion system, but it changes simulation and persistence-adjacent contracts to solve a 220ms renderer concern. Rejected.

## Visual construction

### Shared body registration

- Keep `PLAYER_SPRITE` unchanged at 12 columns by 14 rows.
- Create the attack body's 16-column rows by adding two transparent pixels to each side of every idle row.
- Draw attack sprites two pixels farther left than the idle sprite so every non-weapon body pixel lands on the exact same world pixel.
- Keep the existing player shadow, interpolation, bob, draw order, and camera unchanged.

### Weapon vocabulary

- Reuse blade silver `#d5d0c2` and hilt brown `#7a4d28`.
- Every direction contains exactly four blade pixels and one hilt pixel.
- East and west use compact rising diagonals from the corresponding hand.
- North and south use short vertical strokes outside the right side of the body so the face, tunic, and legs remain readable.
- No weapon pixel may overwrite a body pixel or extend outside the 16-by-14 attack canvas.

### Direction choice

- Add a pure `attackDirectionForDelta(dx, dy)` helper returning `north`, `east`, `south`, `west`, or `null` when both deltas are zero.
- Choose the axis with the greater absolute delta.
- For a diagonal tie, prefer the horizontal component because the east/west silhouettes have the clearest hand connection.
- For an impossible zero delta, preserve the previous direction instead of inventing movement.
- On `playerSwing`, resolve the goblin by `goblinId`, compare its tile to `sim.player.pos`, and latch the result before setting the existing `swingUntil`.
- A target that dies in the same simulation turn still renders correctly because direction is captured while consuming the swing event.

## Architecture

- `src/mmo/render/sprites.ts` owns `AttackDirection`, the pure direction helper, the attack-sprite composition helper, and the four immutable attack sprites.
- `src/mmo/render/renderer.ts` owns the render-only latched direction and selects the corresponding sprite during the existing swing window.
- `src/mmo/render/sprites.test.ts` proves body registration, dimensions, palette coverage, weapon counts, directional extents, diagonal tie behaviour, and zero-delta fallback.
- No simulation type, event shape, save data, input route, or public browser hook changes.

## Constraints

- Add no asset, dependency, texture, animation timer, event listener, input, simulation field, or persisted field.
- Preserve the 320-by-240 canvas, 240-pixel world viewport, 80-pixel side panel, and disabled image smoothing.
- Preserve `swingUntil = now + 220` and all hitsplat, XP-drop, particle, reward, and chat timing.
- Preserve terrain/enemy/player/effect/panel draw order.
- Keep every attack sprite exactly 16 columns by 14 rows.
- Keep every non-weapon attack-body pixel registered to the idle body.
- Do not modify title, bedroom, Mum, HUD, gate, pause, scorecard, audio, map, pathfinding, damage, XP, economy, quest, input, director, score, or persistence code.

## Verification

1. Extend sprite tests first and observe failure because four directional sprites and the direction helper do not exist.
2. Implement pure sprite composition and direction selection; make the focused tests green.
3. Add a renderer-facing test seam only if live code cannot otherwise prove event-time direction latching without DOM scaffolding.
4. Run all unit tests and the production build.
5. Capture north, east, south, and west swings from the real PC-mode canvas at native pixel scale and in the physical CRT composition.
6. Reject any direction if the weapon detaches, crosses the face, overwrites the body, exceeds one adjacent tile, or makes the registered body jump.
7. Compare baseline and candidate PC-mode cadence in both run orders; reject a repeatable regression above two percent.
8. Red-team target death, diagonal adjacency, zero delta, missing goblin lookup, body registration, unchanged timing, and browser-artifact hygiene.
9. Run `npm run verify`, including 202-or-more unit tests, both builds, compressed size budgets, 17 browser scenarios, and the full interaction E2E.
10. Treat the local mounted build as build evidence only, not live deployment proof.

## Continuation rule

After four-direction capture and full verification, continue only if the new renders expose a directly related combat-readability defect. Do not use this pass to redesign already-guarded short-screen layouts or add a general facing/locomotion system.
