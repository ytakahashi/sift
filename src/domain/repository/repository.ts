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

export interface RepositoryDescriptor {
  id: RepositoryId;
  path: string;
}
