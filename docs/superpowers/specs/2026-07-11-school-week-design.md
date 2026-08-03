# The School Week — Design & Worldbuilding

Status: approved direction 2026-07-11 ("School Week as flagship + Mudwick depth + Mum mechanics + juice pass"), designed for a single continuous build session.

## Vision

Turn one five-minute domestic incident into **one school week in 2004**: five weeknight acts, one persistent Mudwick character, and a Mum whose patience is a save file. Every addition serves the game's single engine — *your body can only be in one world at a time, and both worlds keep moving* — by raising the stakes of where you're standing.

Locked constraints (unchanged from the original design):
- The five-minute act is sacred: `SESSION_LENGTH`, `WARN_AT`, banner timing, and prompt invariants stay exactly as tested.
- Everything runtime-generated. No asset files, no network, no accounts. "Social" is copyable text.
- Max cash stack and 99-all remain absurd. The week adds rungs *below* them, never shortcuts *to* them.
- Static bundle. JS gzip budget is 200 KB (204,800 bytes) in `scripts/check-dist-size.mjs`; we stay under it.

---

## 1. The Week

### Structure

- The career file (localStorage) tracks `night: 0..4` (Mon..Fri). Each play session runs the current night; finishing a night advances it. After Friday's report comes the **Week Verdict**, then the week archives (night resets to Monday; see persistence rules).
- The title screen gains a **week strip**: `MON TUE WED THU FRI` chips showing per-night grades (A ≥ 85, B ≥ 70, C ≥ 55, D ≥ 40, else F), the current night highlighted, plus the night's title card ("TUESDAY — Bins Night").
- **New Week** (after Friday) keeps the Mudwick character; **Full Reset** (small link, confirm step) wipes everything.

### What persists

| Layer | Persists across nights | Resets each night | Persists across weeks |
|---|---|---|---|
| Mudwick character | coins, XP (4 skills), bridge pass, away-plan settings | HP, position, inventory, gravestone, quest-in-progress | yes — the career is forever |
| Mum | suspicion (halved), lie-debt | active prompts | no — new week, clean slate |
| Reports | per-night report stack | — | archived week summaries + ending gallery |

Rationale: inventory/quest resetting per night keeps each act self-contained (and the fiction is "you logged off for dinner"); coins/XP persisting makes remote deaths and toll decisions matter tomorrow. Suspicion halving gives consequence without doom spirals.

### Night scripts (NightSpec data)

Each night = same director skeleton + data: chore set, beats, Mudwick flags, line pack. Chore *types*: `mugs`(3 carries), `wrappers`(4 carries), `laundry`(3 carries), `bed`(2 tug points), `curtains`(2 rod points). Director still requests exactly 3 chore *slots* per night (its tested invariant); a night's chore set defines which chores fill the slots and Friday adds intensity via item counts, not extra slots.

| Night | Title card | Chore slots | Beat | Mudwick | Mum's evening |
|---|---|---|---|---|---|
| Mon | *Casserole* | mugs, wrappers, laundry | — (tutorial toasts: away-plan on first stand-up) | base world | casserole night; she's cheerful |
| Tue | *Bins Night* | mugs, bed, wrappers | — | Wyn mentions the bridge toll | bins go out tonight; references Monday's result |
| Wed | *Auntie Carol* | mugs, laundry, bed | **The Phone**: disconnect t=125→155 | fishing spot busy (cosmetic crowd) | expecting Auntie Carol's call |
| Thu | *Inspection* | wrappers, curtains, laundry | **Inspection** at t=180 if suspicion ≥ 6 | hobgoblins wander nearer the bridge (cosmetic) | she's noticed things |
| Fri | *The Hendersons* | mugs, wrappers, laundry (wrappers count 5) | **Double XP** all session; guest audio downstairs | double XP banner in Mudwick chat | dinner guests; highest stakes |

