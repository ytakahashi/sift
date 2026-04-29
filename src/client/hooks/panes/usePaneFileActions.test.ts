import { act, renderHook, waitFor } from '@testing-library/react';
import type { RenderHookResult } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import type { FileActionResult } from '../../application/panes/pane-action';
import type { PaneMode } from './useFileSelection';
import { usePaneFileActions } from './usePaneFileActions';
import type { UsePaneFileActionsResult } from './usePaneFileActions';

type BulkPaneAction = (previouslySelectedFile: DiffFile | null) => Promise<FileActionResult>;

function createFile(id: string, bucket: 'working' | 'staged'): DiffFile {
  return {
    id,
    bucket,
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath: `${id}.ts`,
    hunks: [],
  };
}

function renderPaneFileActions({
  selectedFile,
  paneMode,
  discardAllOverride,
}: {
  selectedFile: DiffFile | null;
  paneMode: PaneMode;
  discardAllOverride?: BulkPaneAction;
}): RenderHookResult<UsePaneFileActionsResult, unknown> & {
  stage: ReturnType<typeof vi.fn>;
  unstage: ReturnType<typeof vi.fn>;
  discard: ReturnType<typeof vi.fn>;
  stageAll: ReturnType<typeof vi.fn>;
  unstageAll: ReturnType<typeof vi.fn>;
  discardAll: BulkPaneAction;
  applyActionResult: ReturnType<typeof vi.fn>;
} {
  const stage = vi.fn(async (file: DiffFile) => ({ nextSelectedFile: file }));
  const unstage = vi.fn(async (file: DiffFile) => ({ nextSelectedFile: file }));
  const discard = vi.fn(async (file: DiffFile) => ({ nextSelectedFile: file }));
  const stageAll = vi.fn(async (file: DiffFile | null) => ({ nextSelectedFile: file }));
  const unstageAll = vi.fn(async (file: DiffFile | null) => ({ nextSelectedFile: file }));
  const discardAll =
    discardAllOverride ?? vi.fn(async (file: DiffFile | null) => ({ nextSelectedFile: file }));
  const applyActionResult = vi.fn();

  const hook = renderHook(() =>
    usePaneFileActions({
      selectedFile,
      paneMode,
      stage,
      unstage,
      discard,
      stageAll,
      unstageAll,
      discardAll,
      applyActionResult,
    }),
  );

  return {
    ...hook,
    stage,
    unstage,
    discard,
    stageAll,
    unstageAll,
    discardAll,
    applyActionResult,
  };
}

