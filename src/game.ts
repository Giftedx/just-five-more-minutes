import { AudioSynth } from './audio/synth';
import { choreDefsFor, type ChoreDef } from './host/chores';
import { HostApp } from './host/app';
import type { RoomNightConfig } from './host/room';
import {
  BANNER_AT,
  Director,
  PROMPT_DURATION,
  SESSION_LENGTH,
  type ChoreId,
  type DirectorEvent,
  type LineId,
} from './director/director';
import {
  BarkScheduler,
  MUM_TIER_LABELS,
  MumState,
  nightSpec,
  type BarkTrigger,
  type NightSpec,
} from './director/nights';
import { computeScore, type SessionData } from './score/score';
import {
  recordReport,
  type ReportHistorySummary,
} from './score/history';
import {
  loadCareer,
  recordNight,
  saveCareer,
  type Career,
} from './score/career';
import { levelOf } from './mmo/sim/osrs';
import type { SimEvent } from './mmo/sim/types';
import { createSessionSeed } from './session';
import { Hud } from './ui/hud';
import { showScorecard } from './ui/scorecard';
import { showTitle } from './ui/title';

export interface GameOptions {
  speed: number;
  startAt: number;
  skipTitle: boolean;
  seed?: number;
  /** Dev override (?night=0..4); defaults to the career's current night. */
  night?: number;
}

function roomConfigFor(spec: NightSpec): RoomNightConfig {
  return {
    chores: (['mugs', 'wrappers', 'laundry'] as const).map((slot) => ({
      slot,
      physical: spec.slots[slot].id,
      count: spec.slots[slot].count,
    })),
    phone: spec.beats.phone !== undefined,
  };
}

const CHORE_ORDER: readonly ChoreId[] = ['mugs', 'wrappers', 'laundry'];

export function crossWorldToast(event: SimEvent): string | null {
  if (event.type === 'playerDied' && event.whileAway) {
    return 'Mudwick: you died while unsupervised.';
  }
  if (event.type === 'questComplete') {
    return `Wyn contract complete — ${event.reward} gp.`;
  }
  return null;
}

export function choreDoneToast(label: string, completedInDanger: boolean): string {
  return completedInDanger
    ? 'Sorted while your avatar was in mortal danger. Efficient.'
    : `${label} — sorted.`;
}

function recordReportSafely(total: number): ReportHistorySummary {
  try {
    return recordReport(localStorage, total);
  } catch {
    return {
      runNumber: 1,
      best: total,
      previousTotal: null,
      delta: null,
      isNewBest: true,
      persisted: false,
    };
  }
}

function loadCareerSafely(): Career {
  try {
    return loadCareer(localStorage);
  } catch {
    return loadCareer({ getItem: () => null, setItem: () => undefined });
  }
}

/** Mum's comeback for each of the four excuses. She has heard them all. */
const MUM_RETORTS: readonly string[] = [
  "Mm. Starting the sixty seconds I don't believe in.",
  "You're in a bedroom, love. The only combat up here is with the laundry.",
  'The economy survived the Bronze Age collapse. It can survive your dinner.',
  'So is the washing-up, technically. Historical. Some of it ancient.',
];

/** Full session: title -> five minutes of divided attention -> incident report. */
export class Game {
  private root: HTMLElement;
  private opts: GameOptions;
  private readonly sessionSeed: number;
  private host: HostApp;
  private director: Director;
  private hud: Hud;
  private audio: AudioSynth;
  private state: 'title' | 'playing' | 'ended' = 'title';
  private choreCompletedInDanger = false;
  private silhouetteHideAt = 0;
  // ---- the school week
  private career: Career;
  private readonly night: NightSpec;
  private readonly choreDefs: Record<ChoreId, ChoreDef>;
  private mum: MumState;
  private barks: BarkScheduler;
  private lieDebtTonight = 0;
  private archivistSpentTonight = false;
  private lastTradeT = Number.NEGATIVE_INFINITY;
  private factFlags = {
    technicallyTrue: false,
    evidenceBased: false,
    archivist: false,
    modemScream: false,
    oldestTrick: false,
  };
  private inspectionFailed = false;
  private phonePhase: 'idle' | 'down' | 'done' = 'idle';
  private combatAtDisconnect = false;
  private deathsAtDisconnect = 0;
  private inspectionFired = false;
  private panicArmedUntil = Number.NEGATIVE_INFINITY;
  private homeworkOffAt = Number.NEGATIVE_INFINITY;
  private lampOn = false;
  /** Pause-frozen HUD clock (ms). Director time freezes on pause; wall-clock
   *  timers would desync subtitles/prompt bar from the director, so the HUD
   *  runs on this clock instead. */
  private gameNow = 0;
  private raf = 0;
  private overlays: HTMLElement[] = [];
  private disposed = false;
  /** Pointer lock has been held at least once (real keyboard+mouse session). */
  private hadPointerLock = false;
  /** A normal title-screen run cannot advance until its first room lock. */
  private pointerLockRequired = false;
  private hiddenPause = false;
  private pauseOverlay: HTMLDivElement | null = null;
  private titleDispose: (() => void) | null = null;
  private volumeControl: HTMLDivElement;
  private docListeners: [string, () => void][] = [];
  private timers: number[] = [];

