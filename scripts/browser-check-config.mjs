/** Normalize a same-origin Vite preview mount path. */
export function normalizePreviewBase(raw) {
  if (
    typeof raw !== 'string'
    || raw.length === 0
    || !raw.startsWith('/')
    || raw.startsWith('//')
    || raw.slice(1).includes('//')
    || raw.includes('?')
    || raw.includes('#')
    || raw.includes('\\')
    || raw.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`invalid preview base: ${JSON.stringify(raw)}`);
  }

  return raw === '/' ? '/' : `${raw.replace(/\/+$/, '')}/`;
}

/** Parse the deliberately small public CLI of the managed browser runner. */
export function parseBrowserCheckArgs(argv) {
  let artifactOnly = false;
  let baseRaw = null;
  let nights = null;

  for (const arg of argv) {
    if (arg === '--artifact-only') {
      artifactOnly = true;
      continue;
    }
    if (arg.startsWith('--base=')) {
      if (baseRaw !== null) throw new Error('only one --base argument is allowed');
      baseRaw = arg.slice('--base='.length);
      continue;
    }
    if (arg.startsWith('--nights=')) {
      if (nights !== null) throw new Error('Use only one --nights argument.');
      const values = arg.slice('--nights='.length).split(',');
      if (values.some((value) => !/^[0-4]$/.test(value))) {
        throw new Error('Use a comma-separated night list with integers from 0 to 4.');
      }
      nights = values.map(Number);
      continue;
    }
    throw new Error(`unknown browser-check argument: ${arg}`);
  }

  return {
    base: normalizePreviewBase(baseRaw ?? '/'),
    artifactOnly,
    nights: nights ?? [0, 1, 2, 3, 4],
  };
}
