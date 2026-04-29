import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createRepositoryRoutes } from './repositories';
import {
  RepositoryConfigUpdateError,
  type RepositoryConfigUpdater,
} from '../services/repository-config';
import {
  RepositoryResolutionError,
  type RepositoryResolver,
} from '../services/repository-resolver';

function createApp(
  repositoryResolver: RepositoryResolver,
  repositoryConfigUpdater: RepositoryConfigUpdater = {
    addRepository: vi.fn(),
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
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn().mockResolvedValue({
        config: { status: 'found' },
        repositories: [
          { id: 'sift', isValid: true, name: 'sift', path: '/Users/example/projects/sift' },
          { id: 'my-app', isValid: true, name: 'my-app', path: '/Users/example/work/my-app' },
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
      config: {
        status: 'found',
      },
      repositories: [
        {
          id: 'sift',
          isValid: true,
          name: 'sift',
          path: '/Users/example/projects/sift',
        },
        {
          id: 'my-app',
          isValid: true,
          name: 'my-app',
          path: '/Users/example/work/my-app',
        },
      ],
    });
  });

  it('returns an empty repository list when config is missing', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn().mockResolvedValue({
        config: { path: '/Users/example/.config/sift/config.json', status: 'missing' },
        repositories: [],
      }),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({
      config: {
        path: '/Users/example/.config/sift/config.json',
        status: 'missing',
      },
      repositories: [],
    });
  });

  it('returns an empty repository list and 400 when config is invalid', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn().mockResolvedValue({
        config: { error: 'Invalid JSON config: Unexpected token', status: 'invalid' },
        repositories: [],
      }),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({
      config: {
        error: 'Invalid JSON config: Unexpected token',
        status: 'invalid',
      },
      repositories: [],
    });
  });

  it('returns one configured repository by repoId', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn().mockResolvedValue({
        id: 'my-app',
        isValid: true,
        name: 'my-app',
        path: '/Users/example/work/my-app',
      }),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/my-app');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: 'my-app',
      isValid: true,
      name: 'my-app',
      path: '/Users/example/work/my-app',
    });
  });

  it('returns an error by repoId when config is missing', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi
        .fn()
        .mockRejectedValue(
          new RepositoryResolutionError(
            'Repository config is missing: /Users/example/.config/sift/config.json',
          ),
        ),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/sift');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({
      error: 'Repository config is missing: /Users/example/.config/sift/config.json',
    });
  });

  it('returns an error for an unconfigured repository id', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi
        .fn()
        .mockRejectedValue(
          new RepositoryResolutionError('Repository id "missing" is not configured.'),
        ),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/missing');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });

  it('adds a repository and returns the added item without validation status', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn().mockResolvedValue({
        id: 'sift',
        path: '/Users/example/projects/sift',
      }),
    };
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn().mockResolvedValue({
        id: 'sift',
        isValid: true,
        name: 'sift',
        path: '/Users/example/projects/sift',
      }),
      list: vi.fn(),
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
    expect(mockResolver.resolveItem).toHaveBeenCalledWith('sift');
    expect(data).toEqual({
      repository: {
        id: 'sift',
        name: 'sift',
        path: '/Users/example/projects/sift',
      },
    });
  });

  it('returns 400 when adding a repository without a path', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
    };
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn(),
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

  it('returns 400 when adding a repository with a non-string path', async () => {
    // Given
    const mockUpdater = {
      addRepository: vi.fn(),
    };
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn(),
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
    };
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn(),
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

  it('marks repositories invalid when their paths cannot be used', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn().mockResolvedValue({
        config: { status: 'found' },
        repositories: [
          { id: 'sift', isValid: true, name: 'sift', path: '/Users/example/projects/sift' },
          {
            id: 'missing-repo',
            isValid: false,
            error: 'Repository path does not exist.',
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
      config: {
        status: 'found',
      },
      repositories: [
        {
          id: 'sift',
          isValid: true,
          name: 'sift',
          path: '/Users/example/projects/sift',
        },
        {
          error: 'Repository path does not exist.',
          id: 'missing-repo',
          isValid: false,
          name: 'missing-repo',
          path: '/Users/example/missing-repo',
        },
      ],
    });
  });

  it('marks one configured repository invalid when its path cannot be used', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn().mockResolvedValue({
        id: 'invalid-repo',
        isValid: false,
        error: 'Repository path is not a Git repository.',
        name: 'invalid-repo',
        path: '/Users/example/invalid-repo',
      }),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories/invalid-repo');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({
      error: 'Repository path is not a Git repository.',
      id: 'invalid-repo',
      isValid: false,
      name: 'invalid-repo',
      path: '/Users/example/invalid-repo',
    });
  });

  it('returns a validation error when configured repositories cannot build a registry', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn().mockResolvedValue({
        config: { error: 'Repository id "sift" is duplicated.', status: 'invalid' },
        repositories: [],
      }),
    };
    const app = createApp(mockResolver);

    // When
    const response = await app.request('/api/repositories');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({
      config: {
        error: 'Repository id "sift" is duplicated.',
        status: 'invalid',
      },
      repositories: [],
    });
  });
});