  constructor(
    root: HTMLElement,
    opts: GameOptions,
    private readonly onRestart: () => void,
  ) {
    this.root = root;
    this.opts = opts;
    this.sessionSeed = opts.seed ?? createSessionSeed();

    this.career = loadCareerSafely();
    const nightIndex = opts.night ?? this.career.week.night;
    this.night = nightSpec(nightIndex);
    this.choreDefs = choreDefsFor(this.night);
    this.mum = new MumState(this.career.week.suspicionCarry);
    this.barks = new BarkScheduler(this.night.barks);

    this.host = new HostApp(root, {
      speed: opts.speed,
      seed: this.sessionSeed,
      roomConfig: roomConfigFor(this.night),
      choreDefs: this.choreDefs,
      character: {
        coins: this.career.character.coins,
        xp: { ...this.career.character.xp },
        bridgePass: this.career.character.bridgePass,
      },
      doubleXp: this.night.beats.doubleXp ?? false,
    });
    this.host.mmo.sim.awayPlan = { ...this.career.character.awayPlan };
    this.director = new Director(opts.startAt);
    this.hud = new Hud(root);
    this.audio = new AudioSynth();
    this.volumeControl = this.buildVolumeControl();

    // Seeded sessions (dev `?t=`) need already-requested chores mirrored.
    for (const c of CHORE_ORDER) {
      if (this.director.chores[c].requestedAt !== null) {
        this.host.interact.tracker.request(c);
      }
    }
    if (opts.startAt > BANNER_AT) {
      this.revealObjective();
    }

    this.wire();
    this.wirePause();
    // Seeded sessions need the chore chips painted too, not just the tracker.
    this.refreshChoreChip();
  }

  private wirePause(): void {
    const onLockChange = (): void => {
      if (this.host.pointerLocked) this.hadPointerLock = true;
      this.syncPauseOverlay();
    };
    const onVisibility = (): void => {
      // Dev runs (?speed>1) skip the hidden-pause so headless smoke tests
      // can drive a backgrounded tab to the scorecard.
      if (this.opts.speed === 1) this.hiddenPause = document.hidden;
      this.syncPauseOverlay();
    };
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('visibilitychange', onVisibility);
    this.docListeners.push(['pointerlockchange', onLockChange], ['visibilitychange', onVisibility]);
  }

  /** True while the director AND the sim should both be frozen. */
  private get paused(): boolean {
    if (this.state !== 'playing') return false;
    if (this.hiddenPause) return true;
    // PC Mode has no lock. A normal room run freezes before first lock and
    // whenever that lock is later lost; automation can opt out with skipTitle.
    return this.host.mode === 'room' && this.pointerLockRequired && !this.host.pointerLocked;
  }

  private syncPauseOverlay(): void {
    const show = this.paused && !document.hidden;
    if (show && !this.pauseOverlay) {
      const el = document.createElement('div');
      el.className = 'pause-overlay';
      const hint = document.createElement('button');
      hint.type = 'button';
      hint.className = 'pause-overlay-hint';
      hint.addEventListener('click', () => this.host.requestPointerLock());
      el.appendChild(hint);
      this.root.appendChild(el);
      this.pauseOverlay = el;
    }
    if (show && this.pauseOverlay) {
      const hint = this.pauseOverlay.querySelector<HTMLButtonElement>('.pause-overlay-hint');
      if (hint) {
        hint.textContent = this.hadPointerLock
          ? 'Paused — click to resume'
          : 'Click to start looking';
      }
    } else if (!show && this.pauseOverlay) {
      this.pauseOverlay.remove();
      this.pauseOverlay = null;
    }
  }

