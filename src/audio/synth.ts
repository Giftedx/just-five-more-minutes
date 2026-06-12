/**
 * All game audio, synthesized at runtime with WebAudio. No asset files.
 */
export class AudioSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private roomToneNodes: AudioNode[] = [];
  private volume = 0.6;
  private unlocked = false;

  constructor() {
    // Resume on the first user gesture (autoplay policy).
    const unlock = (): void => {
      this.ensureCtx();
      void this.ctx?.resume();
      this.unlocked = true;
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    }
  }

  getVolume(): number {
    return this.volume;
  }

  private ensureCtx(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
    } catch {
      return null;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.startRoomTone();
    return this.ctx;
  }

  private get ready(): boolean {
    return this.unlocked && this.ensureCtx() !== null && this.ctx?.state === 'running';
  }

  // ----- building blocks ------------------------------------------------

  private tone(
    freq: number,
    opts: {
      type?: OscillatorType;
      at?: number;
      dur?: number;
      gain?: number;
      glideTo?: number;
      attack?: number;
    } = {},
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.at ?? 0);
    const dur = opts.dur ?? 0.1;
    const g = this.ctx.createGain();
    const osc = this.ctx.createOscillator();
    osc.type = opts.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glideTo), t0 + dur);
    }
    const peak = opts.gain ?? 0.18;
    const attack = opts.attack ?? 0.004;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    osc.connect(g).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  private thump(
    freqFrom: number,
    freqTo: number,
    opts: { at?: number; dur?: number; gain?: number; noise?: number; noiseFreq?: number } = {},
  ): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + (opts.at ?? 0);
    const dur = opts.dur ?? 0.12;
    this.tone(freqFrom, {
      type: 'triangle',
      at: opts.at ?? 0,
      dur,
      gain: opts.gain ?? 0.3,
      glideTo: freqTo,
    });
    if (opts.noise && opts.noise > 0) {
      const buf = this.noiseBuffer(dur);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = opts.noiseFreq ?? 300;
      filter.Q.value = 1.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(opts.noise, t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
      src.connect(filter).connect(g).connect(this.master);
      src.start(t0);
    }
  }

  private noiseBuffer(seconds: number): AudioBuffer {
    const ctx = this.ctx;
    if (!ctx) throw new Error('no ctx');
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private startRoomTone(): void {
    if (!this.ctx || !this.master) return;
    // soft hum: detuned low sines + heavily lowpassed noise
    const g = this.ctx.createGain();
    g.gain.value = 0.022;
    g.connect(this.master);
    for (const f of [50, 60.4]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      osc.connect(g);
      osc.start();
      this.roomToneNodes.push(osc);
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer(2);
    noise.loop = true;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 160;
    const ng = this.ctx.createGain();
    ng.gain.value = 0.05;
    noise.connect(lp).connect(ng).connect(g);
    noise.start();
    this.roomToneNodes.push(noise);
  }

  // ----- game sounds ------------------------------------------------------

  knock(): void {
    if (!this.ready) return;
    this.thump(160, 70, { dur: 0.09, gain: 0.4, noise: 0.25, noiseFreq: 180 });
    this.thump(150, 65, { at: 0.18, dur: 0.09, gain: 0.36, noise: 0.22, noiseFreq: 180 });
  }

  /** Animal Crossing-ish mumble: short filtered blips, one per syllable. */
  npcVoice(syllables: number): void {
    if (!this.ready) return;
    const n = Math.max(3, Math.min(6, syllables));
    let t = 0.05;
    for (let i = 0; i < n; i++) {
      const base = 240 + Math.random() * 120;
      const up = i === n - 1 && Math.random() > 0.5 ? 1.3 : 0.92;
      this.tone(base, {
        type: 'square',
        at: t,
        dur: 0.07 + Math.random() * 0.04,
        gain: 0.05,
        glideTo: base * up,
      });
      this.tone(base / 2, { type: 'sine', at: t, dur: 0.08, gain: 0.06 });
      t += 0.085 + Math.random() * 0.05;
    }
  }

  uiClick(): void {
    if (!this.ready) return;
    this.tone(1250, { dur: 0.035, gain: 0.1 });
  }

  mmoClick(): void {
    if (!this.ready) return;
    this.tone(820, { dur: 0.03, gain: 0.09 });
    this.tone(620, { at: 0.035, dur: 0.04, gain: 0.07 });
  }

  chop(): void {
    if (!this.ready) return;
    this.thump(140, 55, { dur: 0.12, gain: 0.3, noise: 0.3, noiseFreq: 250 });
  }

  coin(): void {
    if (!this.ready) return;
    this.tone(1320, { dur: 0.1, gain: 0.1 });
    this.tone(1760, { at: 0.07, dur: 0.16, gain: 0.09 });
  }

  /** The 100-coin objective fanfare. */
  fanfare(): void {
    if (!this.ready) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this.tone(f, { type: 'square', at: i * 0.11, dur: 0.22, gain: 0.07 });
      this.tone(f * 2, { type: 'sine', at: i * 0.11, dur: 0.2, gain: 0.05 });
    });
    this.tone(1046.5, { type: 'square', at: 0.46, dur: 0.45, gain: 0.08 });
  }

  hit(): void {
    if (!this.ready) return;
    this.thump(220, 90, { dur: 0.08, gain: 0.22, noise: 0.18, noiseFreq: 420 });
  }

  deathSting(): void {
    if (!this.ready) return;
    const seq = [220, 174.6, 146.8];
    seq.forEach((f, i) => {
      this.tone(f, { type: 'triangle', at: i * 0.16, dur: 0.3, gain: 0.16 });
    });
    this.tone(73.4, { type: 'sine', at: 0.45, dur: 0.6, gain: 0.18 });
  }

  pickup(): void {
    if (!this.ready) return;
    this.tone(620, { dur: 0.05, gain: 0.1, glideTo: 940 });
  }

  place(): void {
    if (!this.ready) return;
    this.tone(940, { dur: 0.06, gain: 0.1, glideTo: 600 });
    this.tone(300, { at: 0.04, dur: 0.06, gain: 0.08 });
  }

  /** Little success jingle for finishing a chore. */
  choreDone(): void {
    if (!this.ready) return;
    this.tone(659.25, { type: 'triangle', dur: 0.1, gain: 0.1 });
    this.tone(880, { type: 'triangle', at: 0.09, dur: 0.18, gain: 0.1 });
  }

  dispose(): void {
    for (const n of this.roomToneNodes) {
      if (n instanceof OscillatorNode || n instanceof AudioBufferSourceNode) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
    }
    this.roomToneNodes = [];
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
  }
}
