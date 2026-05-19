import { useCallback, useEffect, useState } from 'react';
import type { RepositoryList } from '../../../domain/repository/repository';
import { RepositoryFetchError, type RepositoryReader } from '../../application/ports';

export interface UseRepositoryListOptions {
  enabled?: boolean;
}

export interface UseRepositoryListResult {
  configMissingError: string | null;
  error: string | null;
  loading: boolean;
  repositories: RepositoryList | null;
  refresh: () => Promise<void>;
}

export function useRepositoryList(
  repositoryReader: RepositoryReader,
  { enabled = true }: UseRepositoryListOptions = {},
): UseRepositoryListResult {
  const [repositories, setRepositories] = useState<RepositoryList | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
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

  // Fetch-on-mount: `refresh` synchronously calls setLoading/setError before
  // awaiting the repository list read. This is the intended sync between React
  // and the server, not state derived from props that could be computed in render.
  useEffect(() => {
    if (!enabled) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [enabled, refresh]);

  return {
    configMissingError,
    error,
    // `loading` tracks in-flight fetches. The second clause covers the window
    // right after `enabled` becomes true: the effect had not run `refresh()` yet,
    // so `setLoading(true)` has not fired, but we still have no data or errors.
    loading:
      loading ||
      (enabled && repositories === null && error === null && configMissingError === null),
    repositories,
    refresh,
  };
}
