import { describe, expect, it } from 'vitest';
import type { DiffFile, DiffLine } from '../diff/types';
import { resolveLineNoteTarget } from './resolve-line-note-target';

interface FileFixtureOptions {
  path: string;
  kind?: DiffFile['kind'];
  hunkId?: string;
  lines?: Array<{ line: number; content: string }>;
}

function createFile(options: FileFixtureOptions): DiffFile {
  const hunkId = options.hunkId ?? `hunk-${options.path}-0`;
  const lines: DiffLine[] = (options.lines ?? []).map(({ line, content }, index) => ({
    id: `line-${options.path}-${index}`,
    type: 'add',
    newLineNumber: line,
    content,
  }));

  return {
    id: `file-${options.path}`,
    bucket: 'working',
    path: options.path,
    status: 'modified',
    kind: options.kind ?? 'text',
    displayPath: options.path,
    hunks: [
      {
        id: hunkId,
        header: '@@ -1,1 +1,1 @@',
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines,
      },
    ],
  };
}

describe('resolveLineNoteTarget', () => {
  it('resolves in the specified pane only when bucket constraint is "only"', () => {
    // Given: the target line exists in both panes
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'w' }] })];
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 's' }] })];

    // When: resolution is constrained to the staged pane
    const result = resolveLineNoteTarget({
      workingFiles,
      stagedFiles,
      path: 'a.ts',
      line: 5,
      bucketConstraint: { kind: 'only', bucket: 'staged' },
    });

    // Then: the staged pane is resolved without ambiguity
    expect(result).toEqual({
      kind: 'resolved',
      target: { fileId: 'file-a.ts', hunkId: 'hunk-a.ts-0', bucket: 'staged', lineContent: 's' },
    });
  });

  it('returns not-found when the constrained pane lacks the line', () => {
    // Given: the line exists only in the staged pane
    const workingFiles: DiffFile[] = [];
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 's' }] })];

    // When: resolution is constrained to the working pane
    const result = resolveLineNoteTarget({
      workingFiles,
      stagedFiles,
      path: 'a.ts',
      line: 5,
      bucketConstraint: { kind: 'only', bucket: 'working' },
    });

    // Then: the staged match is not used
    expect(result).toEqual({ kind: 'not-found' });
  });

  it('resolves uniquely when only one pane matches without a constraint', () => {
    // Given: the file exists in working, but the requested line only in staged.
    // The resolution unit is the whole target, so working must not block the
    // fallback to staged.
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 1, content: 'w' }] })];
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 9, content: 's' }] })];

    // When: line 9 is resolved without a bucket constraint
    const result = resolveLineNoteTarget({ workingFiles, stagedFiles, path: 'a.ts', line: 9 });

    // Then: the staged pane is chosen because it is the unique match
    expect(result).toEqual({
      kind: 'resolved',
      target: { fileId: 'file-a.ts', hunkId: 'hunk-a.ts-0', bucket: 'staged', lineContent: 's' },
    });
  });

  it('reports ambiguity when both panes match without a constraint', () => {
    // Given: the same path and line number exist in both panes
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'w' }] })];
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 's' }] })];

    // When: resolution runs without a bucket constraint
    const result = resolveLineNoteTarget({ workingFiles, stagedFiles, path: 'a.ts', line: 5 });

    // Then: the caller must ask for an explicit bucket
    expect(result).toEqual({ kind: 'ambiguous' });
  });

  it('prefers the requested pane and falls back to the other with "preferred"', () => {
    // Given: the line exists only in the staged pane
    const workingFiles: DiffFile[] = [];
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 's' }] })];

    // When: re-anchoring prefers the (now empty) working pane
    const result = resolveLineNoteTarget({
      workingFiles,
      stagedFiles,
      path: 'a.ts',
      line: 5,
      bucketConstraint: { kind: 'preferred', bucket: 'working' },
    });

    // Then: the staged pane is used as the fallback, never reported ambiguous
    expect(result).toEqual({
      kind: 'resolved',
      target: { fileId: 'file-a.ts', hunkId: 'hunk-a.ts-0', bucket: 'staged', lineContent: 's' },
    });
  });

  it('keeps the preferred pane when both panes match', () => {
    // Given: the same target exists in both panes
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'x' }] })];
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'x' }] })];

    // When: re-anchoring prefers the staged pane
    const result = resolveLineNoteTarget({
      workingFiles,
      stagedFiles,
      path: 'a.ts',
      line: 5,
      bucketConstraint: { kind: 'preferred', bucket: 'staged' },
    });

    // Then: the preferred pane wins
    expect(result.kind).toBe('resolved');
    expect(result.kind === 'resolved' && result.target.bucket).toBe('staged');
  });

  it('matches only lines with the required content', () => {
    // Given: line 5 holds different content per pane
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'new' }] })];
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'old' }] })];

    // When: resolution requires the staged-side content
    const result = resolveLineNoteTarget({
      workingFiles,
      stagedFiles,
      path: 'a.ts',
      line: 5,
      requiredLineContent: 'old',
    });

    // Then: only the content-matching pane resolves (no ambiguity)
    expect(result).toEqual({
      kind: 'resolved',
      target: { fileId: 'file-a.ts', hunkId: 'hunk-a.ts-0', bucket: 'staged', lineContent: 'old' },
    });
  });

  it('returns not-found when the required content matches nowhere', () => {
    // Given: line 5 exists but with different content than required
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'new' }] })];

    // When: resolution requires content that no pane holds
    const result = resolveLineNoteTarget({
      workingFiles,
      stagedFiles: [],
      path: 'a.ts',
      line: 5,
      requiredLineContent: 'old',
    });

    // Then: the note target cannot be resolved
    expect(result).toEqual({ kind: 'not-found' });
  });

  it('never matches submodule entries', () => {
    // Given: the path exists only as a submodule entry
    const workingFiles = [
      createFile({ path: 'vendor/lib', kind: 'submodule', lines: [{ line: 1, content: 'c' }] }),
    ];

    // When: resolution targets that path
    const result = resolveLineNoteTarget({
      workingFiles,
      stagedFiles: [],
      path: 'vendor/lib',
      line: 1,
    });

    // Then: submodules are not note-eligible
    expect(result).toEqual({ kind: 'not-found' });
  });

  it('resolves lines in a synthesized untracked-file hunk', () => {
    // Given: an untracked file represented by the synthetic full-content hunk
    const untracked: DiffFile = {
      id: 'file-new.ts',
      bucket: 'working',
      path: 'new.ts',
      status: 'untracked',
      kind: 'text',
      displayPath: 'new.ts',
      hunks: [
        {
          id: 'hunk-new.ts-untracked',
          header: '@@ -0,0 +1,2 @@',
          oldStart: 0,
          oldLines: 0,
          newStart: 1,
          newLines: 2,
          lines: [
            { id: 'line-new.ts-untracked-0', type: 'add', newLineNumber: 1, content: 'first' },
            { id: 'line-new.ts-untracked-1', type: 'add', newLineNumber: 2, content: 'second' },
          ],
        },
      ],
    };

    // When: line 2 of the untracked file is resolved
    const result = resolveLineNoteTarget({
      workingFiles: [untracked],
      stagedFiles: [],
      path: 'new.ts',
      line: 2,
    });

    // Then: the synthetic hunk resolves like any other hunk
    expect(result).toEqual({
      kind: 'resolved',
      target: {
        fileId: 'file-new.ts',
        hunkId: 'hunk-new.ts-untracked',
        bucket: 'working',
        lineContent: 'second',
      },
    });
  });
});
