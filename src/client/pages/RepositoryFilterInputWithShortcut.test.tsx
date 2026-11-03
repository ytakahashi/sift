import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RepositoryFilterInputWithShortcut } from './RepositoryFilterInputWithShortcut';

afterEach(cleanup);

describe('RepositoryFilterInputWithShortcut', () => {
  it('focuses and selects the filter value when slash is pressed outside an editable element', () => {
    // Given
    render(
      <RepositoryFilterInputWithShortcut
        platform="other"
        onChange={vi.fn()}
        shortcutEnabled={true}
        value="sift"
      />,
    );
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
        <RepositoryFilterInputWithShortcut
          platform="other"
          onChange={vi.fn()}
          shortcutEnabled={true}
          value="sift"
        />
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
    render(
      <RepositoryFilterInputWithShortcut
        platform="other"
        onChange={vi.fn()}
        shortcutEnabled={true}
        value=""
      />,
    );
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
    render(
      <RepositoryFilterInputWithShortcut
        platform="other"
        onChange={vi.fn()}
        shortcutEnabled={false}
        value=""
      />,
    );
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
      <RepositoryFilterInputWithShortcut
        platform="other"
        onChange={vi.fn()}
        shortcutEnabled={true}
        value=""
      />,
    );
    rerender(
      <RepositoryFilterInputWithShortcut
        platform="other"
        onChange={vi.fn()}
        shortcutEnabled={false}
        value=""
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Filter repositories' });
    const shortcutEvent = createEvent.keyDown(document, { cancelable: true, key: '/' });

    // When
    fireEvent(document, shortcutEvent);

    // Then
    // The input is still mounted, so a listener left registered by the enabled render would focus it.
    expect(document.activeElement).not.toBe(input);
    expect(shortcutEvent.defaultPrevented).toBe(false);
  });

  it.each([
    // Composition belongs to the IME, so the event is left untouched.
    { scenario: 'IME composition', init: { isComposing: true }, handled: false, prevented: false },
    // A held key is consumed even though it does not act again.
    { scenario: 'a key repeat', init: { repeat: true }, handled: false, prevented: true },
    // Another handler already consumed the event, so it stays prevented.
    { scenario: 'a handled event', init: {}, handled: true, prevented: true },
  ])('does not focus the filter for $scenario', ({ init, handled, prevented }) => {
    // Given
    render(
      <RepositoryFilterInputWithShortcut
        platform="mac"
        onChange={vi.fn()}
        shortcutEnabled={true}
        value="sift"
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Filter repositories' });
    const event = createEvent.keyDown(document, { key: '/', cancelable: true, ...init });
    if (handled) event.preventDefault();

    // When
    fireEvent(document, event);

    // Then
    expect(document.activeElement).not.toBe(input);
    expect(event.defaultPrevented).toBe(prevented);
  });

  it('leaves a held slash to the filter once the first press has focused it', () => {
    // Given
    render(
      <RepositoryFilterInputWithShortcut
        platform="mac"
        onChange={vi.fn()}
        shortcutEnabled={true}
        value="sift"
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Filter repositories' });
    fireEvent.keyDown(document, { key: '/' });
    const held = createEvent.keyDown(input, { key: '/', repeat: true, cancelable: true });

    // When
    fireEvent(input, held);

    // Then
    // Repeats now target the editable filter, so the browser types them over the selected value.
    expect(document.activeElement).toBe(input);
    expect(held.defaultPrevented).toBe(false);
  });

  it('forwards the value and layout class to the filter input', () => {
    // Given / When
    render(
      <RepositoryFilterInputWithShortcut
        className="host-filter"
        platform="mac"
        onChange={vi.fn()}
        shortcutEnabled={true}
        value="sift"
      />,
    );

    // Then
    expect(screen.getByRole('search', { name: 'Repository filter' }).classList).toContain(
      'host-filter',
    );
    expect(
      screen.getByRole<HTMLInputElement>('textbox', { name: 'Filter repositories' }).value,
    ).toBe('sift');
  });

  it('preserves slash input in the focused filter', () => {
    // Given
    render(
      <RepositoryFilterInputWithShortcut
        platform="mac"
        onChange={vi.fn()}
        shortcutEnabled={true}
        value="sift"
      />,
    );
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Filter repositories' });
    input.focus();
    input.setSelectionRange(2, 2);
    const event = createEvent.keyDown(input, { key: '/', cancelable: true });

    // When
    fireEvent(input, event);

    // Then
    expect(input.selectionStart).toBe(2);
    expect(input.selectionEnd).toBe(2);
    expect(event.defaultPrevented).toBe(false);
  });
});
