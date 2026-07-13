# Directional Combat Jeweller's Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Mudwick player swing point toward its actual goblin target while preserving the registered body, 220ms timing, simulation, input, layout, and procedural pixel-art identity.

**Architecture:** Build four 16-by-14 attack sprites from the unchanged idle body plus five directional weapon pixels. Derive direction from the existing `playerSwing.goblinId` at event-consumption time, latch it as renderer-only state, and select the matching sprite during the existing `swingUntil` window.

**Tech Stack:** TypeScript 7, Canvas 2D, Vitest 4.1.10, Playwright 1.61.1, Vite 8.1.4

## Global Constraints

- Add no asset, dependency, texture, animation timer, event listener, input, simulation field, or persisted field.
- Preserve `CANVAS_W = 320`, `CANVAS_H = 240`, `VIEW_W = 240`, the 80-pixel side panel, and `imageSmoothingEnabled = false`.
- Preserve `swingUntil = now + 220` and all hitsplat, XP-drop, particle, reward, chat, and camera timing.
- Preserve terrain, enemy, player, effect, overlay, and panel draw order.
- Keep every attack sprite exactly 16 columns by 14 rows.
- Keep every non-weapon attack-body pixel registered to the idle body.
- Every attack sprite contains exactly four `w` blade pixels and one `g` hilt pixel; no weapon pixel overwrites the body.
- A diagonal tie prefers east or west; a zero delta returns `null` and preserves the renderer's previous direction.
- Do not modify title, bedroom, Mum, HUD, gate, pause, scorecard, audio, map, pathfinding, damage, XP, economy, quest, input, director, score, persistence, package, or lock files.
- Do not stage production captures or Playwright session artefacts.

---

## File responsibilities

- `src/mmo/render/sprites.ts` owns the direction type, pure delta resolver, registered attack-body composition, and four immutable directional sprites.
- `src/mmo/render/sprites.test.ts` owns direction resolution, dimensions, weapon counts, palette coverage, directional extent, and exact body-registration contracts.
- `src/mmo/render/renderer.ts` owns event-time direction latching and sprite selection inside the existing swing window.
- The production browser suite remains the integration and lifecycle gate; no debug-only export is added.

### Task 1: Compose and prove four registered attack sprites

**Files:**
- Modify: `src/mmo/render/sprites.test.ts:1-43`
- Modify: `src/mmo/render/sprites.ts:56-85`

**Interfaces:**
- Consumes: `PLAYER_SPRITE` and `Sprite`.
- Produces: `AttackDirection`, `attackDirectionForDelta(dx: number, dy: number): AttackDirection | null`, and `PLAYER_ATTACK_SPRITES: Readonly<Record<AttackDirection, Sprite>>`.

- [ ] **Step 1: Replace the attack-sprite test import**

Replace `PLAYER_ATTACK_SPRITE` in the existing import block with these names:

```ts
  attackDirectionForDelta,
  PLAYER_ATTACK_SPRITES,
  type AttackDirection,
```

- [ ] **Step 2: Replace the single east-only attack test with failing directional contracts**

Replace the existing `renders a bounded attack weapon that never appears in idle` test with:

```ts
  it('resolves cardinal and diagonal target deltas without inventing zero-delta movement', () => {
    expect(attackDirectionForDelta(0, -1)).toBe('north');
    expect(attackDirectionForDelta(1, 0)).toBe('east');
    expect(attackDirectionForDelta(0, 1)).toBe('south');
    expect(attackDirectionForDelta(-1, 0)).toBe('west');
    expect(attackDirectionForDelta(1, -1)).toBe('east');
    expect(attackDirectionForDelta(-1, 1)).toBe('west');
    expect(attackDirectionForDelta(0, 0)).toBeNull();
  });

  it('keeps one registered body while placing five weapon pixels in each direction', () => {
    const embeddedIdle = PLAYER_SPRITE.rows.map((row) => `..${row}..`);
    const entries = Object.entries(PLAYER_ATTACK_SPRITES) as [AttackDirection, Sprite][];
    expect(entries.map(([direction]) => direction)).toEqual(['north', 'east', 'south', 'west']);

    for (const [, sprite] of entries) {
      const flattened = sprite.rows.join('');
      expect(sprite.rows).toHaveLength(14);
      expect(new Set(sprite.rows.map((row) => row.length))).toEqual(new Set([16]));
      expect(flattened.match(/w/g)).toHaveLength(4);
      expect(flattened.match(/g/g)).toHaveLength(1);
      expect(sprite.rows.map((row) => row.replaceAll(/[wg]/g, '.'))).toEqual(embeddedIdle);
      expectPaletteComplete(sprite);
    }

    const weaponPixels = (direction: AttackDirection): { x: number; y: number }[] =>
      PLAYER_ATTACK_SPRITES[direction].rows.flatMap((row, y) =>
        [...row].flatMap((key, x) => key === 'w' || key === 'g' ? [{ x, y }] : []));
    expect(weaponPixels('east').every(({ x }) => x >= 12)).toBe(true);
    expect(weaponPixels('west').every(({ x }) => x <= 3)).toBe(true);
    expect(weaponPixels('north').every(({ y }) => y <= 7)).toBe(true);
    expect(weaponPixels('south').every(({ y }) => y >= 8)).toBe(true);
    expect(PLAYER_SPRITE.rows.join('')).not.toMatch(/[wg]/);
  });
```

