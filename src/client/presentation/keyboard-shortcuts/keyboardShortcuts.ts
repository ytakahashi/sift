import type { KeyboardShortcut } from './keyboardShortcut';

export const keyboardShortcuts = {
  focusRepositoryFilter: { key: '/' },
  toggleFileList: { code: 'KeyB', mod: true },
  toggleRepositorySidebar: { code: 'KeyB', mod: true, alt: true },
} as const satisfies Record<string, KeyboardShortcut>;
