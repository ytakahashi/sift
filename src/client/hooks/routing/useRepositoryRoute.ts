import { useCallback, useEffect, useState } from 'react';
import type { RepositoryId } from '../../../domain/repository/repository';
import {
  buildRepositoryPath,
  parseRepositoryRoute,
} from '../../presentation/routing/repository-route';

export interface UseRepositoryRouteResult {
  navigate: (repoId: RepositoryId) => void;
  repoId: RepositoryId;
}

function getCurrentPathname(): string {
  if (typeof window === 'undefined') {
    return '/';
  }

  return window.location.pathname;
}

function normalizeRepositoryPathname(pathname: string, defaultRepoId: RepositoryId): string {
  return parseRepositoryRoute(pathname) ? pathname : buildRepositoryPath(defaultRepoId);
}

export function useRepositoryRoute(defaultRepoId: RepositoryId): UseRepositoryRouteResult {
  const [pathname, setPathname] = useState(() =>
    normalizeRepositoryPathname(getCurrentPathname(), defaultRepoId),
  );
  const route = parseRepositoryRoute(pathname);

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
    const normalizedPathname = normalizeRepositoryPathname(window.location.pathname, defaultRepoId);
    if (normalizedPathname !== window.location.pathname) {
      window.history.replaceState(null, '', normalizedPathname);
    }

    const handlePopState = (): void => {
      const nextPathname = normalizeRepositoryPathname(window.location.pathname, defaultRepoId);
      if (nextPathname !== window.location.pathname) {
        window.history.replaceState(null, '', nextPathname);
      }

      setPathname(nextPathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [defaultRepoId]);

  return {
    navigate,
    repoId: route?.repoId ?? defaultRepoId,
  };
}
