import { useCallback, useRef, useState } from 'react';
import type { RepositoryId, RepositoryList } from '../../../domain/repository/repository';
import type { RepositoryReader, RepositoryWriter } from '../../application/ports';
import { useRepositoryList } from './useRepositoryList';

export interface UseRepositoriesResult {
  addError: string | null;
  addRepository: (path: string) => Promise<boolean>;
  adding: boolean;
  configMissingError: string | null;
  deleteRepositories: (repoIds: RepositoryId[]) => Promise<boolean>;
  editError: string | null;
  error: string | null;
  loading: boolean;
  repositories: RepositoryList | null;
  refresh: () => Promise<void>;
  saving: boolean;
  clearEditError: () => void;
}

export function useRepositories(
  repositoryReader: RepositoryReader,
  repositoryWriter: RepositoryWriter,
): UseRepositoriesResult {
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  // Selection page always needs the list on mount, so `enabled` stays the
  // default `true`. The Sidebar caller in RepositoryViewerPage opts out by
  // passing `enabled: false` until the user opens it.
  const { configMissingError, error, loading, repositories, refresh } =
    useRepositoryList(repositoryReader);

  // User-initiated Refresh clears stale add/edit errors so the surfaced state
  // reflects the freshly fetched list. In-flight commit paths (addRepository /
  // deleteRepositories) call the underlying `refresh` directly instead so they
  // can preserve the error they just set.
  const handleRefresh = useCallback(async () => {
    setEditError(null);
    setAddError(null);
    await refresh();
  }, [refresh]);

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
  const deleteRepositories = useCallback(
    async (repoIds: RepositoryId[]): Promise<boolean> => {
      if (isSavingRef.current) return false;
      isSavingRef.current = true;
      setSaving(true);
      setEditError(null);

      try {
        // Done starts the commit phase: successful deletions are not rolled back.
        // If a later deletion fails, refresh the list so Edit mode can continue
        // against the latest config state.
        for (const repoId of repoIds) {
          await repositoryWriter.removeRepository(repoId);
        }
        await refresh();
        return true;
      } catch (err: unknown) {
        await refresh();
        setEditError(err instanceof Error ? err.message : String(err));
        return false;
      } finally {
        setSaving(false);
        isSavingRef.current = false;
      }
    },
    [refresh, repositoryWriter],
  );

  const clearEditError = useCallback(() => {
    setEditError(null);
  }, []);

  return {
    addError,
    addRepository,
    adding,
    configMissingError,
    deleteRepositories,
    editError,
    error,
    loading,
    repositories,
    refresh: handleRefresh,
    saving,
    clearEditError,
  };
}