  start(): void {
    if (this.disposed) return;
    if (this.opts.skipTitle) {
      this.begin(false);
    } else {
      this.setVolumeControlVisible(false);
      this.titleDispose = showTitle(this.root, this.audio, () => {
        this.setVolumeControlVisible(true);
        this.begin(true);
      });
    }
    this.loop();
  }

  private begin(lockPointer: boolean): void {
    if (this.state !== 'title') return;
    this.state = 'playing';
    this.pointerLockRequired = lockPointer;
    this.hud.setCrosshairVisible(true);
    this.syncPauseOverlay();
    if (lockPointer) this.host.requestPointerLock();
  }

  private wire(): void {
    const respond = (n: number): void => {
      const ev = this.director.respond(n);
      if (ev) this.handleDirectorEvent(ev);
    };
    this.host.router.onPromptOption = respond;
    this.hud.onPromptClick = respond;

    this.host.hooks.onModeChange = (mode) => {
      this.hud.setCrosshairVisible(mode === 'room' && this.state === 'playing');
      if (mode === 'pc') this.hud.setInteractLabel(null);
      this.syncPauseOverlay();
    };

    this.host.interact.onTrackerEvents = (events) => {
      for (const e of events) {
        if (e.type === 'choreStarted') {
          this.director.noteChoreStarted(e.chore);
        } else if (e.type === 'choreCompleted') {
          this.director.noteChoreCompleted(e.chore);
          this.mum.onChoreCompleted();
          const sim = this.host.mmo.sim;
          const completedInDanger = this.host.mmo.inCombat || sim.player.hp <= 4;
          if (completedInDanger) {
            this.choreCompletedInDanger = true;
          }
          const { done, total } = this.host.interact.tracker.progress(e.chore);
          this.hud.showToast(
            choreDoneToast(`${this.choreDefs[e.chore].chip} ${done}/${total}`, completedInDanger),
            this.gameNow,
          );
          this.audio.choreDone();
          this.sayBark('choreDone');
        }
      }
      this.refreshChoreChip();
    };

    this.host.router.onPanic = () => this.panic();

    this.host.interact.onAct = (kind) => {
      if (kind === 'pickup') this.audio.pickup();
      else this.audio.place();
    };

    // MMO sounds are diegetic: when the player is across the room they come
    // out of the CRT's little speaker, so they play attenuated.
    const mmoGain = (): number => (this.host.mode === 'room' ? 0.4 : 1);
    this.host.mmo.onUiSound = () => this.audio.atGain(mmoGain(), () => this.audio.mmoClick());
    this.host.mmo.onEvents = (events) =>
      this.audio.atGain(mmoGain(), () => this.handleMmoEvents(events));
  }

  private handleMmoEvents(events: readonly SimEvent[]): void {
    for (const e of events) {
      if (e.type === 'trade') this.lastTradeT = this.director.t;
      const toast = crossWorldToast(e);
      if (toast !== null) {
        this.hud.showToast(
          toast,
          this.gameNow,
          e.type === 'playerDied' ? 4200 : 3200,
          e.type === 'playerDied' ? 'danger' : 'success',
        );
      }

      switch (e.type) {
        case 'chop':
          this.audio.chop();
          break;
        case 'goblinDied':
        case 'trade':
          this.audio.coin();
          break;
        case 'playerSwing':
        case 'goblinSwing':
          if (e.damage > 0) this.audio.hit();
          break;
        case 'playerDied':
          this.audio.deathSting();
          break;
        case 'objectiveHit':
        case 'allSkills99':
          this.audio.fanfare();
          break;
        case 'levelUp':
        case 'questComplete':
          this.audio.levelUp();
          break;
        case 'eat':
        case 'flax':
          this.audio.pickup();
          break;
        case 'invFull':
          this.audio.uiClick();
          break;
        case 'log':
        case 'openTrade':
        case 'questProgress':
        case 'questReady':
        case 'questAssigned':
          break;
      }
    }
  }

