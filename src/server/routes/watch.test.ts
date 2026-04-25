import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createWatchRoutes } from './watch';
import { RepositoryResolutionError, type RepositoryResolver } from '../services/repository-resolver';

function createApp(repositoryResolver: RepositoryResolver): Hono<Env> {
  const app = new Hono<Env>();
  app.route(
    '/api',
    createWatchRoutes({
      repositoryResolver,
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
    const mockResolver = {
      resolve: vi.fn().mockRejectedValue(new RepositoryResolutionError('Repository id "missing" is not configured.')),
      resolveItem: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/missing/watch');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });
});
