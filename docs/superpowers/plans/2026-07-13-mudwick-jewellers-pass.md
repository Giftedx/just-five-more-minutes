# Mudwick Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise Mudwick's tiny character, combat, and status readability to the finish level of the polished bedroom without changing simulation, input, timing, layout, or the runtime-generated art identity.

**Architecture:** Keep reusable one-pixel art in `sprites.ts`, select it from the existing renderer, and pin visual topology with pure unit tests before production code changes. Preserve the renderer's 320x240 composition and event-driven feedback; this tranche replaces weak sprite data, not renderer architecture.

**Tech Stack:** TypeScript 7, Canvas 2D, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.4

**Status:** Implemented by commits 719d385, 4c44aab, and 249da15, then extended with target-facing attacks in 4f93ee3 and 2bb4fc1. The checklist below is the retained execution record; the current tree's sprite topology tests and renderer paths are authoritative.

## Global Constraints

- Add no external asset, texture file, font, package, shader, filter, offscreen animation loop, event listener, timer, or simulation state.
- Change no map, pathfinding, damage, XP, economy, quest, click target, input, director, score, persistence, or audio behavior.
- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, the 80-pixel side panel, and `imageSmoothingEnabled = false`.
- Preserve render order, the existing 220ms `swingUntil`, all hit/particle/reward timing, panel coordinates, two rows of five HP icons, and the current objective/chat/menu geometry.
- Sprite rows may use only declared palette keys; transparent cells remain `.`.
- The attack sprite contains weapon pixels that the idle sprite does not contain and stays at or below 16 pixels wide.
- Hobgoblin row data differs structurally from ordinary goblin row data and remains 12 by 14 pixels.
- Full and empty heart sprites share identical non-transparent topology and remain 7 by 7 pixels.
- Modify only `src/mmo/render/sprites.ts`, `src/mmo/render/renderer.ts`, `src/mmo/render/sprites.test.ts`, and task documentation unless fresh visual evidence proves a directly related defect.
- Do not update curated README screenshots until the final production captures pass visual review.

---

## File responsibilities

- `src/mmo/render/sprites.ts` owns reusable player, trader, goblin, hobgoblin, and HP pixel data plus the `drawSprite` primitive.
- `src/mmo/render/renderer.ts` owns draw order, animation selection, panel placement, and simulation/event integration.
- `src/mmo/render/sprites.test.ts` owns pure topology, dimensions, palette coverage, facial-cue, weapon, and silhouette-distinction contracts.
- `scripts/smoke.mjs` remains unchanged; its current PC-mode cadence and full lifecycle scenarios provide integration coverage.

### Task 1: Repair human faces and the missing attack weapon

**Files:**
- Create: `src/mmo/render/sprites.test.ts`
- Modify: `src/mmo/render/sprites.ts:1-104`

**Interfaces:**
- Consumes: `Sprite`, `PLAYER_SPRITE`, `PLAYER_ATTACK_SPRITE`, and `TRADER_SPRITE`.
- Produces: idle/trader facial cues and a registered 16-by-14 attack sprite with weapon palette keys `w` and `g`.

- [ ] **Step 1: Write the failing human-sprite contracts**

Create `src/mmo/render/sprites.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  PLAYER_ATTACK_SPRITE,
  PLAYER_SPRITE,
  TRADER_SPRITE,
  type Sprite,
} from './sprites';

function usedKeys(sprite: Sprite): Set<string> {
  return new Set(sprite.rows.join('').replaceAll('.', '').split(''));
}

function expectPaletteComplete(sprite: Sprite): void {
  for (const key of usedKeys(sprite)) expect(sprite.palette[key]).toBeTypeOf('string');
}

describe('Mudwick sprite finish contracts', () => {
  it('keeps human idle sprites registered and gives their faces eyes', () => {
    expect(PLAYER_SPRITE.rows).toHaveLength(14);
    expect(new Set(PLAYER_SPRITE.rows.map((row) => row.length))).toEqual(new Set([12]));
    expect(TRADER_SPRITE.rows).toHaveLength(14);
    expect(new Set(TRADER_SPRITE.rows.map((row) => row.length))).toEqual(new Set([12]));
    expect(PLAYER_SPRITE.rows.join('')).toContain('e');
    expect(TRADER_SPRITE.rows.join('')).toContain('e');
    expectPaletteComplete(PLAYER_SPRITE);
    expectPaletteComplete(TRADER_SPRITE);
  });

  it('renders a bounded attack weapon that never appears in idle', () => {
    const attack = PLAYER_ATTACK_SPRITE.rows.join('');
    const idle = PLAYER_SPRITE.rows.join('');
    expect(PLAYER_ATTACK_SPRITE.rows).toHaveLength(14);
    expect(new Set(PLAYER_ATTACK_SPRITE.rows.map((row) => row.length))).toEqual(new Set([16]));
    expect(attack.match(/w/g)).toHaveLength(4);
    expect(attack.match(/g/g)).toHaveLength(1);
    expect(idle).not.toMatch(/[wg]/);
    expectPaletteComplete(PLAYER_ATTACK_SPRITE);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npx vitest run src/mmo/render/sprites.test.ts`

