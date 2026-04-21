import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createDefaultRepository } from '../repositories/default-repository';
import { createRepositoryRoutes } from './repositories';
import type { ServerRepository } from '../repositories/server-repository';

function createAppWithRepository(
  repoRoot: string,
  readConfig: Parameters<typeof createRepositoryRoutes>[0]['readConfig'],
  validateRepository: Parameters<
    typeof createRepositoryRoutes
  >[0]['validateRepository'] = async () => ({
    isValid: true,
  }),
): Hono<Env> {
  const app = new Hono<Env>();
  const repository = createDefaultRepository(repoRoot);

  app.use('*', async (c, next) => {
    c.set('repository', repository);
    await next();
  });

  app.route('/api/repositories', createRepositoryRoutes({ readConfig, validateRepository }));
  return app;
}

describe('repositoryRoutes', () => {
  it('returns configured repositories', async () => {
    // Given
    const app = createAppWithRepository('/current/repo', async () => ({
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

  it('returns the current repository fallback when config is missing', async () => {
    // Given
    const app = createAppWithRepository('/Users/example/current-repo', async () => ({
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
      repositories: [
        {
          id: 'default',
          isValid: true,
          name: 'current-repo',
          path: '/Users/example/current-repo',
        },
      ],
    });
  });

  it('returns one configured repository by repoId', async () => {
    // Given
    const app = createAppWithRepository('/current/repo', async () => ({
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

  it('returns the default repository by repoId when config is missing', async () => {
    // Given
    const app = createAppWithRepository('/Users/example/current-repo', async () => ({
      configPath: '/Users/example/.config/sift/config.json',
      status: 'missing',
    }));

    // When
    const response = await app.request('/api/repositories/default');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({
      id: 'default',
      isValid: true,
      name: 'current-repo',
      path: '/Users/example/current-repo',
    });
  });

  it('returns an error for an unconfigured repository id', async () => {
    // Given
    const app = createAppWithRepository('/current/repo', async () => ({
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
    const app = createAppWithRepository(
      '/current/repo',
      async () => ({
        config: {
          repositories: [
            { id: 'sift', path: '/Users/example/projects/sift' },
            { id: 'missing-repo', path: '/Users/example/missing-repo' },
          ],
        },
        status: 'found',
      }),
      async (repository: ServerRepository) =>
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

  it('returns a validation error when configured repositories cannot build a registry', async () => {
    // Given
    const app = createAppWithRepository('/current/repo', async () => ({
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
