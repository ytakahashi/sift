import { useCallback } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import type { FileActionResult } from '../../application/panes/pane-action';
import { useOptimisticPaneFiles } from './useOptimisticPaneFiles';

export interface UseStagedPaneResult {
  /**
   * Local mirror of the Staged Changes file list plus actions that remove
   * entries optimistically. Each action returns the next selection to apply:
   * success clears or advances selection for the shortened list, while failure
   * rolls the mirror back and returns the original/previous selection.
   */
  files: DiffFile[];
  unstage: (file: DiffFile) => Promise<FileActionResult>;
  unstageAll: (previouslySelectedFile: DiffFile | null) => Promise<FileActionResult>;
}

export function useStagedPane(
  serverFiles: DiffFile[],
  unstageFile: (path: string) => Promise<void>,
  unstageAllStagedFiles: () => Promise<void>,
): UseStagedPaneResult {
  const { files, runRemoveAction, runRemoveAllAction } = useOptimisticPaneFiles(serverFiles);

  const unstage = useCallback(
    async (file: DiffFile): Promise<FileActionResult> => runRemoveAction(file, unstageFile),
    [runRemoveAction, unstageFile],
  );

  const unstageAll = useCallback(
    async (previouslySelectedFile: DiffFile | null): Promise<FileActionResult> =>
      runRemoveAllAction(previouslySelectedFile, unstageAllStagedFiles),
    [runRemoveAllAction, unstageAllStagedFiles],
  );

  return { files, unstage, unstageAll };
}
