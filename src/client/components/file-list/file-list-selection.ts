import type { DiffFile } from '../../../domain/diff/types';

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
