# Seeded Crowd Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Mudwick crowd decision reproducible from the reported session seed while proving the crowd cannot perturb simulation state.

**Architecture:** Resolve the existing session seed once in `MmoGame`, pass it independently to `MudwickSim` and `MmoRenderer`, and let the renderer derive a private `Rng` with `seed ^ 0x5eed`. Route only ghost movement, chatter, and reactions through that stream; leave particles and all non-crowd randomness unchanged.

**Tech Stack:** TypeScript 7, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.4

## Global Constraints

- Add no dependency, asset, CSS, DOM surface, query parameter, persisted field, gameplay rule, animation, or copy.
- Do not change the simulation RNG algorithm or consume its stream from the renderer.
- Do not seed title animation, audio noise, room prop rotation, chore placement, or particles in this slice.
- Preserve existing crowd timing ranges and random-choice probabilities exactly.
- Keep JavaScript at or below 204,800 gzip bytes and CSS at or below 10,112 gzip bytes.
- Keep captures and temporary browser state out of commits; do not pull, push, or deploy.

---

## File responsibilities

- `src/mmo/render/game.ts` resolves the default seed and forwards the same source value to independent sim and renderer RNG owners.
- `src/mmo/render/renderer.ts` owns the salted crowd stream and consumes it for crowd decisions only.
- `src/mmo/render/renderer.test.ts` owns same-seed, different-seed, and simulation-isolation regression contracts.
- `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` owns program-wide closure truth.
- `docs/superpowers/plans/2026-07-15-seeded-crowd-jewellers-pass.md` owns execution evidence.

### Task 1: Lock the crowd RNG contract with failing tests

**Files:**
- Modify: `src/mmo/render/renderer.test.ts`

**Interfaces:**
- Consumes: `MudwickSim`, `MmoRenderer`, the existing six private ghost records, and the private `updateGhosts(now: number): void` seam.
- Produces: a deterministic minimal canvas harness plus crowd and sim snapshot helpers used only by renderer tests.

- [x] **Step 1: Add the canvas harness and crowd snapshot helpers**

Import `afterEach`, `beforeEach`, and `vi` from Vitest, import `MudwickSim` and `MmoRenderer`, and define a minimal `document.createElement('canvas')` stub whose 2D context supplies `imageSmoothingEnabled`, `createRadialGradient()`, `fillStyle`, and `fillRect()`. Define this test-only harness shape:

```ts
interface CrowdGhostSnapshot {
  id: string;
  pos: { x: number; y: number };
  nextMoveAt: number;
  say: string | null;
  sayUntil: number;
  nextSayAt: number;
}

interface CrowdHarness {
  ghosts: CrowdGhostSnapshot[];
  updateGhosts(now: number): void;
}

function crowdHarness(renderer: MmoRenderer): CrowdHarness {
  return renderer as unknown as CrowdHarness;
}

function crowdSnapshot(renderer: MmoRenderer): CrowdGhostSnapshot[] {
  return crowdHarness(renderer).ghosts.map(({ id, pos, nextMoveAt, say, sayUntil, nextSayAt }) => ({
    id,
    pos: { ...pos },
    nextMoveAt,
    say,
    sayUntil,
    nextSayAt,
  }));
}
```

Install the document stub in `beforeEach()` and restore globals in `afterEach()`.

- [x] **Step 2: Write the failing same-seed and different-seed contract**

Add a `seeded crowd isolation` describe block:

```ts
it('replays the same crowd timeline for the same seed and diverges for another seed', () => {
  const timeline = [1_000, 6_000, 18_000, 30_000, 46_000, 91_000];
  const make = (crowdSeed: number): MmoRenderer => (
    new MmoRenderer(new MudwickSim({ seed: 0xc0ffee }), 600, crowdSeed)
  );
  const a = make(13);
  const b = make(13);
  const other = make(14);

  for (const now of timeline) {
    crowdHarness(a).updateGhosts(now);
    crowdHarness(b).updateGhosts(now);
    crowdHarness(other).updateGhosts(now);
  }

  expect(crowdSnapshot(a)).toEqual(crowdSnapshot(b));
  expect(crowdSnapshot(other)).not.toEqual(crowdSnapshot(a));
});
```

- [x] **Step 3: Write the failing simulation-isolation contract**

Add:

