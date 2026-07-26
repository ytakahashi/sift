import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import type { FileContentResult } from '../services/file-content-provider';
import type { RepositoryResolver } from '../services/repository-resolver';
import { createFileContentRoutes } from './file-content';

const getContent = vi.fn<(path: string) => Promise<FileContentResult>>();

function createApp(): Hono<Env> {
  const repositoryResolver: RepositoryResolver = {
    listRepositories: vi.fn(),
    resolveRepository: vi
      .fn()
      .mockResolvedValue({ id: 'repo', name: 'repo', path: '/repositories/repo' }),
  };
  const app = new Hono<Env>();
  app.route(
    '/api',
    createFileContentRoutes({
      repositoryResolver,
      createFileContentProvider: () => ({ getContent }),
    }),
  );
  return app;
}

describe('fileContentRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the blob id and lines for an indexed file', async () => {
    // Given
    getContent.mockResolvedValue({ kind: 'file', blobId: 'blob-id', lines: ['one', 'two'] });
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/repo/file-content?path=src%2Ffile.ts');

    // Then
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      blobId: 'blob-id',
      lines: ['one', 'two'],
    });
    expect(getContent).toHaveBeenCalledWith('src/file.ts');
  });

  it('rejects an absent path before resolving file content', async () => {
    // Given
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/repo/file-content');

    // Then
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'File path is required.' });
    expect(getContent).not.toHaveBeenCalled();
  });

  it.each([
    ['not-found', 404, 'File is not present in the index.'],
    ['too-large', 413, 'File is too large to display in full.'],
    ['unsupported', 415, 'File content is not supported.'],
  ] as const)('maps %s provider results to status %s', async (kind, status, error) => {
    // Given
    getContent.mockResolvedValue({ kind });
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/repo/file-content?path=file.ts');

    // Then
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
  });

  it('returns 500 for an unexpected provider failure', async () => {
    // Given
    getContent.mockRejectedValue(new Error('git failed'));
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/repo/file-content?path=file.ts');

    // Then
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'git failed' });
  });
});
