import { useCallback, useEffect, useState } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import type { FileActionResult } from '../../application/panes/pane-action';

export type PaneMode = 'working' | 'staged';

export interface UseFileSelectionResult {
  selectedFile: DiffFile | null;
  paneMode: PaneMode;
  /** Selects a file and activates its pane (e.g. on single click). */
  select: (file: DiffFile, pane: PaneMode) => void;
  /**
   * Applies the result returned by a pane hook action (stage / unstage).
   *
   * `nextSelectedFile` may be null when the pane becomes empty after the
   * action, in which case the selection is cleared.
   */
  applyActionResult: (result: FileActionResult, pane: PaneMode) => void;
  /**
   * Handles cross-pane keyboard navigation.
   *
   * The sidebar layout places Working Directory above Staged Changes, so
   * ArrowDown past the last working file jumps to the first staged file, and
   * ArrowUp past the first staged file jumps to the last working file. The
   * opposite directions have no adjacent pane to jump to and are ignored.
   */
  handleBoundaryNavigate: (pane: PaneMode, direction: 'previous' | 'next') => void;
}

export function useFileSelection(
  workingFiles: DiffFile[],
  stagedFiles: DiffFile[],
): UseFileSelectionResult {
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null);
  const [paneMode, setPaneMode] = useState<PaneMode>('working');

  // Keep the selected-file reference in sync with the current file lists.
  // After a server refresh the same logical file may be a new object, so we
  // replace the stale reference with the updated one. If the file no longer
  // exists in the list (e.g. it was moved to another pane by another process),
  // we clear the selection so the diff viewer does not show stale content.
  //
  // Both setState calls inside this effect are intentional responses to external
  // (server) state changes, not triggerable from within React itself.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedFile) {
      return;
    }

    const targetList = paneMode === 'working' ? workingFiles : stagedFiles;
    const updatedFile = targetList.find((file) => file.id === selectedFile.id);
    if (updatedFile) {
      if (updatedFile !== selectedFile) {
        setSelectedFile(updatedFile);
      }
      return;
    }

    setSelectedFile(null);
  }, [paneMode, selectedFile, workingFiles, stagedFiles]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const select = useCallback((file: DiffFile, pane: PaneMode) => {
    setSelectedFile(file);
    setPaneMode(pane);
  }, []);

  const applyActionResult = useCallback((result: FileActionResult, pane: PaneMode) => {
    setSelectedFile(result.nextSelectedFile);
    setPaneMode(pane);
  }, []);

  const handleBoundaryNavigate = useCallback(
    (pane: PaneMode, direction: 'previous' | 'next') => {
      if (pane === 'staged' && direction === 'previous' && workingFiles.length > 0) {
        setPaneMode('working');
        setSelectedFile(workingFiles[workingFiles.length - 1]);
        return;
      }

      if (pane === 'working' && direction === 'next' && stagedFiles.length > 0) {
        setPaneMode('staged');
        setSelectedFile(stagedFiles[0]);
      }
    },
    [stagedFiles, workingFiles],
  );

  return { selectedFile, paneMode, select, applyActionResult, handleBoundaryNavigate };
}