describe('usePaneFileActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stages a working file and applies the result to the working pane', async () => {
    // Given: a working file action hook
    const file = createFile('a', 'working');
    const { result, stage, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'working',
    });

    // When: the file is staged
    await act(async () => {
      await result.current.stageFile(file);
    });

    // Then: the stage result is applied to the working selection state
    expect(stage).toHaveBeenCalledWith(file);
    expect(applyActionResult).toHaveBeenCalledWith({ nextSelectedFile: file }, 'working');
  });

  it('unstages a staged file and applies the result to the staged pane', async () => {
    // Given: a staged file action hook
    const file = createFile('s', 'staged');
    const { result, unstage, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'staged',
    });

    // When: the file is unstaged
    await act(async () => {
      await result.current.unstageFile(file);
    });

    // Then: the unstage result is applied to the staged selection state
    expect(unstage).toHaveBeenCalledWith(file);
    expect(applyActionResult).toHaveBeenCalledWith({ nextSelectedFile: file }, 'staged');
  });

  it('discards a working file and keeps selection updates scoped to the working pane', async () => {
    // Given: a selected working file
    const file = createFile('a', 'working');
    const { result, discard, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'working',
    });

    // When: the file is discarded
    await act(async () => {
      await result.current.discardFile(file);
    });

    // Then: the discard result is applied to the working selection state
    expect(discard).toHaveBeenCalledWith(file);
    expect(applyActionResult).toHaveBeenCalledWith({ nextSelectedFile: file }, 'working');
  });

  it('toggles the selected file by staging from the working pane', async () => {
    // Given: the selected file belongs to the working pane
    const file = createFile('a', 'working');
    const { result, stage, unstage } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'working',
    });

    // When: the selected file stage state is toggled from the detail header
    act(() => {
      result.current.toggleSelectedFileStage();
    });

    // Then: activation dispatches the working-pane action
    await waitFor(() => expect(stage).toHaveBeenCalledWith(file));
    expect(unstage).not.toHaveBeenCalled();
  });

  it('toggles the selected file by unstaging from the staged pane', async () => {
    // Given: the selected file belongs to the staged pane
    const file = createFile('s', 'staged');
    const { result, stage, unstage } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'staged',
    });

    // When: the selected file stage state is toggled from the detail header
    act(() => {
      result.current.toggleSelectedFileStage();
    });

    // Then: activation dispatches the staged-pane action
    await waitFor(() => expect(unstage).toHaveBeenCalledWith(file));
    expect(stage).not.toHaveBeenCalled();
  });

  it('does nothing when activation is requested without a selected file', () => {
    // Given: there is no selected file
    const { result, stage, unstage } = renderPaneFileActions({
      selectedFile: null,
      paneMode: 'working',
    });

    // When: activation is requested
    act(() => {
      result.current.toggleSelectedFileStage();
    });

    // Then: no pane action is dispatched
    expect(stage).not.toHaveBeenCalled();
    expect(unstage).not.toHaveBeenCalled();
  });

  it('stages all working files and applies the result to the working pane', async () => {
    // Given: a selected working file
    const file = createFile('a', 'working');
    const { result, stageAll, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'working',
    });

    // When: all working files are staged
    await act(async () => {
      await result.current.stageAllWorkingFiles();
    });

    // Then: previous selection is passed through for failure rollback support
    expect(stageAll).toHaveBeenCalledWith(file);
    expect(applyActionResult).toHaveBeenCalledWith({ nextSelectedFile: file }, 'working');
  });

  it('does not clear staged selection when staging all working files from the inactive pane', async () => {
    // Given: the selected file belongs to the staged pane
    const file = createFile('s', 'staged');
    const { result, stageAll, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'staged',
    });

    // When: all working files are staged
    await act(async () => {
      await result.current.stageAllWorkingFiles();
    });

    // Then: the action runs without applying a working-pane selection change
    expect(stageAll).toHaveBeenCalledWith(null);
    expect(applyActionResult).not.toHaveBeenCalled();
  });

  it('unstages all staged files and applies the result to the staged pane', async () => {
    // Given: a selected staged file
    const file = createFile('s', 'staged');
    const { result, unstageAll, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'staged',
    });

    // When: all staged files are unstaged
    await act(async () => {
      await result.current.unstageAllStagedFiles();
    });

    // Then: previous selection is passed through for failure rollback support
    expect(unstageAll).toHaveBeenCalledWith(file);
    expect(applyActionResult).toHaveBeenCalledWith({ nextSelectedFile: file }, 'staged');
  });

  it('does not clear working selection when unstaging all staged files from the inactive pane', async () => {
    // Given: the selected file belongs to the working pane
    const file = createFile('a', 'working');
    const { result, unstageAll, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'working',
    });

    // When: all staged files are unstaged
    await act(async () => {
      await result.current.unstageAllStagedFiles();
    });

    // Then: the action runs without applying a staged-pane selection change
    expect(unstageAll).toHaveBeenCalledWith(null);
    expect(applyActionResult).not.toHaveBeenCalled();
  });

  it('asks for confirmation before discarding all working files', async () => {
    // Given: confirmation is accepted
    const confirmMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmMock);
    const file = createFile('a', 'working');
    const { result, discardAll } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'working',
    });

    // When: all working files are discarded
    await act(async () => {
      await result.current.discardAllWorkingFiles();
    });

    // Then
    expect(confirmMock).toHaveBeenCalledWith('Discard all working directory changes?');
    expect(discardAll).toHaveBeenCalledWith(file);
  });

  it('does not discard all working files when confirmation is cancelled', async () => {
    // Given: confirmation is cancelled
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const file = createFile('a', 'working');
    const { result, discardAll, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'working',
    });

    // When: all working files are discarded
    await act(async () => {
      await result.current.discardAllWorkingFiles();
    });

    // Then
    expect(discardAll).not.toHaveBeenCalled();
    expect(applyActionResult).not.toHaveBeenCalled();
  });

  it('preserves previous selection when discarding all working files fails', async () => {
    // Given: confirmation is accepted and the bulk discard action reports rollback selection
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    const file = createFile('a', 'working');
    const discardAllOverride = vi.fn(async () => ({ nextSelectedFile: file }));
    const { result, applyActionResult } = renderPaneFileActions({
      selectedFile: file,
      paneMode: 'working',
      discardAllOverride,
    });

    // When: all working files are discarded
    await act(async () => {
      await result.current.discardAllWorkingFiles();
    });

    // Then: the rollback selection is applied to the working pane
    expect(discardAllOverride).toHaveBeenCalledWith(file);
    expect(applyActionResult).toHaveBeenCalledWith({ nextSelectedFile: file }, 'working');
  });
});
