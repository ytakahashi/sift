import type { ConfirmedFileGeneration, FileGeneration } from '../../domain/diff/file-generation';
import type { DiffFile } from '../../domain/diff/types';
import type { AnchoredNote } from '../../domain/notes/anchored-note';
import type { RepositoryId } from '../../domain/repository/repository';

/** The requested note does not exist. */
export class NoteNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteNotFoundError';
  }
}

/**
 * The creation target could not be resolved against the current diff:
 * file or line range not present, ambiguous across panes, or a submodule.
 * The kind provides a stable classification while the message guides human
 * recovery (e.g. suggesting a file note or an explicit bucket).
 */
export type NoteTargetResolutionKind = 'not-found' | 'ambiguous' | 'ineligible';

export class NoteTargetResolutionError extends Error {
  constructor(
    message: string,
    public readonly kind: NoteTargetResolutionKind,
  ) {
    super(message);
    this.name = 'NoteTargetResolutionError';
  }
}

/**
 * The request input is malformed. Covers every caller-supplied part of a notes
 * mutation, not just the body: missing body, unknown target kind, invalid
 * bucket, unsupported query parameters, ...
 */
export class NoteRequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteRequestValidationError';
  }
}

/**
 * The target file's worktree generation could not be determined at creation
 * time. Creation never stores an indeterminate anchor; the client should
 * retry with the same content (mapped to 503).
 */
export class NoteGenerationUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoteGenerationUnavailableError';
  }
}

export interface NoteAnchor {
  /** Worktree generation of the target file at creation time. */
  generation: ConfirmedFileGeneration;
  /** For line notes: contents of the anchored range (re-anchoring baseline). */
  lineContents?: string[];
}

/**
 * The parts of a note the caller supplies. The store owns identity (id,
 * createdAt) and the initial staleness, which is derived rather than chosen.
 */
export type NoteDraft = Omit<AnchoredNote, 'id' | 'createdAt' | 'staleness'>;

/** The repository state stored notes are validated against. */
export interface NotesCurrentState {
  workingFiles: DiffFile[];
  stagedFiles: DiffFile[];
  /** Current worktree generations keyed by repository-relative path. */
  generations: ReadonlyMap<string, FileGeneration>;
}

export interface DeleteStaleNotesResult {
  deletedCount: number;
  /** Reconcile or deletion changed stored records. */
  changed: boolean;
}

export interface NotesStore {
  /**
   * Revalidates stored notes against the current diff and worktree
   * generations: marks notes whose file changed or left the diff as stale, and
   * re-anchors line notes whose content moved between panes (delegated to
   * domain reconcileNotes). Notes are never removed here, so the stored count
   * only changes through explicit deletion. Returns whether any staleness or
   * anchor changed, so the caller can decide whether to notify subscribers.
   */
  reconcile(repoId: RepositoryId, current: NotesCurrentState): Promise<boolean>;
  list(repoId: RepositoryId): Promise<AnchoredNote[]>;
  add(repoId: RepositoryId, draft: NoteDraft, anchor: NoteAnchor): Promise<AnchoredNote>;
  updateBody(repoId: RepositoryId, noteId: string, body: string): Promise<AnchoredNote>;
  remove(repoId: RepositoryId, noteId: string): Promise<void>;
  clear(repoId: RepositoryId): Promise<void>;
  /**
   * Reconciles against `current` and removes exactly the notes that are stale
   * afterwards, keeping (and storing) the reconciled live ones. Staleness is
   * derived from the current state rather than stored, so restoring a file can
   * bring a note back to live; deciding and deleting must therefore happen
   * against one and the same state.
   *
   * Reconcile and deletion are a single indivisible operation per repository:
   * splitting them would let a concurrent mutation land between the two, so the
   * deleted set would no longer be the set that was judged. An implementation
   * backed by storage must use a transaction or an equivalent
   * compare-and-write.
   *
   * `changed` also covers a run that deleted nothing but re-anchored or
   * re-marked retained notes, so callers know when to notify subscribers.
   */
  deleteStale(repoId: RepositoryId, current: NotesCurrentState): Promise<DeleteStaleNotesResult>;
}
