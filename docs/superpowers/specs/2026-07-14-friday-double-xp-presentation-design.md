# Friday Double XP Presentation Design

**Date:** 2026-07-14

## Outcome

Make Friday's active Double XP rule immediately visible inside Mudwick and make every XP drop report the reward the simulation actually granted, without changing progression, event timing, the room, or the outer HUD.

## Evidence and gap classification

Fresh 1440×900 production captures compared Thursday's inspection with Friday at the same real PC scale. Thursday already has a clear signature moment: Mum occupies the doorway, the suspicion card changes state, the prompt hierarchy remains readable, and the room lighting supports the confrontation. It is already satisfied.

Friday's `doubleXp` beat reaches `MudwickSim` and doubles every skill award, but the renderer never reads or names that state. The school-week specification promises a “double XP banner in Mudwick chat,” yet Friday is visually indistinguishable from an ordinary night. Worse, the renderer hard-codes base XP amounts, so its reward drops under-report the XP the simulation grants on Friday. These are confirmed missing-feedback and truthfulness defects in the final night's signature rule.

## Approaches considered

### 1. Persistent chat event strip plus truthful XP drops — selected

Reserve one compact line immediately above the objective bar for a Friday event strip. Shift transient chat upward by one line while the modifier is active, then show a tiny `2×` medallion, `DOUBLE XP`, and `FRIDAY EVENT`. Add the multiplier to XP-drop formatting so Friday displays the actual doubled award and a `2×` reinforcement. This makes the rule legible before and during play without leaving Mudwick's Canvas language.

### 2. One-time chat announcement

Post “Double XP is live” on entry and let it expire with ordinary chat. This is cheap but fails players who look away, enter late, or need to verify the rule after the line fades. Rejected.

### 3. Outer room HUD banner

Add a large HTML banner near the dinner timer. This would be prominent but would make an MMO event look like a bedroom objective, consume scarce CSS budget, and split the rule from the rewards it changes. Rejected.

### 4. XP-drop marker only

Add `2×` only when XP is earned. This corrects reward feedback but gives no persistent explanation of why Friday is special. Rejected as incomplete.

## Visual direction

The subject is a 2004 school-night MMO's weekend event, not a modern live-service promotion. The event should feel like a small authored strip built into Mudwick's chat chrome: hard pixels, compact hierarchy, no gradients, glow, pill geometry, countdown, or marketing language.

### Palette

- Lamp black `#161008`
- Old gold `#f2c94c`
- Parchment `#fff0a8`
- Ember `#c76b2a`
- Moss `#6e8f45`

The existing 6–7px Canvas monospace remains the only typeface. Old gold identifies the event; parchment carries readable copy; ember is limited to the `2×` medallion edge.

### Layout

~~~text
world viewport (240×240)
┌──────────────────────────────────────┐
│                                      │
│  transient chat, shifted upward      │
│                                      │
├──[ 2× ]  DOUBLE XP · FRIDAY EVENT ──┤  y=216..227
├─ Dinner fund … · 99 all … ─────────┤  y=229..239
└──────────────────────────────────────┘
                         +20 Fishing · 2×
~~~

The signature is a tiny `2×` medallion embedded in Mudwick's event strip. It should read as a rare server event, while the rest of the screen stays unchanged.

## Interaction and motion

- The strip is persistent for the whole Friday session and absent on every other night.
- It has no hit target, timer, hover, or animation.
- Transient chat retains its current fade and five-line maximum, but its bottom baseline moves up by 12 pixels while the strip is present.
- XP drops retain their current rise and fade. On Friday they show the actual doubled amount followed by `· 2×`; otherwise their copy is unchanged.
- Disconnect still owns the world viewport and draws above the event strip.

## Architecture

- `src/mmo/sim/sim.ts` exposes the already-authoritative modifier as read-only `xpMultiplier: 1 | 2`; progression logic remains unchanged.
- `src/mmo/render/renderer.ts` owns pure XP-drop copy, event-strip palette/layout, chat offset, and Canvas drawing.
- `src/mmo/render/renderer.test.ts` pins normal and doubled copy plus palette contrast.
- `src/mmo/sim/sim.depth.test.ts` pins the read-only seam to the existing arithmetic contract.
- `scripts/smoke.mjs` proves Friday's production Canvas contains the event strip, preserves the objective and side panel, and leaves Monday free of the strip.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` records closure evidence.

## Constraints

- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, `PANEL_W = 80`, and `imageSmoothingEnabled = false`.
- Add no CSS, asset, dependency, font, DOM overlay, timer, event listener, shader, texture, or persisted state.
- Preserve all XP values and progression semantics; this pass exposes and presents the existing multiplier only.
- Preserve transient chat capacity, fade timing, objective text, standing-order chips, side panel, disconnect ownership, and PC/room transitions.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes.
- Keep captures and temporary inspection scripts ignored; do not pull, push, or deploy.

## Verification

1. Add failing unit contracts for `xpMultiplier`, normal XP-drop copy, doubled copy, and palette contrast.
2. Add a failing production-browser scenario that compares Monday and Friday Canvas anchors.
3. Implement the smallest read-only simulation seam and Canvas presentation.
4. Capture Friday at the real 1440×900 PC scale both idle and with an active XP drop.
5. Reject the candidate if the strip competes with the objective, crosses chat, resembles modern web UI, reports base XP on Friday, appears on another night, or survives over the disconnect modal.
6. Run focused tests, browser checks, size gates, and `npm run verify` in the feature worktree and again after local fast-forward integration.
