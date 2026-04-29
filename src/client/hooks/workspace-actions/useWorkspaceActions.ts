import { useCallback, useState } from 'react';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { WorkspaceActions } from '../../application/ports';

// onRefresh is awaited when provided so that the file lists are up to date
// before acting is cleared and the UI is re-enabled.
export function useWorkspaceActions(
  workspaceActions: WorkspaceActions,
  repoId: RepositoryId,
  onRefresh?: () => Promise<void> | void,
): {
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  stageAllWorkingFiles: () => Promise<void>;
  unstageAllStagedFiles: () => Promise<void>;
  discardWorkingFile: (path: string) => Promise<void>;
  discardAllWorkingFiles: () => Promise<void>;
  stageHunk: (path: string, hunkId: string) => Promise<void>;
  unstageHunk: (path: string, hunkId: string) => Promise<void>;
  acting: boolean;
  error: string | null;
} {
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
  const stageAllWorkingFiles = useCallback(
    () => performAction(() => workspaceActions.stageAllWorkingFiles(repoId)),
    [performAction, repoId, workspaceActions],
  );
  const unstageAllStagedFiles = useCallback(
    () => performAction(() => workspaceActions.unstageAllStagedFiles(repoId)),
    [performAction, repoId, workspaceActions],
  );
  const discardWorkingFile = useCallback(
    (path: string) => performAction(() => workspaceActions.discardWorkingFile(repoId, path)),
    [performAction, repoId, workspaceActions],
  );
  const discardAllWorkingFiles = useCallback(
    () => performAction(() => workspaceActions.discardAllWorkingFiles(repoId)),
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
    stageAllWorkingFiles,
    unstageAllStagedFiles,
    discardWorkingFile,
    discardAllWorkingFiles,
    stageHunk,
    unstageHunk,
    acting,
    error,
  };
}
