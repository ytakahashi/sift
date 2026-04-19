import { useCallback, useEffect, useRef } from 'react';
import {
  computeDiffRefreshHash,
  decideRefreshEffects,
} from '../../application/sync/refresh-policy';
import type { DiffData } from '../../application/ports';
import type { DiffFile } from '../../../domain/diff/types';

export interface UseRefreshControllerOptions {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
  refresh: () => Promise<DiffData | null>;
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

    if (decision.shouldClearNotes) {
      clearNotes();
    }
  }, [clearNotes, refresh]);

  return { refreshAll };
}
