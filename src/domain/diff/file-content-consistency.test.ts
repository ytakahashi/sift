import { describe, expect, it } from 'vitest';
import { isFileLinesConsistentWithHunks } from './file-content-consistency';
import type { DiffHunk } from './types';

const hunk: DiffHunk = {
  id: 'hunk-1',
  header: '@@ -1,2 +1,2 @@',
  oldStart: 1,
  oldLines: 2,
  newStart: 1,
  newLines: 2,
  lines: [
    { id: 'delete', type: 'delete', oldLineNumber: 1, content: 'old' },
    { id: 'add', type: 'add', newLineNumber: 1, content: 'new' },
    {
      id: 'context',
      type: 'context',
      oldLineNumber: 2,
      newLineNumber: 2,
      content: 'context',
    },
  ],
};

describe('isFileLinesConsistentWithHunks', () => {
  it('accepts matching new-side lines and ignores deleted lines', () => {
    // Given / When / Then
    expect(isFileLinesConsistentWithHunks([hunk], ['new', 'context'])).toBe(true);
  });

  it('rejects changed or missing new-side lines', () => {
    // Given / When / Then
    expect(isFileLinesConsistentWithHunks([hunk], ['changed', 'context'])).toBe(false);
    expect(isFileLinesConsistentWithHunks([hunk], ['new'])).toBe(false);
  });
});
