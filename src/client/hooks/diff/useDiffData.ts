import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiffFile, RepositoryDiff } from '../../../domain/diff/types';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { DiffReader } from '../../application/ports';

export interface UseDiffDataResult {
  /** Absolute repository root returned with the latest accepted diff read. */
  repoRoot: string | null;
  /** Files with unstaged working-tree changes returned by the latest accepted diff read. */
  workingFiles: DiffFile[];
  /** Files with staged index changes returned by the latest accepted diff read. */
  stagedFiles: DiffFile[];
  /** True while the hook is waiting for the latest requested diff read. */
  loading: boolean;
  /** True after the first accepted diff read or error has completed. */
  initialized: boolean;
  /** Message from the latest accepted diff read failure, or null after a successful read. */
  error: string | null;
  /** Reads diff data again and applies the result only if no newer request superseded it. */
  refresh: () => Promise<RepositoryDiff | null>;
}

export function useDiffData(diffReader: DiffReader, repoId: RepositoryId): UseDiffDataResult {
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const [workingFiles, setWorkingFiles] = useState<DiffFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest caller may commit state. This prevents a slower earlier
  // refresh from overwriting newer diff data when manual refresh, action refresh,
  // and auto refresh overlap.
  const latestRequestId = useRef(0);

  const fetchDiffs = useCallback(async (): Promise<RepositoryDiff | null> => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const result = await diffReader.fetchDiff(repoId);

      if (requestId !== latestRequestId.current) {
        return null;
      }

      setWorkingFiles(result.workingFiles);
      setStagedFiles(result.stagedFiles);
      setRepoRoot(result.metadata.repoRoot);
      return result;
    } catch (err: unknown) {
      if (requestId === latestRequestId.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
      return null;
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
        setInitialized(true);
      }
    }
  }, [diffReader, repoId]);

  // Fetch-on-mount: `fetchDiffs` synchronously calls setLoading/setError before
  // awaiting the network read. This is the intended behavior (sync external Git
  // state into React) and there is no idiomatic way to express it without an
  // effect-driven setState in this codebase.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDiffs();
  }, [fetchDiffs]);

  return {
    repoRoot,
    workingFiles,
    stagedFiles,
    loading,
    initialized,
    error,
    refresh: fetchDiffs,
  };
}
