# Modem Outage Modal Design

**Date:** 2026-07-14

## Outcome

Turn Wednesday's 30-second landline interruption into a crisp, period-authentic Mudwick failure moment without changing the simulation, director timing, audio, room, or outer HUD.

## Evidence and gap classification

Fresh 1440×900 production capture at the real PC-mode scale showed the current outage as three low-contrast text lines floating over a dim world. The chat stack and standing-order chips draw after the outage, so they compete with and partially cross the message. The separate danger toast repeats “Connection lost” while the Canvas state supplies no stronger system hierarchy. This is a confirmed presentation and layering defect in a signature weekly event.

The physical `homework.doc` flip was also captured. It reads as a deliberately tiny, plausible Word document on the room monitor; enlarging its internal type or moving it out of the physical screen would reduce believability. It is already satisfied and is not part of this change.

## Approaches considered

### 1. Windows-classic Mudwick system modal — selected

Keep the world dim and the 80-pixel MMO side panel visible, but place a compact classic-system modal over the 240-pixel world viewport. Use a navy application title bar, hard one-pixel bevels, a line-break icon, distinct server-loss copy, an animated segmented retry meter, and an explicit busy phone-line status. Draw it after world HUD/chat so it owns the focal layer.

### 2. Full-screen modem terminal

Replace the world with diagnostic text and handshake traces. This would be readable but would discard gameplay context, overstate a short domestic interruption, and introduce a second visual language. Rejected.

### 3. CRT glitch and static treatment

Add distortion, scan noise, and chromatic movement. This would create spectacle without explaining the state, risks discomfort and capture instability, and duplicates the physical CRT treatment. Rejected.

## Visual direction

The subject is a 2004 school-night MMO session interrupted by a shared dial-up phone line. The audience must understand in one glance that Mudwick is intact, the server connection is not, and the phone is the cause.

### Palette

- Classic shell `#d4d0c8`
- Mudwick title navy `#0a246a`
- Bevel highlight `#ffffff`
- Bevel midtone `#808080`
- Bevel shadow `#404040`
- Failure red `#981818`

The existing Canvas monospace remains the only typeface. Bold 7-pixel title text, 8-pixel body copy, and 6-pixel status labels create the hierarchy.

### Layout

~~~text
┌──────────────────── Mudwick Online ─┐
│  [broken line]  Connection to       │
│                 server lost.        │
│                 Retrying...         │
│                 ▮ ▮ ▮ ▯ ▯ ▯        │
│  PHONE LINE   BUSY                  │
│  Someone is on the phone.           │
└─────────────────────────────────────┘
~~~

The modal stays entirely inside `VIEW_W = 240`, leaving the side panel readable. Its signature is the tiny broken phone-line icon and line-status footer: the failure belongs specifically to this bedroom and this era, not a generic network product.

## Interaction and motion

- The modal has no button and accepts no new input; reconnect remains director-owned.
- Retry dots advance every 400ms through one to three dots.
- The six-segment activity meter advances every 200ms and loops; it communicates activity, not elapsed percentage.
- Motion remains part of Canvas rendering and freezes with the existing MMO renderer clock when the game is paused.
- The 30-second disconnect/reconnect timing and all audio, bark, toast, combat-safe logout, and standing-order behavior remain unchanged.

## Architecture

- `src/mmo/render/renderer.ts` owns the pure `disconnectFrame(now)` view model, the Canvas modal, and its final world-viewport render order.
- `src/mmo/render/renderer.test.ts` pins user-facing copy and temporal boundaries before the drawing change.
- `scripts/smoke.mjs` owns a production-browser contract for the disconnected state, modal palette/layout anchors, side-panel preservation, and clean runtime behavior.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` records the confirmed gap and its closure evidence.

## Constraints

- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, `PANEL_W = 80`, and `imageSmoothingEnabled = false`.
- Add no CSS, asset, dependency, font, DOM overlay, timer, event listener, shader, texture, or simulation state.
- Preserve Wednesday's `125→155` director timing and combat-safe disconnect semantics.
- Preserve the side panel, external objective HUD, Mum bark, danger toast, volume control, and PC/room mode ownership.
- The disconnected modal must draw above Canvas objective, standing-order, chat, XP, hover, and trade/menu layers within the world viewport.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes.
- Keep all captures and temporary inspection scripts ignored.

## Verification

1. Add the pure frame-model test and production browser assertions first; observe failure because the helper and modal anchors do not exist.
2. Implement the minimum renderer/view-model change and correct the outage render order.
3. Run focused unit and browser checks, then capture the real 1440×900 PC-mode outage.
4. Reject the candidate if text collides, the dialog looks like modern web UI, the world or side panel disappears, retry motion implies a false percentage, or the outer toast/subtitle loses hierarchy.
5. Sample at least three retry phases and verify the same geometry with changing activity only.
6. Run `npm run verify` in the feature worktree and again after local fast-forward integration.
7. Do not pull, push, or deploy.
