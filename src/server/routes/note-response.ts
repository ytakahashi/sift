import type { AnchoredNote } from '../../domain/notes/anchored-note';
import type { Note } from '../../domain/notes/types';

/**
 * Converts a server-internal AnchoredNote to the path-based public Note.
 *
 * The note records its own path (see AnchoredNote.path), so this is a total
 * mapping that never consults the current diff: a note whose file is no
 * longer part of the diff still presents the location it was created for,
 * instead of failing the request or leaking the internal fileId/hunkId.
 */
export function toNoteResponse(note: AnchoredNote): Note {
  if (note.target.kind === 'file') {
    return {
      id: note.id,
      kind: 'file',
      path: note.path,
      body: note.body,
      createdAt: note.createdAt,
    };
  }

  return {
    id: note.id,
    kind: 'line',
    path: note.path,
    startLine: note.target.startNewLineNumber,
    endLine: note.target.endNewLineNumber,
    bucket: note.target.bucket,
    body: note.body,
    createdAt: note.createdAt,
  };
}
