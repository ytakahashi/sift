import { Hono } from 'hono';
import type { DiffProvider } from '../../domain/diff/diff-provider';
import type { RepositoryDiff } from '../../domain/diff/types';
import type { Env } from '../create-app';
import type { HeadRefProvider } from '../services/head-ref-provider';
import type { RepositoryResolver } from '../services/repository-resolver';
import { handleRouteError } from './route-error';

export interface CreateDiffRoutesOptions {
  repositoryResolver: RepositoryResolver;
  createDiffProvider: (repositoryPath: string) => DiffProvider;
  createHeadRefProvider: (repositoryPath: string) => HeadRefProvider;
}

async function buildDiffResponse(
  repositoryPath: string,
  createDiffProvider: (path: string) => DiffProvider,
  createHeadRefProvider: (path: string) => HeadRefProvider,
): Promise<RepositoryDiff> {
  const provider = createDiffProvider(repositoryPath);
  const [workingFiles, stagedFiles, head] = await Promise.all([
    provider.getFiles('working'),
    provider.getFiles('staged'),
    createHeadRefProvider(repositoryPath).getHeadRef(),
  ]);

  return {
    workingFiles,
    stagedFiles,
    metadata: {
      repoRoot: repositoryPath,
      revision: 'HEAD',
      head,
    },
  };
}

export function createDiffRoutes(options: CreateDiffRoutesOptions): Hono<Env> {
  const diffRoutes = new Hono<Env>();
  const resolver = options.repositoryResolver;
  const { createDiffProvider, createHeadRefProvider } = options;

  diffRoutes.get('/repositories/:repoId/diff', async (c) => {
    try {
      const repository = await resolver.resolveRepository(c.req.param('repoId') as string);
      return c.json(
        await buildDiffResponse(repository.path, createDiffProvider, createHeadRefProvider),
      );
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  return diffRoutes;
}
