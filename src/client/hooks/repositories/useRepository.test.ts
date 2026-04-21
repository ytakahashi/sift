import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RepositoryReader } from '../../application/ports';
import { useRepository } from './useRepository';

describe('useRepository', () => {
  it('loads a repository by id on mount', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepositories: vi.fn(),
      fetchRepository: vi.fn().mockResolvedValue({
        id: 'sift',
        isValid: true,
        name: 'sift',
        path: '/repo/sift',
      }),
    };

    // When
    const { result } = renderHook(() => useRepository(repositoryReader, 'sift'));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(repositoryReader.fetchRepository).toHaveBeenCalledWith('sift');
    expect(result.current.repository?.name).toBe('sift');
    expect(result.current.error).toBeNull();
  });

  it('stores fetch errors', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepositories: vi.fn(),
      fetchRepository: vi.fn().mockRejectedValue(new Error('repository missing')),
    };

    // When
    const { result } = renderHook(() => useRepository(repositoryReader, 'missing'));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('repository missing');
    expect(result.current.repository).toBeNull();
  });
});
