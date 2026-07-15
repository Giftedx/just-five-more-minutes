import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MudwickSim } from '../sim/sim';
import type { SimEvent } from '../sim/types';
import * as rendererModule from './renderer';
import { MmoRenderer } from './renderer';

type DisconnectFrame = { retryLabel: string; activeSegments: number };
type DisconnectFrameFn = (now: number) => DisconnectFrame;
type XpDropLabelFn = (
  baseAmount: number,
  skill: 'woodcutting' | 'attack' | 'foraging' | 'fishing',
  multiplier: 1 | 2,
) => string;

interface CrowdGhostSnapshot {
  id: string;
  pos: { x: number; y: number };
  nextMoveAt: number;
  say: string | null;
  sayUntil: number;
  nextSayAt: number;
}

interface CrowdHarness {
  ghosts: CrowdGhostSnapshot[];
  updateGhosts(now: number): void;
}

function crowdHarness(renderer: MmoRenderer): CrowdHarness {
  return renderer as unknown as CrowdHarness;
}

function crowdSnapshot(renderer: MmoRenderer): CrowdGhostSnapshot[] {
  return crowdHarness(renderer).ghosts.map(({ id, pos, nextMoveAt, say, sayUntil, nextSayAt }) => ({
    id,
    pos: { ...pos },
    nextMoveAt,
    say,
    sayUntil,
    nextSayAt,
  }));
}

