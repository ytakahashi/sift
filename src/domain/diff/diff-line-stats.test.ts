import { describe, expect, it } from 'vitest';
import type { DiffFile, DiffHunk, DiffLine } from './types';
import { computeDiffFilesLineStats, computeDiffLineStats } from './diff-line-stats';

function createLine(type: DiffLine['type'], id: string): DiffLine {
  return {
    id,
    type,
    content: id,
  };
}

function createHunk(id: string, lines: DiffLine[]): DiffHunk {
  return {
    id,
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines,
  };
}

function createFile(hunks: DiffHunk[]): DiffFile {
  return {
    id: 'file-src-example-ts',
    bucket: 'working',
    path: 'src/example.ts',
    status: 'modified',
    kind: 'text',
    displayPath: 'src/example.ts',
    hunks,
  };
}

describe('computeDiffLineStats', () => {
  it('sums additions and deletions across multiple hunks', () => {
    // Given: a file has additions and deletions spread across hunks
    const file = createFile([
      createHunk('hunk-1', [
        createLine('add', 'add-1'),
        createLine('delete', 'delete-1'),
        createLine('context', 'context-1'),
      ]),
      createHunk('hunk-2', [createLine('add', 'add-2'), createLine('delete', 'delete-2')]),
    ]);

    // When
    const stats = computeDiffLineStats(file);

    // Then
    expect(stats).toEqual({ additions: 2, deletions: 2 });
  });

  it('does not count context lines', () => {
    // Given: a file only has unchanged context lines
    const file = createFile([createHunk('hunk-1', [createLine('context', 'context-1')])]);

    // When
    const stats = computeDiffLineStats(file);

    // Then
    expect(stats).toEqual({ additions: 0, deletions: 0 });
  });

  it('returns zero counts for files without hunks', () => {
    // Given: a binary, submodule, or rename-only file has no rendered hunks
    const file = createFile([]);

    // When
    const stats = computeDiffLineStats(file);

    // Then
    expect(stats).toEqual({ additions: 0, deletions: 0 });
  });

  it('counts addition-only and deletion-only changes independently', () => {
    // Given: separate files contain only one side of the change
    const addedFile = createFile([
      createHunk('hunk-add', [createLine('add', 'add-1'), createLine('add', 'add-2')]),
    ]);
    const deletedFile = createFile([createHunk('hunk-delete', [createLine('delete', 'delete-1')])]);

    // When / Then
    expect(computeDiffLineStats(addedFile)).toEqual({ additions: 2, deletions: 0 });
    expect(computeDiffLineStats(deletedFile)).toEqual({ additions: 0, deletions: 1 });
  });
});

describe('computeDiffFilesLineStats', () => {
  it('sums additions and deletions across multiple files', () => {
    // Given: multiple files have independent diff stats
    const files = [
      createFile([
        createHunk('hunk-a', [createLine('add', 'add-1'), createLine('delete', 'delete-1')]),
      ]),
      createFile([
        createHunk('hunk-b', [
          createLine('add', 'add-2'),
          createLine('add', 'add-3'),
          createLine('context', 'context-1'),
        ]),
      ]),
      createFile([]),
    ];

    // When
    const stats = computeDiffFilesLineStats(files);

    // Then
    expect(stats).toEqual({ additions: 3, deletions: 1 });
  });

  it('returns zero counts for an empty file list', () => {
    // Given: a pane has no changed files
    const files: DiffFile[] = [];

    // When
    const stats = computeDiffFilesLineStats(files);

    // Then
    expect(stats).toEqual({ additions: 0, deletions: 0 });
  });
});
