import type { NoteBucket } from './types';

/**
 * Server-internal representation of a note's target: identifies the file and
 * hunk by the diff's own ids rather than by path, so store and reconcile can
 * validate and re-anchor a note without resolving a path on every operation.
 * Never leaves the server; HTTP responses use the path-based public `Note`.
 */
export type AnchoredLineNoteTarget = {
  kind: 'line';
  /** The file the note belongs to. */
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

export type AnchoredFileNoteTarget = {
  kind: 'file';
  /** The file the note belongs to. No bucket: a file note is pane-agnostic and shown in both panes. */
  fileId: string;
};

export type AnchoredNoteTarget = AnchoredLineNoteTarget | AnchoredFileNoteTarget;

export type AnchoredNote = {
  id: string;
  /**
   * Repository-relative path of the target file, recorded at creation.
   *
   * The note carries its own path instead of having it looked up from the
   * current diff, so it can still be presented after its file left the diff.
   * `fileId` is `file-${path}`, so a rename produces a different file rather
   * than a path change on the same note: nothing rewrites this afterwards.
   */
  path: string;
  target: AnchoredNoteTarget;
  body: string;
  createdAt: number;
};
