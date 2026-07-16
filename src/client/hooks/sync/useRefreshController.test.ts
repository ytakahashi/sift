import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DiffFile, DiffHunk } from '../../../domain/diff/types';
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
  it('refetches notes when refreshed diff content changes', async () => {
    // Given: refresh returns different diff content
    const refresh = vi.fn().mockResolvedValue({
      workingFiles: [createFile('a.ts', 'working', 'newer')],
      stagedFiles: [],
    });
    const refetchNotes = vi.fn();
    const { result } = renderHook(() =>
      useRefreshController({
        workingFiles: [createFile('a.ts', 'working', 'new')],
        stagedFiles: [],
        refresh,
        refetchNotes,
      }),
    );

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then
    expect(refetchNotes).toHaveBeenCalledTimes(1);
  });

  it('refetches notes when content moves between working and staged panes', async () => {
    // Given: refresh returns the same content in a different pane
    // (stage/unstage). The server re-anchors line notes to the new bucket
    // during reconcile, so the client must pick up that result.
    const refresh = vi.fn().mockResolvedValue({
      workingFiles: [],
      stagedFiles: [createFile('a.ts', 'staged', 'new')],
    });
    const refetchNotes = vi.fn();
    const { result } = renderHook(() =>
      useRefreshController({
        workingFiles: [createFile('a.ts', 'working', 'new')],
        stagedFiles: [],
        refresh,
        refetchNotes,
      }),
    );

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then
    expect(refetchNotes).toHaveBeenCalledTimes(1);
  });

  it('does not refetch notes when the refreshed diff is unchanged', async () => {
    // Given: refresh returns the identical pane contents
    const refresh = vi.fn().mockResolvedValue({
      workingFiles: [createFile('a.ts', 'working', 'new')],
      stagedFiles: [],
    });
    const refetchNotes = vi.fn();
    const { result } = renderHook(() =>
      useRefreshController({
        workingFiles: [createFile('a.ts', 'working', 'new')],
        stagedFiles: [],
        refresh,
        refetchNotes,
      }),
    );

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then: no-op filesystem events do not cause extra notes traffic
    expect(refetchNotes).not.toHaveBeenCalled();
  });

  it('skips the refetch when refresh fails or is superseded', async () => {
    // Given: refresh returns null
    const refresh = vi.fn().mockResolvedValue(null);
    const refetchNotes = vi.fn();
    const { result } = renderHook(() =>
      useRefreshController({
        workingFiles: [createFile('a.ts', 'working', 'new')],
        stagedFiles: [],
        refresh,
        refetchNotes,
      }),
    );

    // When
    await act(async () => {
      await result.current.refreshAll();
    });

    // Then
    expect(refetchNotes).not.toHaveBeenCalled();
  });
});
