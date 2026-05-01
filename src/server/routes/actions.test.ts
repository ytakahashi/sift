import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../create-app';
import { createActionRoutes, type CreateActionRoutesOptions } from './actions';
import { RepositoryNotFoundError } from '../services/repository-resolver';
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
      listRepositories: vi.fn(),
      resolveRepository: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
    };
    const createWorkspaceActionService = vi.fn().mockReturnValue(mockService);
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService,
    });

    // When
    const response = await app.request('/api/repositories/my-app/actions/discard-working-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'a.ts' }),
    });

    // Then
    expect(response.status).toBe(204);
    // 204 No Content has no body
    expect(response.headers.get('content-type')).toBeNull();
    expect(await response.text()).toBe('');

    expect(mockResolver.resolveRepository).toHaveBeenCalledWith('my-app');
    // Verify the factory received the path resolved from the repository descriptor
    expect(createWorkspaceActionService).toHaveBeenCalledWith('/repo/my-app');
    expect(discardWorkingFileMock).toHaveBeenCalledWith('a.ts');
  });

  it('returns 404 when scoped action repoId is not configured', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi
        .fn()
        .mockRejectedValue(
          new RepositoryNotFoundError('Repository id "missing" is not configured.'),
        ),
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
    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'Repository id "missing" is not configured.' });
  });

  it('returns 500 with error message when discard fails', async () => {
    // Given: the service throws
    discardWorkingFileMock.mockRejectedValue(new Error('discard failed'));
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi.fn().mockResolvedValue({ id: 'sift', path: '/repo/sift' }),
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

  it('returns 400 when request body is not JSON', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
    };
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService: () => mockService,
    });

    // When
    const response = await app.request('/api/repositories/my-app/actions/discard-working-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid json',
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Action request body must be a JSON object.' });
  });

  it('returns 400 when request body is not an object', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
    };
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService: () => mockService,
    });

    // When
    const response = await app.request('/api/repositories/my-app/actions/discard-working-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'Action request body must be a JSON object.' });
  });

  it('returns 400 when path is missing or empty', async () => {
    // Given
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
    };
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService: () => mockService,
    });

    // When
    const response = await app.request('/api/repositories/my-app/actions/discard-working-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await response.json();

    // Then
    expect(response.status).toBe(400);
    expect(data.error).toBe('Action requires a non-empty string path parameter.');
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
      listRepositories: vi.fn(),
      resolveRepository: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
    };
    const createWorkspaceActionService = vi.fn().mockReturnValue(mockService);
    const app = createApp({
      repositoryResolver: mockResolver,
      createWorkspaceActionService,
    });

    // When
    const response = await app.request('/api/repositories/my-app/actions/stage-all-working-files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    // Then
    expect(response.status).toBe(204);
    expect(mockResolver.resolveRepository).toHaveBeenCalledWith('my-app');
    expect(createWorkspaceActionService).toHaveBeenCalledWith('/repo/my-app');
    expect(stageAllWorkingFilesMock).toHaveBeenCalled();
  });

  it('runs scoped unstage-all-staged-files action against the resolved repository', async () => {
    // Given
    unstageAllStagedFilesMock.mockResolvedValue(undefined);
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
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

    // Then
    expect(response.status).toBe(204);
    expect(unstageAllStagedFilesMock).toHaveBeenCalled();
  });

  it('runs scoped discard-all-working-files action against the resolved repository', async () => {
    // Given
    discardAllWorkingFilesMock.mockResolvedValue(undefined);
    const mockResolver = {
      listRepositories: vi.fn(),
      resolveRepository: vi.fn().mockResolvedValue({ id: 'my-app', path: '/repo/my-app' }),
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

    // Then
    expect(response.status).toBe(204);
    expect(discardAllWorkingFilesMock).toHaveBeenCalled();
  });
});
