import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
import { useWorkingPane } from './useWorkingPane';

function createFile(id: string): DiffFile {
  return {
    id,
    bucket: 'working',
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath: `${id}.ts`,
    hunks: [],
  };
}

describe('useWorkingPane', () => {
  it('initialises the local mirror from serverFiles', () => {
    // Given: a non-empty server file list
    const serverFiles = [createFile('a'), createFile('b')];

    // When: the hook is rendered
    const { result } = renderHook(() => useWorkingPane(serverFiles, vi.fn(), vi.fn()));

    // Then: the local mirror matches serverFiles
    expect(result.current.files.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('updates the local mirror when serverFiles changes', () => {
    // Given: the hook is rendered with an initial file list
    const stageFile = vi.fn();
    const discardWorkingFile = vi.fn();
    const { result, rerender } = renderHook(
      ({ serverFiles }: { serverFiles: DiffFile[] }) =>
        useWorkingPane(serverFiles, stageFile, discardWorkingFile),
      { initialProps: { serverFiles: [createFile('a')] } },
    );

    // When: serverFiles is updated (simulates a server refresh)
    rerender({ serverFiles: [createFile('a'), createFile('b')] });

    // Then: the local mirror reflects the new list
    expect(result.current.files.map((f) => f.id)).toEqual(['a', 'b']);
  });

  it('removes the staged file optimistically and returns the fallback on success', async () => {
    // Given: three files in the working directory
    const stageFile = vi.fn().mockResolvedValue(undefined);
    const discardWorkingFile = vi.fn();
    const files = [createFile('a'), createFile('b'), createFile('c')];
    const { result } = renderHook(() => useWorkingPane(files, stageFile, discardWorkingFile));

    // When: the middle file ('b') is staged
    let actionResult: Awaited<ReturnType<typeof result.current.stage>>;
    await act(async () => {
      actionResult = await result.current.stage(files[1]);
    });

    // Then: 'b' is removed from the local mirror; same-index fallback ('c') is returned
    expect(result.current.files.map((f) => f.id)).toEqual(['a', 'c']);
    expect(actionResult!.nextSelectedFile?.id).toBe('c');
    expect(stageFile).toHaveBeenCalledWith('b.ts');
  });

  it('selects the previous file when the last item in the list is staged', async () => {
    // Given: two files where the last one is staged
    const stageFile = vi.fn().mockResolvedValue(undefined);
    const discardWorkingFile = vi.fn();
    const files = [createFile('a'), createFile('b')];
    const { result } = renderHook(() => useWorkingPane(files, stageFile, discardWorkingFile));

    // When: the last file ('b') is staged
    let actionResult: Awaited<ReturnType<typeof result.current.stage>>;
    await act(async () => {
      actionResult = await result.current.stage(files[1]);
    });

    // Then: 'a' (the previous item) becomes the fallback selection
    expect(result.current.files.map((f) => f.id)).toEqual(['a']);
    expect(actionResult!.nextSelectedFile?.id).toBe('a');
  });

  it('returns null as nextSelectedFile when the only file is staged', async () => {
    // Given: only one file in the list
    const stageFile = vi.fn().mockResolvedValue(undefined);
    const discardWorkingFile = vi.fn();
    const files = [createFile('a')];
    const { result } = renderHook(() => useWorkingPane(files, stageFile, discardWorkingFile));

    // When: the sole file is staged
    let actionResult: Awaited<ReturnType<typeof result.current.stage>>;
    await act(async () => {
      actionResult = await result.current.stage(files[0]);
    });

    // Then: no fallback exists; nextSelectedFile is null
    expect(result.current.files).toEqual([]);
    expect(actionResult!.nextSelectedFile).toBeNull();
  });

  it('rolls back the file list and returns the original file when staging fails', async () => {
    // Given: stageFile rejects (e.g. network error)
    const stageFile = vi.fn().mockRejectedValue(new Error('network error'));
    const discardWorkingFile = vi.fn();
    const files = [createFile('a'), createFile('b')];
    const { result } = renderHook(() => useWorkingPane(files, stageFile, discardWorkingFile));

    // When: staging 'a' fails
    let actionResult: Awaited<ReturnType<typeof result.current.stage>>;
    await act(async () => {
      actionResult = await result.current.stage(files[0]);
    });

    // Then: the mirror is restored to its original state and
    // the original file is returned so the caller can preserve the selection
    expect(result.current.files.map((f) => f.id)).toEqual(['a', 'b']);
    expect(actionResult!.nextSelectedFile?.id).toBe('a');
  });

  it('returns early without calling stageFile when the file is not in the list', async () => {
    // Given: the file to stage does not exist in the mirror (race condition)
    const stageFile = vi.fn();
    const discardWorkingFile = vi.fn();
    const files = [createFile('a')];
    const { result } = renderHook(() => useWorkingPane(files, stageFile, discardWorkingFile));
    const missingFile = createFile('missing');

    // When
    let actionResult: Awaited<ReturnType<typeof result.current.stage>>;
    await act(async () => {
      actionResult = await result.current.stage(missingFile);
    });

    // Then: no server call is made and nextSelectedFile is null (empty fallback)
    expect(stageFile).not.toHaveBeenCalled();
    expect(actionResult!.nextSelectedFile).toBeNull();
  });

  it('removes the discarded file optimistically and returns fallback on success', async () => {
    // Given: discardWorkingFile resolves
    const stageFile = vi.fn();
    const discardWorkingFile = vi.fn().mockResolvedValue(undefined);
    const files = [createFile('a'), createFile('b'), createFile('c')];
    const { result } = renderHook(() => useWorkingPane(files, stageFile, discardWorkingFile));

    // When: middle file is discarded
    let actionResult: Awaited<ReturnType<typeof result.current.discard>>;
    await act(async () => {
      actionResult = await result.current.discard(files[1]);
    });

    // Then: same-index fallback is returned and file is removed optimistically
    expect(result.current.files.map((f) => f.id)).toEqual(['a', 'c']);
    expect(actionResult!.nextSelectedFile?.id).toBe('c');
    expect(discardWorkingFile).toHaveBeenCalledWith('b.ts');
  });

  it('rolls back and returns original file when discard fails', async () => {
    // Given: discardWorkingFile rejects
    const stageFile = vi.fn();
    const discardWorkingFile = vi.fn().mockRejectedValue(new Error('network error'));
    const files = [createFile('a'), createFile('b')];
    const { result } = renderHook(() => useWorkingPane(files, stageFile, discardWorkingFile));

    // When: discard fails
    let actionResult: Awaited<ReturnType<typeof result.current.discard>>;
    await act(async () => {
      actionResult = await result.current.discard(files[0]);
    });

    // Then: mirror is rolled back and original file is returned
    expect(result.current.files.map((f) => f.id)).toEqual(['a', 'b']);
    expect(actionResult!.nextSelectedFile?.id).toBe('a');
  });
});
