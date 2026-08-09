import { describe, it, expect } from 'vitest';
import {
  describeNoteStaleReason,
  formatNoteForClipboard,
  formatNoteLocation,
  formatNotesForClipboard,
} from './format';

import { NOTE_STALE_REASONS, type Note } from './types';

describe('formatNotesForClipboard', () => {
  it('formats multiple notes into a clipboard string', () => {
    // Given notes
    const notes: Note[] = [
      {
        id: 'n1',
        kind: 'line',
        path: 'path/to/file1.txt',
        startLine: 10,
        endLine: 10,
        bucket: 'working',
        body: 'First note',
        createdAt: 1000,
        staleness: { kind: 'live' },
      },
      {
        id: 'n2',
        kind: 'file',
        path: 'path/to/file2.txt',
        body: 'Second note',
        createdAt: 2000,
        staleness: { kind: 'live' },
      },
    ];

    // When format is generated
    const result = formatNotesForClipboard(notes);

    // Then it matches the expected double-newline joined format
    expect(result).toBe('> path/to/file1.txt#L10\nFirst note\n\n> path/to/file2.txt\nSecond note');
  });

  it('returns empty string if notes are empty', () => {
    // Given
    const notes: Note[] = [];

    // When
    const result = formatNotesForClipboard(notes);

    // Then
    expect(result).toBe('');
  });
});

describe('formatNoteForClipboard', () => {
  it('formats a single note into a clipboard string', () => {
    // Given
    const note: Note = {
      id: 'n1',
      kind: 'line',
      path: 'path/to/file.ts',
      startLine: 10,
      endLine: 10,
      bucket: 'working',
      body: 'My note',
      createdAt: 1000,
      staleness: { kind: 'live' },
    };

    // When
    const result = formatNoteForClipboard(note);

    // Then
    expect(result).toBe('> path/to/file.ts#L10\nMy note');
  });

  it('formats a range note with both endpoints', () => {
    // Given: a note covering multiple lines
    const note: Note = {
      id: 'n1',
      kind: 'line',
      path: 'path/to/file.ts',
      startLine: 10,
      endLine: 12,
      bucket: 'working',
      body: 'My range note',
      createdAt: 1000,
      staleness: { kind: 'live' },
    };

    // When: the note is formatted
    const result = formatNoteForClipboard(note);

    // Then: the clipboard location preserves the complete range
    expect(result).toBe('> path/to/file.ts#L10-L12\nMy range note');
  });

  it('formats a file note without a line number', () => {
    // Given
    const note: Note = {
      id: 'n1',
      kind: 'file',
      path: 'path/to/file.ts',
      body: 'My file note',
      createdAt: 1000,
      staleness: { kind: 'live' },
    };

    // When
    const result = formatNoteForClipboard(note);

    // Then
    expect(result).toBe('> path/to/file.ts\nMy file note');
  });

  it('labels a stale note with its reason', () => {
    // Given: a note whose code has changed since it was written
    const note: Note = {
      id: 'n1',
      kind: 'line',
      path: 'path/to/file.ts',
      startLine: 10,
      endLine: 10,
      bucket: 'working',
      body: 'My note',
      createdAt: 1000,
      staleness: { kind: 'stale', reason: 'content-changed' },
    };

    // When
    const result = formatNoteForClipboard(note);

    // Then: pasting this into an agent prompt cannot read as a current finding
    expect(result).toBe(
      '> path/to/file.ts#L10 (stale: the file changed after this note was written)\nMy note',
    );
  });
});

describe('describeNoteStaleReason', () => {
  it.each(NOTE_STALE_REASONS)('describes %s', (reason) => {
    // Given / When: every reason the domain can produce
    const description = describeNoteStaleReason(reason);

    // Then: none falls through to an empty or placeholder string, so the UI
    // and the clipboard always have something to show
    expect(description).not.toBe('');
  });
});

describe('formatNoteLocation', () => {
  it('formats file, single-line, and range locations', () => {
    // Given: each supported note kind
    const fileNote: Note = {
      id: 'file',
      kind: 'file',
      path: 'src/a.ts',
      body: 'file',
      createdAt: 1,
      staleness: { kind: 'live' },
    };
    const singleLineNote: Note = {
      id: 'single',
      kind: 'line',
      path: 'src/a.ts',
      startLine: 4,
      endLine: 4,
      bucket: 'working',
      body: 'single',
      createdAt: 1,
      staleness: { kind: 'live' },
    };
    const rangeNote: Note = {
      ...singleLineNote,
      id: 'range',
      startLine: 4,
      endLine: 6,
    };

    // When / Then: each note keeps its appropriate location detail
    expect(formatNoteLocation(fileNote)).toBe('src/a.ts');
    expect(formatNoteLocation(singleLineNote)).toBe('src/a.ts#L4');
    expect(formatNoteLocation(rangeNote)).toBe('src/a.ts#L4-L6');
  });
});
