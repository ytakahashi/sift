import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import { findSelectedIndex } from './useFileListController';

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

describe('findSelectedIndex', () => {
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
});
