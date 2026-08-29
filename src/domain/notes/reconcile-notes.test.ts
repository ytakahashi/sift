import { describe, expect, it } from 'vitest';
import type { ConfirmedFileGeneration, FileGeneration } from '../diff/file-generation';
import type { DiffFile, DiffLine } from '../diff/types';
import type { NoteReconcileRecord } from './reconcile-notes';
import { reconcileNotes } from './reconcile-notes';
import type { NoteBucket, NoteStaleReason } from './types';

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
      path: options.path,
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
      staleness: { kind: 'live' },
    },
    generation: options.generation ?? fileGeneration('blob-1'),
    lineContents: options.lineContents,
  };
}

function createFileRecord(
  id: string,
  path: string,
  generation: ConfirmedFileGeneration = fileGeneration('blob-1'),
  scope: 'diff' | 'repository' = 'diff',
): NoteReconcileRecord {
  return {
    note: {
      id,
      path,
      target: { kind: 'file', fileId: `file-${path}`, scope },
      body: `note-${id}`,
      createdAt: 1,
      staleness: { kind: 'live' },
    },
    generation,
  };
}

function generationsOf(
  entries: Array<[string, FileGeneration]>,
): ReadonlyMap<string, FileGeneration> {
  return new Map(entries);
}

/** The record as reconcile is expected to return it once marked stale. */
function markedStale(record: NoteReconcileRecord, reason: NoteStaleReason): NoteReconcileRecord {
  return { ...record, note: { ...record.note, staleness: { kind: 'stale', reason } } };
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

  it('marks a range note stale when one anchored line changes', () => {
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

    // Then: the note is marked instead of partially re-anchored
    expect(result).toEqual({
      records: [markedStale(record, 'range-unresolved')],
      changed: true,
    });
  });

  it('marks a range note stale when part of the range is no longer in one hunk', () => {
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
    expect(result).toEqual({
      records: [markedStale(record, 'range-unresolved')],
      changed: true,
    });
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

  it('marks notes stale when the worktree generation changed', () => {
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

    // Then: the note is marked as pointing at content that has since changed
    expect(result.records).toEqual([markedStale(record, 'content-changed')]);
    expect(result.changed).toBe(true);
  });

  it('marks notes stale when their file left the diff', () => {
    // Given: the file no longer appears in any pane (commit / discard / delete)
    const record = createFileRecord('n1', 'a.ts');

    // When: reconcile runs against empty panes
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([]),
    });

    // Then: the presence check marks the note but keeps it
    expect(result.records).toEqual([markedStale(record, 'file-out-of-diff')]);
    expect(result.changed).toBe(true);
  });

  it('keeps a repository-scoped file note live without a pane file', () => {
    // Given: a note created for a tracked file outside the current diff
    const record = createFileRecord('n1', 'a.ts', fileGeneration('blob-1'), 'repository');

    // When: reconcile sees the same worktree generation and no pane files
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: diff presence is not required and the original record remains live
    expect(result).toEqual({ records: [record], changed: false });
  });

  it('marks a repository-scoped file note stale when its file enters the diff by changing', () => {
    // Given: an outside-diff note whose target is now present in a pane
    const record = createFileRecord('n1', 'a.ts', fileGeneration('blob-1'), 'repository');
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 1, content: 'changed' }] })];

    // When: reconcile sees that the target's worktree generation changed
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-2')]]),
    });

    // Then: entering the diff does not shield the note, the generation change still applies
    expect(result).toEqual({
      records: [markedStale(record, 'content-changed')],
      changed: true,
    });
  });

  it('keeps a repository-scoped file note live when only another file enters the diff', () => {
    // Given: an outside-diff note and an unrelated changed file in a pane
    const record = createFileRecord('n1', 'a.ts', fileGeneration('blob-1'), 'repository');
    const workingFiles = [createFile({ path: 'b.ts', lines: [{ line: 1, content: 'changed' }] })];

    // When: the target's own generation remains unchanged
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: the note does not react to the repository's diff as a whole
    expect(result).toEqual({ records: [record], changed: false });
  });

  it.each([
    ['different content', fileGeneration('blob-2')],
    ['a deleted worktree entry', { kind: 'deleted' } as const],
  ])('marks a repository-scoped file note stale for %s', (_scenario, current) => {
    // Given: a repository-scoped note anchored to the original file generation
    const record = createFileRecord('n1', 'a.ts', fileGeneration('blob-1'), 'repository');

    // When: the current confirmed generation no longer matches the anchor
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([['a.ts', current]]),
    });

    // Then: the generation check marks the note as content-changed
    expect(result).toEqual({
      records: [markedStale(record, 'content-changed')],
      changed: true,
    });
  });

  it('marks a repository-scoped file note stale when the path becomes ineligible', () => {
    // Given: a repository-scoped note whose path is now a confirmed non-file entry
    const record = createFileRecord('n1', 'vendor/lib', fileGeneration('blob-1'), 'repository');

    // When: reconcile receives the deterministic ineligible generation
    const result = reconcileNotes({
      records: [record],
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([
        ['vendor/lib', { kind: 'ineligible', reason: 'not a regular file or symlink' }],
      ]),
    });

    // Then: it is treated as changed rather than as an indeterminate read
    expect(result).toEqual({
      records: [markedStale(record, 'content-changed')],
      changed: true,
    });
  });

  it('holds repository-scoped file notes when their generation is indeterminate', () => {
    // Given: live and stale repository-scoped notes outside the current diff
    const live = createFileRecord('n1', 'a.ts', fileGeneration('blob-1'), 'repository');
    const stale = markedStale(
      createFileRecord('n2', 'b.ts', fileGeneration('blob-1'), 'repository'),
      'content-changed',
    );

    // When: one generation is unavailable and the other is missing
    const result = reconcileNotes({
      records: [live, stale],
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([['a.ts', { kind: 'unavailable', reason: 'read error' }]]),
    });

    // Then: neither uncertainty changes the last confirmed verdict
    expect(result).toEqual({ records: [live, stale], changed: false });
  });

  it('settles and recovers a repository-scoped file note from its generation anchor', () => {
    // Given: a repository-scoped note whose file has changed
    const record = createFileRecord('n1', 'a.ts', fileGeneration('blob-1'), 'repository');
    const changedInput = {
      records: [record],
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-2')]]),
    };
    const changed = reconcileNotes(changedInput);
    expect(changed.changed).toBe(true);

    // When: the changed state is reconciled again and then the original content returns
    const settled = reconcileNotes({ ...changedInput, records: changed.records });
    const recovered = reconcileNotes({
      ...changedInput,
      records: settled.records,
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: the repeated pass is idempotent and restoring the anchor makes the note live
    expect(settled).toEqual({ records: changed.records, changed: false });
    expect(recovered).toEqual({ records: [record], changed: true });
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

  it('marks a line note stale instead of mis-anchoring when the same line number holds different content', () => {
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

    // Then: the content check fails in both panes and the note is marked,
    // never re-attached to the different content "c"
    expect(result.records).toEqual([markedStale(record, 'range-unresolved')]);
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

    // Then: the note follows to the staged pane with a refreshed hunkId,
    // and following the content is not treated as going stale
    expect(result.changed).toBe(true);
    expect(result.records).toHaveLength(1);
    const target = result.records[0].note.target;
    expect(target.kind === 'line' && target.bucket).toBe('staged');
    expect(target.kind === 'line' && target.hunkId).toBe('hunk-a.ts-9');
    expect(result.records[0].note.staleness).toEqual({ kind: 'live' });
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

  it('keeps a content-changed note stale while the current generation is unavailable', () => {
    // Given: a note that already went stale on the generation check, whose
    // file is back in the diff but whose current generation cannot be read
    const record = markedStale(createFileRecord('n1', 'a.ts'), 'content-changed');
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 1, content: 'x' }] })];

    // When: reconcile runs while the generation is indeterminate
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', { kind: 'unavailable', reason: 'read error' }]]),
    });

    // Then: indeterminate cannot confirm recovery any more than it can confirm
    // a change, so the earlier verdict stands instead of flipping to live
    expect(result.records).toEqual([record]);
    expect(result.changed).toBe(false);
  });

  it('keeps a file-out-of-diff note stale while the current generation is unavailable', () => {
    // Given: a note stale because its file had left the diff, now back in the
    // diff but with a generation that cannot be read
    const record = markedStale(createFileRecord('n1', 'a.ts'), 'file-out-of-diff');
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 1, content: 'x' }] })];

    // When: reconcile runs while the generation is indeterminate
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', { kind: 'unavailable', reason: 'read error' }]]),
    });

    // Then: the file being present again is not enough to declare the note
    // live; the content it would apply to was never confirmed
    expect(result.records).toEqual([record]);
    expect(result.changed).toBe(false);
  });

  it('keeps a range-unresolved note stale while the current generation is unavailable', () => {
    // Given: a line note stale for an unresolvable range, whose anchored line
    // and content do match the current diff again
    const record = markedStale(
      createLineRecord({
        id: 'n1',
        path: 'a.ts',
        bucket: 'working',
        line: 5,
        lineContents: ['x'],
      }),
      'range-unresolved',
    );
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'x' }] })];

    // When: reconcile runs while the generation is indeterminate
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', { kind: 'unavailable', reason: 'read error' }]]),
    });

    // Then: a re-resolvable range does not recover the note either, so what the
    // notes list shows stale stays eligible for stale deletion
    expect(result.records).toEqual([record]);
    expect(result.changed).toBe(false);
  });

  it('still marks a live line note range-unresolved when the generation is unavailable', () => {
    // Given: a live line note whose anchored content is no longer in the diff,
    // while the file's current generation cannot be read
    const record = createLineRecord({
      id: 'n1',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      lineContents: ['x'],
    });
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'y' }] })];

    // When: reconcile runs while the generation is indeterminate
    const result = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', { kind: 'unavailable', reason: 'read error' }]]),
    });

    // Then: only the generation check is suspended. The range check reads the
    // diff, which was fetched successfully, so an unreadable generation neither
    // rescues the note nor is the cause of it going stale: a readable
    // generation reaches the very same verdict here.
    expect(result.records).toEqual([markedStale(record, 'range-unresolved')]);
    expect(result.changed).toBe(true);
  });

  it('marks notes stale when the path was replaced by a submodule', () => {
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

    // Then: no note-eligible file matches, so the presence check marks it
    expect(result.records).toEqual([markedStale(record, 'file-out-of-diff')]);
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

  it('marks a line record that lost its content baseline stale', () => {
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

    // Then: the record is marked rather than risking a wrong anchor
    expect(result.records).toEqual([markedStale(record, 'range-unresolved')]);
    expect(result.changed).toBe(true);
  });

  it('reconciles records of different creation generations independently', () => {
    // Given: two notes on different files created at different times; only
    // one file changed since
    const changedFileRecord = createFileRecord('n1', 'a.ts', fileGeneration('blob-old'));
    const fresh = createFileRecord('n2', 'b.ts', fileGeneration('blob-2'));
    const workingFiles = [
      createFile({ path: 'a.ts', lines: [{ line: 1, content: 'x' }] }),
      createFile({ path: 'b.ts', lines: [{ line: 1, content: 'y' }] }),
    ];

    // When: reconcile runs with current generations
    const result = reconcileNotes({
      records: [changedFileRecord, fresh],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([
        ['a.ts', fileGeneration('blob-new')],
        ['b.ts', fileGeneration('blob-2')],
      ]),
    });

    // Then: only the note on the changed file is marked (per-file granularity)
    expect(result.records).toEqual([markedStale(changedFileRecord, 'content-changed'), fresh]);
    expect(result.changed).toBe(true);
  });

  it('reports no change on a second pass against the same state', () => {
    // Given: a note that has just gone stale. Reconcile runs at the start of
    // every notes API call, and `changed` drives the notes-changed event that
    // makes clients call the API again — so a repeated pass must settle.
    const record = createFileRecord('n1', 'a.ts');
    const input = {
      records: [record],
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([]),
    };
    const first = reconcileNotes(input);
    expect(first.changed).toBe(true);

    // When: the same state is reconciled again
    const second = reconcileNotes({ ...input, records: first.records });

    // Then: nothing is reported, so the notification cannot feed back into itself
    expect(second.changed).toBe(false);
    expect(second.records).toEqual(first.records);
  });

  it('returns a note to live when the file goes back to its creation state', () => {
    // Given: a note marked stale because its file was edited
    const record = createLineRecord({
      id: 'n1',
      path: 'a.ts',
      bucket: 'working',
      line: 5,
      lineContents: ['x'],
    });
    const workingFiles = [createFile({ path: 'a.ts', lines: [{ line: 5, content: 'x' }] })];
    const edited = reconcileNotes({
      records: [record],
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-2')]]),
    });
    expect(edited.records[0].note.staleness).toEqual({
      kind: 'stale',
      reason: 'content-changed',
    });

    // When: the edit is undone, restoring the creation-time generation
    const undone = reconcileNotes({
      records: edited.records,
      workingFiles,
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: staleness is recomputed rather than accumulated, so the note applies again
    expect(undone.records).toEqual([record]);
    expect(undone.changed).toBe(true);
  });
});
