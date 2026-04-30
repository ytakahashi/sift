export type RepositoryId = string;

export const REPOSITORY_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface ResolvedRepository {
  id: RepositoryId;
  name: string;
  path: string;
}

export interface InvalidRepository {
  id: string;
  name: string;
  path: string;
  reason: string;
}

export interface RepositoryList {
  invalidRepositories: InvalidRepository[];
  repositories: ResolvedRepository[];
}

// Temporary legacy shape used by the single-repository endpoint until Step 2
// migrates it to ResolvedRepository plus HTTP error statuses.
export interface RepositoryListItem {
  error?: string;
  id: RepositoryId;
  isValid: boolean;
  name: string;
  path: string;
}

export interface RepositoryDescriptor {
  id: RepositoryId;
  path: string;
}

export interface AddedRepositoryItem {
  id: RepositoryId;
  name: string;
  path: string;
}
