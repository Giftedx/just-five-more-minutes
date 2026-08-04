/** Own a strict, short-lived preview and run browser checks against its build. */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseBrowserCheckArgs } from './browser-check-config.mjs';
import { findAvailableLoopbackPort } from './available-port.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const viteBin = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url));
const artifactScript = fileURLToPath(new URL('./artifact-smoke.mjs', import.meta.url));
const smokeScript = fileURLToPath(new URL('./smoke.mjs', import.meta.url));
const e2eScript = fileURLToPath(new URL('./e2e-full.mjs', import.meta.url));
const weekScript = fileURLToPath(new URL('./e2e-week.mjs', import.meta.url));
const options = parseBrowserCheckArgs(process.argv.slice(2));
const previewPort = await findAvailableLoopbackPort(4173);
const previewOrigin = `http://127.0.0.1:${previewPort}`;
const previewUrl = new URL(options.base, `${previewOrigin}/`).href;

const preview = spawn(
  process.execPath,
  [
    viteBin,
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    String(previewPort),
    '--strictPort',
    '--base',
    options.base,
  ],
  { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] },
);

let previewOutput = '';
let previewSettled = false;
let previewResult = null;

const capture = (stream, destination) => {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    previewOutput += chunk;
    destination.write(chunk);
  });
};
capture(preview.stdout, process.stdout);
capture(preview.stderr, process.stderr);

const previewExit = new Promise((resolve) => {
  preview.once('error', (error) => {
    previewSettled = true;
    previewResult = { code: null, signal: null, error };
    resolve(previewResult);
  });
  preview.once('exit', (code, signal) => {
    if (previewSettled) return;
    previewSettled = true;
    previewResult = { code, signal, error: null };
    resolve(previewResult);
  });
});

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForPreview() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (previewSettled) {
      throw new Error(`preview exited before readiness (${formatExit(previewResult)})\n${previewOutput}`);
    }

    // Requiring Vite's own listening banner prevents a successful fetch from
    // being mistaken for ownership when a stale process already has the port.
    const plainOutput = previewOutput.replace(/\u001b\[[0-9;]*m/g, '');
    const ownListeningBanner = plainOutput.includes(previewUrl);
    if (ownListeningBanner) {
      try {
        const response = await fetch(previewUrl, {
          cache: 'no-store',
          signal: AbortSignal.timeout(750),
        });
        if (response.status === 200 && !previewSettled) return;
      } catch {
        // The listener can be announced a fraction before the first response.
      }
    }
    await delay(100);
  }
  throw new Error(`preview did not become ready within 15 seconds\n${previewOutput}`);
}

async function runCheck(label, script, smokeUrl) {
  console.log(`\n> ${label}`);
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [script], {
      cwd: root,
      env: { ...process.env, SMOKE_URL: smokeUrl },
      stdio: 'inherit',
    });
    let settled = false;
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      console.error(`${label} could not start: ${error.message}`);
      resolve(1);
    });
    child.once('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      if (signal) console.error(`${label} terminated by ${signal}`);
      resolve(code ?? 1);
    });
  });
}

const waitForExitWithin = (ms) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(false), ms);
  previewExit.then(() => {
    clearTimeout(timer);
    resolve(true);
  });
});

async function stopPreview() {
  if (previewSettled) {
    await previewExit;
    return;
  }
  preview.kill('SIGTERM');
  if (await waitForExitWithin(5_000)) return;
  preview.kill('SIGKILL');
  await previewExit;
}

function formatExit(result) {
  if (!result) return 'unknown exit';
  if (result.error) return result.error.message;
  if (result.signal) return `signal ${result.signal}`;
  return `code ${result.code}`;
}

let exitCode = 0;
try {
  await waitForPreview();
  if (options.artifactOnly) {
    exitCode = await runCheck('artifact resource smoke', artifactScript, previewUrl);
  } else {
    exitCode = await runCheck('isolated browser smoke', smokeScript, previewUrl);
    if (exitCode === 0) {
      const fullUrl = new URL(previewUrl);
      fullUrl.searchParams.set('speed', '10');
      fullUrl.searchParams.set('skipTitle', '1');
      fullUrl.searchParams.set('seed', String(0x00c0ffee));
      exitCode = await runCheck('full interaction E2E', e2eScript, fullUrl.href);
    }
    if (exitCode === 0) {
      exitCode = await runCheck('week progression E2E', weekScript, previewUrl);
    }
  }
} catch (error) {
  exitCode = 1;
  console.error(error instanceof Error ? error.stack ?? error.message : error);
} finally {
  await stopPreview();
}

if (exitCode === 0) {
  console.log(options.artifactOnly
    ? '\nARTIFACT CHECK PASS — preview stopped cleanly'
    : '\nBROWSER CHECKS PASS — preview stopped cleanly');
}
process.exitCode = exitCode;
