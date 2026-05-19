import { useCallback, useState } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import {
  type FileActionResult,
  runOptimisticPaneAction,
} from '../../application/panes/pane-action';
import {
  getFallbackSelectionIndex,
  getSelectionByIndex,
  removeFileFromPane,
} from '../../application/panes/pane-files';

interface UseOptimisticPaneFilesResult {
  files: DiffFile[];
  runRemoveAction: (
    file: DiffFile,
    serverCall: (filePath: string) => Promise<void>,
  ) => Promise<FileActionResult>;
  runRemoveAllAction: (
    previouslySelectedFile: DiffFile | null,
    serverCall: () => Promise<void>,
  ) => Promise<FileActionResult>;
}

export function useOptimisticPaneFiles(serverFiles: DiffFile[]): UseOptimisticPaneFilesResult {
  // One-way sync: propagate server data into the local mirror.
  // Optimistic removals are overwritten when the next server refresh arrives.
  // Implemented as "adjust state during render" (React docs pattern) so we avoid
  // an effect that would trigger a second render just to copy the prop.
  const [files, setFiles] = useState<DiffFile[]>(serverFiles);
  const [lastServerFiles, setLastServerFiles] = useState(serverFiles);
  if (lastServerFiles !== serverFiles) {
    setLastServerFiles(serverFiles);
    setFiles(serverFiles);
  }

  const runRemoveAction = useCallback(
    async (
      file: DiffFile,
      serverCall: (filePath: string) => Promise<void>,
    ): Promise<FileActionResult> => {
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
        () => serverCall(file.path),
        (snapshot) => setFiles(snapshot),
      );

      return {
        // Success: select the fallback in the shortened list.
        // Failure: the mirror has been rolled back, so return the original file
        // to keep the selection pointing at an item that still exists.
        nextSelectedFile: succeeded ? getSelectionByIndex(nextSourceFiles, fallbackIndex) : file,
      };
    },
    [files],
  );

  const runRemoveAllAction = useCallback(
    async (
      previouslySelectedFile: DiffFile | null,
      serverCall: () => Promise<void>,
    ): Promise<FileActionResult> => {
      const succeeded = await runOptimisticPaneAction(
        () => files,
        () => setFiles([]),
        serverCall,
        (snapshot) => setFiles(snapshot),
      );

      return {
        // Success: the pane has been cleared, so clear selection in that pane.
        // Failure: the mirror has been rolled back, so keep the previous
        // selection pointing at an item that still exists.
        nextSelectedFile: succeeded ? null : previouslySelectedFile,
      };
    },
    [files],
  );

  return { files, runRemoveAction, runRemoveAllAction };
}
