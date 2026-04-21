import { useCallback, useEffect, useState } from 'react';
import type { RepositoryList } from '../../../domain/repository/repository';
import type { RepositoryReader } from '../../application/ports';

export interface UseRepositoriesResult {
  error: string | null;
  loading: boolean;
  repositories: RepositoryList | null;
  refresh: () => Promise<void>;
}

export function useRepositories(repositoryReader: RepositoryReader): UseRepositoriesResult {
  const [repositories, setRepositories] = useState<RepositoryList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setRepositories(await repositoryReader.fetchRepositories());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repositoryReader]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    error,
    loading,
    repositories,
    refresh,
  };
}
