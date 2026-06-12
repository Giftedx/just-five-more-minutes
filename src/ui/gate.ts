/** Touch / small-viewport gate. Returns true when the device can't play. */
export function deviceBlocked(): boolean {
  const touchOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
  return touchOnly || window.innerWidth < 900;
}

const GATE_TEXT = 'This one needs a keyboard, a mouse, and a chair you refuse to leave.';

/** Keeps a full-screen card in sync with viewport/device suitability. */
export function installGate(parent: HTMLElement): void {
  let gate: HTMLDivElement | null = null;
  const sync = (): void => {
    const blocked = deviceBlocked();
    if (blocked && !gate) {
      gate = document.createElement('div');
      gate.className = 'mobile-gate';
      gate.textContent = GATE_TEXT;
      parent.appendChild(gate);
    } else if (!blocked && gate) {
      gate.remove();
      gate = null;
    }
  };
  window.addEventListener('resize', sync);
  sync();
}
