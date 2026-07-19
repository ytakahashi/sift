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
