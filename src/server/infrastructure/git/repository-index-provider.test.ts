import { describe, expect, it, vi } from 'vitest';
import { GitRepositoryIndexProvider } from './repository-index-provider';

describe('GitRepositoryIndexProvider', () => {
  it('delegates the exact repository-relative path to GitClient', async () => {
    // Given
    const getIndexEntry = vi.fn().mockResolvedValue({ mode: '100644', blobId: 'blob-id' });
    const provider = new GitRepositoryIndexProvider('/repo/root', {
      git: { getIndexEntry },
    });

    // When
    const entry = await provider.getIndexEntry('src/[literal].ts');

    // Then
    expect(entry).toEqual({ mode: '100644', blobId: 'blob-id' });
    expect(getIndexEntry).toHaveBeenCalledWith('src/[literal].ts');
  });

  it('does not translate Git errors into a missing entry', async () => {
    // Given
    const error = new Error('git ls-files failed');
    const provider = new GitRepositoryIndexProvider('/repo/root', {
      git: { getIndexEntry: vi.fn().mockRejectedValue(error) },
    });

    // When / Then
    await expect(provider.getIndexEntry('src/file.ts')).rejects.toBe(error);
  });
});
