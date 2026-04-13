import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
import type { Note } from '../../domain/notes/types';
import { useNotesPanel } from './useNotesPanel';

function createFile(id: string, bucket: 'working' | 'staged', displayPath = `${id}.ts`): DiffFile {
  return {
    id,
    bucket,
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath,
    hunks: [],
  };
}

function createNote(id: string, fileId: string): Note {
  return {
    id,
    target: {
      fileId,
      hunkId: `h-${id}`,
      startNewLineNumber: 1,
      endNewLineNumber: 1,
    },
    body: `note-${id}`,
    createdAt: 1,
  };
}

describe('useNotesPanel', () => {
  it('does not open when there are no notes', () => {
    // Given: the hook is rendered with zero notes
    const { result } = renderHook(() =>
      useNotesPanel({
        notes: [],
        workingFiles: [],
        stagedFiles: [],
        selectedFileId: null,
      }),
    );
    // When: toggle is invoked on the panel
    act(() => {
      result.current.toggle();
    });

    // Then: the panel remains closed and canOpen stays false
    expect(result.current.canOpen).toBe(false);
    expect(result.current.isOpen).toBe(false);
  });

  it('toggles open and closed when notes exist', () => {
    // Given: the hook is rendered with at least one note
    const notes = [createNote('n1', 'file-a')];
    const { result } = renderHook(() =>
      useNotesPanel({
        notes,
        workingFiles: [],
        stagedFiles: [],
        selectedFileId: null,
      }),
    );

    // When: toggle is invoked once
    act(() => {
      result.current.toggle();
    });

    // Then: the panel becomes open
    expect(result.current.canOpen).toBe(true);
    expect(result.current.isOpen).toBe(true);

    // When: toggle is invoked again
    act(() => {
      result.current.toggle();
    });

    // Then: the panel returns to closed state
    expect(result.current.isOpen).toBe(false);
  });

  it('closes automatically when notes become empty', () => {
    // Given: the panel is opened while notes are present
    const notes = [createNote('n1', 'file-a')];
    const { result, rerender } = renderHook(
      ({ currentNotes }: { currentNotes: Note[] }) =>
        useNotesPanel({
          notes: currentNotes,
          workingFiles: [],
          stagedFiles: [],
          selectedFileId: 'file-a',
        }),
      { initialProps: { currentNotes: notes } },
    );
    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    // When: notes become an empty array due to external update
    rerender({ currentNotes: [] });

    // Then: the panel closes automatically
    expect(result.current.isOpen).toBe(false);
  });

  it('resolves file paths across working and staged lists', () => {
    // Given: working and staged lists both contain distinct file IDs
    const workingFiles = [createFile('file-a', 'working', 'src/file-a.ts')];
    const stagedFiles = [createFile('file-b', 'staged', 'src/file-b.ts')];
    const { result } = renderHook(() =>
      useNotesPanel({
        notes: [createNote('n1', 'file-a')],
        workingFiles,
        stagedFiles,
        selectedFileId: 'file-a',
      }),
    );

    // When: each fileId is passed to resolveFilePath
    // Then: known fileIds resolve to displayPath and unknown IDs return as-is
    expect(result.current.resolveFilePath('file-a')).toBe('src/file-a.ts');
    expect(result.current.resolveFilePath('file-b')).toBe('src/file-b.ts');
    expect(result.current.resolveFilePath('missing')).toBe('missing');
  });

  it('returns notes for the selected file only', () => {
    // Given: notes include multiple file IDs and selectedFileId is file-a
    const notes = [
      createNote('n1', 'file-a'),
      createNote('n2', 'file-b'),
      createNote('n3', 'file-a'),
    ];
    const { result } = renderHook(() =>
      useNotesPanel({
        notes,
        workingFiles: [],
        stagedFiles: [],
        selectedFileId: 'file-a',
      }),
    );

    // When: selectedFileNotes is read
    // Then: only notes matching selectedFileId are returned
    expect(result.current.selectedFileNotes.map((note) => note.id)).toEqual(['n1', 'n3']);
  });
});
