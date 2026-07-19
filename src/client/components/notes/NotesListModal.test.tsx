import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileNote, LineNote } from '../../../domain/notes/types';
import { NotesListModal } from './NotesListModal';

const originalClipboard = navigator.clipboard;

function createLineNote(overrides?: Partial<LineNote>): LineNote {
  return {
    id: 'line-note',
    kind: 'line',
    path: 'src/line.ts',
    startLine: 10,
    endLine: 10,
    bucket: 'working',
    body: 'line note body',
    createdAt: 1000,
    ...overrides,
  };
}

function createFileNote(overrides?: Partial<FileNote>): FileNote {
  return {
    id: 'file-note',
    kind: 'file',
    path: 'src/file.ts',
    body: 'file note body',
    createdAt: 2000,
    ...overrides,
  };
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
    const notes = [createLineNote({ startLine: 10, endLine: 12 }), createFileNote()];

    // When: the modal is rendered
    render(<NotesListModal notes={notes} onClose={vi.fn()} onDeleteNote={vi.fn()} />);

    // Then: line notes include a line suffix and file notes show only the path
    expect(screen.getByText('src/line.ts#L10-L12')).toBeDefined();
    expect(screen.getByText('src/file.ts')).toBeDefined();
    expect(screen.queryByText('src/file.ts#L10')).toBeNull();
  });

  it('keeps the Copy action outside the scrollable notes area so it stays reachable', () => {
    // Given: enough notes to require the notes list to scroll on a short viewport
    const notes = Array.from({ length: 10 }, (_, index) =>
      createLineNote({ id: `note-${index}`, body: `note body ${index}` }),
    );

    // When: the modal is rendered
    render(<NotesListModal notes={notes} onClose={vi.fn()} onDeleteNote={vi.fn()} />);

    // Then: only the notes list scrolls; the Copy action sits outside it and
    // is always visible regardless of scroll position
    const panel = screen.getByTestId('notes-modal-panel');
    const scrollArea = screen.getByTestId('notes-modal-scroll-area');
    const copyButton = screen.getByRole('button', { name: 'Copy' });
    expect(panel.style.maxHeight).toBe('calc(100% - 60px)');
    expect(scrollArea.style.overflowY).toBe('auto');
    expect(scrollArea.contains(screen.getByText('note body 0'))).toBe(true);
    expect(scrollArea.contains(copyButton)).toBe(false);
    expect(panel.contains(copyButton)).toBe(true);
  });

  it('copies mixed notes with file notes excluding line numbers', async () => {
    // Given: a mixed notes list and a mocked clipboard
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const notes = [createLineNote({ startLine: 10, endLine: 12 }), createFileNote()];
    render(<NotesListModal notes={notes} onClose={vi.fn()} onDeleteNote={vi.fn()} />);

    // When: Copy is clicked
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    });

    // Then: the clipboard text keeps the line suffix only for line notes
    expect(writeText).toHaveBeenCalledWith(
      '> src/line.ts#L10-L12\nline note body\n\n> src/file.ts\nfile note body',
    );
  });
});
