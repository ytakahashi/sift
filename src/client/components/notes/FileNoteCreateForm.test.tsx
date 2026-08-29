import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FileNoteCreateForm } from './FileNoteCreateForm';

describe('FileNoteCreateForm', () => {
  afterEach(cleanup);

  it('trims the path but preserves the body, then clears both inputs', async () => {
    // Given: an empty form whose save succeeds
    const user = userEvent.setup();
    const onSave = vi.fn(async () => {});
    render(<FileNoteCreateForm onSave={onSave} />);

    // When: both fields are filled and submitted
    await user.type(screen.getByRole('textbox', { name: 'File path' }), '  src/caller.ts  ');
    await user.type(
      screen.getByRole('textbox', { name: 'Note body' }),
      '  Update this caller too.  ',
    );
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    // Then: only the path is normalized and a fresh form is left behind
    expect(onSave).toHaveBeenCalledWith('src/caller.ts', '  Update this caller too.  ');
    expect(screen.getByRole('textbox', { name: 'File path' })).toHaveProperty('value', '');
    expect(screen.getByRole('textbox', { name: 'Note body' })).toHaveProperty('value', '');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('preserves both inputs and shows the server message when saving fails', async () => {
    // Given: the server rejects the target path
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error('The file is not tracked.'));
    render(<FileNoteCreateForm onSave={onSave} />);
    await user.type(screen.getByRole('textbox', { name: 'File path' }), 'src/missing.ts');
    await user.type(screen.getByRole('textbox', { name: 'Note body' }), 'Keep this draft.');

    // When: the save fails
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    // Then: the recovery message is local to the unchanged draft
    expect(screen.getByRole('textbox', { name: 'File path' })).toHaveProperty(
      'value',
      'src/missing.ts',
    );
    expect(screen.getByRole('textbox', { name: 'Note body' })).toHaveProperty(
      'value',
      'Keep this draft.',
    );
    expect(screen.getByRole('alert').textContent).toBe('The file is not tracked.');
  });

  it('prevents a second submission while the first save is in flight', async () => {
    // Given: a save that stays pending
    const user = userEvent.setup();
    let release: () => void = () => {};
    const onSave = vi.fn(
      () =>
        new Promise<void>((resolvePromise) => {
          release = resolvePromise;
        }),
    );
    render(<FileNoteCreateForm onSave={onSave} />);
    await user.type(screen.getByRole('textbox', { name: 'File path' }), 'src/file.ts');
    await user.type(screen.getByRole('textbox', { name: 'Note body' }), 'Draft');

    // When: submission starts
    await user.click(screen.getByRole('button', { name: 'Add note' }));

    // Then: every input and the action are disabled until it settles
    expect(screen.getByRole('textbox', { name: 'File path' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('textbox', { name: 'Note body' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Add note' })).toHaveProperty('disabled', true);

    // When: persistence completes
    release();

    // Then: the form becomes available again
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'File path' })).toHaveProperty('disabled', false);
    });
  });

  it('disables the form during another notes mutation', () => {
    // Given / When: another notes mutation is active
    render(<FileNoteCreateForm disabled onSave={vi.fn()} />);

    // Then: this form cannot start a concurrent mutation
    expect(screen.getByRole('textbox', { name: 'File path' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('textbox', { name: 'Note body' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Add note' })).toHaveProperty('disabled', true);
  });
});
