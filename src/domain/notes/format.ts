import { Note } from './types';

export function formatNotesForClipboard(
  notes: Note[],
  resolveFilePath: (fileId: string) => string,
): string {
  return notes
    .map((note) => {
      const path = resolveFilePath(note.target.fileId);
      return `> ${path}#L${note.target.startNewLineNumber}\n${note.body}`;
    })
    .join('\n\n');
}
