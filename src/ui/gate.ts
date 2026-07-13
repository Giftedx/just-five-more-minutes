/** Supported-device gate for the full game. */

export type DeviceBlockReason = 'pointer' | 'viewport';

const finePointer = window.matchMedia('(any-pointer: fine)');

interface GateContent {
  eyebrow: string;
  title: string;
  copy: string;
}

const GATE_CONTENT: Readonly<Record<DeviceBlockReason, GateContent>> = {
  pointer: {
    eyebrow: 'EQUIPMENT CHECK · POINTER',
    title: 'Mouse and keyboard required.',
    copy: 'This one needs a keyboard, a mouse, and a chair you refuse to leave.',
  },
  viewport: {
    eyebrow: 'EQUIPMENT CHECK · WINDOW',
    title: 'Not enough desk space.',
    copy: 'Mudwick needs a little more desk space. Widen this window to at least 900 pixels.',
  },
};

const makeElement = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

function renderGate(gate: HTMLDivElement, reason: DeviceBlockReason): void {
  const content = GATE_CONTENT[reason];
  const card = makeElement('section', 'mobile-gate-card');
  card.setAttribute('aria-labelledby', 'mobile-gate-title');

  const header = makeElement('header', 'mobile-gate-header');
  header.append(
    makeElement('span', 'mobile-gate-eyebrow', content.eyebrow),
    makeElement('span', 'mobile-gate-badge', 'FAILED'),
  );

  const visual = makeElement('div', 'mobile-gate-visual');
  visual.setAttribute('aria-hidden', 'true');
  const crt = makeElement('div', 'mobile-gate-crt');
  const screen = makeElement('div', 'mobile-gate-screen');
  screen.append(
    makeElement('span', 'mobile-gate-screen-title', 'MUDWICK ONLINE'),
    makeElement('span', 'mobile-gate-goblin'),
    makeElement('span', 'mobile-gate-screen-status', 'WAITING...'),
  );
  crt.append(screen, makeElement('span', 'mobile-gate-led'));
  visual.append(crt);

  const copy = makeElement('div', 'mobile-gate-message');
  const title = makeElement('h1', 'mobile-gate-title', content.title);
  title.id = 'mobile-gate-title';
  copy.append(
    title,
    makeElement('p', 'mobile-gate-copy', content.copy),
    makeElement('p', 'mobile-gate-note', 'The evening starts automatically when this check passes.'),
  );

  card.append(header, visual, copy);
  gate.replaceChildren(card);
}

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
    renderGate(gate, reason);
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
