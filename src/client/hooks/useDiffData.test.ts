import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
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

function createResponse(body: unknown, ok = true, statusText = 'OK'): Response {
  return {
    ok,
    statusText,
    json: async () => body,
  } as Response;
}

function createDeferred<T>() {
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

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches diff data on mount', async () => {
    // Given: /api/diff returns working and staged files
    const workingFile = createFile('working');
    const stagedFile = { ...createFile('staged'), bucket: 'staged' as const };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        createResponse({
          workingFiles: [workingFile],
          stagedFiles: [stagedFile],
        }),
      ),
    );

    // When: the hook is rendered
    const { result } = renderHook(() => useDiffData());

    // Then: the fetched files are stored
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.workingFiles).toEqual([workingFile]);
    expect(result.current.stagedFiles).toEqual([stagedFile]);
    expect(result.current.initialized).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('keeps the latest overlapping refresh result', async () => {
    // Given: the initial request resolves, then two refreshes overlap
    const olderRefresh = createDeferred<Response>();
    const newerRefresh = createDeferred<Response>();
    const fetchMock = vi.fn().mockResolvedValueOnce(
      createResponse({
        workingFiles: [createFile('initial')],
        stagedFiles: [],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useDiffData());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    fetchMock.mockReturnValueOnce(olderRefresh.promise).mockReturnValueOnce(newerRefresh.promise);

    // When: two refresh calls happen before the first one resolves
    const firstPromise = result.current.refresh();
    const secondPromise = result.current.refresh();

    newerRefresh.resolve(
      createResponse({
        workingFiles: [createFile('latest')],
        stagedFiles: [],
      }),
    );
    const secondResult = await act(async () => {
      return await secondPromise;
    });
    olderRefresh.resolve(
      createResponse({
        workingFiles: [createFile('stale')],
        stagedFiles: [],
      }),
    );
    const firstResult = await act(async () => {
      return await firstPromise;
    });

    // Then: each refresh gets its own request, and the stale response cannot
    // overwrite the newer repository state.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(firstResult).toBeNull();
    expect(secondResult!.workingFiles.map((file) => file.id)).toEqual(['latest']);
    expect(result.current.workingFiles.map((file) => file.id)).toEqual(['latest']);
  });
});
