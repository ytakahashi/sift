import { useEffect, useState } from 'react';

const COPIED_FEEDBACK_DURATION_MS = 2000;

/**
 * Copies text to the clipboard and tracks a transient "Copied!" flag that
 * auto-clears after COPIED_FEEDBACK_DURATION_MS. Shared by NoteViewer and
 * NotesListModal, which each show their own copy-feedback tooltip driven by
 * this state.
 */
export function useCopyFeedback(): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => {
      setCopied(false);
    }, COPIED_FEEDBACK_DURATION_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = (text: string): void => {
    void navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      (error: unknown) => {
        if (error instanceof Error) {
          console.error('Failed to copy note(s):', error.message);
        }
      },
    );
  };

  return { copied, copy };
}