- [ ] **Step 3: Run the focused test and verify RED**

Run: `npx vitest run src/mmo/render/sprites.test.ts`

Expected: import/compile failure because `attackDirectionForDelta`, `PLAYER_ATTACK_SPRITES`, and `AttackDirection` do not exist.

- [ ] **Step 4: Replace the east-only sprite with pure directional composition**

Replace `PLAYER_ATTACK_SPRITE` in `sprites.ts` with:

```ts
export type AttackDirection = 'north' | 'east' | 'south' | 'west';

export function attackDirectionForDelta(dx: number, dy: number): AttackDirection | null {
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'west' : 'east';
  return dy < 0 ? 'north' : 'south';
}

const PLAYER_ATTACK_PALETTE: Sprite['palette'] = {
  ...PLAYER_SPRITE.palette,
  w: '#d5d0c2',
  g: '#7a4d28',
};

type WeaponPixel = readonly [x: number, y: number, key: 'w' | 'g'];

const ATTACK_WEAPON_PIXELS: Readonly<Record<AttackDirection, readonly WeaponPixel[]>> = {
  north: [[12, 3, 'w'], [12, 4, 'w'], [12, 5, 'w'], [12, 6, 'w'], [12, 7, 'g']],
  east: [[15, 4, 'w'], [14, 5, 'w'], [13, 6, 'w'], [12, 7, 'w'], [12, 8, 'g']],
  south: [[12, 8, 'g'], [12, 9, 'w'], [12, 10, 'w'], [12, 11, 'w'], [12, 12, 'w']],
  west: [[0, 4, 'w'], [1, 5, 'w'], [2, 6, 'w'], [3, 7, 'w'], [3, 8, 'g']],
};

function makePlayerAttackSprite(weapon: readonly WeaponPixel[]): Sprite {
  const rows = PLAYER_SPRITE.rows.map((row) => [...`..${row}..`]);
  for (const [x, y, key] of weapon) {
    const row = rows[y];
    if (!row || row[x] !== '.') throw new Error(`attack weapon overlaps body at ${x},${y}`);
    row[x] = key;
  }
  return { palette: PLAYER_ATTACK_PALETTE, rows: rows.map((row) => row.join('')) };
}

export const PLAYER_ATTACK_SPRITES: Readonly<Record<AttackDirection, Sprite>> = {
  north: makePlayerAttackSprite(ATTACK_WEAPON_PIXELS.north),
  east: makePlayerAttackSprite(ATTACK_WEAPON_PIXELS.east),
  south: makePlayerAttackSprite(ATTACK_WEAPON_PIXELS.south),
  west: makePlayerAttackSprite(ATTACK_WEAPON_PIXELS.west),
};
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npx vitest run src/mmo/render/sprites.test.ts`

Expected: 5 tests pass.

- [ ] **Step 6: Run all unit tests and commit**

Run: `npm test`

Expected: 16 files / 203 tests pass.

```powershell
git add src/mmo/render/sprites.ts src/mmo/render/sprites.test.ts
git commit -m "feat: compose directional Mudwick attack sprites"
```

### Task 2: Latch target direction during the existing swing event

**Files:**
- Modify: `src/mmo/render/renderer.ts:46-58,188-207,345-356,774-785`

**Interfaces:**
- Consumes: `AttackDirection`, `attackDirectionForDelta`, and `PLAYER_ATTACK_SPRITES` from Task 1.
- Produces: renderer-only `swingDirection` state selected from the target delta during `playerSwing`.

- [ ] **Step 1: Replace the attack sprite import**

Replace `PLAYER_ATTACK_SPRITE` in the sprite import with:

```ts
  attackDirectionForDelta,
  PLAYER_ATTACK_SPRITES,
  type AttackDirection,
```

- [ ] **Step 2: Add renderer-only direction state**

Immediately after `private swingUntil = 0;`, add:

```ts
  private swingDirection: AttackDirection = 'east';
```

- [ ] **Step 3: Latch the direction while the target still exists**

Inside `case 'playerSwing'`, immediately after `if (g) {`, add:

```ts
            const direction = attackDirectionForDelta(
              g.pos.x - this.sim.player.pos.x,
              g.pos.y - this.sim.player.pos.y,
            );
            if (direction) this.swingDirection = direction;
```

Keep the existing displayed-position lookup, hitsplat push, `this.swingUntil = now + 220`, and XP-drop logic unchanged.

- [ ] **Step 4: Select the latched sprite without moving the body**

Replace the current player `drawSprite` call with:

