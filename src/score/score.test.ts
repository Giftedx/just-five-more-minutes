import { describe, expect, it } from 'vitest';
import {
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
    objectiveHit: false,
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
  it('scales coins to 25 points', () => {
    expect(scoreMmoProgress(base({ coins: 0 }))).toBe(0);
    expect(scoreMmoProgress(base({ coins: 50 }))).toBe(12.5);
    expect(scoreMmoProgress(base({ coins: 100 }))).toBe(25);
  });

  it('caps the coin contribution at 100 coins', () => {
    expect(scoreMmoProgress(base({ coins: 400 }))).toBe(25);
  });

  it('adds 15 for the objective and subtracts 5 per death', () => {
    expect(scoreMmoProgress(base({ coins: 100, objectiveHit: true }))).toBe(40);
    expect(scoreMmoProgress(base({ coins: 100, objectiveHit: true, deaths: 1 }))).toBe(35);
  });

  it('clamps to 0-40', () => {
    expect(scoreMmoProgress(base({ coins: 0, deaths: 5 }))).toBe(0);
    expect(scoreMmoProgress(base({ coins: 200, objectiveHit: true }))).toBe(40);
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

  it('choresWithoutGlory: all chores done, objective failed', () => {
    const allDone = base({
      chores: [
        { id: 'mugs', requestedAt: 90, startedAt: 95, completedAt: 110 },
        { id: 'wrappers', requestedAt: 240, startedAt: 245, completedAt: 260 },
        { id: 'laundry', requestedAt: 420, startedAt: 425, completedAt: 460 },
      ],
    });
    expect(comedyFacts(allDone)).toContain('choresWithoutGlory');
    expect(comedyFacts({ ...allDone, objectiveHit: true })).not.toContain('choresWithoutGlory');
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

  it('covers all four cells', () => {
    expect(endingTitle(base({ objectiveHit: true, chores: allDoneChores }))).toBe(
      'Functional Adult (Suspicious)',
    );
    expect(endingTitle(base({ objectiveHit: true }))).toBe('The Economy Needed You');
    expect(endingTitle(base({ chores: allDoneChores }))).toBe('Employee of the Month (This House)');
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
    expect(s.mmo).toBe(35); // 25 + 15 - 5
    expect(s.household).toBe(22); // 16 + 6
    expect(s.vibe).toBe(20); // 20 - 4 + 2 + 2, clamped to 20
    // facts: laundryIgnored + economyAtDinner = 2 -> 4
    expect(s.comedy).toBe(4);
    expect(s.total).toBe(81);
    expect(s.facts.map((f) => f.id)).toEqual(['laundryIgnored', 'economyAtDinner']);
    expect(s.facts.every((f) => f.note.length > 0)).toBe(true);
    expect(s.endingTitle).toBe('The Economy Needed You');
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
