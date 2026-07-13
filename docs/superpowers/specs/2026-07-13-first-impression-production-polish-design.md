# First-Impression Production Polish Design

## Outcome

Make the opening minute of *Just Five More Minutes* feel deliberately composed and release-safe on ordinary desktop displays. Preserve the procedural 2004-bedroom identity while removing presentation defects that currently make the game look unfinished.

## Audience and job

The audience is a desktop player arriving with no context. The title screen has one job: sell the conflict between Mudwick and Mum, teach the minimum controls, and start the game without hiding or clipping information. The first room view must keep prompts legible without making keyboard navigation invisible.

## Evidence and confirmed gaps

- At 1280x720, the title card is 675px tall but its contents are 712px tall. Autofocusing `Begin` scrolls the card by 37px, clipping the opening metadata and producing an internal scrollbar before the player does anything.
- The title layout responds only to width. Supported desktop windows can be short, but there is no height-specific composition.
- Mum response buttons and the full-reset control have hover styling but no visible `:focus-visible` treatment.
- The managed browser gate hardcodes strict port 4173. If another local service owns that port, the gate exits before running any scenario.
- The bedroom uses generated Lambert geometry with flat materials and no authored asset, PBR, post-processing, skeletal animation, or cinematic-lighting pipeline. Calling the current scene AAA would be dishonest; that larger art-production gap is outside this bounded correctness pass.

## Approaches considered

### A. Surgical production polish — selected

Keep the current art direction and DOM structure. Add a short-desktop composition, prevent autofocus from moving the title card, complete keyboard focus styling, and harden the browser runner. This has the best correctness-to-risk ratio and can be proven with the existing browser suite.

### B. Full UI reskin

Replace the title and HUD with a new visual system. This could create novelty but would discard the strongest existing signature—the split between the CRT screen and Mum in the hall—and would not solve the 3D asset-quality ceiling.

### C. AAA art-pipeline rebuild

Introduce authored meshes, PBR materials, post-processing, character rigging, animation, VFX, and audio mastering. This is the only route to literal AAA presentation, but it is a separate production program with new tools, assets, budgets, and performance targets. It cannot be truthfully compressed into this polish pass.

## Visual direction

### Palette

- `Lamp gold #e8c33f` — primary action and time pressure.
- `Phosphor green #9be86b` — Mudwick and CRT life.
- `Hall terracotta #d89678` — Mum and domestic interruption.
- `Paper cream #efe6cf` — reports and household authority.
- `Ink brown #1c160e` — quiet UI substrate.
- `Night violet #0a0810` — stage around the card.

### Type

- RuneScape Bold remains the restrained display face for the game title.
- Segoe UI remains the readable body and interaction face.
- Courier New/Consolas remains the utility voice for clocks, week state, and reports.

### Layout

The title remains a single centered incident card. At short desktop heights, vertical spacing and the live CRT illustration compress together; the semantic content and split-screen composition stay intact.

```text
┌─────────────────────────────────────────────┐
│ incident / timer                            │
│ JUST FIVE MORE MINUTES                      │
│ premise                                     │
│ ┌──────── THE SCREEN ┬────── THE HALL ────┐ │
│ │ live CRT           │ Mum's warning      │ │
│ └────────────────────┴─────────────────────┘ │
│ MON  TUE  WED  THU  FRI · tonight           │
│ controls                                    │
│                  BEGIN                      │
└─────────────────────────────────────────────┘
```

### Signature

The memorable element remains the live CRT versus the quoted voice in the hall. Height compaction must never remove either half at normal desktop heights.

## Interaction and accessibility

- `Begin` receives initial keyboard focus without scrolling the title card.
- At 1280x720 and 1000x700, the title header and footer are simultaneously visible and the card has no internal overflow.
- At shorter supported heights, intentional scrolling begins at the top rather than jumping to the focused action.
- Mum response buttons and full reset have a clear gold focus ring with sufficient separation from their borders.
- Reduced-motion behavior remains static and painted.

## Browser-runner architecture

Extract a small loopback-port allocator. It prefers 4173 when available and otherwise asks the OS for an ephemeral port. The runner uses the selected port for the Vite arguments, readiness banner, fetch probe, and child `SMOKE_URL` values. A unit test occupies the preferred port and proves the allocator returns a different usable port.

## Verification

- Red/green unit test for occupied preferred-port handling.
- Red/green browser smoke for title geometry, zero initial scroll, and focus visibility.
- Existing unit, type/build, size, isolated browser smoke, full interaction E2E, and mounted build gates.
- Fresh screenshots at 1280x720 and 1440x900, plus console-error inspection.

## Explicit non-claims

This pass does not make the procedural 3D bedroom literally AAA. The remaining visual-production program includes authored environment assets, PBR materials, contact shadows/post-processing, character rigging and animation, VFX, audio mastering, settings/graphics scalability, multi-device performance profiling, and professional art direction across every game state.
