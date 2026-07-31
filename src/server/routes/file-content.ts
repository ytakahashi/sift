import { Hono } from 'hono';
import type { Env } from './env';
import type { FileContentProvider } from '../services/file-content-provider';
import type { RepositoryResolver } from '../services/repository-resolver';
import { handleRouteError } from './route-error';

export interface CreateFileContentRoutesOptions {
  repositoryResolver: RepositoryResolver;
  createFileContentProvider: (repositoryPath: string) => FileContentProvider;
}

export function createFileContentRoutes(options: CreateFileContentRoutesOptions): Hono<Env> {
  const routes = new Hono<Env>();

  routes.get('/repositories/:repoId/file-content', async (c) => {
    const path = c.req.query('path');
    if (path === undefined || path === '') {
      return c.json({ error: 'File path is required.' }, 400);
    }

    try {
      const repository = await options.repositoryResolver.resolveRepository(
        c.req.param('repoId') as string,
      );
      const provider = options.createFileContentProvider(repository.path);
      const result = await provider.getContent(path);

      switch (result.kind) {
        case 'file':
          return c.json({ blobId: result.blobId, lines: result.lines });
        case 'not-found':
          return c.json({ error: 'File is not present in the index.' }, 404);
        case 'too-large':
          return c.json({ error: 'File is too large to display in full.' }, 413);
        case 'unsupported':
          return c.json({ error: 'File content is not supported.' }, 415);
        default: {
          const unhandledResult: never = result;
          throw new Error(`Unhandled file content result: ${String(unhandledResult)}`);
        }
      }
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  return routes;
}
