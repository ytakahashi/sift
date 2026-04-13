import type { DiffFile } from '../../domain/diff/types';

/**
 * Computes the fallback selection index after an item at `currentIndex` is
 * removed from a list of `fileCount` items (the count *before* removal).
 *
 * - If the removed item had a next sibling, the same index is returned so the
 *   selection "stays in place" (the next sibling slides into the vacated slot).
 * - If the removed item was the last in the list, the previous index is returned.
 * - Returns -1 when the list will be empty after removal (fileCount <= 1).
 */
export function getFallbackSelectionIndex(currentIndex: number, fileCount: number): number {
  if (fileCount <= 1 || currentIndex < 0 || currentIndex >= fileCount) {
    return -1;
  }

  return currentIndex < fileCount - 1 ? currentIndex : currentIndex - 1;
}

export function getSelectionByIndex(files: DiffFile[], index: number): DiffFile | null {
  if (index < 0 || index >= files.length) {
    return null;
  }

  return files[index] ?? null;
}

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

/**
 * Pure helper for optimistic UI updates in the file list.
 * Computes the next state synchronously so the UI can reflect a user action
 * (stage / unstage) before the server responds.
 */
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
