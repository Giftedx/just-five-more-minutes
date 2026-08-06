# School Week Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, single continuous session). Spec: `docs/superpowers/specs/2026-07-11-school-week-design.md` — all data tables (night scripts, milestone values, excuse effects, ending matrix, line packs) are normative there; this plan pins module contracts and order.

**Goal:** Ship the School Week campaign: persistent Mudwick character, five data-driven weeknights, suspicion/excuse-driven Mum, Mudwick depth (zone 2, fishing, gravestones, standing orders, crowd), week verdict + gallery, and the audio/visual juice pass — all gates green.

**Architecture:** New pure modules (`career`, `nights`, `week`) compose *above* the untouched director; the sim grows by parameterizing existing machinery (oaks=trees, hobgoblins=goblins) plus four new intents; all persistence mirrors `history.ts` (injected storage, versioned validating parse). Cosmetic crowd runs on an isolated RNG stream — sim determinism contract is (seed, starting character).

**Tech Stack:** TypeScript, Three.js, Canvas 2D, Web Audio, Vite, Vitest, Playwright (existing runner).

## Global Constraints

- `SESSION_LENGTH=300`, `WARN_AT=240`, `BANNER_AT`, `PROMPT_DURATION=20`, `CHORE3_CAP` unchanged; `src/director/director.test.ts` passes **unmodified** through Stage 6 (Stage 3 may append new tests only).
- Director keeps exactly three chore slots named `mugs|wrappers|laundry` (slot ids ≠ physical chores; nights map them).
- No asset files; no network; all art/audio procedural.
- JS gzip budget: raise to `240 * 1024` in `scripts/check-dist-size.mjs` (Stage 7); must pass.
- Every stage ends: `npm test` green, typecheck green, commit. Browser gates recalibrated only in Stage 7 (unit-level goldens per stage).
- Determinism: `MudwickSim` outcomes are a pure function of (seed, starting character, tick/away/connected inputs). Crowd/chat RNG must be a separate stream with a regression test proving sim-state equality with crowd on/off.
- E2E goldens come from spec §5 derivation (total 54), never from copied actuals.

---

### Stage 1: Career layer

**Files:** Create `src/score/career.ts`, `src/score/career.test.ts`.

**Produces (contract for Stages 2/3/6):**
```ts
export interface AwayPlan { keepWorking: boolean; eatBread: boolean; runHome: boolean; autoSell: boolean }
export interface CareerCharacter { coins: number; xp: Record<SkillName, number>; bridgePass: boolean; awayPlan: AwayPlan }
export interface NightReportSummary { total: number; rows: [number, number, number, number]; endingTitle: string; seed: number; milestones: string[] }
export interface CareerWeek { night: 0|1|2|3|4; suspicionCarry: number; lieDebt: number; reports: NightReportSummary[] }
export interface Career { version: 1; character: CareerCharacter; week: CareerWeek; gallery: string[]; weeksCompleted: { endingId: string; total: number }[] }
export const DEFAULT_AWAY_PLAN: AwayPlan; // {keepWorking:true, eatBread:true, runHome:true, autoSell:false}
export function freshCareer(): Career;
export function loadCareer(storage: ReportHistoryStorage): Career;          // malformed → freshCareer()
export function saveCareer(storage: ReportHistoryStorage, c: Career): boolean;
export function recordNight(c: Career, report: NightReportSummary, suspicionEnd: number, lieDebtDelta: number): Career; // pure; advances night, halves suspicion (round), appends report
export function completeWeek(c: Career, endingId: string, total: number): Career; // archive + reset week, keep character & gallery
```
Storage key `j5mm-career-v1`. Validation: clamp coins 0..MAX_COINS, xp finite ≥0, night 0..4, reports.length === night; any violation → fresh. Tests: round-trip, each malformed field → fresh, recordNight math (suspicion 7 → carry 4), completeWeek keeps character/gallery, write-failure tolerance (throwing storage). Reuse `ReportHistoryStorage` from `history.ts`.

### Stage 2: Sim depth

**Files:** Modify `src/mmo/sim/types.ts`, `src/mmo/sim/sim.ts`, `src/mmo/sim/osrs.ts`; tests in `src/mmo/sim/sim.test.ts` (+ keep existing passing — additive world means east-extension must not move existing spawn/tree/goblin/trader coordinates).

