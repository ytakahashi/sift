import { describe, it, expect } from 'vitest';
import { createPatchForHunk } from './git-patch';
import type { DiffFile, DiffHunk } from '../diff/types';
import { parseDiff } from '../diff/diff-parser';

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
  it('retains header-like content in a patch reconstructed from a parsed diff', () => {
    // Given: a complete hunk containing header-like deletions and additions
    const headers = ['diff --git a/query.sql b/query.sql', '--- a/query.sql', '+++ b/query.sql'];
    const body = [' select 1;', '--- old comment', '+++ new comment', ' select 2;'];
    const [file] = parseDiff([...headers, '@@ -1,3 +1,3 @@', ...body].join('\n'), 'working');

    // When: reconstructing the patch used for staging or reverse application when unstaging
    const patch = createPatchForHunk(file, file.hunks[0]);

    // Then: the complete body is preserved and matches the declared hunk line counts
    expect(patch).toBe([...headers, file.hunks[0].header, ...body, ''].join('\n'));
  });

  it.each([
    {
      scenario: 'the old side lacks a trailing newline',
      body: ['-old', '\\ No newline at end of file', '+new'],
    },
    {
      scenario: 'the new side lacks a trailing newline',
      body: ['-old', '+new', '\\ No newline at end of file'],
    },
    {
      scenario: 'both sides share a last line without a trailing newline',
      body: ['-old', '+new', ' last', '\\ No newline at end of file'],
    },
  ])('retains "No newline at end of file" markers when $scenario', ({ body }) => {
    // Given: a parsed hunk at the end of a file without a trailing newline
    const headers = ['diff --git a/file.txt b/file.txt', '--- a/file.txt', '+++ b/file.txt'];
    const [file] = parseDiff(
      [...headers, `@@ -1,${body.length - 2} +1,${body.length - 2} @@`, ...body].join('\n'),
      'working',
    );

    // When: reconstructing the patch
    const patch = createPatchForHunk(file, file.hunks[0]);

    // Then: markers stay right after the lines they belong to, so git applies the hunk as-is
    expect(patch).toBe([...headers, file.hunks[0].header, ...body, ''].join('\n'));
  });

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

  it.each([
    {
      scenario: 'non-ASCII characters stay unescaped',
      oldPath: '日本語.txt',
      path: '日本語.txt',
      aPath: 'a/日本語.txt',
      bPath: 'b/日本語.txt',
    },
    {
      scenario: 'whitespace is quoted',
      oldPath: 'old b/name ',
      path: 'new b/name ',
      aPath: '"a/old b/name "',
      bPath: '"b/new b/name "',
    },
    {
      scenario: 'control characters, quotes, and backslashes are escaped',
      oldPath: 'tab\tline\n"\\.txt',
      path: 'del\x7f.txt',
      aPath: '"a/tab\\011line\\012\\"\\\\.txt"',
      bPath: '"b/del\\177.txt"',
    },
  ])('encodes header paths when $scenario', ({ oldPath, path, aPath, bPath }) => {
    // Given
    const file = createFile({ path, oldPath });
    const hunk = createHunk({ lines: [] });

    // When
    const patch = createPatchForHunk(file, hunk);

    // Then: control characters use octal escapes, which git apply decodes like named escapes
    const lines = patch.split('\n');
    expect(lines[0]).toBe(`diff --git ${aPath} ${bPath}`);
    expect(lines[1]).toBe(`--- ${aPath}`);
    expect(lines[2]).toBe(`+++ ${bPath}`);
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
