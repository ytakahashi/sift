import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import { useFileSelection } from './useFileSelection';

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

describe('useFileSelection', () => {
  it('starts with no selection and working pane mode', () => {
    // Given / When: the hook is rendered with empty lists
    const { result } = renderHook(() => useFileSelection([], []));

    // Then: default state is empty selection in working mode
    expect(result.current.selectedFile).toBeNull();
    expect(result.current.paneMode).toBe('working');
  });

  it('select sets selectedFile and paneMode', () => {
    // Given: files in both panes
    const workingFile = createFile('a', 'working');
    const { result } = renderHook(() => useFileSelection([workingFile], []));

    // When: a working file is selected
    act(() => {
      result.current.select(workingFile, 'working');
    });

    // Then: selection and pane mode are updated
    expect(result.current.selectedFile?.id).toBe('a');
    expect(result.current.paneMode).toBe('working');
  });

  it('applyActionResult sets nextSelectedFile and the given pane mode', () => {
    // Given: two working files
    const files = [createFile('a', 'working'), createFile('b', 'working')];
    const { result } = renderHook(() => useFileSelection(files, []));

    // When: an action result pointing to 'b' is applied
    act(() => {
      result.current.applyActionResult({ nextSelectedFile: files[1] }, 'working');
    });

    // Then: 'b' is selected in the working pane
    expect(result.current.selectedFile?.id).toBe('b');
    expect(result.current.paneMode).toBe('working');
  });

  it('applyActionResult with null nextSelectedFile clears the selection', () => {
    // Given: a file is currently selected
    const file = createFile('a', 'working');
    const { result } = renderHook(() => useFileSelection([file], []));
    act(() => {
      result.current.select(file, 'working');
    });

    // When: an action result with no fallback is applied (pane became empty)
    act(() => {
      result.current.applyActionResult({ nextSelectedFile: null }, 'working');
    });

    // Then: selection is cleared
    expect(result.current.selectedFile).toBeNull();
  });

  it('handleBoundaryNavigate from working to staged selects the first staged file', () => {
    // Given: both panes have files and the working pane is active
    const workingFiles = [createFile('a', 'working')];
    const stagedFiles = [createFile('s', 'staged')];
    const { result } = renderHook(() => useFileSelection(workingFiles, stagedFiles));
    act(() => {
      result.current.select(workingFiles[0], 'working');
    });

    // When: ArrowDown is pressed past the last working file
    act(() => {
      result.current.handleBoundaryNavigate('working', 'next');
    });

    // Then: selection jumps to the staged pane
    expect(result.current.selectedFile?.id).toBe('s');
    expect(result.current.paneMode).toBe('staged');
  });

  it('handleBoundaryNavigate from staged to working selects the last working file', () => {
    // Given: both panes have files and the staged pane is active
    const workingFiles = [createFile('a', 'working'), createFile('b', 'working')];
    const stagedFiles = [createFile('s', 'staged')];
    const { result } = renderHook(() => useFileSelection(workingFiles, stagedFiles));
    act(() => {
      result.current.select(stagedFiles[0], 'staged');
    });

    // When: ArrowUp is pressed past the first staged file
    act(() => {
      result.current.handleBoundaryNavigate('staged', 'previous');
    });

    // Then: selection jumps back to the last working file
    expect(result.current.selectedFile?.id).toBe('b');
    expect(result.current.paneMode).toBe('working');
  });

  it('handleBoundaryNavigate does nothing when the target pane is empty', () => {
    // Given: only working files exist; no staged files
    const workingFiles = [createFile('a', 'working')];
    const { result } = renderHook(() => useFileSelection(workingFiles, []));
    act(() => {
      result.current.select(workingFiles[0], 'working');
    });

    // When: ArrowDown is pressed past the last working file (staged pane is empty)
    act(() => {
      result.current.handleBoundaryNavigate('working', 'next');
    });

    // Then: selection remains unchanged
    expect(result.current.selectedFile?.id).toBe('a');
    expect(result.current.paneMode).toBe('working');
  });

  it('replaces a stale selectedFile reference after a server refresh', () => {
    // Given: 'a' is selected in the working pane
    const fileA = createFile('a', 'working');
    const { result, rerender } = renderHook(
      ({ workingFiles }: { workingFiles: DiffFile[] }) => useFileSelection(workingFiles, []),
      { initialProps: { workingFiles: [fileA] } },
    );
    act(() => {
      result.current.select(fileA, 'working');
    });

    // When: the server refresh returns a new object with the same id but updated content.
    // selectedFile still holds the old reference at this point — the controlled
    // component test verifies the sync effect runs without a second rerender.
    const fileAUpdated = { ...fileA, displayPath: 'renamed.ts' };
    rerender({ workingFiles: [fileAUpdated] });

    // Then: the hook replaces the stale reference with the updated object
    expect(result.current.selectedFile).toBe(fileAUpdated);
  });

  it('clears selectedFile when the selected file is no longer in the list', () => {
    // Given: 'a' is selected but then disappears from the server list
    const fileA = createFile('a', 'working');
    const fileB = createFile('b', 'working');
    const { result, rerender } = renderHook(
      ({ workingFiles }: { workingFiles: DiffFile[] }) => useFileSelection(workingFiles, []),
      { initialProps: { workingFiles: [fileA, fileB] } },
    );
    act(() => {
      result.current.select(fileA, 'working');
    });

    // When: the next server refresh omits 'a' (e.g. it was moved to staged by another process)
    rerender({ workingFiles: [fileB] });

    // Then: the selection is cleared so the diff viewer does not show stale content
    expect(result.current.selectedFile).toBeNull();
  });
});
