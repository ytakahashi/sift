import { describe, expect, it, vi, type Mock } from 'vitest';
import type { GitObjectType } from '../git/git-client';
import { RepositoryBlobContentProvider } from './repository-blob-content-provider';

function createGit(): {
  getObjectType: Mock<(objectId: string) => Promise<GitObjectType | null>>;
  getBlobSize: Mock<(blobId: string) => Promise<number>>;
  getBlobContent: Mock<(blobId: string) => Promise<Buffer>>;
} {
  return {
    getObjectType: vi.fn().mockResolvedValue('blob'),
    getBlobSize: vi.fn().mockResolvedValue(5),
    getBlobContent: vi.fn().mockResolvedValue(Buffer.from('hello')),
  };
}

describe('RepositoryBlobContentProvider', () => {
  it('reads an existing blob as text', async () => {
    // Given
    const git = createGit();
    const provider = new RepositoryBlobContentProvider('/repo', { git });

    // When
    const result = await provider.getContent('abc123');

    // Then
    expect(result).toEqual({ kind: 'file', lines: ['hello'] });
    expect(git.getObjectType).toHaveBeenCalledWith('abc123');
    expect(git.getBlobContent).toHaveBeenCalledWith('abc123');
  });

  it.each([null, 'tree', 'commit', 'tag'] as const)(
    'returns not-found without reading content for object type %s',
    async (objectType) => {
      // Given
      const git = createGit();
      git.getObjectType.mockResolvedValue(objectType);
      const provider = new RepositoryBlobContentProvider('/repo', { git });

      // When / Then
      await expect(provider.getContent('abc123')).resolves.toEqual({ kind: 'not-found' });
      expect(git.getBlobSize).not.toHaveBeenCalled();
      expect(git.getBlobContent).not.toHaveBeenCalled();
    },
  );

  it('propagates object lookup failures', async () => {
    // Given
    const git = createGit();
    git.getObjectType.mockRejectedValue(new Error('git failed'));
    const provider = new RepositoryBlobContentProvider('/repo', { git });

    // When / Then
    await expect(provider.getContent('abc123')).rejects.toThrow('git failed');
  });
});
