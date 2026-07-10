/** Supported-device gate for the full game. */

export type DeviceBlockReason = 'pointer' | 'viewport';

const finePointer = window.matchMedia('(any-pointer: fine)');

const GATE_TEXT: Readonly<Record<DeviceBlockReason, string>> = {
  pointer: 'This one needs a keyboard, a mouse, and a chair you refuse to leave.',
  viewport: 'Mudwick needs a little more desk space. Widen this window to at least 900 pixels.',
};

export function deviceBlockReason(): DeviceBlockReason | null {
  if (!finePointer.matches) return 'pointer';
  if (window.innerWidth < 900) return 'viewport';
  return null;
}

/**
 * Own the full-screen gate and report support transitions. The initial state
 * is delivered synchronously so the caller can defer game construction.
 */
export function installGate(
  parent: HTMLElement,
  onChange: (reason: DeviceBlockReason | null) => void,
): () => void {
  let gate: HTMLDivElement | null = null;
  let current: DeviceBlockReason | null | undefined;
  let disposed = false;

  const render = (reason: DeviceBlockReason | null): void => {
    if (reason === null) {
      gate?.remove();
      gate = null;
      return;
    }
    if (!gate) {
      gate = document.createElement('div');
      gate.className = 'mobile-gate';
      gate.setAttribute('role', 'alert');
      parent.appendChild(gate);
    }
    gate.dataset.reason = reason;
    gate.textContent = GATE_TEXT[reason];
  };

  const sync = (): void => {
    if (disposed) return;
    const reason = deviceBlockReason();
    if (current !== undefined && reason === current) return;
    current = reason;
    render(reason);
    onChange(reason);
  };

  window.addEventListener('resize', sync);
  finePointer.addEventListener('change', sync);
  sync();

  return () => {
    if (disposed) return;
    disposed = true;
    window.removeEventListener('resize', sync);
    finePointer.removeEventListener('change', sync);
    gate?.remove();
    gate = null;
  };
}