Expected: two failing tests. The human-face test fails because neither current sprite uses `e`; the attack test fails because the declared weapon colour is unused and current rows are not uniformly 16 pixels wide.

- [ ] **Step 3: Add player/trader eyes and the real attack frame**

In `PLAYER_SPRITE.palette`, add:

```ts
    e: '#2e2218', // eyes
```

Replace the fourth player row (`...ssssss...`) with:

```ts
    '...sesse....',
```

Replace `PLAYER_ATTACK_SPRITE` with:

```ts
export const PLAYER_ATTACK_SPRITE: Sprite = {
  palette: {
    h: '#8a5a2b',
    s: '#e0b088',
    e: '#2e2218',
    b: '#3a5a9c',
    d: '#2c4377',
    l: '#5a4632',
    k: '#2e2218',
    w: '#d5d0c2',
    g: '#7a4d28',
  },
  rows: [
    '....hhhh........',
    '...hhhhhh.......',
    '...hssssh.......',
    '...sesse........',
    '....ssss......w.',
    '...bbbbbb....w..',
    '..bbbbbbbb..w...',
    '..sbbddbbs.w....',
    '..sbbddbbsg.....',
    '...bbbbbb.......',
    '...llllll.......',
    '...ll..ll.......',
    '...kk..kk.......',
    '...kk..kk.......',
  ],
};
```

In `TRADER_SPRITE.palette`, add:

```ts
    e: '#3b2a1f', // eyes
```

Replace the fourth trader row (`...hssssh...`) with:

```ts
    '...sesse....',
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npx vitest run src/mmo/render/sprites.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Run all unit tests and commit**

Run: `npm test`

Expected: 16 files / 200 tests pass.

```powershell
git add src/mmo/render/sprites.ts src/mmo/render/sprites.test.ts
git commit -m "feat: refine Mudwick human action sprites"
```

### Task 2: Give hobgoblins and health distinct silhouettes

**Files:**
- Modify: `src/mmo/render/sprites.test.ts`
- Modify: `src/mmo/render/sprites.ts:75-end`
- Modify: `src/mmo/render/renderer.ts:27-41,56-64,1148-1172,1453-1471`

**Interfaces:**
- Consumes: `drawSprite(ctx, sprite, px, py)` and the existing goblin draw/HP placement paths.
- Produces: `HOB_SPRITE`, `HOB_ANGRY_SPRITE`, `HP_FULL_SPRITE`, and `HP_EMPTY_SPRITE` from the shared sprite module.

- [ ] **Step 1: Extend the test imports**

Replace the import block in `sprites.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import {
  GOBLIN_SPRITE,
  HOB_ANGRY_SPRITE,
  HOB_SPRITE,
  HP_EMPTY_SPRITE,
  HP_FULL_SPRITE,
  PLAYER_ATTACK_SPRITE,
  PLAYER_SPRITE,
  TRADER_SPRITE,
  type Sprite,
} from './sprites';
```

- [ ] **Step 2: Add the failing enemy and heart contracts**

Append inside the existing `describe` block:

```ts
  it('gives hobgoblins a structural silhouette beyond recolouring', () => {
    expect(HOB_SPRITE.rows).toHaveLength(14);
    expect(new Set(HOB_SPRITE.rows.map((row) => row.length))).toEqual(new Set([12]));
    expect(HOB_SPRITE.rows).not.toEqual(GOBLIN_SPRITE.rows);
    expect(HOB_SPRITE.rows.join('')).toContain('t');
    expect(HOB_SPRITE.rows.join('')).toContain('a');
    expect(HOB_ANGRY_SPRITE.rows).toEqual(HOB_SPRITE.rows);
    expect(HOB_ANGRY_SPRITE.palette.y).not.toBe(HOB_SPRITE.palette.y);
    expectPaletteComplete(HOB_SPRITE);
    expectPaletteComplete(HOB_ANGRY_SPRITE);
  });

  it('uses matching seven-pixel topology for full and empty hearts', () => {
    const topology = (sprite: Sprite): string[] => sprite.rows.map((row) =>
      [...row].map((key) => key === '.' ? '.' : '#').join(''));
    for (const sprite of [HP_FULL_SPRITE, HP_EMPTY_SPRITE]) {
      expect(sprite.rows).toHaveLength(7);
      expect(new Set(sprite.rows.map((row) => row.length))).toEqual(new Set([7]));
      expectPaletteComplete(sprite);
    }
    expect(topology(HP_FULL_SPRITE)).toEqual(topology(HP_EMPTY_SPRITE));
    expect(HP_FULL_SPRITE.rows).not.toEqual(HP_EMPTY_SPRITE.rows);
  });
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npx vitest run src/mmo/render/sprites.test.ts`

Expected: import/compile failure because the four new shared exports do not exist.

- [ ] **Step 4: Add shared hobgoblin variants**

Append after `GOBLIN_ANGRY_SPRITE` in `sprites.ts`:

```ts
export const HOB_SPRITE: Sprite = {
  palette: {
    g: '#a8703c',
    e: '#7a4e26',
    r: '#5a3a7a',
    y: '#e8d44f',
    k: '#2a2018',
    a: '#5b5360',
    t: '#e6d9b8',
  },
  rows: [
    '.a........a.',
    'aa.gggggg.aa',
    '.agggggggga.',
    '..gygggygg..',
    '..gtgggtgg..',
    '..gggkkggg..',
    '..aaggggaa..',
    '.aaaggggaaa.',
    '..a.rrrr.a..',
    '....rrrr....',
    '....g..g....',
    '...gg..gg...',
    '...aa..aa...',
    '............',
  ],
};