```ts
it('does not perturb simulation outcomes while the crowd advances', () => {
  const withCrowd = new MudwickSim({ seed: 0xc0ffee });
  const withoutCrowd = new MudwickSim({ seed: 0xc0ffee });
  const renderer = new MmoRenderer(withCrowd, 600, 13);

  for (let tick = 1; tick <= 200; tick++) {
    crowdHarness(renderer).updateGhosts(tick * 600);
    withCrowd.step({ playerAway: true });
    withoutCrowd.step({ playerAway: true });
  }

  expect(JSON.parse(JSON.stringify(withCrowd))).toEqual(JSON.parse(JSON.stringify(withoutCrowd)));
});
```

- [x] **Step 4: Run the focused test to verify RED**

Run `npm test -- src/mmo/render/renderer.test.ts`.

Expected: TypeScript transform or runtime failure because `MmoRenderer` does not accept a crowd seed and uses global `Math.random()`, so the same-seed pair cannot be guaranteed equal.

- [x] **Step 5: Commit the red contract**

Run `git diff --check`, then commit `src/mmo/render/renderer.test.ts` with `test: expose unseeded crowd drift`.

### Task 2: Connect the isolated crowd stream

**Files:**
- Modify: `src/mmo/render/game.ts`
- Modify: `src/mmo/render/renderer.ts`
- Test: `src/mmo/render/renderer.test.ts`

**Interfaces:**
- Consumes: `Rng` from `src/mmo/sim/rng.ts`, the source session seed, and the failing contracts from Task 1.
- Produces: `MmoRenderer(sim: MudwickSim, tickMs: number, crowdSeed?: number)` with a private crowd RNG derived by `crowdSeed ^ 0x5eed`.

- [x] **Step 1: Resolve and forward the source seed**

In `MmoGame` use the simulation's existing default when `seed` is absent, pass the resolved seed to the sim options, and pass it separately to the renderer:

```ts
const resolvedSeed = seed ?? 0xc0ffee;
const opts: ConstructorParameters<typeof MudwickSim>[0] = { seed: resolvedSeed };
// preserve character and doubleXp option forwarding
this.sim = new MudwickSim(opts);
this.speed = speed;
this.renderer = new MmoRenderer(this.sim, BASE_TICK_MS / speed, resolvedSeed);
```

- [x] **Step 2: Add the private salted crowd stream**

Import `Rng` in `renderer.ts`, add `private crowdRng: Rng`, extend the constructor with `crowdSeed = 0xc0ffee`, and initialize:

```ts
this.crowdRng = new Rng((crowdSeed ^ 0x5eed) >>> 0);
```

This instance must never be passed to or read by `MudwickSim`.

- [x] **Step 3: Route every crowd decision through the stream**

Replace crowd-related global randomness without changing ranges or probabilities:

```ts
this.ghostReact(this.crowdRng.chance(0.5) ? 'lol' : 'F', now);

const g = this.ghosts[this.crowdRng.int(0, this.ghosts.length - 1)];

g.nextMoveAt = now + 900 + this.crowdRng.next() * 1500;
if (this.crowdRng.chance(0.7)) {
  const d = dirs[this.crowdRng.int(0, dirs.length - 1)];
}

g.nextSayAt = now + 16000 + this.crowdRng.next() * 24000;
const line = GHOST_CHATTER[this.crowdRng.int(0, GHOST_CHATTER.length - 1)] ?? 'grats';
```

Leave the three particle `Math.random()` calls unchanged.

- [x] **Step 4: Run focused tests to verify GREEN**

Run `npm test -- src/mmo/render/renderer.test.ts`.

Expected: all renderer presentation tests pass, including same-seed equality, different-seed divergence, and the 200-tick sim-isolation contract.

- [x] **Step 5: Inspect the randomness boundary**

Run:

```powershell
rg -n "Math\.random|crowdRng" src/mmo/render/renderer.ts src/mmo/render/game.ts
```

Expected: `crowdRng` covers death copy, reaction speaker, move delay/chance/direction, and chatter delay/choice; `Math.random()` remains only in the three particle fields.

- [x] **Step 6: Run static and build gates**

Run `npm run typecheck`, `npm run build`, and `npm run size:check`.

Expected: all commands pass; JavaScript remains at or below 204,800 gzip bytes and CSS remains at or below 10,112 gzip bytes.

- [x] **Step 7: Commit the runtime repair**

Run `git diff --check`, then commit `src/mmo/render/game.ts`, `src/mmo/render/renderer.ts`, and `src/mmo/render/renderer.test.ts` with `fix: seed the cosmetic crowd`.

### Task 3: Adversarial review, production proof, and closure

