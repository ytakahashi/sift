import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositoryFilterInput } from './RepositoryFilterInput';

describe('RepositoryFilterInput', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the accessible search field and an additional layout class', () => {
    // Given / When
    render(
      <RepositoryFilterInput
        className="host-filter"
        onChange={vi.fn()}
        shortcutEnabled={true}
        value=""
      />,
    );

    // Then
    const search = screen.getByRole('search', { name: 'Repository filter' });
    expect(search.classList).toContain('repository-filter');
    expect(search.classList).toContain('host-filter');
    expect(screen.getByRole('textbox', { name: 'Filter repositories' })).toHaveProperty(
      'placeholder',
      'Filter repositories',
    );
  });

  it('reports input changes to the caller', () => {
    // Given
    const onChange = vi.fn();
    render(<RepositoryFilterInput onChange={onChange} shortcutEnabled={true} value="" />);

    // When
    fireEvent.change(screen.getByRole('textbox', { name: 'Filter repositories' }), {
      target: { value: 'sift' },
    });

    // Then
    // Controlled input: only the reported value is verified; the host owns the state.
    expect(onChange).toHaveBeenCalledWith('sift');
  });

  it('shows the clear button only for a non-empty value and reports a clear action', async () => {
    // Given
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <RepositoryFilterInput onChange={onChange} shortcutEnabled={true} value="" />,
    );
    expect(screen.queryByRole('button', { name: 'Clear repository filter' })).toBeNull();
    rerender(<RepositoryFilterInput onChange={onChange} shortcutEnabled={true} value="sift" />);

    // When
    await user.click(screen.getByRole('button', { name: 'Clear repository filter' }));

    // Then
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('reports a clear action when Escape is pressed', () => {
    // Given
    const onChange = vi.fn();
    render(<RepositoryFilterInput onChange={onChange} shortcutEnabled={true} value="sift" />);

    // When
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Filter repositories' }), {
      key: 'Escape',
    });

    // Then
    // Controlled input: only the reported value is verified; the host owns the state.
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('does not clear the value with Escape during IME composition', () => {
    // Given
    const onChange = vi.fn();
    render(<RepositoryFilterInput onChange={onChange} shortcutEnabled={true} value="sift" />);

    // When
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Filter repositories' }), {
      isComposing: true,
      key: 'Escape',
    });

    // Then
    expect(onChange).not.toHaveBeenCalled();
  });

  it('focuses and selects the filter value when slash is pressed outside an editable element', () => {
    // Given
    render(<RepositoryFilterInput onChange={vi.fn()} shortcutEnabled={true} value="sift" />);
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Filter repositories' });
    const shortcutEvent = createEvent.keyDown(document, { cancelable: true, key: '/' });

    // When
    fireEvent(document, shortcutEvent);

    // Then
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(4);
    expect(shortcutEvent.defaultPrevented).toBe(true);
  });

  it('does not take slash input from another editable element', () => {
    // Given
    render(
      <>
        <RepositoryFilterInput onChange={vi.fn()} shortcutEnabled={true} value="sift" />
        <textarea aria-label="Other editor" />
      </>,
    );
    const filterInput = screen.getByRole('textbox', { name: 'Filter repositories' });
    const editor = screen.getByRole('textbox', { name: 'Other editor' });
    editor.focus();
    const shortcutEvent = createEvent.keyDown(editor, { cancelable: true, key: '/' });

    // When
    fireEvent(editor, shortcutEvent);

    // Then
    expect(document.activeElement).toBe(editor);
    expect(document.activeElement).not.toBe(filterInput);
    expect(shortcutEvent.defaultPrevented).toBe(false);
  });

  it('does not focus the filter for modified slash shortcuts', () => {
    // Given
    render(<RepositoryFilterInput onChange={vi.fn()} shortcutEnabled={true} value="" />);
    const input = screen.getByRole('textbox', { name: 'Filter repositories' });
    const shortcutEvents = [
      createEvent.keyDown(document, { altKey: true, cancelable: true, key: '/' }),
      createEvent.keyDown(document, { cancelable: true, ctrlKey: true, key: '/' }),
      createEvent.keyDown(document, { cancelable: true, key: '/', metaKey: true }),
    ];

    // When
    shortcutEvents.forEach((event) => fireEvent(document, event));

    // Then
    expect(document.activeElement).not.toBe(input);
    shortcutEvents.forEach((event) => expect(event.defaultPrevented).toBe(false));
  });

  it('does not focus the filter when the shortcut is disabled', () => {
    // Given
    render(<RepositoryFilterInput onChange={vi.fn()} shortcutEnabled={false} value="" />);
    const input = screen.getByRole('textbox', { name: 'Filter repositories' });
    const shortcutEvent = createEvent.keyDown(document, { cancelable: true, key: '/' });

    // When
    fireEvent(document, shortcutEvent);

    // Then
    expect(document.activeElement).not.toBe(input);
    expect(shortcutEvent.defaultPrevented).toBe(false);
  });

  it('stops handling the slash shortcut when it is disabled after being enabled', () => {
    // Given
    const { rerender } = render(
      <RepositoryFilterInput onChange={vi.fn()} shortcutEnabled={true} value="" />,
    );
    rerender(<RepositoryFilterInput onChange={vi.fn()} shortcutEnabled={false} value="" />);
    const input = screen.getByRole('textbox', { name: 'Filter repositories' });
    const shortcutEvent = createEvent.keyDown(document, { cancelable: true, key: '/' });

    // When
    fireEvent(document, shortcutEvent);

    // Then
    // The input is still mounted, so a listener left registered by the enabled render would focus it.
    expect(document.activeElement).not.toBe(input);
    expect(shortcutEvent.defaultPrevented).toBe(false);
  });
});
