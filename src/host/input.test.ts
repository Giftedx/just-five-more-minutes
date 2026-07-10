import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputRouter } from './input';

/**
 * InputRouter touches `document`/`window` directly, so these run under stubbed
 * EventTarget globals (node has EventTarget/Event since v15). We only need the
 * listener plumbing — no real DOM.
 */
type FakeDoc = EventTarget & { pointerLockElement: EventTarget | null };

function makeDoc(): FakeDoc {
  const d = new EventTarget() as FakeDoc;
  d.pointerLockElement = null;
  return d;
}

const g = globalThis as unknown as { document?: unknown; window?: unknown };

let doc: FakeDoc;
let win: EventTarget;
let canvas: EventTarget;
let savedDoc: unknown;
let savedWin: unknown;

beforeEach(() => {
  savedDoc = g.document;
  savedWin = g.window;
  doc = makeDoc();
  win = new EventTarget();
  canvas = new EventTarget();
  g.document = doc;
  g.window = win;
});

afterEach(() => {
  g.document = savedDoc;
  g.window = savedWin;
});

function makeRouter(): InputRouter {
  return new InputRouter(canvas as unknown as HTMLElement);
}

describe('InputRouter — held keys are released on focus / pointer-lock loss', () => {
  it('clears held movement keys when the window loses focus (Alt-Tab)', () => {
    const router = makeRouter();
    const clear = vi.fn();
    router.onClearKeys = clear;

    win.dispatchEvent(new Event('blur'));

    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('clears held movement keys when pointer lock is lost (Esc-unlock)', () => {
    const router = makeRouter();
    const clear = vi.fn();
    router.onClearKeys = clear;

    doc.pointerLockElement = null; // lock no longer on our canvas
    doc.dispatchEvent(new Event('pointerlockchange'));

    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('does NOT clear keys when pointer lock is acquired on our canvas', () => {
    const router = makeRouter();
    const clear = vi.fn();
    router.onClearKeys = clear;

    doc.pointerLockElement = canvas; // we just gained the lock
    doc.dispatchEvent(new Event('pointerlockchange'));

    expect(clear).not.toHaveBeenCalled();
  });

  it('does NOT clear keys after dispose() (listeners are torn down)', () => {
    const router = makeRouter();
    const clear = vi.fn();
    router.onClearKeys = clear;

    router.dispose();

    win.dispatchEvent(new Event('blur'));
    doc.pointerLockElement = null;
    doc.dispatchEvent(new Event('pointerlockchange'));

    expect(clear).not.toHaveBeenCalled();
  });
});