  private buildVolumeControl(): HTMLDivElement {
    const wrap = document.createElement('div');
    wrap.className = 'volume-control';
    const label = document.createElement('label');
    label.textContent = 'VOL';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.id = 'j5mm-volume-slider';
    slider.setAttribute('aria-label', 'Volume');
    label.htmlFor = slider.id;
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    let initial = this.audio.getVolume();
    try {
      const saved = localStorage.getItem('j5mm-volume');
      if (saved !== null) initial = Number(saved);
    } catch {
      // Storage can be unavailable in privacy-restricted embeds.
    }
    if (Number.isFinite(initial)) this.audio.setVolume(initial);
    slider.value = String(this.audio.getVolume());
    slider.addEventListener('input', () => {
      const v = Number(slider.value);
      this.audio.setVolume(v);
      try {
        localStorage.setItem('j5mm-volume', String(v));
      } catch {
        // Volume still works for this run when persistence is unavailable.
      }
    });
    wrap.appendChild(label);
    wrap.appendChild(slider);
    this.root.appendChild(wrap);
    this.overlays.push(wrap);
    return wrap;
  }

  /** Tonight's script for a line, in Mum's current tone. */
  private lineText(lineId: LineId, fallback: string): string {
    const line = this.night.lines[lineId];
    if (!line) return fallback;
    return this.mum.tier >= 2 ? line.tier2 : line.base;
  }

  private sayBark(trigger: BarkTrigger): void {
    // Barks never talk over an open prompt — Mum is many things, not rude.
    if (this.director.activePrompt !== null) return;
    const line = this.barks.pick(trigger, this.mum.tier, this.director.t);
    if (!line) return;
    this.hud.showSubtitle(line, this.gameNow, 4500 / this.opts.speed);
    this.audio.npcVoice(Math.min(6, Math.max(3, Math.round(line.split(' ').length / 2.5))));
  }

  private panic(): void {
    if (this.state !== 'playing') return;
    this.host.setHomework(true);
    this.homeworkOffAt = this.gameNow + 3000 / this.opts.speed;
    this.panicArmedUntil = this.director.t + 10;
    if (!this.factFlags.oldestTrick) {
      this.factFlags.oldestTrick = true;
      this.hud.showToast('homework.doc engaged. A classic.', this.gameNow);
    }
    this.audio.uiClick();
  }

  private handleDirectorEvent(ev: DirectorEvent): void {
    switch (ev.type) {
      case 'npcLine': {
        const text = this.lineText(ev.lineId, ev.text);
        this.hud.showSubtitle(text, this.gameNow, 6000 / this.opts.speed);
        this.hud.openPrompt(this.gameNow, (PROMPT_DURATION * 1000) / this.opts.speed);
        this.host.router.promptActive = true;
        this.host.room.npcSilhouette.visible = true;
        this.host.room.setHallLight(true);
        this.silhouetteHideAt = this.gameNow + 6000 / this.opts.speed;
        this.audio.knock();
        const syllables = Math.min(6, Math.max(3, Math.round(text.split(' ').length / 2.5)));
        this.later(420, () => this.audio.npcVoice(syllables));
        break;
      }
      case 'promptLeadIn':
        this.audio.footsteps();
        break;
      case 'objectiveBanner':
        this.revealObjective();
        break;
      case 'choreRequested': {
        const events = this.host.interact.tracker.request(ev.chore);
        // (a pre-tidied chore can complete instantly)
        this.host.interact.onTrackerEvents?.(events);
        this.refreshChoreChip();
        break;
      }
      case 'promptClosed': {
        this.hud.closePrompt();
        this.host.router.promptActive = false;
        const judgement = this.mum.onPromptClosed(ev.result, ev.option, {
          inCombat: this.host.mmo.inCombat,
          tradedRecently: this.director.t - this.lastTradeT <= 20,
          usedArchivistThisWeek: this.career.week.archivistUsed || this.archivistSpentTonight,
        });
        if (judgement.graceExtendSeconds > 0) {
          this.director.extendNextChore(judgement.graceExtendSeconds);
        }
        this.lieDebtTonight += judgement.lieDebtDelta;
        if (judgement.archivistSpent) this.archivistSpentTonight = true;
        if (judgement.facts.technicallyTrue) this.factFlags.technicallyTrue = true;
        if (judgement.facts.evidenceBased) this.factFlags.evidenceBased = true;
        if (judgement.facts.archivist) this.factFlags.archivist = true;

        if (ev.lineId === 'inspect') {
          const defused = this.director.t <= this.panicArmedUntil;
          this.mum.onInspection(defused);
          if (!defused) this.inspectionFailed = true;
          this.later(900 / this.opts.speed, () => {
            if (this.disposed || this.state !== 'playing') return;
            this.sayBark(defused ? 'inspectionDefused' : 'inspectionFailed');
          });
          break;
        }

        if (ev.result === 'answered') {
          this.audio.uiClick();
          // She always gets the last word. Always.
          const retort = ev.option !== null ? MUM_RETORTS[ev.option - 1] : undefined;
          if (retort) {
            const delay = 900 / this.opts.speed;
            this.later(delay, () => {
              if (this.disposed || this.state !== 'playing') return;
              this.hud.showSubtitle(retort, this.gameNow, 4500 / this.opts.speed);
              this.audio.npcVoice(Math.min(6, Math.max(3, Math.round(retort.split(' ').length / 2.5))));
            });
          }
        }
        break;
      }
      case 'sessionEnd':
        this.endSession();
        break;
    }
  }

