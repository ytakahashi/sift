import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSession } from './useSession';

function createResponse(body: unknown, ok = true, statusText = 'OK'): Response {
  return {
    ok,
    statusText,
    json: async () => body,
  } as Response;
}

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches repository information on mount', async () => {
    // Given: /api/session returns a repository payload
    const fetchMock = vi.fn().mockResolvedValue(
      createResponse({
        mode: 'repository',
        repository: {
          name: 'sift',
          root: '/Users/dev/projects/sift',
        },
        capabilities: {
          splitView: false,
          stdinMode: false,
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    // When: the hook is rendered
    const { result } = renderHook(() => useSession());

    // Then: repository information is populated
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/session');
    expect(result.current.repository).toEqual({
      name: 'sift',
      root: '/Users/dev/projects/sift',
    });
    expect(result.current.error).toBeNull();
  });

  it('stores an error and clears repository when request fails', async () => {
    // Given: /api/session returns an unsuccessful HTTP response
    const fetchMock = vi.fn().mockResolvedValue(createResponse({}, false, 'Internal Server Error'));
    vi.stubGlobal('fetch', fetchMock);

    // When: the hook is rendered
    const { result } = renderHook(() => useSession());

    // Then: error state is populated and repository remains null
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.repository).toBeNull();
    expect(result.current.error).toBe('Failed to fetch session: Internal Server Error');
  });

  it('refreshes repository information when refresh is invoked', async () => {
    // Given: the endpoint returns different repository names across requests
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        createResponse({
          mode: 'repository',
          repository: {
            name: 'sift-old',
            root: '/tmp/sift-old',
          },
          capabilities: {
            splitView: false,
            stdinMode: false,
          },
        }),
      )
      .mockResolvedValueOnce(
        createResponse({
          mode: 'repository',
          repository: {
            name: 'sift-new',
            root: '/tmp/sift-new',
          },
          capabilities: {
            splitView: false,
            stdinMode: false,
          },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    // When: the hook is rendered and then refreshed
    const { result } = renderHook(() => useSession());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    await act(async () => {
      await result.current.refresh();
    });

    // Then: the latest repository information replaces the previous value
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.repository).toEqual({
      name: 'sift-new',
      root: '/tmp/sift-new',
    });
  });
});
