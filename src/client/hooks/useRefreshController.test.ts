import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile, DiffHunk } from '../../domain/diff/types';
import { useRefreshController } from './useRefreshController';

function createHunk(content: string): DiffHunk {
  return {
    id: `hunk-${content}`,
    header: '@@ -1,1 +1,1 @@',
    oldStart: 1,
    oldLines: 1,
    newStart: 1,
    newLines: 1,
    lines: [
      { id: `delete-${content}`, type: 'delete', oldLineNumber: 1, content: 'old' },
      { id: `add-${content}`, type: 'add', newLineNumber: 1, content },
    ],
  };
}

function createFile(path: string, bucket: 'working' | 'staged', content: string): DiffFile {
  return {
    id: path,
    bucket,
    path,
    status: 'modified',
    kind: 'text',
    displayPath: path,
    hunks: [createHunk(content)],
  };
}

describe('useRefreshController', () => {
  it('clears notes when refreshed diff content changes', async () => {
    // Given: refresh returns different diff content
    const refresh = vi.fn().mockResolvedValue({
      workingFiles: [createFile('a.ts', 'working', 'newer')],
      stagedFiles: [],
    });
    const clearNotes = vi.fn();
    const { result } = renderHook(() =>
      useRefreshController({
        workingFiles: [createFile('a.ts', 'working', 'new')],
        stagedFiles: [],
        refresh,
        clearNotes,
      }),
    );

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then
    expect(clearNotes).toHaveBeenCalledTimes(1);
  });

  it('keeps notes when refreshed diff only moves between working and staged panes', async () => {
    // Given: refresh returns the same content in a different pane
    const refresh = vi.fn().mockResolvedValue({
      workingFiles: [],
      stagedFiles: [createFile('a.ts', 'staged', 'new')],
    });
    const clearNotes = vi.fn();
    const { result } = renderHook(() =>
      useRefreshController({
        workingFiles: [createFile('a.ts', 'working', 'new')],
        stagedFiles: [],
        refresh,
        clearNotes,
      }),
    );

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then
    expect(clearNotes).not.toHaveBeenCalled();
  });

  it('keeps notes when refresh fails or is superseded', async () => {
    // Given: refresh returns null
    const refresh = vi.fn().mockResolvedValue(null);
    const clearNotes = vi.fn();
    const { result } = renderHook(() =>
      useRefreshController({
        workingFiles: [createFile('a.ts', 'working', 'new')],
        stagedFiles: [],
        refresh,
        clearNotes,
      }),
    );

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then
    expect(clearNotes).not.toHaveBeenCalled();
  });
});
