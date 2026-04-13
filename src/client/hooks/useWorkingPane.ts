import { useCallback, useEffect, useState } from 'react';
import type { DiffFile } from '../../domain/diff/types';
import { type FileActionResult, runOptimisticPaneAction } from './pane-action';
import { getFallbackSelectionIndex, getSelectionByIndex, removeFileFromPane } from './pane-files';

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
}

// This function is almost the same as "useStagedPane", so consider refactoring when adding remove action.
export function useWorkingPane(
  serverFiles: DiffFile[],
  stageFile: (path: string) => Promise<void>,
): UseWorkingPaneResult {
  // One-way sync: propagate server data into the local mirror.
  // Optimistic removals are overwritten when the next server refresh arrives.
  const [files, setFiles] = useState<DiffFile[]>([]);

  useEffect(() => {
    setFiles(serverFiles);
  }, [serverFiles]);

  const stage = useCallback(
    async (file: DiffFile): Promise<FileActionResult> => {
      const currentIndex = files.findIndex((f) => f.id === file.id);
      const fallbackIndex = getFallbackSelectionIndex(currentIndex, files.length);
      const { nextSourceFiles, removedFile } = removeFileFromPane({
        sourceFiles: files,
        fileId: file.id,
      });

      // Guard against race conditions (e.g. double-click before the first action
      // completes and the file has already been removed from the mirror).
      if (!removedFile) {
        return { nextSelectedFile: getSelectionByIndex(files, fallbackIndex) };
      }

      const succeeded = await runOptimisticPaneAction(
        () => files,
        () => setFiles(nextSourceFiles),
        () => stageFile(file.path),
        (snapshot) => setFiles(snapshot),
      );

      return {
        // Success: select the fallback in the shortened list.
        // Failure: the mirror has been rolled back, so return the original file
        // to keep the selection pointing at an item that still exists.
        nextSelectedFile: succeeded ? getSelectionByIndex(nextSourceFiles, fallbackIndex) : file,
      };
    },
    [files, stageFile],
  );

  return { files, stage };
}
