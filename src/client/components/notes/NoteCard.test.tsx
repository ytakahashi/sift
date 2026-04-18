import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Note } from '../../../domain/notes/types';
import { NoteCard } from './NoteCard';

function createNote(overrides?: Partial<Note>): Note {
  return {
    id: 'n1',
    target: { fileId: 'file-1', hunkId: 'h1', startNewLineNumber: 10, endNewLineNumber: 10 },
    body: 'original body',
    createdAt: 1000,
    ...overrides,
  };
}

const resolveFilePath = (_fileId: string) => 'path/to/file.ts';

describe('NoteCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows NoteViewer with note body initially', () => {
    // Given: a NoteCard rendered with a note
    const note = createNote();
    render(<NoteCard note={note} resolveFilePath={resolveFilePath} onUpdate={vi.fn()} />);

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
    render(<NoteCard note={note} resolveFilePath={resolveFilePath} onUpdate={vi.fn()} />);

    // When: the user clicks Edit
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    // Then: NoteEditor (textarea) is visible with the existing body as initial value;
    // the Edit button from NoteViewer is no longer present
    expect(screen.getByRole('textbox')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it('calls onUpdate and returns to NoteViewer when Save is clicked with non-empty value', async () => {
    // Given: a NoteCard in edit mode
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const note = createNote();
    render(<NoteCard note={note} resolveFilePath={resolveFilePath} onUpdate={onUpdate} />);
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
    render(<NoteCard note={note} resolveFilePath={resolveFilePath} onUpdate={onUpdate} />);
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
    render(<NoteCard note={note} resolveFilePath={resolveFilePath} onUpdate={onUpdate} />);
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
});
