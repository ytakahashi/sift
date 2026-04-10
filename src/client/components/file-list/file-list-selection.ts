import type { DiffFile } from '../../../domain/diff/types';

/**
 * Returns the index of the file matching `selectedFileId`, or -1 if not found.
 */
export function findSelectedIndex(files: DiffFile[], selectedFileId: string | null): number {
  if (!selectedFileId) {
    return -1;
  }

  return files.findIndex((file) => file.id === selectedFileId);
}

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
