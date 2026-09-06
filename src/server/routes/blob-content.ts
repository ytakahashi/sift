import { Hono } from 'hono';
import type { BlobContentProvider } from '../services/blob-content-provider';
import type { RepositoryResolver } from '../services/repository-resolver';
import type { Env } from './env';
import { handleRouteError } from './route-error';

export interface CreateBlobContentRoutesOptions {
  repositoryResolver: RepositoryResolver;
  createBlobContentProvider: (repositoryPath: string) => BlobContentProvider;
}

export function createBlobContentRoutes(options: CreateBlobContentRoutesOptions): Hono<Env> {
  const routes = new Hono<Env>();

  routes.get('/repositories/:repoId/blob-content', async (c) => {
    const blobId = c.req.query('blobId');
    if (blobId === undefined || !/^[0-9a-f]+$/i.test(blobId)) {
      return c.json({ error: 'A valid blob ID is required.' }, 400);
    }

    try {
      const repository = await options.repositoryResolver.resolveRepository(
        c.req.param('repoId') as string,
      );
      const provider = options.createBlobContentProvider(repository.path);
      const result = await provider.getContent(blobId);

      switch (result.kind) {
        case 'file':
          return c.json({ lines: result.lines });
        case 'not-found':
          return c.json({ error: 'Blob was not found.' }, 404);
        case 'too-large':
          return c.json({ error: 'Blob is too large to display.' }, 413);
        case 'unsupported':
          return c.json({ error: 'Blob content is not supported.' }, 415);
        default: {
          const unhandledResult: never = result;
          throw new Error(`Unhandled blob content result: ${String(unhandledResult)}`);
        }
      }
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  return routes;
}
