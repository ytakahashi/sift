import { useCallback } from 'react';
import type { DiffFile } from '../../domain/diff/types';
import type { FileActionResult } from './pane-action';
import { useOptimisticPaneFiles } from './useOptimisticPaneFiles';

export interface UseStagedPaneResult {
  /** Local mirror of the Staged Changes file list with optimistic updates applied. */
  files: DiffFile[];
  /**
   * Unstages a file and returns the next selection to apply.
   *
   * Mirrors the pattern used by useWorkingPane.stage: the file is removed from
   * the local mirror immediately and the server call runs in the background.
   * On failure the mirror is rolled back and the original file is returned.
   *
   * Future pane actions (unstageAll) will follow the same pattern.
   */
  unstage: (file: DiffFile) => Promise<FileActionResult>;
}

export function useStagedPane(
  serverFiles: DiffFile[],
  unstageFile: (path: string) => Promise<void>,
): UseStagedPaneResult {
  const { files, runRemoveAction } = useOptimisticPaneFiles(serverFiles);

  const unstage = useCallback(
    async (file: DiffFile): Promise<FileActionResult> => runRemoveAction(file, unstageFile),
    [runRemoveAction, unstageFile],
  );

  return { files, unstage };
}
