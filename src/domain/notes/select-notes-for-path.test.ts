import { describe, expect, it } from 'vitest';
import type { Note } from './types';
import { selectNotesForPath } from './select-notes-for-path';

function createNote(id: string, path: string): Note {
  return {
    id,
    kind: 'line',
    path,
    startLine: 1,
    endLine: 1,
    bucket: 'working',
    body: `note-${id}`,
    createdAt: 1,
  };
}

function createFileNote(id: string, path: string): Note {
  return {
    id,
    kind: 'file',
    path,
    body: `note-${id}`,
    createdAt: 1,
  };
}

describe('selectNotesForPath', () => {
  it('returns empty array when path is null', () => {
    // Given: notes exist but the selected path is null
    const notes = [createNote('n1', 'a.ts')];

    // When: notes are selected with a null path
    const result = selectNotesForPath(notes, null);

    // Then: the result is an empty array
    expect(result).toEqual([]);
  });

  it('returns only notes for the selected path', () => {
    // Given: notes contain multiple paths
    const notes = [createNote('n1', 'a.ts'), createNote('n2', 'b.ts'), createNote('n3', 'a.ts')];

    // When: notes are selected for a.ts
    const result = selectNotesForPath(notes, 'a.ts');

    // Then: only notes that belong to a.ts are returned
    expect(result.map((note) => note.id)).toEqual(['n1', 'n3']);
  });

  it('returns line and file notes for the selected path', () => {
    // Given: notes contain both kinds for the same path
    const notes = [
      createNote('n1', 'a.ts'),
      createFileNote('n2', 'a.ts'),
      createFileNote('n3', 'b.ts'),
    ];

    // When: notes are selected for a.ts
    const result = selectNotesForPath(notes, 'a.ts');

    // Then: both line and file notes for a.ts are returned
    expect(result.map((note) => note.id)).toEqual(['n1', 'n2']);
  });
});
