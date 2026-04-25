import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createRepositoryRoutes } from './repositories';
import type { RepositoryDescriptor } from '../../domain/repository/repository';
import { createRepositoryResolver } from '../infrastructure/repository-resolver-impl';
import type { RepositoryConfigReadResult } from '../infrastructure/config/repository-config-reader';
import type { RepositoryValidator } from '../infrastructure/repository-validator';

function createApp(
  readConfig: () => Promise<RepositoryConfigReadResult>,
  validateRepository: RepositoryValidator = async () => ({
    isValid: true,
  }),
): Hono<Env> {
  const app = new Hono<Env>();
  const repositoryResolver = createRepositoryResolver(readConfig, validateRepository);
  app.route('/api/repositories', createRepositoryRoutes({ repositoryResolver }));
  return app;
}

describe('repositoryRoutes', () => {
  it('returns configured repositories', async () => {
    // Given
    const app = createApp(async () => ({
      config: {
        repositories: [
          { id: 'sift', path: '/Users/example/projects/sift' },
          { id: 'my-app', path: '/Users/example/work/my-app' },
        ],
      },
      status: 'found',
    }));

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
    const app = createApp(async () => ({
      configPath: '/Users/example/.config/sift/config.json',
      status: 'missing',
    }));

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
    const app = createApp(async () => ({
      configPath: '/Users/example/.config/sift/config.json',
      error: 'Invalid JSON config: Unexpected token',
      status: 'invalid',
    }));

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
    const app = createApp(async () => ({
      config: {
        repositories: [
          { id: 'sift', path: '/Users/example/projects/sift' },
          { id: 'my-app', path: '/Users/example/work/my-app' },
        ],
      },
      status: 'found',
    }));

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
    const app = createApp(async () => ({
      configPath: '/Users/example/.config/sift/config.json',
      status: 'missing',
    }));

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
    const app = createApp(async () => ({
      config: {
        repositories: [{ id: 'sift', path: '/repo/sift' }],
      },
      status: 'found',
    }));

    // When
    const response = await app.request('/api/repositories/missing');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });

  it('marks repositories invalid when their paths cannot be used', async () => {
    // Given
    const app = createApp(
      async () => ({
        config: {
          repositories: [
            { id: 'sift', path: '/Users/example/projects/sift' },
            { id: 'missing-repo', path: '/Users/example/missing-repo' },
          ],
        },
        status: 'found',
      }),
      async (repository: RepositoryDescriptor) =>
        repository.id === 'missing-repo'
          ? {
              error: 'Repository path does not exist.',
              isValid: false,
            }
          : {
              isValid: true,
            },
    );

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
    const app = createApp(
      async () => ({
        config: {
          repositories: [{ id: 'invalid-repo', path: '/Users/example/invalid-repo' }],
        },
        status: 'found',
      }),
      async () => ({
        error: 'Repository path is not a Git repository.',
        isValid: false,
      }),
    );

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
    const app = createApp(async () => ({
      config: {
        repositories: [
          { id: 'sift', path: '/repo/sift' },
          { id: 'sift', path: '/repo/other' },
        ],
      },
      status: 'found',
    }));

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
