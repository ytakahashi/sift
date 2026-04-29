export type LineNoteTarget = {
  kind: 'line';
  /** The file the note belongs to */
  fileId: string;
  /** The hunk the note belongs to (optional, depending on whether we need it for applying patches) */
  hunkId: string;
  /** Range of lines for the note (new file side). For MVP, start === end. */
  startNewLineNumber: number;
  endNewLineNumber: number;
};

export type FileNoteTarget = {
  kind: 'file';
  /** The file the note belongs to */
  fileId: string;
};

export type NoteTarget = LineNoteTarget | FileNoteTarget;

export type Note = {
  id: string;
  target: NoteTarget;
  body: string;
  createdAt: number;
};
