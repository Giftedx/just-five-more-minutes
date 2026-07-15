# Mudwick Action Readout Jeweller's Design

Status: approved by the user's standing instruction to continue autonomously without routine approval.

## Goal

Turn Mudwick's unbounded top-left hover sentence into a compact, period-authentic action readout that can display the longest real primary action without touching the adjacent away-plan controls, changing input behavior, or adding another visual system.

## Confirmed defect

`MmoRenderer.drawHoverText()` paints after `drawAwayPlanChips()`. Its black fill begins at `x = 0` and grows from measured inline copy with no maximum width. The real bridge action renders `Cross bridge (10gp toll) / 2 more`; at the shipped 7px monospace font, the primary action alone measures 92.367px and the full inline readout crosses the away-plan plate at `x = 131`.

A production-browser reproduction placed the player at the bridge, hovered the live bridge tile, and compared the complete `108×22` away-plan plate before and after the hover render. Thirty plate pixels changed. The defect is presentation ownership: hover guidance and the away plan both work independently, but their shipped compositions do not coexist.

## Existing paths and scope

| Surface | Existing authority | Classification | Action |
|---|---|---|---|
| Tile option ordering and labels | `MudwickSim.optionsAt()` | Already satisfied | Preserve |
| Mouse-to-tile mapping | `MmoGame.attachInput()` and `tileAt()` | Already satisfied | Preserve |
| Right-click context menu | `openMenu()`, `drawMenu()` | Already satisfied | Preserve |
| Hover visibility while trade/menu is open | `drawHoverText()` early return | Already satisfied | Preserve |
| Hover/away-plan coexistence | Unbounded fill painted after the plate | Missing presentation guard | Build bounded readout |

## Approaches considered

### 1. Twin action readout — selected

Reserve `x = 1..128` and `y = 1..22` for a two-line hard-pixel plate. Put the full primary action on line one and move the option count plus right-click cue to line two. The existing away-plan plate remains at `x = 131..238`, leaving a two-pixel breathing gap.

This keeps every useful word, exposes the existing right-click affordance, shares Mudwick's new command-strip material language, and establishes unambiguous top-band ownership.

### 2. Truncate the current inline sentence

Clamp the current fill before `x = 131` and ellipsize overflow. This prevents overlap, but it hides the most important part of the longest action—the toll—and keeps the option count cramped into the same hierarchy.

### 3. Move the current sentence below the top band

Keep one line and move it to `y >= 24`. This trades one collision for another: XP drops now intentionally begin immediately below the command plates, and the readout would compete with transient reward feedback and the world focal area.

## Visual direction

The subject is a 2004 mini-MMO action readout, not a modern tooltip. The two top plates should read like one embedded command rail: opaque hard pixels, single-pixel borders, compact monospace copy, no gradient, glow, radius, shadow, fade, icon asset, or animation.

The aesthetic risk is deliberate asymmetry. The left plate is wider because it reports variable world actions; the right plate is narrower because it owns four fixed standing orders. Their common height, material, caption scale, and two-pixel separation make the pair feel authored rather than mirrored for decoration.

## Exact composition

### Geometry

- Action plate: `{ x: 1, y: 1, w: 128, h: 22 }`.
- Away-plan plate remains `{ x: 131, y: 1, w: 108, h: 22 }`.
- The action plate ends at exclusive `x = 129`; pixels `129` and `130` remain clear.
- Primary baseline uses `textBaseline = 'top'`, `font = '7px monospace'`, origin `(4, 3)`.
- Secondary baseline uses `font = 'bold 6px monospace'`, origin `(4, 13)`.
- The longest current primary action, `Cross bridge (10gp toll)`, must fit without clipping or abbreviation.

### Copy

- Primary line preserves the first real option exactly. Verb and target remain separately colourable.
- Secondary line is exactly `N MORE · RIGHT-CLICK`, where `N` is the number of remaining context-menu options.
- `Walk here` remains one unsplit primary phrase. Other labels retain the existing first-word verb split.
- The readout remains absent when no valid tile option exists, and while the context menu or trade dialog owns input.

### Palette

- Plate: `#172012`.
- Border: `#6f7f54`.
- Verb: `#f0ead8`.
- Target: `#9be8e0`.
- Secondary cue: `#d8c79d`.

The plate and border intentionally match the away-plan material. Cyan remains reserved for the action target, while parchment separates the verb and secondary input cue without inventing another accent. Against the plate, the verb measures 13.953:1, the target 11.993:1, and the secondary cue 10.047:1.

## Architecture

`renderer.ts` owns one immutable `HOVER_ACTION_UI` geometry/palette contract and one pure `hoverActionFrame(label, extra)` formatter. `drawHoverText()` consumes both. The formatter returns the split verb, optional target, and exact secondary cue so unit tests can pin copy independently of pixels.

No new DOM, CSS, input listener, timer, state field, simulation event, persistence shape, asset, font, query parameter, dependency, or audio cue is introduced. `optionsAt()`, click behavior, right-click behavior, menu geometry, menu draw order, trade ownership, and the away plan remain unchanged.

## Layer ownership

- The two command plates own `y = 1..22` inside `x < 240`.
- XP drops remain below the command plates.
- Chat, objective, Double XP, and the side panel retain their existing bands.
- The context menu and trade dialog remain later modal owners; hover is suppressed before either draws.
- The disconnect modal retains final world-viewport ownership.

## Verification

1. Add unit contracts for exact geometry, the bridge frame copy, short/special-case copy, and all text/background contrast pairs; observe RED because the formatter and contract do not exist.
2. Add a production-browser guard that recreates the real bridge hover and observes RED because the current hover render changes away-plan pixels.
3. Implement only the immutable contract, pure formatter, and bounded two-line draw path.
4. Require zero changed pixels across the away-plan plate, opaque action-plate anchors, two clear gap columns, the unchanged side panel, and no console/page errors.
5. Visually inspect native Canvas, 1280×720 CRT, and 900×400 CRT frames for full toll copy, cue legibility, top-band balance, and world occlusion.
6. Red-team the longest label, single/multiple option counts, no mouse, panel hover, mouseleave, context menu, trade, XP drop, disconnect, and right-edge boundaries.
7. Run focused tests, typecheck, size gates, the full browser suite, full interaction E2E, standalone build, and mounted build. CSS must remain byte-for-byte unchanged and JavaScript must remain within the 204,800-byte gzip ceiling.

## Rejection criteria

Reject the pass if the primary toll copy truncates, either plate changes geometry, the two plates visually fuse, the cue reads like a marketing badge, the readout overwrites XP or panel pixels, a modal leaves stale hover behind, the side panel shifts, CSS changes, or the implementation introduces a second option-ordering source.

## Constraints

- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, and disabled image smoothing.
- Preserve every option label, ordering rule, click target, input path, away-plan field, simulation rule, and persistence contract.
- Keep all generated captures ignored. Do not pull, push, open a PR, deploy, or claim a live mounted-route update.
