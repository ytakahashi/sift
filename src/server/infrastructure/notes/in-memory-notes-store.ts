import { randomUUID } from 'node:crypto';
import type { AnchoredNote } from '../../../domain/notes/anchored-note';
import type { NoteReconcileRecord } from '../../../domain/notes/reconcile-notes';
import { reconcileNotes } from '../../../domain/notes/reconcile-notes';
import type { RepositoryId } from '../../../domain/repository/repository';
import type {
  DeleteStaleNotesResult,
  NoteAnchor,
  NoteDraft,
  NotesCurrentState,
  NotesStore,
} from '../../services/notes-store';
import { NoteNotFoundError } from '../../services/notes-store';

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
    // The draft is spread first so that the store's identity fields always
    // win: NoteDraft omits them, but structural typing lets a caller pass a
    // wider object (e.g. an existing AnchoredNote) that still carries them.
    const note: AnchoredNote = {
      ...draft,
      id: randomUUID(),
      createdAt: Date.now(),
      // Creation only succeeds once the target resolved against the current
      // diff, so a new note always starts out matching it.
      staleness: { kind: 'live' },
    };
    const record: NoteReconcileRecord = {
      note,
      generation: anchor.generation,
      lineContents: anchor.lineContents,
    };

    const existing = this.records.get(repoId) ?? [];
    this.records.set(repoId, [...existing, record]);
    return note;
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
    const remaining = existing.filter((record) => record.note.id !== noteId);
    if (remaining.length === existing.length) {
      throw new NoteNotFoundError(`Note not found: ${noteId}`);
    }
    this.records.set(repoId, remaining);
  }

  async clear(repoId: RepositoryId): Promise<void> {
    this.records.delete(repoId);
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
    const retained = result.records.filter((record) => record.note.staleness.kind !== 'stale');
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
