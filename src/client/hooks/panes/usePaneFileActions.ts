import { useCallback } from 'react';
import type { DiffFile } from '../../../domain/diff/types';
import type { FileActionResult } from '../../application/panes/pane-action';
import type { DiscardConfirmRequest } from '../../application/discard-confirm/discard-confirm-request';
import type { PaneMode } from './useFileSelection';

interface UsePaneFileActionsOptions {
  selectedFile: DiffFile | null;
  paneMode: PaneMode;
  stage: (file: DiffFile) => Promise<FileActionResult>;
  unstage: (file: DiffFile) => Promise<FileActionResult>;
  discard: (file: DiffFile) => Promise<FileActionResult>;
  stageAll: (previouslySelectedFile: DiffFile | null) => Promise<FileActionResult>;
  unstageAll: (previouslySelectedFile: DiffFile | null) => Promise<FileActionResult>;
  discardAll: (previouslySelectedFile: DiffFile | null) => Promise<FileActionResult>;
  applyActionResult: (result: FileActionResult, pane: PaneMode) => void;
  requestConfirmation: (req: DiscardConfirmRequest) => void;
}

export interface UsePaneFileActionsResult {
  stageFile: (file: DiffFile) => Promise<void>;
  unstageFile: (file: DiffFile) => Promise<void>;
  discardFile: (file: DiffFile) => void;
  stageAllWorkingFiles: () => Promise<void>;
  unstageAllStagedFiles: () => Promise<void>;
  discardAllWorkingFiles: () => void;
  toggleSelectedFileStage: () => void;
}

export function usePaneFileActions({
  selectedFile,
  paneMode,
  stage,
  unstage,
  discard,
  stageAll,
  unstageAll,
  discardAll,
  applyActionResult,
  requestConfirmation,
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
    (file: DiffFile): void => {
      requestConfirmation({
        mode: 'single',
        fileName: file.displayPath,
        onConfirm: async () => {
          const result = await discard(file);
          applyActionResult(result, 'working');
        },
      });
    },
    [discard, applyActionResult, requestConfirmation],
  );

  const stageAllWorkingFiles = useCallback(async (): Promise<void> => {
    const result = await stageAll(paneMode === 'working' ? selectedFile : null);
    if (paneMode === 'working') {
      applyActionResult(result, 'working');
    }
  }, [applyActionResult, paneMode, selectedFile, stageAll]);

  const unstageAllStagedFiles = useCallback(async (): Promise<void> => {
    const result = await unstageAll(paneMode === 'staged' ? selectedFile : null);
    if (paneMode === 'staged') {
      applyActionResult(result, 'staged');
    }
  }, [applyActionResult, paneMode, selectedFile, unstageAll]);

  const discardAllWorkingFiles = useCallback((): void => {
    requestConfirmation({
      mode: 'all',
      onConfirm: async () => {
        const result = await discardAll(paneMode === 'working' ? selectedFile : null);
        if (paneMode === 'working') {
          applyActionResult(result, 'working');
        }
      },
    });
  }, [applyActionResult, discardAll, paneMode, selectedFile, requestConfirmation]);

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
    stageAllWorkingFiles,
    unstageAllStagedFiles,
    discardAllWorkingFiles,
    toggleSelectedFileStage,
  };
}
