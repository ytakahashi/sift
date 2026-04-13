import type { Note } from './types';

export function selectNotesForFile(notes: Note[], fileId: string | null): Note[] {
  if (!fileId) {
    return [];
  }

  return notes.filter((note) => note.target.fileId === fileId);
}
