/**
 * Scoring + ending selection. Pure: no DOM, no Three.js.
 * Implements the locked formulas exactly.
 */
import type { ChoreId, LineId } from '../director/director';
import { SESSION_COIN_TARGET } from '../mmo/sim/osrs';
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
  /** Coins earned tonight (career wealth does not pre-pay the dinner fund). */
  coinsEarned: number;
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
  /** Session milestone ids, in order of achievement (spec ladder). */
  milestones: string[];
  /** Mum's suspicion when the session ended, 0-10. */
  suspicionEnd: number;
  prompts: PromptOutcome[];
  chores: ChoreOutcome[];
  /** Host fact: some chore was completed during combat or at <=4 HP. */
  choreCompletedInDanger: boolean;
  /** Host fact: Thursday's knock landed with no homework.doc in sight. */
  inspectionFailed?: boolean;
  /** Excuse facts, judged by Mum at the moment of answering. */
  technicallyTrue: boolean;
  evidenceBased: boolean;
  archivist: boolean;
  /** Mudwick facts the sim testifies to. */
  doubleBereavement: boolean;
  modemScream: boolean;
  oldestTrick: boolean;
  shrimpBurnt3: boolean;
}

export type ComedyFactId =
  | 'oneSecSpam'
  | 'choreInDanger'
  | 'contractor'
  | 'laundryIgnored'
  | 'choresWithoutGlory'
  | 'remoteDeath'
  | 'economyAtDinner'
  | 'technicallyTrue'
  | 'evidenceBased'
  | 'archivist'
  | 'doubleBereavement'
  | 'modemScream'
  | 'oldestTrick'
  | 'shrimpBurnt3';

export const COMEDY_NOTES: Readonly<Record<ComedyFactId, string>> = {
  oneSecSpam: 'Said "One sec!" three or more times. It was never one sec.',
  choreInDanger: 'Completed a chore while something was actively biting them.',
  contractor: 'Completed multiple freelance contracts during a domestic incident.',
  laundryIgnored: 'Hit max stack. The laundry remains at large.',
  choresWithoutGlory: 'Did every chore. The 100 gp dinner fund remains mysteriously unfunded.',
  remoteDeath: 'Died to a goblin while physically in another room.',
  economyAtDinner: 'Responded to the dinner call with a macroeconomic argument.',
  technicallyTrue: 'Claimed to be in combat while actually in combat. Unprecedented honesty.',
  evidenceBased: 'Cited the economy, and had the receipts to prove it.',
  archivist: 'Deployed the historical preservation defence. It works once a week.',
  doubleBereavement: 'Lost a gravestone to a second gravestone. A bold estate strategy.',
  modemScream: 'Survived a mid-combat disconnect. The modem screamed for both of them.',
  oldestTrick: 'Flipped to homework.doc at speed. The oldest trick, executed adequately.',
  shrimpBurnt3: 'Cremated three consecutive shrimp. The campfire has filed a complaint.',
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

/** Session milestone values (spec §5): the felt-progress ladder, capped at 40. */
export const MILESTONE_POINTS: Readonly<Record<string, number>> = {
  pocketMoney: 6,
  twoDinnersAhead: 6,
  dinnerFund: 10,
  contractor: 6,
  levelFive: 6,
  tollPaid: 3,
  bullyTheBully: 3,
  undertaker: 2,
  chefActually: 2,
};

export function scoreMmoProgress(data: SessionData): number {
  const ladder = data.milestones.reduce((sum, id) => sum + (MILESTONE_POINTS[id] ?? 0), 0);
  const legendary = Number(data.objectiveHit) + Number(data.statsBonusHit);
  return clamp(ladder + legendary, 0, 40);
}

export function scoreHousehold(data: SessionData): number {
  let s = 8 * completedChores(data);
  if (data.prompts.some((p) => p.result === 'answered')) s += 6;
  return clamp(s, 0, 30);
}

export function scoreVibe(data: SessionData): number {
  let s = 20;
  s -= 4 * data.prompts.filter((p) => p.result === 'ignored').length;
  s -= Math.floor(clamp(data.suspicionEnd, 0, 10) / 2);
  if (data.inspectionFailed) s -= 2;

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
    data.coinsEarned < SESSION_COIN_TARGET &&
    !data.objectiveHit &&
    completedChores(data) === data.chores.length &&
    data.chores.length > 0
  ) {
    facts.push('choresWithoutGlory');
  }
  if (data.deathsWhileAway > 0) facts.push('remoteDeath');

  const warn = data.prompts.find((p) => p.lineId === 'warn');
  if (warn && warn.result === 'answered' && warn.option === 3) facts.push('economyAtDinner');

  if (data.technicallyTrue) facts.push('technicallyTrue');
  if (data.evidenceBased) facts.push('evidenceBased');
  if (data.archivist) facts.push('archivist');
  if (data.doubleBereavement) facts.push('doubleBereavement');
  if (data.modemScream) facts.push('modemScream');
  if (data.oldestTrick) facts.push('oldestTrick');
  if (data.shrimpBurnt3) facts.push('shrimpBurnt3');
  return facts;
}

export function scoreComedy(data: SessionData): number {
  return clamp(comedyFacts(data).length * 2, 0, 10);
}

export function endingTitle(data: SessionData): string {
  const allChores = completedChores(data) === data.chores.length && data.chores.length > 0;
  const dinnerFund = data.coinsEarned >= SESSION_COIN_TARGET;
  let title: string;
  if (data.objectiveHit && data.statsBonusHit) title = 'Max Stack, Max Cape, No Dinner';
  else if (data.statsBonusHit) title = 'Max Cape (Bedroom Edition)';
  else if (data.objectiveHit && allChores) title = 'Max Stack and Matching Socks';
  else if (data.objectiveHit) title = 'The Economy Actually Needed You';
  else if (dinnerFund && allChores) title = 'Functional Adult (Suspicious)';
  else if (data.contractsCompleted >= 2) title = "Wyn's Employee of the Minute";
  else if (dinnerFund) title = 'The Economy Needed You';
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
