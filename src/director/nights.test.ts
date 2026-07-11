import { describe, expect, it } from 'vitest';
import {
  CHORE3_CAP,
  CHORE_BASE_TIMES,
  Director,
  PROMPT_DURATION,
  PROMPT_LEAD_IN,
  WARN_AT,
  type DirectorEvent,
} from './director';
import {
  BARK_COOLDOWN,
  BarkScheduler,
  MumState,
  NIGHTS,
  ONE_SEC_GRACE,
  nightSpec,
  type PromptContext,
} from './nights';

const ctx = (patch: Partial<PromptContext> = {}): PromptContext => ({
  inCombat: false,
  tradedRecently: false,
  usedArchivistThisWeek: false,
  ...patch,
});

describe('NIGHTS data', () => {
  it('covers five nights with three slots each', () => {
    expect(NIGHTS).toHaveLength(5);
    for (const night of NIGHTS) {
      expect(Object.keys(night.slots).sort()).toEqual(['laundry', 'mugs', 'wrappers']);
      for (const chore of Object.values(night.slots)) {
        expect(chore.count).toBeGreaterThanOrEqual(2);
        expect(['carry', 'tug']).toContain(chore.verb);
      }
      // Every line slot has both tone tiers.
      for (const line of Object.values(night.lines)) {
        expect(line.base.length).toBeGreaterThan(0);
        expect(line.tier2.length).toBeGreaterThan(0);
      }
    }
  });

  it('escalates Friday wrappers to five and grants double xp', () => {
    const friday = nightSpec(4);
    expect(friday.slots.wrappers.count).toBe(5);
    expect(friday.beats.doubleXp).toBe(true);
    expect(friday.beats.inspection).toBeDefined();
  });

  it('schedules the Wednesday phone call inside the session', () => {
    const wednesday = nightSpec(2);
    const phone = wednesday.beats.phone;
    expect(phone).toBeDefined();
    if (!phone) return;
    expect(phone.at).toBeGreaterThan(0);
    expect(phone.until).toBeGreaterThan(phone.at);
    expect(phone.until).toBeLessThan(WARN_AT);
  });

  it('clamps out-of-range night lookups', () => {
    expect(nightSpec(-3).night).toBe(0);
    expect(nightSpec(9).night).toBe(4);
  });
});

describe('MumState', () => {
  it('starts from the carried suspicion, clamped', () => {
    expect(new MumState(4).suspicion).toBe(4);
    expect(new MumState(25).suspicion).toBe(10);
    expect(new MumState(-2).suspicion).toBe(0);
  });

  it('maps suspicion to tone tiers', () => {
    expect(new MumState(0).tier).toBe(0);
    expect(new MumState(3).tier).toBe(1);
    expect(new MumState(6).tier).toBe(2);
    expect(new MumState(9).tier).toBe(3);
  });

  it('charges ignored prompts +2', () => {
    const mum = new MumState(0);
    mum.onPromptClosed('ignored', null, ctx());
    expect(mum.suspicion).toBe(2);
  });

  it('one sec: +1 suspicion, +1 lie debt, and 15s of grace', () => {
    const mum = new MumState(0);
    const j = mum.onPromptClosed('answered', 1, ctx());
    expect(mum.suspicion).toBe(1);
    expect(j.lieDebtDelta).toBe(1);
    expect(j.graceExtendSeconds).toBe(ONE_SEC_GRACE);
  });

  it('honesty pays: combat answer drops suspicion and flags the fact when true', () => {
    const mum = new MumState(4);
    const lie = mum.onPromptClosed('answered', 2, ctx({ inCombat: false }));
    expect(mum.suspicion).toBe(3);
    expect(lie.facts.technicallyTrue).toBeUndefined();
    const truth = new MumState(4).onPromptClosed('answered', 2, ctx({ inCombat: true }));
    expect(truth.facts.technicallyTrue).toBe(true);
  });

  it('the economy defence needs evidence', () => {
    const broke = new MumState(0);
    broke.onPromptClosed('answered', 3, ctx({ tradedRecently: false }));
    expect(broke.suspicion).toBe(1);
    const trader = new MumState(0);
    const j = trader.onPromptClosed('answered', 3, ctx({ tradedRecently: true }));
    expect(trader.suspicion).toBe(0);
    expect(j.facts.evidenceBased).toBe(true);
  });

  it('historical preservation lands once a week', () => {
    const mum = new MumState(0);
    const first = mum.onPromptClosed('answered', 4, ctx({ usedArchivistThisWeek: false }));
    expect(first.facts.archivist).toBe(true);
    expect(first.archivistSpent).toBe(true);
    expect(mum.suspicion).toBe(0);
    const again = mum.onPromptClosed('answered', 4, ctx({ usedArchivistThisWeek: true }));
    expect(again.facts.archivist).toBeUndefined();
    // +1 for the spent line, +1 for reusing an option tonight.
    expect(mum.suspicion).toBe(2);
  });

  it('penalises reusing an excuse within the night', () => {
    const mum = new MumState(0);
    mum.onPromptClosed('answered', 2, ctx()); // -1 → 0 (clamped)
    mum.onPromptClosed('answered', 2, ctx()); // reuse +1, honesty -1 → 0
    expect(mum.suspicion).toBe(0);
    mum.onPromptClosed('answered', 1, ctx()); // +1
    mum.onPromptClosed('answered', 1, ctx()); // reuse +1, one-sec +1
    expect(mum.suspicion).toBe(3);
  });

  it('chores calm her; inspections swing both ways', () => {
    const mum = new MumState(6);
    mum.onChoreCompleted();
    expect(mum.suspicion).toBe(4);
    mum.onInspection(false);
    expect(mum.suspicion).toBe(6);
    mum.onInspection(true);
    expect(mum.suspicion).toBe(3);
  });
});

