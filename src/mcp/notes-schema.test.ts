import { describe, expect, it } from 'vitest';
import { listNotesInputSchema, noteSchema, notesListResponseSchema } from './notes-schema';

const lineNote = {
  id: 'n1',
  kind: 'line',
  path: 'src/index.ts',
  startLine: 1,
  endLine: 2,
  bucket: 'working',
  body: 'looks good',
  createdAt: 1700000000000,
};

const fileNote = {
  id: 'n2',
  kind: 'file',
  path: 'README.md',
  body: 'needs an update',
  createdAt: 1700000000001,
};

describe('listNotesInputSchema', () => {
  it('accepts an empty object', () => {
    // Given / When
    const result = listNotesInputSchema.safeParse({});

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects unknown arguments', () => {
    // Given / When
    const result = listNotesInputSchema.safeParse({ extra: true });

    // Then
    expect(result.success).toBe(false);
  });
});

describe('noteSchema', () => {
  it('accepts a valid line note', () => {
    // Given
    const candidate = lineNote;

    // When
    const result = noteSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('accepts a valid file note', () => {
    // Given
    const candidate = fileNote;

    // When
    const result = noteSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects a line note missing startLine/endLine/bucket', () => {
    // Given
    const candidate = { kind: 'line', id: 'n1', path: 'a', body: 'b', createdAt: 1 };

    // When
    const result = noteSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('rejects a file note carrying line-only fields', () => {
    // Given
    const candidate = { ...fileNote, startLine: 1, endLine: 2 };

    // When
    const result = noteSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('rejects an unrecognized kind', () => {
    // Given
    const candidate = { ...fileNote, kind: 'diff' };

    // When
    const result = noteSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('rejects an unknown extra property', () => {
    // Given
    const candidate = { ...fileNote, extra: true };

    // When
    const result = noteSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});

describe('notesListResponseSchema', () => {
  it('accepts a list of mixed note kinds', () => {
    // Given
    const candidate = { notes: [lineNote, fileNote] };

    // When
    const result = notesListResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('accepts an empty list', () => {
    // Given
    const candidate = { notes: [] };

    // When
    const result = notesListResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects a response missing the notes array', () => {
    // Given
    const candidate = {};

    // When
    const result = notesListResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('rejects a response where an item fails note validation', () => {
    // Given
    const candidate = { notes: [{ ...lineNote, startLine: 'x' }] };

    // When
    const result = notesListResponseSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});