**Files:**
- Modify: `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md`
- Modify: `docs/superpowers/plans/2026-07-15-seeded-crowd-jewellers-pass.md`

**Interfaces:**
- Consumes: the green runtime and regression contracts from Task 2.
- Produces: verified production-browser evidence and synchronized program/plan closure truth.

- [x] **Step 1: Run the production browser suite**

Run `npm run test:browser`.

Expected: every isolated browser scenario and the full interaction E2E pass with no new console errors, interaction regressions, overflow failures, or rendering failures.

- [x] **Step 2: Capture and critique the seeded production frame**

Build and serve the standalone production bundle, load `http://127.0.0.1:4173/?night=0&seed=13&skipTitle=1`, enter the CRT, and capture the Mudwick frame under ignored `shots/`. Reject the candidate if the crowd disappears, clips into the goblin pen, loses chat, changes sprites/copy, or introduces visible rendering errors.

- [x] **Step 3: Red-team the boundary**

Review the commit range for missed crowd `Math.random()` calls, accidental particle seeding, default-seed drift, sim RNG consumption, invalid empty-array integer ranges, mutation through `sim.walkable()`, and false-pass tests that compare no random decisions. Verify each finding against source or a reproducing test before changing code.

- [x] **Step 4: Run the complete feature-worktree gate**

Run `npm run verify`.

Expected: all unit tests, standalone build, size checks, isolated browser scenarios, full interaction E2E, and mounted build pass.

- [x] **Step 5: Record exact closure evidence**

Append the exact test counts, browser scenario count, bundle sizes, screenshot path, and review outcome to this plan. Add one concise closure paragraph to `docs/superpowers/specs/2026-07-13-game-wide-jewellers-program-design.md` that names the seeded-crowd defect, implementation, and verification evidence.

- [x] **Step 6: Commit closure truth**

Run `git diff --check`, then commit the two documentation files with `docs: close seeded crowd pass`.

- [ ] **Step 7: Integrate and verify master**

Fast-forward local `master` to the feature branch, remove the isolated worktree/branch, restore the standalone `dist`, reload the visible local browser tab, and run `npm run verify` again from master.

Expected: master is clean apart from ignored proof artifacts; all gates pass with the same counts and size ceilings; no push or deployment occurs.

## Self-review

- Spec coverage: seed resolution, salted isolation, every crowd random decision, simulation independence, source boundary, browser proof, size gates, and synchronized closure docs each have an explicit task.
- Placeholder scan: no `TBD`, `TODO`, deferred implementation, or unspecified testing instruction remains.
- Type consistency: the plan consistently uses `MmoRenderer(sim, tickMs, crowdSeed?)`, `crowdRng`, `CrowdHarness`, and the existing `Rng.next()`, `Rng.int()`, and `Rng.chance()` methods.

## Execution evidence

- RED: the same-seed crowd replay failed on the original implementation with divergent positions, move/chatter schedules, chatter copy, and reacting speaker; the simulation-isolation assertion passed independently.
- GREEN: `src/mmo/render/renderer.test.ts` passes 7/7 tests and passed 10/10 repeated focused runs. The same-seed timeline includes movement, authored chatter thresholds, the scam-whisper threshold, and a death reaction; seed 14 diverges from seed 13.
- Randomness boundary: `crowdRng` owns death copy, reacting speaker, move delay, move chance, direction, chatter delay, and chatter copy. The only remaining renderer `Math.random()` calls are the three particle fields.
- Adversarial review: no actionable finding survived verification. Constructor fan-out is complete; omitted seed preserves `0xc0ffee`; explicit zero is preserved; the six-member crowd never shrinks; `sim.walkable()` is read-only; particles and sim retain separate streams; the regression crosses real random thresholds.
- Visual QA: the standalone Mudwick dev view preserved all authored sprites, cross-bank crowd presence, chat/reaction feedback, goblin-pen separation, CRT hierarchy, and pixel treatment. Ignored proof: `shots/seeded-crowd-dev-1280x720.png`.
- Feature-worktree `npm run verify`: 19/19 test files and 218/218 tests passed; 27 isolated browser scenarios passed; the full interaction E2E passed with rows `[0 / 40 | 30 / 30 | 20 / 20 | 4 / 10]`, total `54 / 100`, and ending `Employee of the Month (This House)`; standalone and mounted builds passed.
- Standalone size gate: JavaScript 755,660 raw / 203,204 gzip bytes against 204,800; CSS 41,737 raw / 10,091 gzip bytes against 10,112.

