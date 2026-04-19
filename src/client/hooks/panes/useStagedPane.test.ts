import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import { useStagedPane } from './useStagedPane';

function createFile(id: string): DiffFile {
  return {
    id,
    bucket: 'staged',
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath: `${id}.ts`,
    hunks: [],
  };
}

describe('useStagedPane', () => {
  it('initialises the local mirror from serverFiles', () => {
    // Given: a non-empty server file list
    const serverFiles = [createFile('s1'), createFile('s2')];

    // When: the hook is rendered
    const { result } = renderHook(() => useStagedPane(serverFiles, vi.fn()));

    // Then: the local mirror matches serverFiles
    expect(result.current.files.map((f) => f.id)).toEqual(['s1', 's2']);
  });

  it('updates the local mirror when serverFiles changes', () => {
    // Given: the hook is rendered with an initial file list
    const unstageFile = vi.fn();
    const { result, rerender } = renderHook(
      ({ serverFiles }: { serverFiles: DiffFile[] }) => useStagedPane(serverFiles, unstageFile),
      { initialProps: { serverFiles: [createFile('s1')] } },
    );

    // When: serverFiles is updated (simulates a server refresh)
    rerender({ serverFiles: [createFile('s1'), createFile('s2')] });

    // Then: the local mirror reflects the new list
    expect(result.current.files.map((f) => f.id)).toEqual(['s1', 's2']);
  });

  it('removes the unstaged file optimistically and returns the fallback on success', async () => {
    // Given: three files in the staged area
    const unstageFile = vi.fn().mockResolvedValue(undefined);
    const files = [createFile('s1'), createFile('s2'), createFile('s3')];
    const { result } = renderHook(() => useStagedPane(files, unstageFile));

    // When: the middle file ('s2') is unstaged
    let actionResult: Awaited<ReturnType<typeof result.current.unstage>>;
    await act(async () => {
      actionResult = await result.current.unstage(files[1]);
    });

    // Then: 's2' is removed; same-index fallback ('s3') is returned
    expect(result.current.files.map((f) => f.id)).toEqual(['s1', 's3']);
    expect(actionResult!.nextSelectedFile?.id).toBe('s3');
    expect(unstageFile).toHaveBeenCalledWith('s2.ts');
  });

  it('selects the previous file when the last item in the list is unstaged', async () => {
    // Given: two files where the last one is unstaged
    const unstageFile = vi.fn().mockResolvedValue(undefined);
    const files = [createFile('s1'), createFile('s2')];
    const { result } = renderHook(() => useStagedPane(files, unstageFile));

    // When: the last file ('s2') is unstaged
    let actionResult: Awaited<ReturnType<typeof result.current.unstage>>;
    await act(async () => {
      actionResult = await result.current.unstage(files[1]);
    });

    // Then: 's1' (the previous item) becomes the fallback selection
    expect(result.current.files.map((f) => f.id)).toEqual(['s1']);
    expect(actionResult!.nextSelectedFile?.id).toBe('s1');
  });

  it('returns null as nextSelectedFile when the only file is unstaged', async () => {
    // Given: only one file in the staged area
    const unstageFile = vi.fn().mockResolvedValue(undefined);
    const files = [createFile('s1')];
    const { result } = renderHook(() => useStagedPane(files, unstageFile));

    // When: the sole file is unstaged
    let actionResult: Awaited<ReturnType<typeof result.current.unstage>>;
    await act(async () => {
      actionResult = await result.current.unstage(files[0]);
    });

    // Then: no fallback exists; nextSelectedFile is null
    expect(result.current.files).toEqual([]);
    expect(actionResult!.nextSelectedFile).toBeNull();
  });

  it('rolls back the file list and returns the original file when unstaging fails', async () => {
    // Given: unstageFile rejects (e.g. network error)
    const unstageFile = vi.fn().mockRejectedValue(new Error('network error'));
    const files = [createFile('s1'), createFile('s2')];
    const { result } = renderHook(() => useStagedPane(files, unstageFile));

    // When: unstaging 's1' fails
    let actionResult: Awaited<ReturnType<typeof result.current.unstage>>;
    await act(async () => {
      actionResult = await result.current.unstage(files[0]);
    });

    // Then: the mirror is restored to its original state and
    // the original file is returned so the caller can preserve the selection
    expect(result.current.files.map((f) => f.id)).toEqual(['s1', 's2']);
    expect(actionResult!.nextSelectedFile?.id).toBe('s1');
  });

  it('returns early without calling unstageFile when the file is not in the list', async () => {
    // Given: the file to unstage does not exist in the mirror (race condition)
    const unstageFile = vi.fn();
    const files = [createFile('s1')];
    const { result } = renderHook(() => useStagedPane(files, unstageFile));
    const missingFile = createFile('missing');

    // When
    let actionResult: Awaited<ReturnType<typeof result.current.unstage>>;
    await act(async () => {
      actionResult = await result.current.unstage(missingFile);
    });

    // Then: no server call is made and nextSelectedFile is null (empty fallback)
    expect(unstageFile).not.toHaveBeenCalled();
    expect(actionResult!.nextSelectedFile).toBeNull();
  });
});
