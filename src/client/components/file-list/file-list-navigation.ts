import type { DiffFile } from '../../../domain/diff/types';

export type FileListKeyAction = 'previous' | 'next' | 'first' | 'last' | 'activate' | null;

export function findSelectedIndex(files: DiffFile[], selectedFileId: string | null): number {
  if (!selectedFileId) {
    return -1;
  }

  return files.findIndex((file) => file.id === selectedFileId);
}

export function getFileListKeyAction(key: string): FileListKeyAction {
  switch (key) {
    case 'ArrowUp':
      return 'previous';
    case 'ArrowDown':
      return 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Enter':
      return 'activate';
    default:
      return null;
  }
}

export function getNextSelectedIndex(
  fileCount: number,
  currentIndex: number,
  action: Exclude<FileListKeyAction, 'activate' | null>,
): number {
  if (fileCount === 0) {
    return -1;
  }

  switch (action) {
    case 'previous':
      return currentIndex <= 0 ? 0 : currentIndex - 1;
    case 'next':
      return currentIndex < 0 ? 0 : Math.min(currentIndex + 1, fileCount - 1);
    case 'first':
      return 0;
    case 'last':
      return fileCount - 1;
  }
}
