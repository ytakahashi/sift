import { Hono } from 'hono';
import type { AddedRepositoryItem } from '../../domain/repository/repository';
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
    const list = await resolver.list();
    if (list.config.status === 'invalid') {
      return c.json(list, 400);
    }
    return c.json(list);
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

      const addedRepository = await updater.addRepository(repositoryPath);
      const addedItem = await resolver.resolveItem(addedRepository.id);
      const responseRepository: AddedRepositoryItem = {
        id: addedItem.id,
        name: addedItem.name,
        path: addedItem.path,
      };

      return c.json({ repository: responseRepository }, 201);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  repositoryRoutes.get('/:repoId', async (c) => {
    try {
      const listItem = await resolver.resolveItem(c.req.param('repoId') as string);
      return c.json(listItem);
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  return repositoryRoutes;
}
