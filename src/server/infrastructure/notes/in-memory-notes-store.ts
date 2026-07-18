import { randomUUID } from 'node:crypto';
import type { FileGeneration } from '../../../domain/diff/file-generation';
import type { DiffFile } from '../../../domain/diff/types';
import type { NoteReconcileRecord } from '../../../domain/notes/reconcile-notes';
import { reconcileNotes } from '../../../domain/notes/reconcile-notes';
import type { Note, NoteTarget } from '../../../domain/notes/types';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { NoteAnchor, NotesStore } from '../../services/notes-store';
import { NoteNotFoundError } from '../../services/notes-store';

/**
 * In-memory notes store, keyed by repository id.
 *
 * Notes are deliberately not persisted: before the server-side move they only
 * lived in browser memory, so surviving until server shutdown is already an
 * improvement. Swapping in a persistent implementation only requires
 * replacing this class behind the NotesStore port.
 *
 * The anchor (creation-time generation and line content) is recorded per
 * note, so notes created at different times are each validated against their
 * own baseline.
 */
export class InMemoryNotesStore implements NotesStore {
  private readonly records = new Map<RepositoryId, NoteReconcileRecord[]>();

  async reconcile(
    repoId: RepositoryId,
    current: {
      workingFiles: DiffFile[];
      stagedFiles: DiffFile[];
      generations: ReadonlyMap<string, FileGeneration>;
    },
  ): Promise<boolean> {
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

  async list(repoId: RepositoryId): Promise<Note[]> {
    return (this.records.get(repoId) ?? []).map((record) => record.note);
  }

  async add(
    repoId: RepositoryId,
    target: NoteTarget,
    body: string,
    anchor: NoteAnchor,
  ): Promise<Note> {
    const note: Note = {
      id: randomUUID(),
      target,
      body,
      createdAt: Date.now(),
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

  async updateBody(repoId: RepositoryId, noteId: string, body: string): Promise<Note> {
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
}
