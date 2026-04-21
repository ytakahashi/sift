import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { RepositoryReader } from '../../application/ports';
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

    // When
    const { result } = renderHook(() => useRepositories(repositoryReader));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.repositories?.repositories[0].id).toBe('sift');
    expect(result.current.error).toBeNull();
  });

  it('stores fetch errors', async () => {
    // Given
    const repositoryReader: RepositoryReader = {
      fetchRepository: vi.fn(),
      fetchRepositories: vi.fn().mockRejectedValue(new Error('network failed')),
    };

    // When
    const { result } = renderHook(() => useRepositories(repositoryReader));

    // Then
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.error).toBe('network failed');
    expect(result.current.repositories).toBeNull();
  });
});
