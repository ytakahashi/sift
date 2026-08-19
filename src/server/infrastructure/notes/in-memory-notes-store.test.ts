import { describe, expect, it } from 'vitest';
import type { ConfirmedFileGeneration, FileGeneration } from '../../../domain/diff/file-generation';
import type { DiffFile } from '../../../domain/diff/types';
import type { AnchoredNote } from '../../../domain/notes/anchored-note';
import { NoteNotFoundError } from '../../services/notes-store';
import { InMemoryNotesStore } from './in-memory-notes-store';

interface FileFixtureOptions {
  hunkId?: string;
  lines?: Array<{ line: number; content: string }>;
}

function createFile(path: string, options: FileFixtureOptions = {}): DiffFile {
  const lines = options.lines ?? [{ line: 1, content: 'x' }];
  return {
    id: `file-${path}`,
    bucket: 'working',
    path,
    status: 'modified',
    kind: 'text',
    displayPath: path,
    hunks: [
      {
        id: options.hunkId ?? `hunk-${path}-0`,
        header: '@@ -1,1 +1,1 @@',
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: lines.map(({ line, content }, index) => ({
          id: `line-${path}-${index}`,
          type: 'add' as const,
          newLineNumber: line,
          content,
        })),
      },
    ],
  };
}

function fileGeneration(blobId: string): ConfirmedFileGeneration {
  return { kind: 'file', blobId, mode: '100644' };
}

function generationsOf(
  entries: Array<[string, FileGeneration]>,
): ReadonlyMap<string, FileGeneration> {
  return new Map(entries);
}

async function addFileNote(
  store: InMemoryNotesStore,
  repoId: string,
  path: string,
  generation: ConfirmedFileGeneration = fileGeneration('blob-1'),
): Promise<string> {
  const note = await store.add(
    repoId,
    { path, target: { kind: 'file', fileId: `file-${path}` }, body: 'body' },
    { generation },
  );
  return note.id;
}

interface LineNoteOptions {
  path: string;
  line: number;
  lineContents?: string[];
  generation?: ConfirmedFileGeneration;
}

async function addLineNote(
  store: InMemoryNotesStore,
  repoId: string,
  options: LineNoteOptions,
): Promise<string> {
  const note = await store.add(
    repoId,
    {
      path: options.path,
      target: {
        kind: 'line',
        fileId: `file-${options.path}`,
        bucket: 'working',
        hunkId: `hunk-${options.path}-0`,
        startNewLineNumber: options.line,
        endNewLineNumber: options.line,
      },
      body: 'body',
    },
    {
      generation: options.generation ?? fileGeneration('blob-1'),
      lineContents: options.lineContents,
    },
  );
  return note.id;
}

