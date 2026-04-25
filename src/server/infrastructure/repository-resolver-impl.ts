import path from 'node:path';
import type {
  RepositoryDescriptor,
  RepositoryList,
  RepositoryListItem,
} from '../../domain/repository/repository';
import type { RepositoryConfigReadResult } from './config/repository-config-reader';
import type { RepositoryValidator } from './repository-validator';
import { RepositoryResolver, RepositoryResolutionError } from '../services/repository-resolver';
import { getErrorMessage } from '../error/error-utils';

class RepositoryRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryRegistryError';
  }
}

function createRegistry(repositories: RepositoryDescriptor[]) {
  const repositoriesById = new Map<string, RepositoryDescriptor>();

  for (const repository of repositories) {
    if (repositoriesById.has(repository.id)) {
      throw new RepositoryRegistryError(`Repository id "${repository.id}" is duplicated.`);
    }

    repositoriesById.set(repository.id, repository);
  }

  return {
    list: () => Array.from(repositoriesById.values()),
    resolve: (repoId: string): RepositoryDescriptor => {
      const repository = repositoriesById.get(repoId);
      if (!repository) {
        throw new RepositoryRegistryError(`Repository id "${repoId}" is not configured.`);
      }

      return repository;
    },
  };
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

export function createRepositoryResolver(
  readConfig: () => Promise<RepositoryConfigReadResult>,
  validateRepository: RepositoryValidator,
): RepositoryResolver {
  const resolve = async (repoId: string): Promise<RepositoryDescriptor> => {
    if (!repoId) {
      throw new RepositoryResolutionError('Repository id is required.');
    }

    const configResult = await readConfig();

    if (configResult.status === 'missing') {
      throw new RepositoryResolutionError(
        `Repository config is missing: ${configResult.configPath}`,
      );
    }

    if (configResult.status === 'invalid') {
      throw new RepositoryResolutionError(`Repository config is invalid: ${configResult.error}`);
    }

    try {
      const registry = createRegistry(configResult.config.repositories);
      return registry.resolve(repoId);
    } catch (error: unknown) {
      if (error instanceof RepositoryRegistryError) {
        throw new RepositoryResolutionError(error.message);
      }

      throw error;
    }
  };

  return {
    resolve,
    resolveItem: async (repoId: string): Promise<RepositoryListItem> => {
      const repository = await resolve(repoId);
      return toRepositoryListItem(repository, validateRepository);
    },
    list: async (): Promise<RepositoryList> => {
      const configResult = await readConfig();

      if (configResult.status === 'missing') {
        return {
          config: {
            path: configResult.configPath,
            status: 'missing',
          },
          repositories: [],
        };
      }

      if (configResult.status === 'invalid') {
        return {
          config: {
            error: configResult.error,
            status: 'invalid',
          },
          repositories: [],
        };
      }

      try {
        const registry = createRegistry(configResult.config.repositories);
        const repositories = await Promise.all(
          registry.list().map((repository) => toRepositoryListItem(repository, validateRepository)),
        );

        return {
          config: {
            status: 'found',
          },
          repositories,
        };
      } catch (error: unknown) {
        return {
          config: {
            error: getErrorMessage(error),
            status: 'invalid',
          },
          repositories: [],
        };
      }
    },
  };
}
