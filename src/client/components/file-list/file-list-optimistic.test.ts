import { describe, expect, it } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import { removeFileFromPane } from './file-list-optimistic';

function createFile(id: string, bucket: 'working' | 'staged'): DiffFile {
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

describe('file-list-optimistic', () => {
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
