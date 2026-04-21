import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { sessionRoutes } from './routes/session';
import { diffRoutes } from './routes/diff';
import { actionRoutes } from './routes/actions';
import { createRepositoryRoutes } from './routes/repositories';
import { createWatchRoutes } from './routes/watch';
import type { RepoWatchManager } from './watch/repo-watch-manager';
import type { WatchHub } from './watch/watch-hub';
import type { ServerRepository } from './repositories/server-repository';

// Define context variables accessible in routes
export type Env = {
  Variables: {
    repository: ServerRepository;
  };
};

export interface CreateAppOptions {
  repoWatchManager?: RepoWatchManager;
  watchHub?: WatchHub;
}

export function createApp(options: CreateAppOptions = {}): Hono<Env> {
  const app = new Hono<Env>();

  app.use('*', logger());

  // Mount API routes
  app.route('/api/session', sessionRoutes);
  app.route('/api/repositories', createRepositoryRoutes());
  app.route('/api', diffRoutes);
  app.route('/api', actionRoutes);
  if (options.watchHub) {
    app.route(
      '/api',
      createWatchRoutes({
        defaultWatchHub: options.watchHub,
        repoWatchManager: options.repoWatchManager,
      }),
    );
  }

  // In production, static files can be served here via hono static middleware.
  // Vite dev server intercepts requests before they hit this if the file exists.

  return app;
}
