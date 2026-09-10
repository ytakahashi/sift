import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import type {
  BlobContent,
  BlobContentReader,
  FileContent,
  FileContentReader,
} from '../../application/ports';
import { useMarkdownPreview } from './useMarkdownPreview';

function createFile(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    id: 'file-README.md',
    bucket: 'staged',
    path: 'README.md',
    status: 'modified',
    kind: 'text',
    displayPath: 'README.md',
    oldBlobId: 'old-blob',
    newBlobId: 'new-blob',
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

function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createReaders(): {
  blobContentReader: BlobContentReader;
  fileContentReader: FileContentReader;
} {
  return {
    blobContentReader: {
      fetchBlobContent: vi.fn().mockResolvedValue({ lines: ['old one', 'old two'] }),
    },
    fileContentReader: {
      fetchFileContent: vi.fn().mockResolvedValue({ blobId: 'new-blob', lines: ['one', 'two'] }),
    },
  };
}

describe('useMarkdownPreview', () => {
  it('starts old and new content requests together and exposes both results', async () => {
    // Given
    const oldContent = createDeferred<BlobContent>();
    const newContent = createDeferred<FileContent>();
    const blobContentReader: BlobContentReader = {
      fetchBlobContent: vi.fn().mockReturnValue(oldContent.promise),
    };
    const fileContentReader: FileContentReader = {
      fetchFileContent: vi.fn().mockReturnValue(newContent.promise),
    };
    const file = createFile();
    const { result } = renderHook(() =>
      useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
    );

    // When
    act(() => result.current.showPreview());

    // Then: neither request waits for the other to finish
    expect(result.current.mode).toBe('loading');
    expect(blobContentReader.fetchBlobContent).toHaveBeenCalledWith('repo', 'old-blob');
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledWith('repo', 'README.md');

    // When
    await act(async () => {
      oldContent.resolve({ lines: ['old one', 'old two'] });
      newContent.resolve({ blobId: 'new-blob', lines: ['one', 'two'] });
      await Promise.all([oldContent.promise, newContent.promise]);
    });

    // Then
    await waitFor(() => expect(result.current.mode).toBe('ready'));
    expect(result.current).toEqual(
      expect.objectContaining({
        oldLines: ['old one', 'old two'],
        newLines: ['one', 'two'],
      }),
    );
  });

  it('retries only the new side when its blob id is stale', async () => {
    // Given
    const blobContentReader: BlobContentReader = {
      fetchBlobContent: vi.fn().mockResolvedValue({ lines: ['old'] }),
    };
    const fileContentReader: FileContentReader = {
      fetchFileContent: vi
        .fn()
        .mockResolvedValueOnce({ blobId: 'stale-blob', lines: ['one', 'two'] })
        .mockResolvedValueOnce({ blobId: 'new-blob', lines: ['one', 'two'] }),
    };
    const file = createFile();
    const { result } = renderHook(() =>
      useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
    );

    // When
    act(() => result.current.showPreview());

    // Then
    await waitFor(() => expect(result.current.mode).toBe('ready'));
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledTimes(2);
    expect(blobContentReader.fetchBlobContent).toHaveBeenCalledTimes(1);
  });

  it('retries when the new content does not match the diff hunks', async () => {
    // Given
    const { blobContentReader, fileContentReader } = createReaders();
    vi.mocked(fileContentReader.fetchFileContent)
      .mockResolvedValueOnce({ blobId: 'new-blob', lines: ['one', 'different'] })
      .mockResolvedValueOnce({ blobId: 'new-blob', lines: ['one', 'two'] });
    const file = createFile();
    const { result } = renderHook(() =>
      useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
    );

    // When
    act(() => result.current.showPreview());

    // Then
    await waitFor(() => expect(result.current.mode).toBe('ready'));
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledTimes(2);
  });

  it('reports a refresh error when the new side remains inconsistent', async () => {
    // Given
    const { blobContentReader, fileContentReader } = createReaders();
    vi.mocked(fileContentReader.fetchFileContent).mockResolvedValue({
      blobId: 'new-blob',
      lines: ['one', 'different'],
    });
    const file = createFile();
    const { result } = renderHook(() =>
      useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
    );

    // When
    act(() => result.current.showPreview());

    // Then
    await waitFor(() => expect(result.current.mode).toBe('error'));
    expect(result.current).toEqual(
      expect.objectContaining({ error: expect.stringContaining('Refresh the diff') }),
    );
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledTimes(2);
  });

  it('exposes a content reader error', async () => {
    // Given
    const { blobContentReader, fileContentReader } = createReaders();
    vi.mocked(blobContentReader.fetchBlobContent).mockRejectedValue(
      new Error('Blob is too large to display.'),
    );
    const file = createFile();
    const { result } = renderHook(() =>
      useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
    );

    // When
    act(() => result.current.showPreview());

    // Then
    await waitFor(() => expect(result.current.mode).toBe('error'));
    expect(result.current).toEqual(
      expect.objectContaining({ error: 'Blob is too large to display.' }),
    );
  });

  it('fetches again and recovers when preview is retried from an error', async () => {
    // Given
    const { blobContentReader, fileContentReader } = createReaders();
    vi.mocked(blobContentReader.fetchBlobContent).mockRejectedValueOnce(
      new Error('Temporary failure.'),
    );
    const file = createFile();
    const { result } = renderHook(() =>
      useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
    );
    act(() => result.current.showPreview());
    await waitFor(() => expect(result.current.mode).toBe('error'));

    // When
    act(() => result.current.showPreview());

    // Then
    await waitFor(() => expect(result.current.mode).toBe('ready'));
    expect(blobContentReader.fetchBlobContent).toHaveBeenCalledTimes(2);
    expect(fileContentReader.fetchFileContent).toHaveBeenCalledTimes(2);
  });

  it('returns to source mode when the file object reference changes', async () => {
    // Given
    const { blobContentReader, fileContentReader } = createReaders();
    const initialFile = createFile();
    const { result, rerender } = renderHook(
      ({ file }: { file: DiffFile }) =>
        useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
      { initialProps: { file: initialFile } },
    );
    act(() => result.current.showPreview());
    await waitFor(() => expect(result.current.mode).toBe('ready'));

    // When
    rerender({ file: createFile() });

    // Then
    expect(result.current.mode).toBe('source');
  });

  it('returns to source mode when the repository id changes', async () => {
    // Given
    const { blobContentReader, fileContentReader } = createReaders();
    const file = createFile();
    const { result, rerender } = renderHook(
      ({ repoId }: { repoId: string }) =>
        useMarkdownPreview(file, repoId, fileContentReader, blobContentReader),
      { initialProps: { repoId: 'first-repo' } },
    );
    act(() => result.current.showPreview());
    await waitFor(() => expect(result.current.mode).toBe('ready'));

    // When
    rerender({ repoId: 'second-repo' });

    // Then
    expect(result.current.mode).toBe('source');
  });

  it('ignores an old response after switching files', async () => {
    // Given
    const oldContent = createDeferred<BlobContent>();
    const newContent = createDeferred<FileContent>();
    const blobContentReader: BlobContentReader = {
      fetchBlobContent: vi.fn().mockReturnValue(oldContent.promise),
    };
    const fileContentReader: FileContentReader = {
      fetchFileContent: vi.fn().mockReturnValue(newContent.promise),
    };
    const initialFile = createFile();
    const { result, rerender } = renderHook(
      ({ file }: { file: DiffFile }) =>
        useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
      { initialProps: { file: initialFile } },
    );
    act(() => result.current.showPreview());

    // When
    rerender({
      file: createFile({ id: 'file-other.md', path: 'other.md', displayPath: 'other.md' }),
    });
    await act(async () => {
      oldContent.resolve({ lines: ['old'] });
      newContent.resolve({ blobId: 'new-blob', lines: ['one', 'two'] });
      await Promise.all([oldContent.promise, newContent.promise]);
    });

    // Then
    expect(result.current.mode).toBe('source');
  });

  it('keeps source mode when an in-flight preview finishes after showSource', async () => {
    // Given
    const oldContent = createDeferred<BlobContent>();
    const newContent = createDeferred<FileContent>();
    const blobContentReader: BlobContentReader = {
      fetchBlobContent: vi.fn().mockReturnValue(oldContent.promise),
    };
    const fileContentReader: FileContentReader = {
      fetchFileContent: vi.fn().mockReturnValue(newContent.promise),
    };
    const file = createFile();
    const { result } = renderHook(() =>
      useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
    );
    act(() => result.current.showPreview());

    // When
    act(() => result.current.showSource());
    await act(async () => {
      oldContent.resolve({ lines: ['old'] });
      newContent.resolve({ blobId: 'new-blob', lines: ['one', 'two'] });
      await Promise.all([oldContent.promise, newContent.promise]);
    });

    // Then
    expect(result.current.mode).toBe('source');
  });

  it.each([
    ['oldBlobId', { oldBlobId: undefined }],
    ['newBlobId', { newBlobId: undefined }],
  ] satisfies Array<[string, Partial<DiffFile>]>)(
    'does not fetch when %s is missing',
    (_field, overrides) => {
      // Given
      const { blobContentReader, fileContentReader } = createReaders();
      const file = createFile(overrides);
      const { result } = renderHook(() =>
        useMarkdownPreview(file, 'repo', fileContentReader, blobContentReader),
      );

      // When
      act(() => result.current.showPreview());

      // Then
      expect(result.current).toEqual(
        expect.objectContaining({ mode: 'error', error: expect.stringContaining('blob IDs') }),
      );
      expect(blobContentReader.fetchBlobContent).not.toHaveBeenCalled();
      expect(fileContentReader.fetchFileContent).not.toHaveBeenCalled();
    },
  );
});
