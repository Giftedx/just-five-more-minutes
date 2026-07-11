export type Mode = 'room' | 'pc';

/**
 * Central input router. Owns all document-level listeners so mode
 * transitions can never leave stuck keys or stolen focus behind.
 *
 * While an NPC response prompt is open, number keys 1-4 are intercepted in
 * EITHER mode; everything else flows to its normal target.
 */
export class InputRouter {
  mode: Mode = 'room';
  /** Set by the app while an NPC response prompt is open. */
  promptActive = false;
  enabled = true;
  /**
   * Embedded contexts (permissions policy) can forbid pointer lock outright.
   * When set, holding the left button drags the camera instead.
   */
  dragLook = false;
  private dragging = false;

  onMoveKey: ((code: string, down: boolean) => void) | null = null;
  onLook: ((dx: number, dy: number) => void) | null = null;
  onInteract: (() => void) | null = null;
  onStandUp: (() => void) | null = null;
  /** F — the oldest trick in the book (homework.doc). Works in either mode. */
  onPanic: (() => void) | null = null;
  onPromptOption: ((option: number) => void) | null = null;
  /** Click on the 3D canvas while unlocked (resume / acquire pointer lock). */
  onRoomClick: (() => void) | null = null;
  /** Drop all held movement keys — fired when focus or pointer lock is lost,
   *  so a key released off-window never sticks and drifts the avatar on resume. */
  onClearKeys: (() => void) | null = null;

  private roomCanvas: HTMLElement;
  private disposers: (() => void)[] = [];
  /** Drop the first mousemove after (re)acquiring pointer lock — Chrome often
   *  reports a giant bogus delta there, which reads as a camera "jump". */
  private skipNextMove = false;

  constructor(roomCanvas: HTMLElement) {
    this.roomCanvas = roomCanvas;
    const on = <K extends keyof DocumentEventMap>(
      type: K,
      fn: (e: DocumentEventMap[K]) => void,
    ): void => {
      document.addEventListener(type, fn);
      this.disposers.push(() => document.removeEventListener(type, fn));
    };

    on('keydown', (e) => {
      if (!this.enabled) return;
      if (e.repeat) return;

      if (this.promptActive) {
        const opt = promptDigit(e.code);
        if (opt !== null) {
          e.preventDefault();
          this.onPromptOption?.(opt);
          return;
        }
      }

      if (e.code === 'KeyF') {
        e.preventDefault();
        this.onPanic?.();
        return;
      }

      if (this.mode === 'room') {
        if (e.code === 'KeyE') {
          this.onInteract?.();
          return;
        }
        if (isMoveKey(e.code)) this.onMoveKey?.(e.code, true);
      } else {
        // E only — Esc is reserved by the browser for pointer-lock exit and
        // triggers its re-lock cooldown, which surfaced as a bogus
        // "Click to resume" pause when standing up from the PC.
        if (e.code === 'KeyE') {
          e.preventDefault();
          this.onStandUp?.();
        }
      }
    });

    on('keyup', (e) => {
      // Always deliver keyups, even mid-transition — no stuck keys.
      if (isMoveKey(e.code)) this.onMoveKey?.(e.code, false);
    });

    on('pointerlockchange', () => {
      this.skipNextMove = true;
      // Losing the lock (Esc / Alt-Tab) never delivers keyups for held keys.
      // Clear them now so the avatar doesn't drift when the player resumes.
      if (document.pointerLockElement !== this.roomCanvas) this.onClearKeys?.();
    });

    on('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.mode !== 'room') return;
      const locked = document.pointerLockElement === this.roomCanvas;
      if (!locked && !(this.dragLook && this.dragging)) return;
      if (this.skipNextMove) {
        this.skipNextMove = false;
        return;
      }
      // Clamp residual spikes (legit flicks stay well under this).
      const dx = Math.max(-180, Math.min(180, e.movementX));
      const dy = Math.max(-180, Math.min(180, e.movementY));
      this.onLook?.(dx, dy);
    });

    // Drag-to-look for environments that forbid pointer lock.
    const onDown = (e: MouseEvent): void => {
      if (!this.enabled || !this.dragLook || this.mode !== 'room' || e.button !== 0) return;
      this.dragging = true;
      this.skipNextMove = true; // first delta after grabbing is often junk
    };
    const onUp = (): void => {
      this.dragging = false;
    };
    this.roomCanvas.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    this.disposers.push(() => this.roomCanvas.removeEventListener('mousedown', onDown));
    this.disposers.push(() => document.removeEventListener('mouseup', onUp));

    const click = (): void => {
      if (!this.enabled) return;
      if (this.mode === 'room' && !this.dragLook) this.onRoomClick?.();
    };
    this.roomCanvas.addEventListener('click', click);
    this.disposers.push(() => this.roomCanvas.removeEventListener('click', click));

    // Window blur (Alt-Tab away) drops keyups too — release held keys.
    const onBlur = (): void => this.onClearKeys?.();
    window.addEventListener('blur', onBlur);
    this.disposers.push(() => window.removeEventListener('blur', onBlur));
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers = [];
  }
}

function isMoveKey(code: string): boolean {
  return code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD';
}

function promptDigit(code: string): number | null {
  switch (code) {
    case 'Digit1':
    case 'Numpad1':
      return 1;
    case 'Digit2':
    case 'Numpad2':
      return 2;
    case 'Digit3':
    case 'Numpad3':
      return 3;
    case 'Digit4':
    case 'Numpad4':
      return 4;
    default:
      return null;
  }
}
