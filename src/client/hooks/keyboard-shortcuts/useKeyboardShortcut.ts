import { useEffect, useEffectEvent } from 'react';
import type { KeyboardPlatform } from '../../application/keyboard-shortcuts/keyboard-platform';
import {
  matchesShortcut,
  type KeyboardShortcut,
} from '../../presentation/keyboard-shortcuts/keyboardShortcut';
import { isEditableElement } from './isEditableElement';

export function useKeyboardShortcut(
  { code, key, mod = false, alt = false, shift }: KeyboardShortcut,
  platform: KeyboardPlatform,
  handler: () => void,
  { enabled = true }: { enabled?: boolean } = {},
): void {
  const onShortcut = useEffectEvent(handler);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        !matchesShortcut(
          event,
          { ...(key !== undefined ? { key } : { code }), mod, alt, shift },
          platform,
        ) ||
        (!mod && isEditableElement(event.target)) ||
        // ModalDialog is mounted only while open; background actions must stay suspended.
        document.querySelector('[aria-modal="true"]') !== null
      ) {
        return;
      }

      // Consume held keys too, so repeated toggles and browser shortcuts cannot leak through.
      // Exception: once an unmodified shortcut moves focus into an editable element, the check
      // above leaves its repeats to that element, so holding the key types there.
      event.preventDefault();
      if (!event.repeat) onShortcut();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [code, key, mod, alt, shift, platform, enabled]);
}
