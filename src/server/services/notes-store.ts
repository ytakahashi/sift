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

/** The request body is malformed (missing body, unknown kind, invalid bucket, ...). */
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

export interface NotesStore {
  /**
   * Revalidates stored notes against the current diff and worktree
   * generations: marks notes whose file changed or left the diff as stale, and
   * re-anchors line notes whose content moved between panes (delegated to
   * domain reconcileNotes). Notes are never removed here, so the stored count
   * only changes through explicit deletion. Returns whether any staleness or
   * anchor changed, so the caller can decide whether to notify subscribers.
   */
  reconcile(
    repoId: RepositoryId,
    current: {
      workingFiles: DiffFile[];
      stagedFiles: DiffFile[];
      /** Current worktree generations keyed by repository-relative path. */
      generations: ReadonlyMap<string, FileGeneration>;
    },
  ): Promise<boolean>;
  list(repoId: RepositoryId): Promise<AnchoredNote[]>;
  add(repoId: RepositoryId, draft: NoteDraft, anchor: NoteAnchor): Promise<AnchoredNote>;
  updateBody(repoId: RepositoryId, noteId: string, body: string): Promise<AnchoredNote>;
  remove(repoId: RepositoryId, noteId: string): Promise<void>;
  clear(repoId: RepositoryId): Promise<void>;
}
