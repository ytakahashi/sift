import type { Note } from '../../../domain/notes/types';
import type { DiffFile } from '../../../domain/diff/types';
import type { NoteCreateTarget } from '../../application/ports';

export interface BaseDiffViewerProps {
  file: DiffFile;
  paneMode: 'working' | 'staged';
  onStageHunk?: (hunkId: string) => void;
  onUnstageHunk?: (hunkId: string) => void;
  notes?: Note[];
  /**
   * Notes are created by path + inclusive line range; fileId/hunkId/bucket
   * resolution happens on the server so UI- and agent-created notes share one
   * code path. The promises resolve after persistence: editors close only on
   * success.
   */
  onAddNote?: (target: NoteCreateTarget, body: string) => Promise<void>;
  onUpdateNote?: (id: string, body: string) => Promise<void>;
  onDeleteNote?: (id: string) => Promise<void>;
  /** Disables note Delete buttons while another notes mutation is in flight. */
  notesDeleteDisabled?: boolean;
  resolveFilePath: (fileId: string) => string;
  isFileNoteEditorOpen?: boolean;
  onCloseFileNoteEditor?: () => void;
}
