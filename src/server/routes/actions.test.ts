import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createActionRoutes, type CreateActionRoutesOptions } from './actions';
import { RepositoryResolutionError } from '../services/repository-resolver';
import type { WorkspaceActionService } from '../services/workspace-action-service';

const discardWorkingFileMock = vi.fn();
const stageAllWorkingFilesMock = vi.fn();
const unstageAllStagedFilesMock = vi.fn();
const discardAllWorkingFilesMock = vi.fn();

const mockService: WorkspaceActionService = {
  stageFile: vi.fn(),
  unstageFile: vi.fn(),
  stageAllWorkingFiles: stageAllWorkingFilesMock,
  unstageAllStagedFiles: unstageAllStagedFilesMock,
  stageHunk: vi.fn(),
  unstageHunk: vi.fn(),
  discardWorkingFile: discardWorkingFileMock,
  discardAllWorkingFiles: discardAllWorkingFilesMock,
};

function createApp(options: CreateActionRoutesOptions): Hono<Env> {
  const app = new Hono<Env>();
  app.route('/api', createActionRoutes(options));
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
      resolveRepository: vi.fn(),
      list: vi.fn(),
    };
    const createWorkspaceActionService = vi.fn().mockReturnValue(mockService);
    const app = createApp({ repositoryResolver: mockResolver, createWorkspaceActionService });

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
    // Verify the factory received the path resolved from the repository descriptor
    expect(createWorkspaceActionService).toHaveBeenCalledWith('/repo/my-app');
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
      resolveRepository: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService: () => mockService,
    });

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
      resolveRepository: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService: () => mockService,
    });

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

describe('actionRoutes bulk actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs scoped stage-all-working-files action against the resolved repository', async () => {
    // Given
    stageAllWorkingFilesMock.mockResolvedValue(undefined);
    const mockResolver = {
      resolve: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
      resolveRepository: vi.fn(),
      list: vi.fn(),
    };
    const createWorkspaceActionService = vi.fn().mockReturnValue(mockService);
    const app = createApp({ repositoryResolver: mockResolver, createWorkspaceActionService });

    // When
    const response = await app.request('/api/repositories/my-app/actions/stage-all-working-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(mockResolver.resolve).toHaveBeenCalledWith('my-app');
    expect(createWorkspaceActionService).toHaveBeenCalledWith('/repo/my-app');
    expect(stageAllWorkingFilesMock).toHaveBeenCalled();
  });

  it('runs scoped unstage-all-staged-files action against the resolved repository', async () => {
    // Given
    unstageAllStagedFilesMock.mockResolvedValue(undefined);
    const mockResolver = {
      resolve: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
      resolveRepository: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService: () => mockService,
    });

    // When
    const response = await app.request(
      '/api/repositories/my-app/actions/unstage-all-staged-files',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(unstageAllStagedFilesMock).toHaveBeenCalled();
  });

  it('runs scoped discard-all-working-files action against the resolved repository', async () => {
    // Given
    discardAllWorkingFilesMock.mockResolvedValue(undefined);
    const mockResolver = {
      resolve: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
      resolveRepository: vi.fn(),
      list: vi.fn(),
    };
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService: () => mockService,
    });

    // When
    const response = await app.request(
      '/api/repositories/my-app/actions/discard-all-working-files',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
    );
    const data = await response.json();

    // Then
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    expect(discardAllWorkingFilesMock).toHaveBeenCalled();
  });
});
