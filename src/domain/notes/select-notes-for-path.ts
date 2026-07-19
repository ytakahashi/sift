import type { Note } from './types';

export function selectNotesForPath(notes: Note[], path: string | null): Note[] {
  if (!path) {
    return [];
  }

  return notes.filter((note) => note.path === path);
}
