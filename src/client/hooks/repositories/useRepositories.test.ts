import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RepositoryReader, RepositoryWriter } from '../../application/ports';
import { useRepositories } from './useRepositories';

describe('useRepositories', () => {
  it('loads repository list on mount', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn().mockResolvedValue({
        config: { status: 'found' },
        repositories: [{ id: 'sift', isValid: true, name: 'sift', path: '/repo/sift' }],
      }),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn(),
    };

    // When
    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.repositories?.repositories[0].id).toBe('sift');
    expect(result.current.error).toBeNull();
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
    };

    // When
    const { result } = renderHook(() => useRepositories(repositoryReader, repositoryWriter));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('network failed');
    expect(result.current.addError).toBeNull();
    expect(result.current.repositories).toBeNull();
  });

  it('adds a repository and refreshes the list', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi
        .fn()
        .mockResolvedValueOnce({
          config: { status: 'found' },
          repositories: [],
        })
        .mockResolvedValueOnce({
          config: { status: 'found' },
          repositories: [{ id: 'sift', isValid: true, name: 'sift', path: '/repo/sift' }],
        }),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn().mockResolvedValue(undefined),
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
        config: { status: 'found' },
        repositories: [],
      }),
    };
    const repositoryWriter: RepositoryWriter = {
      addRepository: vi.fn().mockRejectedValue(new Error('Repository path is not a directory.')),
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
});
