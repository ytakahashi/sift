import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RepositoryFetchError, type RepositoryReader } from '../../application/ports';
import { useRepositoryList } from './useRepositoryList';

describe('useRepositoryList', () => {
  it('loads repository list when enabled', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn().mockResolvedValue({
        invalidRepositories: [],
        repositories: [{ id: 'sift', name: 'sift', path: '/repo/sift' }],
      }),
    };

    // When
    const { result } = renderHook(() => useRepositoryList(repositoryReader));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.repositories?.repositories[0].id).toBe('sift');
    expect(result.current.error).toBeNull();
    expect(result.current.configMissingError).toBeNull();
  });

  it('classifies missing config errors separately', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi
        .fn()
        .mockRejectedValue(
          new RepositoryFetchError('Repository config is missing: /missing/config.json', 404),
        ),
    };

    // When
    const { result } = renderHook(() => useRepositoryList(repositoryReader));

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

  it('stores other fetch errors as general errors', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn().mockRejectedValue(new Error('network failed')),
    };

    // When
    const { result } = renderHook(() => useRepositoryList(repositoryReader));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('network failed');
    expect(result.current.configMissingError).toBeNull();
    expect(result.current.repositories).toBeNull();
  });

  it('does not fetch while disabled', () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn(),
    };

    // When
    const { result } = renderHook(() => useRepositoryList(repositoryReader, { enabled: false }));

    // Then
    expect(repositoryReader.fetchRepositories).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.repositories).toBeNull();
  });
});
