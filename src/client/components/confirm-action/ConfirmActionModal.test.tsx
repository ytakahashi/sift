import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmActionModal } from './ConfirmActionModal';

function renderModal(
  overrides: Partial<ComponentProps<typeof ConfirmActionModal>> = {},
): ReturnType<typeof render> {
  return render(
    <ConfirmActionModal
      title="Delete Stale Notes"
      message="Delete 3 stale notes?"
      confirmLabel="Delete"
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      {...overrides}
    />,
  );
}

describe('ConfirmActionModal', () => {
  afterEach(() => cleanup());

  it('renders the title, message and supporting details', () => {
    // Given / When
    renderModal({ details: ['Live notes will remain.', 'This action cannot be undone.'] });

    // Then: the dialog is named by its title and shows every supplied line
    expect(screen.getByRole('dialog', { name: 'Delete Stale Notes' })).toBeDefined();
    expect(screen.getByText('Delete 3 stale notes?')).toBeDefined();
    expect(screen.getByText('Live notes will remain.')).toBeDefined();
    expect(screen.getByText('This action cannot be undone.')).toBeDefined();
  });

  it('focuses the Cancel button on mount to prevent accidental confirmation', () => {
    // Given / When
    renderModal();

    // Then: Cancel has initial focus so pressing Enter does not immediately confirm
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('wires Escape dismissal to onCancel', async () => {
    // Given: confirmation has separate cancel and confirm callbacks
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderModal({ onCancel, onConfirm });

    // When
    await user.keyboard('{Escape}');

    // Then: the dialog's close action cancels instead of confirming
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel when the Cancel button is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderModal({ onCancel });

    // When
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Then
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderModal({ onConfirm });

    // When: the caller-labelled confirm action is used
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Then
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('does not confirm while disabled', async () => {
    // Given: a mutation is already in flight
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderModal({ onConfirm, disabled: true });

    // When: the confirm button is clicked again
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Then: the duplicate request is blocked, but the dialog can still be left
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Cancel' }).disabled).toBe(false);
  });
});
