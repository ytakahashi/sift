import { afterEach, describe, expect, it, vi } from 'vitest';
import { BlobContentFetchError } from '../../application/ports';
import { httpBlobContentReader } from './blobContentClient';

describe('httpBlobContentReader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('encodes the repository id and blob id and returns blob content', async () => {
    // Given
    const payload = { lines: ['one'] };
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(payload),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    const result = await httpBlobContentReader.fetchBlobContent('my repo', 'abc+123');

    // Then
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/repositories/my%20repo/blob-content?blobId=abc%2B123',
    );
    expect(result).toEqual(payload);
  });

  it('throws a typed error with the server message and status', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'Blob is too large to display.' }),
        ok: false,
        status: 413,
        statusText: 'Content Too Large',
      }),
    );

    // When / Then
    await expect(httpBlobContentReader.fetchBlobContent('repo', 'abc123')).rejects.toEqual(
      expect.objectContaining({
        message: 'Blob is too large to display.',
        name: 'BlobContentFetchError',
        statusCode: 413,
      } satisfies Partial<BlobContentFetchError>),
    );
  });

  it('uses a fallback message when the error response is not valid JSON', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockRejectedValue(new Error('invalid JSON')),
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    // When / Then
    await expect(httpBlobContentReader.fetchBlobContent('repo', 'abc123')).rejects.toEqual(
      expect.objectContaining({
        message: 'Failed to fetch blob content: Internal Server Error',
        name: 'BlobContentFetchError',
        statusCode: 500,
      } satisfies Partial<BlobContentFetchError>),
    );
  });
});
