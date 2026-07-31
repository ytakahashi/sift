import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from './env';
import { createDiffRoutes } from './diff';
import {
  RepositoryConfigResolutionError,
  RepositoryNotFoundError,
  RepositoryValidationError,
  type RepositoryResolver,
} from '../services/repository-resolver';

const getFilesMock = vi.fn();
const getHeadRefMock = vi.fn();

function createApp(repositoryResolver: RepositoryResolver): Hono<Env> {
  const app = new Hono<Env>();
  app.route(
    '/api',
    createDiffRoutes({
      repositoryResolver,
      // Inject mock provider factories so tests do not touch the filesystem
      createDiffProvider: () => ({ getFiles: getFilesMock }),
      createHeadRefProvider: () => ({ getHeadRef: getHeadRefMock }),
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
    getHeadRefMock.mockResolvedValue({ type: 'branch', name: 'main' });
  });

  it('returns RepositoryDiff for a valid repository', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi
        .fn()
        .mockResolvedValue({ id: 'my-app', name: 'my-app', path: '/repo/my-app' }),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/my-app/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    // Intentionally asserting against the shared RepositoryDiff domain model
    // as it serves as the API response contract.
    // Confirm the factory was called with the resolved repository path
    expect(data.metadata.repoRoot).toBe('/repo/my-app');
    expect(data.metadata.revision).toBe('HEAD');
    expect(data.metadata.head).toEqual({ type: 'branch', name: 'main' });
    expect(data).toHaveProperty('workingFiles');
    expect(data).toHaveProperty('stagedFiles');
  });

  it('reports a detached HEAD alongside the diff', async () => {
    // Given: the repository is checked out at a commit rather than a branch
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi
        .fn()
        .mockResolvedValue({ id: 'my-app', name: 'my-app', path: '/repo/my-app' }),
    };
    getHeadRefMock.mockResolvedValue({ type: 'detached', revision: 'a1b2c3d' });
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/my-app/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data.metadata.head).toEqual({ type: 'detached', revision: 'a1b2c3d' });
  });

  it('returns 404 when repoId is not configured', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryNotFoundError('Repository id "missing" is not configured.'),
        ),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/missing/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'Repository id "missing" is not configured.',
      code: 'REPOSITORY_NOT_FOUND',
    });
  });

  it('returns 422 when the repository path is not a valid Git repository', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryValidationError('Repository path is not a Git repository.'),
        ),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/bad-repo/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(422);
    expect(data).toEqual({
      error: 'Repository path is not a Git repository.',
      code: 'REPOSITORY_INVALID',
    });
  });

  it('returns 404 when the repository config is missing', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigResolutionError(
            'Repository config is missing: /missing/config.json',
            'missing',
          ),
        ),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/sift/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Repository config is missing: /missing/config.json' });
  });

  it('returns 400 when the repository config is invalid', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigResolutionError('Invalid JSON config: Unexpected token', 'invalid'),
        ),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/sift/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Invalid JSON config: Unexpected token' });
  });

  it('returns 500 when the diff provider throws an unexpected error', async () => {
    // Given: resolver succeeds but the diff provider fails
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi
        .fn()
        .mockResolvedValue({ id: 'my-app', name: 'my-app', path: '/repo/my-app' }),
    };
    const app = new Hono<Env>();
    app.route(
      '/api',
      createDiffRoutes({
        repositoryResolver: mockResolver,
        createDiffProvider: () => ({
          getFiles: vi.fn().mockRejectedValue(new Error('git: fatal error')),
        }),
        createHeadRefProvider: () => ({ getHeadRef: getHeadRefMock }),
      }),
    );

    // When
    const response = await app.request('/api/repositories/my-app/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'git: fatal error' });
  });
});
