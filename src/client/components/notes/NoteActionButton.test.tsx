import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NoteActionButton } from './NoteActionButton';

describe('NoteActionButton', () => {
  afterEach(() => {
    cleanup();
  });

  it.each([
    ['link', 'rgb(121, 192, 255)'],
    ['muted', 'rgb(139, 148, 158)'],
    ['danger', 'rgb(248, 81, 73)'],
  ] as const)('renders the %s variant with color %s', (variant, color) => {
    // Given/When: the button is rendered with the given variant
    render(<NoteActionButton label="Edit" onClick={vi.fn()} variant={variant} />);

    // Then: the button text color matches the variant (jsdom normalizes hex to rgb())
    expect(screen.getByRole('button', { name: 'Edit' }).style.color).toBe(color);
  });

  it('calls onClick when clicked and not disabled', async () => {
    // Given: an enabled button
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<NoteActionButton label="Delete" onClick={onClick} variant="danger" />);

    // When: the user clicks it
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    // Then: onClick fires
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('dims the button and disables pointer interaction when disabled', () => {
    // Given/When: the button is rendered as disabled
    render(<NoteActionButton label="Delete" onClick={vi.fn()} variant="danger" disabled />);

    // Then: it is disabled with reduced opacity and a default cursor
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button).toHaveProperty('disabled', true);
    expect(button.style.opacity).toBe('0.5');
    expect(button.style.cursor).toBe('default');
  });
});
