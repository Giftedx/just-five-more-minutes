import { describe, expect, it } from 'vitest';
import {
  attackDirectionForDelta,
  GOBLIN_SPRITE,
  HOB_ANGRY_SPRITE,
  HOB_SPRITE,
  HP_EMPTY_SPRITE,
  HP_FULL_SPRITE,
  PLAYER_ATTACK_SPRITES,
  PLAYER_SPRITE,
  TRADER_SPRITE,
  type AttackDirection,
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

  it('gives hobgoblins a structural silhouette beyond recolouring', () => {
    expect(HOB_SPRITE.rows).toHaveLength(14);
    expect(new Set(HOB_SPRITE.rows.map((row) => row.length))).toEqual(new Set([12]));
    expect(HOB_SPRITE.rows).not.toEqual(GOBLIN_SPRITE.rows);
    expect(HOB_SPRITE.rows.join('')).toContain('t');
    expect(HOB_SPRITE.rows.join('')).toContain('a');
    expect(HOB_SPRITE.rows.join('')).toContain('e');
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
});
