import { useCallback, useState } from 'react';
import type { RepositoryId, RepositoryList } from '../../../domain/repository/repository';
import type { RepositoryReader, RepositoryWriter } from '../../application/ports';
import { useRepositoryList } from './useRepositoryList';

export interface UseRepositoriesResult {
  addError: string | null;
  addRepository: (path: string) => Promise<boolean>;
  adding: boolean;
  configMissingError: string | null;
  deleteError: string | null;
  deleteRepository: (repoId: RepositoryId) => Promise<boolean>;
  deletingRepositoryId: RepositoryId | null;
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
  const [deletingRepositoryId, setDeletingRepositoryId] = useState<RepositoryId | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
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
  const deleteRepository = useCallback(
    async (repoId: RepositoryId): Promise<boolean> => {
      setDeletingRepositoryId(repoId);
      setDeleteError(null);

      try {
        await repositoryWriter.removeRepository(repoId);
        await refresh();
        return true;
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setDeletingRepositoryId(null);
      }
    },
    [refresh, repositoryWriter],
  );

  return {
    addError,
    addRepository,
    adding,
    configMissingError,
    deleteError,
    deleteRepository,
    deletingRepositoryId,
    error,
    loading,
    repositories,
    refresh,
  };
}
