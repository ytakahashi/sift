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

  it('restores focus to the triggering element after the modal is closed', () => {
    // Given: a button that opens the modal has focus
    const { rerender } = render(<button>Open</button>);
    screen.getByRole('button', { name: 'Open' }).focus();

    // When: modal mounts then unmounts
    rerender(
      <>
        <button>Open</button>
        <ConfirmActionModal
          title="Delete Stale Notes"
          message="Delete 3 stale notes?"
          confirmLabel="Delete"
          onCancel={vi.fn()}
          onConfirm={vi.fn()}
        />
      </>,
    );
    rerender(<button>Open</button>);

    // Then: focus returns to the element that was active before the modal opened
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }));
  });

  it('calls onCancel when the Escape key is pressed', async () => {
    // Given
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderModal({ onCancel });

    // When
    await user.keyboard('{Escape}');

    // Then
    expect(onCancel).toHaveBeenCalled();
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

  it('calls onCancel when the backdrop is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderModal({ onCancel });

    // When: the area outside the dialog is clicked
    await user.click(screen.getByTestId('confirm-action-backdrop'));

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

  it('wraps Tab forward from the last focusable element to the first', async () => {
    // Given: move focus to the last focusable element (confirm button)
    const user = userEvent.setup();
    renderModal();
    screen.getByRole('button', { name: 'Delete' }).focus();

    // When: Tab on the last element
    await user.keyboard('{Tab}');

    // Then: focus wraps to the first focusable element inside the dialog
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('wraps Shift+Tab backward from the first focusable element to the last', async () => {
    // Given: move focus to the first focusable element inside the dialog
    const user = userEvent.setup();
    renderModal();
    screen.getByRole('button', { name: 'Close' }).focus();

    // When: Shift+Tab on the first element
    await user.keyboard('{Shift>}{Tab}{/Shift}');

    // Then: focus wraps to the last focusable element inside the dialog
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Delete' }));
  });

  it('keeps the focus trap closed while the confirm button is disabled', async () => {
    // Given: the disabled confirm button is skipped by the browser, so Cancel
    // is the last element a Tab can reach
    const user = userEvent.setup();
    renderModal({ disabled: true });
    screen.getByRole('button', { name: 'Cancel' }).focus();

    // When: Tab on the last reachable element
    await user.keyboard('{Tab}');

    // Then: focus stays inside the dialog instead of escaping to the page behind it
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });
});
