import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../domain/diff/types';
import { getFallbackSelectionIndex, getSelectionByIndex, removeFileFromPane } from './pane-files';

function createFile(id: string, bucket: 'working' | 'staged' = 'working'): DiffFile {
  return {
    id,
    bucket,
    path: `${id}.ts`,
    status: 'modified',
    kind: 'text',
    displayPath: `${id}.ts`,
    hunks: [],
  };
}

describe('pane-files', () => {
  describe('selection lookup', () => {
    const files = [createFile('a'), createFile('b'), createFile('c')];

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

  describe('fallback selection calculation', () => {
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
  });

  describe('removeFileFromPane', () => {
    it('removes a file from the source pane immediately', () => {
      // Given: a pane with two files
      const sourceFiles = [createFile('a', 'working'), createFile('b', 'working')];

      // When: the file 'b' is removed
      const result = removeFileFromPane({ sourceFiles, fileId: 'b' });

      // Then: 'b' is absent from nextSourceFiles and returned as removedFile
      expect(result.nextSourceFiles.map((file) => file.id)).toEqual(['a']);
      expect(result.removedFile?.id).toBe('b');
    });

    it('returns the original list when the file is missing', () => {
      // Given: a pane that does not contain the target file
      const sourceFiles = [createFile('a', 'working')];

      // When: a non-existent file id is passed
      const result = removeFileFromPane({ sourceFiles, fileId: 'missing' });

      // Then: the original array reference is returned unchanged (no allocation)
      // and removedFile is null — the caller uses this as a guard against
      // race conditions such as double-clicking before the first action completes.
      expect(result.nextSourceFiles).toBe(sourceFiles);
      expect(result.removedFile).toBeNull();
    });
  });
});
