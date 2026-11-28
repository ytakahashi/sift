import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FileNote, LineNote } from '../../../domain/notes/types';
import { NoteCard } from './NoteCard';

function createNote(overrides?: Partial<LineNote>): LineNote {
  return {
    id: 'n1',
    kind: 'line',
    path: 'path/to/file.ts',
    startLine: 10,
    endLine: 10,
    bucket: 'working',
    body: 'original body',
    createdAt: 1000,
    staleness: { kind: 'live' },
    ...overrides,
  };
}

function createFileNote(overrides?: Partial<FileNote>): FileNote {
  return {
    id: 'n1',
    kind: 'file',
    path: 'path/to/file.ts',
    body: 'original body',
    createdAt: 1000,
    staleness: { kind: 'live' },
    ...overrides,
  };
}

const originalClipboard = navigator.clipboard;

describe('NoteCard', () => {
  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it('shows NoteViewer with note body initially', () => {
    // Given: a NoteCard rendered with a note
    const note = createNote();
    render(<NoteCard note={note} onUpdate={vi.fn()} />);

    // When: rendered without any interaction

    // Then: note body and Edit button are visible; no textarea (NoteEditor) is present
    expect(screen.getByText('original body')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('switches to NoteEditor when Edit is clicked', async () => {
    // Given: a NoteCard in view mode
    const user = userEvent.setup();
    const note = createNote();
    render(<NoteCard note={note} onUpdate={vi.fn()} />);

    // When: the user clicks Edit
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Then: NoteEditor (textarea) is visible with the existing body as initial value;
    // the Edit button from NoteViewer is no longer present
    expect(screen.getByRole('textbox')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('shows replies and collapses a resolved thread by default', async () => {
    // Given
    const user = userEvent.setup();
    const note = createNote({
      reviewId: 'r1',
      status: 'resolved',
      author: { role: 'reviewer', client: 'claude-code' },
      replies: [
        {
          author: { role: 'implementer', client: 'codex' },
          body: 'Updated the guard.',
          round: 1,
          resolution: 'fixed',
        },
        { author: { role: 'reviewer' }, body: 'Verified the change.', round: 1 },
      ],
    });
    render(<NoteCard note={note} contextLabel="Line 10" />);
    const summary = screen.getByText(/Resolved/, { selector: 'summary' });
    const details = summary.closest('details');
    expect(details?.open).toBe(false);

    // When
    await user.click(summary);

    // Then
    expect(details?.open).toBe(true);
    expect(screen.getByText('reviewer (claude-code)')).toBeDefined();
    expect(screen.getByText('implementer (codex) · fixed')).toBeDefined();
    expect(screen.getByText('Updated the guard.')).toBeDefined();
    expect(screen.getByText('Verified the change.')).toBeDefined();
  });

  it('blocks deleting the current review thread until the review ends', async () => {
    // Given
    const user = userEvent.setup();
    const note = createNote({ reviewId: 'r1', status: 'open' });
    const review = { reviewId: 'r1', round: 2, verdict: 'comment', state: 'needs-user' } as const;
    const onDelete = vi.fn();
    const { rerender } = render(<NoteCard note={note} review={review} onDelete={onDelete} />);
    const button = screen.getByRole('button', {
      name: 'Delete',
      description: 'Protected by the current review.',
    });

    // When
    await user.click(button);

    // Then
    expect(button).toHaveProperty('disabled', true);
    expect(onDelete).not.toHaveBeenCalled();

    // When
    rerender(
      <NoteCard note={note} review={{ ...review, state: 'peer-gone' }} onDelete={onDelete} />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Then
    expect(onDelete).toHaveBeenCalledExactlyOnceWith(note.id);
  });

  it('keeps the optional context label in view and edit modes', async () => {
    // Given: a labeled line note card
    const user = userEvent.setup();
    const note = createNote();
    render(<NoteCard note={note} contextLabel="Lines 10–12" onUpdate={vi.fn()} />);

    // When: the card is initially viewed
    expect(screen.getByText('Lines 10–12')).toBeDefined();

    // When: the card switches to its editor
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Then: the same context remains visible
    expect(screen.getByText('Lines 10–12')).toBeDefined();
  });

  it('calls onUpdate and returns to NoteViewer when Save is clicked with non-empty value', async () => {
    // Given: a NoteCard in edit mode
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const note = createNote();
    render(<NoteCard note={note} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // When: the user clears the textarea, types a new body, and clicks Save
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);
    await user.type(textarea, 'updated body');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: onUpdate is called with the note id and new body, and NoteViewer is shown again
    expect(onUpdate).toHaveBeenCalledWith('n1', 'updated body');
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('does not call onUpdate and returns to NoteViewer when Cancel is clicked', async () => {
    // Given: a NoteCard in edit mode
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const note = createNote();
    render(<NoteCard note={note} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // When: the user clicks Cancel
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Then: onUpdate is not called, and NoteViewer is shown again
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('does not call onUpdate when Save is clicked with blank value', async () => {
    // Given: a NoteCard in edit mode with the textarea cleared to blank
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const note = createNote();
    render(<NoteCard note={note} onUpdate={onUpdate} />);
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const textarea = screen.getByRole('textbox');
    await user.clear(textarea);

    // When: the user clicks Save with an empty textarea
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: onUpdate is not called (blank body is discarded),
    // but the card still returns to view mode after the attempted save
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('copies a file note without a line number', async () => {
    // Given: a file-level note and a mocked clipboard
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    const note = createFileNote({ body: 'file note body' });
    render(<NoteCard note={note} onUpdate={vi.fn()} />);

    // When: the user clicks Copy
    await user.click(screen.getByRole('button', { name: 'Copy' }));

    // Then: the copied location contains only the file path
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('> path/to/file.ts\nfile note body');
    });
  });
});
