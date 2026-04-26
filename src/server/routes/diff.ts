import { Hono } from 'hono';
import type { DiffProvider } from '../../domain/diff/diff-provider';
import type { DiffFile } from '../../domain/diff/types';
import type { Env } from '../create-app.js';
import type { RepositoryResolver } from '../services/repository-resolver';
import { handleRouteError } from './route-error';

export interface CreateDiffRoutesOptions {
  repositoryResolver: RepositoryResolver;
  createDiffProvider: (repositoryPath: string) => DiffProvider;
}

interface DiffResponse {
  metadata: {
    repoRoot: string;
    revision: 'HEAD';
  };
  stagedFiles: DiffFile[];
  workingFiles: DiffFile[];
}

async function buildDiffResponse(
  repositoryPath: string,
  createDiffProvider: (path: string) => DiffProvider,
): Promise<DiffResponse> {
  const provider = createDiffProvider(repositoryPath);
  const [workingFiles, stagedFiles] = await Promise.all([
    provider.getFiles('working'),
    provider.getFiles('staged'),
  ]);

  return {
    workingFiles,
    stagedFiles,
    metadata: {
      repoRoot: repositoryPath,
      revision: 'HEAD',
    },
  };
}

export function createDiffRoutes(options: CreateDiffRoutesOptions): Hono<Env> {
  const diffRoutes = new Hono<Env>();
  const resolver = options.repositoryResolver;
  const { createDiffProvider } = options;

  diffRoutes.get('/repositories/:repoId/diff', async (c) => {
    try {
      const repository = await resolver.resolve(c.req.param('repoId') as string);
      return c.json(await buildDiffResponse(repository.path, createDiffProvider));
    } catch (error: unknown) {
      return handleRouteError(c, error);
    }
  });

  return diffRoutes;
}
