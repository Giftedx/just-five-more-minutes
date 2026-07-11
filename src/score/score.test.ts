import { describe, expect, it } from 'vitest';
import { xpForLevel } from '../mmo/sim/osrs';
import {
  COMEDY_NOTES,
  comedyFacts,
  computeScore,
  endingTitle,
  scoreComedy,
  scoreHousehold,
  scoreMmoProgress,
  scoreVibe,
  type SessionData,
} from './score';

function base(overrides: Partial<SessionData> = {}): SessionData {
  return {
    coins: 0,
    kills: 0,
    logsSold: 0,
    flaxSold: 0,
    bestStreak: 0,
    contractsCompleted: 0,
    skills: { woodcutting: 0, attack: 0, foraging: 0, fishing: 0 },
    objectiveHit: false,
    statsBonusHit: false,
    deaths: 0,
    deathsWhileAway: 0,
    prompts: [],
    chores: [
      { id: 'mugs', requestedAt: 90, startedAt: null, completedAt: null },
      { id: 'wrappers', requestedAt: 240, startedAt: null, completedAt: null },
      { id: 'laundry', requestedAt: 420, startedAt: null, completedAt: null },
    ],
    choreCompletedInDanger: false,
    ...overrides,
  };
}

describe('MMO progress (0-40)', () => {
  it('scores reachable economy, training, contracts, and streaks', () => {
    const data = base({
      coins: 100,
      skills: { woodcutting: xpForLevel(4), attack: xpForLevel(3), foraging: xpForLevel(2), fishing: 0 },
      contractsCompleted: 2,
      bestStreak: 4,
    });
    expect(scoreMmoProgress(data)).toBe(38);
  });

  it('reserves the final two MMO points for legendary goals', () => {
    const ordinary = base({
      coins: 100,
      skills: { woodcutting: xpForLevel(4), attack: xpForLevel(3), foraging: xpForLevel(2), fishing: 0 },
      contractsCompleted: 2,
      bestStreak: 4,
    });
    expect(scoreMmoProgress({ ...ordinary, objectiveHit: true, statsBonusHit: true })).toBe(40);
  });

  it('rounds economy points, applies death penalties, and clamps to 0-40', () => {
    expect(scoreMmoProgress(base({ coins: 49 }))).toBe(10);
    expect(Number.isInteger(scoreMmoProgress(base({ coins: 33 })))).toBe(true);
    expect(scoreMmoProgress(base({ coins: 0, deaths: 5 }))).toBe(0);
    expect(scoreMmoProgress(base({ coins: 100, deaths: 1 }))).toBe(15);
  });
});

describe('Household responsibility (0-30)', () => {
  const done = (id: 'mugs' | 'wrappers' | 'laundry', t: number) => ({
    id,
    requestedAt: t,
    startedAt: t + 5,
    completedAt: t + 20,
  });

  it('8 per chore, +6 for responding at least once', () => {
    expect(scoreHousehold(base())).toBe(0);
    expect(scoreHousehold(base({ chores: [done('mugs', 90)] }))).toBe(8);
    expect(
      scoreHousehold(
        base({
          chores: [done('mugs', 90), done('wrappers', 240), done('laundry', 420)],
          prompts: [{ lineId: 'intro', result: 'answered', option: 2 }],
        }),
      ),
    ).toBe(30);
  });

  it('the +6 applies for any answered prompt, even just one', () => {
    expect(scoreHousehold(base({ prompts: [{ lineId: 'warn', result: 'answered', option: 4 }] }))).toBe(6);
  });
});

describe('Vibe preservation (0-20)', () => {
  it('starts at 20', () => {
    expect(scoreVibe(base())).toBe(20);
  });

  it('-4 per ignored prompt', () => {
    expect(
      scoreVibe(
        base({
          prompts: [
            { lineId: 'intro', result: 'ignored', option: null },
            { lineId: 'mugs', result: 'ignored', option: null },
          ],
        }),
      ),
    ).toBe(12);
  });

  it('-3 per option reuse', () => {
    expect(
      scoreVibe(
        base({
          prompts: [
            { lineId: 'intro', result: 'answered', option: 1 },
            { lineId: 'mugs', result: 'answered', option: 1 },
            { lineId: 'wrappers', result: 'answered', option: 1 },
          ],
        }),
      ),
    ).toBe(14); // two reuses of option 1
  });

  it('+2 per chore started within 15s of its request', () => {
    expect(
      scoreVibe(
        base({
          chores: [
            { id: 'mugs', requestedAt: 90, startedAt: 100, completedAt: 120 }, // 10s -> +2
            { id: 'wrappers', requestedAt: 240, startedAt: 256, completedAt: null }, // 16s -> no
            { id: 'laundry', requestedAt: 420, startedAt: 435, completedAt: null }, // 15s -> +2 (inclusive)
          ],
        }),
      ),
    ).toBe(20); // 20 + 4, clamped to 20
  });

  it('clamps at both ends', () => {
    const trashed = base({
      prompts: [
        { lineId: 'intro', result: 'ignored', option: null },
        { lineId: 'mugs', result: 'ignored', option: null },
        { lineId: 'wrappers', result: 'ignored', option: null },
        { lineId: 'laundry', result: 'ignored', option: null },
        { lineId: 'warn', result: 'ignored', option: null },
      ],
    });
    expect(scoreVibe(trashed)).toBe(0);
  });
});

