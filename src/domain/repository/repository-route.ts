import type { RepositoryId } from './repository';

export function buildRepositoryPath(repoId: RepositoryId): string {
  return `/repos/${encodeURIComponent(repoId)}`;
}
