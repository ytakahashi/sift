#!/usr/bin/env node
import { statSync } from 'node:fs';

// Validates the npm publish tarball against an explicit allowlist and size ceiling.
// Reads `pnpm pack --dry-run --json --ignore-scripts` output from stdin (see
// `package:check`). This is independent of the `files` field in package.json,
// so it also catches `files` itself drifting (e.g. widened to `dist` and
// re-including the Electron build) rather than just trusting that config.

// A trip wire, not a tight budget: sized well above the current baseline
// (~680 KB unpacked) so routine client asset growth doesn't require bumping
// it, while still catching an accidental multi-hundred-MB Electron/node_modules
// inclusion. Only the unpacked size is checked because `pnpm pack --json` does
// not report the tarball size, and the unpacked size bounds it anyway.
const MAX_UNPACKED_BYTES = 3_000_000;

const ALLOWED_PATH_PATTERNS = [
  /^package\.json$/,
  /^README\.md$/,
  /^LICENSE$/,
  /^dist\/cli\/index\.js$/,
  /^dist\/client\//,
];

const REQUIRED_PATHS = ['dist/cli/index.js', 'dist/client/index.html'];

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

// `pnpm pack --json` lists paths only, so sizes are read from the working tree.
// pnpm runs package scripts from the package root, which the paths are relative to.
function measureUnpackedSize(paths) {
  return paths.reduce((total, path) => total + statSync(path).size, 0);
}

function collectErrors(pack) {
  const errors = [];
  const paths = pack.files.map((file) => file.path);
  const unpackedSize = measureUnpackedSize(paths);

  for (const path of paths) {
    if (!ALLOWED_PATH_PATTERNS.some((pattern) => pattern.test(path))) {
      errors.push(`unexpected file in tarball: ${path}`);
    }
  }

  for (const required of REQUIRED_PATHS) {
    if (!paths.includes(required)) {
      errors.push(`required file missing from tarball: ${required}`);
    }
  }

  if (unpackedSize > MAX_UNPACKED_BYTES) {
    errors.push(`unpacked size ${unpackedSize} bytes exceeds limit of ${MAX_UNPACKED_BYTES} bytes`);
  }

  return { errors, unpackedSize };
}

async function main() {
  const raw = await readStdin();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse pnpm pack output as JSON.');
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const pack = parsed;
  if (!pack || !Array.isArray(pack.files)) {
    console.error('Unexpected pnpm pack output.');
    process.exitCode = 1;
    return;
  }

  const { errors, unpackedSize } = collectErrors(pack);

  if (errors.length > 0) {
    console.error('tarball assertion failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `tarball assertion passed: ${pack.files.length} files, ${unpackedSize} bytes unpacked`,
  );
}

await main();
