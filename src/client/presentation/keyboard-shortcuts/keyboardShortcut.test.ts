import { describe, expect, it } from 'vitest';
import type { KeyboardPlatform } from '../../application/keyboard-shortcuts/keyboard-platform';
import {
  matchesShortcut,
  formatShortcut,
  toAriaKeyShortcuts,
  type KeyboardShortcut,
  type KeyEventLike,
} from './keyboardShortcut';
import { keyboardShortcuts } from './keyboardShortcuts';

const platforms: KeyboardPlatform[] = ['mac', 'other'];

describe('matchesShortcut', () => {
  it.each([
    ['mac', { metaKey: true }, true],
    ['mac', { ctrlKey: true }, false],
    ['mac', { metaKey: true, ctrlKey: true }, false],
    ['other', { ctrlKey: true }, true],
    ['other', { metaKey: true }, false],
    ['other', { metaKey: true, ctrlKey: true }, false],
  ] satisfies [KeyboardPlatform, Partial<KeyEventLike>, boolean][])(
    'maps the primary modifier on %s for %j',
    (platform, modifiers, expected) => {
      // Given: Command belongs to macOS and Control belongs to other platforms
      const event = {
        code: 'KeyB',
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        ...modifiers,
      };

      // When
      const matches = matchesShortcut(event, keyboardShortcuts.toggleFileList, platform);

      // Then
      expect(matches).toBe(expected);
    },
  );

  for (const platform of platforms) {
    const shortcuts: KeyboardShortcut[] = [
      keyboardShortcuts.toggleFileList,
      keyboardShortcuts.toggleRepositorySidebar,
      { code: 'Slash' },
      { code: 'KeyB', mod: true, alt: true, shift: true },
    ];
    for (const shortcut of shortcuts) {
      it(`requires exact modifiers for ${JSON.stringify(shortcut)} on ${platform}`, () => {
        // Given: all combinations, including the other platform's primary modifier
        for (let mask = 0; mask < 16; mask++) {
          const event = {
            code: shortcut.code,
            metaKey: !!(mask & 1),
            ctrlKey: !!(mask & 2),
            altKey: !!(mask & 4),
            shiftKey: !!(mask & 8),
          };
          const expectedMask =
            (shortcut.mod ? (platform === 'mac' ? 1 : 2) : 0) |
            (shortcut.alt ? 4 : 0) |
            (shortcut.shift ? 8 : 0);

          // When / Then
          expect(matchesShortcut(event, shortcut, platform)).toBe(mask === expectedMask);
          expect(matchesShortcut({ ...event, code: 'KeyX' }, shortcut, platform)).toBe(false);
        }
      });
    }
  }
});

describe('shortcut formatting', () => {
  it.each([
    ['mac', keyboardShortcuts.toggleFileList, '⌘B', 'Meta+B'],
    ['other', keyboardShortcuts.toggleFileList, 'Ctrl+B', 'Control+B'],
    ['mac', keyboardShortcuts.toggleRepositorySidebar, '⌥⌘B', 'Meta+Alt+B'],
    ['other', keyboardShortcuts.toggleRepositorySidebar, 'Ctrl+Alt+B', 'Control+Alt+B'],
    ['mac', { code: 'KeyB', mod: true, alt: true, shift: true }, '⌥⇧⌘B', 'Meta+Alt+Shift+B'],
    [
      'other',
      { code: 'KeyB', mod: true, alt: true, shift: true },
      'Ctrl+Alt+Shift+B',
      'Control+Alt+Shift+B',
    ],
    ['mac', { code: 'Slash' }, '/', '/'],
    ['other', { code: 'Digit1', mod: true }, 'Ctrl+1', 'Control+1'],
    ['other', { code: 'Escape' }, 'Escape', 'Escape'],
  ] satisfies [KeyboardPlatform, KeyboardShortcut, string, string][])(
    'formats %s %j',
    (platform, shortcut, label, aria) => {
      // Given / When / Then: both representations come from the same shortcut
      expect(formatShortcut(shortcut, platform)).toBe(label);
      expect(toAriaKeyShortcuts(shortcut, platform)).toBe(aria);
    },
  );
});
