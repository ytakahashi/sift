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
  const common = {
    id: note.id,
    path: note.path,
    body: note.body,
    createdAt: note.createdAt,
    staleness: note.staleness,
    ...(note.author !== undefined ? { author: note.author } : {}),
    ...(note.reviewId !== undefined ? { reviewId: note.reviewId } : {}),
    ...(note.status !== undefined ? { status: note.status } : {}),
    ...(note.replies !== undefined ? { replies: note.replies } : {}),
  };
  if (note.target.kind === 'file') {
    return { ...common, kind: 'file' };
  }

  return {
    ...common,
    kind: 'line',
    startLine: note.target.startNewLineNumber,
    endLine: note.target.endNewLineNumber,
    bucket: note.target.bucket,
  };
}
