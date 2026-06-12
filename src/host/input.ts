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

  onMoveKey: ((code: string, down: boolean) => void) | null = null;
  onLook: ((dx: number, dy: number) => void) | null = null;
  onInteract: (() => void) | null = null;
  onStandUp: (() => void) | null = null;
  onPromptOption: ((option: number) => void) | null = null;
  /** Click on the 3D canvas while unlocked (resume / acquire pointer lock). */
  onRoomClick: (() => void) | null = null;

  private roomCanvas: HTMLElement;
  private disposers: (() => void)[] = [];

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

      if (this.mode === 'room') {
        if (e.code === 'KeyE') {
          this.onInteract?.();
          return;
        }
        if (isMoveKey(e.code)) this.onMoveKey?.(e.code, true);
      } else {
        if (e.code === 'Escape' || e.code === 'KeyQ') {
          e.preventDefault();
          this.onStandUp?.();
        }
      }
    });

    on('keyup', (e) => {
      // Always deliver keyups, even mid-transition — no stuck keys.
      if (isMoveKey(e.code)) this.onMoveKey?.(e.code, false);
    });

    on('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.mode === 'room' && document.pointerLockElement === this.roomCanvas) {
        this.onLook?.(e.movementX, e.movementY);
      }
    });

    const click = (): void => {
      if (!this.enabled) return;
      if (this.mode === 'room') this.onRoomClick?.();
    };
    this.roomCanvas.addEventListener('click', click);
    this.disposers.push(() => this.roomCanvas.removeEventListener('click', click));
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
