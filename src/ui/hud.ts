import { RESPONSE_OPTIONS } from '../director/director';
import type { Skills } from '../mmo/sim/types';
import {
  allSkillsAt99,
  formatGpShort,
  SESSION_COIN_TARGET,
} from '../mmo/sim/osrs';

export type ToastTone = 'neutral' | 'success' | 'danger';

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

    const taskStackEl = this.div('hud-task-stack');
    this.objectiveEl = this.div('hud-objective', taskStackEl);
    this.choreEl = this.div('hud-chores', taskStackEl);
    this.clockEl = this.div('hud-clock');
    const dialogueStackEl = this.div('hud-dialogue-stack');
    this.promptEl = this.div('hud-prompt', dialogueStackEl);
    this.subtitleEl = this.div('hud-subtitle', dialogueStackEl);
    this.toastEl = this.div('hud-toast', dialogueStackEl);
    this.interactEl = this.div('hud-interact');
    this.crosshairEl = this.div('hud-crosshair');
    this.promptTimerFill = document.createElement('div');

    for (const status of [this.subtitleEl, this.toastEl]) {
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
      status.setAttribute('aria-atomic', 'true');
    }
    this.promptEl.setAttribute('role', 'group');
    this.promptEl.setAttribute('aria-label', 'Respond to Mum');

    this.objectiveEl.style.display = 'none';
    this.choreEl.style.display = 'none';
    this.subtitleEl.style.display = 'none';
    this.promptEl.style.display = 'none';
    this.interactEl.style.display = 'none';
    this.toastEl.style.display = 'none';
  }

  private div(cls: string, parent: HTMLElement = this.root): HTMLDivElement {
    const el = document.createElement('div');
    el.className = cls;
    parent.appendChild(el);
    return el;
  }

  showObjective(text: string): void {
    this.objectiveEl.textContent = text;
    this.objectiveEl.style.display = 'block';
    this.objectiveEl.classList.remove('hud-flash');
    void this.objectiveEl.offsetWidth; // restart animation
    this.objectiveEl.classList.add('hud-flash');
  }

  setObjectiveProgress(
    coins: number,
    skills: Skills,
    questLabel: string,
    maxStackHit: boolean,
    statsBonusHit: boolean,
  ): void {
    if (this.objectiveEl.style.display === 'none') return;
    const dinnerFund = `${formatGpShort(coins)} / ${SESSION_COIN_TARGET} gp`;
    const allStatsLegend = statsBonusHit || allSkillsAt99(skills);
    const legend = maxStackHit && allStatsLegend
      ? 'MAX STACK · 99 ALL'
      : maxStackHit
        ? 'MAX STACK'
        : allStatsLegend
          ? '99 ALL'
          : null;
    this.objectiveEl.textContent = legend
      ? `Dinner fund secured · ${questLabel} · ${legend}`
      : `Dinner fund: ${dinnerFund} · Wyn: ${questLabel}`;
  }

  /** One chip per active chore, oldest first. Empty array hides the stack. */
  setChoreChips(texts: string[]): void {
    if (texts.length === 0) {
      this.choreEl.style.display = 'none';
      return;
    }
    this.choreEl.style.display = 'flex';
    this.choreEl.innerHTML = '';
    for (const text of texts) {
      const chip = document.createElement('div');
      chip.className = 'hud-chore';
      chip.textContent = text;
      this.choreEl.appendChild(chip);
    }
  }

  setClock(secondsLeft: number): void {
    const s = Math.max(0, Math.ceil(secondsLeft));
    const m = Math.floor(s / 60);
    const ss = String(s % 60).padStart(2, '0');
    this.clockEl.innerHTML =
      `<span class="hud-clock-cap">DINNER IN</span>` +
      `<span class="hud-clock-digits">${m}:${ss}</span>`;
    this.clockEl.classList.toggle('hud-clock-late', s <= 90);
  }

  showSubtitle(text: string, now: number, durationMs = 5500): void {
    this.subtitleEl.textContent = text;
    this.subtitleEl.style.display = 'block';
    this.subtitleUntil = now + durationMs;
  }

  showToast(text: string, now: number, durationMs = 3000, tone: ToastTone = 'success'): void {
    this.toastEl.textContent = text;
    this.toastEl.dataset.tone = tone;
    this.toastEl.style.display = 'block';
    this.toastUntil = now + durationMs;
  }

  openPrompt(now: number, durationMs: number): void {
    this.promptEl.innerHTML = '';
    const hint = document.createElement('div');
    hint.className = 'hud-prompt-hint';
    hint.textContent = 'Mum is waiting — respond (1–4)';
    this.promptEl.appendChild(hint);
    RESPONSE_OPTIONS.forEach((text, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'hud-prompt-option';
      const key = document.createElement('span');
      key.className = 'hud-key';
      key.textContent = String(i + 1);
      const label = document.createElement('span');
      label.textContent = text;
      btn.append(key, label);
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
    // While the 1-4 prompt is up it owns that part of the screen; the
    // interact pill would overlap it (it's refreshed every frame, so it
    // reappears the moment the prompt closes).
    if (label === null || this.promptDeadline !== null) {
      this.interactEl.style.display = 'none';
      return;
    }
    this.interactEl.style.display = 'flex';
    this.interactEl.classList.toggle('hud-interact-passive', !actionable);
    // Actionable labels arrive as "E — do the thing": render the E as a keycap.
    const keyed = label.match(/^E — (.*)$/);
    this.interactEl.innerHTML = '';
    if (keyed) {
      const key = document.createElement('span');
      key.className = 'hud-key';
      key.textContent = 'E';
      const text = document.createElement('span');
      text.textContent = keyed[1] ?? '';
      this.interactEl.append(key, text);
    } else {
      this.interactEl.textContent = label;
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
