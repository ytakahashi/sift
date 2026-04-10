export type FileListKeyAction = 'previous' | 'next' | 'first' | 'last' | 'activate' | null;

export function getFileListKeyAction(key: string): FileListKeyAction {
  switch (key) {
    case 'ArrowUp':
      return 'previous';
    case 'ArrowDown':
      return 'next';
    case 'Home':
      return 'first';
    case 'End':
      return 'last';
    case 'Enter':
      return 'activate';
    default:
      return null;
  }
}

/**
 * Computes the next selected index in a file list after a navigation action.
 *
 * Behavior per action (given a list of 3 items [0, 1, 2]):
 *
 * - **'next'** (ArrowDown): Moves selection down by one.
 *   - At index 1 → returns 2.
 *   - At index 2 (last item) → stays at 2 (clamped to the end).
 *   - With no selection (-1) → returns 0 (selects the first item).
 *
 * - **'previous'** (ArrowUp): Moves selection up by one.
 *   - At index 2 → returns 1.
 *   - At index 0 (first item) → stays at 0 (clamped to the start).
 *
 * - **'first'** (Home): Always returns 0.
 * - **'last'** (End): Always returns fileCount - 1.
 *
 * When the returned index equals `currentIndex` for 'previous' or 'next',
 * the caller (useFileListController) treats it as a boundary hit and may
 * delegate navigation to the adjacent pane.
 *
 * Returns -1 when the list is empty.
 */
export function getNextSelectedIndex(
  fileCount: number,
  currentIndex: number,
  action: Exclude<FileListKeyAction, 'activate' | null>,
): number {
  if (fileCount === 0) {
    return -1;
  }

  switch (action) {
    case 'previous':
      return currentIndex <= 0 ? 0 : currentIndex - 1;
    case 'next':
      return currentIndex < 0 ? 0 : Math.min(currentIndex + 1, fileCount - 1);
    case 'first':
      return 0;
    case 'last':
      return fileCount - 1;
  }
}
