import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpWorkspaceActions } from './workspaceActionsClient';

describe('httpWorkspaceActions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts file actions to the repository-scoped endpoint', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ success: true }),
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
      json: vi.fn().mockResolvedValue({ success: true }),
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
});
