import { describe, expect, it } from 'vitest';
import { getFileListKeyAction, getNextSelectedIndex } from './file-list-navigation';

describe('file-list-navigation', () => {
  it('maps supported keys to actions', () => {
    expect(getFileListKeyAction('ArrowUp')).toBe('previous');
    expect(getFileListKeyAction('ArrowDown')).toBe('next');
    expect(getFileListKeyAction('Home')).toBe('first');
    expect(getFileListKeyAction('End')).toBe('last');
    expect(getFileListKeyAction('Enter')).toBe('activate');
    expect(getFileListKeyAction('Escape')).toBeNull();
  });

  it('moves to the next item with ArrowDown semantics', () => {
    expect(getNextSelectedIndex(3, 1, 'next')).toBe(2);
  });

  it('keeps the last item selected when moving past the end', () => {
    expect(getNextSelectedIndex(3, 2, 'next')).toBe(2);
  });

  it('selects the first item when moving down from no selection', () => {
    expect(getNextSelectedIndex(3, -1, 'next')).toBe(0);
  });

  it('keeps the first item selected when moving above the start', () => {
    expect(getNextSelectedIndex(3, 0, 'previous')).toBe(0);
  });

  it('moves to the previous item with ArrowUp semantics', () => {
    expect(getNextSelectedIndex(3, 2, 'previous')).toBe(1);
  });

  it('supports Home and End navigation', () => {
    expect(getNextSelectedIndex(3, 1, 'first')).toBe(0);
    expect(getNextSelectedIndex(3, 1, 'last')).toBe(2);
  });

  it('returns -1 when there are no files', () => {
    expect(getNextSelectedIndex(0, -1, 'next')).toBe(-1);
  });
});
