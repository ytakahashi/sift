import type { DiffFile } from '../../domain/diff/types';
import type { AnchoredNote } from '../../domain/notes/anchored-note';
import { isNoteEligibleFile } from '../../domain/notes/note-eligibility';
import type { Note } from '../../domain/notes/types';

export interface NoteResponseContext {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
}

/**
 * A stored AnchoredNote no longer resolves to any note-eligible file in the
 * current diff, even though reconcile is expected to keep the store
 * consistent with it. This signals a server bug or race rather than a normal
 * user-facing condition, so it is surfaced as an error (mapped to 500)
 * instead of silently dropping the note or leaking fileId/hunkId.
 */
export class NotePresentationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotePresentationError';
  }
}

/**
 * File notes are pane-agnostic, so a matching id in either pane resolves the
 * note; working is checked first. This assumes the same fileId always means
 * the same path in both panes (true for the current id scheme, `file-${path}`).
 * If that ever stops holding, this silently picks the working-pane path
 * instead of surfacing the mismatch as a NotePresentationError.
 */
function findEligibleFileById(context: NoteResponseContext, fileId: string): DiffFile | null {
  return (
    [...context.workingFiles, ...context.stagedFiles].find(
      (file) => file.id === fileId && isNoteEligibleFile(file),
    ) ?? null
  );
}

/** Converts a server-internal AnchoredNote to the path-based public Note, or null if unresolvable. */
export function toNoteResponse(note: AnchoredNote, context: NoteResponseContext): Note | null {
  if (note.target.kind === 'file') {
    const file = findEligibleFileById(context, note.target.fileId);
    if (!file) {
      return null;
    }
    return {
      id: note.id,
      kind: 'file',
      path: file.path,
      body: note.body,
      createdAt: note.createdAt,
    };
  }

  const files = note.target.bucket === 'working' ? context.workingFiles : context.stagedFiles;
  const file = files.find(
    (candidate) => candidate.id === note.target.fileId && isNoteEligibleFile(candidate),
  );
  if (!file) {
    return null;
  }

  return {
    id: note.id,
    kind: 'line',
    path: file.path,
    startLine: note.target.startNewLineNumber,
    endLine: note.target.endNewLineNumber,
    bucket: note.target.bucket,
    body: note.body,
    createdAt: note.createdAt,
  };
}
