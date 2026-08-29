import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Note } from '../../../domain/notes/types';
import { useNotesPanel } from './useNotesPanel';

function createNote(id: string, path: string): Note {
  return {
    id,
    kind: 'line',
    path,
    startLine: 1,
    endLine: 1,
    bucket: 'working',
    body: `note-${id}`,
    createdAt: 1,
    staleness: { kind: 'live' },
  };
}

describe('useNotesPanel', () => {
  it('opens and closes when there are no notes', () => {
    // Given: the hook is rendered with zero notes
    const { result } = renderHook(() =>
      useNotesPanel({
        notes: [],
        selectedFilePath: null,
      }),
    );
    // When: toggle is invoked on the empty panel
    act(() => {
      result.current.toggle();
    });

    // Then: the creation surface becomes available
    expect(result.current.isOpen).toBe(true);

    // When: toggle is invoked again
    act(() => {
      result.current.toggle();
    });

    // Then: the panel closes normally
    expect(result.current.isOpen).toBe(false);
  });

  it('toggles open and closed when notes exist', () => {
    // Given: the hook is rendered with at least one note
    const notes = [createNote('n1', 'a.ts')];
    const { result } = renderHook(() =>
      useNotesPanel({
        notes,
        selectedFilePath: null,
      }),
    );

    // When: toggle is invoked once
    act(() => {
      result.current.toggle();
    });

    // Then: the panel becomes open
    expect(result.current.isOpen).toBe(true);

    // When: toggle is invoked again
    act(() => {
      result.current.toggle();
    });

    // Then: the panel returns to closed state
    expect(result.current.isOpen).toBe(false);
  });

  it('stays open when the last note is removed', () => {
    // Given: the panel is opened while notes are present
    const notes = [createNote('n1', 'a.ts')];
    const { result, rerender } = renderHook(
      ({ currentNotes }: { currentNotes: Note[] }) =>
        useNotesPanel({
          notes: currentNotes,
          selectedFilePath: 'a.ts',
        }),
      { initialProps: { currentNotes: notes } },
    );
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    // When: notes become an empty array due to external update
    rerender({ currentNotes: [] });

    // Then: the empty state and creation form can remain visible
    expect(result.current.isOpen).toBe(true);
  });

  it('returns notes for the selected path only', () => {
    // Given: notes include multiple paths and selectedFilePath is a.ts
    const notes = [createNote('n1', 'a.ts'), createNote('n2', 'b.ts'), createNote('n3', 'a.ts')];
    const { result } = renderHook(() =>
      useNotesPanel({
        notes,
        selectedFilePath: 'a.ts',
      }),
    );

    // When: selectedFileNotes is read
    // Then: only notes matching selectedFilePath are returned
    expect(result.current.selectedFileNotes.map((note) => note.id)).toEqual(['n1', 'n3']);
  });
});
