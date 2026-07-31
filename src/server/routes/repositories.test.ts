import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from './env';
import { createRepositoryRoutes } from './repositories';
import {
  RepositoryConfigUpdateError,
  type RepositoryConfigUpdater,
} from '../services/repository-config';
import {
  RepositoryConfigResolutionError,
  RepositoryNotFoundError,
  RepositoryValidationError,
  type RepositoryResolver,
} from '../services/repository-resolver';

function createApp(
  repositoryResolver: RepositoryResolver,
  repositoryConfigUpdater: RepositoryConfigUpdater = {
    addRepository: vi.fn(),
    removeRepository: vi.fn(),
    reorderRepositories: vi.fn(),
  },
): Hono<Env> {
  const app = new Hono<Env>();
  app.route(
    '/api/repositories',
    createRepositoryRoutes({ repositoryConfigUpdater, repositoryResolver }),
  );
  return app;
}

describe('repositoryRoutes', () => {
  it('returns configured repositories', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn().mockResolvedValue({
        repositories: [
          { id: 'sift', name: 'sift', path: '/Users/example/projects/sift' },
          { id: 'my-app', name: 'my-app', path: '/Users/example/work/my-app' },
        ],
        invalidRepositories: [],
      }),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({
      repositories: [
        {
          id: 'sift',
          name: 'sift',
          path: '/Users/example/projects/sift',
        },
        {
          id: 'my-app',
          name: 'my-app',
          path: '/Users/example/work/my-app',
        },
      ],
      invalidRepositories: [],
    });
  });

  it('returns 404 when config is missing', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigResolutionError(
            'Repository config is missing: /Users/example/.config/sift/config.json',
            'missing',
          ),
        ),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories');
    const data = await response.json();

    // Then
    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'Repository config is missing: /Users/example/.config/sift/config.json',
    });
  });

  it('returns 400 when config is invalid', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigResolutionError('Invalid JSON config: Unexpected token', 'invalid'),
        ),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'Invalid JSON config: Unexpected token',
    });
  });

  it('returns one configured repository by repoId', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi.fn().mockResolvedValue({
        id: 'my-app',
        name: 'my-app',
        path: '/Users/example/work/my-app',
      }),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/my-app');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: 'my-app',
      name: 'my-app',
      path: '/Users/example/work/my-app',
    });
  });

  it('returns an error by repoId when config is missing', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigResolutionError(
            'Repository config is missing: /Users/example/.config/sift/config.json',
            'missing',
          ),
        ),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/sift');
    const data = await response.json();

    // Then
    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'Repository config is missing: /Users/example/.config/sift/config.json',
    });
  });

  it('returns an error for an unconfigured repository id', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryNotFoundError('Repository id "missing" is not configured.'),
        ),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/missing');
    const data = await response.json();

    // Then
    expect(response.status).toBe(404);
    expect(data).toEqual({
      error: 'Repository id "missing" is not configured.',
      code: 'REPOSITORY_NOT_FOUND',
    });
  });

  it('returns an error by repoId when config is invalid', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigResolutionError(
            'Repository config is invalid: Invalid JSON config: Unexpected token',
            'invalid',
          ),
        ),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/sift');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'Repository config is invalid: Invalid JSON config: Unexpected token',
    });
  });

  it('adds a repository and returns the added repository', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn().mockResolvedValue({
        id: 'sift',
        name: 'sift',
        path: '/Users/example/projects/sift',
      }),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories', {
      body: JSON.stringify({ path: '/Users/example/projects/sift' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(201);
    expect(mockUpdater.addRepository).toHaveBeenCalledWith('/Users/example/projects/sift');
    expect(mockResolver.resolveRepository).not.toHaveBeenCalled();
    expect(data).toEqual({
      id: 'sift',
      name: 'sift',
      path: '/Users/example/projects/sift',
    });
  });

  it('returns 400 when adding a repository without a path', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories', {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository path is required.' });
    expect(mockUpdater.addRepository).not.toHaveBeenCalled();
  });

  it('returns 400 when adding a repository with an invalid JSON body', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories', {
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository request body must be valid JSON.' });
    expect(mockUpdater.addRepository).not.toHaveBeenCalled();
  });

  it('returns 400 when adding a repository with a non-string path', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories', {
      body: JSON.stringify({ path: 123 }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository path must be a string.' });
    expect(mockUpdater.addRepository).not.toHaveBeenCalled();
  });

  it('returns updater errors with their configured status', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigUpdateError('Repository is already registered: /repo/sift', 409),
        ),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories', {
      body: JSON.stringify({ path: '/repo/sift' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: 'Repository is already registered: /repo/sift' });
  });

  it('reorders repositories and returns 204 No Content', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn().mockResolvedValue(undefined),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/order', {
      body: JSON.stringify({ ids: ['my-app', 'sift'] }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });

    // Then
    expect(response.status).toBe(204);
    expect(mockUpdater.reorderRepositories).toHaveBeenCalledWith(['my-app', 'sift']);
    expect(mockResolver.resolveRepository).not.toHaveBeenCalled();
  });

  it('returns 400 when reordering repositories with an invalid JSON body', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/order', {
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Reorder request body must be valid JSON.' });
    expect(mockUpdater.reorderRepositories).not.toHaveBeenCalled();
  });

  it('returns 400 when reordering repositories without ids', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/order', {
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository IDs are required.' });
    expect(mockUpdater.reorderRepositories).not.toHaveBeenCalled();
  });

  it('returns 400 when reordering repositories with non-array ids', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/order', {
      body: JSON.stringify({ ids: 'sift' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository IDs must be an array.' });
    expect(mockUpdater.reorderRepositories).not.toHaveBeenCalled();
  });

  it('returns 400 when reordering repositories with non-string ids', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/order', {
      body: JSON.stringify({ ids: ['sift', 123] }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository IDs must be strings.' });
    expect(mockUpdater.reorderRepositories).not.toHaveBeenCalled();
  });

  it('returns reorder updater errors with their configured status', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
      reorderRepositories: vi
        .fn()
        .mockRejectedValue(new RepositoryConfigUpdateError('Reorder request is invalid.', 400)),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/order', {
      body: JSON.stringify({ ids: ['sift'] }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PUT',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Reorder request is invalid.' });
  });

  it('marks repositories invalid when their paths cannot be used', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn().mockResolvedValue({
        repositories: [{ id: 'sift', name: 'sift', path: '/Users/example/projects/sift' }],
        invalidRepositories: [
          {
            id: 'missing-repo',
            reason: 'Repository path does not exist.',
            name: 'missing-repo',
            path: '/Users/example/missing-repo',
          },
        ],
      }),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({
      repositories: [
        {
          id: 'sift',
          name: 'sift',
          path: '/Users/example/projects/sift',
        },
      ],
      invalidRepositories: [
        {
          id: 'missing-repo',
          name: 'missing-repo',
          path: '/Users/example/missing-repo',
          reason: 'Repository path does not exist.',
        },
      ],
    });
  });

  it('marks one configured repository invalid when its path cannot be used', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryValidationError('Repository path is not a Git repository.'),
        ),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/invalid-repo');
    const data = await response.json();

    // Then
    expect(response.status).toBe(422);
    expect(data).toEqual({
      error: 'Repository path is not a Git repository.',
      code: 'REPOSITORY_INVALID',
    });
  });

  it('returns a validation error when configured repositories cannot build a registry', async () => {
    // Given
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigResolutionError('Repository id "sift" is duplicated.', 'invalid'),
        ),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'Repository id "sift" is duplicated.',
    });
  });

  it('removes a repository and returns 204 No Content', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn().mockResolvedValue(undefined),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/my-app', {
      method: 'DELETE',
    });

    // Then
    expect(response.status).toBe(204);
    expect(mockUpdater.removeRepository).toHaveBeenCalledWith('my-app');
  });

  it('returns 204 when removing an unconfigured repository', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi.fn().mockResolvedValue(undefined),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/missing', {
      method: 'DELETE',
    });

    // Then
    expect(response.status).toBe(204);
    expect(mockUpdater.removeRepository).toHaveBeenCalledWith('missing');
  });

  it('returns 409 when removing a duplicated repository', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
      removeRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryConfigUpdateError('Repository id "duplicate" is duplicated.', 409),
        ),
      reorderRepositories: vi.fn(),
    };
    const mockResolver = {
      resolveRepository: vi.fn(),
      listRepositories: vi.fn(),
    };
    const app = createApp(mockResolver, mockUpdater);

    // When
    const response = await app.request('/api/repositories/duplicate', {
      method: 'DELETE',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(409);
    expect(data).toEqual({ error: 'Repository id "duplicate" is duplicated.' });
  });
});
