import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
import type { PaneMode } from './useFileSelection';
import { usePaneFileActions } from './usePaneFileActions';

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
}: {
  selectedFile: DiffFile | null;
  paneMode: PaneMode;
}) {
  const stage = vi.fn(async (file: DiffFile) => ({ nextSelectedFile: file }));
  const unstage = vi.fn(async (file: DiffFile) => ({ nextSelectedFile: file }));
  const discard = vi.fn(async (file: DiffFile) => ({ nextSelectedFile: file }));
  const applyActionResult = vi.fn();

  const hook = renderHook(() =>
    usePaneFileActions({
      selectedFile,
      paneMode,
      stage,
      unstage,
      discard,
      applyActionResult,
    }),
  );

  return {
    ...hook,
    stage,
    unstage,
    discard,
    applyActionResult,
  };
}

describe('usePaneFileActions', () => {
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
});
