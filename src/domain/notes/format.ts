import type { Note } from './types';

export function formatNoteLocation(note: Note): string {
  if (note.kind === 'file') {
    return note.path;
  }
  const endSuffix = note.startLine === note.endLine ? '' : `-L${note.endLine}`;
  return `${note.path}#L${note.startLine}${endSuffix}`;
}

export function formatNoteForClipboard(note: Note): string {
  return `> ${formatNoteLocation(note)}\n${note.body}`;
}

export function formatNotesForClipboard(notes: Note[]): string {
  return notes.map((note) => formatNoteForClipboard(note)).join('\n\n');
}
