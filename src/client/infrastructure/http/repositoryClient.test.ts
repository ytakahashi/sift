import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositoryFetchError } from '../../application/ports';
import { httpRepositoryReader, httpRepositoryWriter } from './repositoryClient';

describe('httpRepositoryReader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches configured repositories', async () => {
    // Given
    const response = {
      invalidRepositories: [],
      repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
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
        status: 500,
        statusText: 'Internal Server Error',
      }),
    );

    // When / Then
    await expect(httpRepositoryReader.fetchRepositories()).rejects.toThrow(
      'Failed to fetch repositories: Internal Server Error',
    );
    await expect(httpRepositoryReader.fetchRepositories()).rejects.toThrow(RepositoryFetchError);
    await expect(httpRepositoryReader.fetchRepositories()).rejects.toMatchObject({
      statusCode: 500,
    });
  });

  it('throws a RepositoryFetchError with status when configured repositories cannot be fetched', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi
          .fn()
          .mockResolvedValue({ error: 'Repository config is missing: /missing/config.json' }),
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    // When / Then
    await expect(httpRepositoryReader.fetchRepositories()).rejects.toMatchObject({
      message: 'Repository config is missing: /missing/config.json',
      statusCode: 404,
    });
    await expect(httpRepositoryReader.fetchRepositories()).rejects.toThrow(RepositoryFetchError);
  });

  it('fetches one configured repository by id', async () => {
    // Given
    const response = {
      id: 'my-app',
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

  it('fetches one configured repository by id with URI encoding', async () => {
    // Given
    const response = {
      id: 'my repo/100%',
      name: 'my repo',
      path: '/repo/my repo/100%',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue(response),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    const repository = await httpRepositoryReader.fetchRepository('my repo/100%');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my%20repo%2F100%25');
    expect(repository).toEqual(response);
  });

  it('throws when one configured repository cannot be fetched', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      }),
    );

    // When / Then
    await expect(httpRepositoryReader.fetchRepository('missing')).rejects.toThrow(
      'Failed to fetch repository: Bad Request',
    );
    await expect(httpRepositoryReader.fetchRepository('missing')).rejects.toThrow(
      RepositoryFetchError,
    );
    await expect(httpRepositoryReader.fetchRepository('missing')).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});

describe('httpRepositoryWriter', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts repository paths to the repositories endpoint', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    await httpRepositoryWriter.addRepository('/repo/sift');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories', {
      body: JSON.stringify({ path: '/repo/sift' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });
  });

  it('throws the server error message when adding a repository fails', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'Repository path is not a directory.' }),
        ok: false,
        statusText: 'Bad Request',
      }),
    );

    // When / Then
    await expect(httpRepositoryWriter.addRepository('/repo/sift')).rejects.toThrow(
      'Repository path is not a directory.',
    );
  });

  it('sends DELETE request to the repository endpoint', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    await httpRepositoryWriter.removeRepository('my-app');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app', {
      method: 'DELETE',
    });
  });

  it('sends DELETE request to the repository endpoint with a URI-encoded repository id', async () => {
    // Given
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);

    // When
    await httpRepositoryWriter.removeRepository('my repo/100%');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my%20repo%2F100%25', {
      method: 'DELETE',
    });
  });

  it('throws the server error message when removing a repository fails', async () => {
    // Given
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ error: 'Repository id "my-app" is not configured.' }),
        ok: false,
        statusText: 'Not Found',
      }),
    );

    // When / Then
    await expect(httpRepositoryWriter.removeRepository('my-app')).rejects.toThrow(
      'Repository id "my-app" is not configured.',
    );
  });
});
