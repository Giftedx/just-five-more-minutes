import { AudioSynth } from './audio/synth';
import { CHORE_DEFS } from './host/chores';
import { HostApp } from './host/app';
import {
  Director,
  PROMPT_DURATION,
  SESSION_LENGTH,
  type ChoreId,
  type DirectorEvent,
} from './director/director';
import { computeScore, type SessionData } from './score/score';
import { Hud } from './ui/hud';
import { showScorecard } from './ui/scorecard';
import { showTitle } from './ui/title';

export interface GameOptions {
  speed: number;
  startAt: number;
  skipTitle: boolean;
  seed?: number;
}

const CHORE_ORDER: readonly ChoreId[] = ['mugs', 'wrappers', 'laundry'];

/** Full session: title -> 12 minutes of divided attention -> incident report. */
export class Game {
  private root: HTMLElement;
  private opts: GameOptions;
  private host: HostApp;
  private director: Director;
  private hud: Hud;
  private audio: AudioSynth;
  private state: 'title' | 'playing' | 'ended' = 'title';
  private choreCompletedInDanger = false;
  private silhouetteHideAt = 0;
  private nowMs = 0;
  private raf = 0;
  private overlays: HTMLElement[] = [];
  private disposed = false;

  constructor(root: HTMLElement, opts: GameOptions) {
    this.root = root;
    this.opts = opts;
    const hostOpts: { speed: number; seed?: number } = { speed: opts.speed };
    if (opts.seed !== undefined) hostOpts.seed = opts.seed;
    this.host = new HostApp(root, hostOpts);
    this.director = new Director(opts.startAt);
    this.hud = new Hud(root);
    this.audio = new AudioSynth();
    this.buildVolumeControl();

    // Seeded sessions (dev `?t=`) need already-requested chores mirrored.
    for (const c of CHORE_ORDER) {
      if (this.director.chores[c].requestedAt !== null) {
        this.host.interact.tracker.request(c);
      }
    }
    if (opts.startAt > 45) {
      this.hud.showObjective('Earn 100 coins in Mudwick before dinner. (0/100)');
    }

    this.wire();
  }

  start(): void {
    if (this.opts.skipTitle) {
      this.begin(false);
    } else {
      const { begun } = showTitle(this.root);
      void begun.then(() => this.begin(true));
    }
    this.loop();
  }

  private begin(lockPointer: boolean): void {
    if (this.state !== 'title') return;
    this.state = 'playing';
    this.hud.setCrosshairVisible(true);
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
    };

    this.host.interact.onTrackerEvents = (events) => {
      for (const e of events) {
        if (e.type === 'choreStarted') {
          this.director.noteChoreStarted(e.chore);
        } else if (e.type === 'choreCompleted') {
          this.director.noteChoreCompleted(e.chore);
          const sim = this.host.mmo.sim;
          if (this.host.mmo.inCombat || sim.player.hp <= 4) {
            this.choreCompletedInDanger = true;
          }
          this.hud.showToast(`${CHORE_DEFS[e.chore].chip} — sorted.`, this.nowMs);
          this.audio.choreDone();
        }
      }
      this.refreshChoreChip();
    };

    this.host.interact.onAct = (kind) => {
      if (kind === 'pickup') this.audio.pickup();
      else this.audio.place();
    };

