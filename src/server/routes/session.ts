import { Hono } from 'hono';
import type { Env } from '../create-app.js';

export const sessionRoutes = new Hono<Env>();

sessionRoutes.get('/', (c) => {
  const repoRoot = c.get('repoRoot');

  return c.json({
    mode: 'repository',
    repoRoot,
    capabilities: {
      splitView: false, // Flag indicating if split view is currently supported
      stdinMode: false,
    },
    availableViewModes: ['unified'],
  });
});
