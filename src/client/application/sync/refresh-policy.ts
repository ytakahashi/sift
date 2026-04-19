import { computeDiffContentHash } from '../../../domain/diff/diff-content-hash';
import type { DiffFile } from '../../../domain/diff/types';

export interface DiffRefreshData {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
}

export interface RefreshEffectsDecision {
  nextHash: string | null;
  shouldClearNotes: boolean;
}

export function computeDiffRefreshHash(workingFiles: DiffFile[], stagedFiles: DiffFile[]): string {
  return computeDiffContentHash(workingFiles, stagedFiles);
}

export function decideRefreshEffects(
  previousHash: string,
  result: DiffRefreshData | null,
): RefreshEffectsDecision {
  // If result is null (e.g. fetch error or stale response), keep notes because
  // the current diff state is unknown or already superseded by a newer fetch.
  if (!result) {
    return {
      nextHash: null,
      shouldClearNotes: false,
    };
  }

  const nextHash = computeDiffRefreshHash(result.workingFiles, result.stagedFiles);
  return {
    nextHash,
    shouldClearNotes: previousHash !== nextHash,
  };
}
