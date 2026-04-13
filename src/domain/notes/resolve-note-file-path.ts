import type { DiffFile } from '../diff/types';

export function resolveNoteFilePath(
  fileId: string,
  workingFiles: DiffFile[],
  stagedFiles: DiffFile[],
): string {
  const found =
    workingFiles.find((file) => file.id === fileId) ??
    stagedFiles.find((file) => file.id === fileId);

  if (found) {
    return found.displayPath;
  }

  // Once we decide to use a dedicated FileId type, consider changing this to other value.
  return fileId;
}
