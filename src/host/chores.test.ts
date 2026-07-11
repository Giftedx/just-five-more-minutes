import { describe, expect, it } from 'vitest';
import { CHORE_DEFS, ChoreTracker } from './chores';

function makeTracker(): ChoreTracker {
  return new ChoreTracker([
    { id: 'mug0', chore: 'mugs' },
    { id: 'mug1', chore: 'mugs' },
    { id: 'mug2', chore: 'mugs' },
    { id: 'wrap0', chore: 'wrappers' },
    { id: 'wrap1', chore: 'wrappers' },
    { id: 'wrap2', chore: 'wrappers' },
    { id: 'wrap3', chore: 'wrappers' },
    { id: 'cloth0', chore: 'laundry' },
    { id: 'cloth1', chore: 'laundry' },
    { id: 'cloth2', chore: 'laundry' },
  ]);
}

describe('chore definitions', () => {
  it('matches the locked spec counts', () => {
    expect(CHORE_DEFS.mugs.count).toBe(3);
    expect(CHORE_DEFS.wrappers.count).toBe(4);
    expect(CHORE_DEFS.laundry.count).toBe(3);
  });
});

describe('ChoreTracker', () => {
  it('completes a chore when all items are placed after request', () => {
    const t = makeTracker();
    t.request('mugs');
    t.pickUp('mug0');
    t.placeCarried();
    t.pickUp('mug1');
    t.placeCarried();
    t.pickUp('mug2');
    const events = t.placeCarried();
    expect(events.some((e) => e.type === 'choreCompleted' && e.chore === 'mugs')).toBe(true);
    expect(t.isCompleted('mugs')).toBe(true);
    expect(t.progress('mugs')).toEqual({ done: 3, total: 3 });
  });

  it('only one item can be carried at a time', () => {
    const t = makeTracker();
    expect(t.pickUp('mug0').length).toBe(0); // not requested yet -> no started event, but pickup works
    expect(t.carried?.id).toBe('mug0');
    expect(t.canPickUp('mug1')).toBe(false);
    expect(t.pickUp('mug1')).toEqual([]);
    expect(t.carried?.id).toBe('mug0');
  });

  it('emits choreStarted on first pickup after the request only', () => {
    const t = makeTracker();
    t.request('wrappers');
    const first = t.pickUp('wrap0');
    expect(first).toEqual([{ type: 'choreStarted', chore: 'wrappers' }]);
    t.placeCarried();
    const second = t.pickUp('wrap1');
    expect(second.some((e) => e.type === 'choreStarted')).toBe(false);
  });

  it('items placed before the request count when the request lands', () => {
    const t = makeTracker();
    // Tidy-minded player puts every mug away before being asked.
    for (const id of ['mug0', 'mug1', 'mug2']) {
      t.pickUp(id);
      t.placeCarried();
    }
    expect(t.isCompleted('mugs')).toBe(false); // not requested yet
    const events = t.request('mugs');
    expect(events).toEqual([{ type: 'choreCompleted', chore: 'mugs' }]);
    expect(t.isCompleted('mugs')).toBe(true);
  });

  it('progress events report running counts', () => {
    const t = makeTracker();
    t.request('laundry');
    t.pickUp('cloth0');
    const events = t.placeCarried();
    expect(events[0]).toEqual({ type: 'choreProgress', chore: 'laundry', done: 1, total: 3 });
    expect(events.some((e) => e.type === 'choreCompleted')).toBe(false);
  });

  it('active chore is the oldest requested unfinished chore', () => {
    const t = makeTracker();
    const order = ['mugs', 'wrappers', 'laundry'] as const;
    expect(t.activeChore(order)).toBeNull();
    t.request('mugs');
    t.request('wrappers');
    expect(t.activeChore(order)).toBe('mugs');
    for (const id of ['mug0', 'mug1', 'mug2']) {
      t.pickUp(id);
      t.placeCarried();
    }
    expect(t.activeChore(order)).toBe('wrappers');
  });

  it('re-picking a placed item lowers progress but completion latches', () => {
    const t = makeTracker();
    t.request('mugs');
    for (const id of ['mug0', 'mug1', 'mug2']) {
      t.pickUp(id);
      t.placeCarried();
    }
    expect(t.isCompleted('mugs')).toBe(true);
    t.pickUp('mug0');
    expect(t.progress('mugs').done).toBe(2);
    expect(t.isCompleted('mugs')).toBe(true); // latched — no take-backs
  });

  it('request is idempotent', () => {
    const t = makeTracker();
    t.request('mugs');
    expect(t.request('mugs')).toEqual([]);
  });

  describe('putDown', () => {
    it('returns false when nothing is carried', () => {
      const t = makeTracker();
      expect(t.putDown()).toBe(false);
    });

    it('clears the carried item without changing progress', () => {
      const t = makeTracker();
      t.request('mugs');
      t.pickUp('mug0');
      t.placeCarried();
      t.pickUp('mug1');
      expect(t.putDown()).toBe(true);
      expect(t.carried).toBeNull();
      expect(t.item('mug1')?.state).toBe('world');
      expect(t.progress('mugs')).toEqual({ done: 1, total: 3 });
    });

    it('does not touch the started latch and allows re-pickup', () => {
      const t = makeTracker();
      t.request('wrappers');
      t.pickUp('wrap0'); // emits choreStarted
      t.putDown();
      expect(t.isStarted('wrappers')).toBe(true); // latched
      const again = t.pickUp('wrap0');
      expect(again.some((e) => e.type === 'choreStarted')).toBe(false); // no double-start
      expect(t.carried?.id).toBe('wrap0');
    });

    it('completion stays latched when a placed item is picked up and put down', () => {
      const t = makeTracker();
      t.request('mugs');
      for (const id of ['mug0', 'mug1', 'mug2']) {
        t.pickUp(id);
        t.placeCarried();
      }
      expect(t.isCompleted('mugs')).toBe(true);
      t.pickUp('mug0');
      t.putDown();
      expect(t.isCompleted('mugs')).toBe(true); // latched — no take-backs
      expect(t.progress('mugs').done).toBe(2);
      expect(t.item('mug0')?.state).toBe('world');
    });
  });

  describe('tug chores', () => {
    it('completes point-by-point with the same event flow as carries', () => {
      const t = new ChoreTracker([
        { id: 'bed0', chore: 'wrappers' },
        { id: 'bed1', chore: 'wrappers' },
      ]);
      t.request('wrappers');
      const first = t.tug('bed0');
      expect(first.map((e) => e.type)).toEqual(['choreStarted', 'choreProgress']);
      expect(t.item('bed0')?.state).toBe('placed');
      // Tugging the same point again is a no-op.
      expect(t.tug('bed0')).toEqual([]);
      const second = t.tug('bed1');
      expect(second.map((e) => e.type)).toEqual(['choreProgress', 'choreCompleted']);
      expect(t.isCompleted('wrappers')).toBe(true);
    });

    it('tug points placed before the request count when it arrives', () => {
      const t = new ChoreTracker([
        { id: 'curt0', chore: 'laundry' },
        { id: 'curt1', chore: 'laundry' },
      ]);
      t.tug('curt0');
      t.tug('curt1');
      const events = t.request('laundry');
      expect(events.map((e) => e.type)).toEqual(['choreCompleted']);
    });
  });
});
