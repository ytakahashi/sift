import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscardConfirmModal } from './DiscardConfirmModal';

describe('DiscardConfirmModal', () => {
  afterEach(() => cleanup());

  it('names the file whose changes are about to be discarded', () => {
    // Given / When: a single file is discarded
    render(
      <DiscardConfirmModal
        mode="single"
        fileName="src/a.ts"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Then: the wording identifies the target and what survives
    expect(screen.getByRole('dialog', { name: 'Discard Changes' })).toBeDefined();
    expect(screen.getByText('Discard changes to "src/a.ts"?')).toBeDefined();
    expect(
      screen.getByText(
        'Only unstaged changes will be discarded. Staged changes will remain intact.',
      ),
    ).toBeDefined();
    expect(screen.getByText('This action cannot be undone.')).toBeDefined();
  });

  it('asks about every working directory change in the all mode', () => {
    // Given / When: the whole working directory is discarded
    render(<DiscardConfirmModal mode="all" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    // Then
    expect(screen.getByText('Discard all working directory changes?')).toBeDefined();
  });

  it('confirms through the Discard button and cancels through Cancel', async () => {
    // Given
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<DiscardConfirmModal mode="all" onConfirm={onConfirm} onCancel={onCancel} />);

    // Then: Cancel keeps the initial focus, so Enter cannot discard by accident
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    // When: the destructive action is confirmed
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    // Then
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // When: the dialog is dismissed instead
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Then
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
