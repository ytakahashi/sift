import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { healthRoutes } from './routes/health';
import { createDiffRoutes } from './routes/diff';
import { createActionRoutes } from './routes/actions';
import { createRepositoryRoutes } from './routes/repositories';
import { createWatchRoutes } from './routes/watch';
import type { RepoWatchManager } from './watch/repo-watch-manager';
import type { RepositoryConfigReadResult } from './infrastructure/config/repository-config-reader';

export type Env = Record<string, never>;

export interface CreateAppOptions {
  repoWatchManager: RepoWatchManager;
  readConfig?: () => Promise<RepositoryConfigReadResult>;
}

export function createApp(options: CreateAppOptions): Hono<Env> {
  const app = new Hono<Env>();

  app.use('*', logger());

  // Mount API routes
  app.route('/api/health', healthRoutes);
  app.route('/api/repositories', createRepositoryRoutes({ readConfig: options.readConfig }));
  app.route('/api', createDiffRoutes({ readConfig: options.readConfig }));
  app.route('/api', createActionRoutes({ readConfig: options.readConfig }));
  app.route(
    '/api',
    createWatchRoutes({
      repoWatchManager: options.repoWatchManager,
      readConfig: options.readConfig,
    }),
  );

  // In production, static files can be served here via hono static middleware.
  // Vite dev server intercepts requests before they hit this if the file exists.

  return app;
}
