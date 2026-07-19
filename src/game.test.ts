import { describe, expect, it } from 'vitest';
import { WARN_AT } from './director/director';
import { BarkScheduler, MumState, nightSpec } from './director/nights';
import { AWAY_PLAN_TUTORIAL, Game, choreDoneToast, crossWorldToast } from './game';

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
