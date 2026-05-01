import type { RepositoryList, ResolvedRepository } from '../../domain/repository/repository';

export class RepositoryConfigResolutionError extends Error {
  constructor(
    message: string,
    public readonly kind: 'invalid' | 'missing',
  ) {
    super(message);
    this.name = 'RepositoryConfigResolutionError';
  }
}

export class RepositoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryNotFoundError';
  }
}

export class RepositoryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryValidationError';
  }
}

export interface RepositoryResolver {
  /** Resolves and validates a repoId for display. Throws typed repository errors when unavailable. */
  resolveRepository(repoId: string): Promise<ResolvedRepository>;

  /** Returns the full repository list with validation status. */
  list(): Promise<RepositoryList>;
}
