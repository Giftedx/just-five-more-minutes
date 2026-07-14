import { describe, expect, it } from 'vitest';
import * as rendererModule from './renderer';

type DisconnectFrame = { retryLabel: string; activeSegments: number };
type DisconnectFrameFn = (now: number) => DisconnectFrame;

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
