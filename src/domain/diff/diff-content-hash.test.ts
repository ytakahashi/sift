import { describe, it, expect } from 'vitest';
import { computeDiffContentHash } from './diff-content-hash';
import type { DiffFile, DiffHunk } from './types';

// Helper to create mock DiffFile
function createMockDiffFile(
  path: string,
  hunks: DiffHunk[],
  overrides: Partial<DiffFile> = {},
): DiffFile {
  return {
    id: path,
    bucket: 'working',
    path,
    status: 'modified',
    kind: 'text',
    displayPath: path,
    hunks,
    ...overrides,
  };
}

describe('computeDiffContentHash', () => {
  it('should generate the same hash when hunks are moved between working and staged', () => {
    // Given
    // We simulate a scenario where a file has two hunks, one in working and one in staged.
    // Then we simulate the user staging the working hunk, so both hunks are in staged.
    // The content across both stages remains exactly the same.
    const hunk1: DiffHunk = {
      id: 'hunk1',
      header: '@@ -1,3 +1,3 @@',
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 3,
      lines: [
        { id: '1', type: 'context', content: 'context1' },
        { id: '2', type: 'delete', content: 'old1' },
        { id: '3', type: 'add', content: 'new1' },
      ],
    };

    const hunk2: DiffHunk = {
      id: 'hunk2',
      header: '@@ -10,3 +10,3 @@',
      oldStart: 10,
      oldLines: 3,
      newStart: 10,
      newLines: 3,
      lines: [
        { id: '4', type: 'context', content: 'context2' },
        { id: '5', type: 'delete', content: 'old2' },
        { id: '6', type: 'add', content: 'new2' },
      ],
    };

    const beforeWorking = [createMockDiffFile('src/file.ts', [hunk2])];
    const beforeStaged = [createMockDiffFile('src/file.ts', [hunk1])];

    const afterWorking: DiffFile[] = [];
    const afterStaged = [createMockDiffFile('src/file.ts', [hunk1, hunk2])];

    // When
    const hashBefore = computeDiffContentHash(beforeWorking, beforeStaged);
    const hashAfter = computeDiffContentHash(afterWorking, afterStaged);

    // Then
    // The hashes must be identical because we sort the add/delete lines,
    // so the order of hunk evaluation (working vs staged) does not matter.
    expect(hashBefore).toEqual(hashAfter);
  });

  it('should ignore context lines when calculating hash', () => {
    // Given
    // Two files that differ only by context lines. This can happen legitimately
    // when Git merges adjacent hunks, deduplicating the context lines between them.
    const hunkWithMoreContext: DiffHunk = {
      id: 'hunk1',
      header: '@@ -1,4 +1,4 @@',
      oldStart: 1,
      oldLines: 4,
      newStart: 1,
      newLines: 4,
      lines: [
        { id: '1', type: 'context', content: 'context-a' },
        { id: '2', type: 'context', content: 'context-b' },
        { id: '3', type: 'delete', content: 'old' },
        { id: '4', type: 'add', content: 'new' },
      ],
    };

    const hunkWithLessContext: DiffHunk = {
      id: 'hunk2',
      header: '@@ -2,3 +2,3 @@',
      oldStart: 2,
      oldLines: 3,
      newStart: 2,
      newLines: 3,
      lines: [
        { id: '2', type: 'context', content: 'context-b' },
        { id: '3', type: 'delete', content: 'old' },
        { id: '4', type: 'add', content: 'new' },
      ],
    };

    // When
    const hashMore = computeDiffContentHash(
      [createMockDiffFile('file.ts', [hunkWithMoreContext])],
      [],
    );
    const hashLess = computeDiffContentHash(
      [createMockDiffFile('file.ts', [hunkWithLessContext])],
      [],
    );

    // Then
    // Context lines are ignored, so the hashes must be identical.
    expect(hashMore).toEqual(hashLess);
  });

  it('should generate different hashes for different actual contents', () => {
    // Given
    const hunkOld: DiffHunk = {
      id: 'hunkA',
      header: '@@ -1,2 +1,2 @@',
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 2,
      lines: [
        { id: '1', type: 'delete', content: 'apple' },
        { id: '2', type: 'add', content: 'banana' },
      ],
    };

    const hunkNew: DiffHunk = {
      id: 'hunkB',
      header: '@@ -1,2 +1,2 @@',
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 2,
      lines: [
        { id: '1', type: 'delete', content: 'apple' },
        { id: '2', type: 'add', content: 'cherry' },
      ],
    };

    // When
    const hash1 = computeDiffContentHash([createMockDiffFile('fruits.txt', [hunkOld])], []);
    const hash2 = computeDiffContentHash([createMockDiffFile('fruits.txt', [hunkNew])], []);

    // Then
    expect(hash1).not.toEqual(hash2);
  });

  it('should generate different hashes for rename-only changes', () => {
    // Given: two files with the same path but different rename metadata
    const before = [
      createMockDiffFile('src/new-name.ts', [], {
        oldPath: 'src/old-name.ts',
        status: 'renamed',
      }),
    ];
    const after = [createMockDiffFile('src/new-name.ts', [])];

    // When
    const hashBefore = computeDiffContentHash(before, []);
    const hashAfter = computeDiffContentHash(after, []);

    // Then
    expect(hashBefore).not.toEqual(hashAfter);
  });

  it('should generate different hashes for binary file changes', () => {
    // Given: a binary diff and an otherwise empty text diff for the same path
    const before = [
      createMockDiffFile('image.png', [], {
        status: 'binary',
        kind: 'binary',
      }),
    ];
    const after = [createMockDiffFile('image.png', [])];

    // When
    const hashBefore = computeDiffContentHash(before, []);
    const hashAfter = computeDiffContentHash(after, []);

    // Then
    expect(hashBefore).not.toEqual(hashAfter);
  });

  it('should handle empty file lists', () => {
    // Given
    const working: DiffFile[] = [];
    const staged: DiffFile[] = [];

    // When
    const result = computeDiffContentHash(working, staged);

    // Then
    expect(result).toBe('');
  });
});
