import { describe, expect, it } from 'vitest';
import { addNoteInputSchema, addNoteOutputSchema } from './add-note-schema';

describe('addNoteInputSchema', () => {
  it('accepts a valid line target without bucket', () => {
    // Given
    const candidate = { kind: 'line', path: 'a.ts', startLine: 1, endLine: 2, body: 'note' };

    // When
    const result = addNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('accepts a valid line target with bucket', () => {
    // Given
    const candidate = {
      kind: 'line',
      path: 'a.ts',
      startLine: 1,
      endLine: 2,
      bucket: 'staged',
      body: 'note',
    };

    // When
    const result = addNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('accepts a valid file target', () => {
    // Given
    const candidate = { kind: 'file', path: 'a.ts', body: 'note' };

    // When
    const result = addNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects a line target missing startLine/endLine', () => {
    // Given
    const candidate = { kind: 'line', path: 'a.ts', body: 'note' };

    // When
    const result = addNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('rejects a file target carrying line-only fields', () => {
    // Given
    const candidate = { kind: 'file', path: 'a.ts', body: 'note', startLine: 1, endLine: 2 };

    // When
    const result = addNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it.each([[''], ['   '], ['\n\t']])('rejects a blank body (%j)', (body) => {
    // Given
    // The server rejects a whitespace-only body as well, so accepting one here
    // would only turn into a NOTE_REQUEST_INVALID after the round trip.
    const candidate = { kind: 'file', path: 'a.ts', body };

    // When
    const result = addNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });

  it('keeps surrounding whitespace of a non-blank body', () => {
    // Given
    // Blankness is judged on the trimmed value, but the value itself is passed
    // through untouched: an indented snippet must reach the server as written.
    const candidate = { kind: 'file', path: 'a.ts', body: '  indented\n' };

    // When
    const result = addNoteInputSchema.safeParse(candidate);

    // Then
    expect(result).toMatchObject({ success: true, data: { body: '  indented\n' } });
  });

  it('rejects an unknown extra property', () => {
    // Given
    const candidate = { kind: 'file', path: 'a.ts', body: 'note', extra: true };

    // When
    const result = addNoteInputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});

describe('addNoteOutputSchema', () => {
  it('accepts a wrapped line note', () => {
    // Given
    const candidate = {
      note: {
        id: 'n1',
        kind: 'line',
        path: 'a.ts',
        startLine: 1,
        endLine: 1,
        bucket: 'working',
        body: 'note',
        createdAt: 1,
        staleness: { kind: 'live' },
      },
    };

    // When
    const result = addNoteOutputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(true);
  });

  it('rejects a response missing the note wrapper', () => {
    // Given
    const candidate = { id: 'n1', kind: 'file', path: 'a.ts', body: 'note', createdAt: 1 };

    // When
    const result = addNoteOutputSchema.safeParse(candidate);

    // Then
    expect(result.success).toBe(false);
  });
});
