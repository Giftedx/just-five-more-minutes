import { describe, expect, it } from 'vitest';
import {
  getE2eNightRuns,
  normalizePreviewBase,
  parseBrowserCheckArgs,
} from './browser-check-config.mjs';

describe('getE2eNightRuns', () => {
  it('returns one distinct run descriptor for each night', () => {
    expect(getE2eNightRuns()).toEqual([
      { night: 0, label: 'full interaction E2E night 0' },
      { night: 1, label: 'full interaction E2E night 1' },
      { night: 2, label: 'full interaction E2E night 2' },
      { night: 3, label: 'full interaction E2E night 3' },
      { night: 4, label: 'full interaction E2E night 4' },
    ]);
  });
});

describe('normalizePreviewBase', () => {
  it('keeps root and adds one trailing slash to a mounted path', () => {
    expect(normalizePreviewBase('/')).toBe('/');
    expect(normalizePreviewBase('/just-five-more-minutes')).toBe('/just-five-more-minutes/');
    expect(normalizePreviewBase('/just-five-more-minutes/')).toBe('/just-five-more-minutes/');
  });

  it('rejects non-path, ambiguous, or traversal-like values', () => {
    for (const value of [
      '',
      'just-five-more-minutes',
      '//example.test/game',
      '/game//nested',
      '/game/../admin',
      '/game?mode=1',
      '/game#fragment',
      '/game\\assets',
    ]) {
      expect(() => normalizePreviewBase(value)).toThrow(/preview base/i);
    }
  });
});

describe('parseBrowserCheckArgs', () => {
  it('defaults to the full standalone browser suite', () => {
    expect(parseBrowserCheckArgs([])).toEqual({
      base: '/',
      artifactOnly: false,
      nights: [0, 1, 2, 3, 4],
    });
  });

  it('parses the mounted artifact-only mode', () => {
    expect(parseBrowserCheckArgs([
      '--artifact-only',
      '--base=/just-five-more-minutes/',
    ])).toEqual({
      base: '/just-five-more-minutes/',
      artifactOnly: true,
      nights: [0, 1, 2, 3, 4],
    });
  });

  it('parses a selected night list', () => {
    expect(parseBrowserCheckArgs(['--nights=1,3'])).toEqual({
      base: '/',
      artifactOnly: false,
      nights: [1, 3],
    });
  });

  it('rejects an out-of-range night', () => {
    expect(() => parseBrowserCheckArgs(['--nights=5'])).toThrow(/night.*0.*4/i);
  });

  it('rejects unknown arguments', () => {
    expect(() => parseBrowserCheckArgs(['--grep=title'])).toThrow(/unknown browser-check argument/i);
  });

  it('rejects duplicate base arguments', () => {
    expect(() => parseBrowserCheckArgs(['--base=/', '--base=/game/'])).toThrow(
      /only one --base/i,
    );
  });
});