export const HOB_ANGRY_SPRITE: Sprite = {
  ...HOB_SPRITE,
  palette: { ...HOB_SPRITE.palette, y: '#ff6040' },
};
```

- [ ] **Step 5: Add shared full and empty hearts**

Append after the hobgoblin variants:

```ts
export const HP_FULL_SPRITE: Sprite = {
  palette: { r: '#c03030', l: '#e87a7a', d: '#7a2020' },
  rows: [
    '.rr.rr.',
    'lrrrrrr',
    'rrrrrrr',
    '.rrrrr.',
    '..rrr..',
    '...r...',
    '...d...',
  ],
};

export const HP_EMPTY_SPRITE: Sprite = {
  palette: { e: '#705848', d: '#4a3a26' },
  rows: [
    '.ee.ee.',
    'eeeeeee',
    'eeeeeee',
    '.eeeee.',
    '..eee..',
    '...e...',
    '...d...',
  ],
};
```

- [ ] **Step 6: Replace renderer-local hobgoblins with shared sprites**

Delete the renderer-local `HOB_SPRITE` and `HOB_ANGRY_SPRITE` constants at lines 33-41.

Replace the sprite import with:

```ts
import {
  drawSprite,
  GOBLIN_ANGRY_SPRITE,
  GOBLIN_SPRITE,
  HOB_ANGRY_SPRITE,
  HOB_SPRITE,
  HP_EMPTY_SPRITE,
  HP_FULL_SPRITE,
  PLAYER_ATTACK_SPRITE,
  PLAYER_SPRITE,
  TRADER_SPRITE,
  type Sprite,
} from './sprites';
```

Keep `drawGoblins` selection unchanged:

```ts
      const sprite = hob
        ? g.aggro ? HOB_ANGRY_SPRITE : HOB_SPRITE
        : g.aggro ? GOBLIN_ANGRY_SPRITE : GOBLIN_SPRITE;
```

- [ ] **Step 7: Replace the circular HP bank with hearts**

Replace the body of the existing `for (let i = 0; i < PLAYER_MAX_HP; i++)` loop with:

```ts
      const ox = hpX + (i % 5) * hpPitch;
      const oy = i < 5 ? PL.hpR1 : PL.hpR2;
      drawSprite(ctx, i < hp ? HP_FULL_SPRITE : HP_EMPTY_SPRITE, ox - 3, oy - 3);
