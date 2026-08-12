import { describe, expect, it } from 'vitest';
import { updateNoteInputSchema, updateNoteOutputSchema } from './update-note-schema';

describe('updateNoteInputSchema', () => {
  it('accepts a note id with a replacement body', () => {
    // Given
    const candidate = { noteId: 'n1', body: 'revised' };

    // When
    const result = updateNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects a missing note id', () => {
    // Given
    const candidate = { body: 'revised' };

    // When
    const result = updateNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it.each([[''], ['   '], ['\n\t']])('rejects a blank body (%j)', (body) => {
    // Given
    // The server rejects a whitespace-only body as well, so accepting one here
    // would only turn into a NOTE_REQUEST_INVALID after the round trip.
    const candidate = { noteId: 'n1', body };

    // When
    const result = updateNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('keeps surrounding whitespace of a non-blank body', () => {
    // Given
    // Blankness is judged on the trimmed value, but the value itself is passed
    // through untouched: an indented snippet must reach the server as written.
    const candidate = { noteId: 'n1', body: '  indented\n' };

    // When
    const result = updateNoteInputSchema.safeParse(candidate);

    // Then
    expect(result).toMatchObject({ success: true, data: { body: '  indented\n' } });
  });

  it('rejects an unknown extra property', () => {
    // Given
    const candidate = { noteId: 'n1', body: 'revised', target: { kind: 'file', path: 'a.ts' } };

    // When
    const result = updateNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});

describe('updateNoteOutputSchema', () => {
  it('accepts a wrapped note', () => {
    // Given
    const candidate = {
      note: {
        id: 'n1',
        kind: 'file',
        path: 'a.ts',
        body: 'revised',
        createdAt: 1,
        staleness: { kind: 'live' },
      },
    };

    // When
    const result = updateNoteOutputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects a response missing the note wrapper', () => {
    // Given
    const candidate = {
      id: 'n1',
      kind: 'file',
      path: 'a.ts',
      body: 'revised',
      createdAt: 1,
      staleness: { kind: 'live' },
    };

    // When
    const result = updateNoteOutputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});
