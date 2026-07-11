import { describe, expect, it } from 'vitest';
import {
  allSkillsAt99,
  COIN_OBJECTIVE,
  levelOf,
  MAX_COINS,
  MAX_LEVEL,
  objectiveProgressLabel,
  SESSION_COIN_TARGET,
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

  it('keeps max stack legendary behind the reachable session target', () => {
    expect(SESSION_COIN_TARGET).toBe(100);
    expect(COIN_OBJECTIVE).toBe(MAX_COINS);
    expect(COIN_OBJECTIVE).toBe(2_147_483_647);
    expect(objectiveProgressLabel(50, false)).toBe('50 / 100 gp');
    const postTarget = objectiveProgressLabel(SESSION_COIN_TARGET, false);
    expect(postTarget).toContain('Dinner fund secured');
    expect(postTarget).toContain('100 / 2.1B gp');
    expect(postTarget).toContain('max stack');
    expect(objectiveProgressLabel(MAX_COINS, true)).toBe('Max stack reached — 2.1B gp');
  });

  it('detects 99 in all trainable stats', () => {
    const skills = {
      woodcutting: XP_FOR_LEVEL_99,
      attack: XP_FOR_LEVEL_99,
      foraging: XP_FOR_LEVEL_99,
      fishing: XP_FOR_LEVEL_99,
    };
    expect(allSkillsAt99(skills)).toBe(true);
    expect(allSkillsAt99({ ...skills, foraging: XP_FOR_LEVEL_99 - 1 })).toBe(false);
    expect(levelOf(XP_FOR_LEVEL_99)).toBe(MAX_LEVEL);
  });
});
