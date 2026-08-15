import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotesActionError } from '../../application/ports';
import { httpNotesGateway } from './notesClient';

function stubFetchOk(payload: unknown, status = 200): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn().mockResolvedValue({
    json: vi.fn().mockResolvedValue(payload),
    ok: true,
    status,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stubFetchError(status: number, errorMessage: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({ error: errorMessage }),
      ok: false,
      status,
      statusText: 'Error',
    }),
  );
}

const NOTE = {
  id: 'n1',
  kind: 'file' as const,
  path: 'a.ts',
  body: 'note body',
  createdAt: 100,
  staleness: { kind: 'live' },
};

describe('httpNotesGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches notes from the repository-scoped endpoint', async () => {
    // Given
    const fetchMock = stubFetchOk({ notes: [NOTE] });

    // When
    const notes = await httpNotesGateway.fetchNotes('my-app');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app/notes');
    expect(notes).toEqual([NOTE]);
  });

  it('creates a note with the path-addressed target', async () => {
    // Given
    const fetchMock = stubFetchOk(NOTE, 201);
    const target = {
      kind: 'line' as const,
      path: 'a.ts',
      startLine: 5,
      endLine: 7,
      bucket: 'working' as const,
    };

    // When
    const note = await httpNotesGateway.addNote('my-app', target, 'note body');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, body: 'note body' }),
    });
    expect(note).toEqual(NOTE);
  });

  it('updates a note body', async () => {
    // Given
    const fetchMock = stubFetchOk(NOTE);

    // When
    const note = await httpNotesGateway.updateNote('my-app', 'n1', 'revised');

    // Then
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my-app/notes/n1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'revised' }),
    });
    expect(note).toEqual(NOTE);
  });

  it('deletes a single note and clears all notes', async () => {
    // Given
    const fetchMock = stubFetchOk(undefined, 204);

    // When
    await httpNotesGateway.deleteNote('my-app', 'n1');
    await httpNotesGateway.clearNotes('my-app');

    // Then
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/repositories/my-app/notes/n1', {
      method: 'DELETE',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/repositories/my-app/notes', {
      method: 'DELETE',
    });
  });

  it('deletes the stale notes through the collection filter and returns the count', async () => {
    // Given: the server removed the notes that were still stale on arrival
    const fetchMock = stubFetchOk({ deletedCount: 3 });

    // When
    const deletedCount = await httpNotesGateway.deleteStaleNotes('my app');

    // Then: the repository id is encoded and the filter selects only stale notes
    expect(fetchMock).toHaveBeenCalledWith('/api/repositories/my%20app/notes?staleness=stale', {
      method: 'DELETE',
    });
    expect(deletedCount).toBe(3);
  });

  it('surfaces a failed stale deletion as NotesActionError', async () => {
    // Given: the server could not load the current state to judge staleness
    stubFetchError(500, 'git diff failed');

    // When / Then: the caller sees the server message, not a count
    await expect(httpNotesGateway.deleteStaleNotes('my-app')).rejects.toMatchObject({
      name: 'NotesActionError',
      message: 'git diff failed',
      statusCode: 500,
    });
  });

  it.each([
    ['a missing count', {}],
    ['a non-numeric count', { deletedCount: '3' }],
    ['a negative count', { deletedCount: -1 }],
    ['a fractional count', { deletedCount: 1.5 }],
    ['a non-object body', 'ok'],
  ])('rejects a malformed success body with %s', async (_label, payload) => {
    // Given: a 200 whose body does not match the endpoint contract
    stubFetchOk(payload);

    // When / Then: the boundary refuses it rather than passing a bogus count on
    await expect(httpNotesGateway.deleteStaleNotes('my-app')).rejects.toBeInstanceOf(
      NotesActionError,
    );
  });

  it('throws NotesActionError carrying the server message and status', async () => {
    // Given: the server rejects with a recovery hint
    stubFetchError(422, 'Line 99 of "a.ts" is not part of the current diff.');

    // When / Then: the typed error preserves both for the editor UI
    await expect(
      httpNotesGateway.addNote('my-app', { kind: 'file', path: 'a.ts' }, 'x'),
    ).rejects.toMatchObject({
      name: 'NotesActionError',
      message: 'Line 99 of "a.ts" is not part of the current diff.',
      statusCode: 422,
    });
    await expect(
      httpNotesGateway.addNote('my-app', { kind: 'file', path: 'a.ts' }, 'x'),
    ).rejects.toBeInstanceOf(NotesActionError);
  });
});
