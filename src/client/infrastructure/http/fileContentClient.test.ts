import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileContentFetchError } from '../../application/ports';
import { httpFileContentReader } from './fileContentClient';

describe('httpFileContentReader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('encodes the repository id and path and returns file content', async () => {
    // Given
    const payload = { blobId: 'blob-id', lines: ['one'] };
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(payload),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    const result = await httpFileContentReader.fetchFileContent('my repo', 'src/a file.ts');

    // Then
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/repositories/my%20repo/file-content?path=src%2Fa+file.ts',
    );
    expect(result).toEqual(payload);
  });

  it('throws a typed error with the server message and status', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'File is too large to display in full.' }),
        ok: false,
        status: 413,
        statusText: 'Content Too Large',
      }),
    );

    // When / Then
    await expect(httpFileContentReader.fetchFileContent('repo', 'large.ts')).rejects.toEqual(
      expect.objectContaining({
        message: 'File is too large to display in full.',
        name: 'FileContentFetchError',
        statusCode: 413,
      } satisfies Partial<FileContentFetchError>),
    );
  });
});
