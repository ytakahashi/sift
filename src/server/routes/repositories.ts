import { Hono } from 'hono';
import path from 'node:path';
import type {
  RepositoryListItem,
  RepositoryList as RepositoryListResponse,
} from '../../domain/repository/repository';
import type { Env } from '../create-app';
import {
  readRepositoryConfig,
  type RepositoryConfigReadResult,
} from '../infrastructure/config/repository-config-reader';
import { createRepositoryRegistry } from '../repositories/repository-registry';
import type { RepositoryDescriptor } from '../../domain/repository/repository';
import {
  resolveScopedRepository,
  ScopedRepositoryResolutionError,
} from '../services/scoped-resolution';
import { getErrorMessage } from '../error/error-utils';
import {
  validateRepositoryPath,
  type RepositoryValidator,
} from '../infrastructure/repository-validator';

export interface CreateRepositoryRoutesOptions {
  readConfig?: () => Promise<RepositoryConfigReadResult>;
  validateRepository?: RepositoryValidator;
}

function deriveRepositoryName(repositoryPath: string): string {
  return path.basename(repositoryPath) || repositoryPath;
}

async function toRepositoryListItem(
  repository: RepositoryDescriptor,
  validateRepository: RepositoryValidator,
): Promise<RepositoryListItem> {
  const validation = await validateRepository(repository);
  return {
    error: validation.error,
    id: repository.id,
    isValid: validation.isValid,
    name: deriveRepositoryName(repository.path),
    path: repository.path,
  };
}

export function createRepositoryRoutes(options: CreateRepositoryRoutesOptions = {}): Hono<Env> {
  const repositoryRoutes = new Hono<Env>();
  const readConfig = options.readConfig ?? readRepositoryConfig;
  const validateRepository = options.validateRepository ?? validateRepositoryPath;

  repositoryRoutes.get('/', async (c) => {
    const configResult = await readConfig();

    if (configResult.status === 'missing') {
      const response: RepositoryListResponse = {
        config: {
          path: configResult.configPath,
          status: 'missing',
        },
        repositories: [],
      };

      return c.json(response);
    }

    if (configResult.status === 'invalid') {
      const response: RepositoryListResponse = {
        config: {
          error: configResult.error,
          status: 'invalid',
        },
        repositories: [],
      };

      return c.json(response, 400);
    }

    try {
      const registry = createRepositoryRegistry(configResult.config.repositories);
      const response: RepositoryListResponse = {
        config: {
          status: 'found',
        },
        repositories: await Promise.all(
          registry.list().map((repository) => toRepositoryListItem(repository, validateRepository)),
        ),
      };

      return c.json(response);
    } catch (error: unknown) {
      const response: RepositoryListResponse = {
        config: {
          error: getErrorMessage(error),
          status: 'invalid',
        },
        repositories: [],
      };

      return c.json(response, 400);
    }
  });

  repositoryRoutes.get('/:repoId', async (c) => {
    try {
      const configResult = await readConfig();
      const repository = resolveScopedRepository(configResult, c.req.param('repoId'));

      return c.json(await toRepositoryListItem(repository, validateRepository));
    } catch (error: unknown) {
      if (error instanceof ScopedRepositoryResolutionError) {
        return c.json({ error: error.message }, 400);
      }

      return c.json({ error: getErrorMessage(error) }, 500);
    }
  });

  return repositoryRoutes;
}
