import { randomUUID } from 'node:crypto';
import type { AnchoredNote } from '../../../domain/notes/anchored-note';
import type { NoteReconcileRecord } from '../../../domain/notes/reconcile-notes';
import { reconcileNotes } from '../../../domain/notes/reconcile-notes';
import {
  isProtectedReviewThread,
  ReviewConflict,
  submitResponse,
  submitReview,
  type ReviewResponseSubmission,
  type ReviewSession,
  type ReviewSubmission,
} from '../../../domain/notes/review-session';
import type { NoteMetadata } from '../../../domain/notes/types';
import type { RepositoryId } from '../../../domain/repository/repository';
import type {
  DeleteStaleNotesResult,
  NoteAnchor,
  NoteDraft,
  NotesCurrentState,
  NotesStore,
  ReviewCommentDraft,
} from '../../services/notes-store';
import { NoteNotFoundError } from '../../services/notes-store';

function createRecord(
  { draft, anchor }: ReviewCommentDraft,
  metadata: NoteMetadata,
): NoteReconcileRecord {
  return {
    note: {
      path: draft.path,
      target: draft.target,
      body: draft.body,
      ...metadata,
      id: randomUUID(),
      createdAt: Date.now(),
      staleness: { kind: 'live' },
    },
    generation: anchor.generation,
    lineContents: anchor.lineContents,
  };
}

function applyThreadChanges(
  records: readonly NoteReconcileRecord[],
  changes: ReadonlyMap<string, Pick<NoteMetadata, 'status' | 'replies'>>,
): NoteReconcileRecord[] {
  return records.map((record) => {
    const update = changes.get(record.note.id);
    return update ? { ...record, note: { ...record.note, ...update } } : record;
  });
}

/**
 * In-memory notes store, keyed by repository id.
 *
 * Notes are deliberately not persisted: before the server-side move they only
 * lived in browser memory, so surviving until server shutdown is already an
 * improvement. Swapping in a persistent implementation only requires
 * replacing this class behind the NotesStore port.
 *
 * The anchor (creation-time generation and line contents) is recorded per
 * note, so notes created at different times are each validated against their
 * own baseline.
 */
export class InMemoryNotesStore implements NotesStore {
  private readonly records = new Map<RepositoryId, NoteReconcileRecord[]>();
  private readonly reviews = new Map<RepositoryId, ReviewSession>();

  async reconcile(repoId: RepositoryId, current: NotesCurrentState): Promise<boolean> {
    const existing = this.records.get(repoId);
    if (!existing || existing.length === 0) {
      return false;
    }

    const result = reconcileNotes({
      records: existing,
      workingFiles: current.workingFiles,
      stagedFiles: current.stagedFiles,
      generations: current.generations,
    });

    if (result.changed) {
      this.records.set(repoId, result.records);
    }
    return result.changed;
  }

  async list(repoId: RepositoryId): Promise<AnchoredNote[]> {
    return (this.records.get(repoId) ?? []).map((record) => record.note);
  }

  async add(repoId: RepositoryId, draft: NoteDraft, anchor: NoteAnchor): Promise<AnchoredNote> {
    const record = createRecord({ draft, anchor }, { author: { role: 'user' } });
    const existing = this.records.get(repoId) ?? [];
    this.records.set(repoId, [...existing, record]);
    return record.note;
  }

  async getReview(repoId: RepositoryId): Promise<ReviewSession | undefined> {
    return this.reviews.get(repoId);
  }

  async submitReview(
    repoId: RepositoryId,
    submission: ReviewSubmission,
    comments: readonly ReviewCommentDraft[],
  ): Promise<ReviewSession> {
    const existing = this.records.get(repoId) ?? [];
    const transition = submitReview(
      this.reviews.get(repoId),
      existing.map(({ note }) => note),
      submission,
      randomUUID(),
    );
    const records = [
      ...applyThreadChanges(existing, transition.changes),
      ...comments.map((comment) => createRecord(comment, transition.newThread)),
    ];
    // Validation, thread writes and the turn change share one synchronous operation.
    this.records.set(repoId, records);
    this.reviews.set(repoId, transition.session);
    return transition.session;
  }

  async submitResponse(
    repoId: RepositoryId,
    submission: ReviewResponseSubmission,
  ): Promise<ReviewSession> {
    const existing = this.records.get(repoId) ?? [];
    const transition = submitResponse(
      this.reviews.get(repoId),
      existing.map(({ note }) => note),
      submission,
    );
    this.records.set(repoId, applyThreadChanges(existing, transition.changes));
    this.reviews.set(repoId, transition.session);
    return transition.session;
  }

  async updateBody(repoId: RepositoryId, noteId: string, body: string): Promise<AnchoredNote> {
    const existing = this.records.get(repoId) ?? [];
    const index = existing.findIndex((record) => record.note.id === noteId);
    if (index < 0) {
      throw new NoteNotFoundError(`Note not found: ${noteId}`);
    }

    const updated: NoteReconcileRecord = {
      ...existing[index],
      note: { ...existing[index].note, body },
    };
    const next = [...existing];
    next[index] = updated;
    this.records.set(repoId, next);
    return updated.note;
  }

  async remove(repoId: RepositoryId, noteId: string): Promise<void> {
    const existing = this.records.get(repoId) ?? [];
    const note = existing.find((record) => record.note.id === noteId)?.note;
    if (note === undefined) {
      throw new NoteNotFoundError(`Note not found: ${noteId}`);
    }
    if (isProtectedReviewThread(note, this.reviews.get(repoId))) {
      throw new ReviewConflict('Threads in a review that can continue cannot be deleted.');
    }
    this.records.set(
      repoId,
      existing.filter((record) => record.note.id !== noteId),
    );
  }

  async clear(repoId: RepositoryId): Promise<void> {
    const review = this.reviews.get(repoId);
    const threads = (this.records.get(repoId) ?? []).filter(({ note }) =>
      isProtectedReviewThread(note, review),
    );
    if (threads.length === 0) {
      this.records.delete(repoId);
    } else {
      this.records.set(repoId, threads);
    }
  }

  async deleteStale(
    repoId: RepositoryId,
    current: NotesCurrentState,
  ): Promise<DeleteStaleNotesResult> {
    const existing = this.records.get(repoId);
    if (!existing || existing.length === 0) {
      return { deletedCount: 0, changed: false };
    }

    // Everything below is computed synchronously and written back in a single
    // step, so no other mutation can observe or interleave with the state
    // between judging and deleting (see NotesStore.deleteStale).
    const result = reconcileNotes({
      records: existing,
      workingFiles: current.workingFiles,
      stagedFiles: current.stagedFiles,
      generations: current.generations,
    });
    const review = this.reviews.get(repoId);
    const retained = result.records.filter(
      ({ note }) => isProtectedReviewThread(note, review) || note.staleness.kind !== 'stale',
    );
    const deletedCount = result.records.length - retained.length;

    if (deletedCount === 0) {
      if (result.changed) {
        this.records.set(repoId, result.records);
      }
      return { deletedCount: 0, changed: result.changed };
    }

    if (retained.length === 0) {
      // Normalize to the same empty state clear() leaves behind.
      this.records.delete(repoId);
    } else {
      this.records.set(repoId, retained);
    }
    return { deletedCount, changed: true };
  }
}
