import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LineNote } from '../../../domain/notes/types';
import { NoteViewer } from './NoteViewer';

function createNote(overrides?: Partial<LineNote>): LineNote {
  return {
    id: 'n1',
    kind: 'line',
    path: 'src/foo.ts',
    startLine: 10,
    endLine: 10,
    bucket: 'working',
    body: 'note body',
    createdAt: 1000,
    ...overrides,
  };
}

describe('NoteViewer', () => {
  const originalClipboard = navigator.clipboard;

  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('shows the context label and note body when provided', () => {
    // Given/When: a note is rendered with a context label
    render(<NoteViewer note={createNote()} contextLabel="Line 10" onEdit={vi.fn()} />);

    // Then: both the label and body are visible
    expect(screen.getByText('Line 10')).toBeDefined();
    expect(screen.getByText('note body')).toBeDefined();
  });

  it('calls onEdit when Edit is clicked', async () => {
    // Given: a rendered NoteViewer
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<NoteViewer note={createNote()} onEdit={onEdit} />);

    // When: the user clicks Edit
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Then: onEdit fires
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete with the note id when Delete is clicked and not disabled', async () => {
    // Given: a rendered NoteViewer with delete enabled
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<NoteViewer note={createNote({ id: 'n42' })} onEdit={vi.fn()} onDelete={onDelete} />);

    // When: the user clicks Delete
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Then: onDelete fires with the note id
    expect(onDelete).toHaveBeenCalledWith('n42');
  });

  it('disables Delete when deleteDisabled is true', () => {
    // Given/When: the NoteViewer is rendered with deleteDisabled
    render(<NoteViewer note={createNote()} onEdit={vi.fn()} onDelete={vi.fn()} deleteDisabled />);

    // Then: the Delete button is disabled
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveProperty('disabled', true);
  });

  it('copies the note to the clipboard and shows "Copied!" when Copy is clicked', async () => {
    // Given: a note and a mocked clipboard
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    render(<NoteViewer note={createNote()} onEdit={vi.fn()} />);

    // When: the user clicks Copy
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    // Then: the clipboard receives the formatted note and feedback is shown
    expect(writeText).toHaveBeenCalledWith('> src/foo.ts#L10\nnote body');
    expect(await screen.findByText('Copied!')).toBeDefined();
  });
});
