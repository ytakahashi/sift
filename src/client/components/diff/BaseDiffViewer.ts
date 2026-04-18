import type { Note, NoteTarget } from '../../../domain/notes/types';
import type { DiffFile } from '../../../domain/diff/types';

export interface BaseDiffViewerProps {
  file: DiffFile;
  paneMode: 'working' | 'staged';
  onStageHunk?: (hunkId: string) => void;
  onUnstageHunk?: (hunkId: string) => void;
  notes?: Note[];
  onAddNote?: (target: NoteTarget, body: string) => void;
  onUpdateNote?: (id: string, body: string) => void;
  onDeleteNote?: (id: string) => void;
  resolveFilePath?: (fileId: string) => string;
}
