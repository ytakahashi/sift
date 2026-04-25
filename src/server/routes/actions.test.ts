import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createActionRoutes } from './actions';
import {
  RepositoryResolutionError,
  type RepositoryResolver,
} from '../services/repository-resolver';
import type { WorkspaceActionService } from '../services/workspace-action-service';

const discardWorkingFileMock = vi.fn();

const mockService: WorkspaceActionService = {
  stageFile: vi.fn(),
  unstageFile: vi.fn(),
  stageHunk: vi.fn(),
  unstageHunk: vi.fn(),
  discardWorkingFile: discardWorkingFileMock,
};

function createApp(repositoryResolver: RepositoryResolver): Hono<Env> {
  const app = new Hono<Env>();
  app.route(
    '/api',
    createActionRoutes({
      repositoryResolver,
      createWorkspaceActionService: () => mockService,
    }),
  );
  return app;
}

describe('actionRoutes discard-working-file', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs scoped discard-working-file action against the resolved repository', async () => {
    // Given
    discardWorkingFileMock.mockResolvedValue(undefined);
    const mockResolver = {
      resolve: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
      resolveItem: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

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
    expect(mockResolver.resolve).toHaveBeenCalledWith('my-app');
    expect(discardWorkingFileMock).toHaveBeenCalledWith('a.ts');
  });

  it('returns 400 when scoped action repoId is not configured', async () => {
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
    const mockResolver = {
      resolve: vi.fn().mockResolvedValue({ id: 'sift', path: '/repo/sift' }),
      resolveItem: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp(mockResolver);

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
