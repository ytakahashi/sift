import type { RepositoryId } from '../../../domain/repository/repository';

export interface RepositoryRoute {
  repoId: RepositoryId;
}

const REPOSITORY_ROUTE_PATTERN = /^\/repos\/([^/]+)\/?$/;

export function buildRepositoryPath(repoId: RepositoryId): string {
  return `/repos/${encodeURIComponent(repoId)}`;
}

export function parseRepositoryRoute(pathname: string): RepositoryRoute | null {
  const match = REPOSITORY_ROUTE_PATTERN.exec(pathname);
  if (!match) {
    return null;
  }

  try {
    return {
      repoId: decodeURIComponent(match[1]),
    };
  } catch {
    return null;
  }
}
