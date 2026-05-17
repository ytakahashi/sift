import { useCallback, useState } from 'react';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { RepositoryTab } from '../../presentation/repository-tabs/repository-tab';

export interface UseRepositoryTabsResult {
  tabs: RepositoryTab[];
  openTab: (id: RepositoryId, name?: string) => void;
  setTabName: (id: RepositoryId, name: string) => void;
  /** Removes the tab and returns the next active id (left → right neighbor), or null if no tab remains. */
  closeTab: (id: RepositoryId) => RepositoryId | null;
}

export function useRepositoryTabs(): UseRepositoryTabsResult {
  const [tabs, setTabs] = useState<RepositoryTab[]>([]);

  const openTab = useCallback((id: RepositoryId, name?: string): void => {
    setTabs((prev) => {
      const existing = prev.find((tab) => tab.id === id);
      if (!existing) {
        return [...prev, { id, name: name ?? id }];
      }
      // Replace the placeholder name (initially set to `id` when the real name
      // was not yet known) once a real name becomes available. Once a name
      // differs from the id it is treated as resolved and is not overwritten.
      if (name !== undefined && existing.name === existing.id && existing.name !== name) {
        return prev.map((tab) => (tab.id === id ? { ...tab, name } : tab));
      }
      return prev;
    });
  }, []);

  const setTabName = useCallback((id: RepositoryId, name: string): void => {
    setTabs((prev) => {
      const existing = prev.find((tab) => tab.id === id);
      if (!existing || existing.name === name) {
        return prev;
      }
      return prev.map((tab) => (tab.id === id ? { ...tab, name } : tab));
    });
  }, []);

  const closeTab = useCallback(
    (id: RepositoryId): RepositoryId | null => {
      const index = tabs.findIndex((tab) => tab.id === id);
      if (index === -1) {
        return null;
      }
      const neighbor = tabs[index - 1] ?? tabs[index + 1] ?? null;
      setTabs((prev) => prev.filter((tab) => tab.id !== id));
      return neighbor?.id ?? null;
    },
    [tabs],
  );

  return {
    tabs,
    openTab,
    setTabName,
    closeTab,
  };
}
