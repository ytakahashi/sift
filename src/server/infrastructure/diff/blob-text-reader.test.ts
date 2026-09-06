import { describe, expect, it, vi, type Mock } from 'vitest';
import {
  MAX_FULL_FILE_VIEW_LINES,
  MAX_TEXT_DIFF_BYTES,
} from '../../../domain/diff/file-content-limits';
import { readBlobAsText } from './blob-text-reader';

function createGit(): {
  getBlobSize: Mock<(blobId: string) => Promise<number>>;
  getBlobContent: Mock<(blobId: string) => Promise<Buffer>>;
} {
  return {
    getBlobSize: vi.fn().mockResolvedValue(12),
    getBlobContent: vi.fn().mockResolvedValue(Buffer.from('hello\nworld\n')),
  };
}

describe('readBlobAsText', () => {
  it('returns text lines without adding a line for a trailing newline', async () => {
    // Given
    const git = createGit();

    // When
    const result = await readBlobAsText(git, 'blob-id');

    // Then
    expect(result).toEqual({ kind: 'file', lines: ['hello', 'world'] });
    expect(git.getBlobSize).toHaveBeenCalledWith('blob-id');
    expect(git.getBlobContent).toHaveBeenCalledWith('blob-id');
  });

  it('returns an empty line collection for an empty blob', async () => {
    // Given
    const git = createGit();
    git.getBlobSize.mockResolvedValue(0);
    git.getBlobContent.mockResolvedValue(Buffer.alloc(0));

    // When / Then
    await expect(readBlobAsText(git, 'empty-blob')).resolves.toEqual({
      kind: 'file',
      lines: [],
    });
  });

  it('does not read content when the byte limit is exceeded', async () => {
    // Given
    const git = createGit();
    git.getBlobSize.mockResolvedValue(MAX_TEXT_DIFF_BYTES + 1);

    // When / Then
    await expect(readBlobAsText(git, 'large-blob')).resolves.toEqual({ kind: 'too-large' });
    expect(git.getBlobContent).not.toHaveBeenCalled();
  });

  it('rejects NUL-containing content as unsupported', async () => {
    // Given
    const git = createGit();
    git.getBlobContent.mockResolvedValue(Buffer.from([1, 0, 2]));

    // When / Then
    await expect(readBlobAsText(git, 'binary-blob')).resolves.toEqual({ kind: 'unsupported' });
  });

  it('rejects content over the line limit', async () => {
    // Given: short lines stay under the byte limit while exceeding the line limit
    const git = createGit();
    git.getBlobContent.mockResolvedValue(Buffer.from('x\n'.repeat(MAX_FULL_FILE_VIEW_LINES + 1)));

    // When / Then
    await expect(readBlobAsText(git, 'many-lines-blob')).resolves.toEqual({ kind: 'too-large' });
  });

  it('propagates Git read failures', async () => {
    // Given
    const git = createGit();
    git.getBlobSize.mockRejectedValue(new Error('git failed'));

    // When / Then
    await expect(readBlobAsText(git, 'blob-id')).rejects.toThrow('git failed');
  });
});
