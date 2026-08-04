import { describe, expect, it, vi } from 'vitest';
import { WARN_AT } from './director/director';
import {
  BarkScheduler,
  INSPECTION_DEFUSE_DELTA,
  MumState,
  nightSpec,
} from './director/nights';
import { AWAY_PLAN_TUTORIAL, Game, choreDoneToast, crossWorldToast } from './game';
import {
  freshCareer,
  recordNight,
  type Career,
  type NightReportSummary,
} from './score/career';

function highScoringReport(): NightReportSummary {
  return {
    total: 77,
    rows: [30, 28, 15, 4],
    endingTitle: 'Time Wizard',
    seed: 1,
    milestones: [],
    choresDone: 3,
  };
}

function postWarnBeatHarness(mode: 'pc' | 'room'): { run: () => void; subtitles: string[] } {
  const night = nightSpec(4);
  const subtitles: string[] = [];
  const game = Object.assign(Object.create(Game.prototype) as object, {
    director: { t: WARN_AT + 30, activePrompt: null },
    night,
    phonePhase: 'idle',
    inspectionFired: true,
    lampOn: true,
    homeworkOffAt: Number.NEGATIVE_INFINITY,
    gameNow: 0,
    host: {
      mode,
      room: {
        setDusk: () => undefined,
        setDeskLamp: () => undefined,
      },
    },
    mum: new MumState(0),
    barks: new BarkScheduler(night.barks),
    hud: { showSubtitle: (line: string) => subtitles.push(line) },
    audio: { npcVoice: () => undefined },
    opts: { speed: 1 },
  }) as unknown as Game;

  return {
    run: () => (game as unknown as { runNightBeats(): void }).runNightBeats(),
    subtitles,
  };
}

describe('post-warning clicking bark', () => {
  it("shows Friday's bespoke bark once when the player is still at the PC", () => {
    const harness = postWarnBeatHarness('pc');

    harness.run();
    harness.run();

    expect(harness.subtitles).toEqual([
      'I can hear clicking and the Hendersons can hear clicking.',
    ]);
  });

  it('stays silent when the player is standing in the room', () => {
    const harness = postWarnBeatHarness('room');

    harness.run();

    expect(harness.subtitles).toEqual([]);
  });
});

describe('away plan onboarding copy', () => {
  it('keeps the first stand-up lesson specific, legible, and neutral', () => {
    expect(AWAY_PLAN_TUTORIAL).toEqual({
      text: 'Auto-pilot engaged. This is definitely allowed. Set the CRT AWAY PLAN before leaving.',
      durationMs: 6500,
      tone: 'neutral',
    });
    expect(AWAY_PLAN_TUTORIAL.text).toHaveLength(85);
  });
});

describe('cross-world feedback copy', () => {
  it('reports deaths only when the avatar died while the player was away', () => {
    expect(crossWorldToast({ type: 'playerDied', coinsLost: 4, whileAway: true })).toBe(
      'Mudwick: you died while unsupervised.',
    );
    expect(crossWorldToast({ type: 'playerDied', coinsLost: 4, whileAway: false })).toBeNull();
  });

  it('reports completed Wyn contracts with their reward', () => {
    expect(crossWorldToast({ type: 'questComplete', reward: 22, kind: 'logs' })).toBe(
      'Wyn contract complete — 22 gp.',
    );
  });
});

describe('chore completion copy', () => {
  it('keeps ordinary and dangerous completions distinct', () => {
    expect(choreDoneToast('Mugs 3/3', false)).toBe('Mugs 3/3 — sorted.');
    expect(choreDoneToast('Mugs 3/3', true)).toBe(
      'Sorted while your avatar was in mortal danger. Efficient.',
    );
  });
});

describe('panic inspection defuse', () => {
  it('keeps an inspection defused when the prompt times out after the panic arm expires', () => {
    const mum = new MumState(6);
    const director = {
      t: 180,
      activePrompt: { lineId: 'inspect' },
    };
    const game = Object.assign(Object.create(Game.prototype) as object, {
      state: 'playing',
      director,
      host: {
        setHomework: () => undefined,
        router: { promptActive: true },
        mmo: { inCombat: false },
      },
      hud: {
        showToast: () => undefined,
        closePrompt: () => undefined,
      },
      audio: { uiClick: () => undefined },
      opts: { speed: 1 },
      factFlags: {
        technicallyTrue: false,
        evidenceBased: false,
        archivist: false,
        modemScream: false,
        oldestTrick: false,
      },
      gameNow: 0,
      mum,
      lastTradeT: Number.NEGATIVE_INFINITY,
      career: { week: { archivistUsed: false } },
      lieDebtTonight: 0,
      archivistSpentTonight: false,
      inspectionFailed: false,
      disposed: false,
      later: () => undefined,
    }) as unknown as {
      panic(): void;
      handleDirectorEvent(ev: {
        type: 'promptClosed';
        lineId: 'inspect';
        result: 'ignored';
        option: null;
      }): void;
      inspectionFailed: boolean;
    };

    game.panic();
    director.t = 200;
    game.handleDirectorEvent({
      type: 'promptClosed',
      lineId: 'inspect',
      result: 'ignored',
      option: null,
    });

    expect(mum.suspicion).toBe(6 + 2 + INSPECTION_DEFUSE_DELTA);
    expect(game.inspectionFailed).toBe(false);
  });
});

describe('Friday week verdict', () => {
  it('restarts before skipTitle begins a finished week', () => {
    let career = freshCareer();
    for (let night = 0; night < 5; night++) {
      career = recordNight(career, highScoringReport(), 7, 0);
    }
    const onRestart = vi.fn();
    const begin = vi.fn();
    const game = Object.assign(Object.create(Game.prototype) as object, {
      career,
      opts: { speed: 1, startAt: 0, skipTitle: true },
      disposed: false,
      onRestart,
      begin,
      loop: vi.fn(),
    }) as unknown as Game;

    game.start();

    expect(onRestart).toHaveBeenCalledOnce();
    expect(begin).not.toHaveBeenCalled();
  });

  it('uses the exact ending suspicion so 7 keeps the matrix ending', () => {
    let career = freshCareer();
    for (let night = 0; night < 4; night++) {
      career = recordNight(career, highScoringReport(), 0, 0);
    }
    career = recordNight(career, highScoringReport(), 7, 0);

    const game = Object.create(Game.prototype) as {
      career: Career;
      finishWeekSilently(): void;
    };
    game.career = career;
    game.finishWeekSilently();

    expect(game.career.weeksCompleted).toEqual([
      { endingId: 'timeWizard', total: 385 },
    ]);
  });
});
