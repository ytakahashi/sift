import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import {
  findSelectedIndex,
  getFileListKeyAction,
  getNextSelectedIndex,
} from './file-list-navigation';

function createFile(id: string): DiffFile {
  return {
    id,
    bucket: 'working',
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath: `${id}.ts`,
    hunks: [],
  };
}

describe('file-list-navigation', () => {
  const files = [createFile('a'), createFile('b'), createFile('c')];

  it('finds the selected index by file id', () => {
    expect(findSelectedIndex(files, 'b')).toBe(1);
  });

  it('returns -1 when no file is selected', () => {
    expect(findSelectedIndex(files, null)).toBe(-1);
  });

  it('maps supported keys to actions', () => {
    expect(getFileListKeyAction('ArrowUp')).toBe('previous');
    expect(getFileListKeyAction('ArrowDown')).toBe('next');
    expect(getFileListKeyAction('Home')).toBe('first');
    expect(getFileListKeyAction('End')).toBe('last');
    expect(getFileListKeyAction('Enter')).toBe('activate');
    expect(getFileListKeyAction('Escape')).toBeNull();
  });

  it('moves to the next item with ArrowDown semantics', () => {
    expect(getNextSelectedIndex(files.length, 1, 'next')).toBe(2);
  });

  it('keeps the last item selected when moving past the end', () => {
    expect(getNextSelectedIndex(files.length, 2, 'next')).toBe(2);
  });

  it('selects the first item when moving down from no selection', () => {
    expect(getNextSelectedIndex(files.length, -1, 'next')).toBe(0);
  });

  it('keeps the first item selected when moving above the start', () => {
    expect(getNextSelectedIndex(files.length, 0, 'previous')).toBe(0);
  });

  it('moves to the previous item with ArrowUp semantics', () => {
    expect(getNextSelectedIndex(files.length, 2, 'previous')).toBe(1);
  });

  it('supports Home and End navigation', () => {
    expect(getNextSelectedIndex(files.length, 1, 'first')).toBe(0);
    expect(getNextSelectedIndex(files.length, 1, 'last')).toBe(2);
  });

  it('returns -1 when there are no files', () => {
    expect(getNextSelectedIndex(0, -1, 'next')).toBe(-1);
  });
});
