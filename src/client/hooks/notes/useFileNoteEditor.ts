import { useCallback, useState } from 'react';

export interface UseFileNoteEditorResult {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

export function useFileNoteEditor(selectedFileId: string | null): UseFileNoteEditorResult {
  const [openForFileId, setOpenForFileId] = useState<string | null>(null);
  const isOpen = openForFileId !== null && openForFileId === selectedFileId;

  const open = useCallback(() => {
    if (!selectedFileId) {
      return;
    }
    setOpenForFileId(selectedFileId);
  }, [selectedFileId]);

  const close = useCallback(() => {
    setOpenForFileId(null);
  }, []);

  return {
    isOpen,
    open,
    close,
  };
}
