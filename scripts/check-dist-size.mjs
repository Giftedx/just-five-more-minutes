/** Deterministic compressed-size budgets for standalone Vite assets. */
import { readdir, readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const assetsDir = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const budgets = {
  JavaScript: { extension: '.js', gzip: 200 * 1024 },
  CSS: { extension: '.css', gzip: 10_112 },
};

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await filesBelow(path));
    else if (entry.isFile()) files.push(path);
  }
  return files.sort();
}

const files = await filesBelow(assetsDir);
let failed = false;

for (const [label, budget] of Object.entries(budgets)) {
  const matching = files.filter((file) => file.endsWith(budget.extension));
  if (matching.length === 0) {
    throw new Error(`dist/assets contains no ${budget.extension} artifacts`);
  }

  let rawTotal = 0;
  let gzipTotal = 0;
  for (const file of matching) {
    const contents = await readFile(file);
    rawTotal += contents.byteLength;
    gzipTotal += gzipSync(contents, { level: 9, mtime: 0 }).byteLength;
  }

  console.log(
    `${label}: ${rawTotal} raw bytes, ${gzipTotal} gzip bytes `
      + `(${matching.length} file${matching.length === 1 ? '' : 's'}, budget ${budget.gzip})`,
  );
  if (gzipTotal > budget.gzip) {
    failed = true;
    console.error(`${label} gzip budget exceeded by ${gzipTotal - budget.gzip} bytes`);
  }
}

if (failed) process.exitCode = 1;
