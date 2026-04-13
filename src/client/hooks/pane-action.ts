import type { DiffFile } from '../../domain/diff/types';

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

/**
 * Executes a pane action (e.g. stage, unstage) with an optimistic UI update.
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
export async function runOptimisticPaneAction<S>(
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
