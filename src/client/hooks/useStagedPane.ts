import { useCallback, useEffect, useState } from 'react';
import type { DiffFile } from '../../domain/diff/types';
import { type FileActionResult, runOptimisticPaneAction } from './pane-action';
import { removeFileFromPane } from '../components/file-list/file-list-optimistic';
import {
  getFallbackSelectionIndex,
  getSelectionByIndex,
} from '../components/file-list/file-list-selection';

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
  // One-way sync: propagate server data into the local mirror.
  // Optimistic removals are overwritten when the next server refresh arrives.
  const [files, setFiles] = useState<DiffFile[]>([]);

  useEffect(() => {
    setFiles(serverFiles);
  }, [serverFiles]);

  const unstage = useCallback(
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
        () => unstageFile(file.path),
        (snapshot) => setFiles(snapshot),
      );

      return {
        // Success: select the fallback in the shortened list.
        // Failure: the mirror has been rolled back, so return the original file
        // to keep the selection pointing at an item that still exists.
        nextSelectedFile: succeeded ? getSelectionByIndex(nextSourceFiles, fallbackIndex) : file,
      };
    },
    [files, unstageFile],
  );

  return { files, unstage };
}
