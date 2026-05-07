import { useCallback, useState } from 'react';
import type { RepositoryList } from '../../../domain/repository/repository';
import type { RepositoryReader, RepositoryWriter } from '../../application/ports';
import { useRepositoryList } from './useRepositoryList';

export interface UseRepositoriesResult {
  addError: string | null;
  addRepository: (path: string) => Promise<boolean>;
  adding: boolean;
  configMissingError: string | null;
  error: string | null;
  loading: boolean;
  repositories: RepositoryList | null;
  refresh: () => Promise<void>;
}

export function useRepositories(
  repositoryReader: RepositoryReader,
  repositoryWriter: RepositoryWriter,
): UseRepositoriesResult {
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  // Selection page always needs the list on mount, so `enabled` stays the
  // default `true`. The Sidebar caller in RepositoryViewerPage opts out by
  // passing `enabled: false` until the user opens it.
  const { configMissingError, error, loading, repositories, refresh } =
    useRepositoryList(repositoryReader);

  const addRepository = useCallback(
    async (path: string): Promise<boolean> => {
      setAdding(true);
      setAddError(null);

      try {
        await repositoryWriter.addRepository(path);
        await refresh();
        return true;
      } catch (err: unknown) {
        setAddError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setAdding(false);
      }
    },
    [refresh, repositoryWriter],
  );
  return {
    addError,
    addRepository,
    adding,
    configMissingError,
    error,
    loading,
    repositories,
    refresh,
  };
}
