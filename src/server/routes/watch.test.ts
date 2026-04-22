import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createWatchRoutes } from './watch';

function createApp(): Hono<Env> {
  const app = new Hono<Env>();
  app.route(
    '/api',
    createWatchRoutes({
      readConfig: async () => ({
        config: {
          repositories: [{ id: 'sift', path: '/repo/sift' }],
        },
        status: 'found',
      }),
      repoWatchManager: {
        close: vi.fn().mockResolvedValue(undefined),
        subscribe: vi.fn().mockResolvedValue(undefined),
      },
    }),
  );
  return app;
}

describe('watchRoutes', () => {
  it('returns 400 when scoped watch repoId is not configured', async () => {
    // Given
    const app = createApp();

    // When
    const response = await app.request('/api/repositories/missing/watch');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });
});
