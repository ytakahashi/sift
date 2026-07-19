import { useCallback, useEffect, useMemo, useState } from 'react';
import { selectNotesForPath } from '../../../domain/notes/select-notes-for-path';
import type { Note } from '../../../domain/notes/types';

export interface UseNotesPanelOptions {
  notes: Note[];
  selectedFilePath: string | null;
}

export interface UseNotesPanelResult {
  isOpen: boolean;
  canOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  selectedFileNotes: Note[];
}

export function useNotesPanel({
  notes,
  selectedFilePath,
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

  const selectedFileNotes = useMemo(
    () => selectNotesForPath(notes, selectedFilePath),
    [notes, selectedFilePath],
  );

  return {
    isOpen,
    canOpen,
    open,
    close,
    toggle,
    selectedFileNotes,
  };
}
