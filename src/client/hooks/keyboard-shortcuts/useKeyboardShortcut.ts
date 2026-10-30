import { useEffect, useEffectEvent } from 'react';
import type { KeyboardPlatform } from '../../application/keyboard-shortcuts/keyboard-platform';
import {
  matchesShortcut,
  type KeyboardShortcut,
} from '../../presentation/keyboard-shortcuts/keyboardShortcut';
import { isEditableElement } from './isEditableElement';

export function useKeyboardShortcut(
  { code, mod = false, alt = false, shift = false }: KeyboardShortcut,
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
        !matchesShortcut(event, { code, mod, alt, shift }, platform) ||
        (!mod && isEditableElement(event.target)) ||
        // ModalDialog is mounted only while open; background actions must stay suspended.
        document.querySelector('[aria-modal="true"]') !== null
      ) {
        return;
      }

      // Consume held keys too, so repeated toggles and browser shortcuts cannot leak through.
      event.preventDefault();
      if (!event.repeat) onShortcut();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [code, mod, alt, shift, platform, enabled]);
}
