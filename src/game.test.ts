import { describe, expect, it } from 'vitest';
import { AWAY_PLAN_TUTORIAL, choreDoneToast, crossWorldToast } from './game';

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
