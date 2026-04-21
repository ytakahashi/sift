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

  it('throws when configured repositories cannot be fetched', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
      }),
    );

    // When / Then
    await expect(httpRepositoryReader.fetchRepositories()).rejects.toThrow(
      'Failed to fetch repositories: Internal Server Error',
    );
  });

  it('fetches one configured repository by id', async () => {
    // Given
    const response = {
      id: 'my-app',
      isValid: true,
      name: 'my-app',
      path: '/repo/my-app',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(response),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    const repository = await httpRepositoryReader.fetchRepository('my-app');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app');
    expect(repository).toEqual(response);
  });

  it('throws when one configured repository cannot be fetched', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
      }),
    );

    // When / Then
    await expect(httpRepositoryReader.fetchRepository('missing')).rejects.toThrow(
      'Failed to fetch repository: Bad Request',
    );
  });
});