  private refreshChoreChip(): void {
    const tracker = this.host.interact.tracker;
    const chips: string[] = [];
    for (const c of CHORE_ORDER) {
      if (!tracker.isRequested(c) || tracker.isCompleted(c)) continue;
      const { done, total } = tracker.progress(c);
      chips.push(`${this.choreDefs[c].chip} ${done}/${total}`);
    }
    this.hud.setChoreChips(chips);
  }

  /** Wednesday's phone call and Thursday's knock, driven off the director clock. */
  private runNightBeats(): void {
    const t = this.director.t;
    const phone = this.night.beats.phone;
    if (phone && this.phonePhase === 'idle' && t >= phone.at) {
      this.phonePhase = 'down';
      this.combatAtDisconnect = this.host.mmo.inCombat;
      this.deathsAtDisconnect = this.host.mmo.sim.stats.deaths;
      this.host.mmo.sim.setConnected(false);
      this.audio.modemDown();
      this.sayBark('phoneForeshadow');
      this.hud.showToast('Connection lost. The landline wins.', this.gameNow, 3600, 'danger');
    }
    if (phone && this.phonePhase === 'down' && t >= phone.until) {
      this.phonePhase = 'done';
      this.host.mmo.sim.setConnected(true);
      this.audio.modemScreech();
      this.sayBark('modemReturn');
      if (this.combatAtDisconnect && this.host.mmo.sim.stats.deaths === this.deathsAtDisconnect) {
        this.factFlags.modemScream = true;
      }
    }

    const inspection = this.night.beats.inspection;
    if (
      inspection && !this.inspectionFired && t >= inspection.at
      && this.mum.suspicion >= inspection.minSuspicion
    ) {
      this.inspectionFired = true;
      for (const ev of this.director.fireInspection()) this.handleDirectorEvent(ev);
    }

    // The evening gets on with itself.
    this.host.room.setDusk(t / SESSION_LENGTH);
    if (!this.lampOn && t >= 210) {
      this.lampOn = true;
      this.host.room.setDeskLamp(true);
      this.sayBark('lampOn');
    }
    if (this.homeworkOffAt !== Number.NEGATIVE_INFINITY && this.gameNow >= this.homeworkOffAt) {
      this.homeworkOffAt = Number.NEGATIVE_INFINITY;
      this.host.setHomework(false);
    }
  }

  private revealObjective(): void {
    const sim = this.host.mmo.sim;
    this.hud.showObjective('');
    this.hud.setObjectiveProgress(
      sim.player.coins,
      sim.player.skills,
      sim.questLabel(),
      sim.stats.objectiveHit,
      sim.stats.statsBonusHit,
    );
  }

