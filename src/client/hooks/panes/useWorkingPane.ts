import { useCallback } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import type { FileActionResult } from '../../application/panes/pane-action';
import { useOptimisticPaneFiles } from './useOptimisticPaneFiles';

export interface UseWorkingPaneResult {
  /** Local mirror of the Working Directory file list with optimistic updates applied. */
  files: DiffFile[];
  /**
   * Stages a file and returns the next selection to apply.
   *
   * The file is removed from the local mirror immediately (optimistic update).
   * If the server call succeeds, the result contains the fallback file adjacent
   * to the removed slot. If it fails, the mirror is rolled back and the original
   * file is returned so the caller can restore the selection without a try/catch.
   *
   * Future pane actions (remove, stageAll, removeAll) will follow the same pattern.
   */
  stage: (file: DiffFile) => Promise<FileActionResult>;
  discard: (file: DiffFile) => Promise<FileActionResult>;
}

export function useWorkingPane(
  serverFiles: DiffFile[],
  stageFile: (path: string) => Promise<void>,
  discardWorkingFile: (path: string) => Promise<void>,
): UseWorkingPaneResult {
  const { files, runRemoveAction } = useOptimisticPaneFiles(serverFiles);

  const stage = useCallback(
    async (file: DiffFile): Promise<FileActionResult> => runRemoveAction(file, stageFile),
    [runRemoveAction, stageFile],
  );

  const discard = useCallback(
    async (file: DiffFile): Promise<FileActionResult> => runRemoveAction(file, discardWorkingFile),
    [discardWorkingFile, runRemoveAction],
  );

  return { files, stage, discard };
}
