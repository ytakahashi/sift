import { describe, expect, it } from 'vitest';
import type { AnchoredNote } from '../../domain/notes/anchored-note';
import { toNoteResponse } from './note-response';

describe('toNoteResponse', () => {
  it('maps a line AnchoredNote to a public Note with path, range, and bucket', () => {
    // Given: a line note anchored in the working pane
    const note: AnchoredNote = {
      id: 'n1',
      path: 'a.ts',
      target: {
        kind: 'line',
        fileId: 'file-a.ts',
        bucket: 'working',
        hunkId: 'hunk-1',
        startNewLineNumber: 10,
        endNewLineNumber: 12,
      },
      body: 'review this',
      createdAt: 100,
    };

    // When: the note is converted to its public shape
    const result = toNoteResponse(note);

    // Then: the response carries path/startLine/endLine/bucket, no internal ids
    expect(result).toEqual({
      id: 'n1',
      kind: 'line',
      path: 'a.ts',
      startLine: 10,
      endLine: 12,
      bucket: 'working',
      body: 'review this',
      createdAt: 100,
    });
  });

  it('maps a file AnchoredNote to a public Note with only path and body', () => {
    // Given: a file-level note
    const note: AnchoredNote = {
      id: 'n2',
      path: 'b.ts',
      target: { kind: 'file', fileId: 'file-b.ts' },
      body: 'about this file',
      createdAt: 200,
    };

    // When: the note is converted
    const result = toNoteResponse(note);

    // Then: no bucket or line fields are present
    expect(result).toEqual({
      id: 'n2',
      kind: 'file',
      path: 'b.ts',
      body: 'about this file',
      createdAt: 200,
    });
  });

  it('uses the recorded path rather than deriving one from the fileId', () => {
    // Given: a note whose recorded path is the repository-relative path, while
    // the fileId is the diff's internal id built from it
    const note: AnchoredNote = {
      id: 'n3',
      path: 'src/nested/a.ts',
      target: { kind: 'file', fileId: 'file-src/nested/a.ts' },
      body: 'x',
      createdAt: 1,
    };

    // When: the note is converted
    const result = toNoteResponse(note);

    // Then: the request-addressable path is returned untouched
    expect(result.path).toBe('src/nested/a.ts');
  });
});
