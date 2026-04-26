import { useCallback } from 'react';
import type { KeyboardEvent } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import { getFileListKeyAction, getNextSelectedIndex } from './file-list-navigation';

// Handles keyboard navigation and activation for a single FileList pane.
//
// Navigation (Arrow keys, Home, End): moves the selection within the list.
// When the selection would move past the first or last item, the boundary is
// signalled to the parent via onBoundaryNavigate so it can transfer focus to
// the adjacent pane.
//
// Activation (Enter): triggers the primary action (stage / unstage) on the
// currently selected file.
interface UseFileListControllerOptions {
  files: DiffFile[];
  selectedFileId: string | null;
  disabled: boolean;
  onSelect: (file: DiffFile) => void;
  onActivate: (file: DiffFile) => void;
  onBoundaryNavigate?: (direction: 'previous' | 'next') => void;
}

/**
 * Returns the index of the file matching `selectedFileId`, or -1 if not found.
 */
export function findSelectedIndex(files: DiffFile[], selectedFileId: string | null): number {
  if (!selectedFileId) {
    return -1;
  }

  return files.findIndex((file) => file.id === selectedFileId);
}

export function useFileListController({
  files,
  selectedFileId,
  disabled,
  onSelect,
  onActivate,
  onBoundaryNavigate,
}: UseFileListControllerOptions): { onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void } {
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
        // getNextSelectedIndex clamps at the list boundaries, so when the index
        // did not change the user has hit the edge of the pane. Only ArrowUp /
        // ArrowDown cross pane boundaries; Home / End always stay within the pane.
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
