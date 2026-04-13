export interface NotePathResolvableFile {
  id: string;
  displayPath: string;
}

export function resolveNoteFilePath(
  fileId: string,
  workingFiles: NotePathResolvableFile[],
  stagedFiles: NotePathResolvableFile[],
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
