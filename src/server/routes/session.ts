import { Hono } from 'hono';
import path from 'node:path';
import type { SessionInfo } from '../../domain/session/types';
import type { Env } from '../create-app.js';

export const sessionRoutes = new Hono<Env>();

sessionRoutes.get('/', (c) => {
  const repository = c.get('repository');
  const repositoryPath = repository.path;
  // basename("/") returns an empty string, so keep repositoryPath itself as a safe fallback.
  const repositoryName = path.basename(repositoryPath) || repositoryPath;

  const response: SessionInfo = {
    mode: 'repository',
    repository: {
      name: repositoryName,
      root: repositoryPath,
    },
    capabilities: {
      splitView: false, // Flag indicating if split view is currently supported
      stdinMode: false,
    },
  };

  return c.json(response);
});
