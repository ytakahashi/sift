import { useCallback, useState } from 'react';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { WorkspaceActions } from '../../application/ports';

// onRefresh is awaited when provided so that the file lists are up to date
// before acting is cleared and the UI is re-enabled.
export function useWorkspaceActions(
  workspaceActions: WorkspaceActions,
  repoId: RepositoryId,
  onRefresh?: () => Promise<void> | void,
) {
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performAction = useCallback(
    async (apiCall: () => Promise<void>) => {
      setActing(true);
      setError(null);
      try {
        await apiCall();
        if (onRefresh) {
          await onRefresh();
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
        // Re-throw so callers can run their own failure logic (e.g. optimistic
        // rollback in App). Error display is handled via the error state above;
        // callers should not add their own error UI.
        throw err;
      } finally {
        setActing(false);
      }
    },
    [onRefresh],
  );

  const stageFile = useCallback(
    (path: string) => performAction(() => workspaceActions.stageFile(repoId, path)),
    [performAction, repoId, workspaceActions],
  );
  const unstageFile = useCallback(
    (path: string) => performAction(() => workspaceActions.unstageFile(repoId, path)),
    [performAction, repoId, workspaceActions],
  );
  const discardWorkingFile = useCallback(
    (path: string) => performAction(() => workspaceActions.discardWorkingFile(repoId, path)),
    [performAction, repoId, workspaceActions],
  );
  const stageHunk = useCallback(
    (path: string, hunkId: string) =>
      performAction(() => workspaceActions.stageHunk(repoId, path, hunkId)),
    [performAction, repoId, workspaceActions],
  );
  const unstageHunk = useCallback(
    (path: string, hunkId: string) =>
      performAction(() => workspaceActions.unstageHunk(repoId, path, hunkId)),
    [performAction, repoId, workspaceActions],
  );

  return {
    stageFile,
    unstageFile,
    discardWorkingFile,
    stageHunk,
    unstageHunk,
    acting,
    error,
  };
}
