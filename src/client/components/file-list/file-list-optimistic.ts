// Pure helpers for optimistic UI updates. These functions compute the next state
// synchronously so the UI can reflect a user action (stage / unstage) before the
// server responds. On failure the caller restores the previous snapshot.
import type { DiffFile } from '../../../domain/diff/types';

interface RemoveFileFromPaneInput {
  sourceFiles: DiffFile[];
  fileId: string;
}

interface RemoveFileFromPaneResult {
  nextSourceFiles: DiffFile[];
  // The removed file, or null if it was not found. Callers use this as a signal
  // to detect race conditions (e.g. double-click after the file was already
  // removed) and abort the action early.
  removedFile: DiffFile | null;
}

export function removeFileFromPane({
  sourceFiles,
  fileId,
}: RemoveFileFromPaneInput): RemoveFileFromPaneResult {
  const sourceIndex = sourceFiles.findIndex((file) => file.id === fileId);
  if (sourceIndex < 0) {
    return {
      nextSourceFiles: sourceFiles,
      removedFile: null,
    };
  }

  return {
    nextSourceFiles: sourceFiles.filter((file) => file.id !== fileId),
    removedFile: sourceFiles[sourceIndex],
  };
}
