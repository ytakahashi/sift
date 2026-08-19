import type { Note, NoteCreateTarget } from '../../../domain/notes/types';
import type { RepositoryId } from '../../../domain/repository/repository';
import { NotesActionError, type NotesGateway } from '../../application/ports';
import { readErrorMessage } from './errorResponse';

function notesUrl(repoId: RepositoryId, noteId?: string): string {
  const base = `/api/repositories/${encodeURIComponent(repoId)}/notes`;
  return noteId === undefined ? base : `${base}/${encodeURIComponent(noteId)}`;
}

async function requireOk(res: Response, fallback: string): Promise<Response> {
  if (!res.ok) {
    throw new NotesActionError(await readErrorMessage(res, fallback), res.status);
  }
  return res;
}

/**
 * Reads `deletedCount` out of the delete-stale response. Unlike the note
 * payloads, a wrong value here surfaces in no rendering that would expose it,
 * so the field is checked at the boundary instead of being asserted.
 */
function readDeletedCount(body: unknown): number {
  const count = (body as { deletedCount?: unknown } | null)?.deletedCount;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) {
    throw new NotesActionError('Invalid delete stale notes response', 200);
  }
  return count;
}

export const httpNotesGateway: NotesGateway = {
  async fetchNotes(repoId: RepositoryId): Promise<Note[]> {
    const res = await requireOk(await fetch(notesUrl(repoId)), 'Failed to fetch notes');
    const body = (await res.json()) as { notes: Note[] };
    return body.notes;
  },

  async addNote(repoId: RepositoryId, target: NoteCreateTarget, body: string): Promise<Note> {
    const res = await requireOk(
      await fetch(notesUrl(repoId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, body }),
      }),
      'Failed to add note',
    );
    return (await res.json()) as Note;
  },

  async updateNote(repoId: RepositoryId, noteId: string, body: string): Promise<Note> {
    const res = await requireOk(
      await fetch(notesUrl(repoId, noteId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }),
      'Failed to update note',
    );
    return (await res.json()) as Note;
  },

  async deleteNote(repoId: RepositoryId, noteId: string): Promise<void> {
    await requireOk(
      await fetch(notesUrl(repoId, noteId), { method: 'DELETE' }),
      'Failed to delete note',
    );
  },

  async clearNotes(repoId: RepositoryId): Promise<void> {
    await requireOk(await fetch(notesUrl(repoId), { method: 'DELETE' }), 'Failed to clear notes');
  },

  async deleteStaleNotes(repoId: RepositoryId): Promise<number> {
    const res = await requireOk(
      await fetch(`${notesUrl(repoId)}?staleness=stale`, { method: 'DELETE' }),
      'Failed to delete stale notes',
    );
    return readDeletedCount((await res.json().catch(() => null)) as unknown);
  },
};
