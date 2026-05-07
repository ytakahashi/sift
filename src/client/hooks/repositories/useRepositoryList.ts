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

  useEffect(() => {
    if (!enabled) {
      return;
    }

    void refresh();
  }, [enabled, refresh]);

  return {
    configMissingError,
    error,
    loading:
      loading ||
      (enabled && repositories === null && error === null && configMissingError === null),
    repositories,
    refresh,
  };
}