```

- [ ] **Step 8: Run focused and full unit verification**

Run: `npx vitest run src/mmo/render/sprites.test.ts`

Expected: 4 tests pass.

Run: `npm test`

Expected: 16 files / 202 tests pass.

- [ ] **Step 9: Build and commit**

Run: `npm run build`

Expected: TypeScript and Vite production build pass.

```powershell
git add src/mmo/render/sprites.ts src/mmo/render/sprites.test.ts src/mmo/render/renderer.ts
git commit -m "feat: finish Mudwick combat and health silhouettes"
```

### Task 3: Production visual calibration and game-wide proof

**Files:**
- Modify only if rendered evidence exposes a defect: `src/mmo/render/sprites.ts`
- Modify only if rendered evidence exposes a panel-placement defect: `src/mmo/render/renderer.ts`

**Interfaces:**
- Consumes: final production build and existing game/dev routes.
- Produces: fresh title/room/PC/Mum/report captures, matched PC-mode cadence evidence, full release proof, and locally integrated `master`.

- [ ] **Step 1: Capture the three affected views**

Start an owned production preview on a verified free loopback port. With Playwright CLI, capture:

```text
output/playwright/mudwick-jewellers/title-1440.png
output/playwright/mudwick-jewellers/room-crt-1280.png
output/playwright/mudwick-jewellers/pc-mode-1440.png
```

Use the live title for the first image, `?skipTitle=1&seed=0xC0FFEE` for room/PC mode, and the real `E` interaction path to enter PC mode. Do not fake the canvas with a separate dev page for final evidence.

- [ ] **Step 2: Capture actual combat and status states**

Use the deterministic seed and real canvas input to reach or invoke a goblin fight. Capture one frame during `playerSwing`, one with a hobgoblin visible on the far bank if reachable without changing progression, and one at partially depleted HP. Save ignored evidence under the same output directory.

Reject the candidate if the sword detaches from the hand, eye pixels resemble holes, hob armour exceeds its tile, tusks resemble eyes, hearts resemble flowers, full/empty topology shifts the panel, the title CRT becomes noisy, or microdetail competes with chat/objective text.

- [ ] **Step 3: Calibrate only observed defects**

Change only sprite rows, palette values, or the existing HP `ox/oy` offsets. Add no new effect or system. After each source edit, rerun the focused test, rebuild, and recapture the affected state.

- [ ] **Step 4: Compare matched renderer cadence**

Profile baseline and candidate full PC mode in both execution orders, using five 500ms requestAnimationFrame samples after a two-second warm-up at 1280x720. Record median FPS. The candidate must show no repeatable regression above 2%; pure sprite data should be effectively free.

- [ ] **Step 5: Recapture and audit unaffected surfaces**

Capture title, bedroom, Mum dialogue, blocked-device gate, pause overlay, reduced-motion title, and scorecard. Confirm no layout, focus, motion, colour hierarchy, or timing regression. Do not edit surfaces that pass.

- [ ] **Step 6: Red-team the implementation**

Verify palette completeness, row dimensions, structural hob distinction, heart topology, attack-only weapon pixels, renderer selection, unchanged timers, unchanged simulation/input diffs, no new assets/dependencies, no browser artefacts staged, and no performance-budget regression.

- [ ] **Step 7: Run the complete release gate**

Run: `npm run verify`

Expected: 16 files / 202 unit tests, standalone build, compressed JS/CSS budgets, 17 browser scenarios, full interaction E2E, and mounted `/just-five-more-minutes/` build all pass.

- [ ] **Step 8: Append and validate the required reflection**

Use `apply_patch` to append one JSON object to `reflections.jsonl` in the agent's own memory directory. Use exact keys `date`, `task`, `outcome`, `surprise`, and `next-time`. Parse every non-empty line. Select the exact task string. Assert all five keys.

- [ ] **Step 9: Commit any evidence-driven calibration**

```powershell
git add src/mmo/render/sprites.ts src/mmo/render/renderer.ts src/mmo/render/sprites.test.ts
git commit -m "fix: calibrate Mudwick microdetail"
```

Skip this commit when visual calibration changes no tracked source.

- [ ] **Step 10: Integrate and clean up**

Fast-forward the verified isolated branch onto `master`, rerun `npm run verify` on the merged tree, remove the task-owned worktree and feature branch, close owned browser sessions, stop only owned preview processes, and confirm a clean status. Do not pull, push, or deploy without a separate request.
