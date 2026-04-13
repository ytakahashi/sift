// Pure helpers for optimistic UI updates. These functions compute the next state
// synchronously so the UI can reflect a user action (stage / unstage) before the
// server responds. On failure the caller restores the previous snapshot.
import type { DiffFile } from '../../../domain/diff/types';

/**
 * The result returned by a pane hook action (e.g. stage, unstage).
 * Callers use this to advance the file selection after an optimistic update.
 */
export interface FileActionResult {
  /**
   * The file that should be selected after the action.
   * - Success: the fallback file in the updated list (null if the list is empty).
   * - Failure: the original file (the list has been rolled back so it still exists).
   */
  nextSelectedFile: DiffFile | null;
}

interface RemoveFileFromPaneInput {
  sourceFiles: DiffFile[];
  fileId: string;
}

interface RemoveFileFromPaneResult {
  nextSourceFiles: DiffFile[];
  // The removed file, or null if it was not found. Callers use this as a signal
  // to detect race conditions (e.g. double-click after the file was already
  // removed) and abort the action early.
  removedFile: DiffFile | null;
}

export function removeFileFromPane({
  sourceFiles,
  fileId,
}: RemoveFileFromPaneInput): RemoveFileFromPaneResult {
  const sourceIndex = sourceFiles.findIndex((file) => file.id === fileId);
  if (sourceIndex < 0) {
    return {
      nextSourceFiles: sourceFiles,
      removedFile: null,
    };
  }

  return {
    nextSourceFiles: sourceFiles.filter((file) => file.id !== fileId),
    removedFile: sourceFiles[sourceIndex],
  };
}

/**
 * Runs an optimistic UI update for a single user action.
 *
 * Steps:
 *   1. Capture a snapshot for rollback via `getSnapshot`.
 *   2. Apply the optimistic local state change via `applyOptimistic`.
 *   3. Await the server call.
 *   4. On failure: invoke `rollback` with the snapshot and return `false`.
 *   5. On success: return `true`.
 *
 * Error display is intentionally left to the `serverCall` implementation
 * (useWorkspaceActions sets its error state before re-throwing), so this
 * function does not re-throw — callers never need a surrounding try/catch.
 *
 * @returns `true` on success, `false` when the action failed and rollback ran.
 */
export async function runOptimistic<S>(
  getSnapshot: () => S,
  applyOptimistic: () => void,
  serverCall: () => Promise<void>,
  rollback: (snapshot: S) => void,
): Promise<boolean> {
  const snapshot = getSnapshot();
  applyOptimistic();
  try {
    await serverCall();
    return true;
  } catch {
    rollback(snapshot);
    return false;
  }
}
