export interface RandomSource {
  getRandomValues(array: Uint32Array): Uint32Array;
}

export function parseNightOverride(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 4 ? parsed : undefined;
}

export function parseSessionSeed(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed >>> 0 : undefined;
}

export function createSessionSeed(source?: RandomSource): number {
  const values = new Uint32Array(1);
  if (source) return source.getRandomValues(values)[0] ?? 0;
  if (typeof globalThis.crypto !== 'undefined') {
    return globalThis.crypto.getRandomValues(values)[0] ?? 0;
  }
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}

export function formatSessionSeed(seed: number): string {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
}
