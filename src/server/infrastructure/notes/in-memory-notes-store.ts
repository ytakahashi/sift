import { randomUUID } from 'node:crypto';
import type { AnchoredNote } from '../../../domain/notes/anchored-note';
import type { NoteReconcileRecord } from '../../../domain/notes/reconcile-notes';
import { reconcileNotes } from '../../../domain/notes/reconcile-notes';
import {
  isActiveReview,
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
  ReviewObservation,
  ReviewWaitOptions,
} from '../../services/notes-store';
import { NoteNotFoundError } from '../../services/notes-store';
import { ReviewParticipants } from './review-participants';

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
  private readonly participants = new ReviewParticipants();
  private readonly reviewWaiters = new Map<RepositoryId, Set<() => void>>();

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

  async add(
    repoId: RepositoryId,
    draft: NoteDraft,
    anchor: NoteAnchor,
    source: 'user' | 'mcp' = 'user',
  ): Promise<AnchoredNote> {
    const record = createRecord(
      { draft, anchor },
      source === 'user' ? { author: { role: 'user' } } : {},
    );
    const existing = this.records.get(repoId) ?? [];
    this.records.set(repoId, [...existing, record]);
    return record.note;
  }

  async getReview(repoId: RepositoryId): Promise<ReviewSession | undefined> {
    return this.reviews.get(repoId);
  }

  connectReviewParticipant(repoId: RepositoryId, participantId: string): () => boolean {
    const disconnect = this.participants.connect(repoId, participantId);
    return () => {
      const reviewId = disconnect();
      const current = this.reviews.get(repoId);
      // A paused review can still be resumed or approved after the user intervenes.
      if (!isActiveReview(current) || reviewId !== current.reviewId) {
        return false;
      }
      this.setReview(repoId, { ...current, state: 'peer-gone' });
      return true;
    };
  }

  async waitForReview(
    repoId: RepositoryId,
    { participantId, role, knownReviewId, waitMs }: ReviewWaitOptions,
    signal: AbortSignal,
  ): Promise<ReviewObservation> {
    signal.throwIfAborted();

    const observe = (): ReviewObservation => {
      const observedReviewId = this.participants.getObservedReview(repoId, participantId, role);
      const review = this.reviews.get(repoId);
      if (isActiveReview(review)) {
        this.participants.claim(repoId, participantId, review.reviewId, role);
        return { review, observedReviewId: review.reviewId };
      }
      return { review, observedReviewId };
    };

    const observation = observe();
    const current = observation.review;
    const active = isActiveReview(current);
    const waiting = active
      ? current.state === (role === 'reviewer' ? 'awaiting-response' : 'awaiting-review')
      : role === 'implementer' &&
        (!current ||
          (current.reviewId !== knownReviewId &&
            current.reviewId !== observation.observedReviewId));
    if (!waiting || waitMs === 0) {
      return observation;
    }

    return new Promise((resolve, reject) => {
      const waiters = this.reviewWaiters.get(repoId) ?? new Set<() => void>();
      const cleanup = (): void => {
        clearTimeout(timer);
        signal.removeEventListener('abort', abort);
        waiters.delete(readCurrent);
        if (waiters.size === 0) {
          this.reviewWaiters.delete(repoId);
        }
      };
      const readCurrent = (): void => {
        cleanup();
        try {
          resolve(observe());
        } catch (error: unknown) {
          reject(error);
        }
      };
      const abort = (): void => {
        cleanup();
        reject(signal.reason);
      };
      // No asynchronous work separates reading the current state from subscribing.
      const timer = setTimeout(readCurrent, waitMs);
      waiters.add(readCurrent);
      this.reviewWaiters.set(repoId, waiters);
      signal.addEventListener('abort', abort, { once: true });
    });
  }

  private setReview(repoId: RepositoryId, review: ReviewSession): void {
    this.reviews.set(repoId, review);
    this.reviewWaiters.get(repoId)?.forEach((readCurrent) => readCurrent());
  }

  async submitReview(
    repoId: RepositoryId,
    submission: ReviewSubmission,
    comments: readonly ReviewCommentDraft[],
    participantId?: string,
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
    // The role claim and the commit share one synchronous operation.
    if (participantId !== undefined) {
      this.participants.claim(repoId, participantId, transition.session.reviewId, 'reviewer');
    }
    this.records.set(repoId, records);
    this.setReview(repoId, transition.session);
    return transition.session;
  }

  async submitResponse(
    repoId: RepositoryId,
    submission: ReviewResponseSubmission,
    participantId?: string,
  ): Promise<ReviewSession> {
    const existing = this.records.get(repoId) ?? [];
    const transition = submitResponse(
      this.reviews.get(repoId),
      existing.map(({ note }) => note),
      submission,
    );
    if (participantId !== undefined) {
      this.participants.claim(repoId, participantId, transition.session.reviewId, 'implementer');
    }
    this.records.set(repoId, applyThreadChanges(existing, transition.changes));
    this.setReview(repoId, transition.session);
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
