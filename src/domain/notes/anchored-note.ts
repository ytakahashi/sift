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
  target: AnchoredNoteTarget;
  body: string;
  createdAt: number;
};
