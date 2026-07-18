import { describe, it, expect } from 'vitest';
import { formatNoteForClipboard, formatNoteLocation, formatNotesForClipboard } from './format';

import type { Note } from './types';

describe('formatNotesForClipboard', () => {
  it('formats multiple notes into a clipboard string', () => {
    // Given notes and a resolving function
    const notes: Note[] = [
      {
        id: 'n1',
        target: {
          kind: 'line',
          fileId: 'file-1',
          bucket: 'working',
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
          kind: 'file',
          fileId: 'file-2',
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
    expect(result).toBe('> path/to/file1.txt#L10\nFirst note\n\n> path/to/file2.txt\nSecond note');
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
        kind: 'line',
        fileId: 'file-1',
        bucket: 'working',
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

  it('formats a range note with both endpoints', () => {
    // Given: a note covering multiple lines
    const note: Note = {
      id: 'n1',
      target: {
        kind: 'line',
        fileId: 'file-1',
        bucket: 'working',
        hunkId: 'h1',
        startNewLineNumber: 10,
        endNewLineNumber: 12,
      },
      body: 'My range note',
      createdAt: 1000,
    };
    const resolveFilePath = (_fileId: string): string => 'path/to/file.ts';

    // When: the note is formatted
    const result = formatNoteForClipboard(note, resolveFilePath);

    // Then: the clipboard location preserves the complete range
    expect(result).toBe('> path/to/file.ts#L10-L12\nMy range note');
  });

  it('formats a file note without a line number', () => {
    // Given
    const note: Note = {
      id: 'n1',
      target: {
        kind: 'file',
        fileId: 'file-1',
      },
      body: 'My file note',
      createdAt: 1000,
    };
    const resolveFilePath = (_fileId: string): string => 'path/to/file.ts';

    // When
    const result = formatNoteForClipboard(note, resolveFilePath);

    // Then
    expect(result).toBe('> path/to/file.ts\nMy file note');
  });
});

describe('formatNoteLocation', () => {
  it('formats file, single-line, and range locations', () => {
    // Given: each supported note target
    const fileNote: Note = {
      id: 'file',
      target: { kind: 'file', fileId: 'file-1' },
      body: 'file',
      createdAt: 1,
    };
    const singleLineNote: Note = {
      id: 'single',
      target: {
        kind: 'line',
        fileId: 'file-1',
        bucket: 'working',
        hunkId: 'h1',
        startNewLineNumber: 4,
        endNewLineNumber: 4,
      },
      body: 'single',
      createdAt: 1,
    };
    const rangeNote: Note = {
      ...singleLineNote,
      id: 'range',
      target: {
        kind: 'line',
        fileId: 'file-1',
        bucket: 'working',
        hunkId: 'h1',
        startNewLineNumber: 4,
        endNewLineNumber: 6,
      },
    };
    const resolveFilePath = (_fileId: string): string => 'src/a.ts';

    // When / Then: each target keeps its appropriate location detail
    expect(formatNoteLocation(fileNote, resolveFilePath)).toBe('src/a.ts');
    expect(formatNoteLocation(singleLineNote, resolveFilePath)).toBe('src/a.ts#L4');
    expect(formatNoteLocation(rangeNote, resolveFilePath)).toBe('src/a.ts#L4-L6');
  });
});
