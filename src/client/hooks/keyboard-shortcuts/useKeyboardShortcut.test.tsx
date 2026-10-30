import { cleanup, createEvent, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyboardPlatform } from '../../application/keyboard-shortcuts/keyboard-platform';
import { keyboardShortcuts } from '../../presentation/keyboard-shortcuts/keyboardShortcuts';
import { useKeyboardShortcut } from './useKeyboardShortcut';

const shortcut = keyboardShortcuts.toggleRepositorySidebar;
const keys = { code: 'KeyB', key: '∫', metaKey: true, altKey: true };

function dispatch(target: Document | HTMLElement, values: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...keys,
    ...values,
  });
  fireEvent(target, event);
  return event;
}

const editableElements: HTMLElement[] = [];

afterEach(() => {
  cleanup();
  editableElements.splice(0).forEach((element) => element.remove());
  vi.restoreAllMocks();
});

describe('useKeyboardShortcut', () => {
  it.each(['mac', 'other'] satisfies KeyboardPlatform[])(
    'matches physical keys on %s',
    (platform) => {
      // Given: Option changes key, while code still identifies B
      const handler = vi.fn();
      renderHook(() => useKeyboardShortcut(shortcut, platform, handler));

      // When
      const event = dispatch(document, {
        metaKey: platform === 'mac',
        ctrlKey: platform === 'other',
      });

      // Then
      expect(handler).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(true);
    },
  );

  it('does not consume unrelated, composing, or already handled events', () => {
    // Given
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut(shortcut, 'mac', handler));
    const handled = createEvent.keyDown(document, keys);
    handled.preventDefault();

    // When
    const unrelated = dispatch(document, { shiftKey: true });
    const composing = dispatch(document, { isComposing: true });
    fireEvent(document, handled);

    // Then
    expect(handler).not.toHaveBeenCalled();
    expect(unrelated.defaultPrevented).toBe(false);
    expect(composing.defaultPrevented).toBe(false);
  });

  it('consumes repeats without toggling again', () => {
    // Given
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut(shortcut, 'mac', handler));

    // When
    dispatch(document);
    const repeat = dispatch(document, { repeat: true });

    // Then
    expect(handler).toHaveBeenCalledOnce();
    expect(repeat.defaultPrevented).toBe(true);
  });

  it.each(['input', 'textarea', 'select', 'div'])(
    'allows mod shortcuts but excludes bare keys in editable %s',
    (tag) => {
      // Given: contenteditable is stubbed because jsdom does not implement isContentEditable
      const element = document.createElement(tag);
      if (tag === 'div') Object.defineProperty(element, 'isContentEditable', { value: true });
      editableElements.push(element);
      document.body.append(element);
      const modified = vi.fn();
      const bare = vi.fn();
      renderHook(() => useKeyboardShortcut(shortcut, 'mac', modified));
      renderHook(() => useKeyboardShortcut({ code: 'Slash' }, 'mac', bare));

      // When
      dispatch(element);
      const slash = dispatch(element, { code: 'Slash', key: '/', metaKey: false, altKey: false });

      // Then
      expect(modified).toHaveBeenCalledOnce();
      expect(bare).not.toHaveBeenCalled();
      expect(slash.defaultPrevented).toBe(false);
    },
  );

  it('allows bare keys outside editable controls', () => {
    // Given
    const handler = vi.fn();
    renderHook(() => useKeyboardShortcut({ code: 'Slash' }, 'mac', handler));

    // When
    const event = dispatch(document, { code: 'Slash', key: '/', metaKey: false, altKey: false });

    // Then
    expect(handler).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('uses the latest handler without registering a new listener', () => {
    // Given
    const first = vi.fn();
    const latest = vi.fn();
    const addListener = vi.spyOn(document, 'addEventListener');
    const { rerender } = renderHook(
      ({ handler }) => useKeyboardShortcut({ ...shortcut }, 'mac', handler),
      { initialProps: { handler: first } },
    );
    const count = addListener.mock.calls.filter(([type]) => type === 'keydown').length;

    // When: a fresh definition object and callback are supplied
    rerender({ handler: latest });
    dispatch(document);

    // Then
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    expect(addListener.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(count);
  });

  it('updates registration when enabled changes', () => {
    // Given
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useKeyboardShortcut(shortcut, 'mac', handler, { enabled }),
      { initialProps: { enabled: false } },
    );

    // When
    const initiallyDisabled = dispatch(document);
    rerender({ enabled: true });
    const enabled = dispatch(document);
    rerender({ enabled: false });
    const disabled = dispatch(document);

    // Then
    expect(handler).toHaveBeenCalledOnce();
    expect(initiallyDisabled.defaultPrevented).toBe(false);
    expect(enabled.defaultPrevented).toBe(true);
    expect(disabled.defaultPrevented).toBe(false);
  });

  it('updates registration when platform or definition changes', () => {
    // Given
    const handler = vi.fn();
    const { rerender } = renderHook(
      ({ platform, code }: { platform: KeyboardPlatform; code: string }) =>
        useKeyboardShortcut({ ...shortcut, code }, platform, handler),
      { initialProps: { platform: 'mac' as KeyboardPlatform, code: 'KeyB' } },
    );

    // When: update each dependency separately to catch a missing listener dependency
    rerender({ platform: 'other', code: 'KeyB' });
    const oldPlatform = dispatch(document);
    const currentPlatform = dispatch(document, { metaKey: false, ctrlKey: true });
    rerender({ platform: 'other', code: 'KeyX' });
    const oldCode = dispatch(document, { metaKey: false, ctrlKey: true });
    const currentCode = dispatch(document, { code: 'KeyX', metaKey: false, ctrlKey: true });

    // Then
    expect(handler).toHaveBeenCalledTimes(2);
    expect(oldPlatform.defaultPrevented).toBe(false);
    expect(currentPlatform.defaultPrevented).toBe(true);
    expect(oldCode.defaultPrevented).toBe(false);
    expect(currentCode.defaultPrevented).toBe(true);
  });

  it('removes registration on unmount', () => {
    // Given
    const handler = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcut(shortcut, 'mac', handler));

    // When
    unmount();
    const event = dispatch(document);

    // Then
    expect(handler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    [keyboardShortcuts.toggleFileList, { altKey: false }],
    [keyboardShortcuts.toggleRepositorySidebar, {}],
    [{ code: 'Slash' }, { code: 'Slash', metaKey: false, altKey: false }],
  ])(
    'suspends %j while a modal is mounted and resumes after dismissal',
    (definition, eventKeys) => {
      // Given: the modal mounts after the shortcut listener is registered
      const handler = vi.fn();
      renderHook(() => useKeyboardShortcut(definition, 'mac', handler));
      const modal = render(
        <div role="dialog" aria-modal="true">
          <button>Cancel</button>
        </div>,
      );

      // When: even document-targeted events must not reach background actions
      const blocked = dispatch(document, eventKeys);
      const modalTarget = dispatch(modal.getByRole('button'), eventKeys);
      modal.unmount();
      const resumed = dispatch(document, eventKeys);

      // Then
      expect(blocked.defaultPrevented).toBe(false);
      expect(modalTarget.defaultPrevented).toBe(false);
      expect(resumed.defaultPrevented).toBe(true);
      expect(handler).toHaveBeenCalledOnce();
    },
  );
});
