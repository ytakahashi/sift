import type { Note } from './types';

export function formatNoteLocation(
  note: Note,
  resolveFilePath: (fileId: string) => string,
): string {
  const path = resolveFilePath(note.target.fileId);
  if (note.target.kind === 'file') {
    return path;
  }
  const endSuffix =
    note.target.startNewLineNumber === note.target.endNewLineNumber
      ? ''
      : `-L${note.target.endNewLineNumber}`;
  return `${path}#L${note.target.startNewLineNumber}${endSuffix}`;
}

export function formatNoteForClipboard(
  note: Note,
  resolveFilePath: (fileId: string) => string,
): string {
  return `> ${formatNoteLocation(note, resolveFilePath)}\n${note.body}`;
}

export function formatNotesForClipboard(
  notes: Note[],
  resolveFilePath: (fileId: string) => string,
): string {
  return notes.map((note) => formatNoteForClipboard(note, resolveFilePath)).join('\n\n');
}
