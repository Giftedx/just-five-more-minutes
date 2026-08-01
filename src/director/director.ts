/**
 * Session timeline state machine. Pure: no DOM, no Three.js.
 * All times are in session seconds (0..SESSION_LENGTH).
 */

/** Full session length — five minutes, matching the title. */
export const SESSION_LENGTH = 5 * 60;

/** Objective banner appears this many seconds in (scaled from the original 12-min schedule). */
export const BANNER_AT = Math.round((45 / 720) * SESSION_LENGTH);

/** Final warning — always one minute before dinner. */
export const WARN_AT = SESSION_LENGTH - 60;

export const PROMPT_DURATION = 20;
export const CHORE_GRACE = 60;

/**
 * Laundry is never requested later than this. Its proportional slot is ~3:58
 * (570/720 of the session), but it is also clamped to leave a full prompt
 * window before the warning. WARN_AT is anchored to the session end (not
 * scaled), so without this clamp the compressed 5-minute schedule lets laundry
 * fire ~2s before warn — and the warn prompt would steal laundry's answer
 * window mid-countdown and orphan its prompt.
 */
export const CHORE3_CAP = Math.min(
  Math.round((570 / 720) * SESSION_LENGTH),
  WARN_AT - PROMPT_DURATION,
);

export type ChoreId = 'mugs' | 'wrappers' | 'laundry';
export type LineId = 'intro' | 'mugs' | 'wrappers' | 'laundry' | 'warn' | 'inspect';

/** Footsteps on the stairs: how many seconds of warning each line fire gets. */
export const PROMPT_LEAD_IN = 1.5;

export const NPC_LINES: Readonly<Record<LineId, string>> = {
  intro: "Dinner's in about five minutes. Give your room a quick tidy if you get a second.",
  mugs: 'Could you move those mugs before one of them starts paying rent?',
  wrappers: 'Is the bin full, or are the wrappers just choosing not to participate?',
  laundry: "Laundry in the basket. I'm not asking you to defeat it, just contain it.",
  warn: "Dinner's ready in one minute. Save your goblin spreadsheet.",
  inspect: 'What exactly is happening in here?',
};

export const RESPONSE_OPTIONS: readonly string[] = [
  'One sec!',
  "I'm in combat!",
  'The economy needs me!',
  "It's basically historical preservation!",
];

export type DirectorEvent =
  | { type: 'npcLine'; lineId: LineId; text: string }
  | { type: 'objectiveBanner' }
  | { type: 'choreRequested'; chore: ChoreId }
  | { type: 'promptClosed'; lineId: LineId; result: 'answered' | 'ignored'; option: number | null }
  | { type: 'promptLeadIn'; lineId: LineId }
  | { type: 'sessionEnd' };

export interface PromptRecord {
  lineId: LineId;
  openedAt: number;
  result: 'open' | 'answered' | 'ignored';
  /** 1-based response option, when answered. */
  option: number | null;
}

export interface ChoreRecord {
  id: ChoreId;
  requestedAt: number | null;
  startedAt: number | null;
  completedAt: number | null;
}

const CHORE_ORDER: readonly ChoreId[] = ['mugs', 'wrappers', 'laundry'];
export const CHORE_BASE_TIMES: Readonly<Record<ChoreId, number>> = {
  mugs: Math.round((90 / 720) * SESSION_LENGTH),
  wrappers: Math.round((240 / 720) * SESSION_LENGTH),
  laundry: Math.round((420 / 720) * SESSION_LENGTH),
};

export class Director {
  /** Session clock in seconds. */
  t: number;
  ended = false;

  readonly prompts: PromptRecord[] = [];
  readonly chores: Record<ChoreId, ChoreRecord>;

  /** Currently scheduled fire time for each not-yet-fired chore. */
  private choreFireAt: Record<ChoreId, number>;
  private introFired = false;
  private bannerFired = false;
  private warnFired = false;
  private endFired = false;
  private firedLines: LineId[] = [];
  private leadInsFired = new Set<LineId>();

  constructor(startAt = 0) {
    this.t = Math.max(0, startAt);
    this.chores = {
      mugs: { id: 'mugs', requestedAt: null, startedAt: null, completedAt: null },
      wrappers: { id: 'wrappers', requestedAt: null, startedAt: null, completedAt: null },
      laundry: { id: 'laundry', requestedAt: null, startedAt: null, completedAt: null },
    };
    this.choreFireAt = { ...CHORE_BASE_TIMES };

    // Seeding the clock (dev `?t=`) silently marks earlier one-shots as done
    // and earlier chores as already requested, with no prompts opened.
    if (this.t > 0) this.introFired = true;
    if (this.t > BANNER_AT) this.bannerFired = true;
    for (const id of CHORE_ORDER) {
      if (this.t > this.choreFireAt[id]) {
        this.chores[id].requestedAt = this.choreFireAt[id];
      }
    }
    if (this.t > WARN_AT) this.warnFired = true;
  }

  /** The prompt currently awaiting a 1-4 response, if any. */
  get activePrompt(): PromptRecord | null {
    const last = this.prompts[this.prompts.length - 1];
    return last && last.result === 'open' ? last : null;
  }

  choreActive(id: ChoreId): boolean {
    const c = this.chores[id];
    return c.requestedAt !== null && c.completedAt === null && !this.ended;
  }

