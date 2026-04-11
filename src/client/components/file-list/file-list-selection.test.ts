import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import {
  findSelectedIndex,
  getFallbackSelectionIndex,
  getSelectionByIndex,
} from './file-list-selection';

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

describe('file-list-selection', () => {
  const files = [createFile('a'), createFile('b'), createFile('c')];

  it('finds the selected index by file id', () => {
    // Given: files [a, b, c]
    // When: selectedFileId is 'b'
    const index = findSelectedIndex(files, 'b');

    // Then: returns index 1
    expect(index).toBe(1);
  });

  it('returns -1 when no file is selected', () => {
    // Given: files [a, b, c]
    // When: selectedFileId is null
    const index = findSelectedIndex(files, null);

    // Then: returns -1
    expect(index).toBe(-1);
  });

  it('keeps the same index when the removed file had a next sibling', () => {
    // Given: a list of 3 items, the file at index 1 ('b') is being removed
    const currentIndex = 1;
    const fileCountBeforeRemoval = 3;

    // When: computing the fallback selection index
    const fallbackIndex = getFallbackSelectionIndex(currentIndex, fileCountBeforeRemoval);

    // Then: returns 1
    // After removal, the new file at index 1 is 'c' (the next sibling of the removed file).
    expect(fallbackIndex).toBe(1);
  });

  it('moves to the previous index when the removed file was the last item', () => {
    // Given: a list of 3 items, the last file at index 2 ('c') is being removed
    const currentIndex = 2;
    const fileCountBeforeRemoval = 3;

    // When: computing the fallback selection index
    const fallbackIndex = getFallbackSelectionIndex(currentIndex, fileCountBeforeRemoval);

    // Then: returns 1
    // Since there is no next sibling, the selection falls back to the previous item ('b').
    expect(fallbackIndex).toBe(1);
  });

  it('returns -1 when removing the only file', () => {
    // Given: a list with only one item, and that item is being removed
    const currentIndex = 0;
    const fileCountBeforeRemoval = 1;

    // When: computing the fallback selection index
    const fallbackIndex = getFallbackSelectionIndex(currentIndex, fileCountBeforeRemoval);

    // Then: returns -1
    // The list becomes empty, so no file can be selected.
    expect(fallbackIndex).toBe(-1);
  });

  it('returns a file for a valid fallback index', () => {
    // Given: a list of files [a, b, c]
    // When: requested index is 1
    const selection = getSelectionByIndex(files, 1);

    // Then: returns file 'b'
    expect(selection?.id).toBe('b');
  });

  it('returns null for an invalid fallback index', () => {
    // Given: a list of files [a, b, c]
    // When: requested index is out of bounds (-1 or 3)
    const selectionBelow = getSelectionByIndex(files, -1);
    const selectionAbove = getSelectionByIndex(files, 3);

    // Then: returns null
    expect(selectionBelow).toBeNull();
    expect(selectionAbove).toBeNull();
  });
});
