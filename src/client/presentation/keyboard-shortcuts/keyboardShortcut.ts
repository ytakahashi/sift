import type { KeyboardPlatform } from '../../application/keyboard-shortcuts/keyboard-platform';

export type KeyboardShortcut = (
  | {
      /** Physical key code: Option can change event.key on macOS (Option+B becomes ∫). */
      code: string;
      key?: never;
    }
  | {
      /** Produced character, independent of the physical key on the host keyboard layout. */
      key: string;
      code?: never;
    }
) & {
  /** Command on macOS, Control on other platforms. */
  mod?: boolean;
  alt?: boolean;
  /** Omitted Shift is ignored for character shortcuts, and forbidden for physical shortcuts. */
  shift?: boolean;
};

/** Structural event subset keeps shortcut matching independent of DOM types. */
export interface KeyEventLike {
  code: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

export function matchesShortcut(
  event: KeyEventLike,
  shortcut: KeyboardShortcut,
  platform: KeyboardPlatform,
): boolean {
  return (
    (shortcut.key !== undefined ? event.key === shortcut.key : event.code === shortcut.code) &&
    event.metaKey === (platform === 'mac' && !!shortcut.mod) &&
    event.ctrlKey === (platform === 'other' && !!shortcut.mod) &&
    event.altKey === !!shortcut.alt &&
    // A character such as slash may require Shift on some keyboard layouts.
    ((shortcut.key !== undefined && shortcut.shift === undefined) ||
      event.shiftKey === !!shortcut.shift)
  );
}

const keyNames: Readonly<Record<string, string>> = {
  Slash: '/',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Space: 'Space',
};

function keyName(code: string): string {
  return keyNames[code] ?? code.replace(/^(Key|Digit)([A-Z0-9])$/, '$2');
}

function shortcutKeyName(shortcut: KeyboardShortcut): string {
  return shortcut.key !== undefined ? shortcut.key : keyName(shortcut.code);
}

export function formatShortcut(shortcut: KeyboardShortcut, platform: KeyboardPlatform): string {
  const key = shortcutKeyName(shortcut);
  if (platform === 'mac') {
    return `${shortcut.alt ? '⌥' : ''}${shortcut.shift ? '⇧' : ''}${shortcut.mod ? '⌘' : ''}${key}`;
  }
  return [shortcut.mod && 'Ctrl', shortcut.alt && 'Alt', shortcut.shift && 'Shift', key]
    .filter(Boolean)
    .join('+');
}

export function toAriaKeyShortcuts(shortcut: KeyboardShortcut, platform: KeyboardPlatform): string {
  return [
    shortcut.mod && (platform === 'mac' ? 'Meta' : 'Control'),
    shortcut.alt && 'Alt',
    shortcut.shift && 'Shift',
    shortcutKeyName(shortcut),
  ]
    .filter(Boolean)
    .join('+');
}
