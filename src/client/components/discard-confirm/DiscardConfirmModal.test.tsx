import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscardConfirmModal } from './DiscardConfirmModal';

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

describe('DiscardConfirmModal', () => {
  afterEach(() => cleanup());

  it('focuses the Cancel button on mount to prevent accidental confirmation', () => {
    // Given / When
    render(<DiscardConfirmModal mode="all" onConfirm={vi.fn()} onCancel={vi.fn()} />);

    // Then: Cancel has initial focus so pressing Enter does not immediately discard
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
        <DiscardConfirmModal mode="all" onConfirm={vi.fn()} onCancel={vi.fn()} />
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
    render(<DiscardConfirmModal mode="all" onConfirm={vi.fn()} onCancel={onCancel} />);

    // When
    await user.keyboard('{Escape}');

    // Then
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onCancel when the Cancel button is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<DiscardConfirmModal mode="all" onConfirm={vi.fn()} onCancel={onCancel} />);

    // When
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Then
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onConfirm when the Discard button is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DiscardConfirmModal mode="all" onConfirm={onConfirm} onCancel={vi.fn()} />);

    // When
    await user.click(screen.getByRole('button', { name: 'Discard' }));

    // Then
    expect(onConfirm).toHaveBeenCalled();
  });

  it('wraps Tab forward from the last focusable element to the first', async () => {
    // Given: move focus to the last focusable element (Discard button)
    const user = userEvent.setup();
    render(<DiscardConfirmModal mode="all" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    screen.getByRole('button', { name: 'Discard' }).focus();

    // When: Tab on the last element
    await user.keyboard('{Tab}');

    // Then: focus wraps to the first focusable element inside the dialog
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    expect(document.activeElement).toBe(focusable[0]);
  });

  it('wraps Shift+Tab backward from the first focusable element to the last', async () => {
    // Given: move focus to the first focusable element inside the dialog
    const user = userEvent.setup();
    render(<DiscardConfirmModal mode="all" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusable[0].focus();

    // When: Shift+Tab on the first element
    await user.keyboard('{Shift>}{Tab}{/Shift}');

    // Then: focus wraps to the last focusable element inside the dialog
    expect(document.activeElement).toBe(focusable[focusable.length - 1]);
  });
});
