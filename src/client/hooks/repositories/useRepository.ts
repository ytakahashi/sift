import { useCallback, useEffect, useState } from 'react';
import type { RepositoryId, ResolvedRepository } from '../../../domain/repository/repository';
import type { RepositoryReader } from '../../application/ports';

export interface UseRepositoryResult {
  error: string | null;
  loading: boolean;
  repository: ResolvedRepository | null;
  refresh: () => Promise<void>;
}

export function useRepository(
  repositoryReader: RepositoryReader,
  repoId: RepositoryId,
): UseRepositoryResult {
  const [repository, setRepository] = useState<ResolvedRepository | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setRepository(await repositoryReader.fetchRepository(repoId));
    } catch (err: unknown) {
      setRepository(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [repoId, repositoryReader]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    error,
    loading,
    repository,
    refresh,
  };
}
