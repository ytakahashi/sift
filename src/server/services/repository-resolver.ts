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

export interface RepositoryResolver {
  /** Resolves a repoId to a RepositoryDescriptor. Throws RepositoryResolutionError if not found. */
  resolve(repoId: string | undefined): Promise<RepositoryDescriptor>;

  /** Resolves a repoId to a RepositoryListItem (includes validation). Throws RepositoryResolutionError if not found. */
  resolveItem(repoId: string | undefined): Promise<RepositoryListItem>;

  /** Returns the full repository list with validation status. */
  list(): Promise<RepositoryList>;
}
