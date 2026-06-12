import { describe, expect, it } from 'vitest';
import {
  allSkillsAt99,
  COIN_OBJECTIVE,
  levelOf,
  MAX_COINS,
  MAX_LEVEL,
  XP_FOR_LEVEL_99,
  xpForLevel,
} from './osrs';

describe('OSRS progression', () => {
  it('uses the official level 99 XP threshold', () => {
    expect(XP_FOR_LEVEL_99).toBe(13_034_431);
    expect(xpForLevel(99)).toBe(13_034_431);
    expect(levelOf(13_034_430)).toBe(98);
    expect(levelOf(13_034_431)).toBe(99);
  });

  it('caps coin objective at max stack', () => {
    expect(COIN_OBJECTIVE).toBe(MAX_COINS);
    expect(COIN_OBJECTIVE).toBe(2_147_483_647);
  });

  it('detects 99 in all trainable stats', () => {
    const skills = {
      woodcutting: XP_FOR_LEVEL_99,
      attack: XP_FOR_LEVEL_99,
      foraging: XP_FOR_LEVEL_99,
    };
    expect(allSkillsAt99(skills)).toBe(true);
    expect(allSkillsAt99({ ...skills, foraging: XP_FOR_LEVEL_99 - 1 })).toBe(false);
    expect(levelOf(XP_FOR_LEVEL_99)).toBe(MAX_LEVEL);
  });
});
