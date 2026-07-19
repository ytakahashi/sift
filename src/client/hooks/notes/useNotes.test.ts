import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { Note } from '../../../domain/notes/types';
import type { NotesGateway } from '../../application/ports';
import { NotesActionError } from '../../application/ports';
import { useNotes } from './useNotes';

function createNote(id: string): Note {
  return {
    id,
    kind: 'file',
    path: 'a.ts',
    body: `note-${id}`,
    createdAt: 100,
  };
}

interface GatewayMock extends NotesGateway {
  fetchNotes: Mock<NotesGateway['fetchNotes']>;
  addNote: Mock<NotesGateway['addNote']>;
  updateNote: Mock<NotesGateway['updateNote']>;
  deleteNote: Mock<NotesGateway['deleteNote']>;
  clearNotes: Mock<NotesGateway['clearNotes']>;
}

function createGateway(): GatewayMock {
  return {
    fetchNotes: vi.fn(async () => [createNote('n1')]),
    addNote: vi.fn(async () => createNote('created')),
    updateNote: vi.fn(async () => createNote('updated')),
    deleteNote: vi.fn(async () => {}),
    clearNotes: vi.fn(async () => {}),
  };
}

describe('useNotes', () => {
  let gateway: GatewayMock;

  beforeEach(() => {
    gateway = createGateway();
  });

  it('fetches notes on mount', async () => {
    // Given / When: the hook mounts for a repository
    const { result } = renderHook(() => useNotes(gateway, 'my-app'));

    // Then: the server-side notes are loaded
    await waitFor(() => {
      expect(result.current.notes).toEqual([createNote('n1')]);
    });
    expect(gateway.fetchNotes).toHaveBeenCalledWith('my-app');
  });

  it('refetches the reconciled list after a successful mutation', async () => {
    // Given: the hook is mounted
    const { result } = renderHook(() => useNotes(gateway, 'my-app'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    gateway.fetchNotes.mockResolvedValue([createNote('n1'), createNote('created')]);

    // When: a note is added
    await act(async () => {
      await result.current.addNote({ kind: 'file', path: 'a.ts' }, 'body');
    });

    // Then: the list reflects the server truth, not an optimistic insert
    expect(gateway.addNote).toHaveBeenCalledWith('my-app', { kind: 'file', path: 'a.ts' }, 'body');
    expect(result.current.notes).toHaveLength(2);
  });

  it('rethrows editor-bound mutation failures without touching the error state', async () => {
    // Given: the server rejects the creation (e.g. 422 with a recovery hint)
    const rejection = new NotesActionError('Line 99 is not part of the current diff.', 422);
    gateway.addNote.mockRejectedValue(rejection);
    const { result } = renderHook(() => useNotes(gateway, 'my-app'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    // When / Then: the rejection reaches the caller (the editor displays it)
    await act(async () => {
      await expect(result.current.addNote({ kind: 'file', path: 'a.ts' }, 'body')).rejects.toBe(
        rejection,
      );
    });

    // Then: the page banner state stays untouched (the editor owns this error)
    expect(result.current.error).toBeNull();
    expect(result.current.mutating).toBe(false);
  });

  it('records delete failures in the error state and resolves normally', async () => {
    // Given: deletion fails on the server
    gateway.deleteNote.mockRejectedValue(new NotesActionError('boom', 500));
    const { result } = renderHook(() => useNotes(gateway, 'my-app'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    // When: the note is deleted (no editor exists to catch a rejection)
    await act(async () => {
      await result.current.deleteNote('n1');
    });

    // Then: the failure lands in the banner state instead of rejecting
    expect(result.current.error).toBe('boom');
    expect(result.current.mutating).toBe(false);
  });

  it('exposes mutating=true while a mutation is in flight', async () => {
    // Given: a deletion that resolves only when released
    let release: () => void = () => {};
    gateway.deleteNote.mockImplementation(
      () =>
        new Promise<void>((resolvePromise) => {
          release = resolvePromise;
        }),
    );
    const { result } = renderHook(() => useNotes(gateway, 'my-app'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));

    // When: the deletion starts
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.deleteNote('n1');
    });

    // Then: delete buttons can be disabled while in flight
    await waitFor(() => expect(result.current.mutating).toBe(true));

    // When: the server responds
    await act(async () => {
      release();
      await pending;
    });

    // Then: the flag resets
    expect(result.current.mutating).toBe(false);
  });

  it('clears the error state when a later refetch succeeds', async () => {
    // Given: the initial fetch fails and the banner shows the error
    gateway.fetchNotes.mockRejectedValueOnce(new NotesActionError('temporarily down', 503));
    const { result } = renderHook(() => useNotes(gateway, 'my-app'));
    await waitFor(() => expect(result.current.error).toBe('temporarily down'));

    // When: a later refetch succeeds (SSE / diff refresh after recovery)
    await act(async () => {
      await result.current.refetchNotes();
    });

    // Then: the stale failure banner is cleared along with the fresh data
    expect(result.current.error).toBeNull();
    expect(result.current.notes).toHaveLength(1);
  });

  it('refetches on demand (SSE notes-changed / diff refresh)', async () => {
    // Given: the hook is mounted and the server state changes externally
    const { result } = renderHook(() => useNotes(gateway, 'my-app'));
    await waitFor(() => expect(result.current.notes).toHaveLength(1));
    gateway.fetchNotes.mockResolvedValue([]);

    // When: an external change triggers a refetch
    await act(async () => {
      await result.current.refetchNotes();
    });

    // Then: the reconciled (now empty) list is shown
    expect(result.current.notes).toEqual([]);
  });
});
