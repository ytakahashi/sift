import { describe, expect, it, vi } from 'vitest';
import { APP_INFO } from './app-info';
import { createApp } from './create-app';

describe('createApp', () => {
  it('serves the running package version on the health route', async () => {
    // Given
    const app = createApp({
      repoWatchManager: {
        broadcastNotesChanged: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
      },
    });

    // When
    // createApp mounts the host guard on every route, so the request needs a
    // local Host header to get past it.
    const response = await app.request('/api/health', { headers: { host: 'localhost' } });

    // Then
    // The health route takes its version as an option, so the composition root
    // is the only place that binds it to the version read from package.json.
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ version: APP_INFO.version });
  });

  it('mounts the blob content route', async () => {
    // Given
    const app = createApp({
      repoWatchManager: {
        broadcastNotesChanged: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
      },
    });

    // When: validation happens before repository resolution or Git access
    const response = await app.request('/api/repositories/repo/blob-content', {
      headers: { host: 'localhost' },
    });

    // Then
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'A valid blob ID is required.' });
  });

  it('rejects a browser-simple JSON action before resolving a repository', async () => {
    // Given: the request body is valid JSON sent as text/plain
    const readConfig = vi.fn();
    const app = createApp({
      repoWatchManager: {
        broadcastNotesChanged: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
      },
      readConfig,
    });

    // When
    const response = await app.request('/api/repositories/repo/actions/discard-all-working-files', {
      method: 'POST',
      headers: { host: '127.0.0.1:49321', 'Content-Type': 'text/plain' },
      body: '{}',
    });

    // Then: the action route never gets as far as repository resolution
    expect(response.status).toBe(415);
    expect(readConfig).not.toHaveBeenCalled();
  });

  it('rejects a foreign Origin before changing repository configuration', async () => {
    // Given
    const addRepository = vi.fn();
    const app = createApp({
      repoWatchManager: {
        broadcastNotesChanged: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
      },
      repositoryConfigUpdater: {
        addRepository,
        removeRepository: vi.fn(),
        reorderRepositories: vi.fn(),
      },
    });

    // When
    const response = await app.request('/api/repositories', {
      method: 'POST',
      headers: {
        host: '127.0.0.1:49321',
        Origin: 'http://attacker.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path: '/repo' }),
    });

    // Then
    expect(response.status).toBe(403);
    expect(addRepository).not.toHaveBeenCalled();
  });
});
