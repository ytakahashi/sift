import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from '../create-app';
import {
  readRepositoryConfig,
  type RepositoryConfigReadResult,
} from '../repositories/repository-config-reader';
import {
  getErrorMessage,
  resolveScopedRepository,
  ScopedRepositoryResolutionError,
} from '../repositories/scoped-resolution';
import type { RepoWatchManager } from '../watch/repo-watch-manager';
import type { WatchHub } from '../watch/watch-hub';

export interface CreateWatchRoutesOptions {
  defaultWatchHub: WatchHub;
  readConfig?: () => Promise<RepositoryConfigReadResult>;
  repoWatchManager?: RepoWatchManager;
}

export function createWatchRoutes(options: CreateWatchRoutesOptions): Hono<Env> {
  const watchRoutes = new Hono<Env>();
  const readConfig = options.readConfig ?? readRepositoryConfig;

  watchRoutes.get('/watch', (c) => {
    return streamSSE(c, async (stream) => {
      options.defaultWatchHub.subscribe(stream);
      await new Promise<void>((resolve) => {
        stream.onAbort(resolve);
      });
    });
  });

  if (options.repoWatchManager) {
    watchRoutes.get('/repositories/:repoId/watch', async (c) => {
      try {
        const configResult = await readConfig();
        const repository = resolveScopedRepository(configResult, c.req.param('repoId'));
        const repoWatchManager = options.repoWatchManager;

        return streamSSE(c, async (stream) => {
          await repoWatchManager.subscribe(repository, stream);
          await new Promise<void>((resolve) => {
            stream.onAbort(resolve);
          });
        });
      } catch (error: unknown) {
        if (error instanceof ScopedRepositoryResolutionError) {
          return c.json({ error: error.message }, 400);
        }

        return c.json({ error: getErrorMessage(error) }, 500);
      }
    });
  }

  return watchRoutes;
}
