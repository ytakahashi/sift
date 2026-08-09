import { useCallback } from 'react';
import type { RepositoryDiff } from '../../../domain/diff/types';

export interface UseRefreshControllerOptions {
  refresh: () => Promise<RepositoryDiff | null>;
  /** Picks up the server-side reconcile result after the diff was refreshed. */
  refetchNotes: () => Promise<void> | void;
}

export interface UseRefreshControllerResult {
  refreshAll: () => Promise<void>;
}

/**
 * Refreshes the diff, then the notes.
 *
 * Notes are refetched after every successful refresh, rather than only when the
 * client can tell that the diff changed. Staleness is decided server-side from
 * worktree blob identity, which nothing derived from the diff on this side
 * reproduces: reordering lines, or changing a file's mode, can leave the diff
 * looking equivalent while the server considers that file's notes stale.
 * Guessing wrong leaves a note on screen as though it still applied, so the
 * client asks rather than predicts.
 *
 * A failed or superseded refresh (null) is skipped: the current diff state is
 * unknown, and server-driven notes changes still arrive over SSE.
 */
export function useRefreshController({
  refresh,
  refetchNotes,
}: UseRefreshControllerOptions): UseRefreshControllerResult {
  const refreshAll = useCallback(async () => {
    const result = await refresh();
    if (!result) {
      return;
    }
    await refetchNotes();
  }, [refetchNotes, refresh]);

  return { refreshAll };
}
