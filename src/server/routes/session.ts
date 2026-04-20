import { Hono } from 'hono';
import path from 'node:path';
import type { SessionInfo } from '../../domain/session/types';
import type { Env } from '../create-app.js';

export const sessionRoutes = new Hono<Env>();

sessionRoutes.get('/', (c) => {
  const repository = c.get('repository');
  const repoRoot = repository.path;
  // basename("/") returns an empty string, so keep repoRoot itself as a safe fallback.
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
  };

  return c.json(response);
});
