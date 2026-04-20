import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { actionRoutes } from './actions';
import { createDefaultRepository } from '../repositories/default-repository';

const { discardWorkingFileMock, serviceConstructorMock } = vi.hoisted(() => ({
  discardWorkingFileMock: vi.fn(),
  serviceConstructorMock: vi.fn(),
}));

vi.mock('../services/workspace-action-service', () => ({
  WorkspaceActionService: serviceConstructorMock,
}));

describe('actionRoutes discard-working-file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceConstructorMock.mockImplementation(function MockWorkspaceActionService() {
      return {
        discardWorkingFile: discardWorkingFileMock,
      };
    });
  });

  function createAppWithRepoRoot(repoRoot: string): Hono<Env> {
    const app = new Hono<Env>();
    const repository = createDefaultRepository(repoRoot);
    app.use('*', async (c, next) => {
      c.set('repository', repository);
      await next();
    });
    app.route('/api/actions', actionRoutes);
    return app;
  }

  it('returns success for discard-working-file action', async () => {
    // Given: the service succeeds
    discardWorkingFileMock.mockResolvedValue(undefined);
    const app = createAppWithRepoRoot('/repo/root');

    // When
    const response = await app.request('/api/actions/discard-working-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'a.ts' }),
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(serviceConstructorMock).toHaveBeenCalledWith('/repo/root');
    expect(discardWorkingFileMock).toHaveBeenCalledWith('a.ts');
  });

  it('returns 500 with error message when discard fails', async () => {
    // Given: the service throws
    discardWorkingFileMock.mockRejectedValue(new Error('discard failed'));
    const app = createAppWithRepoRoot('/repo/root');

    // When
    const response = await app.request('/api/actions/discard-working-file', {
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
