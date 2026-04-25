import { Hono } from 'hono';
import type { Env } from '../create-app';
import { RepositoryResolver, RepositoryResolutionError } from '../services/repository-resolver';
import { getErrorMessage } from '../error/error-utils';

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
      if (error instanceof RepositoryResolutionError) {
        return c.json({ error: error.message }, 400);
      }

      return c.json({ error: getErrorMessage(error) }, 500);
    }
  });

  return repositoryRoutes;
}
