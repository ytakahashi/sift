import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from './env';
import type { RepositoryResolver } from '../services/repository-resolver';
import { handleRouteError } from './route-error';
import type { RepoWatchManager } from '../watch/repo-watch-manager';

export interface CreateWatchRoutesOptions {
  repoWatchManager: RepoWatchManager;
  repositoryResolver: RepositoryResolver;
}

export function createWatchRoutes(options: CreateWatchRoutesOptions): Hono<Env> {
  const watchRoutes = new Hono<Env>();
  const resolver = options.repositoryResolver;

  watchRoutes.get('/repositories/:repoId/watch', async (c) => {
    try {
      const repository = await resolver.resolveRepository(c.req.param('repoId') as string);

      return streamSSE(c, async (stream) => {
        await options.repoWatchManager.subscribe(repository, stream);
        await new Promise<void>((resolve) => {
          stream.onAbort(resolve);
        });
      });
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  return watchRoutes;
}