describe('Comedy facts (0-10)', () => {
  it('oneSecSpam: "One sec!" answered 3+ times', () => {
    const data = base({
      prompts: [
        { lineId: 'intro', result: 'answered', option: 1 },
        { lineId: 'mugs', result: 'answered', option: 1 },
        { lineId: 'wrappers', result: 'answered', option: 1 },
      ],
    });
    expect(comedyFacts(data)).toContain('oneSecSpam');
    expect(comedyFacts(base())).not.toContain('oneSecSpam');
  });

  it('choreInDanger comes from the host flag', () => {
    expect(comedyFacts(base({ choreCompletedInDanger: true }))).toContain('choreInDanger');
  });

  it('laundryIgnored: objective hit, laundry requested but never completed', () => {
    expect(comedyFacts(base({ objectiveHit: true }))).toContain('laundryIgnored');
    const laundryDone = base({
      objectiveHit: true,
      chores: [
        { id: 'mugs', requestedAt: 90, startedAt: null, completedAt: null },
        { id: 'wrappers', requestedAt: 240, startedAt: null, completedAt: null },
        { id: 'laundry', requestedAt: 420, startedAt: 425, completedAt: 460 },
      ],
    });
    expect(comedyFacts(laundryDone)).not.toContain('laundryIgnored');
  });

  it('choresWithoutGlory: all chores done, dinner fund missed', () => {
    const allDone = base({
      chores: [
        { id: 'mugs', requestedAt: 90, startedAt: 95, completedAt: 110 },
        { id: 'wrappers', requestedAt: 240, startedAt: 245, completedAt: 260 },
        { id: 'laundry', requestedAt: 420, startedAt: 425, completedAt: 460 },
      ],
    });
    expect(comedyFacts(allDone)).toContain('choresWithoutGlory');
    expect(comedyFacts({ ...allDone, coins: 100 })).not.toContain('choresWithoutGlory');
    expect(comedyFacts({ ...allDone, objectiveHit: true })).not.toContain('choresWithoutGlory');
    expect(COMEDY_NOTES.choresWithoutGlory).toBe(
      'Did every chore. The 100 gp dinner fund remains mysteriously unfunded.',
    );
  });

  it('remoteDeath: died while away from the PC', () => {
    expect(comedyFacts(base({ deaths: 1, deathsWhileAway: 1 }))).toContain('remoteDeath');
    expect(comedyFacts(base({ deaths: 1 }))).not.toContain('remoteDeath');
  });

  it('economyAtDinner: answered the final warning with option 3', () => {
    const data = base({ prompts: [{ lineId: 'warn', result: 'answered', option: 3 }] });
    expect(comedyFacts(data)).toContain('economyAtDinner');
    const wrongOption = base({ prompts: [{ lineId: 'warn', result: 'answered', option: 2 }] });
    expect(comedyFacts(wrongOption)).not.toContain('economyAtDinner');
  });

  it('contractor: completed at least two Wyn contracts', () => {
    expect(comedyFacts(base({ contractsCompleted: 2 }))).toContain('contractor');
    expect(comedyFacts(base({ contractsCompleted: 1 }))).not.toContain('contractor');
    expect(COMEDY_NOTES.contractor).toBe(
      'Completed multiple freelance contracts during a domestic incident.',
    );
  });

  it('comedy score is 2 per fact capped at 10', () => {
    expect(scoreComedy(base())).toBe(0);
    const everything = base({
      objectiveHit: true,
      deaths: 1,
      deathsWhileAway: 1,
      choreCompletedInDanger: true,
      prompts: [
        { lineId: 'intro', result: 'answered', option: 1 },
        { lineId: 'mugs', result: 'answered', option: 1 },
        { lineId: 'wrappers', result: 'answered', option: 1 },
        { lineId: 'warn', result: 'answered', option: 3 },
      ],
    });
    // oneSecSpam + choreInDanger + laundryIgnored + remoteDeath + economyAtDinner = 5 facts
    expect(comedyFacts(everything)).toHaveLength(5);
    expect(scoreComedy(everything)).toBe(10);
  });
});

