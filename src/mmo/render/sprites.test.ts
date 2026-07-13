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
