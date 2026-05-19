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

  // Fetch-on-mount: `refresh` synchronously calls setLoading/setError before
  // awaiting the repository read. This is the intended sync between React and
  // the server, not state derived from props that could be computed in render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  return {
    error,
    loading,
    repository,
    refresh,
  };
}
