import { useRef, type ReactElement } from 'react';
import type { KeyboardPlatform } from '../application/keyboard-shortcuts/keyboard-platform';
import {
  RepositoryFilterInput,
  type RepositoryFilterHostProps,
} from '../components/repository-filter/RepositoryFilterInput';
import { useKeyboardShortcut } from '../hooks/keyboard-shortcuts/useKeyboardShortcut';
import { keyboardShortcuts } from '../presentation/keyboard-shortcuts/keyboardShortcuts';

export function RepositoryFilterInputWithShortcut({
  platform,
  shortcutEnabled,
  ...props
}: RepositoryFilterHostProps & { platform: KeyboardPlatform }): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  useKeyboardShortcut(
    keyboardShortcuts.focusRepositoryFilter,
    platform,
    () => {
      inputRef.current?.focus();
      inputRef.current?.select();
    },
    { enabled: shortcutEnabled },
  );

  return <RepositoryFilterInput {...props} inputRef={inputRef} />;
}
