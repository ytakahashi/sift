import { Hono } from 'hono';
import type { Env } from '../create-app';
import type { RepositoryResolver } from '../services/repository-resolver';
import { handleRouteError } from './route-error';

export interface CreateRepositoryRoutesOptions {
  repositoryResolver: RepositoryResolver;
}

export function createRepositoryRoutes(options: CreateRepositoryRoutesOptions): Hono<Env> {
  const repositoryRoutes = new Hono<Env>();
  const resolver = options.repositoryResolver;

  repositoryRoutes.get('/', async (c) => {
    const list = await resolver.list();
    if (list.config.status === 'invalid') {
      return c.json(list, 400);
    }
    return c.json(list);
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
