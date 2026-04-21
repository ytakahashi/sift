import { afterEach, describe, expect, it, vi } from 'vitest';
import { httpRepositoryReader } from './repositoryClient';

describe('httpRepositoryReader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches configured repositories', async () => {
    // Given
    const response = {
      config: { status: 'found' },
      repositories: [{ id: 'sift', isValid: true, name: 'sift', path: '/repo/sift' }],
    };
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(response),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    const repositories = await httpRepositoryReader.fetchRepositories();

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories');
    expect(repositories).toEqual(response);
  });
});
