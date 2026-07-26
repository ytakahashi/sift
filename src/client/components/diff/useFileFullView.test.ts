import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import type { FileContent, FileContentReader } from '../../application/ports';
import { useFileFullView } from './useFileFullView';

function createFile(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    id: 'file-src/file.ts',
    bucket: 'staged',
    path: 'src/file.ts',
    status: 'modified',
    kind: 'text',
    displayPath: 'src/file.ts',
    newBlobId: 'expected-blob',
    hunks: [
      {
        id: 'hunk-1',
        header: '@@ -2,1 +2,1 @@',
        oldStart: 2,
        oldLines: 1,
        newStart: 2,
        newLines: 1,
        lines: [
          {
            id: 'line-2',
            type: 'context',
            oldLineNumber: 2,
            newLineNumber: 2,
            content: 'two',
          },
        ],
      },
    ],
    ...overrides,
  };
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('useFileFullView', () => {
  it('fetches and builds full rows only when blob id and hunk content match', async () => {
    // Given
    const file = createFile();
    const reader: FileContentReader = {
      fetchFileContent: vi
        .fn()
        .mockResolvedValue({ blobId: 'expected-blob', lines: ['one', 'two', 'three'] }),
    };
    const { result } = renderHook(() => useFileFullView(file, 'repo', reader));

    // When
    act(() => result.current.showFullView());

    // Then
    await waitFor(() => expect(result.current.isFullView).toBe(true));
    expect(result.current.rows.map((row) => row.content)).toEqual([
      'one',
      '@@ -2,1 +2,1 @@',
      'two',
      'three',
    ]);
    expect(reader.fetchFileContent).toHaveBeenCalledTimes(1);
  });

  it('retries once and reports a refresh error when the blob remains inconsistent', async () => {
    // Given
    const file = createFile();
    const reader: FileContentReader = {
      fetchFileContent: vi
        .fn()
        .mockResolvedValue({ blobId: 'different-blob', lines: ['one', 'two'] }),
    };
    const { result } = renderHook(() => useFileFullView(file, 'repo', reader));

    // When
    act(() => result.current.showFullView());

    // Then
    await waitFor(() => expect(result.current.error).toContain('Refresh the diff'));
    expect(result.current.isFullView).toBe(false);
    expect(reader.fetchFileContent).toHaveBeenCalledTimes(2);
  });

  it('returns to compact mode when the file object reference changes', async () => {
    // Given: a file is already expanded
    const reader: FileContentReader = {
      fetchFileContent: vi
        .fn()
        .mockResolvedValue({ blobId: 'expected-blob', lines: ['one', 'two', 'three'] }),
    };
    const initialFile = createFile();
    const { result, rerender } = renderHook(
      ({ file }: { file: DiffFile }) => useFileFullView(file, 'repo', reader),
      { initialProps: { file: initialFile } },
    );
    act(() => result.current.showFullView());
    await waitFor(() => expect(result.current.isFullView).toBe(true));

    // When: diff refresh replaces the object while retaining path and id
    rerender({ file: createFile() });

    // Then
    expect(result.current.isFullView).toBe(false);
    expect(result.current.rows.some((row) => row.origin === 'expanded-context')).toBe(false);
  });

  it('ignores an old response after switching files', async () => {
    // Given: the first file request is still in flight
    const deferred = createDeferred<FileContent>();
    const reader: FileContentReader = {
      fetchFileContent: vi.fn().mockReturnValue(deferred.promise),
    };
    const initialFile = createFile();
    const { result, rerender } = renderHook(
      ({ file }: { file: DiffFile }) => useFileFullView(file, 'repo', reader),
      { initialProps: { file: initialFile } },
    );
    act(() => result.current.showFullView());

    // When: another file is selected before the old response arrives
    rerender({
      file: createFile({
        id: 'file-other.ts',
        path: 'other.ts',
        displayPath: 'other.ts',
        newBlobId: 'other-blob',
      }),
    });
    await act(async () => {
      deferred.resolve({ blobId: 'expected-blob', lines: ['one', 'two'] });
      await deferred.promise;
    });

    // Then
    expect(result.current.isFullView).toBe(false);
    expect(result.current.loading).toBe(false);
  });
});
