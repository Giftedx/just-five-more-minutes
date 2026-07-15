# Mudwick Inventory Panel Jeweller's Design

**Date:** 2026-07-15

## Outcome

Turn Mudwick's anonymous 4-by-7 inventory grid into a legible period-game pack without changing its real 28-slot semantics. The finished panel must identify the section, expose used capacity at a glance, distinguish occupied wells from empty wells, and keep two-digit item counts inside the slot that owns them.

## Confirmed defect

The current renderer gives every inventory slot the same beige fill and border. At a fresh start the grid consumes most of the side panel while communicating neither its purpose nor its capacity. At full capacity it becomes 28 repeated glyphs with a loose yellow count painted over the first occurrence of each kind.

The count is not actually bounded. In the shipped 6px monospace font, `28` measures 6.5977px. Its current `x = slot + 5` placement ends at 11.5977px inside an 11px cell, so it crosses the owning slot's right edge. The full-inventory capture confirms that the count is visually lost among the repeated log glyphs.

## Subject, audience, and job

The subject is a 2004-flavoured MMO backpack rendered on a 320-by-240 CRT canvas. The audience is a player deciding whether to keep gathering, eat supplies, sell, or stand up to do chores. The inventory's job is to communicate section identity, remaining capacity, occupancy, and repeated-item counts within a few pixels.

## Evidence and gap classification

| Claim | Existing path | Classification | Action |
|---|---|---|---|
| Inventory has a real capacity | `INVENTORY_SIZE = 28` and simulation fullness guards | Already satisfied | Preserve |
| Slot order represents carried items | Ordered `player.inventory` array | Already satisfied | Preserve |
| Player can identify the grid | Anonymous 4-by-7 wells | Missing presentation | Add a capacity-bearing pack header |
| Occupied and empty wells differ | Shared fill, border, and sheen | Missing presentation | Author separate well states |
| Repeated-item count stays bounded | Loose 6px text crosses the cell edge | Confirmed defect | Add a fitted count badge |
| Inventory needs new controls | No evidence of an interaction gap | Already satisfied | Add none |
| CSS needs to change | Canvas 2D owns the entire surface | Already satisfied | Add zero CSS |

## Approaches considered

### 1. Compact field-pack microfinish — selected

Embed `PACK n/28` in the existing divider between HP and inventory, give occupied wells a darker working state, and place repeated-item counts in a small dark badge. This repairs the real information and containment defects without moving the grid or changing its semantics.

### 2. Collapse inventory by item kind

Render one slot per kind with a large count. This would look cleaner, but it would lie about the simulation: each log, flax, shrimp, and bread item consumes one of 28 real slots. Rejected.

### 3. Add decorative backpack art

Introduce a bag silhouette, straps, or texture behind the grid. This would spend pixels and bundle size without improving the player's capacity decision. Rejected.

## Visual direction

The panel remains a tiny field ledger: parchment substrate, dark wood structure, and gold annotations. The single signature is the divider becoming a functional stitched label rather than a decorative rule.

No new colour family, font family, CSS selector, external asset, texture, animation, or filter is introduced.

## Geometry and palette

The renderer owns one immutable `INVENTORY_UI` contract:

- Capacity: `28`, sourced from `INVENTORY_SIZE`.
- Divider: `{ x: 248, y: 82, w: 64, h: 1 }`.
- Header backing: `{ x: 253, y: 79, w: 54, h: 7 }`.
- Header text: centered at `x = 280`, `y = 79`, `bold 6px monospace`.
- Grid: `{ x: 255, y: 86, columns: 4, rows: 7, pitch: 13, cell: 11 }`.
- Count badge: `{ w: 8, h: 6, font: 'bold 5px monospace' }`, aligned to the slot's bottom-right.

Authored colours:

- Panel backing: `#c8b088`.
- Divider and empty border: `#8a754f`.
- Normal header: `#4a3a26` — 5.21:1 against the panel.
- Full header: `#7a2020` — 4.88:1 against the panel.
- Empty well: `#b09a74`.
- Occupied well: `#927b58`.
- Occupied border: `#5c4a32`.
- Count badge: `#3a2c18`.
- Count text: `#ffe96b` — 11.02:1 against the badge.

The maximum authored header, `PACK 28/28`, measures 32.9883px in the production browser and fits inside its 54px backing. The maximum two-digit count measures 5.4980px at the new font size and fits inside its 8px badge.

## Presentation state

Add one pure `inventoryFrame(count)` formatter returning:

- `label`: exact copy `PACK n/28`.
- `full`: `true` when `count >= 28`, otherwise `false`.

The renderer consumes this state only. Normal capacity uses the dark-brown header; full capacity uses the deep-red header. This is supplementary colour, not colour-only meaning, because the visible fraction also reads `28/28`.

Occupied slots use the darker well and border. Empty slots preserve the lighter existing well. Item glyphs and their order remain unchanged.

For each repeated item kind, only its first occurrence receives a count badge. The badge is painted after the glyph so the total remains readable. Counts of one receive no badge.

## Ownership and boundaries

The header occupies `y = 79..85`. The second HP row ends at `y = 78`; the inventory begins at `y = 86`. No band moves and no pixel is shared.

The grid remains exactly 4 columns by 7 rows. The last cell stays inside the side panel. Skill-bar geometry, explicitly preserved by the current renderer, remains untouched.

## Behavior preserved

- `INVENTORY_SIZE = 28` and every fullness guard.
- Item acquisition, ordering, sale, eating, death drops, gravestones, and away-plan auto-sell.
- Item glyph geometry and item-kind vocabulary.
- Minimap, coins, HP, skills, quest, action plate, away-plan strip, chat, and world composition.
- Canvas dimensions, input, audio, timers, simulation, persistence, and render cadence.
- Existing compressed CSS bytes and hash.

## Verification

### Unit contracts

- Pin the exact immutable inventory geometry, palette, capacity, and fonts.
- Pin `inventoryFrame(0)`, `inventoryFrame(14)`, and `inventoryFrame(28)`.
- Require normal, full, and badge text contrast to remain at or above 4.5:1.

### Production-browser contract

Extend the existing Mudwick panel scenario rather than adding another boot:

- Fresh inventory paints the authored empty-well interior.
- A one-item inventory paints the authored occupied-well interior while the next slot remains empty.
- A 28-log inventory paints the dark count-badge corner.
- The grid's right edge remains left of the panel boundary.
- `PACK 28/28` and `28` remain within their measured backing and badge widths.
- The skills band and world-side boundary retain their before-state pixels.

### Visual proof

Capture fresh, mixed, and 28-log states at a 3x integer canvas scale. Reject the pass if the label crowds the hearts or first row, occupied wells swallow item silhouettes, the badge resembles another item, counts leave their slot, the full state depends on colour alone, or the panel becomes noisier than the world.

### Release gate

Run the focused renderer tests during iteration, then `npm run verify`. The final standalone and mounted builds must remain inside both compressed size ceilings. CSS must remain byte-for-byte unchanged.

## Scope boundary

This pass changes only inventory presentation contracts, renderer paint logic, their focused tests, the existing browser smoke, and closure documentation. It does not redesign the side panel, restack items, add inventory interaction, alter glyphs, touch the skills, or expand into gameplay.
