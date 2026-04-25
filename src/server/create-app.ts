import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { healthRoutes } from './routes/health';
import { createDiffRoutes } from './routes/diff';
import { createActionRoutes } from './routes/actions';
import { createRepositoryRoutes } from './routes/repositories';
import { createWatchRoutes } from './routes/watch';
import type { RepoWatchManager } from './watch/repo-watch-manager';
import {
  readRepositoryConfig,
  type RepositoryConfigReadResult,
} from './infrastructure/config/repository-config-reader';
import { createRepositoryResolver } from './infrastructure/repository-resolver-impl';
import {
  validateRepositoryPath,
  type RepositoryValidator,
} from './infrastructure/repository-validator';
import { RepositoryDiffProvider } from './infrastructure/diff/repository-diff-provider';
import { WorkspaceActionServiceImpl } from './infrastructure/workspace-action-service-impl';

export type Env = Record<string, never>;

export interface CreateAppOptions {
  repoWatchManager: RepoWatchManager;
  readConfig?: () => Promise<RepositoryConfigReadResult>;
  validateRepository?: RepositoryValidator;
}

export function createApp(options: CreateAppOptions): Hono<Env> {
  const app = new Hono<Env>();
  const readConfig = options.readConfig ?? readRepositoryConfig;
  const validateRepository = options.validateRepository ?? validateRepositoryPath;
  const resolver = createRepositoryResolver(readConfig, validateRepository);

  app.use('*', logger());

  // Mount API routes
  app.route('/api/health', healthRoutes);
  app.route('/api/repositories', createRepositoryRoutes({ repositoryResolver: resolver }));
  app.route(
    '/api',
    createDiffRoutes({
      repositoryResolver: resolver,
      createDiffProvider: (path) => new RepositoryDiffProvider(path),
    }),
  );
  app.route(
    '/api',
    createActionRoutes({
      repositoryResolver: resolver,
      createWorkspaceActionService: (path) => new WorkspaceActionServiceImpl(path),
    }),
  );
  app.route(
    '/api',
    createWatchRoutes({
      repoWatchManager: options.repoWatchManager,
      repositoryResolver: resolver,
    }),
  );

  // In production, static files can be served here via hono static middleware.
  // Vite dev server intercepts requests before they hit this if the file exists.

  return app;
}
