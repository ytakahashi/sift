import { useCallback } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import type { FileActionResult } from '../../application/panes/pane-action';
import { useOptimisticPaneFiles } from './useOptimisticPaneFiles';

export interface UseWorkingPaneResult {
  /**
   * Local mirror of the Working Directory file list plus actions that remove
   * entries optimistically. Each action returns the next selection to apply:
   * success clears or advances selection for the shortened list, while failure
   * rolls the mirror back and returns the original/previous selection.
   */
  files: DiffFile[];
  stage: (file: DiffFile) => Promise<FileActionResult>;
  discard: (file: DiffFile) => Promise<FileActionResult>;
  stageAll: (previouslySelectedFile: DiffFile | null) => Promise<FileActionResult>;
  discardAll: (previouslySelectedFile: DiffFile | null) => Promise<FileActionResult>;
}

export function useWorkingPane(
  serverFiles: DiffFile[],
  stageFile: (path: string) => Promise<void>,
  discardWorkingFile: (path: string) => Promise<void>,
  stageAllWorkingFiles: () => Promise<void>,
  discardAllWorkingFiles: () => Promise<void>,
): UseWorkingPaneResult {
  const { files, runRemoveAction, runRemoveAllAction } = useOptimisticPaneFiles(serverFiles);

  const stage = useCallback(
    async (file: DiffFile): Promise<FileActionResult> => runRemoveAction(file, stageFile),
    [runRemoveAction, stageFile],
  );

  const discard = useCallback(
    async (file: DiffFile): Promise<FileActionResult> => runRemoveAction(file, discardWorkingFile),
    [discardWorkingFile, runRemoveAction],
  );

  const stageAll = useCallback(
    async (previouslySelectedFile: DiffFile | null): Promise<FileActionResult> =>
      runRemoveAllAction(previouslySelectedFile, stageAllWorkingFiles),
    [runRemoveAllAction, stageAllWorkingFiles],
  );

  const discardAll = useCallback(
    async (previouslySelectedFile: DiffFile | null): Promise<FileActionResult> =>
      runRemoveAllAction(previouslySelectedFile, discardAllWorkingFiles),
    [discardAllWorkingFiles, runRemoveAllAction],
  );

  return { files, stage, discard, stageAll, discardAll };
}
