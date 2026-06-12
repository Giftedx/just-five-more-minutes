import { MAP_H, MAP_W, TILE, tileChar } from '../sim/map';
import { COIN_OBJECTIVE, MudwickSim, PLAYER_MAX_HP } from '../sim/sim';
import type { MenuOption, Point, SimEvent } from '../sim/types';
import { drawSprite, GOBLIN_SPRITE, PLAYER_SPRITE, TRADER_SPRITE } from './sprites';

export const CANVAS_W = 320;
export const CANVAS_H = 240;
export const VIEW_W = 240; // world viewport width; right 80px is the side panel
export const PANEL_W = CANVAS_W - VIEW_W;

interface Hitsplat {
  x: number;
  y: number;
  dmg: number;
  until: number;
}

interface Splash {
  text: string;
  until: number;
}

interface MenuState {
  x: number;
  y: number;
  w: number;
  h: number;
  options: MenuOption[];
  hover: number;
}

interface ClickMarker {
  x: number;
  y: number;
  until: number;
  red: boolean;
}

/** Smoothly displayed entity positions, in world pixels. */
type DispMap = Map<string, { x: number; y: number }>;

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class MmoRenderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sim: MudwickSim;
  private disp: DispMap = new Map();
  private hitsplats: Hitsplat[] = [];
  private message: Splash | null = null;
  private objectiveFlash = 0;
  menu: MenuState | null = null;
  tradeOpen = false;
  /** Mouse position in canvas pixels, or null when the cursor is elsewhere. */
  mouse: Point | null = null;
  private markers: ClickMarker[] = [];
  private camX = 0;
  private tickMs: number;

  constructor(sim: MudwickSim, tickMs: number) {
    this.sim = sim;
    this.tickMs = tickMs;
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
  }

  setTickMs(ms: number): void {
    this.tickMs = ms;
  }

  /** World-pixel position an entity is currently drawn at. */
  private displayed(id: string, tile: Point, dtMs: number): { x: number; y: number } {
    const target = { x: tile.x * TILE, y: tile.y * TILE };
    let d = this.disp.get(id);
    if (!d) {
      d = { ...target };
      this.disp.set(id, d);
    }
    const speed = (TILE / this.tickMs) * dtMs * 1.15;
    const dx = target.x - d.x;
    const dy = target.y - d.y;
    const dist = Math.hypot(dx, dy);
    if (dist > TILE * 2.5) {
      // Teleport (respawn) — snap.
      d.x = target.x;
      d.y = target.y;
    } else if (dist > 0.01) {
      const move = Math.min(dist, speed);
      d.x += (dx / dist) * move;
      d.y += (dy / dist) * move;
    }
    return d;
  }

  consumeEvents(events: SimEvent[], now: number): void {
    for (const ev of events) {
      switch (ev.type) {
        case 'playerSwing': {
          const g = this.sim.goblinById(ev.goblinId);
          if (g) {
            const d = this.disp.get(ev.goblinId) ?? { x: g.pos.x * TILE, y: g.pos.y * TILE };
            this.hitsplats.push({ x: d.x + 8, y: d.y + 8, dmg: ev.damage, until: now + 700 });
          }
          break;
        }
        case 'goblinSwing': {
          const d = this.disp.get('player') ?? {
            x: this.sim.player.pos.x * TILE,
            y: this.sim.player.pos.y * TILE,
          };
          this.hitsplats.push({ x: d.x + 8, y: d.y + 8, dmg: ev.damage, until: now + 700 });
          break;
        }
        case 'goblinDied':
          this.postMessage(`The goblin drops ${ev.coins} coins.`, now);
          break;
        case 'playerDied':
          this.postMessage(
            ev.coinsLost > 0 ? `Oh dear, you are dead! (-${ev.coinsLost} coins)` : 'Oh dear, you are dead!',
            now,
          );
          break;
        case 'invFull':
          this.postMessage("Your backpack is full.", now);
          break;
        case 'objectiveHit':
          this.objectiveFlash = now + 4000;
          this.postMessage('100 coins! The economy thanks you.', now);
          break;
        case 'trade':
          this.postMessage(`Sold ${ev.sold} ${ev.item}${ev.sold === 1 ? '' : 's'} for ${ev.gained}gp.`, now);
          break;
        case 'openTrade':
          this.tradeOpen = true;
          break;
        case 'chop':
        case 'log':
        case 'flax':
        case 'eat':
          break;
      }
    }
  }

  postMessage(text: string, now: number): void {
    this.message = { text, until: now + 3000 };
  }

  addClickMarker(canvasX: number, canvasY: number, red: boolean, now: number): void {
    this.markers.push({ x: canvasX + this.camX, y: canvasY, until: now + 450, red });
  }

  openMenu(canvasX: number, canvasY: number, options: MenuOption[]): void {
    const w = Math.max(90, ...options.map((o) => o.label.length * 5 + 10));
    const h = 11 + options.length * 10;
    const x = Math.min(Math.max(0, canvasX - w / 2), CANVAS_W - w);
    const y = Math.min(canvasY, CANVAS_H - h);
    this.menu = { x, y, w, h, options, hover: -1 };
  }

  /** Index of the menu row under a canvas point, or -1. */
  menuIndexAt(cx: number, cy: number): number {
    const m = this.menu;
    if (!m) return -1;
    if (cx < m.x || cx > m.x + m.w) return -1;
    const i = Math.floor((cy - m.y - 10) / 10);
    return i >= 0 && i < m.options.length ? i : -1;
  }

  /** Convert canvas coords to a world tile, or null if over the panel/UI. */
  tileAt(cx: number, cy: number): Point | null {
    if (cx >= VIEW_W) return null;
    const x = Math.floor((cx + this.camX) / TILE);
    const y = Math.floor(cy / TILE);
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return null;
    return { x, y };
  }

  /** Trade dialog button under a canvas point: 'log' | 'flax' | 'done' | null. */
  tradeButtonAt(cx: number, cy: number): 'log' | 'flax' | 'done' | null {
    if (!this.tradeOpen) return null;
    const bx = 40;
    const bw = 200;
    if (cx < bx + 10 || cx > bx + bw - 10) return null;
    if (cy >= 100 && cy < 118) return 'log';
    if (cy >= 122 && cy < 140) return 'flax';
    if (cy >= 144 && cy < 160) return 'done';
    return null;
  }

  render(now: number, dtMs: number): void {
    const ctx = this.ctx;
    const sim = this.sim;

    const pd = this.displayed('player', sim.player.pos, dtMs);
    this.camX = Math.max(0, Math.min(MAP_W * TILE - VIEW_W, pd.x - VIEW_W / 2 + TILE / 2));

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, VIEW_W, CANVAS_H);
    ctx.clip();
    ctx.translate(-Math.round(this.camX), 0);

    this.drawTerrain();
    this.drawStatics(now);
    this.drawGoblins(dtMs);

    drawSprite(ctx, PLAYER_SPRITE, Math.round(pd.x) + 2, Math.round(pd.y) + 1);

    this.drawTreeTops();
    this.drawMarkers(now);
    this.drawHitsplats(now);
    ctx.restore();

    this.drawObjectiveBanner(now);
    this.drawMessage(now);
    this.drawHoverText();
    this.drawPanel();
    if (this.tradeOpen) this.drawTradeDialog();
    if (this.menu) this.drawMenu();
    this.drawLowHpPulse(now);
  }

  private drawTerrain(): void {
    const ctx = this.ctx;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = tileChar(x, y);
        const px = x * TILE;
        const py = y * TILE;
        const inPen = x >= 13 && x <= 16 && y >= 8 && y <= 11;
        const h = hash2(x, y);
        if (inPen || ch === '+') {
          ctx.fillStyle = h > 0.5 ? '#8a7250' : '#82694a';
        } else {
          ctx.fillStyle = h > 0.66 ? '#4e7a33' : h > 0.33 ? '#48732f' : '#52803a';
        }
        ctx.fillRect(px, py, TILE, TILE);
        // dither speckle
        if (h > 0.8) {
          ctx.fillStyle = inPen ? '#76603f' : '#3f6829';
          ctx.fillRect(px + Math.floor(h * 13), py + Math.floor(hash2(y, x) * 13), 2, 2);
        }
      }
    }
  }

  private drawStatics(now: number): void {
    const ctx = this.ctx;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const ch = tileChar(x, y);
        const px = x * TILE;
        const py = y * TILE;
        switch (ch) {
          case '#': {
            // border woods
            ctx.fillStyle = '#243d18';
            ctx.fillRect(px, py, TILE, TILE);
            ctx.fillStyle = '#2e4d20';
            ctx.fillRect(px + 2, py + 2, 5, 5);
            ctx.fillRect(px + 9, py + 8, 5, 5);
            break;
          }
          case 'F': {
            ctx.fillStyle = '#6b4a26';
            ctx.fillRect(px, py + 5, TILE, 3);
            ctx.fillRect(px, py + 11, TILE, 3);
            ctx.fillStyle = '#54381c';
            ctx.fillRect(px + 2, py + 3, 3, 12);
            ctx.fillRect(px + 11, py + 3, 3, 12);
            break;
          }
          case 'f': {
            ctx.fillStyle = '#3f6829';
            ctx.fillRect(px, py, TILE, TILE);
            for (let i = 0; i < 4; i++) {
              const fx = px + 2 + (i % 2) * 7 + Math.floor(hash2(x + i, y) * 3);
              const fy = py + 2 + Math.floor(i / 2) * 7 + Math.floor(hash2(y, x + i) * 3);
              ctx.fillStyle = '#3c7a2e';
              ctx.fillRect(fx + 1, fy + 2, 1, 4);
              ctx.fillStyle = '#7fa8e8';
              ctx.fillRect(fx, fy, 3, 3);
              ctx.fillStyle = '#cfe0ff';
              ctx.fillRect(fx + 1, fy + 1, 1, 1);
            }
            break;
          }
          case 'c': {
            // campfire
            ctx.fillStyle = '#4a4a4a';
            ctx.fillRect(px + 2, py + 10, 12, 4);
            ctx.fillStyle = '#6b4a26';
            ctx.fillRect(px + 3, py + 9, 10, 3);
            const flick = Math.floor(now / 120) % 2 === 0;
            ctx.fillStyle = flick ? '#e8762a' : '#d8601f';
            ctx.fillRect(px + 5, py + 4, 6, 6);
            ctx.fillStyle = flick ? '#f5c542' : '#f0a832';
            ctx.fillRect(px + 6, py + 2 + (flick ? 0 : 1), 4, 5);
            break;
          }
          case 'b': {
            // bread table
            ctx.fillStyle = '#7a5a30';
            ctx.fillRect(px + 1, py + 5, 14, 8);
            ctx.fillStyle = '#5c421f';
            ctx.fillRect(px + 2, py + 13, 2, 3);
            ctx.fillRect(px + 12, py + 13, 2, 3);
            ctx.fillStyle = '#d8a85a';
            ctx.fillRect(px + 4, py + 6, 8, 4);
            ctx.fillStyle = '#eac98a';
            ctx.fillRect(px + 5, py + 7, 6, 1);
            break;
          }
          case 'Y': {
            // trader stall + Wyn
            ctx.fillStyle = '#8a5a2e';
            ctx.fillRect(px - 2, py + 11, 20, 5);
            ctx.fillStyle = '#a04444';
            ctx.fillRect(px - 2, py - 3, 20, 3);
            ctx.fillStyle = '#c8c0a0';
            ctx.fillRect(px - 2, py - 1, 20, 1);
            drawSprite(this.ctx, TRADER_SPRITE, px + 2, py - 1);
            ctx.fillStyle = '#e8c33f';
            ctx.fillRect(px + 1, py + 12, 3, 2);
            ctx.fillRect(px + 11, py + 12, 3, 2);
            break;
          }
          default:
            break;
        }
      }
    }
    // choppable trees / stumps (trunks at ground level)
    for (const t of this.sim.trees) {
      const px = t.pos.x * TILE;
      const py = t.pos.y * TILE;
      if (t.chopped) {
        this.ctx.fillStyle = '#7a5a30';
        this.ctx.fillRect(px + 5, py + 7, 6, 6);
        this.ctx.fillStyle = '#caa86a';
        this.ctx.fillRect(px + 6, py + 8, 4, 4);
      } else {
        this.ctx.fillStyle = '#5c421f';
        this.ctx.fillRect(px + 6, py + 8, 4, 7);
      }
    }
  }

  /** Tree canopies drawn after actors so they overlap a little (depth flavour). */
  private drawTreeTops(): void {
    const ctx = this.ctx;
    for (const t of this.sim.trees) {
      if (t.chopped) continue;
      const px = t.pos.x * TILE;
      const py = t.pos.y * TILE;
      ctx.fillStyle = '#2e5c1e';
      ctx.fillRect(px - 1, py - 4, 18, 12);
      ctx.fillStyle = '#3c7a2e';
      ctx.fillRect(px + 1, py - 6, 14, 10);
      ctx.fillStyle = '#4d9438';
      ctx.fillRect(px + 3, py - 5, 7, 5);
    }
  }

  private drawGoblins(dtMs: number): void {
    for (const g of this.sim.goblins) {
      if (!g.alive) continue;
      const d = this.displayed(g.id, g.pos, dtMs);
      drawSprite(this.ctx, GOBLIN_SPRITE, Math.round(d.x) + 2, Math.round(d.y) + 2);
      if (g.hp < 3) {
        // tiny hp bar
        this.ctx.fillStyle = '#900';
        this.ctx.fillRect(Math.round(d.x) + 2, Math.round(d.y) - 2, 12, 2);
        this.ctx.fillStyle = '#0c0';
        this.ctx.fillRect(Math.round(d.x) + 2, Math.round(d.y) - 2, Math.max(0, (g.hp / 3) * 12), 2);
      }
    }
  }

  private drawMarkers(now: number): void {
    this.markers = this.markers.filter((m) => m.until > now);
    for (const m of this.markers) {
      const ctx = this.ctx;
      ctx.strokeStyle = m.red ? '#e84a4a' : '#e8d44f';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.x - 3, m.y - 3);
      ctx.lineTo(m.x + 3, m.y + 3);
      ctx.moveTo(m.x + 3, m.y - 3);
      ctx.lineTo(m.x - 3, m.y + 3);
      ctx.stroke();
    }
  }

  private drawHitsplats(now: number): void {
    const ctx = this.ctx;
    this.hitsplats = this.hitsplats.filter((h) => h.until > now);
    for (const h of this.hitsplats) {
      ctx.fillStyle = h.dmg === 0 ? '#2a4a9c' : '#b02020';
      ctx.beginPath();
      ctx.arc(h.x, h.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(h.dmg), h.x, h.y + 1);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
    }
  }

  private drawObjectiveBanner(now: number): void {
    const ctx = this.ctx;
    const coins = this.sim.player.coins;
    const hit = this.sim.stats.objectiveHit;
    const flashing = this.objectiveFlash > now && Math.floor(now / 200) % 2 === 0;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, CANVAS_H - 11, VIEW_W, 11);
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = flashing ? '#ffe96b' : hit ? '#8be86b' : '#ffd23f';
    const label = hit
      ? `Objective complete! ${coins} coins`
      : `Earn ${COIN_OBJECTIVE} coins before dinner! (${Math.min(coins, COIN_OBJECTIVE)}/${COIN_OBJECTIVE})`;
    ctx.fillText(label, 3, CANVAS_H - 9);
  }

  private drawMessage(now: number): void {
    if (!this.message || this.message.until < now) return;
    const ctx = this.ctx;
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(this.message.text).width + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, CANVAS_H - 24, w, 11);
    ctx.fillStyle = '#e8e8e8';
    ctx.fillText(this.message.text, 3, CANVAS_H - 22);
  }

  private drawHoverText(): void {
    if (this.menu || this.tradeOpen) return;
    const m = this.mouse;
    if (!m) return;
    const tile = this.tileAt(m.x, m.y);
    if (!tile) return;
    const opts = this.sim.optionsAt(tile.x, tile.y);
    const first = opts[0];
    if (!first) return;
    const extra = opts.length - 1;
    const text = extra > 0 ? `${first.label} / ${extra} more` : first.label;
    const ctx = this.ctx;
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    const w = ctx.measureText(text).width + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, w, 11);
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(text, 3, 2);
  }

  private drawPanel(): void {
    const ctx = this.ctx;
    const x0 = VIEW_W;
    ctx.fillStyle = '#5c4a32';
    ctx.fillRect(x0, 0, PANEL_W, CANVAS_H);
    ctx.fillStyle = '#c8b088';
    ctx.fillRect(x0 + 2, 2, PANEL_W - 4, CANVAS_H - 4);

    // coin counter
    ctx.fillStyle = '#e8c33f';
    ctx.beginPath();
    ctx.arc(x0 + 12, 12, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8932a';
    ctx.beginPath();
    ctx.arc(x0 + 12, 12, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2c18';
    ctx.font = '8px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(this.sim.player.coins), x0 + 21, 13);
    ctx.textBaseline = 'alphabetic';

    // HP orbs (two rows of five)
    const hp = this.sim.player.hp;
    for (let i = 0; i < PLAYER_MAX_HP; i++) {
      const ox = x0 + 9 + (i % 5) * 13;
      const oy = 28 + Math.floor(i / 5) * 12;
      ctx.fillStyle = i < hp ? '#c03030' : '#705848';
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fill();
      if (i < hp) {
        ctx.fillStyle = '#e87a7a';
        ctx.fillRect(ox - 2, oy - 2, 2, 2);
      }
    }

    // inventory 4x7
    const inv = this.sim.player.inventory;
    const slot = 17;
    const gx = x0 + 6;
    const gy = 52;
    ctx.font = '7px monospace';
    for (let i = 0; i < 28; i++) {
      const sx = gx + (i % 4) * slot;
      const sy = gy + Math.floor(i / 4) * slot;
      ctx.fillStyle = '#b09a74';
      ctx.fillRect(sx, sy, slot - 2, slot - 2);
      ctx.strokeStyle = '#8a754f';
      ctx.strokeRect(sx + 0.5, sy + 0.5, slot - 3, slot - 3);
      const item = inv[i];
      if (item === 'log') {
        ctx.fillStyle = '#7a5a30';
        ctx.fillRect(sx + 2, sy + 5, 11, 5);
        ctx.fillStyle = '#caa86a';
        ctx.fillRect(sx + 2, sy + 6, 11, 1);
      } else if (item === 'flax') {
        ctx.fillStyle = '#3c7a2e';
        ctx.fillRect(sx + 6, sy + 6, 2, 7);
        ctx.fillStyle = '#7fa8e8';
        ctx.fillRect(sx + 4, sy + 2, 6, 5);
        ctx.fillStyle = '#cfe0ff';
        ctx.fillRect(sx + 6, sy + 4, 2, 2);
      }
    }

    ctx.fillStyle = '#7a6444';
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('Mudwick', x0 + 14, CANVAS_H - 20);
    ctx.fillText('Online', x0 + 18, CANVAS_H - 12);
  }

  private drawTradeDialog(): void {
    const ctx = this.ctx;
    const x = 40;
    const y = 70;
    const w = 200;
    const h = 96;
    ctx.fillStyle = '#5c4a32';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#c8b088';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = '#3a2c18';
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.fillText('Trader Wyn buys:', x + 8, y + 8);

    const logs = this.sim.invCount('log');
    const flax = this.sim.invCount('flax');
    const button = (by: number, label: string, enabled: boolean): void => {
      ctx.fillStyle = enabled ? '#8a754f' : '#a89878';
      ctx.fillRect(x + 10, by, w - 20, 16);
      ctx.fillStyle = enabled ? '#ffe9b0' : '#cabfa6';
      ctx.fillText(label, x + 16, by + 4);
    };
    button(100, `Sell all logs (${logs}) - 7gp each`, logs > 0);
    button(122, `Sell all flax (${flax}) - 2gp each`, flax > 0);
    button(144, 'Done', true);
  }

  private drawMenu(): void {
    const m = this.menu;
    if (!m) return;
    const ctx = this.ctx;
    ctx.fillStyle = '#5c5040';
    ctx.fillRect(m.x, m.y, m.w, m.h);
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(m.x + 1, m.y + 1, m.w - 2, 9);
    ctx.font = '7px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#5c5040';
    ctx.fillText('Choose Option', m.x + 3, m.y + 2);
    ctx.fillStyle = '#c8b088';
    ctx.fillRect(m.x + 1, m.y + 10, m.w - 2, m.h - 11);
    m.options.forEach((opt, i) => {
      const oy = m.y + 11 + i * 10;
      if (i === m.hover) {
        ctx.fillStyle = '#a89060';
        ctx.fillRect(m.x + 1, oy - 1, m.w - 2, 10);
      }
      ctx.fillStyle = '#2a2018';
      ctx.fillText(opt.label, m.x + 4, oy);
    });
  }

  private drawLowHpPulse(now: number): void {
    const hp = this.sim.player.hp;
    if (hp > 3) return;
    const a = 0.18 + 0.14 * (0.5 + 0.5 * Math.sin(now / 180));
    const ctx = this.ctx;
    ctx.strokeStyle = `rgba(200,20,20,${a.toFixed(3)})`;
    for (let i = 0; i < 6; i++) {
      ctx.lineWidth = 1;
      ctx.globalAlpha = a * (1 - i / 6);
      ctx.strokeStyle = '#c01414';
      ctx.strokeRect(i + 0.5, i + 0.5, CANVAS_W - 1 - i * 2, CANVAS_H - 1 - i * 2);
    }
    ctx.globalAlpha = 1;
  }
}
