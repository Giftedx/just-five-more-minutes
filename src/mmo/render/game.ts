import { MudwickSim, type SimCharacter } from '../sim/sim';
import type { MenuOption, SimEvent } from '../sim/types';
import { MmoRenderer } from './renderer';

export const BASE_TICK_MS = 600;

/**
 * Owns the sim + canvas renderer + native mouse input for Mudwick Online.
 * The sim ticks whenever update() is called, whether or not anyone watches.
 */
export class MmoGame {
  readonly sim: MudwickSim;
  readonly renderer: MmoRenderer;
  /** Director/sim speed multiplier (dev affordance). */
  speed: number;
  paused = false;
  onEvents: ((events: SimEvent[]) => void) | null = null;
  onUiSound: ((name: 'click' | 'confirm') => void) | null = null;

  private acc = 0;
  private now = 0;
  private renderAcc = 0;

  constructor(
    seed?: number,
    speed = 1,
    simOpts: { character?: SimCharacter | undefined; doubleXp?: boolean | undefined } = {},
  ) {
    const opts: ConstructorParameters<typeof MudwickSim>[0] = {};
    if (seed !== undefined) opts.seed = seed;
    if (simOpts.character !== undefined) opts.character = simOpts.character;
    if (simOpts.doubleXp !== undefined) opts.doubleXp = simOpts.doubleXp;
    this.sim = new MudwickSim(opts);
    this.speed = speed;
    this.renderer = new MmoRenderer(this.sim, BASE_TICK_MS / speed);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.canvas;
  }

  /** True while the player is in melee with an aggroed goblin. */
  get inCombat(): boolean {
    return this.sim.isInCombat();
  }

  /** Close modal Mudwick UI when leaving PC mode. */
  dismissUi(): void {
    this.renderer.dismissOverlays();
  }

  /** Advance time. `playerAway` = player is not seated at the PC. */
  update(dtMs: number, playerAway: boolean, render = true): void {
    this.renderAcc += dtMs;
    if (!this.paused) {
      // Renderer clock freezes with the sim so messages/markers don't expire
      // (and hitsplats don't vanish) during a pause.
      this.now += dtMs;
      this.acc += dtMs;
      const tickMs = BASE_TICK_MS / this.speed;
      this.renderer.setTickMs(tickMs);
      // Cap catch-up so a long frame doesn't fast-forward the world.
      let steps = 0;
      while (this.acc >= tickMs && steps < 10) {
        this.acc -= tickMs;
        this.sim.step({ playerAway });
        steps++;
      }
      if (steps === 10) this.acc = 0;
      const events = this.sim.drainEvents();
      if (events.length > 0) {
        this.renderer.consumeEvents(events, this.now);
        this.onEvents?.(events);
      }
    }
    if (render) {
      const renderDtMs = this.renderAcc;
      this.renderAcc = 0;
      this.renderer.render(this.now, renderDtMs);
    }
  }

  /** Wire mouse handling onto the element that displays the canvas. */
  attachInput(el: HTMLElement): void {
    el.addEventListener('mousemove', (e) => {
      const p = this.toCanvas(el, e);
      this.renderer.mouse = p;
      const m = this.renderer.menu;
      if (m) m.hover = this.renderer.menuIndexAt(p.x, p.y);
    });
    el.addEventListener('mouseleave', () => {
      this.renderer.mouse = null;
    });
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const p = this.toCanvas(el, e);
      if (this.renderer.tradeOpen) return;
      const tile = this.renderer.tileAt(p.x, p.y);
      if (!tile) return;
      this.onUiSound?.('click');
      this.renderer.openMenu(p.x, p.y, this.sim.optionsAt(tile.x, tile.y));
    });
    el.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const p = this.toCanvas(el, e);
      this.handleLeftClick(p.x, p.y);
    });
  }

  private handleLeftClick(cx: number, cy: number): void {
    if (this.renderer.tradeOpen) {
      const btn = this.renderer.tradeButtonAt(cx, cy);
      if (btn === 'log' || btn === 'flax') {
        const result = this.sim.sell(btn);
        if (result.sold === 0) return;
        this.onUiSound?.('confirm');
        const events = this.sim.drainEvents();
        this.renderer.consumeEvents(events, this.nowMs());
        this.onEvents?.(events);
      } else if (btn === 'quest') {
        if (this.sim.turnInQuest()) {
          this.onUiSound?.('confirm');
          const events = this.sim.drainEvents();
          this.renderer.consumeEvents(events, this.nowMs());
          this.onEvents?.(events);
        }
      } else if (btn === 'done') {
        this.renderer.tradeOpen = false;
        this.onUiSound?.('click');
      }
      return;
    }

    const menu = this.renderer.menu;
    if (menu) {
      const idx = this.renderer.menuIndexAt(cx, cy);
      this.renderer.menu = null;
      const opt = idx >= 0 ? menu.options[idx] : undefined;
      if (opt) this.invokeOption(opt, cx, cy);
      return;
    }

    const tile = this.renderer.tileAt(cx, cy);
    if (!tile) return;
    const opt = this.sim.defaultOptionAt(tile.x, tile.y);
    if (opt) this.invokeOption(opt, cx, cy);
  }

  private invokeOption(opt: MenuOption, cx: number, cy: number): void {
    if (opt.act.kind === 'examine') {
      this.renderer.postMessage(opt.act.text, this.nowMs());
      this.onUiSound?.('click');
      return;
    }
    if (opt.act.kind === 'none') return;
    this.sim.invoke(opt);
    this.renderer.addClickMarker(cx, cy, opt.act.kind === 'intent', this.nowMs());
    this.onUiSound?.('confirm');
  }

  private nowMs(): number {
    return this.now;
  }

  private toCanvas(el: HTMLElement, e: MouseEvent): { x: number; y: number } {
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    return { x: Math.floor(x), y: Math.floor(y) };
  }
}
