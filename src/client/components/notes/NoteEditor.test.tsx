import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteEditor } from './NoteEditor';

describe('NoteEditor', () => {
  afterEach(() => {
    cleanup();
  });

  it('awaits onSave so the caller can close only after persistence', async () => {
    // Given: an editor whose save resolves
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    render(<NoteEditor onSave={onSave} onCancel={vi.fn()} />);

    // When: the user writes and saves
    await user.type(screen.getByRole('textbox'), 'draft text');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: the value is handed to onSave and no error is shown
    expect(onSave).toHaveBeenCalledWith('draft text');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('disables Save while the save is in flight', async () => {
    // Given: a save that resolves only when released
    const user = userEvent.setup();
    let release: () => void = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolvePromise) => {
          release = resolvePromise;
        }),
    );
    render(<NoteEditor onSave={onSave} onCancel={vi.fn()} />);

    // When: the user saves
    await user.type(screen.getByRole('textbox'), 'draft');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: double submission is prevented while pending
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', true);

    // When: the server responds
    release();

    // Then: the button is enabled again
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
    });
  });

  it('keeps the draft and shows the server message when the save fails', async () => {
    // Given: the server rejects with a recovery hint
    const user = userEvent.setup();
    const onSave = vi
      .fn()
      .mockRejectedValue(new Error('Line 99 of "a.ts" is not part of the current diff.'));
    render(<NoteEditor onSave={onSave} onCancel={vi.fn()} />);

    // When: the user saves
    await user.type(screen.getByRole('textbox'), 'important draft');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: the input is preserved (the editor did not clear or close itself)
    // and the message is shown inline where the draft lives
    expect(screen.getByRole('textbox')).toHaveProperty('value', 'important draft');
    expect(screen.getByRole('alert').textContent).toBe(
      'Line 99 of "a.ts" is not part of the current diff.',
    );

    // When: the user retries and the server accepts
    onSave.mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: 'Save' }));

    // Then: the previous error is cleared on the successful attempt
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });
});
