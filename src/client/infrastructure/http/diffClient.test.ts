import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpDiffReader } from './diffClient';

describe('httpDiffReader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches diff data from the repository-scoped endpoint', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        stagedFiles: [{ id: 'staged.ts' }],
        workingFiles: [{ id: 'working.ts' }],
      }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    const data = await httpDiffReader.fetchDiff('my-app');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app/diff');
    expect(data).toEqual({
      stagedFiles: [{ id: 'staged.ts' }],
      workingFiles: [{ id: 'working.ts' }],
    });
  });
});
