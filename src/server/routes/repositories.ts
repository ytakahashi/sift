import { Hono } from 'hono';
import type { Env } from '../create-app';
import type { RepositoryConfigUpdater } from '../services/repository-config';
import type { RepositoryResolver } from '../services/repository-resolver';
import { handleRouteError } from './route-error';

export interface CreateRepositoryRoutesOptions {
  repositoryConfigUpdater: RepositoryConfigUpdater;
  repositoryResolver: RepositoryResolver;
}

export function createRepositoryRoutes(options: CreateRepositoryRoutesOptions): Hono<Env> {
  const repositoryRoutes = new Hono<Env>();
  const resolver = options.repositoryResolver;
  const updater = options.repositoryConfigUpdater;

  repositoryRoutes.get('/', async (c) => {
    try {
      return c.json(await resolver.listRepositories());
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  repositoryRoutes.post('/', async (c) => {
    try {
      let body: unknown;
      try {
        body = (await c.req.json()) as unknown;
      } catch (_error: unknown) {
        return c.json({ error: 'Repository request body must be valid JSON.' }, 400);
      }

      if (typeof body !== 'object' || body === null || !('path' in body)) {
        return c.json({ error: 'Repository path is required.' }, 400);
      }

      const repositoryPath = body.path;
      if (typeof repositoryPath !== 'string') {
        return c.json({ error: 'Repository path must be a string.' }, 400);
      }

      return c.json(await updater.addRepository(repositoryPath), 201);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  repositoryRoutes.put('/order', async (c) => {
    try {
      let body: unknown;
      try {
        body = (await c.req.json()) as unknown;
      } catch (_error: unknown) {
        return c.json({ error: 'Reorder request body must be valid JSON.' }, 400);
      }

      if (typeof body !== 'object' || body === null || !('ids' in body)) {
        return c.json({ error: 'Repository IDs are required.' }, 400);
      }

      const repositoryIds = body.ids;
      if (!Array.isArray(repositoryIds)) {
        return c.json({ error: 'Repository IDs must be an array.' }, 400);
      }

      if (repositoryIds.some((id) => typeof id !== 'string')) {
        return c.json({ error: 'Repository IDs must be strings.' }, 400);
      }

      await updater.reorderRepositories(repositoryIds);
      return c.body(null, 204);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  repositoryRoutes.get('/:repoId', async (c) => {
    try {
      const repository = await resolver.resolveRepository(c.req.param('repoId') as string);
      return c.json(repository);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  repositoryRoutes.delete('/:repoId', async (c) => {
    try {
      await updater.removeRepository(c.req.param('repoId'));
      return c.body(null, 204);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  return repositoryRoutes;
}
