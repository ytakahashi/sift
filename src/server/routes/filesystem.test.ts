import { describe, expect, it, vi } from 'vitest';
import { DirectoryBrowseError } from '../services/directory-browser';
import { createFilesystemRoutes } from './filesystem';

describe('createFilesystemRoutes', () => {
  it.each([
    ['', undefined, false],
    ['?showHidden=true', undefined, true],
    ['?showHidden=false', undefined, false],
    ['?path=%2Fhome%2Fspace%20%26%20%E6%97%A5%E6%9C%AC', '/home/space & 日本', false],
    ['?path=', '', false],
  ])('passes decoded query values for %s to the port', async (query, path, showHidden) => {
    // Given
    const listing = {
      path: '/home',
      parentPath: '/',
      entries: [],
      isGitRepository: false,
      truncated: false,
    };
    const listDirectories = vi.fn().mockResolvedValue(listing);
    const app = createFilesystemRoutes({ directoryBrowser: { listDirectories } });

    // When
    const response = await app.request(`/directories${query}`);

    // Then
    expect(listDirectories).toHaveBeenCalledExactlyOnceWith(path, { showHidden });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(listing);
  });

  it.each(['', '1', 'TRUE', 'invalid'])(
    'rejects showHidden=%s before calling the port',
    async (value) => {
      // Given
      const listDirectories = vi.fn();
      const app = createFilesystemRoutes({ directoryBrowser: { listDirectories } });

      // When
      const response = await app.request(`/directories?showHidden=${value}`);

      // Then
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: 'showHidden must be true or false.',
      });
      expect(listDirectories).not.toHaveBeenCalled();
    },
  );

  it.each([400, 403, 404] as const)(
    'returns a browse error with status %i and no code',
    async (status) => {
      // Given
      const app = createFilesystemRoutes({
        directoryBrowser: {
          listDirectories: vi
            .fn()
            .mockRejectedValue(new DirectoryBrowseError('browse failed', status)),
        },
      });

      // When
      const response = await app.request('/directories');

      // Then
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toEqual({ error: 'browse failed' });
    },
  );

  it('returns unexpected failures as 500', async () => {
    // Given
    const app = createFilesystemRoutes({
      directoryBrowser: {
        listDirectories: vi.fn().mockRejectedValue(new Error('unexpected failure')),
      },
    });

    // When
    const response = await app.request('/directories');

    // Then
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'unexpected failure' });
  });
});
