import type { RepositoryId } from '../../../domain/repository/repository';

export interface RepositoryRoute {
  repoId: RepositoryId;
  type: 'repository';
}

export interface RepositorySelectionRoute {
  type: 'selection';
}

export type AppRoute = RepositoryRoute | RepositorySelectionRoute;

const REPOSITORY_ROUTE_PATTERN = /^\/repos\/([^/]+)\/?$/;

export { buildRepositoryPath } from '../../../domain/repository/repository-route';

export function parseAppRoute(pathname: string): AppRoute | null {
  if (pathname === '/') {
    return {
      type: 'selection',
    };
  }

  const match = REPOSITORY_ROUTE_PATTERN.exec(pathname);
  if (!match) {
    return null;
  }

  try {
    return {
      repoId: decodeURIComponent(match[1]),
      type: 'repository',
    };
  } catch {
    return null;
  }
}

export function parseRepositoryRoute(pathname: string): RepositoryRoute | null {
  const route = parseAppRoute(pathname);
  return route?.type === 'repository' ? route : null;
}
