import { RESPONSE_OPTIONS } from '../director/director';

/** DOM overlay HUD: objective, chore chip, clock, subtitles, prompt. */
export class Hud {
  readonly root: HTMLDivElement;
  private objectiveEl: HTMLDivElement;
  private choreEl: HTMLDivElement;
  private clockEl: HTMLDivElement;
  private subtitleEl: HTMLDivElement;
  private promptEl: HTMLDivElement;
  private promptTimerFill: HTMLDivElement;
  private interactEl: HTMLDivElement;
  private crosshairEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private subtitleUntil = 0;
  private toastUntil = 0;
  private promptDeadline: { start: number; end: number } | null = null;
  onPromptClick: ((option: number) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    parent.appendChild(this.root);

    this.objectiveEl = this.div('hud-objective');
    this.choreEl = this.div('hud-chore');
    this.clockEl = this.div('hud-clock');
    this.subtitleEl = this.div('hud-subtitle');
    this.promptEl = this.div('hud-prompt');
    this.interactEl = this.div('hud-interact');
    this.toastEl = this.div('hud-toast');
    this.crosshairEl = this.div('hud-crosshair');
    this.promptTimerFill = document.createElement('div');

    this.objectiveEl.style.display = 'none';
    this.choreEl.style.display = 'none';
    this.subtitleEl.style.display = 'none';
    this.promptEl.style.display = 'none';
    this.interactEl.style.display = 'none';
    this.toastEl.style.display = 'none';
  }

  private div(cls: string): HTMLDivElement {
    const el = document.createElement('div');
    el.className = cls;
    this.root.appendChild(el);
    return el;
  }

  showObjective(text: string): void {
    this.objectiveEl.textContent = text;
    this.objectiveEl.style.display = 'block';
    this.objectiveEl.classList.remove('hud-flash');
    void this.objectiveEl.offsetWidth; // restart animation
    this.objectiveEl.classList.add('hud-flash');
  }

  setObjectiveProgress(coins: number, hit: boolean): void {
    if (this.objectiveEl.style.display === 'none') return;
    this.objectiveEl.textContent = hit
      ? `Objective complete — ${coins} coins. Dinner, though.`
      : `Earn 100 coins in Mudwick before dinner. (${Math.min(coins, 100)}/100)`;
  }

  setChoreChip(text: string | null): void {
    if (text === null) {
      this.choreEl.style.display = 'none';
    } else {
      this.choreEl.style.display = 'block';
      this.choreEl.textContent = text;
    }
  }

  setClock(secondsLeft: number): void {
    const s = Math.max(0, Math.ceil(secondsLeft));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    this.clockEl.textContent = `Dinner in ${m}:${ss}`;
    this.clockEl.classList.toggle('hud-clock-late', s <= 90);
  }

  showSubtitle(text: string, now: number, durationMs = 5500): void {
    this.subtitleEl.textContent = text;
    this.subtitleEl.style.display = 'block';
    this.subtitleUntil = now + durationMs;
  }

  showToast(text: string, now: number, durationMs = 3000): void {
    this.toastEl.textContent = text;
    this.toastEl.style.display = 'block';
    this.toastUntil = now + durationMs;
  }

  openPrompt(now: number, durationMs: number): void {
    this.promptEl.innerHTML = '';
    const hint = document.createElement('div');
    hint.className = 'hud-prompt-hint';
    hint.textContent = 'Respond (1-4):';
    this.promptEl.appendChild(hint);
    RESPONSE_OPTIONS.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.className = 'hud-prompt-option';
      btn.textContent = `${i + 1}. ${text}`;
      btn.addEventListener('click', () => this.onPromptClick?.(i + 1));
      this.promptEl.appendChild(btn);
    });
    const timer = document.createElement('div');
    timer.className = 'hud-prompt-timer';
    this.promptTimerFill = document.createElement('div');
    this.promptTimerFill.className = 'hud-prompt-timer-fill';
    timer.appendChild(this.promptTimerFill);
    this.promptEl.appendChild(timer);
    this.promptEl.style.display = 'flex';
    this.promptDeadline = { start: now, end: now + durationMs };
  }

  closePrompt(): void {
    this.promptEl.style.display = 'none';
    this.promptDeadline = null;
  }

  get promptOpen(): boolean {
    return this.promptDeadline !== null;
  }

  setInteractLabel(label: string | null, actionable = true): void {
    if (label === null) {
      this.interactEl.style.display = 'none';
    } else {
      this.interactEl.style.display = 'block';
      this.interactEl.textContent = label;
      this.interactEl.classList.toggle('hud-interact-passive', !actionable);
    }
  }

  setCrosshairVisible(v: boolean): void {
    this.crosshairEl.style.display = v ? 'block' : 'none';
  }

  /** Per-frame housekeeping (subtitle expiry, prompt timer bar). */
  update(now: number): void {
    if (this.subtitleEl.style.display !== 'none' && now > this.subtitleUntil) {
      this.subtitleEl.style.display = 'none';
    }
    if (this.toastEl.style.display !== 'none' && now > this.toastUntil) {
      this.toastEl.style.display = 'none';
    }
    if (this.promptDeadline) {
      const { start, end } = this.promptDeadline;
      const frac = Math.max(0, Math.min(1, (end - now) / (end - start)));
      this.promptTimerFill.style.width = `${(frac * 100).toFixed(1)}%`;
    }
  }

  dispose(): void {
    this.root.remove();
  }
}
