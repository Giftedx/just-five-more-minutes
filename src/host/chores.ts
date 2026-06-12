/**
 * Chore item/target tracking. Pure logic — no DOM, no Three.js — so the
 * completion rules are unit-testable.
 */
import type { ChoreId } from '../director/director';

export interface ChoreDef {
  /** HUD chip label, e.g. "Mugs". */
  chip: string;
  /** Item noun for prompts, e.g. "mug". */
  noun: string;
  /** Where items go, for prompts, e.g. "tray". */
  target: string;
  count: number;
}

export const CHORE_DEFS: Readonly<Record<ChoreId, ChoreDef>> = {
  mugs: { chip: 'Mugs', noun: 'mug', target: 'tray', count: 3 },
  wrappers: { chip: 'Wrappers', noun: 'wrapper', target: 'bin', count: 4 },
  laundry: { chip: 'Laundry', noun: 'laundry', target: 'basket', count: 3 },
};

export type ItemState = 'world' | 'carried' | 'placed';

export interface ChoreItem {
  id: string;
  chore: ChoreId;
  state: ItemState;
}

export type ChoreTrackerEvent =
  | { type: 'choreStarted'; chore: ChoreId }
  | { type: 'choreProgress'; chore: ChoreId; done: number; total: number }
  | { type: 'choreCompleted'; chore: ChoreId };

export class ChoreTracker {
  private items = new Map<string, ChoreItem>();
  private requested = new Set<ChoreId>();
  private started = new Set<ChoreId>();
  private completed = new Set<ChoreId>();
  private carriedId: string | null = null;

  constructor(items: { id: string; chore: ChoreId }[]) {
    for (const it of items) {
      this.items.set(it.id, { id: it.id, chore: it.chore, state: 'world' });
    }
  }

  get carried(): ChoreItem | null {
    return this.carriedId ? (this.items.get(this.carriedId) ?? null) : null;
  }

  item(id: string): ChoreItem | undefined {
    return this.items.get(id);
  }

  isRequested(chore: ChoreId): boolean {
    return this.requested.has(chore);
  }

  isCompleted(chore: ChoreId): boolean {
    return this.completed.has(chore);
  }

  isStarted(chore: ChoreId): boolean {
    return this.started.has(chore);
  }

  progress(chore: ChoreId): { done: number; total: number } {
    let done = 0;
    let total = 0;
    for (const it of this.items.values()) {
      if (it.chore !== chore) continue;
      total++;
      if (it.state === 'placed') done++;
    }
    return { done, total };
  }

  /** The chore the player should see in the HUD chip: oldest requested, unfinished. */
  activeChore(order: readonly ChoreId[]): ChoreId | null {
    for (const c of order) {
      if (this.requested.has(c) && !this.completed.has(c)) return c;
    }
    return null;
  }

  /**
   * Director announced a chore. Items placed pre-emptively count immediately
   * (foreshadowing pays off), which can complete the chore on the spot.
   */
  request(chore: ChoreId): ChoreTrackerEvent[] {
    if (this.requested.has(chore)) return [];
    this.requested.add(chore);
    return this.checkCompletion(chore);
  }

  /** Returns false when the hands are full or the item can't be picked up. */
  canPickUp(itemId: string): boolean {
    const it = this.items.get(itemId);
    return !!it && this.carriedId === null && it.state !== 'carried';
  }

  pickUp(itemId: string): ChoreTrackerEvent[] {
    const it = this.items.get(itemId);
    if (!it || !this.canPickUp(itemId)) return [];
    const events: ChoreTrackerEvent[] = [];
    it.state = 'carried';
    this.carriedId = itemId;
    if (this.requested.has(it.chore) && !this.started.has(it.chore) && !this.completed.has(it.chore)) {
      this.started.add(it.chore);
      events.push({ type: 'choreStarted', chore: it.chore });
    }
    return events;
  }

  /**
   * Drop the carried item back into the world, nowhere in particular.
   * Reverses pickUp: progress and the started/completed latches are untouched.
   */
  putDown(): boolean {
    const it = this.carried;
    if (!it) return false;
    it.state = 'world';
    this.carriedId = null;
    return true;
  }

  /** Place the carried item on its matching target. */
  placeCarried(): ChoreTrackerEvent[] {
    const it = this.carried;
    if (!it) return [];
    it.state = 'placed';
    this.carriedId = null;
    const events: ChoreTrackerEvent[] = [];
    const { done, total } = this.progress(it.chore);
    events.push({ type: 'choreProgress', chore: it.chore, done, total });
    events.push(...this.checkCompletion(it.chore));
    return events;
  }

  private checkCompletion(chore: ChoreId): ChoreTrackerEvent[] {
    if (!this.requested.has(chore) || this.completed.has(chore)) return [];
    const { done, total } = this.progress(chore);
    if (done >= total) {
      this.completed.add(chore);
      if (!this.started.has(chore)) this.started.add(chore);
      return [{ type: 'choreCompleted', chore }];
    }
    return [];
  }
}
