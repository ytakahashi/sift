import { useCallback, useEffect } from 'react';
import type { RepositoryId } from '../../domain/repository/repository';
import { resolveCloseTabNavigation } from '../presentation/repository-tabs/close-tab-navigation';
import type { RepositoryTab } from '../presentation/repository-tabs/repository-tab';
import type { AppRoute } from '../presentation/routing/repository-route';
import { useAppRoute } from './routing/useAppRoute';
import { useRepositoryTabs } from './tabs/useRepositoryTabs';

export interface UseRepositoryTabNavigationResult {
  route: AppRoute;
  tabs: RepositoryTab[];
  navigateToSelection: () => void;
  selectTab: (repoId: RepositoryId) => void;
  closeTab: (repoId: RepositoryId) => void;
  setTabName: (repoId: RepositoryId, name: string) => void;
}

/**
 * Composes `useAppRoute` and `useRepositoryTabs` so that tab selection and
 * tab close map to the right route transition. This keeps `App.tsx` free of
 * navigation decision logic (see `resolveCloseTabNavigation`).
 */
export function useRepositoryTabNavigation(): UseRepositoryTabNavigationResult {
  const { navigate, navigateToSelection, route } = useAppRoute();
  const { tabs, openTab, setTabName, closeTab } = useRepositoryTabs();

  const activeRepoId: RepositoryId | null = route.type === 'repository' ? route.repoId : null;

  // Ensure the current route always has a corresponding tab. Covers direct-URL
  // entry (`/repos/:id`) and browser back/forward that bypass `selectTab`.
  useEffect(() => {
    if (activeRepoId !== null) {
      openTab(activeRepoId);
    }
  }, [activeRepoId, openTab]);

  const selectTab = useCallback(
    (repoId: RepositoryId): void => {
      // Re-clicking the currently active tab must not call navigate; useAppRoute
      // always pushes a new history entry, which would otherwise stack duplicate
      // URLs and make Back step through the same view repeatedly.
      if (repoId === activeRepoId) {
        return;
      }
      openTab(repoId);
      navigate(repoId);
    },
    [activeRepoId, navigate, openTab],
  );

  useEffect(() => {
    window.siftDesktop?.notifyReady();
  }, []);

  useEffect(() => {
    return window.siftDesktop?.onOpenRepository((repoId) => {
      selectTab(repoId);
    });
  }, [selectTab]);

  const handleCloseTab = useCallback(
    (repoId: RepositoryId): void => {
      const nextNeighborId = closeTab(repoId);
      const intent = resolveCloseTabNavigation(repoId, activeRepoId, nextNeighborId);
      if (intent.type === 'selection') {
        navigateToSelection();
        return;
      }
      if (intent.type === 'repository') {
        navigate(intent.repoId);
      }
    },
    [activeRepoId, closeTab, navigate, navigateToSelection],
  );

  return {
    route,
    tabs,
    navigateToSelection,
    selectTab,
    closeTab: handleCloseTab,
    setTabName,
  };
}
