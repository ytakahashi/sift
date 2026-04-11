import { describe, it, expect } from 'vitest';
import { createPatchForHunk } from './git-patch';
import type { DiffFile, DiffHunk } from '../diff/types';

function createFile(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    id: 'file-example.ts',
    bucket: 'working',
    path: 'example.ts',
    status: 'modified',
    kind: 'text',
    displayPath: 'example.ts',
    hunks: [],
    ...overrides,
  };
}

function createHunk(overrides: Partial<DiffHunk> = {}): DiffHunk {
  return {
    id: 'hunk-1',
    header: '@@ -1,3 +1,3 @@',
    oldStart: 1,
    oldLines: 3,
    newStart: 1,
    newLines: 3,
    lines: [
      { id: 'line-1', type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'unchanged' },
      { id: 'line-2', type: 'delete', oldLineNumber: 2, content: 'old line' },
      { id: 'line-3', type: 'add', newLineNumber: 2, content: 'new line' },
      {
        id: 'line-4',
        type: 'context',
        oldLineNumber: 3,
        newLineNumber: 3,
        content: 'also unchanged',
      },
    ],
    ...overrides,
  };
}

describe('createPatchForHunk', () => {
  it('generates a valid unified diff patch', () => {
    // Given: a file and a hunk with context, delete, and add lines
    const file = createFile();
    const hunk = createHunk();

    // When: generating a patch for the hunk
    const patch = createPatchForHunk(file, hunk);

    // Then: it produces a valid unified diff string
    const lines = patch.split('\n');
    expect(lines[0]).toBe('diff --git a/example.ts b/example.ts');
    expect(lines[1]).toBe('--- a/example.ts');
    expect(lines[2]).toBe('+++ b/example.ts');
    expect(lines[3]).toBe('@@ -1,3 +1,3 @@');
    expect(lines[4]).toBe(' unchanged');
    expect(lines[5]).toBe('-old line');
    expect(lines[6]).toBe('+new line');
    expect(lines[7]).toBe(' also unchanged');
  });

  it('uses oldPath for the "---" line when available (rename)', () => {
    // Given: a renamed file with an oldPath
    const file = createFile({ path: 'new-name.ts', oldPath: 'old-name.ts' });
    const hunk = createHunk({ lines: [] });

    // When: generating a patch
    const patch = createPatchForHunk(file, hunk);

    // Then: it uses the oldPath for the "a/" side and the "---" line
    const lines = patch.split('\n');
    expect(lines[0]).toBe('diff --git a/old-name.ts b/new-name.ts');
    expect(lines[1]).toBe('--- a/old-name.ts');
    expect(lines[2]).toBe('+++ b/new-name.ts');
  });

  it('uses path for both sides when no oldPath is set', () => {
    // Given: a file without an oldPath
    const file = createFile({ path: 'same.ts', oldPath: undefined });
    const hunk = createHunk({ lines: [] });

    // When: generating a patch
    const patch = createPatchForHunk(file, hunk);

    // Then: it uses the current path for both "a/" and "b/" sides
    const lines = patch.split('\n');
    expect(lines[0]).toBe('diff --git a/same.ts b/same.ts');
    expect(lines[1]).toBe('--- a/same.ts');
    expect(lines[2]).toBe('+++ b/same.ts');
  });
});
