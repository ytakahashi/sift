import type { RepositoryDescriptor } from '../../domain/repository/repository';

export class RepositoryRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryRegistryError';
  }
}

export interface RepositoryRegistry {
  list: () => RepositoryDescriptor[];
  resolve: (repoId: string) => RepositoryDescriptor;
}

export function createRepositoryRegistry(repositories: RepositoryDescriptor[]): RepositoryRegistry {
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
