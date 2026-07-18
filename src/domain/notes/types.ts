/**
 * Pane a note is anchored to. Notes distinguish panes explicitly because
 * `DiffFile.id` (`file-${path}`) collides between working and staged entries
 * of the same path, and the same new-side line number can hold different
 * content in each pane under partial staging.
 */
export type NoteBucket = 'working' | 'staged';

export type LineNoteTarget = {
  kind: 'line';
  /** The file the note belongs to */
  fileId: string;
  /** Pane the note is anchored to. Resolved by the server at creation and kept up to date by reconcile. */
  bucket: NoteBucket;
  /** The hunk the note belongs to. Always resolved by the server at creation and refreshed by reconcile. */
  hunkId: string;
  /**
   * Inclusive range of lines for the note (new file side).
   * A single-line note has equal start and end values.
   */
  startNewLineNumber: number;
  endNewLineNumber: number;
};

export type FileNoteTarget = {
  kind: 'file';
  /** The file the note belongs to. No bucket: a file note is pane-agnostic and shown in both panes. */
  fileId: string;
};

export type NoteTarget = LineNoteTarget | FileNoteTarget;

export type Note = {
  id: string;
  target: NoteTarget;
  body: string;
  createdAt: number;
};
