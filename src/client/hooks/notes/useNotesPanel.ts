import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  resolveNoteFilePath,
  type NotePathResolvableFile,
} from '../../../domain/notes/resolve-note-file-path';
import { selectNotesForFile } from '../../../domain/notes/select-notes-for-file';
import type { Note } from '../../../domain/notes/types';

export interface UseNotesPanelOptions {
  notes: Note[];
  workingFiles: NotePathResolvableFile[];
  stagedFiles: NotePathResolvableFile[];
  selectedFileId: string | null;
}

export interface UseNotesPanelResult {
  isOpen: boolean;
  canOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  resolveFilePath: (fileId: string) => string;
  selectedFileNotes: Note[];
}

export function useNotesPanel({
  notes,
  workingFiles,
  stagedFiles,
  selectedFileId,
}: UseNotesPanelOptions): UseNotesPanelResult {
  const [isOpen, setIsOpen] = useState(false);

  // Close notes panel when notes are externally cleared.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen && notes.length === 0) {
      setIsOpen(false);
    }
  }, [isOpen, notes.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canOpen = notes.length > 0;

  const open = useCallback(() => {
    if (!canOpen) {
      return;
    }
    setIsOpen(true);
  }, [canOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    if (!canOpen) {
      return;
    }
    setIsOpen((current) => !current);
  }, [canOpen]);

  const resolveFilePath = useCallback(
    (fileId: string) => resolveNoteFilePath(fileId, workingFiles, stagedFiles),
    [workingFiles, stagedFiles],
  );

  const selectedFileNotes = useMemo(
    () => selectNotesForFile(notes, selectedFileId),
    [notes, selectedFileId],
  );

  return {
    isOpen,
    canOpen,
    open,
    close,
    toggle,
    resolveFilePath,
    selectedFileNotes,
  };
}
