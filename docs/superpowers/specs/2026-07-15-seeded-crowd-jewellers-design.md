# Seeded Crowd Jeweller's Pass Design

**Date:** 2026-07-15

## Outcome

Make Mudwick's cosmetic bystanders reproducible from the reported session seed without changing simulation outcomes, authored crowd behavior, particle effects, persistence, or presentation.

## Evidence and gap classification

The school-week design defines a hard boundary: the crowd must run on a separate seeded RNG stream and must never touch simulation state. The implementation keeps crowd state inside `MmoRenderer`, but every wander delay, movement decision, direction, chatter delay, chatter choice, reacting bystander, and death-reaction choice currently uses global `Math.random()`.

That is a confirmed contract defect. Two sessions reported with the same `?seed=` can render different bystander movement and chat, so screenshots and bug reports are not visually reproducible. The original school-week implementation plan specified a stream derived with `seed ^ 0x5eed`; that seam was never connected. Existing renderer unit tests cover modem and Double XP presentation but do not guard crowd determinism or simulation isolation.

The adjacent Monday first-stand-up tutorial promise is also absent from the current mode-change path, but it changes onboarding behavior and toast timing. It remains a separate product slice; combining it with RNG repair would make review and failure attribution worse.

## Approaches considered

### 1. Add a renderer-owned crowd RNG — selected

Pass the resolved simulation seed into `MmoRenderer`, derive a private `Rng` with `seed ^ 0x5eed`, and replace only crowd-related `Math.random()` calls. This is the smallest coherent fix, preserves every current visual and timing range, and directly restores the promised isolation boundary.

### 2. Extract the entire crowd into a new subsystem

Moving ghost state, chatter, movement, reactions, and rendering into a new `crowd.ts` would create a clean abstraction, but it would churn a large, stable renderer during a polish pass. The player-facing result and proof strength would be identical. Rejected as unjustified restructuring.

### 3. Seed all renderer randomness

Routing particles and crowd through one visual stream would make more pixels reproducible, but combat particles would advance the stream and alter later crowd behavior. That couples unrelated presentation systems and violates the crowd's separate-stream intent. Rejected.

## Runtime contract

- `MmoGame` resolves one unsigned session seed. When no seed is supplied, it uses the simulation's existing `0xc0ffee` default.
- `MudwickSim` receives that seed unchanged.
- `MmoRenderer` receives the same seed but constructs a separate `Rng((seed ^ 0x5eed) >>> 0)`.
- Only crowd decisions consume the crowd stream: reaction speaker selection, death-reaction copy choice, move delay, move/no-move choice, direction, chatter delay, and chatter choice.
- Particle motion continues to use `Math.random()` and cannot perturb crowd sequencing.
- Crowd updates may query `sim.walkable()` but may not call `sim.step()`, mutate sim fields, or consume the sim's private RNG.
- Existing names, sprites, initial positions, movement bounds, goblin-pen avoidance, chatter copy, scam whisper, reaction durations, and authored initial chatter times remain unchanged.

## Verification contract

Renderer tests use a minimal canvas/document harness and access the crowd update seam only for observation. They prove:

1. Two renderers with the same simulation state, crowd seed, and update timeline produce identical crowd snapshots.
2. Changing only the crowd seed produces a different crowd snapshot.
3. Advancing crowd presentation alongside one of two identical simulations for 200 ticks does not change the resulting simulation state.
4. Source inspection leaves global `Math.random()` in renderer particles only.
5. The full production build, size gates, isolated browser scenarios, and interaction E2E remain green.

## Constraints

- Add no dependency, asset, CSS, DOM surface, query parameter, persisted field, gameplay rule, animation, or copy.
- Do not change the simulation RNG algorithm or consume its stream from the renderer.
- Do not seed title animation, audio noise, room prop rotation, chore placement, or particles in this slice.
- Preserve existing crowd timing ranges and random-choice probabilities exactly.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes.
- Keep captures and temporary browser state out of commits; do not pull, push, or deploy.

## Architecture

- `src/mmo/render/game.ts` resolves and forwards the shared source seed while keeping sim and renderer RNG instances separate.
- `src/mmo/render/renderer.ts` owns the derived crowd RNG and routes every crowd decision through it.
- `src/mmo/render/renderer.test.ts` owns deterministic crowd, seed-divergence, and sim-isolation contracts.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` records final closure evidence.

