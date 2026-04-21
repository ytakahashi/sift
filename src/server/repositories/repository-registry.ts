import path from 'node:path';
import type { ServerRepository } from './server-repository';

export class RepositoryRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryRegistryError';
  }
}

export interface RepositoryRegistry {
  list: () => ServerRepository[];
  resolve: (repoId: string) => ServerRepository;
}

const REPOSITORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function validateRepository(repository: ServerRepository): void {
  if (!REPOSITORY_ID_PATTERN.test(repository.id)) {
    throw new RepositoryRegistryError(
      `Repository id "${repository.id}" must use lowercase letters, numbers, and hyphens.`,
    );
  }

  if (!path.isAbsolute(repository.path)) {
    throw new RepositoryRegistryError(`Repository path for "${repository.id}" must be absolute.`);
  }
}

export function createRepositoryRegistry(repositories: ServerRepository[]): RepositoryRegistry {
  const repositoriesById = new Map<string, ServerRepository>();

  for (const repository of repositories) {
    if (repositoriesById.has(repository.id)) {
      throw new RepositoryRegistryError(`Repository id "${repository.id}" is duplicated.`);
    }

    validateRepository(repository);

    repositoriesById.set(repository.id, repository);
  }

  return {
    list: () => Array.from(repositoriesById.values()),
    resolve: (repoId: string): ServerRepository => {
      const repository = repositoriesById.get(repoId);
      if (!repository) {
        throw new RepositoryRegistryError(`Repository id "${repoId}" is not configured.`);
      }

      return repository;
    },
  };
}
