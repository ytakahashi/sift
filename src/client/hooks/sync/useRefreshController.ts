import { useCallback, useEffect, useRef } from 'react';
import {
  computeDiffRefreshHash,
  decideRefreshEffects,
} from '../../application/sync/refresh-policy';
import type { DiffFile, RepositoryDiff } from '../../../domain/diff/types';

export interface UseRefreshControllerOptions {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
  refresh: () => Promise<RepositoryDiff | null>;
  /** Picks up the server-side reconcile result after the diff content changed. */
  refetchNotes: () => Promise<void> | void;
}

export interface UseRefreshControllerResult {
  refreshAll: () => Promise<void>;
}

export function useRefreshController({
  workingFiles,
  stagedFiles,
  refresh,
  refetchNotes,
}: UseRefreshControllerOptions): UseRefreshControllerResult {
  const latestHashRef = useRef(computeDiffRefreshHash(workingFiles, stagedFiles));

  useEffect(() => {
    latestHashRef.current = computeDiffRefreshHash(workingFiles, stagedFiles);
  }, [workingFiles, stagedFiles]);

  const refreshAll = useCallback(async () => {
    const hashBefore = latestHashRef.current;
    const result = await refresh();
    const decision = decideRefreshEffects(hashBefore, result);

    if (decision.nextHash) {
      latestHashRef.current = decision.nextHash;
    }

    if (decision.shouldRefetchNotes) {
      await refetchNotes();
    }
  }, [refetchNotes, refresh]);

  return { refreshAll };
}