**The Phone (Wednesday).** Foreshadowed in the intro line. At t=125 a bark fires ("That'll be Auntie Carol — off the internet, please") and Mudwick **disconnects**: the CRT shows the period-perfect `Connection lost. Please wait...` screen. Sim rule (authentic to 2004): you cannot log out in combat — if in combat at disconnect, combat resolves away-style first, *then* the character logs out safely. Reconnect at t=155 with a synthesized modem handshake screech. Standing orders resume on reconnect. Surviving an in-combat disconnect grants comedy fact `modemScream`.

**Inspection (Thursday/Friday).** If suspicion ≥ 6 at t=180: door-open audio + a special prompt `inspect` ("What exactly is happening in here?"). If the **panic verb** (see §3) was armed within the previous 10s, the inspection is defused: suspicion −3, comedy fact `oldestTrick`, and the prompt resolves warm. Otherwise suspicion +2 and vibe −2 (recorded via SessionData). The inspect prompt occupies the normal prompt lane and obeys all existing overlap invariants.

---

## 2. Mudwick Online — the depth pass

### The map grows east

Current world (west side) is untouched — camp, goblins, trees, flax, Wyn, campfire. Add:

- **The river**: a vertical water strip on the east edge of the current map, extended map beyond it (map width grows; all existing tile coordinates unchanged so current goldens describing the west side stay meaningful).
- **Fishing spot** on the *west* bank (pre-toll content): click → `Fish Shrimp`. New skill **fishing**. Catch = raw shrimp (10 fishing XP). Spot never depletes (it's shrimp).
- **The bridge**: one crossing tile with a toll sign. First crossing ever costs **10 gp** (career-persistent `bridgePass`). With pass: free forever. Insufficient funds → examine: *"The troll under this bridge unionised in '02."*
- **East side**: 3 **oak trees** (require woodcutting 5; oak logs sell 15 gp; slower chop cadence) and 2 **hobgoblins** (5 HP, hits up to 2, drops 8–15 gp, aggro radius slightly larger). Oaks and hobgoblins reuse the existing tree/goblin machinery with parameters — new content, no new systems.

Cooking: use the existing **campfire** with raw shrimp → 75% *cooked shrimp* (heals 3, sells 5 gp, +5 fishing XP), 25% *burnt shrimp* (sells 0; examine: *"A war crime with a tail."*). Three consecutive burns → comedy fact `shrimpBurnt3`.

Type fan-out (swept in one pass, compiler-guided): `ItemKind` += `oakLog | shrimpRaw | shrimpCooked | shrimpBurnt`; `SkillName` += `fishing`; `QuestKind` += `shrimp | oakLogs | hobgoblins`; `TileThing` += `water | bridge | fishingSpot | hobgoblin | oak-as-tree-param | gravestone`; `Intent` += `fish | cook | cross | reclaim`. Wyn's contract generator draws only from content the career has unlocked (oak/hob contracts require `bridgePass`).

### Standing orders ("the away plan")

A policy layer over the existing away simulation, configured from a compact toggle row on the Mudwick HUD (`AWAY PLAN: [Keep working] [Eat bread ≤4hp] [Run home <3hp] [Sell when full]`), persisted in the career. Defaults: keep working ON, eat ON, run home ON, sell OFF.

**Defaults revised during build:** all four orders start **OFF**. Opt-in is the strategic act, and the classic hazard — your character blindly finishing the last click while a goblin eats them — stays the baseline experience the away plan exists to solve.

Sim semantics (pure, per tick, only while `playerAway`):
1. **Run home <3hp** (highest priority): drop intent, path to camp tile, goblins deaggro at camp (existing safe-tile behavior).
2. **Eat bread ≤4hp**: if bread in inventory, synthesize `eat` intent.
3. **Sell when full**: on `invFull`, synthesize walk-to-Wyn + `trade`.
4. **Keep working**: on completing a chop/fish/kill, re-acquire the nearest same-kind target; OFF means stand idle after current intent.

Bread becomes purchasable from Wyn (3 gp) so the eat rule has fuel. First stand-up of the career shows a one-time toast: *"Auto-pilot engaged. This is definitely allowed."*

### Gravestones

On death, non-coin inventory drops into a **gravestone** at the death tile (coins keep the existing partial-loss rule). It lasts **100 ticks (60 s)**; walk onto it to reclaim everything. A second death while one stands replaces it — the first is gone (comedy fact `doubleBereavement`). Reclaiming grants milestone `undertaker`. The scorecard's existing remote-death comedy is unchanged; gravestones make the *decision* after the death (rush the recovery vs. do the laundry) the interesting part.

### The crowd (cosmetic layer, hard boundary)

Fake "players" wander the map with 2004-perfect names (`xXslayer99Xx`, `big_dave_2`, `fishwife`, `lord_of_the_dance`, `Gertrude`, `zezima_fan44`) and a 3-line **chat pane** on the Mudwick canvas: ambient lines, reactive lines (a nearby "player" says `lol` when you die; `gz` on a level-up), one scam whisper per session (*"free armour trimming meet me at bridge"*), Friday's double-XP announcements. **Hard rule: the crowd runs on a separate seeded RNG stream and never touches sim state.** Core sim determinism for a given (seed, starting character) is a tested invariant; the crowd is vibes only.

### The milestone ladder

Thresholds over live sim state, surfaced as toasts + report notes + week verdict fuel:

`firstBlood` (first kill) · `pocketMoney` (25 gp) · `twoDinnersAhead` (60 gp) · `dinnerFund` (100 gp, the objective) · `theThousandaire` (1,000 gp) · `contractor` (first contract) · `levelFive` (any skill 5) · `tollPaid` (bridge crossed) · `bullyTheBully` (hobgoblin kill) · `undertaker` (gravestone reclaimed) · `chefActually` (first cooked shrimp)

---

## 3. Mum — suspicion, excuses, and a person on the other side of the door

### Suspicion (0–10)

Starts each night at `round(previousNightEnd / 2)`. Sources:

| Event | Δ |
|---|---|
| Prompt ignored | +2 |
| "One sec!" (any use — it's a lie) | +1 |
| Same excuse reused within a night | +1 |
| "I'm in combat!" (honesty, oddly) | −1 |
| Chore completed | −2 |
| Inspection defused / failed | −3 / +2 |

Clamped 0–10. Surfaced *diegetically*: the room HUD shows `MUM: unbothered / curious / onto you / at the door` (tiers 0–2 / 3–5 / 6–8 / 9–10), her bark tone tier follows it, and Thursday+ it arms the Inspection beat. SessionData records `suspicionEnd` for scoring.

### Excuses get mechanical identity

| Key | Line | Effect |
|---|---|---|
| 1 | "One sec!" | +15 s grace on the active chore (director `extendGrace`, once per chore), suspicion +1, **lie-debt +1** (career, week-scoped) |
| 2 | "I'm in combat!" | suspicion −1; if the sim reports actual combat at that moment → comedy fact `technicallyTrue` |
| 3 | "The economy needs me!" | if a trade happened in the last 20 game-s → comedy fact `evidenceBased`; else suspicion +1 |
| 4 | "It's basically historical preservation!" | comedy fact `archivist` (once per week), suspicion +1 after first weekly use |

Lie-debt ≥ 3 by Friday stamps the week verdict: **"IT WAS NEVER ONE SEC."**

### Barks (reactive lines)

A small pure bark scheduler (director-adjacent) with cooldowns, priority below prompts in the existing dialogue stack, tone tier = suspicion tier. Triggers and representative lines (full packs in `nights.ts` data):

- Chore completed — warm, always: *"Thank you! See, that took eleven seconds."* (Mum is reasonable; warmth is the joke's heart.)
- Lamp beat t=210: *"And turn a light on, you'll ruin your eyes."* (desk lamp auto-on moment)
- Wednesday foreshadow t=20: *"If the phone rings tonight it's Auntie Carol, and I am taking it."*
- Modem reconnect: *"Was that the computer screaming or you?"*
- Post-warn still seated 30 s: tier-0 *"I can hear you clicking."* / tier-2 *"The clicking has been noted for the record."*
- Night-end lines reference the report (delivered on the scorecard as her signature line, per ending).

Prompt lines keep their existing base texts; each gains one tier-2 ("onto you") variant, e.g. mugs: *"The mugs, love. I know you heard me. The door isn't that thick."*

### Mum's week (worldbuilding)

She has her own life running in the barks: Monday's casserole, Tuesday's bins, Wednesday's Auntie Carol (the phone is *her* event, not yours), Thursday she's not angry-she's-curious, Friday the Hendersons are due at seven and she is *hosting*. She is never a villain and never an alarm clock; she's a person who would simply like the mugs back.

---

## 4. The room fights back (gently)

- **New chore verbs** (reuse the interact/raycast pattern; no new carry physics): **bed** = two corner tug points, E each, completes on both; **curtains** = two rod points, E each. Both get procedural geometry on existing furniture.
- **Panic verb**: E on the monitor *while in room mode with a prompt active or inspection incoming* flips the CRT to `homework.doc` (a believable Word-2003-ish full screen render) for 3 s. Arms the inspection defuse. First use: comedy fact `oldestTrick`. Using it costs nothing else — it's a tool and a joke, not a tax.
- **The landline** prop appears near the door Wednesday (it rings; you can't answer it; examine via nothing — it's Mum's).
- **Dusk**: directional + ambient light lerp keyed to `director.t` (17:25 golden → 17:30 dusk); desk lamp emissive turns on at t=210 with its bark. The room ends the night lit by CRT glow and one lamp.
- **Audio as information** (all WebAudio synth): Mudwick's tinny music/SFX routed through a panner at the monitor position with distance lowpass; kitchen-clatter layer from the door direction ramping after t=240; **footsteps 1.5 game-s before every prompt** (the skill-based early warning — new `promptLeadIn` director event); MSN-style *doonk* on prompt open; modem screech on Wednesday reconnect.
- **Prompt UI** restyled as a period instant-messenger popup (CSS only, reduced-motion compliant).

---

## 5. Scoring, the night report, and the Week Verdict

### Night scoring (same 40/30/20/10 frame)

- **Mudwick (0–40)**: milestone-anchored: `pocketMoney` +6, `twoDinnersAhead` +6, `dinnerFund` +10, `contractor` +6, `levelFive` +6, `tollPaid` +3, `bullyTheBully` +3, `undertaker` +2, `chefActually` +2 → capped 40. An unattended session stays ~0; an attentive one lands 25–35; 40 wants the week's unlocks.
- **Household (0–30)**: 8 points per completed chore plus 6 if any prompt answered.
- **Vibe (0–20)**: `20 − 4×ignored − floor(suspicionEnd/2) + 2×quickStarts`, clamped. (Replaces the duplicate-option penalty — that behavior now lives in suspicion via excuse reuse.)
- **Comedy (0–10)**: existing facts + `technicallyTrue`, `evidenceBased`, `archivist`, `doubleBereavement`, `modemScream`, `oldestTrick`, `shrimpBurnt3`, 2 points each, capped.

**E2E golden derivation (Monday, fresh profile, scripted run answering 1,2,3,4,1, all chores, never sits at PC):** mmo 0/40 · household `8×3+6 = 30/30` · vibe: ignored 0; suspicion = +1(one sec) −1(combat lie is honest) +1(economy, no trade) +1(archivist) −6(3 chores) → clamp 0 → `20 − 0 + 2×3 = 26` → **20/20** · comedy: `choresWithoutGlory` + `archivist` = **4/10** · **TOTAL 54/100**, night ending "Employee of the Month (This House)", notes include the 100 gp dinner-fund line. These are the new browser-E2E assertions — derived here, not copied from actuals.

### The Week Verdict (after Friday's report)

Aggregates five nights: grade strip, totals, best category, milestone wall, and an ending from a 3×3 matrix (week household average × week Mudwick milestones, low/mid/high) with overrides:

| | Mudwick LOW | Mudwick MID | Mudwick HIGH |
|---|---|---|---|
| **House LOW** | *The Lost Week* — "Neither world improved. Bold." | *Goblin Widow* — "The goblins know you better than we do." | *Grounded (Worth It)* — "You regret nothing. That's the problem." |
| **House MID** | *Quiet Decline* — "Attendance: yes. Participation: debatable." | *The Negotiator* — "Everyone got something. Nobody got everything." | *Double Agent* — "Two lives, adequately led." |
| **House HIGH** | *Employee of the Month (This House)* — "The fridge gets your photo." | *The Responsible One* — "Suspiciously functional." | *Time Wizard* — "We checked the clocks. Nothing was wrong with the clocks." |

Overrides: Friday suspicion ≥ 8 → *Grounded* variants regardless of column; all 15 chores done → *EVERY CHORE, EVERY NIGHT* stamp added to any ending; `dinnerFund` all five nights → *Reliable Economy* stamp; lie-debt ≥ 3 → *IT WAS NEVER ONE SEC* stamp. Endings collect into a title-screen **gallery** (career).

---

## 6. Persistence & schemas

`career.ts` mirrors `history.ts` discipline exactly: injected `Storage` interface, versioned envelope, validating parser that returns `undefined` on any malformed field (fresh career), write-failure tolerance.

```ts
// localStorage key: 'j5mm-career-v1'
interface StoredCareer {
  version: 1;
  character: {
    coins: number;                       // 0..MAX_COINS
    xp: Record<SkillName, number>;       // all 4 skills
    bridgePass: boolean;
    awayPlan: { keepWorking: boolean; eatBread: boolean; runHome: boolean; autoSell: boolean };
  };
  week: {
    night: 0 | 1 | 2 | 3 | 4;
    suspicionCarry: number;              // 0..10
    lieDebt: number;
    archivistUsed: boolean;
    reports: NightReportSummary[];       // length === night, or 5 when night === 4 and verdict pending
  };
  tutorials: {
    awayPlanSeen: boolean;
  };
  gallery: string[];                     // ending ids
  weeksCompleted: { endingId: string; total: number }[];
}
```

`history.ts` (run counter / PB) is unchanged and continues to work alongside.

Seeds: production nights roll random seeds (existing behavior), `?seed=` still overrides, the report still prints it. Sim determinism contract becomes *(seed, starting character)* → identical outcome; the crowd's separate RNG stream is excluded from that contract by design.

## 7. Test & verification strategy

- **Pure layers first**: `career` (parse/migrate/clamp), `sim` (fishing/cooking/gravestone/away-plan/toll/hobgoblin goldens; determinism test asserting the crowd RNG does not perturb sim state), `nights` (NightSpec resolution, suspicion arithmetic, excuse effects, bark cooldowns, inspection arming), `score` (new formulas, worked examples from §5).
- **Director invariants untouched**: existing `director.test.ts` must pass without edits (nights layer on top; `extendGrace` and `promptLeadIn` get new tests).
- **Browser smoke** additions: week strip renders; disconnect overlay appears and clears; panic verb flips the CRT; prompt popup respects reduced motion.
- **Browser E2E**: same Monday full-loop with §5's derived goldens; runs on a fresh profile (E2E already uses an isolated context). The armed-watcher prompt pattern from the CI fix is retained.
- **Gates**: `npm run verify` green locally; CI green; JS gzip ≤ 200 KB (204,800 bytes).

## 8. Out of scope (explicitly)

Multiplayer/backends/accounts; mobile touch mode; the cat (stretch, another day); new 3D fidelity work beyond the dusk/lamp pass; lengthening the session; hidden-chore *discovery* mechanics (Thursday's under-bed wrappers are just low); fishing spot depletion; a fourth prompt-answer meta-layer. YAGNI applies to all of it.

## 9. Build order

1. Career layer → 2. Sim depth → 3. Nights + Mum → 4. Room verbs/beats → 5. Mudwick presentation → 6. Scoring/verdict/title → 7. Golden recalibration, README, verify, ship. Each stage lands with its tests green before the next begins.
