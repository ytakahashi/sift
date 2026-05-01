import path from 'node:path';
import type {
  InvalidRepository,
  RepositoryDescriptor,
  RepositoryList,
  ResolvedRepository,
} from '../../domain/repository/repository';
import type { RepositoryConfigReadResult } from './config/repository-config-reader';
import type { RepositoryValidator } from './repository-validator';
import {
  RepositoryConfigResolutionError,
  RepositoryNotFoundError,
  RepositoryResolver,
  RepositoryValidationError,
} from '../services/repository-resolver';

class RepositoryRegistryError extends Error {
  constructor(
    message: string,
    public readonly kind: 'duplicate' | 'not-found',
  ) {
    super(message);
    this.name = 'RepositoryRegistryError';
  }
}

function createRegistry(repositories: RepositoryDescriptor[]): {
  list: () => RepositoryDescriptor[];
  resolve: (repoId: string) => RepositoryDescriptor;
} {
  const repositoriesById = new Map<string, RepositoryDescriptor>();

  for (const repository of repositories) {
    if (repositoriesById.has(repository.id)) {
      throw new RepositoryRegistryError(
        `Repository id "${repository.id}" is duplicated.`,
        'duplicate',
      );
    }

    repositoriesById.set(repository.id, repository);
  }

  return {
    list: () => Array.from(repositoriesById.values()),
    resolve: (repoId: string): RepositoryDescriptor => {
      const repository = repositoriesById.get(repoId);
      if (!repository) {
        throw new RepositoryRegistryError(
          `Repository id "${repoId}" is not configured.`,
          'not-found',
        );
      }

      return repository;
    },
  };
}

function deriveRepositoryName(repositoryPath: string): string {
  return path.basename(repositoryPath) || repositoryPath;
}

function toResolvedRepository(repository: RepositoryDescriptor): ResolvedRepository {
  return {
    id: repository.id,
    name: deriveRepositoryName(repository.path),
    path: repository.path,
  };
}

async function validateResolvedRepository(
  repository: RepositoryDescriptor,
  validateRepository: RepositoryValidator,
): Promise<ResolvedRepository> {
  const validation = await validateRepository(repository);

  if (!validation.isValid) {
    throw new RepositoryValidationError(validation.error ?? 'Repository path is invalid.');
  }

  return toResolvedRepository(repository);
}

async function toRepositoryListEntry(
  repository: RepositoryDescriptor,
  validateRepository: RepositoryValidator,
): Promise<
  | {
      repository: InvalidRepository;
      status: 'invalid';
    }
  | {
      repository: ResolvedRepository;
      status: 'valid';
    }
> {
  const validation = await validateRepository(repository);
  const baseRepository = toResolvedRepository(repository);

  if (validation.isValid) {
    return {
      repository: baseRepository,
      status: 'valid',
    };
  }

  return {
    repository: {
      ...baseRepository,
      reason: validation.error ?? 'Repository path is invalid.',
    },
    status: 'invalid',
  };
}

export function createRepositoryResolver(
  readConfig: () => Promise<RepositoryConfigReadResult>,
  validateRepository: RepositoryValidator,
): RepositoryResolver {
  return {
    resolveRepository: async (repoId: string): Promise<ResolvedRepository> => {
      if (!repoId) {
        throw new RepositoryNotFoundError('Repository id is required.');
      }

      const configResult = await readConfig();

      if (configResult.status === 'missing') {
        throw new RepositoryConfigResolutionError(
          `Repository config is missing: ${configResult.configPath}`,
          'missing',
        );
      }

      if (configResult.status === 'invalid') {
        throw new RepositoryConfigResolutionError(
          `Repository config is invalid: ${configResult.error}`,
          'invalid',
        );
      }

      try {
        const registry = createRegistry(configResult.config.repositories);
        return await validateResolvedRepository(registry.resolve(repoId), validateRepository);
      } catch (error: unknown) {
        if (error instanceof RepositoryRegistryError) {
          if (error.kind === 'not-found') {
            throw new RepositoryNotFoundError(error.message);
          }

          throw new RepositoryConfigResolutionError(error.message, 'invalid');
        }

        throw error;
      }
    },
    listRepositories: async (): Promise<RepositoryList> => {
      const configResult = await readConfig();

      if (configResult.status === 'missing') {
        throw new RepositoryConfigResolutionError(
          `Repository config is missing: ${configResult.configPath}`,
          'missing',
        );
      }

      if (configResult.status === 'invalid') {
        throw new RepositoryConfigResolutionError(configResult.error, 'invalid');
      }

      try {
        const registry = createRegistry(configResult.config.repositories);
        const entries = await Promise.all(
          registry
            .list()
            .map((repository) => toRepositoryListEntry(repository, validateRepository)),
        );

        return {
          invalidRepositories: entries
            .filter((entry) => entry.status === 'invalid')
            .map((entry) => entry.repository),
          repositories: entries
            .filter((entry) => entry.status === 'valid')
            .map((entry) => entry.repository),
        };
      } catch (error: unknown) {
        if (error instanceof RepositoryRegistryError) {
          throw new RepositoryConfigResolutionError(error.message, 'invalid');
        }
        throw error;
      }
    },
  };
}
