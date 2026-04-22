import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createActionRoutes, type CreateActionRoutesOptions } from './actions';

const { discardWorkingFileMock, serviceConstructorMock } = vi.hoisted(() => ({
  discardWorkingFileMock: vi.fn(),
  serviceConstructorMock: vi.fn(),
}));

vi.mock('../services/workspace-action-service', () => ({
  WorkspaceActionService: serviceConstructorMock,
}));

function createApp(
  readConfig: NonNullable<CreateActionRoutesOptions['readConfig']> = async () => ({
    configPath: '/missing/config.json',
    status: 'missing',
  }),
): Hono<Env> {
  const app = new Hono<Env>();
  app.route('/api', createActionRoutes({ readConfig }));
  return app;
}

describe('actionRoutes discard-working-file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceConstructorMock.mockImplementation(function MockWorkspaceActionService() {
      return {
        discardWorkingFile: discardWorkingFileMock,
      };
    });
  });

  it('runs scoped discard-working-file action against the resolved repository', async () => {
    // Given
    discardWorkingFileMock.mockResolvedValue(undefined);
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
    const response = await app.request('/api/repositories/my-app/actions/discard-working-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'a.ts' }),
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(serviceConstructorMock).toHaveBeenCalledWith('/repo/my-app');
    expect(discardWorkingFileMock).toHaveBeenCalledWith('a.ts');
  });

  it('returns 400 when scoped action repoId is not configured', async () => {
    // Given
    const app = createApp(async () => ({
      config: {
        repositories: [{ id: 'sift', path: '/repo/sift' }],
      },
      status: 'found',
    }));

    // When
    const response = await app.request('/api/repositories/missing/actions/discard-working-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'a.ts' }),
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });

  it('returns 500 with error message when discard fails', async () => {
    // Given: the service throws
    discardWorkingFileMock.mockRejectedValue(new Error('discard failed'));
    const app = createApp(async () => ({
      config: {
        repositories: [{ id: 'sift', path: '/repo/sift' }],
      },
      status: 'found',
    }));

    // When
    const response = await app.request('/api/repositories/sift/actions/discard-working-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'a.ts' }),
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'discard failed' });
  });
});
