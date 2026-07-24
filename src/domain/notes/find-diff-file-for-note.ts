import type { DiffFile } from '../diff/types';
import type { Note } from './types';

export type NotePane = 'working' | 'staged';

export interface NoteDiffFileMatch {
  file: DiffFile;
  pane: NotePane;
}

/**
 * Resolves the DiffFile a note's location points to, so clicking a note can
 * select the matching pane/file the same way FileList selection does.
 *
 * LineNote carries `bucket`, so it searches that pane's list directly.
 * FileNote has no bucket (see NoteBucket doc in types.ts), so it falls back
 * to working then staged, matching the pane the file is currently shown in.
 */
export function findDiffFileForNote(
  workingFiles: DiffFile[],
  stagedFiles: DiffFile[],
  note: Note,
): NoteDiffFileMatch | null {
  if (note.kind === 'line') {
    const files = note.bucket === 'staged' ? stagedFiles : workingFiles;
    const file = files.find((candidate) => candidate.path === note.path);
    return file ? { file, pane: note.bucket } : null;
  }

  const workingMatch = workingFiles.find((candidate) => candidate.path === note.path);
  if (workingMatch) {
    return { file: workingMatch, pane: 'working' };
  }

  const stagedMatch = stagedFiles.find((candidate) => candidate.path === note.path);
  return stagedMatch ? { file: stagedMatch, pane: 'staged' } : null;
}
