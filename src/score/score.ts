/**
 * Scoring + ending selection. Pure: no DOM, no Three.js.
 * Implements the locked formulas exactly.
 */
import type { ChoreId, LineId } from '../director/director';
import { levelOf, SESSION_COIN_TARGET, SKILL_NAMES } from '../mmo/sim/osrs';
import type { Skills } from '../mmo/sim/types';

export interface PromptOutcome {
  lineId: LineId;
  result: 'answered' | 'ignored';
  /** 1-based option when answered. */
  option: number | null;
}

export interface ChoreOutcome {
  id: ChoreId;
  requestedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
}

export interface SessionData {
  coins: number;
  kills: number;
  logsSold: number;
  flaxSold: number;
  bestStreak: number;
  contractsCompleted: number;
  skills: Skills;
  objectiveHit: boolean;
  statsBonusHit: boolean;
  deaths: number;
  /** Deaths that happened while the player was away from the PC. */
  deathsWhileAway: number;
  prompts: PromptOutcome[];
  chores: ChoreOutcome[];
  /** Host fact: some chore was completed during combat or at <=4 HP. */
  choreCompletedInDanger: boolean;
}

export type ComedyFactId =
  | 'oneSecSpam'
  | 'choreInDanger'
  | 'contractor'
  | 'laundryIgnored'
  | 'choresWithoutGlory'
  | 'remoteDeath'
  | 'economyAtDinner';

export const COMEDY_NOTES: Readonly<Record<ComedyFactId, string>> = {
  oneSecSpam: 'Said "One sec!" three or more times. It was never one sec.',
  choreInDanger: 'Completed a chore while something was actively biting them.',
  contractor: 'Completed multiple freelance contracts during a domestic incident.',
  laundryIgnored: 'Hit max stack. The laundry remains at large.',
  choresWithoutGlory: 'Did every chore. The 100 gp dinner fund remains mysteriously unfunded.',
  remoteDeath: 'Died to a goblin while physically in another room.',
  economyAtDinner: 'Responded to the dinner call with a macroeconomic argument.',
};

export interface ScoreBreakdown {
  /** 0-40 */
  mmo: number;
  /** 0-30 */
  household: number;
  /** 0-20 */
  vibe: number;
  /** 0-10 */
  comedy: number;
  /** 0-100 */
  total: number;
  facts: { id: ComedyFactId; note: string }[];
  endingTitle: string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

export function completedChores(data: SessionData): number {
  return data.chores.filter((c) => c.completedAt !== null).length;
}

export function scoreMmoProgress(data: SessionData): number {
  const economy = Math.round(20 * clamp(data.coins / SESSION_COIN_TARGET, 0, 1));
  const levelsGained = SKILL_NAMES.reduce(
    (sum, skill) => sum + Math.max(0, levelOf(data.skills[skill]) - 1),
    0,
  );
  const training = Math.min(6, levelsGained);
  const contracts = Math.min(8, data.contractsCompleted * 4);
  const streak = Math.min(4, data.bestStreak);
  const legendary = Number(data.objectiveHit) + Number(data.statsBonusHit);
  return clamp(economy + training + contracts + streak + legendary - 5 * data.deaths, 0, 40);
}

export function scoreHousehold(data: SessionData): number {
  let s = 8 * completedChores(data);
  if (data.prompts.some((p) => p.result === 'answered')) s += 6;
  return clamp(s, 0, 30);
}

export function scoreVibe(data: SessionData): number {
  let s = 20;
  s -= 4 * data.prompts.filter((p) => p.result === 'ignored').length;

  const used = new Map<number, number>();
  for (const p of data.prompts) {
    if (p.result === 'answered' && p.option !== null) {
      used.set(p.option, (used.get(p.option) ?? 0) + 1);
    }
  }
  for (const count of used.values()) {
    if (count > 1) s -= 3 * (count - 1);
  }

  for (const c of data.chores) {
    if (c.requestedAt !== null && c.startedAt !== null && c.startedAt - c.requestedAt <= 15) {
      s += 2;
    }
  }
  return clamp(s, 0, 20);
}

export function comedyFacts(data: SessionData): ComedyFactId[] {
  const facts: ComedyFactId[] = [];
  const oneSecs = data.prompts.filter((p) => p.result === 'answered' && p.option === 1).length;
  if (oneSecs >= 3) facts.push('oneSecSpam');
  if (data.choreCompletedInDanger) facts.push('choreInDanger');
  if (data.contractsCompleted >= 2) facts.push('contractor');

  const laundry = data.chores.find((c) => c.id === 'laundry');
  if (data.objectiveHit && laundry && laundry.requestedAt !== null && laundry.completedAt === null) {
    facts.push('laundryIgnored');
  }
  if (
    data.coins < SESSION_COIN_TARGET &&
    !data.objectiveHit &&
    completedChores(data) === data.chores.length &&
    data.chores.length > 0
  ) {
    facts.push('choresWithoutGlory');
  }
  if (data.deathsWhileAway > 0) facts.push('remoteDeath');

  const warn = data.prompts.find((p) => p.lineId === 'warn');
  if (warn && warn.result === 'answered' && warn.option === 3) facts.push('economyAtDinner');
  return facts;
}

export function scoreComedy(data: SessionData): number {
  return clamp(comedyFacts(data).length * 2, 0, 10);
}

export function endingTitle(data: SessionData): string {
  const allChores = completedChores(data) === data.chores.length && data.chores.length > 0;
  let title: string;
  if (data.objectiveHit && data.statsBonusHit) title = 'Max Stack, Max Cape, No Dinner';
  else if (data.statsBonusHit) title = 'Max Cape (Bedroom Edition)';
  else if (data.objectiveHit && allChores) title = 'Max Stack and Matching Socks';
  else if (data.objectiveHit) title = 'The Economy Actually Needed You';
  else if (data.coins >= SESSION_COIN_TARGET && allChores) title = 'Functional Adult (Suspicious)';
  else if (data.contractsCompleted >= 2) title = "Wyn's Employee of the Minute";
  else if (data.coins >= SESSION_COIN_TARGET) title = 'The Economy Needed You';
  else if (allChores) title = 'Employee of the Month (This House)';
  else if (data.kills >= 4) title = 'Goblin Performance Reviewer';
  else title = 'Goblin Spreadsheet Enjoyer';
  if (data.deaths >= 2) title += ' (Posthumous Mention)';
  return title;
}

export function computeScore(data: SessionData): ScoreBreakdown {
  const mmo = scoreMmoProgress(data);
  const household = scoreHousehold(data);
  const vibe = scoreVibe(data);
  const facts = comedyFacts(data);
  const comedy = scoreComedy(data);
  return {
    mmo,
    household,
    vibe,
    comedy,
    total: mmo + household + vibe + comedy,
    facts: facts.map((id) => ({ id, note: COMEDY_NOTES[id] })),
    endingTitle: endingTitle(data),
  };
}
