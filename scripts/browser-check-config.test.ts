import { describe, expect, it } from 'vitest';
import {
  normalizePreviewBase,
  parseBrowserCheckArgs,
} from './browser-check-config.mjs';

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
    expect(parseBrowserCheckArgs([])).toEqual({ base: '/', artifactOnly: false });
  });

  it('parses the mounted artifact-only mode', () => {
    expect(parseBrowserCheckArgs([
      '--artifact-only',
      '--base=/just-five-more-minutes/',
    ])).toEqual({ base: '/just-five-more-minutes/', artifactOnly: true });
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