describe('InMemoryNotesStore', () => {
  it('creates notes with generated identity and returns them from list', async () => {
    // Given: an empty store
    const store = new InMemoryNotesStore();

    // When: a note is added
    const note = await store.add(
      'repo-1',
      {
        path: 'a.ts',
        target: {
          kind: 'line',
          fileId: 'file-a.ts',
          bucket: 'working',
          hunkId: 'hunk-a.ts-0',
          startNewLineNumber: 1,
          endNewLineNumber: 1,
        },
        body: 'the body',
      },
      { generation: fileGeneration('blob-1'), lineContents: ['x'] },
    );

    // Then: identity fields are generated and the draft is stored as given
    expect(note.id).toBeTruthy();
    expect(note.createdAt).toBeGreaterThan(0);
    expect(note.body).toBe('the body');
    expect(note.path).toBe('a.ts');
    await expect(store.list('repo-1')).resolves.toEqual([note]);
  });

  it('owns identity and staleness even when the draft already carries them', async () => {
    // Given: an existing note reused as a draft. NoteDraft omits the fields the
    // store derives, but structural typing accepts this wider object, so the
    // store must not let the caller's values through.
    const store = new InMemoryNotesStore();
    const existing: AnchoredNote = {
      id: 'caller-supplied-id',
      path: 'a.ts',
      target: { kind: 'file', fileId: 'file-a.ts' },
      body: 'body',
      createdAt: 1,
      staleness: { kind: 'stale', reason: 'content-changed' },
    };

    // When: it is added as a new note
    const note = await store.add('repo-1', existing, { generation: fileGeneration('blob-1') });

    // Then: the store owns identity and staleness; only content came from the draft
    expect(note.id).not.toBe('caller-supplied-id');
    expect(note.createdAt).toBeGreaterThan(1);
    expect(note.staleness).toEqual({ kind: 'live' });
    expect(note.path).toBe('a.ts');
  });

  it('isolates notes per repository', async () => {
    // Given: notes in two repositories
    const store = new InMemoryNotesStore();
    await addFileNote(store, 'repo-1', 'a.ts');
    await addFileNote(store, 'repo-2', 'b.ts');

    // When: one repository is cleared
    await store.clear('repo-1');

    // Then: the other repository is untouched
    await expect(store.list('repo-1')).resolves.toEqual([]);
    await expect(store.list('repo-2')).resolves.toHaveLength(1);
  });

  it('updates only the body of an existing note', async () => {
    // Given: a stored note
    const store = new InMemoryNotesStore();
    const noteId = await addFileNote(store, 'repo-1', 'a.ts');

    // When: the body is updated
    const updated = await store.updateBody('repo-1', noteId, 'new body');

    // Then: the returned and listed note carry the new body, same identity
    expect(updated.id).toBe(noteId);
    expect(updated.body).toBe('new body');
    const listed = await store.list('repo-1');
    expect(listed[0].body).toBe('new body');
  });

  it('throws NoteNotFoundError when updating or removing an unknown note', async () => {
    // Given: a store without the requested note
    const store = new InMemoryNotesStore();
    await addFileNote(store, 'repo-1', 'a.ts');

    // When / Then: update and remove reject with the typed error
    await expect(store.updateBody('repo-1', 'missing', 'x')).rejects.toBeInstanceOf(
      NoteNotFoundError,
    );
    await expect(store.remove('repo-1', 'missing')).rejects.toBeInstanceOf(NoteNotFoundError);
  });

  it('removes a single note', async () => {
    // Given: two stored notes
    const store = new InMemoryNotesStore();
    const first = await addFileNote(store, 'repo-1', 'a.ts');
    const second = await addFileNote(store, 'repo-1', 'b.ts');

    // When: the first note is removed
    await store.remove('repo-1', first);

    // Then: only the second note remains
    const listed = await store.list('repo-1');
    expect(listed.map((note) => note.id)).toEqual([second]);
  });

  it('reports no change when reconcile leaves every note intact', async () => {
    // Given: a note whose file is present with an unchanged generation
    const store = new InMemoryNotesStore();
    await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-1'));

    // When: reconcile runs against the same state
    const changed = await store.reconcile('repo-1', {
      workingFiles: [createFile('a.ts')],
      stagedFiles: [],
      generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
    });

    // Then: nothing changed and the note is still listed
    expect(changed).toBe(false);
    await expect(store.list('repo-1')).resolves.toHaveLength(1);
  });

  it('persists staleness decided by reconcile', async () => {
    // Given: one note whose file changed and one intact note
    const store = new InMemoryNotesStore();
    const marked = await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-old'));
    const unaffected = await addFileNote(store, 'repo-1', 'b.ts', fileGeneration('blob-1'));

    // When: reconcile sees a new generation for a.ts only
    const changed = await store.reconcile('repo-1', {
      workingFiles: [createFile('a.ts'), createFile('b.ts')],
      stagedFiles: [],
      generations: generationsOf([
        ['a.ts', fileGeneration('blob-new')],
        ['b.ts', fileGeneration('blob-1')],
      ]),
    });

    // Then: the change is reported and both notes are still stored, with only
    // the affected one marked
    expect(changed).toBe(true);
    const listed = await store.list('repo-1');
    expect(listed.map((note) => [note.id, note.staleness])).toEqual([
      [marked, { kind: 'stale', reason: 'content-changed' }],
      [unaffected, { kind: 'live' }],
    ]);
  });

  it('reports no change for a repository without notes', async () => {
    // Given: an empty store
    const store = new InMemoryNotesStore();

    // When: reconcile runs for an unknown repository
    const changed = await store.reconcile('repo-1', {
      workingFiles: [],
      stagedFiles: [],
      generations: generationsOf([]),
    });

    // Then: nothing to do
    expect(changed).toBe(false);
  });

  describe('deleteStale', () => {
    it('deletes the stale notes and keeps the live ones', async () => {
      // Given: a stored note already marked stale by an earlier reconcile, next
      // to an intact one
      const store = new InMemoryNotesStore();
      const stale = await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-old'));
      const live = await addFileNote(store, 'repo-1', 'b.ts', fileGeneration('blob-1'));
      const current = {
        workingFiles: [createFile('a.ts'), createFile('b.ts')],
        stagedFiles: [],
        generations: generationsOf([
          ['a.ts', fileGeneration('blob-new')],
          ['b.ts', fileGeneration('blob-1')],
        ]),
      };
      await store.reconcile('repo-1', current);

      // When: stale notes are deleted against the same state
      const result = await store.deleteStale('repo-1', current);

      // Then: only the stale one is gone
      expect(result).toEqual({ deletedCount: 1, changed: true });
      const listed = await store.list('repo-1');
      expect(listed.map((note) => note.id)).toEqual([live]);
      expect(listed[0].id).not.toBe(stale);
    });

    it('deletes stale notes regardless of the reason they are stale', async () => {
      // Given: one note per stale reason plus a live one
      const store = new InMemoryNotesStore();
      await addFileNote(store, 'repo-1', 'gone.ts', fileGeneration('blob-1'));
      await addFileNote(store, 'repo-1', 'changed.ts', fileGeneration('blob-old'));
      await addLineNote(store, 'repo-1', { path: 'moved.ts', line: 1, lineContents: ['x'] });
      const live = await addFileNote(store, 'repo-1', 'keep.ts', fileGeneration('blob-1'));

      // When: stale notes are deleted while gone.ts left the diff, changed.ts
      // has a new generation, and moved.ts no longer holds the anchored content
      const result = await store.deleteStale('repo-1', {
        workingFiles: [
          createFile('changed.ts'),
          createFile('moved.ts', { lines: [{ line: 1, content: 'y' }] }),
          createFile('keep.ts'),
        ],
        stagedFiles: [],
        generations: generationsOf([
          ['changed.ts', fileGeneration('blob-new')],
          ['moved.ts', fileGeneration('blob-1')],
          ['keep.ts', fileGeneration('blob-1')],
        ]),
      });

      // Then: all three reasons are treated the same
      expect(result).toEqual({ deletedCount: 3, changed: true });
      await expect(store.list('repo-1')).resolves.toEqual([
        expect.objectContaining({ id: live, staleness: { kind: 'live' } }),
      ]);
    });

    it('keeps a stale note that the current state brings back to live', async () => {
      // Given: a note marked stale by an earlier reconcile
      const store = new InMemoryNotesStore();
      const noteId = await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-1'));
      await store.reconcile('repo-1', {
        workingFiles: [createFile('a.ts')],
        stagedFiles: [],
        generations: generationsOf([['a.ts', fileGeneration('blob-new')]]),
      });

      // When: deletion runs after the file was restored to its creation state
      const result = await store.deleteStale('repo-1', {
        workingFiles: [createFile('a.ts')],
        stagedFiles: [],
        generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
      });

      // Then: nothing is deleted, but the recovered staleness is stored and
      // reported so subscribers still learn about it
      expect(result).toEqual({ deletedCount: 0, changed: true });
      await expect(store.list('repo-1')).resolves.toEqual([
        expect.objectContaining({ id: noteId, staleness: { kind: 'live' } }),
      ]);
    });

    it('deletes a note that only the current state turns stale', async () => {
      // Given: a note still stored as live (no reconcile ran since creation)
      const store = new InMemoryNotesStore();
      await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-old'));

      // When: deletion runs against a state where its file changed
      const result = await store.deleteStale('repo-1', {
        workingFiles: [createFile('a.ts')],
        stagedFiles: [],
        generations: generationsOf([['a.ts', fileGeneration('blob-new')]]),
      });

      // Then: reconcile and deletion happen as one step, so the note goes
      expect(result).toEqual({ deletedCount: 1, changed: true });
      await expect(store.list('repo-1')).resolves.toEqual([]);
    });

    it('stores the re-anchored target of a retained line note', async () => {
      // Given: a working-pane line note whose hunk has since been staged
      const store = new InMemoryNotesStore();
      await addLineNote(store, 'repo-1', { path: 'a.ts', line: 5, lineContents: ['x'] });

      // When: stale notes are deleted against the post-stage state
      const result = await store.deleteStale('repo-1', {
        workingFiles: [],
        stagedFiles: [
          createFile('a.ts', { hunkId: 'hunk-a.ts-9', lines: [{ line: 5, content: 'x' }] }),
        ],
        generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
      });

      // Then: the note survives with the re-anchored bucket and hunk persisted
      expect(result).toEqual({ deletedCount: 0, changed: true });
      const listed = await store.list('repo-1');
      expect(listed[0].target).toEqual(
        expect.objectContaining({ bucket: 'staged', hunkId: 'hunk-a.ts-9' }),
      );
    });

    it('deletes an already-stale note whose current generation is unavailable', async () => {
      // Given: a note marked stale by an earlier reconcile
      const store = new InMemoryNotesStore();
      await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-1'));
      await store.reconcile('repo-1', {
        workingFiles: [createFile('a.ts')],
        stagedFiles: [],
        generations: generationsOf([['a.ts', fileGeneration('blob-new')]]),
      });

      // When: deletion runs while the current generation cannot be read
      const result = await store.deleteStale('repo-1', {
        workingFiles: [createFile('a.ts')],
        stagedFiles: [],
        generations: generationsOf([['a.ts', { kind: 'unavailable', reason: 'read error' }]]),
      });

      // Then: an unreadable generation neither restores the note nor shields it
      // from deletion, matching what the notes list shows as stale
      expect(result).toEqual({ deletedCount: 1, changed: true });
      await expect(store.list('repo-1')).resolves.toEqual([]);
    });

    it('reports no change when nothing is stale and nothing moved', async () => {
      // Given: a note matching the current state
      const store = new InMemoryNotesStore();
      await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-1'));

      // When: stale notes are deleted
      const result = await store.deleteStale('repo-1', {
        workingFiles: [createFile('a.ts')],
        stagedFiles: [],
        generations: generationsOf([['a.ts', fileGeneration('blob-1')]]),
      });

      // Then: the caller can skip notifying subscribers
      expect(result).toEqual({ deletedCount: 0, changed: false });
      await expect(store.list('repo-1')).resolves.toHaveLength(1);
    });

    it('reports no change for a repository without notes', async () => {
      // Given: an empty store
      const store = new InMemoryNotesStore();

      // When: stale notes are deleted for an unknown repository
      const result = await store.deleteStale('repo-1', {
        workingFiles: [],
        stagedFiles: [],
        generations: generationsOf([]),
      });

      // Then: nothing to do
      expect(result).toEqual({ deletedCount: 0, changed: false });
    });

    it('deletes stale notes of the requested repository only', async () => {
      // Given: two repositories whose notes are both stale against the state
      // passed below
      const store = new InMemoryNotesStore();
      await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-old'));
      await addFileNote(store, 'repo-2', 'a.ts', fileGeneration('blob-old'));

      // When: only the first repository is targeted
      const result = await store.deleteStale('repo-1', {
        workingFiles: [createFile('a.ts')],
        stagedFiles: [],
        generations: generationsOf([['a.ts', fileGeneration('blob-new')]]),
      });

      // Then: the other repository keeps its note
      expect(result).toEqual({ deletedCount: 1, changed: true });
      await expect(store.list('repo-1')).resolves.toEqual([]);
      await expect(store.list('repo-2')).resolves.toHaveLength(1);
    });
  });
});
