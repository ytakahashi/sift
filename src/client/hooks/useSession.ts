import { useCallback, useEffect, useState } from 'react';
import type { RepositoryInfo } from '../../domain/session/types';
import type { SessionReader } from '../application/ports';

type UseSessionResult = {
  repository: RepositoryInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useSession(sessionReader: SessionReader): UseSessionResult {
  const [repository, setRepository] = useState<RepositoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    // Both initial load and manual refresh use the same loading state.
    setLoading(true);
    setError(null);

    try {
      const data = await sessionReader.fetchSession();
      setRepository(data.repository ?? null);
    } catch (err: unknown) {
      setRepository(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [sessionReader]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  return { repository, loading, error, refresh: fetchSession };
}
