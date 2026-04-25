import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from '../create-app';
import { RepositoryResolver, RepositoryResolutionError } from '../services/repository-resolver';
import { getErrorMessage } from '../error/error-utils';
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
      const repository = await resolver.resolve(c.req.param('repoId') as string);

      return streamSSE(c, async (stream) => {
        await options.repoWatchManager.subscribe(repository, stream);
        await new Promise<void>((resolve) => {
          stream.onAbort(resolve);
        });
      });
    } catch (error: unknown) {
      if (error instanceof RepositoryResolutionError) {
        return c.json({ error: error.message }, 400);
      }

      return c.json({ error: getErrorMessage(error) }, 500);
    }
  });

  return watchRoutes;
}
