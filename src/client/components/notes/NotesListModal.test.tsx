import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '../../../domain/notes/types';
import { NotesListModal } from './NotesListModal';

const originalClipboard = navigator.clipboard;

function createLineNote(overrides?: Partial<Note>): Note {
  return {
    id: 'line-note',
    target: {
      kind: 'line',
      fileId: 'file-1',
      hunkId: 'h1',
      startNewLineNumber: 10,
      endNewLineNumber: 10,
    },
    body: 'line note body',
    createdAt: 1000,
    ...overrides,
  };
}

function createFileNote(overrides?: Partial<Note>): Note {
  return {
    id: 'file-note',
    target: {
      kind: 'file',
      fileId: 'file-2',
    },
    body: 'file note body',
    createdAt: 2000,
    ...overrides,
  };
}

function resolveFilePath(fileId: string): string {
  if (fileId === 'file-1') {
    return 'src/line.ts';
  }
  if (fileId === 'file-2') {
    return 'src/file.ts';
  }
  return fileId;
}

describe('NotesListModal', () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('shows line and file note locations with the correct line suffix', () => {
    // Given: line and file notes are mixed in the list
    const notes = [createLineNote(), createFileNote()];

    // When: the modal is rendered
    render(
      <NotesListModal
        notes={notes}
        onClose={vi.fn()}
        onDeleteNote={vi.fn()}
        resolveFilePath={resolveFilePath}
      />,
    );

    // Then: line notes include a line suffix and file notes show only the path
    expect(screen.getByText('src/line.ts#L10')).toBeDefined();
    expect(screen.getByText('src/file.ts')).toBeDefined();
    expect(screen.queryByText('src/file.ts#L10')).toBeNull();
  });

  it('copies mixed notes with file notes excluding line numbers', async () => {
    // Given: a mixed notes list and a mocked clipboard
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const notes = [createLineNote(), createFileNote()];
    render(
      <NotesListModal
        notes={notes}
        onClose={vi.fn()}
        onDeleteNote={vi.fn()}
        resolveFilePath={resolveFilePath}
      />,
    );

    // When: Copy is clicked
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    // Then: the clipboard text keeps the line suffix only for line notes
    expect(writeText).toHaveBeenCalledWith(
      '> src/line.ts#L10\nline note body\n\n> src/file.ts\nfile note body',
    );
  });
});
