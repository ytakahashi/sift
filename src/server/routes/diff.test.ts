import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createDiffRoutes, type CreateDiffRoutesOptions } from './diff';

const { getFilesMock, providerConstructorMock } = vi.hoisted(() => ({
  getFilesMock: vi.fn(),
  providerConstructorMock: vi.fn(),
}));

vi.mock('../infrastructure/diff/repository-diff-provider', () => ({
  RepositoryDiffProvider: providerConstructorMock,
}));

function createApp(readConfig: NonNullable<CreateDiffRoutesOptions['readConfig']>): Hono<Env> {
  const app = new Hono<Env>();
  app.route('/api', createDiffRoutes({ readConfig }));
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
    providerConstructorMock.mockImplementation(function MockRepositoryDiffProvider() {
      return {
        getFiles: getFilesMock,
      };
    });
  });

  it('returns diff for the repository resolved from repoId', async () => {
    // Given
    const app = createApp(async () => ({
      config: {
        repositories: [
          { id: 'sift', path: '/repo/sift' },
          { id: 'my-app', path: '/repo/my-app' },
        ],
      },
      status: 'found',
    }));

    // When
    const response = await app.request('/api/repositories/my-app/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(providerConstructorMock).toHaveBeenCalledWith('/repo/my-app');
    expect(data.metadata.repoRoot).toBe('/repo/my-app');
  });

  it('returns an error when repoId is not configured', async () => {
    // Given
    const app = createApp(async () => ({
      config: {
        repositories: [{ id: 'sift', path: '/repo/sift' }],
      },
      status: 'found',
    }));

    // When
    const response = await app.request('/api/repositories/missing/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });

  it('returns an error when config is missing for a non-default scoped diff', async () => {
    // Given
    const app = createApp(async () => ({
      configPath: '/missing/config.json',
      status: 'missing',
    }));

    // When
    const response = await app.request('/api/repositories/sift/diff');
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository config is missing: /missing/config.json' });
  });
});
