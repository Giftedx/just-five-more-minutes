import { describe, expect, it } from 'vitest';
import { createSessionSeed, formatSessionSeed, parseNightOverride, parseSessionSeed } from './session';

describe('night override helper', () => {
  it('rejects absent, blank, non-numeric, non-integer, and out-of-range text', () => {
    expect(parseNightOverride(null)).toBeUndefined();
    expect(parseNightOverride('')).toBeUndefined();
    expect(parseNightOverride('  ')).toBeUndefined();
    expect(parseNightOverride('abc')).toBeUndefined();
    expect(parseNightOverride('2.5')).toBeUndefined();
    expect(parseNightOverride('-1')).toBeUndefined();
    expect(parseNightOverride('5')).toBeUndefined();
  });

  it('accepts Monday and Friday overrides', () => {
    expect(parseNightOverride('0')).toBe(0);
    expect(parseNightOverride('4')).toBe(4);
  });
});

describe('session seed helpers', () => {
  it('parses integer seed text as an unsigned 32-bit value', () => {
    expect(parseSessionSeed('12648430')).toBe(12648430);
    expect(parseSessionSeed('-1')).toBe(0xffffffff);
    expect(parseSessionSeed('0x00C0FFEE')).toBe(0x00c0ffee);
  });

  it('rejects absent, blank, non-numeric, and non-integer seed text', () => {
    expect(parseSessionSeed(null)).toBeUndefined();
    expect(parseSessionSeed('   ')).toBeUndefined();
    expect(parseSessionSeed('nope')).toBeUndefined();
    expect(parseSessionSeed('1.5')).toBeUndefined();
  });

  it('creates a seed with the supplied random source', () => {
    const source = {
      getRandomValues(array: Uint32Array): Uint32Array {
        array[0] = 0x12345678;
        return array;
      },
    };

    expect(createSessionSeed(source)).toBe(0x12345678);
  });

  it('formats a seed as eight uppercase hexadecimal digits', () => {
    expect(formatSessionSeed(0xc0ffee)).toBe('00C0FFEE');
  });
});
