import type { ResolvedRepository } from '../../domain/repository/repository';

export class RepositoryConfigUpdateError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 409,
  ) {
    super(message);
    this.name = 'RepositoryConfigUpdateError';
  }
}

export interface RepositoryConfigUpdater {
  addRepository(repositoryPath: string): Promise<ResolvedRepository>;
}