```ts
    const swinging = now < this.swingUntil;
    const playerSprite = swinging ? PLAYER_ATTACK_SPRITES[this.swingDirection] : PLAYER_SPRITE;
    drawSprite(
      ctx,
      playerSprite,
      Math.round(pd.x) + (swinging ? 0 : 2),
      Math.round(pd.y) + 1 - pBob,
    );
```

The attack body is embedded two pixels into the 16-column frame, so attack origin `pd.x` and idle origin `pd.x + 2` place every body pixel identically.

- [ ] **Step 5: Run focused and full unit verification**

Run: `npx vitest run src/mmo/render/sprites.test.ts`

Expected: 5 tests pass.

Run: `npm test`

Expected: 16 files / 203 tests pass.

- [ ] **Step 6: Build and inspect the exact diff**

Run: `npm run build`

Expected: TypeScript and the Vite production build pass.

Run:

```powershell
git diff --check
git diff -- src/mmo/render/sprites.ts src/mmo/render/sprites.test.ts src/mmo/render/renderer.ts
```

Confirm no timer, event shape, simulation, input, map, package, or lock-file diff exists.

- [ ] **Step 7: Commit renderer integration**

```powershell
git add src/mmo/render/renderer.ts
git commit -m "feat: aim Mudwick swings at their targets"
```

### Task 3: Four-direction production proof and release closeout

**Files:**
- Modify only if fresh evidence exposes a directly related defect: `src/mmo/render/sprites.ts`
- Modify only if body registration or event-time selection is wrong: `src/mmo/render/renderer.ts`

**Interfaces:**
- Consumes: final production build and the existing real PC-mode route.
- Produces: four native-canvas direction captures, one physical-CRT capture, matched cadence evidence, adversarial review, full release proof, and locally integrated `master`.

- [ ] **Step 1: Capture north, east, south, and west swings**

Start an owned production preview on a verified free loopback port. Use the real app with `?skipTitle=1&seed=0xC0FFEE`, enter PC mode, place a live hobgoblin adjacent on each cardinal side, invoke the existing attack intent, wait for the real `playerSwing`, and capture:

```text
output/playwright/directional-combat/north-canvas.png
output/playwright/directional-combat/east-canvas.png
output/playwright/directional-combat/south-canvas.png
output/playwright/directional-combat/west-canvas.png
output/playwright/directional-combat/physical-crt.png
```

Do not set `swingUntil` or `swingDirection` directly. The final evidence must pass through `commandIntent`, simulation stepping, event consumption, and renderer selection.

- [ ] **Step 2: Reject visual defects and calibrate only weapon pixels**

At native canvas scale, reject a direction if the weapon detaches from the hand, crosses the face, overwrites tunic or legs, extends beyond one adjacent tile, becomes less visible than the hitsplat, or makes any body pixel jump relative to idle. Change only `ATTACK_WEAPON_PIXELS` coordinates or blade/hilt palette values, then rerun focused tests, rebuild, and recapture all invalidated directions.

- [ ] **Step 3: Prove event edge cases**

Exercise a killing swing and confirm the latched direction survives target death for the remainder of the 220ms window. Exercise diagonal adjacency and confirm the horizontal tie rule. Confirm a missing goblin lookup and zero delta leave the last valid direction unchanged without throwing.

- [ ] **Step 4: Compare matched renderer cadence**

Profile baseline and candidate full PC mode in both execution orders using five 500ms requestAnimationFrame samples after a two-second warm-up at 1280x720. Record median FPS. Reject a repeatable candidate regression above two percent.

- [ ] **Step 5: Red-team the implementation**

Verify all four weapon extents, exact body registration, palette completeness, event-time latching, target-death behaviour, diagonal tie behaviour, zero/missing-target fallback, unchanged 220ms timing, unchanged simulation/input/event schemas, no new dependencies/assets, no staged browser artefacts, and no frame-budget regression.

- [ ] **Step 6: Run the complete release gate**

Run: `npm run verify`

Expected: 16 files / 203 unit tests, standalone build, compressed JS/CSS budgets, 17 browser scenarios, full interaction E2E, and mounted `/just-five-more-minutes/` build all pass.

- [ ] **Step 7: Append and validate the required reflection**

Append one JSON object with exact keys `date`, `task`, `outcome`, `surprise`, and `next-time` to `C:\Users\aggis\.Codex\memory\reflections.jsonl` using `apply_patch`. Parse every non-empty line, select the exact task string, and assert all five keys.

- [ ] **Step 8: Commit evidence-driven calibration if needed**

```powershell
git add src/mmo/render/sprites.ts src/mmo/render/sprites.test.ts src/mmo/render/renderer.ts
git commit -m "fix: calibrate directional combat microdetail"
```

Skip this commit when production capture requires no tracked-source calibration.

- [ ] **Step 9: Integrate and clean up**

Fast-forward the verified isolated branch onto `master`, rerun `npm run verify` on the merged tree, remove the task-owned worktree and feature branch, close owned browser sessions, stop only owned preview processes, and confirm a clean status. Do not pull, push, or deploy.
