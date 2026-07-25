#!/usr/bin/env node
// Validates the npm publish tarball against an explicit allowlist and size ceiling.
// Reads `npm pack --dry-run --json --ignore-scripts` output from stdin (see
// `package:check`). This is independent of the `files` field in package.json,
// so it also catches `files` itself drifting (e.g. widened to `dist` and
// re-including the Electron build) rather than just trusting that config.

// Trip wires, not tight budgets: sized well above the current baseline
// (~145 KB tarball / ~465 KB unpacked) so routine client asset growth
// doesn't require bumping these, while still catching an accidental
// multi-hundred-MB Electron/node_modules inclusion.
const MAX_TARBALL_BYTES = 1_000_000;
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

function collectErrors(pack) {
  const errors = [];
  const paths = pack.files.map((file) => file.path);

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

  if (pack.size > MAX_TARBALL_BYTES) {
    errors.push(`tarball size ${pack.size} bytes exceeds limit of ${MAX_TARBALL_BYTES} bytes`);
  }

  if (pack.unpackedSize > MAX_UNPACKED_BYTES) {
    errors.push(
      `unpacked size ${pack.unpackedSize} bytes exceeds limit of ${MAX_UNPACKED_BYTES} bytes`,
    );
  }

  return errors;
}

async function main() {
  const raw = await readStdin();

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse npm pack output as JSON.');
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const pack = parsed[0];
  if (
    !pack ||
    !Array.isArray(pack.files) ||
    !Number.isFinite(pack.size) ||
    !Number.isFinite(pack.unpackedSize)
  ) {
    console.error('Unexpected npm pack output.');
    process.exitCode = 1;
    return;
  }

  const errors = collectErrors(pack);

  if (errors.length > 0) {
    console.error('tarball assertion failed:');
    for (const error of errors) {
      console.error(`  - ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(
    `tarball assertion passed: ${pack.files.length} files, ${pack.size} bytes packed, ${pack.unpackedSize} bytes unpacked`,
  );
}

await main();
