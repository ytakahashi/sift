import { Hono } from 'hono';
import path from 'node:path';
import type { SessionInfo } from '../../domain/session/types';
import type { Env } from '../create-app.js';

export const sessionRoutes = new Hono<Env>();

sessionRoutes.get('/', (c) => {
  const repoRoot = c.get('repoRoot');
  const repositoryName = path.basename(repoRoot) || repoRoot;

  const response: SessionInfo = {
    mode: 'repository',
    repository: {
      name: repositoryName,
      root: repoRoot,
    },
    capabilities: {
      splitView: false, // Flag indicating if split view is currently supported
      stdinMode: false,
    },
    availableViewModes: ['unified'],
  };

  return c.json(response);
});
