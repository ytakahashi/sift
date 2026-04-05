import { useState, useCallback } from 'react';
import type { Note, NoteTarget } from '../../domain/notes/types';

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);

  const addNote = useCallback((target: NoteTarget, body: string) => {
    const newNote: Note = {
      id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
      target,
      body,
      createdAt: Date.now(),
    };
    setNotes((prev) => [...prev, newNote]);
  }, []);

  const updateNote = useCallback((id: string, body: string) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, body } : n)));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotes = useCallback(() => {
    setNotes([]);
  }, []);

  return {
    notes,
    addNote,
    updateNote,
    deleteNote,
    clearNotes,
  };
}
