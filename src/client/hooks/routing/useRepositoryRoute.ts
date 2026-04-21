import { useCallback, useEffect, useState } from 'react';
import type { RepositoryId } from '../../../domain/repository/repository';
import {
  type AppRoute,
  buildRepositoryPath,
  parseAppRoute,
} from '../../presentation/routing/repository-route';

export interface UseRepositoryRouteResult {
  navigate: (repoId: RepositoryId) => void;
  route: AppRoute;
}

function getCurrentPathname(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return window.location.pathname;
}

function normalizePathname(pathname: string): string {
  return parseAppRoute(pathname) ? pathname : '/';
}

export function useRepositoryRoute(): UseRepositoryRouteResult {
  const [pathname, setPathname] = useState(() => normalizePathname(getCurrentPathname()));
  const route = parseAppRoute(pathname) ?? { type: 'selection' };

  const navigate = useCallback((repoId: RepositoryId): void => {
    const nextPathname = buildRepositoryPath(repoId);
    // Repository selection uses programmatic navigation rather than a browser
    // back/forward action. `history.pushState` intentionally does not emit a
    // `popstate` event, so update React state here as well; otherwise selecting
    // a repository would change the URL without re-scoping diff/action/watch
    // data loading to the selected repoId.
    window.history.pushState(null, '', nextPathname);
    setPathname(nextPathname);
  }, []);

  useEffect(() => {
    const normalizedPathname = normalizePathname(window.location.pathname);
    if (normalizedPathname !== window.location.pathname) {
      window.history.replaceState(null, '', normalizedPathname);
    }

    const handlePopState = (): void => {
      const nextPathname = normalizePathname(window.location.pathname);
      if (nextPathname !== window.location.pathname) {
        window.history.replaceState(null, '', nextPathname);
      }

      setPathname(nextPathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return {
    navigate,
    route,
  };
}
