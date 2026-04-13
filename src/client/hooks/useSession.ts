import { useCallback, useEffect, useState } from 'react';
import type { RepositoryInfo, SessionInfo } from '../../domain/session/types';

type UseSessionResult = {
  repository: RepositoryInfo | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useSession(): UseSessionResult {
  const [repository, setRepository] = useState<RepositoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/session');
      if (!res.ok) {
        throw new Error(`Failed to fetch session: ${res.statusText}`);
      }

      const data = (await res.json()) as Partial<SessionInfo>;
      setRepository(data.repository ?? null);
    } catch (err: unknown) {
      setRepository(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  return { repository, loading, error, refresh: fetchSession };
}
