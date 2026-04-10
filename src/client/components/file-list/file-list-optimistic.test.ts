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
    const sourceFiles = [createFile('a', 'working'), createFile('b', 'working')];

    const result = removeFileFromPane({
      sourceFiles,
      fileId: 'b',
    });

    expect(result.nextSourceFiles.map((file) => file.id)).toEqual(['a']);
    expect(result.removedFile?.id).toBe('b');
  });

  it('returns the original list when the file is missing', () => {
    const sourceFiles = [createFile('a', 'working')];

    const result = removeFileFromPane({
      sourceFiles,
      fileId: 'missing',
    });

    expect(result.nextSourceFiles).toBe(sourceFiles);
    expect(result.removedFile).toBeNull();
  });
});
