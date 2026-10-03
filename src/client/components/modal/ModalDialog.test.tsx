import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModalDialog } from './ModalDialog';

function ExampleDialog({
  onClose,
  disabledLast = false,
}: {
  onClose: () => void;
  disabledLast?: boolean;
}): ReactElement {
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  return (
    <ModalDialog
      titleId="browse-title"
      initialFocusRef={initialFocusRef}
      onClose={onClose}
      backdropTestId="modal-backdrop"
    >
      <h2 id="browse-title">Browse folders</h2>
      <button type="button">First folder</button>
      <button ref={initialFocusRef} type="button">
        Select folder
      </button>
      <button type="button" disabled={disabledLast}>
        Final folder
      </button>
    </ModalDialog>
  );
}

describe('ModalDialog', () => {
  afterEach(() => cleanup());

  it('uses the caller-provided initial focus and keeps panel clicks inside the dialog', async () => {
    // Given: a dialog whose preferred initial control is not the first button
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExampleDialog onClose={onClose} />);

    // Then: the caller's preferred control receives initial focus
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Select folder' }));

    // When: its panel is clicked
    await user.click(screen.getByRole('heading', { name: 'Browse folders' }));

    // Then: the dialog is named and clicking inside it does not dismiss it
    expect(screen.getByRole('dialog', { name: 'Browse folders' })).toBeDefined();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('restores focus to the element that was active before the dialog opened', () => {
    // Given: the trigger has focus before the dialog mounts
    const { rerender } = render(<button>Open</button>);
    screen.getByRole('button', { name: 'Open' }).focus();

    // When: the dialog mounts and then unmounts
    rerender(
      <>
        <button>Open</button>
        <ExampleDialog onClose={vi.fn()} />
      </>,
    );
    rerender(<button>Open</button>);

    // Then: focus returns to the trigger
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }));
  });

  it('calls onClose when Escape is pressed', async () => {
    // Given
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExampleDialog onClose={onClose} />);

    // When
    await user.keyboard('{Escape}');

    // Then
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is clicked', async () => {
    // Given
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ExampleDialog onClose={onClose} />);

    // When
    await user.click(screen.getByTestId('modal-backdrop'));

    // Then
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('wraps Tab forward from the last focusable element to the first', async () => {
    // Given: focus is on the last button
    const user = userEvent.setup();
    render(<ExampleDialog onClose={vi.fn()} />);
    screen.getByRole('button', { name: 'Final folder' }).focus();

    // When
    await user.keyboard('{Tab}');

    // Then
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First folder' }));
  });

  it('wraps Shift+Tab backward from the first focusable element to the last', async () => {
    // Given: focus is on the first button
    const user = userEvent.setup();
    render(<ExampleDialog onClose={vi.fn()} />);
    screen.getByRole('button', { name: 'First folder' }).focus();

    // When
    await user.keyboard('{Shift>}{Tab}{/Shift}');

    // Then
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Final folder' }));
  });

  it('skips a disabled last button when trapping focus', async () => {
    // Given: the final button is disabled, so Select folder is the last reachable control
    const user = userEvent.setup();
    render(<ExampleDialog onClose={vi.fn()} disabledLast />);
    screen.getByRole('button', { name: 'Select folder' }).focus();

    // When
    await user.keyboard('{Tab}');

    // Then: Tab remains inside the dialog
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First folder' }));
  });
});
