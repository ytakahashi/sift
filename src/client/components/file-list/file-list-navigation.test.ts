import { describe, expect, it } from 'vitest';
import { getFileListKeyAction, getNextSelectedIndex } from './file-list-navigation';

describe('file-list-navigation', () => {
  it('maps supported keys to actions', () => {
    // Given/When: various key strings are input
    // Then: they map to the correct FileListKeyAction
    expect(getFileListKeyAction('ArrowUp')).toBe('previous');
    expect(getFileListKeyAction('ArrowDown')).toBe('next');
    expect(getFileListKeyAction('Home')).toBe('first');
    expect(getFileListKeyAction('End')).toBe('last');
    expect(getFileListKeyAction('Enter')).toBe('activate');
    expect(getFileListKeyAction('Escape')).toBeNull();
  });

  it('moves to the next item with ArrowDown semantics', () => {
    // Given: 3 items, current index 1
    const numItems = 3;
    const currentIndex = 1;

    // When: 'next' action is triggered
    const action = 'next';
    const nextIndex = getNextSelectedIndex(numItems, currentIndex, action);

    // Then: moves to index 2
    expect(nextIndex).toBe(2);
  });

  it('keeps the last item selected when moving past the end', () => {
    // Given: 3 items, current index is already at the last item (2)
    const numItems = 3;
    const currentIndex = 2;

    // When: 'next' action is triggered
    const nextIndex = getNextSelectedIndex(numItems, currentIndex, 'next');

    // Then: index stays at 2 (clamped)
    // The caller (useFileListController) treats "no movement" as a boundary
    // signal and delegates navigation to the adjacent pane.
    expect(nextIndex).toBe(2);
  });

  it('selects the first item when moving down from no selection', () => {
    // Given: 3 items, no selection (-1)
    const numItems = 3;
    const currentIndex = -1;

    // When: 'next' action is triggered
    const nextIndex = getNextSelectedIndex(numItems, currentIndex, 'next');

    // Then: selects the first item (0)
    expect(nextIndex).toBe(0);
  });

  it('keeps the first item selected when moving above the start', () => {
    // Given: 3 items, current index is already at the first item (0)
    const numItems = 3;
    const currentIndex = 0;

    // When: 'previous' action is triggered
    const nextIndex = getNextSelectedIndex(numItems, currentIndex, 'previous');

    // Then: index stays at 0 (clamped)
    // Same boundary signal as the end-of-list case above.
    expect(nextIndex).toBe(0);
  });

  it('moves to the previous item with ArrowUp semantics', () => {
    // Given: 3 items, current index 2
    const numItems = 3;
    const currentIndex = 2;

    // When: 'previous' action is triggered
    const nextIndex = getNextSelectedIndex(numItems, currentIndex, 'previous');

    // Then: moves to index 1
    expect(nextIndex).toBe(1);
  });

  it('supports Home and End navigation', () => {
    // Given: 3 items, current index 1
    const numItems = 3;
    const currentIndex = 1;

    // When: 'first' action is triggered
    const firstIndex = getNextSelectedIndex(numItems, currentIndex, 'first');
    // Then: jumps to index 0
    expect(firstIndex).toBe(0);

    // When: 'last' action is triggered
    const lastIndex = getNextSelectedIndex(numItems, currentIndex, 'last');
    // Then: jumps to index 2
    expect(lastIndex).toBe(2);
  });

  it('returns -1 when there are no files', () => {
    // Given: empty list (0 items)
    const numItems = 0;

    // When: any navigation action is triggered
    const nextIndex = getNextSelectedIndex(numItems, -1, 'next');

    // Then: returns -1 (no valid index)
    expect(nextIndex).toBe(-1);
  });
});
