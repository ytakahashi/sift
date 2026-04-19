import { useState, useEffect, useCallback, useRef } from 'react';
import type { DiffFile } from '../../domain/diff/types';
import type { DiffReader } from '../application/ports';

export interface DiffDataRefreshResult {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
}

export interface UseDiffDataResult {
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
  refresh: () => Promise<DiffDataRefreshResult | null>;
}

export function useDiffData(diffReader: DiffReader): UseDiffDataResult {
  const [workingFiles, setWorkingFiles] = useState<DiffFile[]>([]);
  const [stagedFiles, setStagedFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only the latest caller may commit state. This prevents a slower earlier
  // refresh from overwriting newer diff data when manual refresh, action refresh,
  // and auto refresh overlap.
  const latestRequestId = useRef(0);

  const fetchDiffs = useCallback(async (): Promise<DiffDataRefreshResult | null> => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    setLoading(true);
    setError(null);

    try {
      const result = await diffReader.fetchDiff();

      if (requestId !== latestRequestId.current) {
        return null;
      }

      setWorkingFiles(result.workingFiles);
      setStagedFiles(result.stagedFiles);
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
  }, [diffReader]);

  useEffect(() => {
    fetchDiffs();
  }, [fetchDiffs]);

  return { workingFiles, stagedFiles, loading, initialized, error, refresh: fetchDiffs };
}
