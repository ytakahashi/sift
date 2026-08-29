/**
 * Pane a note is anchored to. Notes distinguish panes explicitly because
 * `DiffFile.id` (`file-${path}`) collides between working and staged entries
 * of the same path, and the same new-side line number can hold different
 * content in each pane under partial staging.
 */
export type NoteBucket = 'working' | 'staged';

/**
 * Why a note no longer matches its current repository state. Each value
 * corresponds to one of reconcile's checks, so the UI and agents can explain
 * what happened rather than only that something did.
 *
 * Defined as a runtime array (rather than a plain union type) so callers
 * outside this module can validate a reason against the exact known set
 * instead of duplicating the literal list.
 */
export const NOTE_STALE_REASONS = [
  /** The note's file is no longer in either pane (committed, discarded, deleted, ...). */
  'file-out-of-diff',
  /** The file is still in the diff, but its worktree content changed after creation. */
  'content-changed',
  /** The file is unchanged, but the anchored line range no longer resolves (e.g. partial staging). */
  'range-unresolved',
] as const;

export type NoteStaleReason = (typeof NOTE_STALE_REASONS)[number];

/**
 * Whether a note still matches its current repository state and applicable
 * diff anchor.
 *
 * Recomputed on every reconcile pass from the note's creation-time anchor,
 * which is never rewritten. Staleness therefore does not accumulate: a file
 * returning to the state it had when the note was written makes the note live
 * again instead of leaving it permanently marked.
 */
export type NoteStaleness = { kind: 'live' } | { kind: 'stale'; reason: NoteStaleReason };

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
  staleness: NoteStaleness;
};

export type FileNote = {
  id: string;
  kind: 'file';
  /** Repository-relative current path. */
  path: string;
  body: string;
  createdAt: number;
  staleness: NoteStaleness;
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
