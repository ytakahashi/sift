import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { BlobContentResult } from '../services/blob-content-provider';
import type { RepositoryResolver } from '../services/repository-resolver';
import { createBlobContentRoutes } from './blob-content';
import type { Env } from './env';

const getContent = vi.fn<(blobId: string) => Promise<BlobContentResult>>();
const resolveRepository = vi.fn<RepositoryResolver['resolveRepository']>();

function createApp(): Hono<Env> {
  const repositoryResolver: RepositoryResolver = {
    listRepositories: vi.fn(),
    resolveRepository,
  };
  const app = new Hono<Env>();
  app.route(
    '/api',
    createBlobContentRoutes({
      repositoryResolver,
      createBlobContentProvider: () => ({ getContent }),
    }),
  );
  return app;
}

describe('blobContentRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveRepository.mockResolvedValue({
      id: 'repo',
      name: 'repo',
      path: '/repositories/repo',
    });
  });

  it('returns lines for a blob without echoing its id', async () => {
    // Given
    getContent.mockResolvedValue({ kind: 'file', lines: ['one', 'two'] });
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/repo/blob-content?blobId=abc123');

    // Then
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ lines: ['one', 'two'] });
    expect(resolveRepository).toHaveBeenCalledWith('repo');
    expect(getContent).toHaveBeenCalledWith('abc123');
  });

  it.each([undefined, '', 'not-a-blob', 'abc%0Adef'])(
    'rejects invalid blob id %s before resolving the repository',
    async (blobId) => {
      // Given
      const app = createApp();
      const query = blobId === undefined ? '' : `?blobId=${blobId}`;

      // When
      const response = await app.request(`/api/repositories/repo/blob-content${query}`);

      // Then
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({ error: 'A valid blob ID is required.' });
      expect(resolveRepository).not.toHaveBeenCalled();
      expect(getContent).not.toHaveBeenCalled();
    },
  );

  it('accepts uppercase hexadecimal blob ids', async () => {
    // Given
    getContent.mockResolvedValue({ kind: 'file', lines: [] });
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/repo/blob-content?blobId=ABCDEF');

    // Then
    expect(response.status).toBe(200);
    expect(getContent).toHaveBeenCalledWith('ABCDEF');
  });

  it.each([
    ['not-found', 404, 'Blob was not found.'],
    ['too-large', 413, 'Blob is too large to display.'],
    ['unsupported', 415, 'Blob content is not supported.'],
  ] as const)('maps %s provider results to status %s', async (kind, status, error) => {
    // Given
    getContent.mockResolvedValue({ kind });
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/repo/blob-content?blobId=abc123');

    // Then
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it('returns 500 for an unexpected provider failure', async () => {
    // Given
    getContent.mockRejectedValue(new Error('git failed'));
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/repo/blob-content?blobId=abc123');

    // Then
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'git failed' });
  });
});
