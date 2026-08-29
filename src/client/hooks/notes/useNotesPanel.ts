import { useCallback, useMemo, useState } from 'react';
import { selectNotesForPath } from '../../../domain/notes/select-notes-for-path';
import type { Note } from '../../../domain/notes/types';

export interface UseNotesPanelOptions {
  notes: Note[];
  selectedFilePath: string | null;
}

export interface UseNotesPanelResult {
  isOpen: boolean;
  close: () => void;
  toggle: () => void;
  selectedFileNotes: Note[];
}

export function useNotesPanel({
  notes,
  selectedFilePath,
}: UseNotesPanelOptions): UseNotesPanelResult {
  const [isOpen, setIsOpen] = useState(false);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((current) => !current);
  }, []);

  const selectedFileNotes = useMemo(
    () => selectNotesForPath(notes, selectedFilePath),
    [notes, selectedFilePath],
  );

  return {
    isOpen,
    close,
    toggle,
    selectedFileNotes,
  };
}
