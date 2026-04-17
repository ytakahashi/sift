import { useCallback } from 'react';
import type { DiffFile } from '../../domain/diff/types';
import type { FileActionResult } from './pane-action';
import type { PaneMode } from './useFileSelection';

interface UsePaneFileActionsOptions {
  selectedFile: DiffFile | null;
  paneMode: PaneMode;
  stage: (file: DiffFile) => Promise<FileActionResult>;
  unstage: (file: DiffFile) => Promise<FileActionResult>;
  discard: (file: DiffFile) => Promise<FileActionResult>;
  applyActionResult: (result: FileActionResult, pane: PaneMode) => void;
}

export interface UsePaneFileActionsResult {
  stageFile: (file: DiffFile) => Promise<void>;
  unstageFile: (file: DiffFile) => Promise<void>;
  discardFile: (file: DiffFile) => Promise<void>;
  toggleSelectedFileStage: () => void;
}

export function usePaneFileActions({
  selectedFile,
  paneMode,
  stage,
  unstage,
  discard,
  applyActionResult,
}: UsePaneFileActionsOptions): UsePaneFileActionsResult {
  const stageFile = useCallback(
    async (file: DiffFile): Promise<void> => {
      const result = await stage(file);
      applyActionResult(result, 'working');
    },
    [stage, applyActionResult],
  );

  const unstageFile = useCallback(
    async (file: DiffFile): Promise<void> => {
      const result = await unstage(file);
      applyActionResult(result, 'staged');
    },
    [unstage, applyActionResult],
  );

  const discardFile = useCallback(
    async (file: DiffFile): Promise<void> => {
      // Intentionally no confirmation dialog for now to keep parity with other
      // immediate actions. A future UX pass may add a confirmation step here.
      const result = await discard(file);
      applyActionResult(result, 'working');
    },
    [discard, applyActionResult],
  );

  const toggleSelectedFileStage = useCallback(() => {
    if (!selectedFile) return;
    if (paneMode === 'working') {
      void stageFile(selectedFile);
    } else {
      void unstageFile(selectedFile);
    }
  }, [stageFile, unstageFile, paneMode, selectedFile]);

  return {
    stageFile,
    unstageFile,
    discardFile,
    toggleSelectedFileStage,
  };
}