describe('BarkScheduler', () => {
  it('picks tier-appropriate lines once per trigger with a cooldown', () => {
    const barks = new BarkScheduler({
      choreDone: ['warm', 'frosty'],
      lampOn: ['lamp', 'lamp2'],
    });
    expect(barks.pick('choreDone', 0, 10)).toBe('warm');
    // Cooldown blocks the next trigger for a while…
    expect(barks.pick('lampOn', 0, 10 + BARK_COOLDOWN - 1)).toBeNull();
    // …and the same trigger never repeats.
    expect(barks.pick('choreDone', 0, 100)).toBeNull();
    expect(barks.pick('lampOn', 2, 100)).toBe('lamp2');
    // Unscripted triggers are silent.
    expect(barks.pick('modemReturn', 0, 500)).toBeNull();
  });
});

describe('director night hooks', () => {
  function collect(d: Director, until: number, dt = 0.5): { t: number; ev: DirectorEvent }[] {
    const log: { t: number; ev: DirectorEvent }[] = [];
    while (d.t < until) {
      for (const ev of d.update(dt)) log.push({ t: d.t, ev });
    }
    return log;
  }

  it('emits a lead-in shortly before each scheduled line', () => {
    const d = new Director();
    const log = collect(d, WARN_AT + 5);
    const leadIns = log.filter((e) => e.ev.type === 'promptLeadIn');
    const lineIds = leadIns.map((e) => (e.ev.type === 'promptLeadIn' ? e.ev.lineId : ''));
    expect(lineIds).toEqual(['mugs', 'wrappers', 'laundry', 'warn']);
    for (const lead of leadIns) {
      if (lead.ev.type !== 'promptLeadIn') continue;
      const fire = log.find(
        (e) => e.ev.type === 'npcLine' && e.ev.lineId === (lead.ev.type === 'promptLeadIn' ? lead.ev.lineId : ''),
      );
      expect(fire).toBeDefined();
      if (fire) {
        expect(fire.t - lead.t).toBeGreaterThanOrEqual(PROMPT_LEAD_IN - 0.51);
        expect(fire.t - lead.t).toBeLessThanOrEqual(PROMPT_LEAD_IN + 0.51);
      }
    }
  });

  it('extendNextChore pushes only the next pending chore', () => {
    const d = new Director();
    expect(d.extendNextChore(15)).toBe(true);
    const log = collect(d, CHORE_BASE_TIMES.mugs + 20);
    const mugs = log.find((e) => e.ev.type === 'choreRequested');
    expect(mugs).toBeDefined();
    if (mugs) expect(mugs.t).toBeGreaterThanOrEqual(CHORE_BASE_TIMES.mugs + 15);
  });

  it('never pushes laundry past its cap', () => {
    const d = new Director();
    // Burn through mugs and wrappers first.
    collect(d, CHORE_BASE_TIMES.wrappers + 1);
    for (let i = 0; i < 20; i++) d.extendNextChore(15);
    const log = collect(d, CHORE3_CAP + PROMPT_DURATION);
    const laundry = log.find(
      (e) => e.ev.type === 'choreRequested' && e.ev.chore === 'laundry',
    );
    expect(laundry).toBeDefined();
    if (laundry) expect(laundry.t).toBeLessThanOrEqual(CHORE3_CAP + 1);
  });

  it('returns false once every chore has been requested', () => {
    const d = new Director();
    collect(d, CHORE3_CAP + 5);
    expect(d.extendNextChore(15)).toBe(false);
  });

  it('fireInspection opens a real prompt that obeys the stack', () => {
    const d = new Director();
    collect(d, 45); // inside the mugs prompt window (38..58)
    expect(d.activePrompt?.lineId).toBe('mugs');
    const events = d.fireInspection();
    expect(events.some((e) => e.type === 'promptClosed' && e.lineId === 'mugs')).toBe(true);
    expect(d.activePrompt?.lineId).toBe('inspect');
    // Never twice.
    expect(d.fireInspection()).toEqual([]);
    // Timeout still applies.
    const log = collect(d, d.t + PROMPT_DURATION + 1);
    expect(
      log.some((e) => e.ev.type === 'promptClosed' && e.ev.lineId === 'inspect' && e.ev.result === 'ignored'),
    ).toBe(true);
  });
});