    this.host.mmo.onUiSound = () => this.audio.mmoClick();
    this.host.mmo.onEvents = (events) => {
      for (const e of events) {
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
            this.audio.fanfare();
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
            break;
        }
      }
    };
  }

  private buildVolumeControl(): void {
    const wrap = document.createElement('div');
    wrap.className = 'volume-control';
    const label = document.createElement('span');
    label.textContent = 'VOL';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '1';
    slider.step = '0.05';
    slider.value = String(this.audio.getVolume());
    slider.addEventListener('input', () => this.audio.setVolume(Number(slider.value)));
    wrap.appendChild(label);
    wrap.appendChild(slider);
    this.root.appendChild(wrap);
    this.overlays.push(wrap);
  }

  private handleDirectorEvent(ev: DirectorEvent): void {
    switch (ev.type) {
      case 'npcLine': {
        this.hud.showSubtitle(ev.text, this.nowMs, 6000 / this.opts.speed);
        this.hud.openPrompt(this.nowMs, (PROMPT_DURATION * 1000) / this.opts.speed);
        this.host.router.promptActive = true;
        this.host.room.npcSilhouette.visible = true;
        this.silhouetteHideAt = this.nowMs + 6000 / this.opts.speed;
        this.audio.knock();
        const syllables = Math.min(6, Math.max(3, Math.round(ev.text.split(' ').length / 2.5)));
        window.setTimeout(() => this.audio.npcVoice(syllables), 420);
        break;
      }
      case 'objectiveBanner':
        this.hud.showObjective('Earn 100 coins in Mudwick before dinner. (0/100)');
        break;
      case 'choreRequested': {
        const events = this.host.interact.tracker.request(ev.chore);
        // (a pre-tidied chore can complete instantly)
        this.host.interact.onTrackerEvents?.(events);
        this.refreshChoreChip();
        break;
      }
      case 'promptClosed':
        this.hud.closePrompt();
        this.host.router.promptActive = false;
        if (ev.result === 'answered') this.audio.uiClick();
        break;
      case 'sessionEnd':
        this.endSession();
        break;
    }
  }

  private refreshChoreChip(): void {
    const tracker = this.host.interact.tracker;
    const active = tracker.activeChore(CHORE_ORDER);
    if (!active) {
      this.hud.setChoreChip(null);
      return;
    }
    const { done, total } = tracker.progress(active);
    this.hud.setChoreChip(`${CHORE_DEFS[active].chip} ${done}/${total}`);
  }

  private endSession(): void {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.host.router.enabled = false;
    this.host.router.promptActive = false;
    this.hud.closePrompt();
    this.hud.setInteractLabel(null);
    this.hud.setCrosshairVisible(false);
    this.hud.root.style.display = 'none';
    if (document.pointerLockElement) document.exitPointerLock();

    const sim = this.host.mmo.sim;
    const tracker = this.host.interact.tracker;
    const data: SessionData = {
      coins: sim.player.coins,
      objectiveHit: sim.stats.objectiveHit,
      deaths: sim.stats.deaths,
      deathsWhileAway: sim.stats.deathsWhileAway,
      prompts: this.director.prompts.map((p) => ({
        lineId: p.lineId,
        result: p.result === 'answered' ? 'answered' : 'ignored',
        option: p.option,
      })),
      chores: CHORE_ORDER.map((c) => ({ ...this.director.chores[c] })),
      choreCompletedInDanger: this.choreCompletedInDanger,
    };
    const score = computeScore(data);
    const card = showScorecard(
      this.root,
      score,
      {
        coins: sim.player.coins,
        deaths: sim.stats.deaths,
        choresDone: CHORE_ORDER.filter((c) => tracker.isCompleted(c)).length,
        choresTotal: CHORE_ORDER.length,
      },
      () => this.restart(),
    );
    this.overlays.push(card);
  }

  private restart(): void {
    const root = this.root;
    const opts = this.opts;
    this.dispose();
    const next = new Game(root, opts);
    next.start();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const el of this.overlays) el.remove();
    this.hud.dispose();
    this.audio.dispose();
    this.host.dispose();
  }

  private last = 0;

  private loop(): void {
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    if (this.disposed) return;
    if (this.last === 0) this.last = now;
    const dtMs = Math.min(100, now - this.last);
    this.last = now;
    this.nowMs = now;

    if (this.state === 'playing') {
      for (const ev of this.director.update((dtMs / 1000) * this.opts.speed)) {
        this.handleDirectorEvent(ev);
      }
    }
    if (this.state !== 'ended') {
      this.host.update(this.state === 'playing' ? dtMs : 0);
    }

    // HUD upkeep
    if (this.state === 'playing') {
      this.hud.setClock(SESSION_LENGTH - this.director.t);
      this.hud.setObjectiveProgress(this.host.mmo.sim.player.coins, this.host.mmo.sim.stats.objectiveHit);
      const prompt = this.host.mode === 'room' ? this.host.prompt : null;
      this.hud.setInteractLabel(prompt?.label ?? null, prompt?.actionable ?? true);
      if (this.host.room.npcSilhouette.visible && now > this.silhouetteHideAt) {
        this.host.room.npcSilhouette.visible = false;
      }
    }
    this.hud.update(now);

    this.raf = requestAnimationFrame(this.tick);
  };
}
