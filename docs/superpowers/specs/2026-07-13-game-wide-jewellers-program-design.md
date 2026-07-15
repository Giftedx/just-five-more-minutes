# Game-Wide Jeweller's Program Design

**Date:** 2026-07-13

## Outcome

Carry the same exacting finish standard used on Mum's doorway vignette across every player-visible state without confusing activity with improvement. Preserve surfaces that are already authored and guarded; intervene only where live code and rendered evidence confirm a weaker finish level.

The first implementation tranche, Mudwick microfinish, shipped across the title CRT, physical bedroom monitor, and full PC mode. The program now continues evidence-first: preserve guarded surfaces and repair only defects confirmed in current source or rendered captures.

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
| Mudwick action pose | Four registered target-facing weapon variants with body-topology tests | Repaired and guarded locally | Preserve |
| Mudwick player and trader faces | Restrained eye cues with palette and dimension tests | Repaired and guarded locally | Preserve |
| Hobgoblin silhouette | Shared armoured/tusked silhouette distinct from ordinary goblins | Repaired and guarded locally | Preserve |
| Mudwick HP display | Matched-topology full/empty pixel hearts in the existing two-row panel | Repaired and guarded locally | Preserve |
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

The follow-up cascade audit found that the 900×400 hint margin and option padding were declared before their base rules, so the browser computed `2px` and `7px 12px 7px 8px` instead of the authored compact values. The production smoke now requires `0px` and `5px 10px 5px 8px` through the exact 520px boundary, then requires the base values again at 521px. Equivalent short-height rules live under one final `max-height: 520px` boundary. The reduced-motion rule now stops CSS motion globally instead of maintaining a fragile surface list. The CSS artifact is 41,717 raw / 10,078 gzip bytes against a tightened 10,112-byte ceiling—162 bytes below the former 10 KiB limit—with identical size-gate output under local Node 24.18.0 and CI-line Node 22.23.1.

Locally observed matched production captures showed zero changed pixels for title, report, blocked-device gate, pause, PC chrome, and 1280×720 dialogue UI after masking only live Canvas timing. Both locally compared 900×400 dialogue variants differed solely within the response card and its existing shadow/blur footprint, bounded at `(0,132)–(375,382)`. These ignored QA captures are local evidence rather than repository artifacts; the durable browser contract guards the intended computed styles at 520px and their base values at 521px. This is release-proof hardening, not another decorative layer.

## 2026-07-14 objective-flash contrast closure

Fresh production capture exposed a specific HUD regression: during the gold `hudflash` endpoint, the fixed `#b8954a` eyebrow fell to about 1.66:1 against the gold field and nearly vanished. An endpoint-only repair then exposed a deeper coupled defect: the old eased cross-fade drove foreground and background through near-equal mid-tones, measuring 1.101:1 at 225ms. The eyebrow now inherits the objective card's foreground through `currentColor` at `0.7` opacity, and the 0.9-second/two-iteration feedback uses a discrete half-gold/half-dark-glass pulse. Across black and white backdrop extremes, the gold state bottoms out at 4.610:1 and the normal gradient at 5.907:1; panel geometry and reduced-motion behavior are unchanged.

The production build is 750,836 raw / 201,766 gzip bytes of JavaScript and 41,737 raw / 10,091 gzip bytes of CSS, inside the 204,800-byte and 10,112-byte gzip ceilings. The browser contract pauses a real cloned animation at 12 points spanning both iterations and both sides of each state boundary, composites every translucent layer over black and white, and requires at least 4.5:1 throughout. The targeted production browser run passed 24 isolated scenarios and the full interaction E2E with zero capture-time console or page errors. The ignored 1280×720 proof is `shots/objective-flash-contrast.png`; the browser contract is the durable evidence.

## 2026-07-14 modem-outage modal closure

Fresh 1440×900 Wednesday capture exposed the next confirmed signature-event gap: three low-contrast disconnect lines floated over the dim Mudwick world while later-drawn chat and standing-order layers competed with them. The physical `homework.doc` flip was captured in the same audit and retained because its deliberately tiny Word document reads correctly at the room monitor's real scale.

The outage now draws a Windows-classic Mudwick system modal at the top of the world-viewport stack while preserving the 80-pixel stats panel. A broken phone-line icon, distinct server-loss copy, six-segment looping activity meter, and `PHONE LINE / BUSY` footer make the cause legible without adding a fake action or false progress percentage. Retry dots advance every 400ms and the meter every 200ms from the existing renderer clock. The small failure-red status uses `#981818`, measuring 4.656:1 against the classic-grey footer; title and body pairs measure 14.253:1 and 13.656:1. No CSS, asset, dependency, timer, DOM overlay, simulation state, director timing, audio, or input contract changed.

Adversarial review found that a context menu opened at the world edge could extend into the stats panel and survive the old `x < 240` outage fill. A logged-out render now dismisses trade and context overlays before the panel is painted. The production browser contract forces that stale state, requires both overlays to close, pins the formerly leaked panel pixel, and checks the modal palette and dimmed world in the real Canvas. Full feature-tree verification passes 19 test files / 210 tests, 25 isolated browser scenarios, the full interaction E2E with zero console/page errors, and both standalone and mounted builds. The standalone artifacts are 752,316 raw / 202,178 gzip bytes of JavaScript and 41,737 raw / 10,091 gzip bytes of CSS, inside the unchanged ceilings. The retained ignored 1440×900 proof is `shots/modem-outage-modal-final.png`; one-, three-, and six-segment phases were reviewed during implementation, while the browser/unit contracts are the durable evidence.

## 2026-07-14 Friday Double XP presentation closure

