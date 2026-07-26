import type { SkillName, Skills } from './types';

/** OSRS max stack size for coins (signed 32-bit). */
export const MAX_COINS = 2_147_483_647;
export const COIN_OBJECTIVE = MAX_COINS;
export const SESSION_COIN_TARGET = 100;
export const MAX_LEVEL = 99;

export const SKILL_NAMES: readonly SkillName[] = ['woodcutting', 'attack', 'foraging', 'fishing'];

// Pre-compute XP table to avoid O(N^2) level lookups
const XP_TABLE = new Int32Array(MAX_LEVEL + 1);
let xpPoints = 0;
for (let l = 1; l < MAX_LEVEL; l++) {
  xpPoints += Math.floor(l + 300 * 2 ** (l / 7));
  XP_TABLE[l + 1] = Math.floor(xpPoints / 4);
}

/** Cumulative XP required to reach a level (OSRS formula). Level 1 → 0. */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return XP_TABLE[MAX_LEVEL] as number;
  return XP_TABLE[level] as number;
}

export const XP_FOR_LEVEL_99 = xpForLevel(MAX_LEVEL);

export function levelOf(xp: number): number {
  for (let l = 2; l <= MAX_LEVEL; l++) {
    if (xp < (XP_TABLE[l] as number)) return l - 1;
  }
  return MAX_LEVEL;
}

export function allSkillsAt99(skills: Skills): boolean {
  return SKILL_NAMES.every((s) => levelOf(skills[s]) >= MAX_LEVEL);
}

export function formatGp(n: number): string {
  return Math.min(n, MAX_COINS).toLocaleString('en-US');
}

/** Compact gp for tight HUD / banner slots. */
export function formatGpShort(n: number): string {
  const v = Math.min(n, MAX_COINS);
  if (v >= 1_000_000_000) {
    const b = v / 1_000_000_000;
    return b >= 10 ? `${Math.floor(b)}B` : `${b.toFixed(1)}B`;
  }
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    return m >= 100 ? `${Math.floor(m)}M` : `${m.toFixed(1)}M`;
  }
  if (v >= 10_000) return `${Math.floor(v / 1000)}K`;
  return String(v);
}

export function objectiveProgressLabel(coins: number, objectiveHit: boolean): string {
  if (objectiveHit) return `Max stack reached — ${formatGpShort(coins)} gp`;
  if (coins >= SESSION_COIN_TARGET) {
    return `Dinner fund secured — ${formatGpShort(coins)} / ${formatGpShort(COIN_OBJECTIVE)} gp to max stack`;
  }
  return `${formatGpShort(coins)} / ${formatGpShort(SESSION_COIN_TARGET)} gp`;
}

export function bonusProgressLabel(skills: Skills, bonusHit: boolean): string {
  if (bonusHit) return '99 all stats';
  const at99 = SKILL_NAMES.filter((s) => levelOf(skills[s]) >= MAX_LEVEL).length;
  return `99 all stats (${at99}/${SKILL_NAMES.length})`;
}