beforeEach(() => {
  const gradient = { addColorStop: vi.fn() };
  const context = {
    imageSmoothingEnabled: false,
    createRadialGradient: vi.fn(() => gradient),
    fillRect: vi.fn(),
    fillStyle: '',
  };
  vi.stubGlobal('document', {
    createElement: vi.fn(() => ({
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    })),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('seeded crowd isolation', () => {
  it('replays the same crowd timeline for the same seed and diverges for another seed', () => {
    const timeline = [1_000, 6_000, 18_000, 30_000, 46_000, 91_000];
    const make = (crowdSeed: number): MmoRenderer => (
      new MmoRenderer(new MudwickSim({ seed: 0xc0ffee }), 600, crowdSeed)
    );
    const a = make(13);
    const b = make(13);
    const other = make(14);

    for (const now of timeline) {
      crowdHarness(a).updateGhosts(now);
      crowdHarness(b).updateGhosts(now);
      crowdHarness(other).updateGhosts(now);
    }
    const death: SimEvent[] = [{ type: 'playerDied', coinsLost: 0, whileAway: false }];
    a.consumeEvents(death, 92_000);
    b.consumeEvents(death, 92_000);
    other.consumeEvents(death, 92_000);

    expect(crowdSnapshot(a)).toEqual(crowdSnapshot(b));
    expect(crowdSnapshot(other)).not.toEqual(crowdSnapshot(a));
  });

  it('does not perturb simulation outcomes while the crowd advances', () => {
    const withCrowd = new MudwickSim({ seed: 0xc0ffee });
    const withoutCrowd = new MudwickSim({ seed: 0xc0ffee });
    const renderer = new MmoRenderer(withCrowd, 600, 13);

    for (let tick = 1; tick <= 200; tick++) {
      crowdHarness(renderer).updateGhosts(tick * 600);
      withCrowd.step({ playerAway: true });
      withoutCrowd.step({ playerAway: true });
    }

    expect(JSON.parse(JSON.stringify(withCrowd))).toEqual(JSON.parse(JSON.stringify(withoutCrowd)));
  });
});

describe('modem outage presentation', () => {
  it('advances retry copy and activity from renderer time without mutable state', () => {
    const disconnectFrame = (rendererModule as typeof rendererModule & {
      disconnectFrame?: DisconnectFrameFn;
    }).disconnectFrame;

    expect(disconnectFrame).toBeTypeOf('function');
    if (!disconnectFrame) return;

    expect(disconnectFrame(0)).toEqual({ retryLabel: 'Retrying.', activeSegments: 1 });
    expect(disconnectFrame(199)).toEqual({ retryLabel: 'Retrying.', activeSegments: 1 });
    expect(disconnectFrame(200)).toEqual({ retryLabel: 'Retrying.', activeSegments: 2 });
    expect(disconnectFrame(399)).toEqual({ retryLabel: 'Retrying.', activeSegments: 2 });
    expect(disconnectFrame(400)).toEqual({ retryLabel: 'Retrying..', activeSegments: 3 });
    expect(disconnectFrame(800)).toEqual({ retryLabel: 'Retrying...', activeSegments: 5 });
    expect(disconnectFrame(1_000)).toEqual({ retryLabel: 'Retrying...', activeSegments: 6 });
    expect(disconnectFrame(1_200)).toEqual({ retryLabel: 'Retrying.', activeSegments: 1 });
  });

  it('keeps the small failure status above the 4.5:1 contrast floor', () => {
    const palette = (rendererModule as typeof rendererModule & {
      DISCONNECT_COLORS?: { failure: string; footer: string };
    }).DISCONNECT_COLORS;
    expect(palette).toBeDefined();
    if (!palette) return;

    const luminance = (hex: string): number => {
      const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
      const linear = channels.map((channel) => (
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      ));
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    const values = [luminance(palette.failure), luminance(palette.footer)].sort((a, b) => b - a);
    const contrast = (values[0]! + 0.05) / (values[1]! + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Friday double XP presentation', () => {
  it('reports the granted amount and reinforces the active multiplier', () => {
    const xpDropLabel = (rendererModule as typeof rendererModule & {
      xpDropLabel?: XpDropLabelFn;
    }).xpDropLabel;

    expect(xpDropLabel).toBeTypeOf('function');
    if (!xpDropLabel) return;

    expect(xpDropLabel(10, 'fishing', 1)).toBe('+10 Fishing');
    expect(xpDropLabel(10, 'fishing', 2)).toBe('+20 Fishing · 2×');
    expect(xpDropLabel(25, 'woodcutting', 2)).toBe('+50 Woodcutting · 2×');
  });

  it('keeps persistent event copy above the 4.5:1 contrast floor', () => {
    const palette = (rendererModule as typeof rendererModule & {
      DOUBLE_XP_COLORS?: { backdrop: string; gold: string; parchment: string };
    }).DOUBLE_XP_COLORS;
    expect(palette).toBeDefined();
    if (!palette) return;

    const luminance = (hex: string): number => {
      const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
      const linear = channels.map((channel) => (
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      ));
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    const contrast = (a: string, b: string): number => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0]! + 0.05) / (values[1]! + 0.05);
    };

    expect(contrast(palette.parchment, palette.backdrop)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.gold, palette.backdrop)).toBeGreaterThanOrEqual(4.5);
  });

  it('pins the authored strip copy independently of pixel anchors', () => {
    const copy = (rendererModule as typeof rendererModule & {
      DOUBLE_XP_COPY?: { badge: string; label: string; detail: string };
    }).DOUBLE_XP_COPY;

    expect(copy).toEqual({ badge: '2×', label: 'DOUBLE XP', detail: 'FRIDAY EVENT' });
  });
});

describe('away plan command strip', () => {
  it('pins the exact caption, chip order, and native geometry', () => {
    const ui = (rendererModule as typeof rendererModule & {
      AWAY_PLAN_UI?: {
        plate: { x: number; y: number; w: number; h: number };
        caption: string;
        chips: readonly {
          key: 'keepWorking' | 'eatBread' | 'runHome' | 'autoSell';
          label: string;
          x: number;
          y: number;
          w: number;
          h: number;
        }[];
      };
    }).AWAY_PLAN_UI;

    expect(ui).toEqual({
      plate: { x: 131, y: 1, w: 108, h: 22 },
      caption: 'AWAY PLAN',
      chips: [
        { key: 'keepWorking', label: 'WORK', x: 135, y: 10, w: 24, h: 11 },
        { key: 'eatBread', label: 'EAT', x: 161, y: 10, w: 24, h: 11 },
        { key: 'runHome', label: 'HOME', x: 187, y: 10, w: 24, h: 11 },
        { key: 'autoSell', label: 'SELL', x: 213, y: 10, w: 24, h: 11 },
      ],
    });
  });

  it('maps every drawn chip and excludes caption, gaps, and right/bottom edges', () => {
    const sim = new MudwickSim({ seed: 13 });
    const renderer = new MmoRenderer(sim, 600, 13);

    expect(renderer.awayPlanButtonAt(135, 10)).toBe('keepWorking');
    expect(renderer.awayPlanButtonAt(158.99, 20.99)).toBe('keepWorking');
    expect(renderer.awayPlanButtonAt(161, 10)).toBe('eatBread');
    expect(renderer.awayPlanButtonAt(187, 10)).toBe('runHome');
    expect(renderer.awayPlanButtonAt(236.99, 20.99)).toBe('autoSell');
    expect(renderer.awayPlanButtonAt(134.99, 10)).toBeNull();
    expect(renderer.awayPlanButtonAt(159, 10)).toBeNull();
    expect(renderer.awayPlanButtonAt(135, 9.99)).toBeNull();
    expect(renderer.awayPlanButtonAt(237, 10)).toBeNull();
    expect(renderer.awayPlanButtonAt(213, 21)).toBeNull();
    expect(renderer.awayPlanButtonAt(140, 6)).toBeNull();
    expect(sim.awayPlan).toEqual({ keepWorking: false, eatBread: false, runHome: false, autoSell: false });
  });

  it('keeps caption, OFF, ON, and hover text above 4.5:1', () => {
    const colors = (rendererModule as typeof rendererModule & {
      AWAY_PLAN_COLORS?: Record<string, string>;
    }).AWAY_PLAN_COLORS;
    expect(colors).toBeDefined();
    if (!colors) return;

    const luminance = (hex: string): number => {
      const channels = [1, 3, 5]
        .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
    };
    const contrast = (a: string, b: string): number => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0]! + 0.05) / (values[1]! + 0.05);
    };

    expect(contrast(colors.caption!, colors.plate!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.offText!, colors.offBg!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.onText!, colors.onBg!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.hover!, colors.offBg!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.hover!, colors.onBg!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('hover action readout', () => {
  it('pins the bounded plate and authored palette', () => {
    const ui = (rendererModule as typeof rendererModule & {
      HOVER_ACTION_UI?: {
        plate: { x: number; y: number; w: number; h: number };
        primary: { x: number; y: number; font: string };
        detail: { x: number; y: number; font: string };
        colors: Record<string, string>;
      };
    }).HOVER_ACTION_UI;

    expect(ui).toEqual({
      plate: { x: 1, y: 1, w: 128, h: 22 },
      primary: { x: 4, y: 3, font: '7px monospace' },
      detail: { x: 4, y: 13, font: 'bold 6px monospace' },
      colors: {
        plate: '#172012',
        border: '#6f7f54',
        verb: '#f0ead8',
        target: '#9be8e0',
        detail: '#d8c79d',
      },
    });
  });

  it('preserves the bridge action and separates the context-menu cue', () => {
    const frame = (rendererModule as typeof rendererModule & {
      hoverActionFrame?: (label: string, extra: number) => {
        verb: string;
        target: string | null;
        detail: string;
      };
    }).hoverActionFrame;

    expect(frame).toBeTypeOf('function');
    if (!frame) return;
    expect(frame('Cross bridge (10gp toll)', 2)).toEqual({
      verb: 'Cross',
      target: 'bridge (10gp toll)',
      detail: '2 MORE · RIGHT-CLICK',
    });
    expect(frame('Walk here', 2)).toEqual({
      verb: 'Walk here',
      target: null,
      detail: '2 MORE · RIGHT-CLICK',
    });
    expect(frame('Examine Fence', 1)).toEqual({
      verb: 'Examine',
      target: 'Fence',
      detail: '1 MORE · RIGHT-CLICK',
    });
  });

  it('keeps every small text role above 4.5:1 against the plate', () => {
    const ui = (rendererModule as typeof rendererModule & {
      HOVER_ACTION_UI?: { colors: Record<string, string> };
    }).HOVER_ACTION_UI;
    expect(ui).toBeDefined();
    if (!ui) return;

    const luminance = (hex: string): number => {
      const channels = [1, 3, 5]
        .map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
        .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
    };
    const contrast = (a: string, b: string): number => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0]! + 0.05) / (values[1]! + 0.05);
    };

    expect(contrast(ui.colors.verb!, ui.colors.plate!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ui.colors.target!, ui.colors.plate!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(ui.colors.detail!, ui.colors.plate!)).toBeGreaterThanOrEqual(4.5);
  });
});
