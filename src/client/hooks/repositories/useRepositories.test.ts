import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  RepositoryFetchError,
  type RepositoryReader,
  type RepositoryWriter,
} from '../../application/ports';
import { useRepositories } from './useRepositories';

describe('useRepositories', () => {
  it('loads repository list on mount', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn().mockResolvedValue({
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      }),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
    };

    // When
    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.repositories?.repositories[0].id).toBe('sift');
    expect(result.current.error).toBeNull();
    expect(result.current.configMissingError).toBeNull();
    expect(result.current.addError).toBeNull();
  });

  it('stores fetch errors', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn().mockRejectedValue(new Error('network failed')),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
    };

    // When
    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('network failed');
    expect(result.current.configMissingError).toBeNull();
    expect(result.current.addError).toBeNull();
    expect(result.current.repositories).toBeNull();
  });

  it('stores missing config errors separately', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi
        .fn()
        .mockRejectedValue(
          new RepositoryFetchError('Repository config is missing: /missing/config.json', 404),
        ),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn(),
      removeRepository: vi.fn(),
    };

    // When
    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.configMissingError).toBe(
      'Repository config is missing: /missing/config.json',
    );
    expect(result.current.error).toBeNull();
    expect(result.current.repositories).toBeNull();
  });

  it('adds a repository and refreshes the list', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi
        .fn()
        .mockResolvedValueOnce({
          invalidRepositories: [],
          repositories: [],
        })
        .mockResolvedValueOnce({
          invalidRepositories: [],
          repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
        }),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn().mockResolvedValue(undefined),
      removeRepository: vi.fn(),
    };

    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // When
    let added = false;
    await act(async () => {
      added = await result.current.addRepository('/repo/sift');
    });

    // Then
    expect(added).toBe(true);
    expect(repositoryWriter.addRepository).toHaveBeenCalledWith('/repo/sift');
    expect(repositoryReader.fetchRepositories).toHaveBeenCalledTimes(2);
    expect(result.current.repositories?.repositories[0].id).toBe('sift');
    expect(result.current.addError).toBeNull();
  });

  it('stores add errors and returns false', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn().mockResolvedValue({
        invalidRepositories: [],
        repositories: [],
      }),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn().mockRejectedValue(new Error('Repository path is not a directory.')),
      removeRepository: vi.fn(),
    };

    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // When
    let added = true;
    await act(async () => {
      added = await result.current.addRepository('/repo/sift');
    });

    // Then
    expect(added).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.addError).toBe('Repository path is not a directory.');
    expect(repositoryReader.fetchRepositories).toHaveBeenCalledTimes(1);
  });

  it('removes a repository and refreshes the list', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi
        .fn()
        .mockResolvedValueOnce({
          invalidRepositories: [],
          repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
        })
        .mockResolvedValueOnce({
          invalidRepositories: [],
          repositories: [],
        }),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn(),
      removeRepository: vi.fn().mockResolvedValue(undefined),
    };

    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // When
    let removed = false;
    await act(async () => {
      removed = await result.current.deleteRepository('sift');
    });

    // Then
    expect(removed).toBe(true);
    expect(repositoryWriter.removeRepository).toHaveBeenCalledWith('sift');
    expect(repositoryReader.fetchRepositories).toHaveBeenCalledTimes(2);
    expect(result.current.repositories?.repositories).toHaveLength(0);
    expect(result.current.deleteError).toBeNull();
    expect(result.current.deletingRepositoryId).toBeNull();
  });

  it('stores remove errors and returns false', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn().mockResolvedValue({
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      }),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn(),
      removeRepository: vi.fn().mockRejectedValue(new Error('Repository not found.')),
    };

    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // When
    let removed = true;
    await act(async () => {
      removed = await result.current.deleteRepository('sift');
    });

    // Then
    expect(removed).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.deleteError).toBe('Repository not found.');
    expect(result.current.deletingRepositoryId).toBeNull();
    expect(repositoryReader.fetchRepositories).toHaveBeenCalledTimes(1);
  });
});
