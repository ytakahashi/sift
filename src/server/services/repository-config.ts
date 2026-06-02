import type { ResolvedRepository, RepositoryId } from '../../domain/repository/repository';

export class RepositoryConfigUpdateError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = 'RepositoryConfigUpdateError';
  }
}

export interface RepositoryConfigUpdater {
  addRepository(repositoryPath: string): Promise<ResolvedRepository>;
  removeRepository(repoId: RepositoryId): Promise<void>;
  reorderRepositories(orderedIds: RepositoryId[]): Promise<void>;
}

export interface RegisteredRepositoryLister {
  findRegisteredRepositoryByPath(repositoryPath: string): Promise<ResolvedRepository | null>;
  listRegisteredRepositories(): Promise<ResolvedRepository[]>;
}
