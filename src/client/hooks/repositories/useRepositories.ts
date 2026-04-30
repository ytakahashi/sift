import { useCallback, useEffect, useState } from 'react';
import type { RepositoryList } from '../../../domain/repository/repository';
import {
  RepositoryFetchError,
  type RepositoryReader,
  type RepositoryWriter,
} from '../../application/ports';

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
  const [repositories, setRepositories] = useState<RepositoryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [configMissingError, setConfigMissingError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    setConfigMissingError(null);

    try {
      setRepositories(await repositoryReader.fetchRepositories());
    } catch (err: unknown) {
      setRepositories(null);
      if (err instanceof RepositoryFetchError && err.statusCode === 404) {
        setConfigMissingError(err.message);
        return;
      }

      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repositoryReader]);

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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
