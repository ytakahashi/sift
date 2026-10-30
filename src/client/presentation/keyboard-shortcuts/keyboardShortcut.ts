import type { KeyboardPlatform } from '../../application/keyboard-shortcuts/keyboard-platform';

export interface KeyboardShortcut {
  /** Physical key code: Option can change event.key on macOS (Option+B becomes ∫). */
  code: string;
  /** Command on macOS, Control on other platforms. */
  mod?: boolean;
  alt?: boolean;
  shift?: boolean;
}

/** Structural event subset keeps shortcut matching independent of DOM types. */
export interface KeyEventLike {
  code: string;
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
    event.code === shortcut.code &&
    event.metaKey === (platform === 'mac' && !!shortcut.mod) &&
    event.ctrlKey === (platform === 'other' && !!shortcut.mod) &&
    event.altKey === !!shortcut.alt &&
    event.shiftKey === !!shortcut.shift
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

export function formatShortcut(shortcut: KeyboardShortcut, platform: KeyboardPlatform): string {
  const key = keyName(shortcut.code);
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
    keyName(shortcut.code),
  ]
    .filter(Boolean)
    .join('+');
}
