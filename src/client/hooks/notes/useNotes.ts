import { useCallback, useEffect, useRef, useState } from 'react';
import type { Note, NoteCreateTarget } from '../../../domain/notes/types';
import type { RepositoryId } from '../../../domain/repository/repository';
import type { NotesGateway } from '../../application/ports';

export interface UseNotesResult {
  notes: Note[];
  /**
   * Editor-bound mutations (add/update) reject on failure so the editor can
   * keep the draft and show the server message inline; they never write the
   * shared `error` state.
   */
  addNote: (target: NoteCreateTarget, body: string) => Promise<void>;
  updateNote: (noteId: string, body: string) => Promise<void>;
  /**
   * Input-less mutations (delete/clear) have no editor to report into, so
   * failures land in `error` (page banner) and the promise resolves normally.
   */
  deleteNote: (noteId: string) => Promise<void>;
  clearNotes: () => Promise<void>;
  /** Re-reads the server-side (reconciled) notes; used by SSE and diff refresh. */
  refetchNotes: () => Promise<void>;
  mutating: boolean;
  error: string | null;
}

/**
 * Server-backed notes state. The server store is the single source of truth:
 * every mutation is followed by a refetch instead of optimistic updates, so
 * the UI always shows the reconciled result (including discards and
 * re-anchoring that happened server-side during the request).
 */
export function useNotes(notesGateway: NotesGateway, repoId: RepositoryId): UseNotesResult {
  const [notes, setNotes] = useState<Note[]>([]);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Drops out-of-order fetch results (overlapping refetches from SSE bursts).
  const fetchSeqRef = useRef(0);

  const refetchNotes = useCallback(async (): Promise<void> => {
    const seq = ++fetchSeqRef.current;
    try {
      const fetched = await notesGateway.fetchNotes(repoId);
      if (fetchSeqRef.current === seq) {
        setNotes(fetched);
        // A successful sync clears the banner: keeping a stale failure
        // message up after recovery would misreport the current state.
        setError(null);
      }
    } catch (fetchError: unknown) {
      if (fetchSeqRef.current === seq) {
        setError(fetchError instanceof Error ? fetchError.message : String(fetchError));
      }
    }
  }, [notesGateway, repoId]);

  // Initial load: synchronizes with the server-side store (an external
  // system); setState only happens after the fetch resolves, not synchronously.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    void refetchNotes();
  }, [refetchNotes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const addNote = useCallback(
    async (target: NoteCreateTarget, body: string): Promise<void> => {
      setMutating(true);
      try {
        await notesGateway.addNote(repoId, target, body);
        await refetchNotes();
      } finally {
        setMutating(false);
      }
    },
    [notesGateway, refetchNotes, repoId],
  );

  const updateNote = useCallback(
    async (noteId: string, body: string): Promise<void> => {
      setMutating(true);
      try {
        await notesGateway.updateNote(repoId, noteId, body);
        await refetchNotes();
      } finally {
        setMutating(false);
      }
    },
    [notesGateway, refetchNotes, repoId],
  );

  const deleteNote = useCallback(
    async (noteId: string): Promise<void> => {
      setMutating(true);
      setError(null);
      try {
        await notesGateway.deleteNote(repoId, noteId);
        await refetchNotes();
      } catch (deleteError: unknown) {
        setError(deleteError instanceof Error ? deleteError.message : String(deleteError));
      } finally {
        setMutating(false);
      }
    },
    [notesGateway, refetchNotes, repoId],
  );

  const clearNotes = useCallback(async (): Promise<void> => {
    setMutating(true);
    setError(null);
    try {
      await notesGateway.clearNotes(repoId);
      await refetchNotes();
    } catch (clearError: unknown) {
      setError(clearError instanceof Error ? clearError.message : String(clearError));
    } finally {
      setMutating(false);
    }
  }, [notesGateway, refetchNotes, repoId]);

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    clearNotes,
    refetchNotes,
    mutating,
    error,
  };
}
