import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionReader } from '../../application/ports';
import { useSession } from './useSession';

describe('useSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches repository information on mount', async () => {
    // Given: the session reader returns a repository payload
    const fetchSession = vi.fn().mockResolvedValue({
      mode: 'repository',
      repository: {
        name: 'sift',
        root: '/Users/dev/projects/sift',
      },
      capabilities: {
        splitView: false,
        stdinMode: false,
      },
    });
    const sessionReader: SessionReader = { fetchSession };

    // When: the hook is rendered
    const { result } = renderHook(() => useSession(sessionReader));

    // Then: repository information is populated
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetchSession).toHaveBeenCalledTimes(1);
    expect(result.current.repository).toEqual({
      name: 'sift',
      root: '/Users/dev/projects/sift',
    });
    expect(result.current.error).toBeNull();
  });

  it('stores an error and clears repository when request fails', async () => {
    // Given: the session reader rejects
    const sessionReader: SessionReader = {
      fetchSession: vi
        .fn()
        .mockRejectedValue(new Error('Failed to fetch session: Internal Server Error')),
    };

    // When: the hook is rendered
    const { result } = renderHook(() => useSession(sessionReader));

    // Then: error state is populated and repository remains null
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.repository).toBeNull();
    expect(result.current.error).toBe('Failed to fetch session: Internal Server Error');
  });

  it('refreshes repository information when refresh is invoked', async () => {
    // Given: the session reader returns different repository names across requests
    const fetchSession = vi
      .fn()
      .mockResolvedValueOnce({
        mode: 'repository',
        repository: {
          name: 'sift-old',
          root: '/tmp/sift-old',
        },
        capabilities: {
          splitView: false,
          stdinMode: false,
        },
      })
      .mockResolvedValueOnce({
        mode: 'repository',
        repository: {
          name: 'sift-new',
          root: '/tmp/sift-new',
        },
        capabilities: {
          splitView: false,
          stdinMode: false,
        },
      });
    const sessionReader: SessionReader = { fetchSession };

    // When: the hook is rendered and then refreshed
    const { result } = renderHook(() => useSession(sessionReader));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    await act(async () => {
      await result.current.refresh();
    });

    // Then: the latest repository information replaces the previous value
    expect(fetchSession).toHaveBeenCalledTimes(2);
    expect(result.current.repository).toEqual({
      name: 'sift-new',
      root: '/tmp/sift-new',
    });
  });
});
