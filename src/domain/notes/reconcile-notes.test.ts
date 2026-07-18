import { describe, expect, it } from 'vitest';
import type { ConfirmedFileGeneration, FileGeneration } from '../diff/file-generation';
import type { DiffFile, DiffLine } from '../diff/types';
import type { NoteReconcileRecord } from './reconcile-notes';
import { reconcileNotes } from './reconcile-notes';
import type { NoteBucket } from './types';

interface FileFixtureOptions {
  path: string;
  kind?: DiffFile['kind'];
  hunkId?: string;
  lines?: Array<{ line: number; content: string }>;
}

function createFile(options: FileFixtureOptions): DiffFile {
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
        id: options.hunkId ?? `hunk-${options.path}-0`,
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

function fileGeneration(blobId: string): ConfirmedFileGeneration {
  return { kind: 'file', blobId, mode: '100644' };
}

interface LineRecordOptions {
  id: string;
  path: string;
  bucket: NoteBucket;
  line: number;
  endLine?: number;
  hunkId?: string;
  lineContents?: string[];
  generation?: ConfirmedFileGeneration;
}

function createLineRecord(options: LineRecordOptions): NoteReconcileRecord {
  return {
    note: {
      id: options.id,
      target: {
        kind: 'line',
        fileId: `file-${options.path}`,
        bucket: options.bucket,
        hunkId: options.hunkId ?? `hunk-${options.path}-0`,
        startNewLineNumber: options.line,
        endNewLineNumber: options.endLine ?? options.line,
      },
      body: `note-${options.id}`,
      createdAt: 1,
    },
    generation: options.generation ?? fileGeneration('blob-1'),
    lineContents: options.lineContents,
  };
}

function createFileRecord(
  id: string,
  path: string,
  generation: ConfirmedFileGeneration = fileGeneration('blob-1'),
): NoteReconcileRecord {
  return {
    note: {
      id,
      target: { kind: 'file', fileId: `file-${path}` },
      body: `note-${id}`,
      createdAt: 1,
    },
    generation,
  };
}

function generationsOf(
  entries: Array<[string, FileGeneration]>,
): ReadonlyMap<string, FileGeneration> {
  return new Map(entries);
}

describe('reconcileNotes', () => {
  it('keeps a range note when every anchored line is unchanged', () => {
    // Given: a two-line note whose complete range and contents remain intact
    const record = createLineRecord({
      id: 'range',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      endLine: 6,
      lineContents: ['first', 'second'],
    });
    const workingFiles = [
      createFile({
        path: 'a.ts',
        lines: [
          { line: 5, content: 'first' },
          { line: 6, content: 'second' },
        ],
      }),
    ];

    // When: reconcile validates the range
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: the original record survives without a reported change
    expect(result).toEqual({ records: [record], changed: false });
  });

  it('discards a range note when one anchored line changes', () => {
    // Given: the second line of an anchored range no longer matches
    const record = createLineRecord({
      id: 'range',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      endLine: 6,
      lineContents: ['first', 'second'],
    });
    const workingFiles = [
      createFile({
        path: 'a.ts',
        lines: [
          { line: 5, content: 'first' },
          { line: 6, content: 'changed' },
        ],
      }),
    ];

    // When: reconcile validates the complete content baseline
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: the note is discarded instead of partially re-anchored
    expect(result).toEqual({ records: [], changed: true });
  });

  it('discards a range note when part of the range is no longer in one hunk', () => {
    // Given: the stored range expects two lines, but only its first line remains
    const record = createLineRecord({
      id: 'range',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      endLine: 6,
      lineContents: ['first', 'second'],
    });
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'first' }] })];

    // When: reconcile can no longer resolve the complete range
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: shortening the anchor is rejected
    expect(result).toEqual({ records: [], changed: true });
  });

  it('keeps notes untouched when the worktree is unchanged', () => {
    // Given: a line note whose file, generation and anchor are all intact
    const record = createLineRecord({
      id: 'n1',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      lineContents: ['x'],
    });
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'x' }] })];

    // When: reconcile runs against the same worktree generation
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: the record survives as-is and no change is reported
    expect(result.records).toEqual([record]);
    expect(result.changed).toBe(false);
  });

  it('discards notes when the worktree generation changed', () => {
    // Given: the file was edited in the worktree, producing a new blob.
    // A pure line-reorder edit is the same case: the blob id changes even
    // though the sorted diff-line set would not.
    const record = createLineRecord({
      id: 'n1',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      lineContents: ['x'],
    });
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'x' }] })];

    // When: reconcile sees a different current generation
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-2')]]),
    });

    // Then: the note is discarded
    expect(result.records).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it('discards notes whose file left the diff', () => {
    // Given: the file no longer appears in any pane (commit / discard / delete)
    const record = createFileRecord('n1', 'a.ts');

    // When: reconcile runs against empty panes
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([]),
    });

    // Then: the presence check discards the note
    expect(result.records).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it('keeps a file note across stage-all when the worktree blob is unchanged', () => {
    // Given: HEAD=a / index=b / worktree=c, then `git add`. The staged pane
    // changes from -a+b to -a+c and the working pane empties, but the
    // worktree content c (and thus its generation) never changed.
    const record = createFileRecord('n1', 'a.ts', fileGeneration('blob-c'));
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 1, content: 'c' }] })];

    // When: reconcile runs after stage-all
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles,
      generations: generationsOf([['a.ts', fileGeneration('blob-c')]]),
    });

    // Then: the file note survives
    expect(result.records).toEqual([record]);
    expect(result.changed).toBe(false);
  });

  it('discards a line note instead of mis-anchoring when the same line number holds different content', () => {
    // Given: a note on staged content "b" at line 1. After stage-all the
    // staged pane shows "c" at the same line number (worktree unchanged).
    const record = createLineRecord({
      id: 'n1',
      path: 'a.ts',
      bucket: 'staged',
      line: 1,
      lineContents: ['b'],
      generation: fileGeneration('blob-c'),
    });
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 1, content: 'c' }] })];

    // When: reconcile runs after stage-all
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles,
      generations: generationsOf([['a.ts', fileGeneration('blob-c')]]),
    });

    // Then: the content check fails in both panes and the note is discarded,
    // never re-attached to the different content "c"
    expect(result.records).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it('follows content moved to the other pane by rewriting bucket and hunkId', () => {
    // Given: a working-pane note whose hunk was staged; path, line number and
    // content now all match in the staged pane only
    const record = createLineRecord({
      id: 'n1',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      hunkId: 'hunk-a.ts-0',
      lineContents: ['x'],
    });
    const stagedFiles = [
      createFile({ path: 'a.ts', hunkId: 'hunk-a.ts-9', lines: [{ line: 5, content: 'x' }] }),
    ];

    // When: reconcile runs after the stage operation
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles,
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: the note follows to the staged pane with a refreshed hunkId
    expect(result.changed).toBe(true);
    expect(result.records).toHaveLength(1);
    const target = result.records[0].note.target;
    expect(target.kind === 'line' && target.bucket).toBe('staged');
    expect(target.kind === 'line' && target.hunkId).toBe('hunk-a.ts-9');
  });

  it('holds notes when the current generation is unavailable or missing', () => {
    // Given: two intact notes whose current generations cannot be determined
    const unavailableRecord = createLineRecord({
      id: 'n1',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      lineContents: ['x'],
    });
    const missingRecord = createFileRecord('n2', 'b.ts');
    const workingFiles = [
      createFile({ path: 'a.ts', lines: [{ line: 5, content: 'x' }] }),
      createFile({ path: 'b.ts', lines: [{ line: 1, content: 'y' }] }),
    ];

    // When: one generation is unavailable and the other is absent from the map
    const result = reconcileNotes({
      records: [unavailableRecord, missingRecord],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', { kind: 'unavailable', reason: 'read error' }]]),
    });

    // Then: indeterminate never means "changed"; both notes are held as-is
    expect(result.records).toEqual([unavailableRecord, missingRecord]);
    expect(result.changed).toBe(false);
  });

  it('discards notes when the path was replaced by a submodule', () => {
    // Given: the note's fileId now only matches a submodule entry
    const record = createFileRecord('n1', 'vendor/lib');
    const workingFiles = [createFile({ path: 'vendor/lib', kind: 'submodule' })];

    // When: reconcile runs
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([]),
    });

    // Then: no note-eligible file matches, so the presence check discards it
    expect(result.records).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it('skips re-anchoring for file notes', () => {
    // Given: a file note whose file only exists in the staged pane
    const record = createFileRecord('n1', 'a.ts');
    const stagedFiles = [createFile({ path: 'a.ts', lines: [{ line: 1, content: 'x' }] })];

    // When: reconcile runs
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles,
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: presence + generation checks are enough; the note is untouched
    expect(result.records).toEqual([record]);
    expect(result.changed).toBe(false);
  });

  it('discards a line record that lost its content baseline', () => {
    // Given: a line record without lineContents (invalid store state); it
    // cannot be re-anchored safely
    const record = createLineRecord({ id: 'n1', path: 'a.ts', bucket: 'working', line: 5 });
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'x' }] })];

    // When: reconcile runs
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: the record is discarded rather than risking a wrong anchor
    expect(result.records).toEqual([]);
    expect(result.changed).toBe(true);
  });

  it('reconciles records of different creation generations independently', () => {
    // Given: two notes on different files created at different times; only
    // one file changed since
    const stale = createFileRecord('n1', 'a.ts', fileGeneration('blob-old'));
    const fresh = createFileRecord('n2', 'b.ts', fileGeneration('blob-2'));
    const workingFiles = [
      createFile({ path: 'a.ts', lines: [{ line: 1, content: 'x' }] }),
      createFile({ path: 'b.ts', lines: [{ line: 1, content: 'y' }] }),
    ];

    // When: reconcile runs with current generations
    const result = reconcileNotes({
      records: [stale, fresh],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([
        ['a.ts', fileGeneration('blob-new')],
        ['b.ts', fileGeneration('blob-2')],
      ]),
    });

    // Then: only the note on the changed file is discarded (per-file granularity)
    expect(result.records).toEqual([fresh]);
    expect(result.changed).toBe(true);
  });
});
