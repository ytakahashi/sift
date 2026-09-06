import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { APP_INFO } from './app-info';
import type { Env } from './routes/env';
import { createHealthRoutes } from './routes/health';
import { createDiffRoutes } from './routes/diff';
import { createActionRoutes } from './routes/actions';
import { createHostGuard } from './routes/host-guard';
import { createNotesRoutes } from './routes/notes';
import { createRepositoryRoutes } from './routes/repositories';
import { createWatchRoutes } from './routes/watch';
import { createFileContentRoutes } from './routes/file-content';
import { createBlobContentRoutes } from './routes/blob-content';
import type { NotesStore } from './services/notes-store';
import type { RepositoryConfigUpdater } from './services/repository-config';
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
import { RepositoryFileContentProvider } from './infrastructure/diff/repository-file-content-provider';
import { RepositoryBlobContentProvider } from './infrastructure/diff/repository-blob-content-provider';
import { RepositoryHeadRefProvider } from './infrastructure/git/repository-head-ref-provider';
import { GitRepositoryIndexProvider } from './infrastructure/git/repository-index-provider';
import { WorktreeFileGenerationProvider } from './infrastructure/git/worktree-file-generation-provider';
import { InMemoryNotesStore } from './infrastructure/notes/in-memory-notes-store';
import { WorkspaceActionServiceImpl } from './infrastructure/workspace-action-service-impl';
import { createRepositoryConfigUpdater } from './infrastructure/config/repository-config-updater-impl';

export interface CreateAppOptions {
  repoWatchManager: RepoWatchManager;
  readConfig?: () => Promise<RepositoryConfigReadResult>;
  repositoryConfigUpdater?: RepositoryConfigUpdater;
  validateRepository?: RepositoryValidator;
  /** Injectable for route tests; defaults to the in-memory store. */
  notesStore?: NotesStore;
}

export function createApp(options: CreateAppOptions): Hono<Env> {
  const app = new Hono<Env>();
  const readConfig = options.readConfig ?? readRepositoryConfig;
  const validateRepository = options.validateRepository ?? validateRepositoryPath;
  const resolver = createRepositoryResolver(readConfig, validateRepository);
  const repositoryConfigUpdater =
    options.repositoryConfigUpdater ?? createRepositoryConfigUpdater({ validateRepository });
  const notesStore = options.notesStore ?? new InMemoryNotesStore();

  app.use('*', logger());
  // DNS rebinding protection for every API and SSE route.
  app.use('*', createHostGuard());

  // Mount API routes
  app.route('/api/health', createHealthRoutes({ version: APP_INFO.version }));
  app.route(
    '/api/repositories',
    createRepositoryRoutes({
      repositoryConfigUpdater,
      repositoryResolver: resolver,
    }),
  );
  app.route(
    '/api',
    createDiffRoutes({
      repositoryResolver: resolver,
      createDiffProvider: (path) => new RepositoryDiffProvider(path),
      createHeadRefProvider: (path) => new RepositoryHeadRefProvider(path),
    }),
  );
  app.route(
    '/api',
    createFileContentRoutes({
      repositoryResolver: resolver,
      createFileContentProvider: (path) => new RepositoryFileContentProvider(path),
    }),
  );
  app.route(
    '/api',
    createBlobContentRoutes({
      repositoryResolver: resolver,
      createBlobContentProvider: (path) => new RepositoryBlobContentProvider(path),
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
  app.route(
    '/api',
    createNotesRoutes({
      repositoryResolver: resolver,
      notesStore,
      // A transient Git failure must abort reconciliation rather than make a
      // required diff anchor appear absent and therefore stale.
      createDiffProvider: (path) => new RepositoryDiffProvider(path, { errorMode: 'throw' }),
      createFileGenerationProvider: (path) => new WorktreeFileGenerationProvider(path),
      createRepositoryIndexProvider: (path) => new GitRepositoryIndexProvider(path),
      notifyNotesChanged: (repoId) => options.repoWatchManager.broadcastNotesChanged(repoId),
    }),
  );

  // In production, static files can be served here via hono static middleware.
  // Vite dev server intercepts requests before they hit this if the file exists.

  return app;
}
