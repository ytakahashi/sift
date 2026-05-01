import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import type { RepositoryDiff } from '../../../domain/diff/types';
import type { DiffReader } from '../../application/ports';
import { useDiffData } from './useDiffData';

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

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('useDiffData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches diff data on mount', async () => {
    // Given: the diff reader returns working and staged files
    const workingFile = createFile('working');
    const stagedFile = { ...createFile('staged'), bucket: 'staged' as const };
    const diffReader: DiffReader = {
      fetchDiff: vi.fn().mockResolvedValue({
        metadata: { repoRoot: '/repo/sift', revision: 'HEAD' as const },
        workingFiles: [workingFile],
        stagedFiles: [stagedFile],
      }),
    };

    // When: the hook is rendered
    const { result } = renderHook(() => useDiffData(diffReader, 'sift'));

    // Then: the fetched files are stored
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.workingFiles).toEqual([workingFile]);
    expect(result.current.stagedFiles).toEqual([stagedFile]);
    expect(result.current.initialized).toBe(true);
    expect(result.current.error).toBeNull();
    expect(diffReader.fetchDiff).toHaveBeenCalledWith('sift');
  });

  it('keeps the latest overlapping refresh result', async () => {
    // Given: the initial request resolves, then two refreshes overlap
    const olderRefresh = createDeferred<RepositoryDiff>();
    const newerRefresh = createDeferred<RepositoryDiff>();
    const fetchDiff = vi.fn().mockResolvedValueOnce({
      metadata: { repoRoot: '/repo/sift', revision: 'HEAD' as const },
      workingFiles: [createFile('initial')],
      stagedFiles: [],
    });
    const diffReader: DiffReader = { fetchDiff };

    const { result } = renderHook(() => useDiffData(diffReader, 'sift'));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    fetchDiff.mockReturnValueOnce(olderRefresh.promise).mockReturnValueOnce(newerRefresh.promise);

    // When: two refresh calls happen before the first one resolves
    const firstPromise = result.current.refresh();
    const secondPromise = result.current.refresh();

    newerRefresh.resolve({
      metadata: { repoRoot: '/repo/sift', revision: 'HEAD' as const },
      workingFiles: [createFile('latest')],
      stagedFiles: [],
    });
    const secondResult = await act(async () => {
      return await secondPromise;
    });
    olderRefresh.resolve({
      metadata: { repoRoot: '/repo/sift', revision: 'HEAD' as const },
      workingFiles: [createFile('stale')],
      stagedFiles: [],
    });
    const firstResult = await act(async () => {
      return await firstPromise;
    });

    // Then: each refresh gets its own request, and the stale response cannot
    // overwrite the newer repository state.
    expect(fetchDiff).toHaveBeenCalledTimes(3);
    expect(firstResult).toBeNull();
    expect(secondResult!.workingFiles.map((file) => file.id)).toEqual(['latest']);
    expect(result.current.workingFiles.map((file) => file.id)).toEqual(['latest']);
  });
});
