import { describe, expect, it } from 'vitest';
import type { ConfirmedFileGeneration, FileGeneration } from '../../../domain/diff/file-generation';
import type { DiffFile } from '../../../domain/diff/types';
import type { AnchoredNote } from '../../../domain/notes/anchored-note';
import { NoteNotFoundError } from '../../services/notes-store';
import { InMemoryNotesStore } from './in-memory-notes-store';

function createFile(path: string): DiffFile {
  return {
    id: `file-${path}`,
    bucket: 'working',
    path,
    status: 'modified',
    kind: 'text',
    displayPath: path,
    hunks: [
      {
        id: `hunk-${path}-0`,
        header: '@@ -1,1 +1,1 @@',
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [{ id: `line-${path}-0`, type: 'add', newLineNumber: 1, content: 'x' }],
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

  it('generates identity even when the draft already carries id and createdAt', async () => {
    // Given: an existing note reused as a draft. NoteDraft omits id/createdAt,
    // but structural typing accepts this wider object, so the store must not
    // let the caller's values through.
    const store = new InMemoryNotesStore();
    const existing: AnchoredNote = {
      id: 'caller-supplied-id',
      path: 'a.ts',
      target: { kind: 'file', fileId: 'file-a.ts' },
      body: 'body',
      createdAt: 1,
    };

    // When: it is added as a new note
    const note = await store.add('repo-1', existing, { generation: fileGeneration('blob-1') });

    // Then: the store owns identity; only the note's content came from the draft
    expect(note.id).not.toBe('caller-supplied-id');
    expect(note.createdAt).toBeGreaterThan(1);
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

  it('persists discards decided by reconcile', async () => {
    // Given: one note whose file changed and one intact note
    const store = new InMemoryNotesStore();
    await addFileNote(store, 'repo-1', 'a.ts', fileGeneration('blob-old'));
    const surviving = await addFileNote(store, 'repo-1', 'b.ts', fileGeneration('blob-1'));

    // When: reconcile sees a new generation for a.ts only
    const changed = await store.reconcile('repo-1', {
      workingFiles: [createFile('a.ts'), createFile('b.ts')],
      stagedFiles: [],
      generations: generationsOf([
        ['a.ts', fileGeneration('blob-new')],
        ['b.ts', fileGeneration('blob-1')],
      ]),
    });

    // Then: the change is reported and the discard is persisted
    expect(changed).toBe(true);
    const listed = await store.list('repo-1');
    expect(listed.map((note) => note.id)).toEqual([surviving]);
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
});
