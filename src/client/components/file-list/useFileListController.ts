import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import { getFileListKeyAction, getNextSelectedIndex } from './file-list-navigation';
import { findSelectedIndex } from './file-list-selection';

interface UseFileListControllerOptions {
  files: DiffFile[];
  selectedFileId: string | null;
  disabled: boolean;
  onSelect: (file: DiffFile) => void;
  onActivate: (file: DiffFile) => void;
  onBoundaryNavigate?: (direction: 'previous' | 'next') => void;
}

export function useFileListController({
  files,
  selectedFileId,
  disabled,
  onSelect,
  onActivate,
  onBoundaryNavigate,
}: UseFileListControllerOptions) {
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const action = getFileListKeyAction(event.key);
      if (!action) {
        return;
      }

      event.preventDefault();

      const selectedIndex = findSelectedIndex(files, selectedFileId);

      if (action === 'activate') {
        if (!disabled && selectedIndex >= 0) {
          onActivate(files[selectedIndex]);
        }
        return;
      }

      const nextIndex = getNextSelectedIndex(files.length, selectedIndex, action);
      if (nextIndex >= 0) {
        if (nextIndex === selectedIndex && (action === 'previous' || action === 'next')) {
          onBoundaryNavigate?.(action);
          return;
        }
        onSelect(files[nextIndex]);
      }
    },
    [disabled, files, onActivate, onBoundaryNavigate, onSelect, selectedFileId],
  );

  return { onKeyDown };
}
