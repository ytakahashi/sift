import { describe, expect, it } from 'vitest';
import type { Note } from './types';
import { selectNotesForFile } from './select-notes-for-file';

function createNote(id: string, fileId: string): Note {
  return {
    id,
    target: {
      kind: 'line',
      fileId,
      hunkId: `hunk-${id}`,
      startNewLineNumber: 1,
      endNewLineNumber: 1,
    },
    body: `note-${id}`,
    createdAt: 1,
  };
}

function createFileNote(id: string, fileId: string): Note {
  return {
    id,
    target: {
      kind: 'file',
      fileId,
    },
    body: `note-${id}`,
    createdAt: 1,
  };
}

describe('selectNotesForFile', () => {
  it('returns empty array when fileId is null', () => {
    // Given: notes exist but selected fileId is null
    const notes = [createNote('n1', 'file-a')];

    // When: notes are selected with a null fileId
    const result = selectNotesForFile(notes, null);

    // Then: the result is an empty array
    expect(result).toEqual([]);
  });

  it('returns only notes for the selected file', () => {
    // Given: notes contain multiple file IDs
    const notes = [
      createNote('n1', 'file-a'),
      createNote('n2', 'file-b'),
      createNote('n3', 'file-a'),
    ];

    // When: notes are selected for file-a
    const result = selectNotesForFile(notes, 'file-a');

    // Then: only notes that belong to file-a are returned
    expect(result.map((note) => note.id)).toEqual(['n1', 'n3']);
  });

  it('returns line and file notes for the selected file', () => {
    // Given: notes contain both target kinds for the same file
    const notes = [
      createNote('n1', 'file-a'),
      createFileNote('n2', 'file-a'),
      createFileNote('n3', 'file-b'),
    ];

    // When: notes are selected for file-a
    const result = selectNotesForFile(notes, 'file-a');

    // Then: both line and file notes for file-a are returned
    expect(result.map((note) => note.id)).toEqual(['n1', 'n2']);
  });
});
