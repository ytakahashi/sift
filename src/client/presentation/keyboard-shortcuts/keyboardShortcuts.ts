import type { KeyboardShortcut } from './keyboardShortcut';

export const keyboardShortcuts = {
  toggleFileList: { code: 'KeyB', mod: true },
  toggleRepositorySidebar: { code: 'KeyB', mod: true, alt: true },
} as const satisfies Record<string, KeyboardShortcut>;
