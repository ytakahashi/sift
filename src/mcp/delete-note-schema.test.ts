import { describe, expect, it } from 'vitest';
import { deleteNoteInputSchema, deleteNoteOutputSchema } from './delete-note-schema';

describe('deleteNoteInputSchema', () => {
  it('accepts a note id', () => {
    // Given
    const candidate = { noteId: 'n1' };

    // When
    const result = deleteNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects an empty note id', () => {
    // Given
    const candidate = { noteId: '' };

    // When
    const result = deleteNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('rejects an unknown extra property', () => {
    // Given
    // Notably a path: deletion addresses a note by id only, never by target.
    const candidate = { noteId: 'n1', path: 'a.ts' };

    // When
    const result = deleteNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});

describe('deleteNoteOutputSchema', () => {
  it('accepts the deleted marker with the note id', () => {
    // Given
    const candidate = { deleted: true, noteId: 'n1' };

    // When
    const result = deleteNoteOutputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects deleted: false', () => {
    // Given
    // The tool only ever reports a completed deletion; a failure is an error
    // result, not a structured outcome.
    const candidate = { deleted: false, noteId: 'n1' };

    // When
    const result = deleteNoteOutputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});
