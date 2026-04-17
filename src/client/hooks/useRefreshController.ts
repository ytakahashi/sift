import { useCallback, useEffect, useRef } from 'react';
import { computeDiffContentHash } from '../../domain/diff/diff-content-hash';
import type { DiffFile } from '../../domain/diff/types';
import type { DiffDataRefreshResult } from './useDiffData';

export interface UseRefreshControllerOptions {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
  refresh: () => Promise<DiffDataRefreshResult | null>;
  clearNotes: () => void;
}

export interface UseRefreshControllerResult {
  refreshAll: () => Promise<void>;
}

export function useRefreshController({
  workingFiles,
  stagedFiles,
  refresh,
  clearNotes,
}: UseRefreshControllerOptions): UseRefreshControllerResult {
  const latestHashRef = useRef(computeDiffContentHash(workingFiles, stagedFiles));

  useEffect(() => {
    latestHashRef.current = computeDiffContentHash(workingFiles, stagedFiles);
  }, [workingFiles, stagedFiles]);

  const refreshAll = useCallback(async () => {
    const hashBefore = latestHashRef.current;
    const result = await refresh();

    // If result is null (e.g. fetch error or stale response), keep notes because
    // the current diff state is unknown or already superseded by a newer fetch.
    if (!result) {
      return;
    }

    const hashAfter = computeDiffContentHash(result.workingFiles, result.stagedFiles);
    latestHashRef.current = hashAfter;

    if (hashBefore !== hashAfter) {
      clearNotes();
    }
  }, [clearNotes, refresh]);

  return { refreshAll };
}
