import { describe, expect, it, vi } from 'vitest';
import { createNote, getNotes } from './notes-http-client';

const lineNote = {
  id: 'n1',
  kind: 'line' as const,
  path: 'src/index.ts',
  startLine: 1,
  endLine: 2,
  bucket: 'working' as const,
  body: 'looks good',
  createdAt: 1700000000000,
};

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function unparseableResponse(status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new Error('invalid JSON')),
  } as unknown as Response;
}

describe('getNotes', () => {
  it('returns success with the parsed notes on 200', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { notes: [lineNote] }));

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:49321/api/repositories/sift-repo/notes',
    );
    expect(result).toEqual({ kind: 'success', notes: [lineNote] });
  });

  it('returns invalid-response when a 200 body fails schema validation', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(200, { notes: [{ bad: true }] }));

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'invalid-response' });
  });

  it('returns invalid-response when a 200 body is not valid JSON', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(unparseableResponse(200));

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'invalid-response' });
  });

  it('returns invalid-response for a 2xx other than the documented 200, even with a valid notes body', async () => {
    // Given
    // The GET contract is 200; a 204 is not one this client speaks to, so it
    // must not be assumed to carry a well-formed notes list.
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(204, { notes: [lineNote] }));

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'invalid-response' });
  });

  it('returns http-error with the code and message for a known 4xx error', async () => {
    // Given
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(404, { error: 'repo not found', code: 'REPOSITORY_NOT_FOUND' }),
      );

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(result).toEqual({
      kind: 'http-error',
      status: 404,
      code: 'REPOSITORY_NOT_FOUND',
      message: 'repo not found',
    });
  });

  it('returns http-error without a code for a code-less 500 (list_notes has no write to be uncertain about)', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'invariant violated' }));

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(result).toEqual({
      kind: 'http-error',
      status: 500,
      code: undefined,
      message: 'invariant violated',
    });
  });

  it('returns invalid-error-response when a non-2xx body is not valid JSON', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(unparseableResponse(502));

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'invalid-error-response' });
  });

  it('returns invalid-error-response when a non-2xx body is valid JSON but does not match the error schema', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(502, { unexpected: 'shape' }));

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'invalid-error-response' });
  });

  it('returns network-error when the request cannot connect', async () => {
    // Given
    const fetchImpl = vi.fn().mockRejectedValue(new Error('connection refused'));

    // When
    const result = await getNotes(49321, 'sift-repo', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'network-error' });
  });
});

describe('createNote', () => {
  const target = { kind: 'file' as const, path: 'README.md' };

  it('returns success with the created note on 201', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, lineNote));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://127.0.0.1:49321/api/repositories/sift-repo/notes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, body: 'a note' }),
      },
    );
    expect(result).toEqual({ kind: 'success', note: lineNote });
  });

  it('returns known-error with the code and message for a known 4xx/422/503 error', async () => {
    // Given
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(422, { error: 'ambiguous target', code: 'NOTE_TARGET_AMBIGUOUS' }),
      );

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({
      kind: 'known-error',
      status: 422,
      code: 'NOTE_TARGET_AMBIGUOUS',
      message: 'ambiguous target',
    });
  });

  it('returns known-error for a code-less 4xx (pre-write failure)', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(400, { error: 'bad config' }));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({
      kind: 'known-error',
      status: 400,
      code: undefined,
      message: 'bad config',
    });
  });

  it('returns invalid-error-response when a non-2xx body is not valid JSON', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(unparseableResponse(503));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'invalid-error-response' });
  });

  it('returns invalid-error-response when a non-2xx body is valid JSON but does not match the error schema', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(503, { unexpected: 'shape' }));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'invalid-error-response' });
  });

  it('returns uncertain for a 2xx other than the documented 201, even with a valid note body', async () => {
    // Given
    // The POST contract is 201; a 202 does not match it, and since the
    // request was already dispatched a mismatch cannot be ruled a definite
    // failure (the note may or may not have been saved).
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(202, lineNote));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'uncertain' });
  });

  it('returns uncertain for a code-less 500 (the write may already have happened)', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(500, { error: 'invariant violated' }));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'uncertain' });
  });

  it('returns uncertain when a 201 body fails schema validation', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(201, { bad: true }));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'uncertain' });
  });

  it('returns uncertain when a 201 body is not valid JSON', async () => {
    // Given
    const fetchImpl = vi.fn().mockResolvedValue(unparseableResponse(201));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'uncertain' });
  });

  it('returns uncertain when the request fails after being dispatched', async () => {
    // Given
    const fetchImpl = vi.fn().mockRejectedValue(new Error('socket hang up'));

    // When
    const result = await createNote(49321, 'sift-repo', target, 'a note', fetchImpl);

    // Then
    expect(result).toEqual({ kind: 'uncertain' });
  });
});
