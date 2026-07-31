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
});
