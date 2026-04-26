import { describe, it, expect } from 'vitest';
import { formatNoteForClipboard, formatNotesForClipboard } from './format';

import type { Note } from './types';

describe('formatNotesForClipboard', () => {
  it('formats multiple notes into a clipboard string', () => {
    // Given notes and a resolving function
    const notes: Note[] = [
      {
        id: 'n1',
        target: {
          fileId: 'file-1',
          hunkId: 'h1',
          startNewLineNumber: 10,
          endNewLineNumber: 10,
        },
        body: 'First note',
        createdAt: 1000,
      },
      {
        id: 'n2',
        target: {
          fileId: 'file-2',
          hunkId: 'h2',
          startNewLineNumber: 20,
          endNewLineNumber: 20,
        },
        body: 'Second note',
        createdAt: 2000,
      },
    ];

    const resolveFilePath = (fileId: string): string => {
      if (fileId === 'file-1') return 'path/to/file1.txt';
      if (fileId === 'file-2') return 'path/to/file2.txt';
      return 'unknown';
    };

    // When format is generated
    const result = formatNotesForClipboard(notes, resolveFilePath);

    // Then it matches the expected double-newline joined format
    expect(result).toBe(
      '> path/to/file1.txt#L10\nFirst note\n\n> path/to/file2.txt#L20\nSecond note',
    );
  });

  it('returns empty string if notes are empty', () => {
    // Given
    const notes: Note[] = [];
    const resolveFilePath = (): string => 'foo';

    // When
    const result = formatNotesForClipboard(notes, resolveFilePath);

    // Then
    expect(result).toBe('');
  });
});

describe('formatNoteForClipboard', () => {
  it('formats a single note into a clipboard string', () => {
    // Given
    const note: Note = {
      id: 'n1',
      target: {
        fileId: 'file-1',
        hunkId: 'h1',
        startNewLineNumber: 10,
        endNewLineNumber: 10,
      },
      body: 'My note',
      createdAt: 1000,
    };
    const resolveFilePath = (_fileId: string): string => 'path/to/file.ts';

    // When
    const result = formatNoteForClipboard(note, resolveFilePath);

    // Then
    expect(result).toBe('> path/to/file.ts#L10\nMy note');
  });
});
