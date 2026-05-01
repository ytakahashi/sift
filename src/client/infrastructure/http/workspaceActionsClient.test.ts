import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpWorkspaceActions } from './workspaceActionsClient';

describe('httpWorkspaceActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts file actions to the repository-scoped endpoint', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    await httpWorkspaceActions.stageFile('my-app', 'src/app.ts');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app/actions/stage-file', {
      body: JSON.stringify({ path: 'src/app.ts' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  it('posts hunk actions with both path and hunk id', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    await httpWorkspaceActions.unstageHunk('my-app', 'src/app.ts', 'hunk-1');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app/actions/unstage-hunk', {
      body: JSON.stringify({ path: 'src/app.ts', hunkId: 'hunk-1' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  it('posts bulk actions to repository-scoped endpoints', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    await httpWorkspaceActions.stageAllWorkingFiles('my-app');
    await httpWorkspaceActions.unstageAllStagedFiles('my-app');
    await httpWorkspaceActions.discardAllWorkingFiles('my-app');

    // Then
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/repositories/my-app/actions/stage-all-working-files',
      {
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/repositories/my-app/actions/unstage-all-staged-files',
      {
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/repositories/my-app/actions/discard-all-working-files',
      {
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      },
    );
  });

  it('throws WorkspaceActionError on failure', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: 'Validation failed' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    // When & Then
    await expect(httpWorkspaceActions.stageFile('my-app', 'src/app.ts')).rejects.toMatchObject({
      name: 'WorkspaceActionError',
      message: 'Validation failed',
      statusCode: 400,
    });
  });
});