  /** Advance the clock. Returns events fired during this slice, in order. */
  update(dtSeconds: number): DirectorEvent[] {
    if (this.ended || dtSeconds <= 0) return [];
    const events: DirectorEvent[] = [];
    this.t += dtSeconds;

    if (!this.introFired && this.t >= 0) {
      this.introFired = true;
      events.push(...this.fireLine('intro'));
    }
    if (!this.bannerFired && this.t >= BANNER_AT) {
      this.bannerFired = true;
      events.push({ type: 'objectiveBanner' });
    }
    // Footsteps on the stairs — a short audible warning before each line.
    for (const id of CHORE_ORDER) {
      const c = this.chores[id];
      if (c.requestedAt === null && !this.leadInsFired.has(id)
        && this.t >= this.choreFireAt[id] - PROMPT_LEAD_IN) {
        this.leadInsFired.add(id);
        events.push({ type: 'promptLeadIn', lineId: id });
      }
    }
    if (!this.warnFired && !this.leadInsFired.has('warn') && this.t >= WARN_AT - PROMPT_LEAD_IN) {
      this.leadInsFired.add('warn');
      events.push({ type: 'promptLeadIn', lineId: 'warn' });
    }
    for (const id of CHORE_ORDER) {
      const c = this.chores[id];
      if (c.requestedAt === null && this.t >= this.choreFireAt[id]) {
        c.requestedAt = this.t;
        events.push(...this.fireLine(id));
        events.push({ type: 'choreRequested', chore: id });
      }
    }
    if (!this.warnFired && this.t >= WARN_AT) {
      this.warnFired = true;
      events.push(...this.fireLine('warn'));
    }

    // Prompt timeout.
    const prompt = this.activePrompt;
    if (prompt && this.t >= prompt.openedAt + PROMPT_DURATION) {
      prompt.result = 'ignored';
      events.push({ type: 'promptClosed', lineId: prompt.lineId, result: 'ignored', option: null });
    }

    if (!this.endFired && this.t >= SESSION_LENGTH) {
      this.endFired = true;
      this.ended = true;
      const open = this.activePrompt;
      if (open) {
        open.result = 'ignored';
        events.push({ type: 'promptClosed', lineId: open.lineId, result: 'ignored', option: null });
      }
      events.push({ type: 'sessionEnd' });
    }
    return events;
  }

  /**
   * "One sec!" currency: push the next not-yet-requested chore back a little.
   * No-op when every chore has already been asked for.
   */
  extendNextChore(seconds: number): boolean {
    for (const id of CHORE_ORDER) {
      if (this.chores[id].requestedAt === null) {
        const previousFireAt = this.choreFireAt[id];
        let fireAt = previousFireAt + seconds;
        if (id === 'laundry') fireAt = Math.min(fireAt, CHORE3_CAP);
        this.choreFireAt[id] = fireAt;
        if (fireAt > previousFireAt) this.leadInsFired.delete(id);
        return true;
      }
    }
    return false;
  }

  /**
   * The Thursday/Friday knock. The night layer retries while another prompt
   * has its answer window; once clear, the line obeys timeout and no-repeat.
   */
  fireInspection(): DirectorEvent[] {
    if (this.ended || this.activePrompt) return [];
    return this.fireLine('inspect');
  }

  /** Player picked response option (1-4). Returns false when no prompt is open. */
  respond(option: number): DirectorEvent | null {
    const prompt = this.activePrompt;
    if (!prompt || option < 1 || option > 4) return null;
    prompt.result = 'answered';
    prompt.option = option;
    return { type: 'promptClosed', lineId: prompt.lineId, result: 'answered', option };
  }

  /** Host reports the first progress action on a chore. */
  noteChoreStarted(id: ChoreId): void {
    const c = this.chores[id];
    if (c.requestedAt !== null && c.startedAt === null && c.completedAt === null) {
      c.startedAt = this.t;
    }
  }

  /** Host reports a chore fully done. Reschedules the next pending chore. */
  noteChoreCompleted(id: ChoreId): void {
    const c = this.chores[id];
    if (c.requestedAt === null || c.completedAt !== null) return;
    if (c.startedAt === null) c.startedAt = this.t;
    c.completedAt = this.t;

    // Completion grants 60s of peace before the next chore request…
    for (const next of CHORE_ORDER) {
      const nc = this.chores[next];
      if (nc.requestedAt === null) {
        const previousFireAt = this.choreFireAt[next];
        let fireAt = Math.max(previousFireAt, this.t + CHORE_GRACE);
        // …but chore 3 never fires later than CHORE3_CAP.
        if (next === 'laundry') fireAt = Math.min(fireAt, CHORE3_CAP);
        this.choreFireAt[next] = fireAt;
        if (fireAt > previousFireAt) this.leadInsFired.delete(next);
        break;
      }
    }
  }

  /** All bark lines fired so far (for the no-repeats invariant). */
  get barkLines(): readonly LineId[] {
    return this.firedLines;
  }

  private fireLine(lineId: LineId): DirectorEvent[] {
    // Invariant: a bark line never repeats within a session.
    if (this.firedLines.includes(lineId)) return [];
    this.firedLines.push(lineId);
    const events: DirectorEvent[] = [];
    // A new line supersedes any prompt still open (grace can compress two
    // requests to under PROMPT_DURATION apart). Close it as ignored so the
    // record isn't orphaned permanently-open — only the latest prompt is ever
    // reachable by the timeout/respond logic, so an un-closed older one would
    // never resolve and would still cost the player a vibe point at scoring.
    const open = this.activePrompt;
    if (open) {
      open.result = 'ignored';
      events.push({ type: 'promptClosed', lineId: open.lineId, result: 'ignored', option: null });
    }
    this.prompts.push({ lineId, openedAt: this.t, result: 'open', option: null });
    events.push({ type: 'npcLine', lineId, text: NPC_LINES[lineId] });
    return events;
  }
}
