import { describe, expect, it, vi } from 'vitest';
import type { DiffFile } from '../../../domain/diff/types';
import { removeFileFromPane, runOptimistic } from './file-list-optimistic';

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

describe('runOptimistic', () => {
  it('applies the optimistic update, calls serverCall, and returns true on success', async () => {
    // Given: all callbacks are mocked and serverCall resolves
    const getSnapshot = vi.fn(() => 'snapshot-value');
    const applyOptimistic = vi.fn();
    const serverCall = vi.fn().mockResolvedValue(undefined);
    const rollback = vi.fn();

    // When
    const result = await runOptimistic(getSnapshot, applyOptimistic, serverCall, rollback);

    // Then: optimistic update was applied, rollback was not called, result is true
    expect(applyOptimistic).toHaveBeenCalledOnce();
    expect(serverCall).toHaveBeenCalledOnce();
    expect(rollback).not.toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('applies the optimistic update, calls rollback with the snapshot, and returns false on failure', async () => {
    // Given: serverCall rejects
    const getSnapshot = vi.fn(() => 'snap');
    const applyOptimistic = vi.fn();
    const serverCall = vi.fn().mockRejectedValue(new Error('network error'));
    const rollback = vi.fn();

    // When
    const result = await runOptimistic(getSnapshot, applyOptimistic, serverCall, rollback);

    // Then: rollback receives the exact snapshot value returned by getSnapshot
    expect(applyOptimistic).toHaveBeenCalledOnce();
    expect(rollback).toHaveBeenCalledWith('snap');
    expect(result).toBe(false);
  });

  it('passes a typed snapshot to rollback without losing type information', async () => {
    // Given: snapshot is an array (verifies the generic type parameter is preserved)
    const snapshot = [1, 2, 3];
    const getSnapshot = vi.fn(() => snapshot);
    const rollback = vi.fn();
    const serverCall = vi.fn().mockRejectedValue(new Error('fail'));

    // When
    await runOptimistic(getSnapshot, vi.fn(), serverCall, rollback);

    // Then: the exact array reference is passed to rollback
    expect(rollback).toHaveBeenCalledWith(snapshot);
  });
});
