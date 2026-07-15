# Away Plan Onboarding Jeweller's Pass Design

**Date:** 2026-07-15

## Outcome

Teach the player that Mudwick's away plan exists at the exact moment it becomes relevant—the first time they stand up from the CRT on Monday—without adding tutorial chrome, repeating across a career, obscuring household feedback, or weakening existing save compatibility.

## Evidence and gap classification

The school-week design promises tutorial feedback on Monday and states that the first stand-up of the career shows `Auto-pilot engaged. This is definitely allowed.` The away-plan switches already exist in the Mudwick canvas and their simulation behavior is tested, but `HostApp.exitPc()` currently reports only `mode = 'room'`; `Game` responds by changing crosshair visibility and syncing the pause overlay. No tutorial, discovery cue, or career-level seen state exists.

The gap is therefore not another control system or visual component. It is one missing transition behavior, one missing backward-compatible persistence field, and one missing browser guard. The mature neutral HUD toast already has responsive geometry, polite live-region semantics, reduced-motion behavior, and a non-celebratory visual treatment suitable for instruction.

## Approaches considered

### 1. Persist a career tutorial flag and reuse the neutral toast — selected

Add `tutorials.awayPlanSeen` to the in-memory Career v1 shape. Old v1 saves without the block migrate to `false`; malformed present blocks remain invalid. The first Monday PC-to-room transition marks and saves the flag before displaying one six-and-a-half-second neutral toast. This satisfies the written career contract, survives reloads, resets with Full Reset, and adds no new design language.

### 2. Keep a session-only boolean

This avoids persistence work but repeats after a reload or reopened tab. It would claim “one-time” while implementing “once per Game object.” Rejected.

### 3. Infer tutorial completion from week progress or switch state

Monday completion would silence the tutorial even if the player never learned the system; toggling a switch before standing would conflate configuration with comprehension. Rejected.

## Player experience

The trigger is narrow:

1. The career is on Monday (`night === 0`).
2. The player has entered PC mode at least once through normal interaction.
3. The mode changes from PC to room.
4. `career.tutorials.awayPlanSeen` is false.

The game marks the flag in memory, attempts to save the career, then shows this neutral toast for 6,500ms:

> Auto-pilot engaged. This is definitely allowed. Set the CRT AWAY PLAN before leaving.

The promised sentence remains verbatim and the second sentence names both the control and its physical location. The feedback appears in the existing toast row above Mum's prompt/subtitle lane, so it does not cover the doorway, chores, crosshair, interaction label, or response buttons. It uses the neutral bullet treatment rather than the green success check because this is instruction, not an achievement.

The initial room load, entering the PC, later stand-ups, Tuesday through Friday, reloading an already-seen Monday, and future completed weeks remain silent. If local storage throws, the current in-memory flag still suppresses repeats for that Game instance; a later reload may repeat because persistence was unavailable.

## Persistence contract

```ts
interface CareerTutorials {
  awayPlanSeen: boolean;
}

interface Career {
  version: 1;
  tutorials: CareerTutorials;
  // existing fields unchanged
}
```

- `freshCareer()` creates `{ tutorials: { awayPlanSeen: false } }`.
- Loading a legacy Career v1 with no `tutorials` property returns the same career plus `awayPlanSeen: false`.
- Loading a present `tutorials` object requires a boolean `awayPlanSeen`; malformed values still fall back to a fresh career under the existing strict-parser policy.
- `recordNight()` and `completeWeek()` preserve the top-level block through their existing spreads.
- Full Reset already removes the entire career key and therefore resets tutorial state without another storage key.
- The persistence version, key, character schema, reports, gallery, week reset, and away-plan values remain unchanged.

## Architecture

- `src/score/career.ts` owns the tutorial shape, legacy defaulting, strict present-value validation, and fresh default.
- `src/score/career.test.ts` owns fresh, legacy migration, malformed-value, round-trip, night-fold, and week-reset preservation contracts.
- `src/game.ts` owns the Monday PC-to-room trigger, in-memory one-shot transition, persistence attempt, authored copy, duration, and neutral tone.
- `scripts/smoke.mjs` owns production-browser proof: initial silence, first stand-up feedback, exact copy/tone, seen-state persistence, no second-show, reload silence, Tuesday silence, accessibility role, and 900×400 bounds/overlap.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` records closure evidence.

## Browser proof

An isolated 900×400 production scenario starts with fresh local storage and Monday forced through `?night=0`. It enters PC mode through the real `KeyE` interaction, returns to room mode, and asserts:

- the tutorial was absent before standing;
- exact visible copy and `data-tone="neutral"` after standing;
- `role="status"`, `aria-live="polite"`, and `aria-atomic="true"` remain intact;
- the toast stays within 8px viewport insets and overlaps neither the prompt nor subtitle card;
- persisted Career v1 contains `tutorials.awayPlanSeen === true`;
- a second sit/stand does not restart the tutorial;
- reload remains silent;
- a fresh career forced to Tuesday remains silent after the same transition.

The scenario must distinguish “still visible from the first show” from “shown again” by advancing beyond the 6,500ms lifetime before the second stand-up.

## Constraints

- Add no CSS, asset, dependency, font, animation, timer, overlay, input binding, route, query parameter, or standalone storage key.
- Preserve Career `version: 1` and `j5mm-career-v1`; migrate only the absent tutorial block.
- Preserve the promised first sentence exactly and keep the complete toast at 85 characters.
- Trigger only on Monday PC-to-room, never initial room setup or PC entry.
- Mark in memory before attempting storage so a storage exception cannot create same-session spam.
- Do not toggle any away-plan setting automatically; all four defaults remain off.
- Preserve every existing toast, subtitle, prompt, focus, pointer-lock, reduced-motion, and short-screen behavior.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes; CSS must remain byte-for-byte unchanged.
- Keep captures and temporary browser state out of commits; do not pull, push, or deploy.

## Verification

1. Add failing career migration/preservation tests and a failing production-browser first-stand-up scenario.
2. Implement the minimum Career v1 compatible-read field and Monday transition behavior.
3. Run focused unit tests, typecheck, standalone build, size gate, and the isolated browser suite.
4. Capture and critique Monday first-stand-up at 1440×900 and 900×400.
5. Reject the result if it reads like an achievement, repeats, appears outside Monday, covers Mum or controls, changes CSS, mutates the away plan, or invalidates existing saves.
6. Red-team every Career producer/consumer and every room/PC transition before full verification.
7. Run `npm run verify` in the feature worktree and again after local fast-forward integration.

