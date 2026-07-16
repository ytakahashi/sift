import { computeDiffContentHash } from '../../../domain/diff/diff-content-hash';
import type { DiffFile } from '../../../domain/diff/types';

export interface DiffRefreshData {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
}

export interface RefreshEffectsDecision {
  nextHash: string | null;
  /**
   * Whether notes should be refetched from the server. Note discarding itself
   * happens server-side (reconcile on every notes API access); the client only
   * needs to pick up the reconciled result when the diff actually changed.
   */
  shouldRefetchNotes: boolean;
}

export function computeDiffRefreshHash(workingFiles: DiffFile[], stagedFiles: DiffFile[]): string {
  // Hash each pane separately. The merged computeDiffContentHash is invariant
  // under stage/unstage (content moving between panes), but a pane move is
  // exactly when the server re-anchors line notes to the other bucket, so the
  // refetch trigger must fire for it or re-anchored notes would stay invisible
  // until some other notes API access happens.
  // JSON keeps the pane boundary unambiguous (the hash strings themselves
  // may contain any separator character).
  return JSON.stringify([
    computeDiffContentHash(workingFiles, []),
    computeDiffContentHash([], stagedFiles),
  ]);
}

export function decideRefreshEffects(
  previousHash: string,
  result: DiffRefreshData | null,
): RefreshEffectsDecision {
  // If result is null (e.g. fetch error or stale response), skip the refetch:
  // the current diff state is unknown or already superseded by a newer fetch,
  // and server-driven notes changes arrive via the notes-changed SSE anyway.
  if (!result) {
    return {
      nextHash: null,
      shouldRefetchNotes: false,
    };
  }

  const nextHash = computeDiffRefreshHash(result.workingFiles, result.stagedFiles);
  return {
    nextHash,
    shouldRefetchNotes: previousHash !== nextHash,
  };
}
