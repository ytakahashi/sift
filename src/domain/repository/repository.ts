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

/**
 * A runtime-derived pair of repository ID and path.
 *
 * The ID is derived deterministically from the normalized path at runtime
 * (see `deriveRepositoryId` in `repository-identity.ts`). It is not stored
 * in the configuration file. The config file stores only the repository path;
 * the descriptor is constructed by the server infrastructure layer when
 * reading the configuration.
 */
export interface RepositoryDescriptor {
  id: RepositoryId;
  path: string;
}
