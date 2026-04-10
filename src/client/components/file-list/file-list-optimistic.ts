import type { DiffFile } from '../../../domain/diff/types';

interface RemoveFileFromPaneInput {
  sourceFiles: DiffFile[];
  fileId: string;
}

interface RemoveFileFromPaneResult {
  nextSourceFiles: DiffFile[];
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
