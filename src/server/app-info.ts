import { createRequire } from 'node:module';
import type { AppInfo } from '../domain/app/app-info';

// Read app info from package.json at module load time.
//
// createRequire with import.meta.url resolves '../../package.json' to the
// project root in both dev (tsx, src/server/app-info.ts) and production
// (esbuild bundled output, dist/<layer>/index.js), because src/<layer>/file.ts
// and dist/<layer>/index.js sit at the same depth. If the bundle output
// directory ever changes depth, this relative path must be revisited.
const require = createRequire(import.meta.url);
const { name, version, description } = require('../../package.json') as {
  name: string;
  version: string;
  description: string;
};

export const APP_INFO: AppInfo = { name, version, description };