**Type fan-out (single sweep, then fix all compile errors before running tests):**
```ts
type ItemKind = 'log' | 'flax' | 'oakLog' | 'shrimpRaw' | 'shrimpCooked' | 'shrimpBurnt';
type SkillName = 'woodcutting' | 'attack' | 'foraging' | 'fishing';
type QuestKind = 'logs' | 'flax' | 'goblins' | 'shrimp' | 'oakLogs' | 'hobgoblins';
type Intent = ... | { kind: 'fish'; pos: Point } | { kind: 'cook' } | { kind: 'cross' } | { kind: 'reclaim' };
type TileThing = ... | { kind: 'water'; pos: Point } | { kind: 'bridge'; pos: Point } | { kind: 'fishingSpot'; pos: Point } | { kind: 'gravestone'; pos: Point } | { kind: 'toll'; pos: Point };
// Goblin gains tier: 'goblin' | 'hobgoblin' (hp 5, maxHit 2, drops 8..15); Tree gains kind: 'normal' | 'oak' (wc≥5, 15gp, slower).
```
**Sim API additions:**
```ts
constructor(opts?: { seed?: number; character?: { coins: number; xp: Record<SkillName, number>; bridgePass: boolean }; doubleXp?: boolean })
setAwayPlan(p: AwayPlan): void;
setConnected(v: boolean): void;   // false: no player actions/policy; in-combat exception resolves first (spec §1 Phone)
get gravestone(): { pos: Point; items: ItemKind[]; expiresAtTick: number } | null;
get milestones(): readonly string[];  // ids from spec §2 ladder, order of achievement
```
Prices/consts: `OAK_PRICE=15, SHRIMP_PRICE=5, BREAD_PRICE=3, TOLL_COST=10, HOBGOBLIN_MAX_HP=5, GRAVESTONE_TICKS=100, COOK_BURN_CHANCE=0.25 (sim RNG)`. Bread: Wyn sells via trade menu option (buy if coins≥3). Away plan per spec §2 priority list, executed only when `playerAway`. Milestone thresholds per spec §2. XP: fish=10, cook success=+5 fishing; doubleXp doubles all xp gains. `allSkillsAt99`/labels include fishing.
Tests: toll charged once then bridgePass; oak requires wc5; hobgoblin drop range & maxHit; fishing/cook success+burn via seed probe; burn-streak stat; gravestone drop/reclaim/expiry/replacement; away-plan each rule (synthesized intents); connected=false idles except mid-combat; character injection round-trip (start coins/xp respected); doubleXp; determinism golden (seed 0xc0ffee, 200 ticks, hash of state equal with/without crowd flag — crowd added Stage 5, test guards the seam now via an options flag defaulting off).

### Stage 3: Nights + Mum

**Files:** Create `src/director/nights.ts`, `src/director/nights.test.ts`; Modify `src/director/director.ts` (additive only), `src/score/score.ts` types (SessionData fields, formulas land in Stage 6).

**Director additions (append-only):**
```ts
export type LineId = ... | 'inspect';
extendGrace(chore: ChoreId, seconds: number): void;   // pushes that chore's not-yet-fired nag deadline; no-op after fire
fireInspection(): DirectorEvent[];                     // fireLine('inspect'); night layer decides when
// update() additionally emits { type:'promptLeadIn'; lineId: LineId } 1.5s before each scheduled line fire (intro/chores/warn), for footsteps.
```
**nights.ts (pure) contract:**
```ts
export type ChoreVerb = 'carry' | 'tug';
export interface PhysicalChore { id: string; verb: ChoreVerb; label: string; count: number }
export interface NightSpec {
  night: 0|1|2|3|4; title: string; card: string;
  slots: Record<'mugs'|'wrappers'|'laundry', PhysicalChore>;
  beats: { phone?: { at: number; until: number }; inspection?: { at: number; minSuspicion: number }; doubleXp?: boolean };
  lines: Record<LineId, { base: string; tier2: string }>;
  barks: BarkPack; // trigger → [tier0, tier2] strings, per spec §3
}
export const NIGHTS: readonly NightSpec[]; // all five, full text from spec §1/§3
export class MumState {                     // pure arithmetic, spec §3 table
  constructor(carry: number);
  suspicion: number; lieDebt: number;
  onPromptClosed(lineId: LineId, result, option, ctx: { inCombat: boolean; tradedRecently: boolean; usedThisNight: Set<number>; usedArchivistThisWeek: boolean }): { graceExtend?: ChoreId; facts: Partial<SessionFactFlags> };
  onChoreCompleted(): void; onInspection(defused: boolean): void;
  get tier(): 0|1|2|3;  // unbothered/curious/onto you/at the door
}
export class BarkScheduler { /* cooldown 12s, priority below prompts; pick(trigger, tier) → string|null */ }
```
Tests: NIGHTS shape (3 slots each, Fri wrappers count 5); MumState table-driven deltas + clamps + tier bands; "One sec!" grace once per chore; archivist once per week; inspection defuse math; BarkScheduler cooldown/tier pick; director: extendGrace shifts nag, promptLeadIn precedes each fire by 1.5, inspect line integrates with prompt stack; **existing director tests untouched and green**.

### Stage 4: Room verbs & beats

