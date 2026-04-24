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

export function createRepositoryRegistry(repositories: ServerRepository[]): RepositoryRegistry {
  const repositoriesById = new Map<string, ServerRepository>();

  for (const repository of repositories) {
    if (repositoriesById.has(repository.id)) {
      throw new RepositoryRegistryError(`Repository id "${repository.id}" is duplicated.`);
    }

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
