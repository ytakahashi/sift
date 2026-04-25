import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createDiffRoutes } from './diff';
import {
  RepositoryResolutionError,
  type RepositoryResolver,
} from '../services/repository-resolver';

const getFilesMock = vi.fn();

function createApp(repositoryResolver: RepositoryResolver): Hono<Env> {
  const app = new Hono<Env>();
  app.route(
    '/api',
    createDiffRoutes({
      repositoryResolver,
      // Inject a mock DiffProvider factory so tests do not touch the filesystem
      createDiffProvider: () => ({ getFiles: getFilesMock }),
    }),
  );
  return app;
}

describe('diffRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFilesMock.mockImplementation((bucket: 'working' | 'staged') => {
      if (bucket === 'working') {
        return Promise.resolve([{ id: 'working-file', path: 'working.ts' }]);
      }

      return Promise.resolve([{ id: 'staged-file', path: 'staged.ts' }]);
    });
  });

  it('returns diff for the repository resolved from repoId', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
      resolveItem: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/my-app/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    // Confirm the factory was called with the resolved repository path
    expect(data.metadata.repoRoot).toBe('/repo/my-app');
  });

  it('returns an error when repoId is not configured', async () => {
    // Given
    const mockResolver = {
      resolve: vi
        .fn()
        .mockRejectedValue(
          new RepositoryResolutionError('Repository id "missing" is not configured.'),
        ),
      resolveItem: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/missing/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });

  it('returns an error when config is missing for a non-default scoped diff', async () => {
    // Given
    const mockResolver = {
      resolve: vi
        .fn()
        .mockRejectedValue(
          new RepositoryResolutionError('Repository config is missing: /missing/config.json'),
        ),
      resolveItem: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/sift/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository config is missing: /missing/config.json' });
  });
});
