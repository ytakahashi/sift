/**
 * Pane a note is anchored to. Notes distinguish panes explicitly because
 * `DiffFile.id` (`file-${path}`) collides between working and staged entries
 * of the same path, and the same new-side line number can hold different
 * content in each pane under partial staging.
 */
export type NoteBucket = 'working' | 'staged';

/**
 * Public shape of a line note: addressed by repository-relative path and
 * inclusive line range, as HTTP clients and the UI naturally understand a
 * location. The server-internal fileId/hunkId anchor lives in AnchoredNote.
 */
export type LineNote = {
  id: string;
  kind: 'line';
  /** Repository-relative current path. */
  path: string;
  /** Inclusive new-file-side range. A single-line note has equal start and end values. */
  startLine: number;
  endLine: number;
  /** Pane the range is currently anchored to. */
  bucket: NoteBucket;
  body: string;
  createdAt: number;
};

export type FileNote = {
  id: string;
  kind: 'file';
  /** Repository-relative current path. */
  path: string;
  body: string;
  createdAt: number;
};

export type Note = LineNote | FileNote;

/**
 * Creation request for a note, addressed by path and inclusive line range.
 * Distinct from the stored Note: fileId/hunkId resolution and validation
 * happen on the server so UI- and agent-created notes share one code path.
 */
export type NoteCreateTarget =
  | {
      kind: 'line';
      path: string;
      startLine: number;
      endLine: number;
      /** Optional for generic clients; the UI always supplies its known pane. */
      bucket?: NoteBucket;
    }
  | { kind: 'file'; path: string };
