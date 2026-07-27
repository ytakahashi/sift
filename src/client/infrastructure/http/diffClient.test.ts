import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiffFetchError } from '../../application/ports';
import { httpDiffReader } from './diffClient';

describe('httpDiffReader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches diff data from the repository-scoped endpoint', async () => {
    // Given
    const payload = {
      metadata: {
        repoRoot: '/repo/my-app',
        revision: 'HEAD' as const,
        head: { type: 'branch' as const, name: 'main' },
      },
      stagedFiles: [{ id: 'staged.ts' }],
      workingFiles: [{ id: 'working.ts' }],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(payload),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    const data = await httpDiffReader.fetchDiff('my-app');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app/diff');
    expect(data).toEqual(payload);
  });

  it('throws DiffFetchError with statusCode when the response is not ok', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'Repository id "missing" is not configured.' }),
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    // When / Then
    await expect(httpDiffReader.fetchDiff('missing')).rejects.toThrow(DiffFetchError);
    await expect(httpDiffReader.fetchDiff('missing')).rejects.toMatchObject({
      message: 'Repository id "missing" is not configured.',
      statusCode: 404,
    });
  });

  it('throws DiffFetchError with statusCode when the server error body cannot be parsed', async () => {
    // Given: the response body is not valid JSON, so the fallback message is used
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    // When / Then
    await expect(httpDiffReader.fetchDiff('my-app')).rejects.toThrow(DiffFetchError);
    await expect(httpDiffReader.fetchDiff('my-app')).rejects.toMatchObject({
      message: 'Failed to fetch diff: Internal Server Error',
      statusCode: 500,
    });
  });
});
