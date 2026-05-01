import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createWatchRoutes } from './watch';
import {
  RepositoryConfigResolutionError,
  RepositoryNotFoundError,
  RepositoryValidationError,
  type RepositoryResolver,
} from '../services/repository-resolver';

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
  it('returns 404 when scoped watch repoId is not configured', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryNotFoundError('Repository id "missing" is not configured.'),
        ),
    };
    const app = createApp(mockResolver as any);

    // When
    const response = await app.request('/api/repositories/missing/watch');
    const data = await response.json();

    // Then
    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });

  it('returns 422 when the repository path is not a valid Git repository', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryValidationError('Repository path is not a Git repository.'),
        ),
    };
    const app = createApp(mockResolver as any);

    // When
    const response = await app.request('/api/repositories/bad-repo/watch');
    const data = await response.json();

    // Then
    expect(response.status).toBe(422);
    expect(data).toEqual({ error: 'Repository path is not a Git repository.' });
  });

  it('returns 400 when the repository config is invalid', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigResolutionError('Invalid JSON config: Unexpected token', 'invalid'),
        ),
    };
    const app = createApp(mockResolver as any);

    // When
    const response = await app.request('/api/repositories/invalid-config/watch');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid JSON config: Unexpected token' });
  });
});
