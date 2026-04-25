import { describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createRepositoryRoutes } from './repositories';
import { RepositoryResolutionError, type RepositoryResolver } from '../services/repository-resolver';

function createApp(repositoryResolver: RepositoryResolver): Hono<Env> {
  const app = new Hono<Env>();
  app.route('/api/repositories', createRepositoryRoutes({ repositoryResolver }));
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
      resolveItem: vi.fn().mockRejectedValue(new RepositoryResolutionError('Repository config is missing: /Users/example/.config/sift/config.json')),
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
      resolveItem: vi.fn().mockRejectedValue(new RepositoryResolutionError('Repository id "missing" is not configured.')),
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

  it('marks repositories invalid when their paths cannot be used', async () => {
    // Given
    const mockResolver = {
      resolve: vi.fn(),
      resolveItem: vi.fn(),
      list: vi.fn().mockResolvedValue({
        config: { status: 'found' },
        repositories: [
          { id: 'sift', isValid: true, name: 'sift', path: '/Users/example/projects/sift' },
          { id: 'missing-repo', isValid: false, error: 'Repository path does not exist.', name: 'missing-repo', path: '/Users/example/missing-repo' },
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
