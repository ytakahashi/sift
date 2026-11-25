import { describe, expect, it, vi } from 'vitest';
import { GitRepositoryIndexProvider } from './repository-index-provider';

describe('GitRepositoryIndexProvider', () => {
  it('delegates the repository-relative paths together to GitClient', async () => {
    // Given
    const entries = new Map([['src/[literal].ts', { mode: '100644', blobId: 'blob-id' }]]);
    const getIndexEntries = vi.fn().mockResolvedValue(entries);
    const provider = new GitRepositoryIndexProvider('/repo/root', {
      git: { getIndexEntries },
    });
    const paths = ['src/[literal].ts', 'src/other.ts'];

    // When
    const result = await provider.getIndexEntries(paths);

    // Then
    expect(result).toEqual(entries);
    expect(getIndexEntries).toHaveBeenCalledExactlyOnceWith(paths);
  });

  it('does not translate Git errors into missing entries', async () => {
    // Given
    const error = new Error('git ls-files failed');
    const provider = new GitRepositoryIndexProvider('/repo/root', {
      git: { getIndexEntries: vi.fn().mockRejectedValue(error) },
    });

    // When / Then
    await expect(provider.getIndexEntries(['src/file.ts'])).rejects.toBe(error);
  });
});
