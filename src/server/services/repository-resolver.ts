import type {
  RepositoryDescriptor,
  RepositoryList,
  RepositoryListItem,
} from '../../domain/repository/repository';

export class RepositoryResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RepositoryResolutionError';
  }
}

export class RepositoryConfigResolutionError extends Error {
  constructor(
    message: string,
    public readonly kind: 'invalid' | 'missing',
  ) {
    super(message);
    this.name = 'RepositoryConfigResolutionError';
  }
}

export interface RepositoryResolver {
  /** Resolves a repoId to a RepositoryDescriptor. Throws RepositoryResolutionError if not found. */
  resolve(repoId: string): Promise<RepositoryDescriptor>;

  /** Resolves a repoId to a RepositoryListItem (includes validation). Throws RepositoryResolutionError if not found. */
  resolveItem(repoId: string): Promise<RepositoryListItem>;

  /** Returns the full repository list with validation status. */
  list(): Promise<RepositoryList>;
}