**Files:** Modify `src/host/chores.ts` (+`chores.test.ts`), `src/host/room.ts` (bed corners, curtain rods, landline prop geometry), `src/host/interact.ts` (tug verb, panic verb on monitor), `src/host/app.ts` (night wiring: slot→physical chore map, phone beat → `sim.setConnected`, homework overlay state, dusk light curve, lamp at t=210), `src/session.ts` (career load, night selection, MumState + bark wiring, SessionData assembly).
Tug chore: N interact points, each one-shot `E`, chore completes when all tugged; reuses tracker semantics (`state: 'world'→'placed'` equivalent). Panic verb: `F` key, ungated, either mode → `homeworkUntil = now+3s` (render flag) + arms defuse. Dusk: key light color/intensity lerp over `director.t` (17:25→17:30), lamp emissive on at 210 with bark. Audio hooks land Stage 5.
Tests (vitest, pure parts): chores tug completion; session night-selection given career fixtures.

### Stage 5: Presentation

**Files:** Modify `src/mmo/render/renderer.ts` + `src/mmo/render/game.ts` (zone-2 tiles: water/bridge/oak/hobgoblin/fishing-spot/gravestone sprites — procedural, matching existing style; chat pane 3 lines; away-plan toggle row; disconnect overlay; milestone toasts), Create `src/mmo/render/crowd.ts` (fake players: names list from spec §2, wander on walkable tiles, reactive lines on sim events, separate `mulberry`-style RNG stream seeded `seed^0x5eed`), Modify `src/ui/hud.ts` + `src/ui/style.css` (MUM status line, MSN popup restyle, week title-strip styles), `src/host/app.ts` (audio: panner at monitor world pos + distance lowpass for Mudwick bus; kitchen layer ramp t>240; footsteps on `promptLeadIn`; modem screech on reconnect; MSN doonk on prompt open — extend the existing procedural synth module wherever `Web Audio` lives; locate via `grep -rn "AudioContext" src/`).
Crowd determinism test (completes Stage 2's guard): run sim 200 ticks with crowd attached vs detached, assert identical sim state hash.

### Stage 6: Scoring, verdict, title

**Files:** Modify `src/score/score.ts` (+`score.test.ts`), Create `src/score/week.ts` (+`week.test.ts`), Modify `src/ui/scorecard.ts` (night report additions + Friday verdict view + signature line), `src/ui/title.ts` (week strip, night card, gallery drawer, New Week/Full Reset).
```ts
// score.ts — SessionData gains:
milestones: string[]; suspicionEnd: number;
technicallyTrue: boolean; evidenceBased: boolean; archivist: boolean;
doubleBereavement: boolean; modemScream: boolean; oldestTrick: boolean; shrimpBurnt3: boolean;
// mmo = capped sum of spec §5 milestone values; vibe = clamp(20 - 4*ignored - floor(suspicionEnd/2) + 2*quickStarts)
// week.ts:
export function weekVerdict(reports: NightReportSummary[], lieDebt: number, fridaySuspicion: number): { endingId: string; title: string; blurb: string; stamps: string[] }
```
Ending matrix + overrides verbatim from spec §5 (bands: house avg <15 low, <24 mid, else high; mudwick avg <10 low, <25 mid, else high). Tests: every matrix cell, every override/stamp, worked examples incl. the spec §5 Monday derivation (unit-level twin of the E2E golden: rows [0,30,20,4], total 54).

### Stage 7: Gates, README, ship

**Files:** Modify `scripts/check-dist-size.mjs` (240KB), `scripts/smoke.mjs` (+3 scenarios: week strip renders; disconnect overlay round-trip via `?night=2&t=` dev seams; MSN popup reduced-motion), `scripts/e2e-full.mjs` (Monday goldens from spec §5: rows `['0 / 40','30 / 30','20 / 20','4 / 10']`, total 54, ending unchanged, dinner-fund note retained; keep armed-watcher pattern), `README.md` (week structure, new controls, updated feature list).
Sequence: full `npm run verify` → fix → commit → push → `gh run watch` green → refresh README screenshots via the dev server + Browser pane (title with week strip, verdict card) if time allows.

## Self-review notes

- Spec coverage: §1→Stages 1/3/4, §2→2/5, §3→3/4, §4→4/5, §5→6/7, §6→1, §7→every stage + 7. No gaps found.
- Type consistency: `AwayPlan` defined once (Stage 1) and imported by sim (Stage 2) and UI (Stage 5); `NightReportSummary` shared 1/6; `SessionFactFlags` = the boolean subset of SessionData added in Stage 6, referenced by MumState in Stage 3 — Stage 3 defines the type locally in nights.ts and Stage 6 aliases it to avoid a forward dependency.
- Known risk: `promptLeadIn` must not disturb director goldens — it's a new event type existing tests don't assert on; verify by running the untouched suite first in Stage 3.
