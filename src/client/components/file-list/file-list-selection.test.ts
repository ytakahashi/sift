import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import { getFallbackSelectionIndex, getSelectionByIndex } from './file-list-selection';

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

  it('keeps the same index when the removed file had a next sibling', () => {
    expect(getFallbackSelectionIndex(1, files.length)).toBe(1);
  });

  it('moves to the previous index when the removed file was the last item', () => {
    expect(getFallbackSelectionIndex(2, files.length)).toBe(1);
  });

  it('returns -1 when removing the only file', () => {
    expect(getFallbackSelectionIndex(0, 1)).toBe(-1);
  });

  it('returns a file for a valid fallback index', () => {
    expect(getSelectionByIndex(files, 1)?.id).toBe('b');
  });

  it('returns null for an invalid fallback index', () => {
    expect(getSelectionByIndex(files, -1)).toBeNull();
    expect(getSelectionByIndex(files, 3)).toBeNull();
  });
});