describe('ending matrix', () => {
  const allDoneChores = [
    { id: 'mugs' as const, requestedAt: 90, startedAt: 95, completedAt: 110 },
    { id: 'wrappers' as const, requestedAt: 240, startedAt: 245, completedAt: 260 },
    { id: 'laundry' as const, requestedAt: 420, startedAt: 425, completedAt: 460 },
  ];

  it('covers primary endings and bonus titles', () => {
    expect(endingTitle(base({ objectiveHit: true, chores: allDoneChores }))).toBe(
      'Max Stack and Matching Socks',
    );
    expect(endingTitle(base({ objectiveHit: true }))).toBe('The Economy Actually Needed You');
    expect(endingTitle(base({ statsBonusHit: true }))).toBe('Max Cape (Bedroom Edition)');
    expect(endingTitle(base({ objectiveHit: true, statsBonusHit: true }))).toBe(
      'Max Stack, Max Cape, No Dinner',
    );
    expect(endingTitle(base({ coins: 100, chores: allDoneChores }))).toBe(
      'Functional Adult (Suspicious)',
    );
    expect(endingTitle(base({ contractsCompleted: 2 }))).toBe("Wyn's Employee of the Minute");
    expect(endingTitle(base({ coins: 100 }))).toBe('The Economy Needed You');
    expect(endingTitle(base({ chores: allDoneChores }))).toBe('Employee of the Month (This House)');
    expect(endingTitle(base({ kills: 4 }))).toBe('Goblin Performance Reviewer');
    expect(endingTitle(base())).toBe('Goblin Spreadsheet Enjoyer');
  });

  it('appends posthumous mention at 2+ deaths', () => {
    expect(endingTitle(base({ deaths: 2 }))).toBe('Goblin Spreadsheet Enjoyer (Posthumous Mention)');
    expect(endingTitle(base({ deaths: 1 }))).toBe('Goblin Spreadsheet Enjoyer');
  });
});

describe('computeScore', () => {
  it('sums the categories and carries fact notes', () => {
    const data = base({
      coins: 120,
      objectiveHit: true,
      deaths: 1,
      chores: [
        { id: 'mugs', requestedAt: 90, startedAt: 95, completedAt: 110 },
        { id: 'wrappers', requestedAt: 240, startedAt: 245, completedAt: 260 },
        { id: 'laundry', requestedAt: 420, startedAt: null, completedAt: null },
      ],
      prompts: [
        { lineId: 'intro', result: 'answered', option: 2 },
        { lineId: 'mugs', result: 'ignored', option: null },
        { lineId: 'warn', result: 'answered', option: 3 },
      ],
    });
    const s = computeScore(data);
    expect(s.mmo).toBe(16);
    expect(s.household).toBe(22); // 16 + 6
    expect(s.vibe).toBe(20); // 20 - 4 + 2 + 2, clamped to 20
    // facts: laundryIgnored + economyAtDinner = 2 -> 4
    expect(s.comedy).toBe(4);
    expect(s.total).toBe(62);
    expect(s.total).toBe(s.mmo + s.household + s.vibe + s.comedy);
    expect(s.facts.map((f) => f.id)).toEqual(['laundryIgnored', 'economyAtDinner']);
    expect(s.facts.every((f) => f.note.length > 0)).toBe(true);
    expect(s.endingTitle).toBe('The Economy Actually Needed You');
  });

  it('a player who ignores absolutely everything still gets a scorecard', () => {
    const s = computeScore(
      base({
        prompts: [
          { lineId: 'intro', result: 'ignored', option: null },
          { lineId: 'mugs', result: 'ignored', option: null },
          { lineId: 'wrappers', result: 'ignored', option: null },
          { lineId: 'laundry', result: 'ignored', option: null },
          { lineId: 'warn', result: 'ignored', option: null },
        ],
      }),
    );
    expect(s.total).toBe(0);
    expect(s.endingTitle).toBe('Goblin Spreadsheet Enjoyer');
  });
});