  private endSession(): void {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.host.mmo.dismissUi();
    this.host.router.enabled = false;
    this.host.router.promptActive = false;
    this.hud.closePrompt();
    this.hud.setInteractLabel(null);
    this.hud.setCrosshairVisible(false);
    this.hud.root.style.display = 'none';
    this.setVolumeControlVisible(false);
    if (document.pointerLockElement) document.exitPointerLock();

    const sim = this.host.mmo.sim;
    const tracker = this.host.interact.tracker;
    const data: SessionData = {
      coins: sim.player.coins,
      objectiveHit: sim.stats.objectiveHit,
      statsBonusHit: sim.stats.statsBonusHit,
      deaths: sim.stats.deaths,
      deathsWhileAway: sim.stats.deathsWhileAway,
      kills: sim.stats.kills,
      logsSold: sim.stats.logsSold,
      flaxSold: sim.stats.flaxSold,
      bestStreak: sim.stats.bestStreak,
      contractsCompleted: sim.stats.contractsCompleted,
      skills: { ...sim.player.skills },
      prompts: this.director.prompts.map((p) => ({
        lineId: p.lineId,
        result: p.result === 'answered' ? 'answered' : 'ignored',
        option: p.option,
      })),
      chores: CHORE_ORDER.map((c) => ({ ...this.director.chores[c] })),
      choreCompletedInDanger: this.choreCompletedInDanger,
      inspectionFailed: this.inspectionFailed,
    };
    const score = computeScore(data);
    const history = recordReportSafely(score.total);

    // Fold the night into the career: the character keeps what it earned.
    this.career = recordNight(
      {
        ...this.career,
        character: {
          coins: sim.player.coins,
          xp: { ...sim.player.skills },
          bridgePass: sim.bridgePass,
          awayPlan: { ...sim.awayPlan },
        },
        version: 1,
      },
      {
        total: score.total,
        rows: [score.mmo, score.household, score.vibe, score.comedy],
        endingTitle: score.endingTitle,
        seed: this.sessionSeed,
        milestones: [...sim.milestones],
      },
      this.mum.suspicion,
      this.lieDebtTonight,
      this.archivistSpentTonight,
    );
    try {
      saveCareer(localStorage, this.career);
    } catch {
      // A blocked localStorage costs persistence, not the report.
    }
    const card = showScorecard(
      this.root,
      score,
      {
        coins: sim.player.coins,
        deaths: sim.stats.deaths,
        choresDone: CHORE_ORDER.filter((c) => tracker.isCompleted(c)).length,
        choresTotal: CHORE_ORDER.length,
        statsBonusHit: sim.stats.statsBonusHit,
        kills: sim.stats.kills,
        bestStreak: sim.stats.bestStreak,
        contractsCompleted: sim.stats.contractsCompleted,
        skillLevels: {
          woodcutting: levelOf(sim.player.skills.woodcutting),
          attack: levelOf(sim.player.skills.attack),
          foraging: levelOf(sim.player.skills.foraging),
        },
        seed: this.sessionSeed,
        history,
      },
      () => this.restart(),
    );
    this.overlays.push(card);
  }

  private restart(): void {
    if (this.disposed) return;
    this.onRestart();
  }

  private setVolumeControlVisible(visible: boolean): void {
    this.volumeControl.style.display = visible ? 'flex' : 'none';
    this.volumeControl.inert = !visible;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.titleDispose?.();
    this.titleDispose = null;
    for (const id of this.timers) window.clearTimeout(id);
    this.timers = [];
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    for (const [type, fn] of this.docListeners) document.removeEventListener(type, fn);
    this.docListeners = [];
    if (this.host.pointerLocked) document.exitPointerLock();
    this.pauseOverlay?.remove();
    this.pauseOverlay = null;
    for (const el of this.overlays) el.remove();
    this.overlays = [];
    this.hud.dispose();
    this.audio.dispose();
    this.host.dispose();
  }

  private last = 0;

  private later(ms: number, fn: () => void): void {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  private loop(): void {
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    if (this.last === 0) this.last = now;
    const dtMs = Math.min(100, now - this.last);
    this.last = now;

    const paused = this.paused;
    this.host.paused = paused || this.state !== 'playing';
    if (this.state === 'playing' && !paused) {
      this.gameNow += dtMs;
      for (const ev of this.director.update((dtMs / 1000) * this.opts.speed)) {
        this.handleDirectorEvent(ev);
      }
      if (this.state === 'playing') this.runNightBeats();
    }
    if (this.state !== 'ended') {
      this.host.update(dtMs);
    }

    // HUD upkeep
    if (this.state === 'playing') {
      this.hud.setClock(SESSION_LENGTH - this.director.t);
      this.hud.setObjectiveProgress(
        this.host.mmo.sim.player.coins,
        this.host.mmo.sim.player.skills,
        this.host.mmo.sim.questLabel(),
        this.host.mmo.sim.stats.objectiveHit,
        this.host.mmo.sim.stats.statsBonusHit,
      );
      const prompt = this.host.mode === 'room' ? this.host.prompt : null;
      this.hud.setInteractLabel(prompt?.label ?? null, prompt?.actionable ?? true);
      this.hud.setMumStatus(MUM_TIER_LABELS[this.mum.tier] ?? null, this.mum.tier);
      if (this.host.room.npcSilhouette.visible && this.gameNow > this.silhouetteHideAt) {
        this.host.room.npcSilhouette.visible = false;
        this.host.room.setHallLight(false);
      }
    }
    this.hud.update(this.gameNow);

    if (this.state === 'ended') {
      this.raf = 0;
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };
}
