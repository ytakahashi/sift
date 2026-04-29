import type { Note } from './types';

export function formatNoteForClipboard(
  note: Note,
  resolveFilePath: (fileId: string) => string,
): string {
  const path = resolveFilePath(note.target.fileId);
  if (note.target.kind === 'file') {
    return `> ${path}\n${note.body}`;
  }
  return `> ${path}#L${note.target.startNewLineNumber}\n${note.body}`;
}

export function formatNotesForClipboard(
  notes: Note[],
  resolveFilePath: (fileId: string) => string,
): string {
  return notes.map((note) => formatNoteForClipboard(note, resolveFilePath)).join('\n\n');
}
