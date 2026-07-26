import { describe, expect, it, vi, type Mock } from 'vitest';
import { MAX_TEXT_DIFF_BYTES } from '../../../domain/diff/file-content-limits';
import { RepositoryFileContentProvider } from './repository-file-content-provider';

function createGit(): {
  getIndexEntry: Mock<(path: string) => Promise<{ mode: string; blobId: string } | null>>;
  getBlobSize: Mock<(blobId: string) => Promise<number>>;
  getBlobContent: Mock<(blobId: string) => Promise<Buffer>>;
} {
  return {
    getIndexEntry: vi.fn().mockResolvedValue({ mode: '100644', blobId: 'blob-id' }),
    getBlobSize: vi.fn().mockResolvedValue(12),
    getBlobContent: vi.fn().mockResolvedValue(Buffer.from('hello\nworld\n')),
  };
}

describe('RepositoryFileContentProvider', () => {
  it('returns lines and the index blob id for a text file', async () => {
    // Given
    const git = createGit();
    const provider = new RepositoryFileContentProvider('/repo', { git });

    // When
    const result = await provider.getContent('src/file.ts');

    // Then
    expect(result).toEqual({ kind: 'file', blobId: 'blob-id', lines: ['hello', 'world'] });
    expect(git.getIndexEntry).toHaveBeenCalledWith('src/file.ts');
  });

  it('returns not-found when no stage-zero index entry exists', async () => {
    // Given
    const git = createGit();
    git.getIndexEntry.mockResolvedValue(null);
    const provider = new RepositoryFileContentProvider('/repo', { git });

    // When / Then
    await expect(provider.getContent('missing.ts')).resolves.toEqual({ kind: 'not-found' });
    expect(git.getBlobSize).not.toHaveBeenCalled();
  });

  it('rejects submodules and NUL-containing blobs as unsupported', async () => {
    // Given: one provider sees a gitlink and another sees binary-looking bytes
    const submoduleGit = createGit();
    submoduleGit.getIndexEntry.mockResolvedValue({ mode: '160000', blobId: 'commit-id' });
    const binaryGit = createGit();
    binaryGit.getBlobContent.mockResolvedValue(Buffer.from([1, 0, 2]));

    // When / Then
    await expect(
      new RepositoryFileContentProvider('/repo', { git: submoduleGit }).getContent('submodule'),
    ).resolves.toEqual({ kind: 'unsupported' });
    await expect(
      new RepositoryFileContentProvider('/repo', { git: binaryGit }).getContent('binary'),
    ).resolves.toEqual({ kind: 'unsupported' });
    expect(submoduleGit.getBlobSize).not.toHaveBeenCalled();
  });

  it('does not read blob content when its byte size exceeds the limit', async () => {
    // Given
    const git = createGit();
    git.getBlobSize.mockResolvedValue(MAX_TEXT_DIFF_BYTES + 1);
    const provider = new RepositoryFileContentProvider('/repo', { git });

    // When / Then
    await expect(provider.getContent('large.txt')).resolves.toEqual({ kind: 'too-large' });
    expect(git.getBlobContent).not.toHaveBeenCalled();
  });

  it('rejects text with more than the full-view line limit', async () => {
    // Given: short lines keep the blob below the byte limit while exceeding 10,000 rows
    const git = createGit();
    git.getBlobContent.mockResolvedValue(Buffer.from('x\n'.repeat(10_001)));
    const provider = new RepositoryFileContentProvider('/repo', { git });

    // When / Then
    await expect(provider.getContent('many-lines.txt')).resolves.toEqual({ kind: 'too-large' });
  });
});