Fresh 1440×900 late-week captures confirmed that Thursday's inspection already had a readable signature hierarchy, while Friday was visually identical to an ordinary night despite `MudwickSim` doubling every skill award. The school-week design promised a Double XP banner in Mudwick chat, but no renderer path named the modifier. XP-drop strings were also hard-coded to base values, so Friday under-reported every granted reward; the hobgoblin death drop additionally claimed the ordinary goblin's 12 XP instead of its 20 XP base.

The simulation now exposes its existing rule through read-only `xpMultiplier: 1 | 2`; progression arithmetic and event shapes remain unchanged. Friday reserves one permanent line above the objective bar for a hard-pixel `2× / DOUBLE XP / FRIDAY EVENT` strip. Transient chat moves up by 12 pixels only while the modifier is active. Every Attack, Fishing, Foraging, and Woodcutting drop routes through one pure formatter, displays the actual granted value, and adds `· 2×` on Friday. The strip has no timer, motion, hit target, CSS, asset, dependency, persisted state, or DOM overlay, and the disconnect modal retains final ownership of the world viewport.

Adversarial review found one false-pass seam: fixed palette pixels could survive even if the authored words disappeared. Exact badge, label, and detail copy are now pinned independently of the production-pixel anchors. The Monday/Friday browser comparison also requires the authoritative multiplier, five event-strip colour anchors, an unchanged objective pixel, an unchanged side-panel pixel, and zero console/page errors. Production visual review covered the room-scale CRT, the native idle Canvas, and an active `+20 Fishing · 2×` drop. Full feature-tree verification passes 19 test files / 213 tests, 26 isolated browser scenarios, the full interaction E2E, and standalone and mounted builds. Standalone artifacts are 753,378 raw / 202,561 gzip bytes of JavaScript and 41,737 raw / 10,091 gzip bytes of CSS, inside the unchanged ceilings. Ignored proof is retained at `shots/friday-double-xp-room-scale.png`, `shots/friday-double-xp-idle.png`, and `shots/friday-double-xp-reward.png`; the unit and browser contracts are the durable evidence.

## 2026-07-15 ending archive closure

Fresh production captures seeded a valid eight-ending career at 1440×900 and 1000×700. The supposed title-screen gallery was only `8 endings collected` appended to the smallest footer line beside joke goals: it named nothing, exposed no canonical total, and offered no collection view. The same audit found a truth bug in the Week Verdict, which announced `career.gallery.length + 1` even when the awarded ending was already collected; arbitrary legacy string IDs also inflated both raw counts.

The title now exposes `ENDING ARCHIVE · n/10` as an intentional secondary action. It swaps the main incident card for a ruled-paper career file built entirely from the existing scorecard vocabulary: ten stable numbered rows, real titles for collected endings, genuine `CLASSIFIED` redactions for locked slots, an archived stamp, and a clear return action. The main title, bedroom atmosphere, Begin hierarchy, reset confirmation, click-anywhere start, CRT, quote, parallax, and reduced-motion behavior remain intact. Archive action, paper, return, backdrop, Enter, and Escape paths are browser-guarded; focus moves to the archive heading and returns to Begin without scrolling. The 1000×700 proof keeps the complete file between 20-pixel viewport insets with no clipping or internal scroll.

`src/score/week.ts` now owns the ten existing ending records once. The verdict matrix and Grounded override reference those same records, and pure gallery projection deduplicates known IDs while ignoring unknown ones without rewriting the v1 career file. Both title progress and prospective Week Verdict counts use that projection, so replayed endings no longer claim false growth. Undiscovered titles, blurbs, and IDs never enter visible or accessible archive text.

The pass adds no CSS, asset, dependency, font, route, query parameter, animation, timer, or persisted field. Full feature-tree verification passes 19 test files / 216 tests, 27 isolated browser scenarios, the full interaction E2E, and standalone and mounted builds. Standalone artifacts are 755,574 raw / 203,157 gzip bytes of JavaScript and 41,737 raw / 10,091 gzip bytes of CSS, inside the unchanged 204,800-byte and 10,112-byte ceilings. Ignored visual proof is retained at `shots/ending-archive-1440x900.png` and `shots/ending-archive-1000x700.png`; the unit and production-browser contracts are the durable evidence.

## 2026-07-15 seeded crowd closure

Source audit found that the school-week crowd's promised separate seeded stream had never been connected: bystander movement, chatter, speaker selection, and death-reaction copy all consumed global `Math.random()`, so two reports with the same session seed could show different ambient worlds. `MmoGame` now resolves the existing seed once and passes it independently to the sim and renderer. The renderer derives a private `Rng((seed ^ 0x5eed) >>> 0)` and routes every crowd decision through it; particle randomness remains separate and cannot advance the crowd stream. Names, sprites, positions, timing ranges, probabilities, chat copy, gameplay, and simulation RNG are unchanged.

The new regression failed on the original renderer with divergent same-seed positions, schedules, chatter, and reacting speaker. It now proves same-seed replay, different-seed divergence, and identical simulation state after 200 ticks with crowd presentation attached versus detached, and it passed 10/10 repeated focused runs. Adversarial review found no missed crowd random call or seed consumer; the only remaining renderer `Math.random()` calls are the three particle fields. Full feature-tree verification passes 19 test files / 218 tests, 27 isolated browser scenarios, the full interaction E2E, and standalone and mounted builds. Standalone artifacts are 755,660 raw / 203,204 gzip bytes of JavaScript and 41,737 raw / 10,091 gzip bytes of CSS, inside the unchanged ceilings. Ignored visual proof is `shots/seeded-crowd-dev-1280x720.png`; the deterministic unit contract and production-browser suite are the durable evidence.
