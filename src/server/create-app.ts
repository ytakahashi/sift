import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { sessionRoutes } from './routes/session';
import { diffRoutes } from './routes/diff';
import { actionRoutes } from './routes/actions';
import { createWatchRoutes } from './routes/watch';
import type { WatchHub } from './watch/watch-hub';

// Define context variables accessible in routes
export type Env = {
  Variables: {
    repoRoot: string;
  };
};

export interface CreateAppOptions {
  watchHub?: WatchHub;
}

export function createApp(options: CreateAppOptions = {}): Hono<Env> {
  const app = new Hono<Env>();

  app.use('*', logger());

  // Mount API routes
  app.route('/api/session', sessionRoutes);
  app.route('/api/diff', diffRoutes);
  app.route('/api/actions', actionRoutes);
  if (options.watchHub) {
    app.route('/api/watch', createWatchRoutes(options.watchHub));
  }

  // In production, static files can be served here via hono static middleware.
  // Vite dev server intercepts requests before they hit this if the file exists.

  return app;
}
